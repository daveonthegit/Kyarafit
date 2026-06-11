"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
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

  const plannerTasks = useQuery(api.workflow.listPlanner, userId ? { userId } : "skip");
  const conventions = useQuery(api.conventions.list, userId ? { userId } : "skip");

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

  const checkedCount = useMemo(
    () => filteredTasks.filter((t) => t.status === "done").length,
    [filteredTasks]
  );
  const totalCount = filteredTasks.length;
  const progressPct = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  const updateTask = useMutation(api.workflow.update);
  const moveTask = useMutation(api.workflow.move);
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
    <WebAppShell>
      <PageHeader
        title={view === "daily" ? dateLabel : view === "calendar" ? "Calendar" : "Circuit"}
        subtitle={view === "daily" ? weekdayLabel : undefined}
        sticky
      />
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4 mb-6">
        <button
          type="button"
          onClick={() => setView("daily")}
          className={`min-h-[44px] flex items-center justify-center text-[10px] uppercase tracking-[0.2em] font-bold px-6 py-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 ${
            view === "daily"
              ? "bg-kyar-text text-kyar-bg shadow-md"
              : "bg-kyar-surface border border-kyar-borderSubtle text-kyar-text hover:border-kyar-text hover:bg-kyar-muted"
          }`}
          aria-pressed={view === "daily"}
          aria-label="Daily view"
        >
          Daily
        </button>
        <button
          type="button"
          onClick={() => setView("events")}
          className={`min-h-[44px] flex items-center justify-center text-[10px] uppercase tracking-[0.2em] font-bold px-6 py-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 ${
            view === "events"
              ? "bg-kyar-text text-kyar-bg shadow-md"
              : "bg-kyar-surface border border-kyar-borderSubtle text-kyar-text hover:border-kyar-text hover:bg-kyar-muted"
          }`}
          aria-pressed={view === "events"}
          aria-label="Events view"
        >
          Events
        </button>
        <button
          type="button"
          onClick={() => setView("calendar")}
          className={`min-h-[44px] flex items-center justify-center text-[10px] uppercase tracking-[0.2em] font-bold px-6 py-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 ${
            view === "calendar"
              ? "bg-kyar-text text-kyar-bg shadow-md"
              : "bg-kyar-surface border border-kyar-borderSubtle text-kyar-text hover:border-kyar-text hover:bg-kyar-muted"
          }`}
          aria-pressed={view === "calendar"}
          aria-label="Calendar view"
        >
          Calendar
        </button>
      </div>

      <main className="flex-1 pb-24 lg:pb-8">
        {view === "calendar" ? (
          <div className="flex flex-1 flex-col">
            {isLoading ? (
              <p className="text-sm text-kyar-textTertiary">Loading calendar...</p>
            ) : (
              <FullScreenCalendar data={calendarData} addHref="/builds" addLabel="Add task" />
            )}
          </div>
        ) : view === "daily" ? (
          <>
            {isLoading ? (
              <p className="text-sm text-kyar-textTertiary">Loading tasks...</p>
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {(["all", "today", "week"] as const).map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setTimeframe(tf)}
                        className={`min-h-[44px] px-4 py-2 text-[10px] uppercase tracking-wider rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 ${
                          timeframe === tf
                            ? "border-kyar-text bg-kyar-text text-kyar-bg shadow-md"
                            : "border-kyar-borderSubtle bg-kyar-surface text-kyar-text hover:border-kyar-text hover:bg-kyar-muted"
                        }`}
                        aria-pressed={timeframe === tf}
                      >
                        {tf === "all" ? "All" : tf === "today" ? "Today" : "This week"}
                      </button>
                    ))}
                  </div>
                  <Link
                    href="/builds"
                    className="min-h-[44px] inline-flex items-center justify-center text-[10px] font-bold uppercase tracking-widest border border-kyar-text px-6 py-2.5 rounded-full hover:bg-kyar-text hover:text-kyar-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                  >
                    Add task
                  </Link>
                </div>

                {totalCount === 0 ? (
                  <SectionCard title="Tasks">
                    <p className="text-sm text-kyar-textTertiary mb-2">No tasks yet.</p>
                    <Link
                      href="/builds"
                      className="text-sm underline focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
                    >
                      Open a build to add tasks
                    </Link>
                  </SectionCard>
                ) : (
                  <>
                    <SectionCard title="Progress" className="mb-8">
                      <div className="flex items-baseline gap-4 flex-wrap">
                        <p className="text-lg font-medium text-kyar-text">
                          {checkedCount} of {totalCount} tasks
                        </p>
                        <div
                          className="flex-1 min-w-[120px] h-3 max-w-xs bg-kyar-muted rounded-full overflow-hidden border border-kyar-borderSubtle"
                          role="progressbar"
                          aria-valuenow={checkedCount}
                          aria-valuemin={0}
                          aria-valuemax={totalCount}
                        >
                          <div
                            className="h-full bg-kyar-text rounded-full transition-[width] duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </SectionCard>

                    {deadlineApproaching.length > 0 && (
                      <SectionCard title="Deadline approaching" className="mb-8">
                        <PlannerTaskTree
                          tree={treeApproaching}
                          userId={userId}
                          onToggle={handleToggle}
                          dragController={dragController}
                        />
                      </SectionCard>
                    )}

                    <SectionCard title={deadlineApproaching.length > 0 ? "Other tasks" : "Tasks"}>
                      <PlannerTaskTree
                        tree={deadlineApproaching.length > 0 ? treeOther : treeAll}
                        userId={userId}
                        onToggle={handleToggle}
                        dragController={dragController}
                      />
                    </SectionCard>
                  </>
                )}
              </>
            )}
          </>
        ) : view === "events" ? (
          <div className="space-y-6">
            {isLoadingConventions ? (
              <p className="text-sm text-kyar-textTertiary">Loading events…</p>
            ) : !conventions || conventions.length === 0 ? (
              <SectionCard title="Events">
                <p className="text-sm text-kyar-textTertiary mb-2">No events yet.</p>
                <Link
                  href="/conventions"
                  className="text-sm underline focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
                >
                  Create an event
                </Link>
              </SectionCard>
            ) : (
              conventions.map((con) => (
                <SectionCard key={con._id} title={con.name}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <span className="text-xs text-kyar-meta">
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
                    </span>
                    <div className="flex gap-2 flex-wrap">
                      <Link
                        href={`/conventions/${con._id}`}
                        className="min-h-[44px] inline-flex items-center text-[10px] font-bold uppercase tracking-widest border border-kyar-borderSubtle px-6 py-2.5 rounded-full hover:bg-kyar-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                      >
                        Plan
                      </Link>
                      <Link
                        href={`/conventions/${con._id}/packing`}
                        className="min-h-[44px] inline-flex items-center text-[10px] font-bold uppercase tracking-widest border border-kyar-borderSubtle px-6 py-2.5 rounded-full hover:bg-kyar-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                      >
                        Packing List
                      </Link>
                    </div>
                  </div>
                </SectionCard>
              ))
            )}
          </div>
        ) : null}
      </main>
      {dragState.draggingMeta && dragState.pointerX != null && dragState.pointerY != null ? (
        <div
          className="pointer-events-none fixed z-[10000] max-w-[260px] rounded-full bg-kyar-text px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-kyar-bg shadow-lg"
          style={{
            left: Math.max(12, Math.min(dragState.pointerX + 14, window.innerWidth - 280)),
            top: Math.max(12, Math.min(dragState.pointerY + 14, window.innerHeight - 80)),
          }}
        >
          <span className="block truncate">{dragState.draggingMeta.title ?? "Task"}</span>
        </div>
      ) : null}
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
    <ul className="divide-y divide-kyar-borderSubtle/60">
      {parent == null &&
      dragController.state.draggingMeta?.scopeKey === scopeKey &&
      dragController.state.draggingMeta.parentId != null ? (
        <li
          data-planner-root-drop-zone={scopeKey}
          className={`rounded-xl border border-dashed px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest ${
            dragController.state.dragOverRootScopeKey === scopeKey
              ? "border-kyar-text bg-kyar-muted text-kyar-text"
              : "border-kyar-borderSubtle bg-kyar-surface text-kyar-meta"
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
          <div className="absolute inset-x-3 top-0 z-10 h-1 rounded-full bg-kyar-text" />
        ) : null}
        {dropAfter ? (
          <div className="absolute inset-x-3 bottom-0 z-10 h-1 rounded-full bg-kyar-text" />
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
        <div className="mb-1 ml-[15px] border-l border-kyar-borderSubtle pl-3 sm:pl-4">
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
    <div className="divide-y divide-kyar-borderSubtle">
      {conventionGroups.map((convention) => (
        <details key={convention.conventionId} className="group py-1">
          <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[44px] rounded-lg px-2 py-2.5 text-sm font-medium text-kyar-text hover:bg-kyar-mutedWarm/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            <span className="select-none text-[10px] uppercase tracking-wider text-kyar-meta group-open:rotate-90 transition-transform">
              ▶
            </span>
            <span className="flex-1">{convention.conventionName}</span>
            <Link
              href={`/conventions/${convention.conventionId}/packing`}
              className="text-[10px] uppercase tracking-widest text-kyar-meta hover:text-kyar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded"
              onClick={(e) => e.stopPropagation()}
            >
              Open
            </Link>
          </summary>
          <div className="ml-3 border-l border-kyar-borderSubtle pl-2 pb-2 sm:pl-3">
            {convention.builds.map((build) => (
              <details key={build.buildId} className="group/build">
                <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[40px] rounded-lg px-2 py-2 text-sm text-kyar-text hover:bg-kyar-mutedWarm/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                  <span className="select-none text-[10px] uppercase tracking-wider text-kyar-meta group-open/build:rotate-90 transition-transform">
                    ▶
                  </span>
                  <span className="flex-1 font-light">{build.buildName}</span>
                </summary>
                <div className="ml-3 border-l border-kyar-borderSubtle pl-2 pb-2 sm:pl-3">
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
                <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[40px] rounded-lg px-2 py-2 text-sm text-kyar-text hover:bg-kyar-mutedWarm/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                  <span className="select-none text-[10px] uppercase tracking-wider text-kyar-meta group-open/pack:rotate-90 transition-transform">
                    ▶
                  </span>
                  <span className="flex-1 font-light">Packing</span>
                </summary>
                <div className="ml-3 border-l border-kyar-borderSubtle pl-2 pb-2 sm:pl-3">
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
          <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[44px] rounded-lg px-2 py-2.5 text-sm font-medium text-kyar-text hover:bg-kyar-mutedWarm/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            <span className="select-none text-[10px] uppercase tracking-wider text-kyar-meta group-open:rotate-90 transition-transform">
              ▶
            </span>
            <span className="flex-1">{build.buildName}</span>
            <Link
              href={`/build-detail/${build.buildId}`}
              className="text-[10px] uppercase tracking-widest text-kyar-meta hover:text-kyar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded"
              onClick={(e) => e.stopPropagation()}
            >
              Open
            </Link>
          </summary>
          <div className="ml-3 border-l border-kyar-borderSubtle pl-2 pb-2 sm:pl-3">
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
          <summary className="flex items-center gap-2 list-none cursor-pointer min-h-[44px] rounded-lg px-2 py-2.5 text-sm font-medium text-kyar-text hover:bg-kyar-mutedWarm/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            <span className="select-none text-[10px] uppercase tracking-wider text-kyar-meta group-open:rotate-90 transition-transform">
              ▶
            </span>
            <span className="flex-1">Elements and other tasks</span>
          </summary>
          <div className="ml-3 border-l border-kyar-borderSubtle pl-2 pb-2 sm:pl-3">
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
