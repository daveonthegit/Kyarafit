import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DropZone, PlannerTaskDragMeta } from "@kyarafit/design-system/domain";
import { plannerTaskScopeKey } from "@kyarafit/design-system/domain";
import { usePlannerTaskMove, type PlannerTaskMoveController } from "@/planner/usePlannerTaskMove";
import { applyWorkflowTreeDrop } from "@/workflow/applyWorkflowTreeDrop";
import { promoteWorkflowTaskToRoot, type WorkflowDropTask } from "@/workflow/applyWorkflowTreeDrop";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Doc, Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { WorkflowTaskDragOverlay } from "@/components/workflow/WorkflowTaskDragOverlay";
import { WorkflowTaskEditorModal } from "@/components/workflow/WorkflowTaskEditorModal";
import { APP_HREF } from "@/lib/appRoutes";
import { buildGlobalAddMenuActions } from "@/lib/globalAddMenuActions";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { DataBoundary, FloatingCreateMenu } from "@/ui";
import {
  GlassEmptyState,
  GlassPanel,
  GlassSheet,
  GlassStatusChip,
  GlassTextField,
  PhotoBackdrop,
  PhotoPill,
} from "@/ui/glass";
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

type BuildGroup = { buildId: Id<"builds">; buildName: string; tasks: PlannerTaskNode[] };
type RawBuildGroup = { buildId: Id<"builds">; buildName: string; tasks: PlannerTask[] };
type ConventionGroup = {
  conventionId: Id<"conventions">;
  conventionName: string;
  builds: BuildGroup[];
  packingTasks: PlannerTaskNode[];
};

type PlannerTree = {
  conventionGroups: ConventionGroup[];
  standaloneBuilds: BuildGroup[];
  unassignedTasks: PlannerTaskNode[];
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
    {
      conventionName: string;
      builds: Map<Id<"builds">, RawBuildGroup>;
      packingTasks: PlannerTask[];
    }
  >();
  const standaloneMap = new Map<Id<"builds">, RawBuildGroup>();
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
        builds: Array.from(group.builds.values())
          .sort((a, b) => a.buildName.localeCompare(b.buildName))
          .map((build) => ({ ...build, tasks: buildTaskHierarchy(build.tasks) })),
        packingTasks: buildTaskHierarchy(group.packingTasks),
      }))
      .sort((a, b) => a.conventionName.localeCompare(b.conventionName)),
    standaloneBuilds: Array.from(standaloneMap.values())
      .sort((a, b) => a.buildName.localeCompare(b.buildName))
      .map((build) => ({ ...build, tasks: buildTaskHierarchy(build.tasks) })),
    unassignedTasks: buildTaskHierarchy(unassignedTasks),
  };
}

