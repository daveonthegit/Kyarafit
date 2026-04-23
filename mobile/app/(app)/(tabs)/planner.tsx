import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DropZone, PlannerTaskDragMeta } from "@kyarafit/design-system/domain";
import { plannerTaskScopeKey } from "@kyarafit/design-system/domain";
import { usePlannerTaskMove, type PlannerTaskMoveController } from "@/planner/usePlannerTaskMove";
import { applyWorkflowTreeDrop } from "@/workflow/applyWorkflowTreeDrop";
import { promoteWorkflowTaskToRoot, type WorkflowDropTask } from "@/workflow/applyWorkflowTreeDrop";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Doc, Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { WorkflowTaskDragHandle } from "@/components/workflow/WorkflowTaskDragHandle";
import { WorkflowTaskDragOverlay } from "@/components/workflow/WorkflowTaskDragOverlay";
import { WorkflowTaskEditorModal } from "@/components/workflow/WorkflowTaskEditorModal";
import { WorkflowTaskRootDropZone } from "@/components/workflow/WorkflowTaskRootDropZone";
import { APP_HREF } from "@/lib/appRoutes";
import { buildGlobalAddMenuActions } from "@/lib/globalAddMenuActions";
import { useDesignTheme } from "@/theme/useDesignTheme";
import {
  Button,
  DataBoundary,
  FloatingCreateMenu,
  MetaLabel,
  SectionHeading,
  SurfaceCard,
} from "@/ui";
import { useOfflineMutation, useOfflineQuery } from "@/offline";

type PlannerView = "tasks" | "events" | "agenda";
type Timeframe = "all" | "today" | "week";

type PlannerTask = {
  _id: Id<"workflowItems">;
  title: string;
  kind: string;
  category: string;
  status: string;
  parentId?: Id<"workflowItems">;
  ancestorIds: Id<"workflowItems">[];
  sortOrder: number;
  priority: number;
  dueDate?: string;
  targetDate?: string;
  startDate?: string;
  progressPercent: number;
  overdue?: boolean;
  blockedByCount?: number;
  blockedByTitles?: string[];
  buildId?: Id<"builds">;
  buildName: string | null;
  conventionId?: Id<"conventions">;
  conventionName?: string | null;
  cosplayNodeId?: Id<"cosplayNodes">;
  packingListItemId?: Id<"packingListItems">;
};

type PlannerTaskNode = PlannerTask & { children: PlannerTaskNode[] };

type PlannerTaskExplorerMenuMode = "full" | "editOnly";

type BuildGroup = { buildId: Id<"builds">; buildName: string; tasks: PlannerTask[] };
type ConventionGroup = {
  conventionId: Id<"conventions">;
  conventionName: string;
  builds: BuildGroup[];
  packingTasks: PlannerTask[];
};

type PlannerTree = {
  conventionGroups: ConventionGroup[];
  standaloneBuilds: BuildGroup[];
  unassignedTasks: PlannerTask[];
};

type UpcomingConventionRow = {
  convention: Doc<"conventions">;
  outfitCount: number;
};

type PlannerReady = {
  userId: string;
  tasks: PlannerTask[];
  conventions: Doc<"conventions">[];
  upcomingEvents: UpcomingConventionRow[];
};

const TODAY = new Date().toISOString().slice(0, 10);

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function isDueToday(dueDate: string | undefined) {
  return dueDate === TODAY;
}

function isDueThisWeek(dueDate: string | undefined) {
  if (!dueDate) return false;
  const weekEnd = addDays(TODAY, 7);
  return dueDate >= TODAY && dueDate <= weekEnd;
}

function filterByTimeframe(tasks: PlannerTask[], timeframe: Timeframe) {
  if (timeframe === "all") return tasks;
  if (timeframe === "today") return tasks.filter((task) => isDueToday(task.dueDate));
  return tasks.filter((task) => isDueThisWeek(task.dueDate));
}

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
  conventions: { _id: Id<"conventions">; name: string }[] | undefined
): PlannerTree {
  const conventionMap = new Map<
    Id<"conventions">,
    { conventionName: string; builds: Map<Id<"builds">, BuildGroup>; packingTasks: PlannerTask[] }
  >();
  const standaloneMap = new Map<Id<"builds">, BuildGroup>();
  const unassignedTasks: PlannerTask[] = [];

  const getConventionName = (conventionId: Id<"conventions">) =>
    conventions?.find((convention) => convention._id === conventionId)?.name ?? "Event";

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

  return {
    conventionGroups: Array.from(conventionMap.entries())
      .map(([conventionId, group]) => ({
        conventionId,
        conventionName: group.conventionName,
        builds: Array.from(group.builds.values()).sort((a, b) =>
          a.buildName.localeCompare(b.buildName)
        ),
        packingTasks: group.packingTasks,
      }))
      .sort((a, b) => a.conventionName.localeCompare(b.conventionName)),
    standaloneBuilds: Array.from(standaloneMap.values()).sort((a, b) =>
      a.buildName.localeCompare(b.buildName)
    ),
    unassignedTasks,
  };
}

function toPrettyStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatDateLabel(dateString: string) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function dependencyPreview(tasks: string[] | undefined, max = 2) {
  if (!tasks?.length) return { visible: [], overflow: 0 };
  return {
    visible: tasks.slice(0, max),
    overflow: Math.max(0, tasks.length - max),
  };
}

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  )}`;
}

export default function PlannerScreen() {
  const { t } = useTranslation();
  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const tasks = useOfflineQuery(api.workflow.listPlanner, userId ? { userId } : "skip");
  const conventions = useOfflineQuery(api.conventions.list, userId ? { userId } : "skip");
  const upcomingEvents = useOfflineQuery(
    api.conventions.listUpcomingWithPlanCounts,
    userId ? { userId } : "skip"
  );

  const loading =
    identity === undefined ||
    (userId != null &&
      (tasks === undefined || conventions === undefined || upcomingEvents === undefined));
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!userId) status = "empty";
  else status = "ready";

  const data: PlannerReady | undefined =
    status === "ready" && userId
      ? {
          userId,
          tasks: (tasks ?? []) as PlannerTask[],
          conventions: conventions ?? [],
          upcomingEvents: upcomingEvents ?? [],
        }
      : undefined;

  return (
    <DataBoundary<PlannerReady> status={status} data={data} error={error}>
      {(loaded) => <PlannerBody loaded={loaded} />}
    </DataBoundary>
  );
}

function PlannerBody({ loaded }: { loaded: PlannerReady }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useDesignTheme();
  const createTask = useOfflineMutation(api.workflow.create);
  const updateTask = useOfflineMutation(api.workflow.update);
  const moveTask = useOfflineMutation(api.workflow.move);
  const [view, setView] = useState<PlannerView>("tasks");
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [editorTaskId, setEditorTaskId] = useState<Id<"workflowItems"> | null>(null);
  const openingPath: string | null = null;

  const filteredTasks = useMemo(
    () => filterByTimeframe(loaded.tasks, timeframe),
    [loaded.tasks, timeframe]
  );

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const aDone = a.status === "done";
      const bDone = b.status === "done";
      if (aDone !== bDone) return aDone ? 1 : -1;
      const dateA = a.dueDate ?? "9999-12-31";
      const dateB = b.dueDate ?? "9999-12-31";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      if ((a.priority ?? 0) !== (b.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
      return a.title.localeCompare(b.title);
    });
  }, [filteredTasks]);

  const dueSoonTasks = useMemo(
    () => sortedTasks.filter((task) => isDueThisWeek(task.dueDate) || task.overdue),
    [sortedTasks]
  );
  const otherTasks = useMemo(
    () => sortedTasks.filter((task) => !dueSoonTasks.includes(task)),
    [dueSoonTasks, sortedTasks]
  );

  const dueSoonTree = useMemo(
    () => buildTaskTree(dueSoonTasks, loaded.conventions),
    [dueSoonTasks, loaded.conventions]
  );
  const otherTree = useMemo(
    () => buildTaskTree(otherTasks, loaded.conventions),
    [loaded.conventions, otherTasks]
  );
  const allTree = useMemo(
    () => buildTaskTree(sortedTasks, loaded.conventions),
    [loaded.conventions, sortedTasks]
  );

  const agendaGroups = useMemo(() => {
    const map = new Map<
      string,
      { kind: "task" | "event"; task?: PlannerTask; convention?: Doc<"conventions"> }[]
    >();
    for (const task of loaded.tasks) {
      if (!task.dueDate) continue;
      const entries = map.get(task.dueDate) ?? [];
      entries.push({ kind: "task", task });
      map.set(task.dueDate, entries);
    }
    for (const convention of loaded.conventions.filter((item) => item.archived !== true)) {
      const entries = map.get(convention.startDate) ?? [];
      entries.push({ kind: "event", convention });
      map.set(convention.startDate, entries);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entries]) => ({ date, entries }));
  }, [loaded.conventions, loaded.tasks]);

  const doneCount = filteredTasks.filter((task) => task.status === "done").length;

  const toggleTask = useCallback(
    async (task: PlannerTask) => {
      await updateTask({
        id: task._id,
        userId: loaded.userId,
        status: task.status === "done" ? "not_started" : "done",
      });
    },
    [loaded.userId, updateTask]
  );

  const plannerFlatDropTasks = useMemo<WorkflowDropTask[]>(
    () =>
      loaded.tasks.map((task) => ({
        _id: task._id,
        parentId: task.parentId ?? null,
        sortOrder: task.sortOrder ?? 0,
      })),
    [loaded.tasks]
  );

  const applyPlannerTaskDrop = useCallback(
    async (dragged: PlannerTaskDragMeta, target: PlannerTaskDragMeta, zone: DropZone) => {
      await applyWorkflowTreeDrop(
        dragged,
        target,
        zone,
        plannerFlatDropTasks,
        {
          userId: loaded.userId,
          moveTask,
          updateTask,
        },
        (D, T) => {
          const d = loaded.tasks.find((x) => x._id === D._id);
          const tt = loaded.tasks.find((x) => x._id === T._id);
          return !!(d && tt && plannerTaskScopeKey(d) === plannerTaskScopeKey(tt));
        }
      );
    },
    [loaded.tasks, loaded.userId, moveTask, plannerFlatDropTasks, updateTask]
  );

  const promotePlannerTaskToRoot = useCallback(
    async (dragged: PlannerTaskDragMeta, scopeKey: string) => {
      await promoteWorkflowTaskToRoot(
        dragged,
        plannerFlatDropTasks,
        {
          userId: loaded.userId,
          moveTask,
          updateTask,
        },
        (task) => {
          const candidate = loaded.tasks.find((item) => item._id === task._id);
          return !!candidate && plannerTaskScopeKey(candidate) === scopeKey;
        }
      );
    },
    [loaded.tasks, loaded.userId, moveTask, plannerFlatDropTasks, updateTask]
  );

  const plannerTaskMove = usePlannerTaskMove({
    userId: loaded.userId,
    onCommitDrop: applyPlannerTaskDrop,
    onCommitRootDrop: promotePlannerTaskToRoot,
    onError: (message) => Alert.alert(t("common.errorTitle"), message),
  });

  const rootViewRef = useRef<View>(null);
  const [rootFrame, setRootFrame] = useState({ x: 0, y: 0 });
  const updateRootFrame = useCallback(() => {
    rootViewRef.current?.measureInWindow?.((x, y) => {
      setRootFrame({ x, y });
    });
  }, []);
  useEffect(() => {
    if (!plannerTaskMove.dragMeta) return;
    updateRootFrame();
  }, [plannerTaskMove.dragMeta, updateRootFrame]);

  const handleCreateTask = useCallback(async () => {
    const title = newTaskTitle.trim();
    if (!title || creatingTask) return;
    setCreatingTask(true);
    try {
      await createTask({
        userId: loaded.userId,
        title,
        kind: "task",
        category: "craft",
        scopeKind: "shared",
      });
      setNewTaskTitle("");
      setCreateTaskOpen(false);
      if (view !== "tasks") setView("tasks");
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setCreatingTask(false);
    }
  }, [createTask, creatingTask, loaded.userId, newTaskTitle, t, view]);

  const plannerCreateActions = useMemo(
    () => buildGlobalAddMenuActions("planner", t, router),
    [router, t]
  );

  const editorCandidates = useMemo(
    () => loaded.tasks.map((task) => ({ _id: task._id, title: task.title })),
    [loaded.tasks]
  );

  return (
    <View ref={rootViewRef} className="flex-1" onLayout={updateRootFrame}>
      <ScrollView
        className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
        scrollEnabled={!plannerTaskMove.dragMeta}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 132,
          gap: 20,
        }}
      >
        <View>
          <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("planner.subtitle")}
          </Text>
        </View>

        <SurfaceCard className="px-4 py-4">
          <View className="flex-row rounded-full border border-kyar-borderSubtle bg-kyar-panel p-1 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel">
            <SegmentedPill
              active={view === "tasks"}
              label={t("planner.viewTasks")}
              onPress={() => setView("tasks")}
            />
            <SegmentedPill
              active={view === "events"}
              label={t("planner.viewEvents")}
              onPress={() => setView("events")}
            />
            <SegmentedPill
              active={view === "agenda"}
              label={t("planner.viewAgenda")}
              onPress={() => setView("agenda")}
            />
          </View>

          {view === "tasks" ? (
            <View className="mt-4 flex-row flex-wrap items-center gap-2">
              <ChoicePill
                active={timeframe === "all"}
                label={t("planner.timeAll")}
                onPress={() => setTimeframe("all")}
              />
              <ChoicePill
                active={timeframe === "today"}
                label={t("planner.timeToday")}
                onPress={() => setTimeframe("today")}
              />
              <ChoicePill
                active={timeframe === "week"}
                label={t("planner.timeWeek")}
                onPress={() => setTimeframe("week")}
              />
              <Pressable
                onPress={() => router.push("/(app)/(tabs)/builds")}
                className="min-h-[36px] justify-center rounded-full border border-kyar-text bg-kyar-text px-4 py-2 dark:border-kyar-dark-text dark:bg-kyar-dark-text"
              >
                <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-bg dark:text-kyar-dark-bg">
                  {t("planner.addTask")}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </SurfaceCard>

        {view === "tasks" ? (
          <>
            <SurfaceCard className="px-4 py-4">
              <MetaLabel>{t("planner.progressLabel")}</MetaLabel>
              <Text className="mt-3 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
                {t("planner.progressSummary", { done: doneCount, total: filteredTasks.length })}
              </Text>
              <View className="mt-4 h-2 overflow-hidden rounded-full bg-kyar-borderSubtle dark:bg-kyar-dark-borderSubtle">
                <View
                  className="h-full rounded-full bg-kyar-text dark:bg-kyar-dark-text"
                  style={{
                    width: `${filteredTasks.length > 0 ? Math.round((doneCount / filteredTasks.length) * 100) : 0}%`,
                  }}
                />
              </View>
            </SurfaceCard>

            {filteredTasks.length === 0 ? (
              <EmptyCard
                title={t("planner.emptyTitle")}
                body={t("planner.emptyBody")}
                actionLabel={t("planner.addTask")}
                onPress={() => setCreateTaskOpen(true)}
              />
            ) : (
              <>
                {dueSoonTasks.length > 0 ? (
                  <PlannerTreeSection
                    title={t("planner.dueSoon")}
                    tree={dueSoonTree}
                    onToggleTask={toggleTask}
                    onEditTask={setEditorTaskId}
                    taskMove={plannerTaskMove}
                    onOpenBuild={(id) => router.push(APP_HREF.build(id as string))}
                    onOpenElement={(id) => router.push(APP_HREF.element(id as string))}
                    onOpenConvention={(id) => router.push(APP_HREF.convention(id as string))}
                    openingPath={openingPath}
                  />
                ) : null}

                <PlannerTreeSection
                  title={
                    dueSoonTasks.length > 0 ? t("planner.otherTasks") : t("planner.taskSection")
                  }
                  tree={dueSoonTasks.length > 0 ? otherTree : allTree}
                  onToggleTask={toggleTask}
                  onEditTask={setEditorTaskId}
                  taskMove={plannerTaskMove}
                    onOpenBuild={(id) => router.push(APP_HREF.build(id as string))}
                    onOpenElement={(id) => router.push(APP_HREF.element(id as string))}
                    onOpenConvention={(id) => router.push(APP_HREF.convention(id as string))}
                    openingPath={openingPath}
                  />
              </>
            )}
          </>
        ) : null}

        {view === "events" ? (
          loaded.upcomingEvents.length === 0 ? (
            <EmptyCard
              title={t("planner.eventsEmptyTitle")}
              body={t("planner.eventsEmptyBody")}
              actionLabel={t("planner.openEvents")}
              onPress={() => router.push(APP_HREF.conventions)}
            />
          ) : (
            <View className="gap-4">
              {loaded.upcomingEvents.map(({ convention, outfitCount }) => (
                <SurfaceCard key={convention._id} className="px-4 py-4">
                  <MetaLabel>{t("planner.eventLabel")}</MetaLabel>
                  <Text className="mt-2 text-2xl font-semibold text-kyar-text dark:text-kyar-dark-text">
                    {convention.name}
                  </Text>
                  <Text className="mt-2 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                    {formatDateRange(convention.startDate, convention.endDate)}
                  </Text>
                  {convention.location ? (
                    <Text className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {convention.location}
                    </Text>
                  ) : null}
                  <Text className="mt-3 text-xs uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
                    {t("planner.eventOutfitCount", { count: outfitCount })}
                  </Text>
                  <View className="mt-4 flex-row flex-wrap gap-2">
                    <Button
                      title={t("planner.openPlan")}
                      variant="secondary"
                      onPress={() => router.push(APP_HREF.convention(convention._id))}
                    />
                    <Button
                      title={t("planner.openPacking")}
                      onPress={() => router.push(APP_HREF.conventionPacking(convention._id))}
                    />
                  </View>
                </SurfaceCard>
              ))}
            </View>
          )
        ) : null}

        {view === "agenda" ? (
          agendaGroups.length === 0 ? (
            <EmptyCard
              title={t("planner.agendaEmptyTitle")}
              body={t("planner.agendaEmptyBody")}
              actionLabel={t("planner.openBuilds")}
              onPress={() => router.push("/(app)/(tabs)/builds")}
            />
          ) : (
            <View className="gap-4">
              {agendaGroups.map((group) => (
                <SurfaceCard key={group.date} className="px-4 py-4">
                  <MetaLabel>{formatDateLabel(group.date)}</MetaLabel>
                  <View className="mt-4 gap-3">
                    {group.entries.map((entry, index) =>
                      entry.kind === "task" && entry.task ? (
                        <AgendaTaskRow
                          key={`${group.date}-task-${entry.task._id}`}
                          task={entry.task}
                          onToggle={() => void toggleTask(entry.task as PlannerTask)}
                          onEdit={() => setEditorTaskId(entry.task!._id)}
                          onOpenBuild={(id) => router.push(APP_HREF.build(id as string))}
                          onOpenElement={(id) => router.push(APP_HREF.element(id as string))}
                          onOpenConvention={(id) => router.push(APP_HREF.convention(id as string))}
                        />
                      ) : entry.convention ? (
                        <AgendaEventRow
                          key={`${group.date}-event-${entry.convention._id}-${index}`}
                          convention={entry.convention}
                          onOpen={() => router.push(APP_HREF.convention(entry.convention!._id))}
                          loading={false}
                        />
                      ) : null
                    )}
                  </View>
                </SurfaceCard>
              ))}
            </View>
          )
        ) : null}
      </ScrollView>

      <FloatingCreateMenu actions={plannerCreateActions} />

      <WorkflowTaskEditorModal
        visible={editorTaskId !== null}
        workflowItemId={editorTaskId}
        userId={loaded.userId}
        candidateTasks={editorCandidates}
        onClose={() => setEditorTaskId(null)}
      />

      <Modal
        visible={createTaskOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!creatingTask) setCreateTaskOpen(false);
        }}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => {
            if (!creatingTask) setCreateTaskOpen(false);
          }}
        >
          <Pressable
            className="rounded-t-3xl border border-kyar-borderSubtle bg-kyar-surface px-5 pb-8 pt-5 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
              {t("planner.addTaskTitle")}
            </Text>
            <Text className="mt-2 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("planner.addTaskBody")}
            </Text>

            <TextInput
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              placeholder={t("planner.addTaskPlaceholder")}
              placeholderTextColor={colors.textTertiary}
              className="mt-4 min-h-[52px] rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void handleCreateTask()}
            />

            <View className="mt-4 flex-row gap-3">
              <Button
                title={t("common.cancel")}
                variant="secondary"
                onPress={() => setCreateTaskOpen(false)}
                disabled={creatingTask}
                className="flex-1"
              />
              <Button
                title={creatingTask ? t("planner.creating") : t("planner.addTaskAction")}
                onPress={() => void handleCreateTask()}
                disabled={!newTaskTitle.trim() || creatingTask}
                className="flex-1"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <WorkflowTaskDragOverlay
        taskMove={plannerTaskMove}
        fallbackLabel={t("planner.taskFallbackLabel", { defaultValue: "Task" })}
        rootOffset={rootFrame}
      />
    </View>
  );
}

function PlannerTreeSection({
  title,
  tree,
  onToggleTask,
  onEditTask,
  taskMove,
  onOpenBuild,
  onOpenElement,
  onOpenConvention,
  openingPath,
}: {
  title: string;
  tree: PlannerTree;
  onToggleTask: (task: PlannerTask) => void | Promise<void>;
  onEditTask: (id: Id<"workflowItems">) => void;
  taskMove: PlannerTaskMoveController;
  onOpenBuild: (id: Id<"builds">) => void;
  onOpenElement: (id: Id<"cosplayNodes">) => void;
  onOpenConvention: (id: Id<"conventions">) => void;
  openingPath: string | null;
}) {
  const { t } = useTranslation();
  const hasContent =
    tree.conventionGroups.length > 0 ||
    tree.standaloneBuilds.length > 0 ||
    tree.unassignedTasks.length > 0;
  if (!hasContent) return null;

  return (
    <View>
      <SectionHeading title={title} />
      <View className="mt-4 gap-4">
        {tree.conventionGroups.map((group) => (
          <SurfaceCard key={group.conventionId} className="px-4 py-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <MetaLabel>{t("planner.eventLabel")}</MetaLabel>
                <Text className="mt-1 text-xl font-semibold text-kyar-text dark:text-kyar-dark-text">
                  {group.conventionName}
                </Text>
              </View>
              <Button
                title={
                  openingPath === `/conventions/${group.conventionId}`
                    ? t("planner.opening")
                    : t("planner.openPlan")
                }
                variant="secondary"
                onPress={() => onOpenConvention(group.conventionId)}
                loading={false}
              />
            </View>

            <View className="mt-4 gap-4">
              {group.builds.map((build) => (
                <View key={build.buildId}>
                  <MetaLabel>{build.buildName}</MetaLabel>
                  <PlannerTaskTreeList
                    nodes={buildTaskHierarchy(build.tasks)}
                    onToggleTask={onToggleTask}
                    onEditTask={onEditTask}
                    taskMove={taskMove}
                    onOpenBuild={onOpenBuild}
                    onOpenElement={onOpenElement}
                    onOpenConvention={onOpenConvention}
                  />
                </View>
              ))}

              {group.packingTasks.length > 0 ? (
                <View>
                  <MetaLabel>{t("planner.packingSection")}</MetaLabel>
                  <PlannerTaskTreeList
                    nodes={buildTaskHierarchy(group.packingTasks)}
                    onToggleTask={onToggleTask}
                    onEditTask={onEditTask}
                    taskMove={taskMove}
                    onOpenBuild={onOpenBuild}
                    onOpenElement={onOpenElement}
                    onOpenConvention={onOpenConvention}
                  />
                </View>
              ) : null}
            </View>
          </SurfaceCard>
        ))}

        {tree.standaloneBuilds.map((build) => (
          <SurfaceCard key={build.buildId} className="px-4 py-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <MetaLabel>{t("common.builds")}</MetaLabel>
                <Text className="mt-1 text-xl font-semibold text-kyar-text dark:text-kyar-dark-text">
                  {build.buildName}
                </Text>
              </View>
              <Button
                title={t("planner.openBuild")}
                variant="secondary"
                onPress={() => onOpenBuild(build.buildId)}
              />
            </View>
            <PlannerTaskTreeList
              nodes={buildTaskHierarchy(build.tasks)}
              onToggleTask={onToggleTask}
              onEditTask={onEditTask}
              taskMove={taskMove}
              onOpenBuild={onOpenBuild}
              onOpenElement={onOpenElement}
              onOpenConvention={onOpenConvention}
            />
          </SurfaceCard>
        ))}

        {tree.unassignedTasks.length > 0 ? (
          <SurfaceCard className="px-4 py-4">
            <MetaLabel>{t("planner.otherTaskGroup")}</MetaLabel>
            <PlannerTaskTreeList
              nodes={buildTaskHierarchy(tree.unassignedTasks)}
              onToggleTask={onToggleTask}
              onEditTask={onEditTask}
              taskMove={taskMove}
              onOpenBuild={onOpenBuild}
              onOpenElement={onOpenElement}
              onOpenConvention={onOpenConvention}
            />
          </SurfaceCard>
        ) : null}
      </View>
    </View>
  );
}

function PlannerTaskTreeList({
  nodes,
  parent,
  onToggleTask,
  onEditTask,
  taskMove,
  onOpenBuild,
  onOpenElement,
  onOpenConvention,
  menuMode = "full",
}: {
  nodes: PlannerTaskNode[];
  parent?: PlannerTaskNode;
  onToggleTask: (task: PlannerTask) => void | Promise<void>;
  onEditTask: (id: Id<"workflowItems">) => void;
  taskMove: PlannerTaskMoveController;
  onOpenBuild: (id: Id<"builds">) => void;
  onOpenElement: (id: Id<"cosplayNodes">) => void;
  onOpenConvention: (id: Id<"conventions">) => void;
  menuMode?: PlannerTaskExplorerMenuMode;
}) {
  const { t } = useTranslation();
  const scopeKey = nodes[0] ? plannerTaskScopeKey(nodes[0]) : null;
  if (nodes.length === 0) return null;

  return (
    <View className="mt-2">
      {menuMode === "full" && scopeKey ? (
        <WorkflowTaskRootDropZone
          scopeKey={scopeKey}
          taskMove={taskMove}
          label={t("planner.dropToTopLevel", {
            defaultValue: "Drop here to make it top level",
          })}
        />
      ) : null}
      {nodes.map((task, index) => (
        <PlannerTaskBranch
          key={task._id}
          task={task}
          index={index}
          parent={parent}
          onToggleTask={onToggleTask}
          onEditTask={onEditTask}
          taskMove={taskMove}
          onOpenBuild={onOpenBuild}
          onOpenElement={onOpenElement}
          onOpenConvention={onOpenConvention}
          menuMode={menuMode}
        />
      ))}
    </View>
  );
}

function PlannerTaskBranch({
  task,
  index,
  parent,
  onToggleTask,
  onEditTask,
  taskMove,
  onOpenBuild,
  onOpenElement,
  onOpenConvention,
  menuMode,
}: {
  task: PlannerTaskNode;
  index: number;
  parent?: PlannerTaskNode;
  onToggleTask: (task: PlannerTask) => void | Promise<void>;
  onEditTask: (id: Id<"workflowItems">) => void;
  taskMove: PlannerTaskMoveController;
  onOpenBuild: (id: Id<"builds">) => void;
  onOpenElement: (id: Id<"cosplayNodes">) => void;
  onOpenConvention: (id: Id<"conventions">) => void;
  menuMode: PlannerTaskExplorerMenuMode;
}) {
  const [childrenExpanded, setChildrenExpanded] = useState(true);
  const hasChildren = task.children.length > 0;

  const dragMeta = useMemo<PlannerTaskDragMeta>(
    () => ({
      taskId: task._id as string,
      scopeKey: plannerTaskScopeKey(task),
      parentId: parent?._id as string | undefined,
      siblingIndex: index,
      ancestorIds: task.ancestorIds.map((id) => id as string),
      title: task.title,
    }),
    [index, parent?._id, task]
  );

  return (
    <View>
      <PlannerTaskExplorerRow
        task={task}
        depth={task.ancestorIds.length}
        hasChildren={hasChildren}
        childrenExpanded={childrenExpanded}
        onToggleChildrenExpanded={() => setChildrenExpanded((v) => !v)}
        onToggle={() => void onToggleTask(task)}
        onEdit={() => onEditTask(task._id)}
        onOpenBuild={onOpenBuild}
        onOpenElement={onOpenElement}
        onOpenConvention={onOpenConvention}
        menuMode={menuMode}
        taskMove={taskMove}
        dragMeta={dragMeta}
      />

      {hasChildren && childrenExpanded ? (
        <PlannerTaskTreeList
          nodes={task.children}
          parent={task}
          onToggleTask={onToggleTask}
          onEditTask={onEditTask}
          taskMove={taskMove}
          onOpenBuild={onOpenBuild}
          onOpenElement={onOpenElement}
          onOpenConvention={onOpenConvention}
          menuMode={menuMode}
        />
      ) : null}
    </View>
  );
}

function PlannerTaskExplorerRow({
  task,
  depth,
  hasChildren,
  childrenExpanded,
  onToggleChildrenExpanded,
  onToggle,
  onEdit,
  onOpenBuild,
  onOpenElement,
  onOpenConvention,
  menuMode,
  taskMove,
  dragMeta,
}: {
  task: PlannerTask;
  depth: number;
  hasChildren: boolean;
  childrenExpanded: boolean;
  onToggleChildrenExpanded: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onOpenBuild: (id: Id<"builds">) => void;
  onOpenElement: (id: Id<"cosplayNodes">) => void;
  onOpenConvention: (id: Id<"conventions">) => void;
  menuMode: PlannerTaskExplorerMenuMode;
  taskMove?: PlannerTaskMoveController;
  dragMeta?: PlannerTaskDragMeta;
}) {
  const { t } = useTranslation();
  const { colors } = useDesignTheme();
  const blockingPreview = dependencyPreview(task.blockedByTitles);
  const rowRef = useRef<View>(null);

  const dragEnabled = menuMode === "full" && taskMove != null && dragMeta != null;
  const { draggingTaskId, dragOverTaskId, dragOverZone } = taskMove?.dragVisualState ?? {
    draggingTaskId: null,
    dragOverTaskId: null,
    dragOverZone: null,
  };

  const dragging = dragEnabled && draggingTaskId === task._id;
  const dropBefore = dragEnabled && dragOverTaskId === task._id && dragOverZone === "before";
  const dropAfter = dragEnabled && dragOverTaskId === task._id && dragOverZone === "after";
  const dropInto = dragEnabled && dragOverTaskId === task._id && dragOverZone === "into";

  useEffect(() => {
    if (!dragEnabled || !taskMove || !dragMeta) return;
    taskMove.registerRow(task._id, rowRef.current, dragMeta);
    return () => taskMove.unregisterRow(task._id);
  }, [dragEnabled, dragMeta, task._id, taskMove]);

  const openContext = () => {
    if (task.buildId) onOpenBuild(task.buildId);
    else if (task.cosplayNodeId) onOpenElement(task.cosplayNodeId);
    else if (task.conventionId) onOpenConvention(task.conventionId);
  };

  const hasContextTarget = Boolean(task.buildId || task.cosplayNodeId || task.conventionId);

  const rowDepth = Math.min(56, depth * 14);

  const cardClass =
    dropInto
      ? "rounded-2xl border border-kyar-text bg-kyar-panelRaised px-2 py-2.5 shadow-sm dark:border-kyar-dark-text dark:bg-kyar-dark-panelRaised dark:shadow-none"
      : "rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-2 py-2.5 shadow-sm dark:border-kyar-dark-border dark:bg-kyar-dark-panelRaised dark:shadow-none";

  const rowBody = (
    <>
      {dropBefore ? (
        <View className="absolute inset-x-4 top-0 h-1 rounded-full bg-kyar-text dark:bg-kyar-dark-text" />
      ) : null}
      {dropAfter ? (
        <View className="absolute inset-x-4 bottom-0 h-1 rounded-full bg-kyar-text dark:bg-kyar-dark-text" />
      ) : null}

      <View className="flex-row items-start gap-1">
        {hasChildren ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleChildrenExpanded();
            }}
            hitSlop={8}
            className="h-9 w-9 shrink-0 items-center justify-center rounded-full active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={
              childrenExpanded
                ? t("common.collapse", { defaultValue: "Collapse" })
                : t("common.expand", { defaultValue: "Expand" })
            }
          >
            <Text className="text-base text-kyar-meta dark:text-kyar-dark-textSecondary">
              {childrenExpanded ? "▾" : "▸"}
            </Text>
          </Pressable>
        ) : (
          <View className="w-9 shrink-0" />
        )}

        <Pressable
          onPress={(event) => {
            event.stopPropagation?.();
            onToggle();
          }}
          className={`mt-1 h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
            task.status === "done"
              ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
              : "border-kyar-border bg-transparent dark:border-kyar-dark-border dark:bg-kyar-dark-muted/70"
          }`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.status === "done" }}
        >
          {task.status === "done" ? (
            <Ionicons name="checkmark" size={16} color={colors.bg} />
          ) : null}
        </Pressable>

        <Pressable
          onPress={openContext}
          disabled={!hasContextTarget}
          className="min-w-0 flex-1 py-0.5 active:opacity-80"
          accessibilityRole={hasContextTarget ? "button" : "text"}
        >
          <Text
            className={`text-base leading-snug ${
              task.status === "done"
                ? "text-kyar-textTertiary line-through dark:text-kyar-dark-textTertiary"
                : "text-kyar-text dark:text-kyar-dark-text"
            }`}
          >
            {task.title}
          </Text>
          <Text className="mt-0.5 text-[11px] uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-textSecondary">
            {toPrettyStatus(task.status)} · {task.category}
            {task.dueDate ? ` · ${formatDateLabel(task.dueDate)}` : ""}
          </Text>
          {dropInto ? (
            <Text className="mt-2 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
              {t("buildDetail.dropIntoLabel", { defaultValue: "Drop to nest inside" })}
            </Text>
          ) : null}
          {task.blockedByCount ? (
            <Text className="mt-1 text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("planner.blockedLabel", { count: task.blockedByCount })}
            </Text>
          ) : null}
          {blockingPreview.visible.length > 0 ? (
            <View className="mt-2 flex-row flex-wrap gap-1.5">
              {blockingPreview.visible.map((title) => (
                <View
                  key={`${task._id}-${title}`}
                  className="rounded-full border border-kyar-borderSubtle bg-kyar-surface px-2.5 py-1 dark:border-kyar-dark-border dark:bg-kyar-dark-muted"
                >
                  <Text
                    className="text-[10px] text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                </View>
              ))}
              {blockingPreview.overflow > 0 ? (
                <View className="rounded-full bg-kyar-borderSubtle px-2.5 py-1 dark:bg-kyar-dark-muted">
                  <Text className="text-[10px] uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-textSecondary">
                    +{blockingPreview.overflow}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </Pressable>

        <View className="shrink-0 flex-row items-center gap-0.5">
          {dragEnabled && taskMove && dragMeta ? (
            <WorkflowTaskDragHandle
              taskId={task._id}
              dragMeta={dragMeta}
              taskMove={taskMove}
            />
          ) : null}
          <Pressable
            onPress={onEdit}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
            accessibilityLabel={t("workflowEditor.editAction")}
            accessibilityRole="button"
          >
            <Ionicons name="create-outline" size={22} color={colors.textSecondary} />
          </Pressable>
          {hasContextTarget ? (
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          ) : (
            <View className="w-[18px]" />
          )}
        </View>
      </View>
    </>
  );

  return (
    <View style={{ marginLeft: rowDepth }} className="mb-2">
      <Pressable
        ref={dragEnabled ? rowRef : undefined}
        delayLongPress={220}
        onLongPress={(event) => {
          if (!dragEnabled || !taskMove || !dragMeta) return;
          void taskMove.startDrag(dragMeta, {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          });
        }}
        onTouchMove={(event) => {
          if (!dragging || !taskMove) return;
          taskMove.updateDragPoint({
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          });
        }}
        onTouchEnd={(event) => {
          if (!dragging || !taskMove) return;
          taskMove.finishDrag({
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          });
        }}
        onTouchCancel={() => {
          if (!dragging || !taskMove) return;
          taskMove.finishDrag();
        }}
        className={`relative ${cardClass} ${dragging ? "opacity-55" : ""}`}
      >
        {rowBody}
      </Pressable>
    </View>
  );
}

function AgendaTaskRow({
  task,
  onToggle,
  onEdit,
  onOpenBuild,
  onOpenElement,
  onOpenConvention,
}: {
  task: PlannerTask;
  onToggle: () => void;
  onEdit: () => void;
  onOpenBuild: (id: Id<"builds">) => void;
  onOpenElement: (id: Id<"cosplayNodes">) => void;
  onOpenConvention: (id: Id<"conventions">) => void;
}) {
  const { t } = useTranslation();

  return (
    <View>
      <MetaLabel>{t("planner.agendaTaskLabel")}</MetaLabel>
      <PlannerTaskExplorerRow
        task={task}
        depth={task.ancestorIds.length}
        hasChildren={false}
        childrenExpanded
        onToggleChildrenExpanded={() => undefined}
        onToggle={onToggle}
        onEdit={onEdit}
        onOpenBuild={onOpenBuild}
        onOpenElement={onOpenElement}
        onOpenConvention={onOpenConvention}
        menuMode="editOnly"
      />
    </View>
  );
}

function AgendaEventRow({
  convention,
  onOpen,
  loading,
}: {
  convention: Doc<"conventions">;
  onOpen: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View>
      <MetaLabel>{t("planner.eventLabel")}</MetaLabel>
      <SurfaceCard className="mt-2 px-4 py-4">
        <Text className="text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
          {convention.name}
        </Text>
        <Text className="mt-2 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {formatDateRange(convention.startDate, convention.endDate)}
        </Text>
        <Button
          title={loading ? t("planner.opening") : t("planner.openPlan")}
          variant="secondary"
          onPress={onOpen}
          loading={loading}
          className="mt-4"
        />
      </SurfaceCard>
    </View>
  );
}

function EmptyCard({
  title,
  body,
  actionLabel,
  onPress,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <SurfaceCard className="px-4 py-5">
      <Text className="text-xl font-semibold text-kyar-text dark:text-kyar-dark-text">{title}</Text>
      <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
        {body}
      </Text>
      <Button title={actionLabel} variant="secondary" onPress={onPress} className="mt-4" />
    </SurfaceCard>
  );
}

function SegmentedPill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-full px-4 py-3 ${
        active ? "bg-kyar-text dark:bg-kyar-dark-text" : "bg-transparent"
      }`}
    >
      <Text
        className={`text-center text-sm font-medium ${
          active ? "text-kyar-bg dark:text-kyar-dark-bg" : "text-kyar-text dark:text-kyar-dark-text"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChoicePill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-4 py-2 ${
        active
          ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
          : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
      }`}
    >
      <Text
        className={`text-xs font-medium ${
          active ? "text-kyar-bg dark:text-kyar-dark-bg" : "text-kyar-text dark:text-kyar-dark-text"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
