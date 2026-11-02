"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { useOfflineQuery, useOfflineMutation } from "@/lib/offline";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { FullScreenCalendar } from "@/components/ui/fullscreen-calendar";
import type { CalendarDayData, CalendarEvent } from "@/components/ui/fullscreen-calendar";
import { PlannerTaskRow } from "@/components/planner/PlannerWorkflowTaskUi";
import { PlannerTaskGroup } from "@/components/planner/PlannerTaskGroup";
import {
  addDaysToPlannerDate,
  comparePlannerTasksByDue,
  filterPlannerTasksByBuild,
  groupPlannerTasks,
  isPlannerTaskClosed,
  isPlannerTaskOverdue,
  listPlannerBuildFilters,
  plannerLocalDate,
  plannerTimeGroupFor,
} from "@/components/planner/groupPlannerTasks";
import {
  computePlannerTaskDropZone,
  parseLocalDate,
  plannerTaskScopeKey,
  pointInsideRect,
  type DropZone,
  type PlannerTaskDragMeta,
} from "@kyarafit/design-system/domain";

type TodoView = "daily" | "events" | "calendar";

type PlannerTask = {
  _id: Id<"workflowItems">;
  title: string;
  kind: string;
  status: string;
  category: string;
  parentId?: Id<"workflowItems">;
  ancestorIds: Id<"workflowItems">[];
  sortOrder: number;
  progressPercent: number;
  buildId?: Id<"builds">;
  buildName: string | null;
  conventionId?: Id<"conventions">;
  conventionName?: string | null;
  cosplayNodeId?: Id<"cosplayNodes">;
  packingListItemId?: string;
  dueDate?: string;
  priority?: number;
  blockedByCount?: number;
  overdue?: boolean;
  blockedByTitles?: string[];
};

type PlannerTaskNode = PlannerTask & { children: PlannerTaskNode[] };

/** Children keep the user's manual order (drag-to-reorder); roots read soonest-due first. */
function comparePlannerTasks(a: PlannerTask, b: PlannerTask) {
  if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  const dateA = a.dueDate ?? "9999-12-31";
  const dateB = b.dueDate ?? "9999-12-31";
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return a.title.localeCompare(b.title);
}

/**
 * Nest a time group's tasks by `parentId`. A child whose parent landed in a
 * different group (or was filtered out) becomes a root of this group.
 */