function formatDateLabel(dateString: string) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
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
  const insets = useSafeAreaInsets();
  const createTask = useOfflineMutation(api.workflow.create);
  const updateTask = useOfflineMutation(api.workflow.update);
  const moveTask = useOfflineMutation(api.workflow.move);
  const moveAndResequenceTask = useOfflineMutation(api.workflow.moveAndResequence);
  const [view, setView] = useState<PlannerView>("tasks");
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [editorTaskId, setEditorTaskId] = useState<Id<"workflowItems"> | null>(null);
  const [showLater, setShowLater] = useState(false);
  const openingPath: string | null = null;

  // Backdrop = the build owning the most urgent task: first overdue task's
  // build, else the build of the nearest due task (same build-image pattern
  // as the build detail screen: api.builds.get + PhotoBackdrop resolution).
  const urgentBuildId = useMemo(() => {
    const candidates = loaded.tasks.filter((task) => task.status !== "done" && task.buildId);
    const byDue = (a: PlannerTask, b: PlannerTask) =>
      (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
    const overdue = candidates.filter((task) => task.overdue).sort(byDue);
    if (overdue[0]?.buildId) return overdue[0].buildId;
    const dated = candidates.filter((task) => task.dueDate).sort(byDue);
    return dated[0]?.buildId ?? null;
  }, [loaded.tasks]);
  const urgentBuild = useOfflineQuery(api.builds.get, urgentBuildId ? { id: urgentBuildId } : "skip");

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

  const todayTasks = useMemo(
    () => sortedTasks.filter((task) => task.overdue || isDueToday(task.dueDate)),
    [sortedTasks]
  );
  const weekTasks = useMemo(
    () =>
      sortedTasks.filter((task) => !todayTasks.includes(task) && isDueThisWeek(task.dueDate)),
    [sortedTasks, todayTasks]
  );
  const laterTasks = useMemo(
    () =>
      sortedTasks.filter((task) => !todayTasks.includes(task) && !weekTasks.includes(task)),
    [sortedTasks, todayTasks, weekTasks]
  );

  const todayTree = useMemo(
    () => buildTaskTree(todayTasks, loaded.conventions),
    [loaded.conventions, todayTasks]
  );
  const weekTree = useMemo(
    () => buildTaskTree(weekTasks, loaded.conventions),
    [loaded.conventions, weekTasks]
  );
  const laterTree = useMemo(
    () => buildTaskTree(laterTasks, loaded.conventions),
    [loaded.conventions, laterTasks]
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
        scopeKey: plannerTaskScopeKey(task),
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
          moveAndResequence: moveAndResequenceTask,
        },
        (D, T) => {
          const d = loaded.tasks.find((x) => x._id === D._id);
          const tt = loaded.tasks.find((x) => x._id === T._id);
          return !!(d && tt && plannerTaskScopeKey(d) === plannerTaskScopeKey(tt));
        }
      );
    },
    [loaded.tasks, loaded.userId, moveAndResequenceTask, moveTask, plannerFlatDropTasks, updateTask]
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
          moveAndResequence: moveAndResequenceTask,
        },
        (task) => {
          const candidate = loaded.tasks.find((item) => item._id === task._id);
          return !!candidate && plannerTaskScopeKey(candidate) === scopeKey;
        }
      );
    },
    [loaded.tasks, loaded.userId, moveAndResequenceTask, moveTask, plannerFlatDropTasks, updateTask]
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

  const dateEyebrow = useMemo(() => {
    const now = new Date();
    const weekday = now.toLocaleDateString(undefined, { weekday: "long" });
    const monthDay = now.toLocaleDateString(undefined, { month: "long", day: "numeric" });
    return `${weekday} · ${monthDay}`;
  }, []);

  const hasAnyTasks = filteredTasks.length > 0;

  return (
    <View ref={rootViewRef} style={{ flex: 1 }} onLayout={updateRootFrame}>
      <PhotoBackdrop
        imageStorageId={urgentBuild?.imageStorageId ?? null}
        imageUrl={urgentBuild?.imageUrl ?? null}
      />
      <ScrollView
        style={{ flex: 1 }}
        scrollEnabled={!plannerTaskMove.dragMeta}
        contentContainerStyle={{
          paddingTop: insets.top + 58,
          paddingBottom: insets.bottom + 120,
        }}
      >
        <View style={{ paddingHorizontal: 22 }}>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.sansBold,
              fontSize: 9,
              letterSpacing: ls(0.26, 9),
              textTransform: "uppercase",
              color: glass.text.fg,
              opacity: 0.75,
              marginBottom: 8,
            }}
          >
            {dateEyebrow}
          </Text>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontSize: 40,
              lineHeight: 38,
              color: glass.text.fg,
            }}
          >
            {t("planner.headline", { defaultValue: "What's due" })}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 26 }}>
          <GlassPanel style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <UnderlineTab
                  active={view === "tasks"}
                  label={t("planner.viewTasks")}
                  onPress={() => setView("tasks")}
                />
                <UnderlineTab
                  active={view === "events"}
                  label={t("planner.viewEvents")}
                  onPress={() => setView("events")}
                />
                <UnderlineTab
                  active={view === "agenda"}
                  label={t("planner.viewAgenda")}
                  onPress={() => setView("agenda")}
                />
              </View>
              {view === "tasks" && hasAnyTasks ? (
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                    fontSize: 9,
                    letterSpacing: ls(0.14, 9),
                    textTransform: "uppercase",
                    color: glass.text.fg55,
                  }}
                >
                  {t("planner.progressShort", {
                    defaultValue: "{{done}}/{{total}} done",
                    done: doneCount,
                    total: filteredTasks.length,
                  })}
                </Text>
              ) : null}
            </View>

            {view === "tasks" ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 14,
                  marginTop: 14,
                  paddingBottom: 12,
                  borderBottomWidth: borderWidth.hairline,
                  borderBottomColor: glass.border.divider,
                }}
              >
                <UnderlineTab
                  active={timeframe === "all"}
                  label={t("planner.timeAll")}
                  onPress={() => setTimeframe("all")}
                />
                <UnderlineTab
                  active={timeframe === "today"}
                  label={t("planner.timeToday")}
                  onPress={() => setTimeframe("today")}
                />
                <UnderlineTab
                  active={timeframe === "week"}
                  label={t("planner.timeWeek")}
                  onPress={() => setTimeframe("week")}
                />
                <View style={{ marginLeft: "auto" }}>
                  <PhotoPill
                    variant="outline"
                    size="sm"
                    label={t("planner.addTask")}
                    onPress={() => router.push(APP_HREF.builds)}
                  />
                </View>
              </View>
            ) : null}

            {view === "tasks" ? (
              !hasAnyTasks ? (
                <GlassEmptyState
                  icon="checkbox-outline"
                  message={t("planner.emptyTitle")}
                  secondary={t("planner.emptyBody")}
                  action={
                    <PhotoPill
                      variant="outline"
                      size="sm"
                      label={t("planner.addTask")}
                      onPress={() => setCreateTaskOpen(true)}
                    />
                  }
                />
              ) : (
                <View>
                  {todayTasks.length > 0 ? (
                    <PlannerDueGroup label={t("planner.timeToday")}>
                      <PlannerTreeSection
                        tree={todayTree}
                        onToggleTask={toggleTask}
                        onEditTask={setEditorTaskId}
                        taskMove={plannerTaskMove}
                        onOpenBuild={(id) => router.push(APP_HREF.build(id as string))}
                        onOpenElement={(id) => router.push(APP_HREF.element(id as string))}
                        onOpenConvention={(id) => router.push(APP_HREF.convention(id as string))}
                        openingPath={openingPath}
                      />
                    </PlannerDueGroup>
                  ) : null}

                  {weekTasks.length > 0 ? (
                    <PlannerDueGroup label={t("planner.timeWeek")}>
                      <PlannerTreeSection
                        tree={weekTree}
                        onToggleTask={toggleTask}
                        onEditTask={setEditorTaskId}
                        taskMove={plannerTaskMove}
                        onOpenBuild={(id) => router.push(APP_HREF.build(id as string))}
                        onOpenElement={(id) => router.push(APP_HREF.element(id as string))}
                        onOpenConvention={(id) => router.push(APP_HREF.convention(id as string))}
                        openingPath={openingPath}
                      />
                    </PlannerDueGroup>
                  ) : null}

                  {laterTasks.length > 0 ? (
                    <PlannerDueGroup
                      label={t("planner.groupLater", { defaultValue: "Later" })}
                      trailing={
                        <Pressable
                          onPress={() => setShowLater((value) => !value)}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: showLater }}
                        >
                          <Text
                            style={{
                              fontFamily: APP_FONT_FAMILIES.sansBold,
                              fontSize: 9,
                              letterSpacing: ls(0.16, 9),
                              textTransform: "uppercase",
                              color: glass.text.fg55,
                            }}
                          >
                            {showLater
                              ? `${t("planner.hideLater", { defaultValue: "Hide" })} ▴`
                              : `${t("planner.showLater", { defaultValue: "Show" })} ▾`}
                          </Text>
                        </Pressable>
                      }
                    >
                      {showLater ? (
                        <PlannerTreeSection
                          tree={laterTree}
                          onToggleTask={toggleTask}
                          onEditTask={setEditorTaskId}
                          taskMove={plannerTaskMove}
                          onOpenBuild={(id) => router.push(APP_HREF.build(id as string))}
                          onOpenElement={(id) => router.push(APP_HREF.element(id as string))}
                          onOpenConvention={(id) => router.push(APP_HREF.convention(id as string))}
                          openingPath={openingPath}
                        />
                      ) : null}
                    </PlannerDueGroup>
                  ) : null}
                </View>
              )
            ) : null}

            {view === "events" ? (
              loaded.upcomingEvents.length === 0 ? (
                <GlassEmptyState
                  icon="calendar-outline"
                  message={t("planner.eventsEmptyTitle")}
                  secondary={t("planner.eventsEmptyBody")}
                  action={
                    <PhotoPill
                      variant="outline"
                      size="sm"
                      label={t("planner.openEvents")}
                      onPress={() => router.push(APP_HREF.conventions)}
                    />
                  }
                />
              ) : (
                <View style={{ marginTop: 4 }}>
                  {loaded.upcomingEvents.map(({ convention, outfitCount }) => (
                    <View
                      key={convention._id}
                      style={{
                        paddingVertical: 12,
                        borderBottomWidth: borderWidth.hairline,
                        borderBottomColor: glass.border.divider,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: APP_FONT_FAMILIES.displayItalic,
                          fontSize: 17,
                          color: glass.text.fg,
                        }}
                      >
                        {convention.name}
                      </Text>
                      <Text
                        style={{
                          marginTop: 3,
                          fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                          fontSize: 9,
                          letterSpacing: ls(0.14, 9),
                          textTransform: "uppercase",
                          color: glass.text.fg55,
                        }}
                      >
                        {formatDateRange(convention.startDate, convention.endDate)}
                        {convention.location ? ` · ${convention.location}` : ""}
                        {` · ${t("planner.eventOutfitCount", { count: outfitCount })}`}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 18, marginTop: 6 }}>
                        <PhotoPill
                          variant="text"
                          size="sm"
                          label={t("planner.openPlan")}
                          onPress={() => router.push(APP_HREF.convention(convention._id))}
                        />
                        <PhotoPill
                          variant="text"
                          size="sm"
                          label={t("planner.openPacking")}
                          onPress={() => router.push(APP_HREF.conventionPacking(convention._id))}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )
            ) : null}

            {view === "agenda" ? (
              agendaGroups.length === 0 ? (
                <GlassEmptyState
                  icon="today-outline"
                  message={t("planner.agendaEmptyTitle")}
                  secondary={t("planner.agendaEmptyBody")}
                  action={
                    <PhotoPill
                      variant="outline"
                      size="sm"
                      label={t("planner.openBuilds")}
                      onPress={() => router.push(APP_HREF.builds)}
                    />
                  }
                />
              ) : (
                <View style={{ marginTop: 4 }}>
                  {agendaGroups.map((group) => (
                    <PlannerDueGroup key={group.date} label={formatDateLabel(group.date)}>
                      {group.entries.map((entry, index) =>
                        entry.kind === "task" && entry.task ? (
                          <PlannerTaskExplorerRow
                            key={`${group.date}-task-${entry.task._id}`}
                            task={entry.task}
                            depth={0}
                            hasChildren={false}
                            childrenExpanded
                            onToggleChildrenExpanded={() => undefined}
                            onToggle={() => void toggleTask(entry.task as PlannerTask)}
                            onEdit={() => setEditorTaskId(entry.task!._id)}
                            onOpenBuild={(id) => router.push(APP_HREF.build(id as string))}
                            onOpenElement={(id) => router.push(APP_HREF.element(id as string))}
                            onOpenConvention={(id) =>
                              router.push(APP_HREF.convention(id as string))
                            }
                            menuMode="editOnly"
                          />
                        ) : entry.convention ? (
                          <View
                            key={`${group.date}-event-${entry.convention._id}-${index}`}
                            style={{
                              paddingVertical: 11,
                              borderBottomWidth: borderWidth.hairline,
                              borderBottomColor: glass.border.divider,
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: APP_FONT_FAMILIES.displayItalic,
                                fontSize: 15,
                                color: glass.text.fg,
                              }}
                            >
                              {entry.convention.name}
                            </Text>
                            <Text
                              style={{
                                marginTop: 3,
                                fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                                fontSize: 9,
                                letterSpacing: ls(0.14, 9),
                                textTransform: "uppercase",
                                color: glass.text.fg55,
                              }}
                            >
                              {formatDateRange(
                                entry.convention.startDate,
                                entry.convention.endDate
                              )}
                            </Text>
                            <View style={{ marginTop: 6 }}>
                              <PhotoPill
                                variant="text"
                                size="sm"
                                label={t("planner.openPlan")}
                                onPress={() =>
                                  router.push(APP_HREF.convention(entry.convention!._id))
                                }
                              />
                            </View>
                          </View>
                        ) : null
                      )}
                    </PlannerDueGroup>
                  ))}
                </View>
              )
            ) : null}
          </GlassPanel>
        </View>
      </ScrollView>

      <FloatingCreateMenu actions={plannerCreateActions} />

      <WorkflowTaskEditorModal
        visible={editorTaskId !== null}
        workflowItemId={editorTaskId}
        userId={loaded.userId}
        candidateTasks={editorCandidates}
        onClose={() => setEditorTaskId(null)}
      />

      <GlassSheet
        open={createTaskOpen}
        onClose={() => {
          if (!creatingTask) setCreateTaskOpen(false);
        }}
        closeLabel={t("common.cancel")}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontSize: 22,
              color: glass.text.fg,
            }}
          >
            {t("planner.addTaskTitle")}
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontFamily: APP_FONT_FAMILIES.sansRegular,
              fontSize: 12,
              lineHeight: 18,
              color: glass.text.fg70,
            }}
          >
            {t("planner.addTaskBody")}
          </Text>

          <View style={{ marginTop: 14 }}>
            <GlassTextField
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              placeholder={t("planner.addTaskPlaceholder")}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void handleCreateTask()}
            />
          </View>

          <View
            style={{
              marginTop: 18,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 20,
            }}
          >
            <PhotoPill
              variant="text"
              label={t("common.cancel")}
              onPress={() => setCreateTaskOpen(false)}
              disabled={creatingTask}
            />
            <PhotoPill
              variant="solid"
              label={creatingTask ? t("planner.creating") : t("planner.addTaskAction")}
              onPress={() => void handleCreateTask()}
              disabled={!newTaskTitle.trim() || creatingTask}
            />
          </View>
        </View>
      </GlassSheet>

      <WorkflowTaskDragOverlay
        taskMove={plannerTaskMove}
        fallbackLabel={t("planner.taskFallbackLabel", { defaultValue: "Task" })}
        rootOffset={rootFrame}
      />
    </View>
  );
}

