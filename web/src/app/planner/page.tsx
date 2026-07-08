"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useOfflineQuery, useOfflineMutation } from "@/lib/offline";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { FullScreenCalendar } from "@/components/ui/fullscreen-calendar";
import type { CalendarDayData, CalendarEvent } from "@/components/ui/fullscreen-calendar";
import { PlannerTaskRow } from "@/components/planner/PlannerWorkflowTaskUi";
import {
  computePlannerTaskDropZone,
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
type BuildGroup = { buildId: Id<"builds">; buildName: string; tasks: PlannerTaskNode[] };
type RawBuildGroup = { buildId: Id<"builds">; buildName: string; tasks: PlannerTask[] };
type ConventionGroup = {
  conventionId: Id<"conventions">;
  conventionName: string;
  builds: BuildGroup[];
  packingTasks: PlannerTaskNode[];
};

function comparePlannerTasks(a: PlannerTask, b: PlannerTask) {
  if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  const dateA = a.dueDate ?? "9999-12-31";
  const dateB = b.dueDate ?? "9999-12-31";
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return a.title.localeCompare(b.title);
}

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

  const sortTree = (nodes: PlannerTaskNode[]) => {
    nodes.sort(comparePlannerTasks);
    for (const node of nodes) sortTree(node.children);
  };
  sortTree(roots);
  return roots;
}

function buildTaskTree(
  tasks: PlannerTask[],
  conventionsList: Array<{ _id: Id<"conventions">; name: string }> | undefined
): {
  conventionGroups: ConventionGroup[];
  standaloneBuilds: BuildGroup[];
  /** Tasks with no build or convention attachment (e.g. cosplay-node-only workflow items). */
  unassignedTasks: PlannerTaskNode[];
} {
  const conventionMap = new Map<
    Id<"conventions">,
    {
      conventionName: string;
      builds: Map<Id<"builds">, RawBuildGroup>;
      packingTasks: PlannerTask[];
    }
  >();
  const standaloneMap = new Map<Id<"builds">, RawBuildGroup>();
  const unassignedTasks: PlannerTask[] = [];

  const getConventionName = (conventionId: Id<"conventions">) =>
    conventionsList?.find((c) => c._id === conventionId)?.name ?? "Event";

  for (const task of tasks) {
    if (task.conventionId) {
      let group = conventionMap.get(task.conventionId);
      if (!group) {
        group = {
          conventionName: getConventionName(task.conventionId),
          builds: new Map(),
          packingTasks: [],
        };
        conventionMap.set(task.conventionId, group);
      }
      const isPackingTask =
        task.category === "pack" || Boolean(task.packingListItemId) || !task.buildId;
      if (isPackingTask) {
        group.packingTasks.push(task);
      } else {
        let buildGroup = group.builds.get(task.buildId!);
        if (!buildGroup) {
          buildGroup = { buildId: task.buildId!, buildName: task.buildName ?? "Build", tasks: [] };
          group.builds.set(task.buildId!, buildGroup);
        }
        buildGroup.tasks.push(task);
      }
    } else if (task.buildId) {
      let buildGroup = standaloneMap.get(task.buildId);
      if (!buildGroup) {
        buildGroup = { buildId: task.buildId, buildName: task.buildName ?? "Build", tasks: [] };
        standaloneMap.set(task.buildId, buildGroup);
      }
      buildGroup.tasks.push(task);
    } else {
      unassignedTasks.push(task);
    }
  }

  const conventionGroups: ConventionGroup[] = Array.from(conventionMap.entries()).map(
    ([conventionId, g]) => ({
      conventionId,
      conventionName: g.conventionName,
      builds: Array.from(g.builds.values())
        .sort((a, b) => a.buildName.localeCompare(b.buildName))
        .map((build) => ({ ...build, tasks: buildTaskHierarchy(build.tasks) })),
      packingTasks: buildTaskHierarchy(g.packingTasks),
    })
  );
  conventionGroups.sort((a, b) => a.conventionName.localeCompare(b.conventionName));

  const standaloneBuilds = Array.from(standaloneMap.values())
    .sort((a, b) => a.buildName.localeCompare(b.buildName))
    .map((build) => ({ ...build, tasks: buildTaskHierarchy(build.tasks) }));

  return {
    conventionGroups,
    standaloneBuilds,
    unassignedTasks: buildTaskHierarchy(unassignedTasks),
  };
}