function buildTaskHierarchy(tasks: PlannerTask[]): PlannerTaskNode[] {
  const nodeMap = new Map<string, PlannerTaskNode>();
  for (const task of tasks) {
    nodeMap.set(task._id as string, { ...task, children: [] });
  }

  const roots: PlannerTaskNode[] = [];
  for (const task of tasks) {
    const node = nodeMap.get(task._id as string);
    if (!node) continue;
    const parent = task.parentId != null ? nodeMap.get(task.parentId as string) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortChildren = (nodes: PlannerTaskNode[]) => {
    for (const node of nodes) {
      node.children.sort(comparePlannerTasks);
      sortChildren(node.children);
    }
  };
  roots.sort(comparePlannerTasksByDue);
  sortChildren(roots);
  return roots;
}

type PlannerDragState = {
  draggingMeta: PlannerTaskDragMeta | null;
  dragOverTaskId: string | null;
  dragOverZone: DropZone | null;
  dragOverRootScopeKey: string | null;
  pointerX: number | null;
  pointerY: number | null;
};

type PlannerDragController = {
  state: PlannerDragState;
  startDrag: (meta: PlannerTaskDragMeta, event: ReactPointerEvent<HTMLElement>) => void;
};

/** Everything a task row needs from the page, threaded through the nested lists. */
type PlannerRowContext = {
  userId: string | null;
  onToggle: (id: Id<"workflowItems">, checked: boolean) => Promise<unknown>;
  dragController: PlannerDragController;
  describeDue: (task: PlannerTask) => { label?: string; urgent: boolean };
  labels: { dropInto: string; contextFallback: string; blocked: string };
};

const tabFocusClassName =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded-sm";

type WorkflowDropTask = Pick<PlannerTask, "_id" | "sortOrder"> & {
  parentId?: Id<"workflowItems"> | null;
  scopeKey: string;
};

async function resequencePlannerTasks(
  updateTask: (args: {
    id: Id<"workflowItems">;
    userId: string;
    sortOrder: number;
  }) => Promise<unknown>,
  userId: string,
  ids: Id<"workflowItems">[]
) {
  for (let index = 0; index < ids.length; index += 1) {
    await updateTask({ id: ids[index], userId, sortOrder: index });
  }
}

async function applyPlannerTreeDrop({
  dragged,
  target,
  zone,
  tasks,
  userId,
  moveTask,
  updateTask,
}: {
  dragged: PlannerTaskDragMeta;
  target: PlannerTaskDragMeta;
  zone: DropZone;
  tasks: WorkflowDropTask[];
  userId: string;
  moveTask: (args: {
    id: Id<"workflowItems">;
    userId: string;
    parentId?: Id<"workflowItems"> | null;
    sortOrder?: number;
  }) => Promise<unknown>;
  updateTask: (args: {
    id: Id<"workflowItems">;
    userId: string;
    sortOrder: number;
  }) => Promise<unknown>;
}) {
  const dragId = dragged.taskId as Id<"workflowItems">;
  const targetId = target.taskId as Id<"workflowItems">;
  const D = tasks.find((task) => task._id === dragId);
  const T = tasks.find((task) => task._id === targetId);
  if (!D || !T) return;
  if (D.scopeKey !== T.scopeKey) return;

  const siblingIdsForParent = (parentId: Id<"workflowItems"> | null, scopeKey: string) =>
    tasks
      .filter((task) => task.scopeKey === scopeKey && (task.parentId ?? null) === parentId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((task) => task._id);

  if (zone === "into") {
    const oldParent = D.parentId ?? null;
    const existingIds = siblingIdsForParent(targetId, D.scopeKey).filter((id) => id !== dragId);
    await moveTask({ id: dragId, userId, parentId: targetId, sortOrder: existingIds.length });
    await resequencePlannerTasks(updateTask, userId, [...existingIds, dragId]);
    if (oldParent !== targetId) {
      await resequencePlannerTasks(
        updateTask,
        userId,
        siblingIdsForParent(oldParent, D.scopeKey).filter((id) => id !== dragId)
      );
    }
    return;
  }

  const newParent = T.parentId ?? null;
  const oldParent = D.parentId ?? null;
  const ordered = siblingIdsForParent(newParent, D.scopeKey).filter((id) => id !== dragId);
  const targetIndex = ordered.indexOf(targetId);
  if (targetIndex < 0) return;
  ordered.splice(zone === "before" ? targetIndex : targetIndex + 1, 0, dragId);
  await moveTask({
    id: dragId,
    userId,
    parentId: newParent,
    sortOrder: ordered.indexOf(dragId),
  });
  await resequencePlannerTasks(updateTask, userId, ordered);
  if (oldParent !== newParent) {
    await resequencePlannerTasks(
      updateTask,
      userId,
      siblingIdsForParent(oldParent, D.scopeKey).filter((id) => id !== dragId)
    );
  }
}

async function promotePlannerTreeTaskToRoot({
  dragged,
  tasks,
  userId,
  moveTask,
  updateTask,
}: {
  dragged: PlannerTaskDragMeta;
  tasks: WorkflowDropTask[];
  userId: string;
  moveTask: (args: {
    id: Id<"workflowItems">;
    userId: string;
    parentId?: Id<"workflowItems"> | null;
    sortOrder?: number;
  }) => Promise<unknown>;
  updateTask: (args: {
    id: Id<"workflowItems">;
    userId: string;
    sortOrder: number;
  }) => Promise<unknown>;
}) {
  const dragId = dragged.taskId as Id<"workflowItems">;
  const draggedTask = tasks.find((task) => task._id === dragId);
  if (!draggedTask || draggedTask.parentId == null) return;
  const oldParent = draggedTask.parentId;
  const rootIds = tasks
    .filter(
      (task) =>
        task._id !== dragId &&
        task.scopeKey === dragged.scopeKey &&
        (task.parentId ?? null) === null
    )
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((task) => task._id);
  await moveTask({ id: dragId, userId, parentId: null, sortOrder: rootIds.length });
  await resequencePlannerTasks(updateTask, userId, [...rootIds, dragId]);
  await resequencePlannerTasks(
    updateTask,
    userId,
    tasks
      .filter((task) => (task.parentId ?? null) === oldParent && task._id !== dragId)
      .filter((task) => task.scopeKey === dragged.scopeKey)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((task) => task._id)
  );
}

export default function Planner() {
  const t = useTranslations("Planner");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [view, setView] = useState<TodoView>("daily");
  const [buildFilter, setBuildFilter] = useState<string | null>(null);
  const { userId } = useCurrentUser();
  const today = useMemo(() => plannerLocalDate(), []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "events") setView("events");
    else if (tab === "calendar") setView("calendar");
  }, [searchParams]);

  const plannerTasks = useOfflineQuery(api.workflow.listPlanner, userId ? { userId } : "skip");
  const conventions = useOfflineQuery(api.conventions.list, userId ? { userId } : "skip");
  const buildsList = useOfflineQuery(api.builds.list, userId ? { userId } : "skip");

  const allTasks = useMemo<PlannerTask[]>(() => plannerTasks ?? [], [plannerTasks]);

  /** "All" + one tab per build that still has open tasks (selected build stays put). */
  const buildTabs = useMemo(
    () => listPlannerBuildFilters(allTasks, buildFilter),
    [allTasks, buildFilter]
  );
  const activeBuildId =
    buildFilter != null && buildTabs.some((tab) => tab.buildId === buildFilter)
      ? buildFilter
      : null;

  const visibleTasks = useMemo(
    () => filterPlannerTasksByBuild(allTasks, activeBuildId),
    [allTasks, activeBuildId]
  );

  const groups = useMemo(() => {
    const grouped = groupPlannerTasks(allTasks, { today, buildId: activeBuildId });
    return {
      today: { count: grouped.today.length, tree: buildTaskHierarchy(grouped.today) },
      week: { count: grouped.week.length, tree: buildTaskHierarchy(grouped.week) },
      later: { count: grouped.later.length, tree: buildTaskHierarchy(grouped.later) },
    };
  }, [allTasks, today, activeBuildId]);

  const calendarData = useMemo((): CalendarDayData[] => {
    const byDay = new Map<string, CalendarEvent[]>();
    const add = (day: Date, event: CalendarEvent) => {
      const key = format(day, "yyyy-MM-dd");
      const list = byDay.get(key) ?? [];
      list.push(event);
      byDay.set(key, list);
    };
    allTasks.forEach((task) => {
      if (!task.dueDate) return;
      add(parseLocalDate(task.dueDate.slice(0, 10)), {
        id: task._id,
        name: task.title,
        time: t("calendarDue"),
        datetime: task.dueDate + "T00:00:00",
        href: task.conventionId
          ? `/conventions/${task.conventionId}/packing`
          : `/build-detail/${task.buildId}`,
      });
    });
    (conventions ?? []).forEach((con) => {
      add(parseLocalDate(con.startDate), {
        id: con._id,
        name: con.name,
        time: t("calendarEvent"),
        datetime: con.startDate + "T00:00:00",
        href: `/conventions/${con._id}`,
      });
    });
    return Array.from(byDay.entries()).map(([dateStr, events]) => ({
      day: parseLocalDate(dateStr),
      events,
    }));
  }, [allTasks, conventions, t]);

  /** Build owning the most urgent (soonest-due, open) task — backs the page photo. */
  const urgentBuild = useMemo(() => {
    const task = allTasks
      .filter((candidate) => !isPlannerTaskClosed(candidate.status) && candidate.buildId)
      .sort(comparePlannerTasksByDue)[0];
    if (!task) return undefined;
    return (buildsList ?? []).find((b) => b._id === task.buildId);
  }, [allTasks, buildsList]);

  const checkedCount = useMemo(
    () => visibleTasks.filter((task) => task.status === "done").length,
    [visibleTasks]
  );
  const totalCount = visibleTasks.length;
  const progressPct = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  const updateTask = useOfflineMutation(api.workflow.update);
  const moveTask = useOfflineMutation(api.workflow.move);
  const dragStateRef = useRef<PlannerDragState>({
    draggingMeta: null,
    dragOverTaskId: null,
    dragOverZone: null,
    dragOverRootScopeKey: null,
    pointerX: null,
    pointerY: null,
  });
  const [dragState, setDragState] = useState<PlannerDragState>(dragStateRef.current);

  const setPlannerDragState = useCallback((patch: Partial<PlannerDragState>) => {
    dragStateRef.current = { ...dragStateRef.current, ...patch };
    setDragState(dragStateRef.current);
  }, []);

  const clearPlannerDragState = useCallback(() => {
    setPlannerDragState({
      draggingMeta: null,
      dragOverTaskId: null,
      dragOverZone: null,
      dragOverRootScopeKey: null,
      pointerX: null,
      pointerY: null,
    });
  }, [setPlannerDragState]);

  const flatDropTasks = useMemo(
    () =>
      (plannerTasks ?? []).map((task) => ({
        _id: task._id,
        parentId: task.parentId ?? null,
        sortOrder: task.sortOrder ?? 0,
        scopeKey: plannerTaskScopeKey(task),
      })),
    [plannerTasks]
  );

  const resolvePlannerDropTarget = useCallback(
    (clientX: number, clientY: number, dragMeta: PlannerTaskDragMeta) => {
      const rootZone = document.querySelector(
        `[data-planner-root-drop-zone="${dragMeta.scopeKey}"]`
      ) as HTMLElement | null;
      if (rootZone && pointInsideRect(clientX, clientY, rootZone.getBoundingClientRect())) {
        return {
          rootScopeKey: dragMeta.scopeKey,
          taskId: null,
          zone: null,
          targetMeta: null,
        };
      }

      const rows = Array.from(document.querySelectorAll("[data-planner-task-drop-id]")).filter(
        // Rows inside a collapsed group ("Later") are inert and visually hidden — never targets.
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node.closest("[inert]") == null
      );
      let row: HTMLElement | null = null;
      let fallbackRow: HTMLElement | null = null;
      let fallbackDistance = Number.POSITIVE_INFINITY;

      for (const candidate of rows) {
        const rect = candidate.getBoundingClientRect();
        if (pointInsideRect(clientX, clientY, rect)) {
          row = candidate;
          break;
        }
        const withinHorizontalReach = clientX >= rect.left - 40 && clientX <= rect.right + 40;
        if (!withinHorizontalReach) continue;
        const verticalDistance =
          clientY < rect.top
            ? rect.top - clientY
            : clientY > rect.bottom
              ? clientY - rect.bottom
              : 0;
        if (verticalDistance < fallbackDistance) {
          fallbackDistance = verticalDistance;
          fallbackRow = candidate;
        }
      }

      if (!row && fallbackDistance <= 20) row = fallbackRow;
      if (!row) return { rootScopeKey: null, taskId: null, zone: null, targetMeta: null };

      const metaJson = row.dataset.plannerTaskDropMeta;
      if (!metaJson) return { rootScopeKey: null, taskId: null, zone: null, targetMeta: null };
      const targetMeta = JSON.parse(metaJson) as PlannerTaskDragMeta;
      const zone = computePlannerTaskDropZone(
        clientY,
        row.getBoundingClientRect(),
        dragMeta,
        targetMeta
      );
      return {
        rootScopeKey: null,
        taskId: zone ? targetMeta.taskId : null,
        zone,
        targetMeta: zone ? targetMeta : null,
      };
    },
    []
  );

  const dragController = useMemo<PlannerDragController>(
    () => ({
      state: dragState,
      startDrag: (meta, event) => {
        if (!userId) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setPlannerDragState({
          draggingMeta: meta,
          dragOverTaskId: null,
          dragOverZone: null,
          dragOverRootScopeKey: null,
          pointerX: event.clientX,
          pointerY: event.clientY,
        });
      },
    }),
    [dragState, setPlannerDragState, userId]
  );

  useEffect(() => {
    const activeMeta = dragState.draggingMeta;
    if (!activeMeta || !userId) return;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      const target = resolvePlannerDropTarget(event.clientX, event.clientY, activeMeta);
      setPlannerDragState({
        pointerX: event.clientX,
        pointerY: event.clientY,
        dragOverTaskId: target.taskId,
        dragOverZone: target.zone,
        dragOverRootScopeKey: target.rootScopeKey,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const currentMeta = dragStateRef.current.draggingMeta;
      if (!currentMeta) {
        clearPlannerDragState();
        return;
      }
      const target = resolvePlannerDropTarget(event.clientX, event.clientY, currentMeta);
      clearPlannerDragState();
      if (target.rootScopeKey) {
        void promotePlannerTreeTaskToRoot({
          dragged: currentMeta,
          tasks: flatDropTasks,
          userId,
          moveTask,
          updateTask,
        });
        return;
      }
      if (target.targetMeta && target.zone) {
        void applyPlannerTreeDrop({
          dragged: currentMeta,
          target: target.targetMeta,
          zone: target.zone,
          tasks: flatDropTasks,
          userId,
          moveTask,
          updateTask,
        });
      }
    };

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, { passive: true, once: true });
    window.addEventListener("pointercancel", clearPlannerDragState, { passive: true, once: true });
    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", clearPlannerDragState);
    };
  }, [
    clearPlannerDragState,
    dragState.draggingMeta,
    flatDropTasks,
    moveTask,
    resolvePlannerDropTarget,
    setPlannerDragState,
    updateTask,
    userId,
  ]);

  const handleToggle = useCallback(
    async (taskId: Id<"workflowItems">, checked: boolean) => {
      if (!userId) return;
      // Rejections propagate so the row can roll back its optimistic check.
      await updateTask({ id: taskId, userId, status: checked ? "done" : "not_started" });
    },
    [updateTask, userId]
  );

  const describeDue = useCallback(
    (task: PlannerTask) => {
      if (!task.dueDate) return { urgent: false };
      const due = task.dueDate.slice(0, 10);
      const group = plannerTimeGroupFor(task, today);
      const urgent = group === "today" && !isPlannerTaskClosed(task.status);
      if (due === today) return { label: t("dueToday"), urgent };
      if (due === addDaysToPlannerDate(today, 1)) return { label: t("dueTomorrow"), urgent };
      const date = parseLocalDate(due);
      const label =
        group === "week"
          ? date.toLocaleDateString(locale, { weekday: "short" })
          : date.toLocaleDateString(locale, { month: "short", day: "numeric" });
      return {
        label: isPlannerTaskOverdue(task, today) ? t("dueOverdue", { date: label }) : label,
        urgent,
      };
    },
    [locale, t, today]
  );

  const rowContext = useMemo<PlannerRowContext>(
    () => ({
      userId,
      onToggle: handleToggle,
      dragController,
      describeDue,
      labels: {
        dropInto: t("dropInto"),
        contextFallback: t("contextFallback"),
        blocked: t("statusBlocked"),
      },
    }),
    [describeDue, dragController, handleToggle, t, userId]
  );

  const isLoading = plannerTasks === undefined;
  const isLoadingConventions = conventions === undefined;

  const now = new Date();
  const dateLabel = now.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const weekdayLabel = now.toLocaleDateString(locale, { weekday: "long" });

  const draggingNested =
    dragState.draggingMeta != null && dragState.draggingMeta.parentId != null
      ? dragState.draggingMeta.scopeKey
      : null;

  const viewTabs = [
    ["daily", t("viewDaily")],
    ["events", t("viewEvents")],
    ["calendar", t("viewCalendar")],
  ] as const;

  return (
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <PhotoBackdrop
          imageStorageId={urgentBuild?.imageStorageId}
          imageUrl={urgentBuild?.imageUrl}
          scrimRight="strong"
        />

        <div className="relative z-10 flex-1 flex flex-col lg:flex-row gap-6 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-12 pb-6 min-h-0">
          {/* Headline block (3b) */}
          <section className="flex-1 min-w-0 max-w-[520px] lg:self-start lg:mt-8">
            <span className="block text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.28em] opacity-75 mb-3">
              {weekdayLabel} · {dateLabel}
            </span>
            <h1 className="font-serif italic font-normal text-[38px] lg:text-[76px] leading-[0.98] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)]">
              {t("headline")}
            </h1>
            {urgentBuild ? (
              <p className="mt-4 max-w-[380px] text-[15px] text-media-fg-70">
                {t.rich("urgentLead", {
                  name: urgentBuild.name,
                  build: (chunks) => (
                    <span className="font-serif italic text-kyar-media-fg">{chunks}</span>
                  ),
                })}
              </p>
            ) : null}
          </section>

          {/* Work panel (3b) */}
          <section
            className={`w-full shrink-0 flex flex-col bg-glass backdrop-blur-glass border border-glass-border rounded-glass min-h-0 lg:max-h-[calc(100dvh-140px)] ${
              view === "calendar" ? "lg:w-[760px]" : "lg:w-[560px]"
            }`}
          >
            <div className="border-b border-glass-divider-strong">
              <div className="flex items-center gap-x-5 px-5 pt-1">
                {viewTabs.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setView(value)}
                    className={`group inline-flex min-h-[44px] items-center ${tabFocusClassName}`}
                    aria-pressed={view === value}
                    aria-label={t("viewAria", { label })}
                  >
                    <span
                      className={`text-[10px] uppercase tracking-[0.18em] pb-0.5 border-b-[1.5px] transition-colors duration-150 ease-out ${
                        view === value
                          ? "font-bold text-kyar-media-fg border-kyar-media-fg"
                          : "font-semibold text-media-fg-55 border-transparent group-hover:text-kyar-media-fg"
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                ))}
                <div className="flex-1" />
                <Link
                  href="/builds"
                  className={`group inline-flex min-h-[44px] items-center ${tabFocusClassName}`}
                >
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-70 border-b border-glass-border-strong pb-0.5 transition-colors duration-150 ease-out group-hover:text-kyar-media-fg">
                    {t("addTask")}
                  </span>
                </Link>
              </div>

              {view === "daily" && buildTabs.length > 0 ? (
                <div
                  role="group"
                  aria-label={t("buildFilterAria")}
                  className="flex gap-x-5 overflow-x-auto whitespace-nowrap border-t border-glass-divider px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {[
                    { buildId: null as string | null, buildName: t("buildFilterAll") },
                    ...buildTabs,
                  ].map((tab) => {
                    const selected = activeBuildId === tab.buildId;
                    return (
                      <button
                        key={tab.buildId ?? "all"}
                        type="button"
                        onClick={() => setBuildFilter(tab.buildId)}
                        aria-pressed={selected}
                        className={`group inline-flex min-h-[44px] shrink-0 items-center ${tabFocusClassName}`}
                      >
                        <span
                          className={`text-[9px] uppercase tracking-[0.16em] pb-0.5 border-b-[1.5px] transition-colors duration-150 ease-out ${
                            selected
                              ? "font-bold text-kyar-media-fg border-kyar-media-fg"
                              : "font-semibold text-media-fg-55 border-transparent group-hover:text-kyar-media-fg"
                          }`}
                        >
                          {tab.buildName || t("untitledBuild")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {view === "daily" && totalCount > 0 && (
                <div className="flex items-center gap-3 px-5 pb-3 pt-1">
                  <div
                    className="h-[2px] flex-1 max-w-[220px] bg-glass-border rounded-full overflow-hidden"
                    role="progressbar"
                    aria-label={t("progressAria")}
                    aria-valuenow={checkedCount}
                    aria-valuemin={0}
                    aria-valuemax={totalCount}
                  >
                    <div
                      className="h-full bg-kyar-media-fg rounded-full transition-[width] duration-300 ease-out"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-55 tabular-nums">
                    {t("progressCount", { checked: checkedCount, total: totalCount })}
                  </span>
                </div>
              )}
            </div>

            <main className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
              {view === "calendar" ? (
                <div className="flex flex-1 flex-col">
                  {isLoading ? (
                    <p className="text-sm text-media-fg-55 px-2 py-3">{t("loadingCalendar")}</p>
                  ) : (
                    <FullScreenCalendar
                      data={calendarData}
                      addHref="/builds"
                      addLabel={t("addTask")}
                    />
                  )}
                </div>
              ) : view === "daily" ? (
                <>
                  {isLoading ? (
                    <p className="text-sm text-media-fg-55 px-2 py-3">{t("loadingTasks")}</p>
                  ) : allTasks.length === 0 ? (
                    <div className="px-2 py-4">
                      <p className="text-sm text-media-fg-70 mb-2">{t("emptyTasks")}</p>
                      <Link
                        href="/builds"
                        className="text-sm text-kyar-media-fg border-b border-glass-border-strong pb-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                      >
                        {t("emptyTasksCta")}
                      </Link>
                    </div>
                  ) : (
                    <>
                      {draggingNested ? (
                        <div
                          data-planner-root-drop-zone={draggingNested}
                          className={`mx-2 mb-2 rounded-xl border px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.16em] ${
                            dragState.dragOverRootScopeKey === draggingNested
                              ? "border-glass-border-strong bg-glass-active text-kyar-media-fg"
                              : "border-glass-border bg-glass-bar text-media-fg-55"
                          }`}
                        >
                          {t("dropToRoot")}
                        </div>
                      ) : null}

                      <PlannerTaskGroup title={t("groupToday")} count={groups.today.count}>
                        {groups.today.count > 0 ? (
                          <PlannerTaskNodeList tasks={groups.today.tree} context={rowContext} />
                        ) : (
                          <p className="px-2 pb-2 text-[13px] text-media-fg-55">
                            {t("emptyToday")}
                          </p>
                        )}
                      </PlannerTaskGroup>

                      {groups.week.count > 0 ? (
                        <PlannerTaskGroup title={t("groupWeek")} count={groups.week.count}>
                          <PlannerTaskNodeList tasks={groups.week.tree} context={rowContext} />
                        </PlannerTaskGroup>
                      ) : null}

                      {groups.later.count > 0 ? (
                        <PlannerTaskGroup
                          title={t("groupLater")}
                          count={groups.later.count}
                          collapsible
                          defaultOpen={false}
                          showLabel={t("groupShow")}
                          hideLabel={t("groupHide")}
                        >
                          <PlannerTaskNodeList tasks={groups.later.tree} context={rowContext} />
                        </PlannerTaskGroup>
                      ) : null}
                    </>
                  )}
                </>
              ) : view === "events" ? (
                <div>
                  {isLoadingConventions ? (
                    <p className="text-sm text-media-fg-55 px-2 py-3">{t("loadingEvents")}</p>
                  ) : !conventions || conventions.length === 0 ? (
                    <div className="px-2 py-4">
                      <p className="text-sm text-media-fg-70 mb-2">{t("emptyEvents")}</p>
                      <Link
                        href="/conventions"
                        className="text-sm text-kyar-media-fg border-b border-glass-border-strong pb-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                      >
                        {t("emptyEventsCta")}
                      </Link>
                    </div>
                  ) : (
                    conventions.map((con) => (
                      <div
                        key={con._id}
                        className="flex flex-wrap items-center justify-between gap-3 px-2 py-3.5 border-b border-glass-divider"
                      >
                        <div className="min-w-0">
                          <p className="font-serif italic text-[17px] truncate">{con.name}</p>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] opacity-55 mt-0.5">
                            {parseLocalDate(con.startDate).toLocaleDateString(locale, {
                              month: "short",
                              year: "numeric",
                            })}{" "}
                            –{" "}
                            {parseLocalDate(con.endDate).toLocaleDateString(locale, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="flex gap-4 flex-wrap">
                          <Link
                            href={`/conventions/${con._id}`}
                            className={`group inline-flex min-h-[44px] items-center ${tabFocusClassName}`}
                          >
                            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-70 border-b border-glass-border-strong pb-0.5 transition-colors group-hover:text-kyar-media-fg">
                              {t("eventPlan")}
                            </span>
                          </Link>
                          <Link
                            href={`/conventions/${con._id}/packing`}
                            className={`group inline-flex min-h-[44px] items-center ${tabFocusClassName}`}
                          >
                            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-70 border-b border-glass-border-strong pb-0.5 transition-colors group-hover:text-kyar-media-fg">
                              {t("eventPacking")}
                            </span>
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </main>
          </section>
        </div>

        {dragState.draggingMeta && dragState.pointerX != null && dragState.pointerY != null ? (
          <div
            className="pointer-events-none fixed z-[10000] max-w-[260px] rotate-[1.5deg] rounded-full bg-glass-preview backdrop-blur-[20px] border border-glass-border-strong px-4 py-3 text-[13px] text-kyar-media-fg shadow-[0_24px_48px_-16px_rgb(12_11_20/0.6)]"
            style={{
              left: Math.max(12, Math.min(dragState.pointerX + 14, window.innerWidth - 280)),
              top: Math.max(12, Math.min(dragState.pointerY + 14, window.innerHeight - 80)),
            }}
          >
            <span className="block truncate">
              {dragState.draggingMeta.title ?? t("dragPreviewFallback")}
            </span>
          </div>
        ) : null}
      </div>
    </WebAppShell>
  );
}

function taskContextHref(task: PlannerTask) {
  if (task.conventionId) return `/conventions/${task.conventionId}/packing`;
  if (task.buildId) return `/build-detail/${task.buildId}`;
  if (task.cosplayNodeId) return `/elements/${task.cosplayNodeId}`;
  return "/planner";
}

function PlannerTaskNodeList({
  tasks,
  context,
  parent,
}: {
  tasks: PlannerTaskNode[];
  context: PlannerRowContext;
  parent?: PlannerTaskNode;
}) {
  if (!tasks.length) return null;

  return (
    <ul className="divide-y divide-glass-divider">
      {tasks.map((task, index) => (
        <PlannerTaskNodeItem
          key={task._id}
          task={task}
          index={index}
          parent={parent}
          context={context}
        />
      ))}
    </ul>
  );
}

function PlannerTaskNodeItem({
  task,
  index,
  parent,
  context,
}: {
  task: PlannerTaskNode;
  index: number;
  parent?: PlannerTaskNode;
  context: PlannerRowContext;
}) {
  const { userId, onToggle, dragController, describeDue, labels } = context;
  const [childrenOpen, setChildrenOpen] = useState(true);
  const dragMeta = useMemo<PlannerTaskDragMeta>(
    () => ({
      taskId: task._id as string,
      scopeKey: plannerTaskScopeKey(task),
      parentId: parent?._id as string | undefined,
      siblingIndex: index,
      ancestorIds: (task.ancestorIds ?? []).map((id) => id as string),
      title: task.title,
    }),
    [index, parent?._id, task]
  );

  const active = dragController.state.draggingMeta?.taskId === task._id;
  const dropBefore =
    dragController.state.dragOverTaskId === task._id &&
    dragController.state.dragOverZone === "before";
  const dropAfter =
    dragController.state.dragOverTaskId === task._id &&
    dragController.state.dragOverZone === "after";
  const dropInto =
    dragController.state.dragOverTaskId === task._id &&
    dragController.state.dragOverZone === "into";
  const due = describeDue(task);

  return (
    <li>
      <div
        data-planner-task-drop-id={task._id}
        data-planner-task-drop-meta={JSON.stringify(dragMeta)}
        className={`relative ${active ? "opacity-55" : ""}`}
      >
        {dropBefore ? (
          <div className="absolute inset-x-3 top-0 z-10 h-[2.5px] rounded-[2px] bg-[var(--drop-line)] shadow-[0_0_12px_rgb(255_253_248/0.8)]">
            <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-[var(--drop-line)]" />
          </div>
        ) : null}
        {dropAfter ? (
          <div className="absolute inset-x-3 bottom-0 z-10 h-[2.5px] rounded-[2px] bg-[var(--drop-line)] shadow-[0_0_12px_rgb(255_253_248/0.8)]">
            <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-[var(--drop-line)]" />
          </div>
        ) : null}
        <PlannerTaskRow
          title={task.title}
          done={task.status === "done"}
          userId={userId}
          onToggle={(next) => onToggle(task._id, next)}
          contextHref={taskContextHref(task)}
          contextLabel={task.buildName ?? task.conventionName ?? labels.contextFallback}
          status={task.status}
          progressPercent={task.progressPercent}
          dueDate={task.dueDate}
          dueLabel={due.label}
          dueUrgent={due.urgent}
          statusChipLabel={task.status === "blocked" ? labels.blocked : undefined}
          blockedByCount={task.blockedByCount}
          priority={task.priority}
          blockedByTitles={task.blockedByTitles}
          dragHandleProps={{
            hasChildren: task.children.length > 0,
            childrenOpen,
            onToggleChildren: () => setChildrenOpen((value) => !value),
            onPointerDown: (event) => dragController.startDrag(dragMeta, event),
          }}
          dropIntoLabel={dropInto ? labels.dropInto : undefined}
        />
      </div>
      {childrenOpen && task.children.length > 0 ? (
        <div className="mb-1 ml-[15px] border-l border-glass-divider-strong pl-3 sm:pl-4">
          <PlannerTaskNodeList tasks={task.children} parent={task} context={context} />
        </div>
      ) : null}
    </li>
  );
}