/** 9px uppercase text tab — active = underline light (surface rule 6, never pills for nav). */
function UnderlineTab({
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
      hitSlop={10}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{ minHeight: 28, justifyContent: "center" }}
    >
      <View
        style={{
          paddingBottom: 3,
          borderBottomWidth: active ? 1.5 : 0,
          borderBottomColor: glass.text.fg,
        }}
      >
        <Text
          style={{
            fontFamily: active ? APP_FONT_FAMILIES.sansBold : APP_FONT_FAMILIES.sansSemiBold,
            fontSize: 9,
            letterSpacing: ls(0.16, 9),
            textTransform: "uppercase",
            color: active ? glass.text.fg : glass.text.fg55,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** Due-bucket group inside the panel: 9px/700/ls(0.2) label at reduced light. */
function PlannerDueGroup({
  label,
  trailing,
  children,
}: {
  label: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.sansBold,
            fontSize: 9,
            letterSpacing: ls(0.2, 9),
            textTransform: "uppercase",
            color: glass.text.fg55,
          }}
        >
          {label}
        </Text>
        {trailing ?? null}
      </View>
      {children}
    </View>
  );
}

/** Sub-scope meta header (convention / packing / unassigned runs) with optional link. */
function PlannerScopeHeader({ label, trailing }: { label: string; trailing?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 8,
      }}
    >
      <Text
        style={{
          flex: 1,
          fontFamily: APP_FONT_FAMILIES.sansSemiBold,
          fontSize: 9,
          letterSpacing: ls(0.16, 9),
          textTransform: "uppercase",
          color: glass.text.fg55,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      {trailing ?? null}
    </View>
  );
}

function PlannerTreeSection({
  tree,
  onToggleTask,
  onEditTask,
  taskMove,
  onOpenBuild,
  onOpenElement,
  onOpenConvention,
  openingPath,
}: {
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
      {tree.conventionGroups.map((group) => (
        <View key={group.conventionId}>
          <PlannerScopeHeader
            label={`${t("planner.eventLabel")} · ${group.conventionName}`}
            trailing={
              <PhotoPill
                variant="text"
                size="sm"
                label={
                  openingPath === `/conventions/${group.conventionId}`
                    ? t("planner.opening")
                    : t("planner.openPlan")
                }
                onPress={() => onOpenConvention(group.conventionId)}
              />
            }
          />

          {group.builds.map((build) => (
            <PlannerTaskTreeList
              key={build.buildId}
              nodes={build.tasks}
              onToggleTask={onToggleTask}
              onEditTask={onEditTask}
              taskMove={taskMove}
              onOpenBuild={onOpenBuild}
              onOpenElement={onOpenElement}
              onOpenConvention={onOpenConvention}
            />
          ))}

          {group.packingTasks.length > 0 ? (
            <View>
              <PlannerScopeHeader label={t("planner.packingSection")} />
              <PlannerTaskTreeList
                nodes={group.packingTasks}
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
      ))}

      {tree.standaloneBuilds.map((build) => (
        <PlannerTaskTreeList
          key={build.buildId}
          nodes={build.tasks}
          onToggleTask={onToggleTask}
          onEditTask={onEditTask}
          taskMove={taskMove}
          onOpenBuild={onOpenBuild}
          onOpenElement={onOpenElement}
          onOpenConvention={onOpenConvention}
        />
      ))}

      {tree.unassignedTasks.length > 0 ? (
        <PlannerTaskTreeList
          nodes={tree.unassignedTasks}
          onToggleTask={onToggleTask}
          onEditTask={onEditTask}
          taskMove={taskMove}
          onOpenBuild={onOpenBuild}
          onOpenElement={onOpenElement}
          onOpenConvention={onOpenConvention}
        />
      ) : null}
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
    <View>
      {menuMode === "full" && scopeKey && parent == null ? (
        <GlassRootDropZone
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
  const scopeKey = plannerTaskScopeKey(task);
  const ancestorKey = task.ancestorIds.map((id) => id as string).join("\0");

  const dragMeta = useMemo<PlannerTaskDragMeta>(
    () => ({
      taskId: task._id as string,
      scopeKey,
      parentId: parent?._id as string | undefined,
      siblingIndex: index,
      ancestorIds: ancestorKey ? ancestorKey.split("\0") : [],
      title: task.title,
    }),
    [ancestorKey, index, parent?._id, scopeKey, task._id, task.title]
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

  const dragEnabled = menuMode === "full" && taskMove != null && dragMeta != null;

  const dragTouchProps =
    dragEnabled && taskMove && dragMeta
      ? {
          delayLongPress: 220,
          onLongPress: (event: GestureResponderEvent) => {
            event.stopPropagation?.();
            void taskMove.startDrag(dragMeta, {
              x: event.nativeEvent.pageX,
              y: event.nativeEvent.pageY,
            });
          },
          onTouchMove: (event: GestureResponderEvent) => {
            taskMove.updateDragPoint({
              x: event.nativeEvent.pageX,
              y: event.nativeEvent.pageY,
            });
          },
          onTouchEnd: (event: GestureResponderEvent) => {
            taskMove.finishDrag({
              x: event.nativeEvent.pageX,
              y: event.nativeEvent.pageY,
            });
          },
          onTouchCancel: () => {
            taskMove.finishDrag();
          },
        }
      : {};

  const openContext = () => {
    if (task.buildId) onOpenBuild(task.buildId);
    else if (task.cosplayNodeId) onOpenElement(task.cosplayNodeId);
    else if (task.conventionId) onOpenConvention(task.conventionId);
  };

  const hasContextTarget = Boolean(task.buildId || task.cosplayNodeId || task.conventionId);

  const rowDepth = Math.min(56, depth * 14);
  const done = task.status === "done";
  const dueToday = isDueToday(task.dueDate);
  const contextMeta = task.buildName ?? task.conventionName ?? null;

  const rowBody = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 11,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: glass.border.divider,
      }}
    >
      {hasChildren ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onToggleChildrenExpanded();
          }}
          hitSlop={10}
          style={{ width: 22, height: 28, alignItems: "center", justifyContent: "center" }}
          accessibilityRole="button"
          accessibilityLabel={
            childrenExpanded
              ? t("common.collapse", { defaultValue: "Collapse" })
              : t("common.expand", { defaultValue: "Expand" })
          }
        >
          <Text style={{ fontSize: 12, color: glass.text.fg55 }}>
            {childrenExpanded ? "▾" : "▸"}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={(event) => {
          event.stopPropagation?.();
          onToggle();
        }}
        hitSlop={14}
        style={{ width: 24, height: 28, alignItems: "center", justifyContent: "center" }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
      >
        <View
          style={{
            width: 17,
            height: 17,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: done ? 0 : 1.5,
            borderColor: glass.text.fg55,
            backgroundColor: done ? glass.surface.solid : "transparent",
          }}
        >
          {done ? <Ionicons name="checkmark" size={12} color={glass.text.ink} /> : null}
        </View>
      </Pressable>

      <Pressable
        {...dragTouchProps}
        onPress={() => {
          if (hasContextTarget) openContext();
        }}
        disabled={!hasContextTarget && !dragEnabled}
        style={{ flex: 1, minWidth: 0 }}
        accessibilityRole={hasContextTarget ? "button" : "text"}
      >
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.sansRegular,
            fontSize: 12,
            lineHeight: 16,
            color: done ? glass.text.fg45 : glass.text.fg,
            textDecorationLine: done ? "line-through" : "none",
          }}
        >
          {task.title}
        </Text>
        {contextMeta ? (
          <Text
            style={{
              marginTop: 2,
              fontFamily: APP_FONT_FAMILIES.sansSemiBold,
              fontSize: 9,
              letterSpacing: ls(0.14, 9),
              textTransform: "uppercase",
              color: glass.text.fg55,
            }}
            numberOfLines={1}
          >
            {contextMeta}
          </Text>
        ) : null}
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        {dragEnabled && taskMove && dragMeta ? (
          <GlassDragHandle dragMeta={dragMeta} taskMove={taskMove} />
        ) : null}
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
          accessibilityLabel={t("workflowEditor.editAction")}
          accessibilityRole="button"
        >
          <Ionicons name="create-outline" size={16} color={glass.text.fg55} />
        </Pressable>
      </View>

      {task.blockedByCount ? (
        <GlassStatusChip tone="warning" label={t("planner.blocked", { defaultValue: "Blocked" })} />
      ) : task.overdue && !done ? (
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.sansBold,
            fontSize: 9,
            letterSpacing: ls(0.14, 9),
            textTransform: "uppercase",
            color: glass.text.danger,
          }}
        >
          {t("planner.overdue", { defaultValue: "Overdue" })}
        </Text>
      ) : dueToday && !done ? (
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.sansBold,
            fontSize: 9,
            letterSpacing: ls(0.14, 9),
            textTransform: "uppercase",
            color: glass.text.danger,
          }}
        >
          {t("planner.timeToday")}
        </Text>
      ) : task.dueDate ? (
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.sansSemiBold,
            fontSize: 9,
            letterSpacing: ls(0.14, 9),
            textTransform: "uppercase",
            color: glass.text.fg55,
          }}
        >
          {formatDateLabel(task.dueDate)}
        </Text>
      ) : null}
    </View>
  );

  if (dragEnabled && taskMove && dragMeta) {
    return (
      <GlassTaskDragShell
        taskId={task._id}
        dragMeta={dragMeta}
        taskMove={taskMove}
        depthMargin={rowDepth}
        dropIntoLabel={t("buildDetail.dropIntoLabel", { defaultValue: "Drop to nest inside" })}
      >
        {rowBody}
      </GlassTaskDragShell>
    );
  }

  return <View style={{ marginLeft: rowDepth }}>{rowBody}</View>;
}