type Timeframe = "all" | "today" | "week";

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

const TODAY = new Date().toISOString().slice(0, 10);

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isDueApproaching(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  if (dueDate < TODAY) return false;
  const weekEnd = addDays(TODAY, 7);
  return dueDate <= weekEnd;
}

function isDueToday(dueDate: string | undefined): boolean {
  return dueDate === TODAY;
}

function filterByTimeframe<T extends { dueDate?: string }>(tasks: T[], timeframe: Timeframe): T[] {
  if (timeframe === "all") return tasks;
  if (timeframe === "today") return tasks.filter((t) => isDueToday(t.dueDate));
  const weekEnd = addDays(TODAY, 7);
  return tasks.filter((t) => t.dueDate && t.dueDate >= TODAY && t.dueDate <= weekEnd) as T[];
}

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
  const searchParams = useSearchParams();
  const [view, setView] = useState<TodoView>("daily");
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const { userId } = useCurrentUser();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "events") setView("events");
    else if (tab === "calendar") setView("calendar");
  }, [searchParams]);

  const plannerTasks = useOfflineQuery(api.workflow.listPlanner, userId ? { userId } : "skip");
  const conventions = useOfflineQuery(api.conventions.list, userId ? { userId } : "skip");
  const buildsList = useOfflineQuery(api.builds.list, userId ? { userId } : "skip");

  const filteredTasks = useMemo(() => {
    const list = plannerTasks ?? [];
    return filterByTimeframe(list, timeframe);
  }, [plannerTasks, timeframe]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      // 1. Incomplete first (what's left to do at the top)
      const aDone = a.status === "done";
      const bDone = b.status === "done";
      if (aDone !== bDone) return aDone ? 1 : -1;
      // 2. Due date ascending (soonest first; no date last)
      const dateA = a.dueDate ?? "9999-12-31";
      const dateB = b.dueDate ?? "9999-12-31";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      // 3. By build name for stable grouping
      const nameCmp = (a.buildName ?? "").localeCompare(b.buildName ?? "");
      if (nameCmp !== 0) return nameCmp;
      // 4. Higher priority first, then title.
      if ((a.priority ?? 0) !== (b.priority ?? 0)) {
        return (b.priority ?? 0) - (a.priority ?? 0);
      }
      return a.title.localeCompare(b.title);
    });
  }, [filteredTasks]);

  const { deadlineApproaching, other } = useMemo(() => {
    const approaching: typeof sortedTasks = [];
    const rest: typeof sortedTasks = [];
    for (const t of sortedTasks) {
      if (isDueApproaching(t.dueDate)) approaching.push(t);
      else rest.push(t);
    }
    return { deadlineApproaching: approaching, other: rest };
  }, [sortedTasks]);

  const treeApproaching = useMemo(
    () => buildTaskTree(deadlineApproaching, conventions ?? undefined),
    [deadlineApproaching, conventions]
  );
  const treeOther = useMemo(
    () => buildTaskTree(other, conventions ?? undefined),
    [other, conventions]
  );
  const treeAll = useMemo(
    () => buildTaskTree(sortedTasks, conventions ?? undefined),
    [sortedTasks, conventions]
  );

  const calendarData = useMemo((): CalendarDayData[] => {
    const byDay = new Map<string, CalendarEvent[]>();
    const add = (day: Date, event: CalendarEvent) => {
      const key = day.toISOString().slice(0, 10);
      const list = byDay.get(key) ?? [];
      list.push(event);
      byDay.set(key, list);
    };
    (plannerTasks ?? []).forEach((task) => {
      if (!task.dueDate) return;
      const day = new Date(task.dueDate + "T12:00:00");
      add(day, {
        id: task._id,
        name: task.title,
        time: "Due",
        datetime: task.dueDate + "T00:00:00",
        href: task.conventionId
          ? `/conventions/${task.conventionId}/packing`
          : `/build-detail/${task.buildId}`,
      });
    });
    (conventions ?? []).forEach((con) => {
      const start = new Date(con.startDate + "T12:00:00");
      add(start, {
        id: con._id,
        name: con.name,
        time: "Event",
        datetime: con.startDate + "T00:00:00",
        href: `/conventions/${con._id}`,
      });
    });
    return Array.from(byDay.entries()).map(([dateStr, events]) => ({
      day: new Date(dateStr + "T12:00:00"),
      events,
    }));
  }, [plannerTasks, conventions]);

  /** Build owning the most urgent (soonest-due, incomplete) task — backs the page photo. */
  const urgentBuild = useMemo(() => {
    const task = sortedTasks.find((t) => t.status !== "done" && t.buildId);
    if (!task) return undefined;
    return (buildsList ?? []).find((b) => b._id === task.buildId);
  }, [sortedTasks, buildsList]);

  const checkedCount = useMemo(
    () => filteredTasks.filter((t) => t.status === "done").length,
    [filteredTasks]
  );
  const totalCount = filteredTasks.length;
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
        (node): node is HTMLElement => node instanceof HTMLElement
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

  const handleToggle = async (taskId: Id<"workflowItems">, checked: boolean) => {
    if (!userId) return;
    try {
      await updateTask({ id: taskId, userId, status: checked ? "done" : "not_started" });
    } catch {
      // Error surfaces via Convex; could add inline error state
    }
  };

  const isLoading = plannerTasks === undefined;
  const isLoadingConventions = conventions === undefined;

  const dateLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const weekdayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
  });

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
              What&rsquo;s due
            </h1>
            {urgentBuild ? (
              <p className="mt-4 max-w-[380px] text-[15px] text-media-fg-70">
                Most urgent right now:{" "}
                <span className="font-serif italic text-kyar-media-fg">{urgentBuild.name}</span>.
              </p>
            ) : null}
          </section>

          {/* Work panel (3b) */}
          <section
            className={`w-full shrink-0 flex flex-col bg-glass backdrop-blur-glass border border-glass-border rounded-glass min-h-0 lg:max-h-[calc(100dvh-140px)] ${
              view === "calendar" ? "lg:w-[760px]" : "lg:w-[560px]"
            }`}
          >
            <div className="px-5 py-4 border-b border-glass-divider-strong">
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                {(
                  [
                    ["daily", "Daily"],
                    ["events", "Events"],
                    ["calendar", "Calendar"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setView(value)}
                    className={`text-[10px] uppercase tracking-[0.18em] pb-0.5 border-b-[1.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                      view === value
                        ? "font-bold text-kyar-media-fg border-kyar-media-fg"
                        : "font-semibold text-media-fg-55 border-transparent hover:text-kyar-media-fg"
                    }`}
                    aria-pressed={view === value}
                    aria-label={`${label} view`}
                  >
                    {label}
                  </button>
                ))}
                <div className="flex-1" />
                {view === "daily" &&
                  (["all", "today", "week"] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={`text-[9px] uppercase tracking-[0.16em] pb-0.5 border-b transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                        timeframe === tf
                          ? "font-bold text-kyar-media-fg border-kyar-media-fg"
                          : "font-semibold text-media-fg-55 border-transparent hover:text-kyar-media-fg"
                      }`}
                      aria-pressed={timeframe === tf}
                    >
                      {tf === "all" ? "All" : tf === "today" ? "Today" : "This week"}
                    </button>
                  ))}
                <Link
                  href="/builds"
                  className="text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-70 border-b border-glass-border-strong pb-0.5 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  Add task
                </Link>
              </div>
              {view === "daily" && totalCount > 0 && (
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="h-[2px] flex-1 max-w-[220px] bg-glass-border rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={checkedCount}
                    aria-valuemin={0}
                    aria-valuemax={totalCount}
                  >
                    <div
                      className="h-full bg-kyar-media-fg rounded-full transition-[width] duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.16em] opacity-55 tabular-nums">
                    {checkedCount} / {totalCount} tasks
                  </span>
                </div>
              )}
            </div>

            <main className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
              {view === "calendar" ? (
                <div className="flex flex-1 flex-col">
                  {isLoading ? (
                    <p className="text-sm text-media-fg-55 px-2 py-3">Loading calendar...</p>
                  ) : (
                    <FullScreenCalendar data={calendarData} addHref="/builds" addLabel="Add task" />
                  )}
                </div>
              ) : view === "daily" ? (
                <>
                  {isLoading ? (
                    <p className="text-sm text-media-fg-55 px-2 py-3">Loading tasks...</p>
                  ) : totalCount === 0 ? (
                    <div className="px-2 py-4">
                      <p className="text-sm text-media-fg-70 mb-2">No tasks yet.</p>
                      <Link
                        href="/builds"
                        className="text-sm text-kyar-media-fg border-b border-glass-border-strong pb-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                      >
                        Open a build to add tasks
                      </Link>
                    </div>
                  ) : (
                    <>
                      {deadlineApproaching.length > 0 && (
                        <section className="mb-5">
                          <h3 className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                            Deadline approaching
                          </h3>
                          <PlannerTaskTree
                            tree={treeApproaching}
                            userId={userId}
                            onToggle={handleToggle}
                            dragController={dragController}
                          />
                        </section>
                      )}

                      <section>
                        <h3 className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                          {deadlineApproaching.length > 0 ? "Other tasks" : "Tasks"}
                        </h3>
                        <PlannerTaskTree
                          tree={deadlineApproaching.length > 0 ? treeOther : treeAll}
                          userId={userId}
                          onToggle={handleToggle}
                          dragController={dragController}
                        />
                      </section>
                    </>
                  )}
                </>
              ) : view === "events" ? (
                <div>
                  {isLoadingConventions ? (
                    <p className="text-sm text-media-fg-55 px-2 py-3">Loading events…</p>
                  ) : !conventions || conventions.length === 0 ? (
                    <div className="px-2 py-4">
                      <p className="text-sm text-media-fg-70 mb-2">No events yet.</p>
                      <Link
                        href="/conventions"
                        className="text-sm text-kyar-media-fg border-b border-glass-border-strong pb-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                      >
                        Create an event
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
                            {new Date(con.startDate).toLocaleDateString("en-US", {
                              month: "short",
                              year: "numeric",
                            })}{" "}
                            –{" "}
                            {new Date(con.endDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="flex gap-4 flex-wrap">
                          <Link
                            href={`/conventions/${con._id}`}
                            className="text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-70 border-b border-glass-border-strong pb-0.5 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                          >
                            Plan
                          </Link>
                          <Link
                            href={`/conventions/${con._id}/packing`}
                            className="text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-70 border-b border-glass-border-strong pb-0.5 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                          >
                            Packing list
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
            className="pointer-events-none fixed z-[10000] max-w-[260px] rotate-[1.5deg] rounded-full bg-glass-preview backdrop-blur-[20px] border border-glass-border-strong px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-kyar-media-fg shadow-[0_24px_48px_-16px_rgb(12_11_20/0.6)]"
            style={{
              left: Math.max(12, Math.min(dragState.pointerX + 14, window.innerWidth - 280)),
              top: Math.max(12, Math.min(dragState.pointerY + 14, window.innerHeight - 80)),
            }}
          >
            <span className="block truncate">{dragState.draggingMeta.title ?? "Task"}</span>
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
  userId,
  onToggle,
  dragController,
  parent,
}: {
  tasks: PlannerTaskNode[];
  userId: string | null;
  onToggle: (id: Id<"workflowItems">, checked: boolean) => void;
  dragController: PlannerDragController;
  parent?: PlannerTaskNode;
}) {
  if (!tasks.length) return null;
  const scopeKey = plannerTaskScopeKey(tasks[0]);

  return (
    <ul className="divide-y divide-glass-divider">
      {parent == null &&
      dragController.state.draggingMeta?.scopeKey === scopeKey &&
      dragController.state.draggingMeta.parentId != null ? (
        <li
          data-planner-root-drop-zone={scopeKey}
          className={`rounded-xl border px-3 py-3 text-center text-[10px] font-bold uppercase tracking-[0.16em] ${
            dragController.state.dragOverRootScopeKey === scopeKey
              ? "border-glass-border-strong bg-glass-active text-kyar-media-fg"
              : "border-glass-border bg-glass-bar text-media-fg-55"
          }`}
        >
          Drop here to make it top level
        </li>
      ) : null}
      {tasks.map((task, index) => (
        <PlannerTaskNodeItem
          key={task._id}
          task={task}
          index={index}
          parent={parent}
          userId={userId}
          onToggle={onToggle}
          dragController={dragController}
        />
      ))}
    </ul>
  );
}

function PlannerTaskNodeItem({
  task,
  index,
  parent,
  userId,
  onToggle,
  dragController,
}: {
  task: PlannerTaskNode;
  index: number;
  parent?: PlannerTaskNode;
  userId: string | null;
  onToggle: (id: Id<"workflowItems">, checked: boolean) => void;
  dragController: PlannerDragController;
}) {
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
          onToggle={() => onToggle(task._id, task.status !== "done")}
          contextHref={taskContextHref(task)}
          contextLabel={task.buildName ?? task.conventionName ?? "Workflow"}
          status={task.status}
          progressPercent={task.progressPercent}
          dueDate={task.dueDate}
          blockedByCount={task.blockedByCount}
          priority={task.priority}
          blockedByTitles={task.blockedByTitles}
          dragHandleProps={{
            hasChildren: task.children.length > 0,
            childrenOpen,
            onToggleChildren: () => setChildrenOpen((value) => !value),
            onPointerDown: (event) => dragController.startDrag(dragMeta, event),
          }}
          dropIntoLabel={dropInto ? "Drop to nest inside" : undefined}
        />
      </div>
      {childrenOpen && task.children.length > 0 ? (
        <div className="mb-1 ml-[15px] border-l border-glass-divider-strong pl-3 sm:pl-4">
          <PlannerTaskNodeList
            tasks={task.children}
            parent={task}
            userId={userId}
            onToggle={onToggle}
            dragController={dragController}
          />
        </div>
      ) : null}
    </li>
  );
}

function PlannerTaskTree({
  tree,
  userId,
  onToggle,
  dragController,
}: {
  tree: {
    conventionGroups: ConventionGroup[];
    standaloneBuilds: BuildGroup[];
    unassignedTasks: PlannerTaskNode[];
  };
  userId: string | null;
  onToggle: (id: Id<"workflowItems">, checked: boolean) => void;
  dragController: PlannerDragController;
}) {
  const { conventionGroups, standaloneBuilds, unassignedTasks } = tree;
  const hasConventions = conventionGroups.length > 0;
  const hasStandalone = standaloneBuilds.length > 0;
  const hasUnassigned = unassignedTasks.length > 0;
  if (!hasConventions && !hasStandalone && !hasUnassigned) return null;

  return (
    <div className="divide-y divide-glass-divider-strong">
      {conventionGroups.map((convention) => (
        <details key={convention.conventionId} className="group py-1">
          <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[44px] rounded-lg px-2 py-2.5 text-sm font-medium text-kyar-media-fg hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            <span className="select-none text-[10px] uppercase tracking-[0.14em] text-media-fg-55 group-open:rotate-90 transition-transform">
              ▶
            </span>
            <span className="flex-1">{convention.conventionName}</span>
            <Link
              href={`/conventions/${convention.conventionId}/packing`}
              className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded"
              onClick={(e) => e.stopPropagation()}
            >
              Open
            </Link>
          </summary>
          <div className="ml-3 border-l border-glass-divider-strong pl-2 pb-2 sm:pl-3">
            {convention.builds.map((build) => (
              <details key={build.buildId} className="group/build">
                <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[40px] rounded-lg px-2 py-2 text-sm text-kyar-media-fg hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                  <span className="select-none text-[10px] uppercase tracking-[0.14em] text-media-fg-55 group-open/build:rotate-90 transition-transform">
                    ▶
                  </span>
                  <span className="flex-1 font-light">{build.buildName}</span>
                </summary>
                <div className="ml-3 border-l border-glass-divider-strong pl-2 pb-2 sm:pl-3">
                  <PlannerTaskNodeList
                    tasks={build.tasks}
                    userId={userId}
                    onToggle={onToggle}
                    dragController={dragController}
                  />
                </div>
              </details>
            ))}
            {convention.packingTasks.length > 0 && (
              <details key={`packing-${convention.conventionId}`} className="group/pack">
                <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[40px] rounded-lg px-2 py-2 text-sm text-kyar-media-fg hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                  <span className="select-none text-[10px] uppercase tracking-[0.14em] text-media-fg-55 group-open/pack:rotate-90 transition-transform">
                    ▶
                  </span>
                  <span className="flex-1 font-light">Packing</span>
                </summary>
                <div className="ml-3 border-l border-glass-divider-strong pl-2 pb-2 sm:pl-3">
                  <PlannerTaskNodeList
                    tasks={convention.packingTasks}
                    userId={userId}
                    onToggle={onToggle}
                    dragController={dragController}
                  />
                </div>
              </details>
            )}
          </div>
        </details>
      ))}
      {standaloneBuilds.map((build) => (
        <details key={build.buildId} className="group py-1">
          <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[44px] rounded-lg px-2 py-2.5 text-sm font-medium text-kyar-media-fg hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            <span className="select-none text-[10px] uppercase tracking-[0.14em] text-media-fg-55 group-open:rotate-90 transition-transform">
              ▶
            </span>
            <span className="flex-1">{build.buildName}</span>
            <Link
              href={`/build-detail/${build.buildId}`}
              className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded"
              onClick={(e) => e.stopPropagation()}
            >
              Open
            </Link>
          </summary>
          <div className="ml-3 border-l border-glass-divider-strong pl-2 pb-2 sm:pl-3">
            <PlannerTaskNodeList
              tasks={build.tasks}
              userId={userId}
              onToggle={onToggle}
              dragController={dragController}
            />
          </div>
        </details>
      ))}
      {hasUnassigned && (
        <details className="group py-1">
          <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[44px] rounded-lg px-2 py-2.5 text-sm font-medium text-kyar-media-fg hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            <span className="select-none text-[10px] uppercase tracking-[0.14em] text-media-fg-55 group-open:rotate-90 transition-transform">
              ▶
            </span>
            <span className="flex-1">Elements and other tasks</span>
          </summary>
          <div className="ml-3 border-l border-glass-divider-strong pl-2 pb-2 sm:pl-3">
            <PlannerTaskNodeList
              tasks={unassignedTasks}
              userId={userId}
              onToggle={onToggle}
              dragController={dragController}
            />
          </div>
        </details>
      )}
    </div>
  );
}