/**
 * Glass-styled drop surface for a task row — registers the row as a measured
 * drag target exactly like `WorkflowTaskDragShell` (shared cream shell stays
 * on not-yet-converted screens); row long-press drag included.
 */
function GlassTaskDragShell({
  taskId,
  dragMeta,
  taskMove,
  depthMargin = 0,
  dropIntoLabel,
  children,
}: {
  taskId: Id<"workflowItems">;
  dragMeta: PlannerTaskDragMeta;
  taskMove: PlannerTaskMoveController;
  depthMargin?: number;
  dropIntoLabel?: string;
  children: ReactNode;
}) {
  const rowRef = useRef<View>(null);

  const { draggingTaskId, dragOverTaskId, dragOverZone } = taskMove.dragVisualState;

  const dragging = draggingTaskId === taskId;
  const dropBefore = dragOverTaskId === taskId && dragOverZone === "before";
  const dropAfter = dragOverTaskId === taskId && dragOverZone === "after";
  const dropInto = dragOverTaskId === taskId && dragOverZone === "into";
  const { registerRow, unregisterRow } = taskMove;

  useEffect(() => {
    registerRow(taskId, rowRef.current, dragMeta);
  }, [dragMeta, registerRow, taskId]);

  useEffect(() => {
    return () => unregisterRow(taskId);
  }, [taskId, unregisterRow]);

  return (
    <View
      ref={rowRef}
      collapsable={false}
      style={{ marginLeft: depthMargin, position: "relative" }}
    >
      <Pressable
        delayLongPress={220}
        onLongPress={(event) =>
          void taskMove.startDrag(dragMeta, {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          })
        }
        onTouchMove={(event) => {
          taskMove.updateDragPoint({
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          });
        }}
        onTouchEnd={(event) => {
          taskMove.finishDrag({
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          });
        }}
        onTouchCancel={() => {
          taskMove.finishDrag();
        }}
        style={[
          { position: "relative" },
          dropInto && {
            backgroundColor: glass.surface.active,
            borderRadius: 10,
          },
          dragging && { opacity: 0.55 },
        ]}
      >
        {dropBefore ? (
          <View
            style={{
              position: "absolute",
              left: 4,
              right: 4,
              top: 0,
              zIndex: 10,
              height: 2,
              borderRadius: 1,
              backgroundColor: glass.text.fg,
            }}
          />
        ) : null}
        {dropAfter ? (
          <View
            style={{
              position: "absolute",
              left: 4,
              right: 4,
              bottom: 0,
              zIndex: 10,
              height: 2,
              borderRadius: 1,
              backgroundColor: glass.text.fg,
            }}
          />
        ) : null}
        {children}
        {dropInto && dropIntoLabel ? (
          <Text
            style={{
              paddingBottom: 8,
              paddingHorizontal: 4,
              fontFamily: APP_FONT_FAMILIES.sansSemiBold,
              fontSize: 9,
              letterSpacing: ls(0.16, 9),
              textTransform: "uppercase",
              color: glass.text.fg55,
            }}
          >
            {dropIntoLabel}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

/**
 * Glass-styled root drop zone — same synchronous ref-callback registration as
 * `WorkflowTaskRootDropZone` (register on mount so the first drag's rAF
 * measurement pass sees it).
 */
function GlassRootDropZone({
  scopeKey,
  taskMove,
  label,
}: {
  scopeKey: string;
  taskMove: PlannerTaskMoveController;
  label: string;
}) {
  const zoneRef = useRef<View>(null);
  const { registerRootDropZone, unregisterRootDropZone } = taskMove;

  const setZoneRef = useCallback(
    (node: View | null) => {
      zoneRef.current = node;
      if (node) {
        registerRootDropZone(scopeKey, node);
      } else {
        unregisterRootDropZone(scopeKey);
      }
    },
    [registerRootDropZone, scopeKey, unregisterRootDropZone]
  );

  const activeScope = taskMove.dragMeta?.scopeKey;
  if (activeScope !== scopeKey || taskMove.dragMeta?.parentId == null) return null;

  const highlighted = taskMove.dragVisualState.dragOverRootScopeKey === scopeKey;

  return (
    <View
      ref={setZoneRef}
      collapsable={false}
      style={{
        marginTop: 8,
        marginBottom: 4,
        borderRadius: 10,
        borderWidth: borderWidth.hairline,
        borderColor: highlighted ? glass.text.fg : glass.border.strong,
        backgroundColor: highlighted ? glass.surface.preview : glass.surface.active,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <Text
        style={{
          textAlign: "center",
          fontFamily: APP_FONT_FAMILIES.sansBold,
          fontSize: 9,
          letterSpacing: ls(0.16, 9),
          textTransform: "uppercase",
          color: highlighted ? glass.text.fg : glass.text.fg55,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Glass drag grip — long-press starts the drag and the same Pressable keeps
 * the native touch responder for the whole gesture (mirrors the shared
 * `WorkflowTaskDragHandle`, which stays cream for not-yet-converted screens).
 */
function GlassDragHandle({
  dragMeta,
  taskMove,
}: {
  dragMeta: PlannerTaskDragMeta;
  taskMove: PlannerTaskMoveController;
}) {
  return (
    <Pressable
      delayLongPress={220}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Drag to reorder"
      onLongPress={(event) =>
        void taskMove.startDrag(dragMeta, {
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY,
        })
      }
      onTouchMove={(event) => {
        taskMove.updateDragPoint({
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY,
        });
      }}
      onTouchEnd={(event) => {
        taskMove.finishDrag({
          x: event.nativeEvent.pageX,
          y: event.nativeEvent.pageY,
        });
      }}
      onTouchCancel={() => {
        taskMove.finishDrag();
      }}
      style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name="reorder-three" size={18} color={glass.text.fg55} />
    </Pressable>
  );
}
