import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import {
  COSPLAY_CATEGORIES,
  COSPLAY_PRICING_MODES,
  ELEMENT_BUILD_STATUSES,
  ELEMENT_PURCHASE_STATUSES,
  MATERIAL_STATUSES,
  type CosplayNodeType,
  type CosplayPricingMode,
} from "@kyarafit/design-system/types";
import {
  WORKFLOW_STATUSES,
  formatCostSummary,
  formatNodeStatus,
  formatNodeTypeLabel,
  formatOverallBucket,
} from "@kyarafit/design-system/domain";
import type { DropZone, PlannerTaskDragMeta } from "@kyarafit/design-system/domain";
import { APP_HREF } from "@/lib/appRoutes";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { WorkflowTaskDragHandle } from "@/components/workflow/WorkflowTaskDragHandle";
import { WorkflowTaskDragShell } from "@/components/workflow/WorkflowTaskDragShell";
import { WorkflowTaskRootDropZone } from "@/components/workflow/WorkflowTaskRootDropZone";
import { usePlannerTaskMove } from "@/planner/usePlannerTaskMove";
import { applyWorkflowTreeDrop, promoteWorkflowTaskToRoot } from "@/workflow/applyWorkflowTreeDrop";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";
import { Button, DataBoundary, MetaLabel, SurfaceCard, TextField } from "@/ui";
import type { PlannerTaskMoveController } from "@/planner/usePlannerTaskMove";

type ParentRef = {
  _id: Id<"cosplayNodes">;
  name: string;
  nodeType: string;
  linkId: Id<"cosplayNodeLinks">;
};

type WorkflowTreeNode = {
  _id: Id<"workflowItems">;
  parentId?: Id<"workflowItems"> | null;
  ancestorIds?: Id<"workflowItems">[];
  sortOrder?: number;
  title: string;
  status: string;
  kind: string;
  dueDate?: string;
  progressPercent: number;
  children: WorkflowTreeNode[];
};

function flattenWorkflow(
  nodes: WorkflowTreeNode[],
  depth = 0
): (WorkflowTreeNode & { depth: number })[] {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenWorkflow(node.children, depth + 1),
  ]);
}

type FlatWorkflowRow = WorkflowTreeNode & { depth: number };

type ChildRow = Doc<"cosplayNodes"> & {
  linkId: Id<"cosplayNodeLinks">;
  linkMode: string;
  sortOrder: number;
  overallBucket: string;
  progressPercent: number;
  directCostCents: number;
  totalCostCents: number;
  childCount: number;
  hasIncompleteDescendants: boolean;
};

export type ElementDetailLoaded = {
  id: Id<"cosplayNodes">;
  userId: string;
  node: Doc<"cosplayNodes"> & {
    overallBucket: string;
    progressPercent: number;
    directCostCents: number;
    totalCostCents: number;
    childCount: number;
    hasIncompleteDescendants: boolean;
    children: ChildRow[];
    parents: ParentRef[];
  };
};

function dollarsFromCents(cents: number | undefined): string {
  if (cents == null || Number.isNaN(cents)) return "";
  return (cents / 100).toFixed(2).replace(/\.?0+$/, "") || "0";
}

function parseDollarsToCents(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number.parseFloat(trimmed.replace(",", "."));
  if (Number.isNaN(value)) return undefined;
  return Math.round(value * 100);
}

function formatActivityDate(ms: number | undefined) {
  if (!ms) return "Recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ms));
}

function prettyStatus(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "—";
}

type WorkbenchTab = "overview" | "parts" | "usage" | "tasks" | "activity";

export default function ElementDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const convertType = useMutation(api.cosplayNodes.convertType);
  const removeNode = useMutation(api.cosplayNodes.remove);
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const param = Array.isArray(raw) ? raw[0] : raw;
  const id = param ? (param as Id<"cosplayNodes">) : undefined;

  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const node = useQuery(api.cosplayNodes.get, id ? { id } : "skip");

  const loading = identity === undefined || (id != null && node === undefined);
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!id || !userId || node === null) status = "empty";
  else status = "ready";

  const data: ElementDetailLoaded | undefined =
    status === "ready" && node && userId && id
      ? { id, userId, node: node as ElementDetailLoaded["node"] }
      : undefined;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: node?.name ?? "",
      headerRight: () =>
        id ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(APP_HREF.elementEdit(id as string))}
            className="mr-3"
          >
            <Text className="text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
              {t("elements.editShort")}
            </Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, node?.name, id, router, t]);

  return (
    <DataBoundary<ElementDetailLoaded> status={status} data={data} error={error}>
      {(loaded) => (
        <ElementDetailBody
          loaded={loaded}
          onLinkBuild={() => router.push(APP_HREF.elementLinkBuild(loaded.id as string))}
          onConvert={async () => {
            try {
              await convertType({
                id: loaded.id,
                userId: loaded.userId,
                nodeType: loaded.node.nodeType === "element" ? "material" : "element",
              });
            } catch (error) {
              Alert.alert(
                t("common.errorTitle"),
                String(error instanceof Error ? error.message : error)
              );
            }
          }}
          onDelete={async () => {
            try {
              await removeNode({ id: loaded.id, userId: loaded.userId });
              router.replace(APP_HREF.elements);
            } catch (error) {
              Alert.alert(
                t("common.errorTitle"),
                String(error instanceof Error ? error.message : error)
              );
            }
          }}
          t={t}
        />
      )}
    </DataBoundary>
  );
}

function ElementDetailBody({
  loaded,
  onLinkBuild,
  onConvert,
  onDelete,
  t,
}: {
  loaded: ElementDetailLoaded;
  onLinkBuild: () => void;
  onConvert: () => Promise<void>;
  onDelete: () => Promise<void>;
  t: TFunction;
}) {
  const { colors } = useDesignTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const update = useMutation(api.cosplayNodes.update);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const removeChildLink = useMutation(api.cosplayNodes.removeChildLink);
  const reorderChildren = useMutation(api.cosplayNodes.reorderChildren);
  const removeNodeFromBuild = useMutation(api.builds.removeNodeFromBuild);
  const createWorkflowTask = useMutation(api.workflow.create);
  const updateWorkflowTask = useMutation(api.workflow.update);
  const deleteWorkflowTask = useMutation(api.workflow.remove);
  const moveWorkflowTask = useMutation(api.workflow.move);
  const moveAndResequenceWorkflowTask = useMutation(api.workflow.moveAndResequence);
  const router = useRouter();
  const { node, userId, id } = loaded;

  const [workflowScope, setWorkflowScope] = useState<"shared" | "outfit">("shared");
  const [selectedWorkflowBuildId, setSelectedWorkflowBuildId] = useState<Id<"builds"> | "">("");
  const [workflowTaskFilter, setWorkflowTaskFilter] = useState<"all" | "open" | "done">("all");
  const [newWorkflowLabel, setNewWorkflowLabel] = useState("");
  const [workflowStatusPickId, setWorkflowStatusPickId] = useState<Id<"workflowItems"> | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("overview");
  const [structureSearch, setStructureSearch] = useState("");
  const [usageSearch, setUsageSearch] = useState("");
  const [quickEditVisible, setQuickEditVisible] = useState(false);
  const [quickEditBusy, setQuickEditBusy] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTagsRaw, setEditTagsRaw] = useState("");
  const [editCategory, setEditCategory] = useState<string | undefined>(undefined);
  const [editPricingMode, setEditPricingMode] = useState<CosplayPricingMode>("total");
  const [editDirectDollars, setEditDirectDollars] = useState("");
  const [editUnitCostDollars, setEditUnitCostDollars] = useState("");
  const [editQuantityStr, setEditQuantityStr] = useState("");
  const [editUnitLabel, setEditUnitLabel] = useState("");
  const [pickedReferenceUri, setPickedReferenceUri] = useState<string | null>(null);

  const buildsUsingRaw = useQuery(api.builds.getBuildsUsingNode, { cosplayNodeId: id });
  const buildsUsing = useMemo(() => buildsUsingRaw ?? [], [buildsUsingRaw]);
  const nodeWorkflow = useQuery(api.workflow.listNodeWorkflow, {
    cosplayNodeId: id,
    buildId: selectedWorkflowBuildId ? (selectedWorkflowBuildId as Id<"builds">) : undefined,
  });

  useEffect(() => {
    if (
      workflowScope === "outfit" &&
      !selectedWorkflowBuildId &&
      buildsUsing.length === 1 &&
      buildsUsing[0]
    ) {
      setSelectedWorkflowBuildId(buildsUsing[0]._id);
    }
  }, [workflowScope, selectedWorkflowBuildId, buildsUsing]);

  const fullWorkflowFlat = useMemo(() => {
    if (nodeWorkflow == null) return [];
    const source =
      workflowScope === "shared" ? (nodeWorkflow.shared ?? []) : (nodeWorkflow.buildSpecific ?? []);
    return flattenWorkflow(source as WorkflowTreeNode[]);
  }, [nodeWorkflow, workflowScope]);

  const visibleWorkflowRows = useMemo(() => {
    return fullWorkflowFlat.filter((task) => {
      const isDone = task.status === "done";
      const matchesFilter =
        workflowTaskFilter === "all" || (workflowTaskFilter === "open" ? !isDone : isDone);
      return matchesFilter;
    });
  }, [fullWorkflowFlat, workflowTaskFilter]);

  const workflowFlatDropTasks = useMemo(
    () =>
      fullWorkflowFlat.map((r) => ({
        _id: r._id,
        parentId: r.parentId ?? null,
        sortOrder: r.sortOrder ?? 0,
      })),
    [fullWorkflowFlat]
  );

  const workflowSiblingIndexById = useMemo(() => {
    const m = new Map<string, number>();
    const byParent = new Map<string, typeof fullWorkflowFlat>();
    for (const r of fullWorkflowFlat) {
      const pid = r.parentId ?? "";
      const list = byParent.get(pid) ?? [];
      list.push(r);
      byParent.set(pid, list);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      list.forEach((n, i) => m.set(n._id as string, i));
    }
    return m;
  }, [fullWorkflowFlat]);

  const workflowDragScopeKey = useMemo(() => {
    if (workflowScope === "shared") return `wf:element:${id as string}:shared`;
    return `wf:element:${id as string}:build:${selectedWorkflowBuildId as string}`;
  }, [workflowScope, id, selectedWorkflowBuildId]);

  const applyElementWorkflowDrop = useCallback(
    async (dragged: PlannerTaskDragMeta, target: PlannerTaskDragMeta, zone: DropZone) => {
      await applyWorkflowTreeDrop(dragged, target, zone, workflowFlatDropTasks, {
        userId,
        moveTask: moveWorkflowTask,
        updateTask: updateWorkflowTask,
        moveAndResequence: moveAndResequenceWorkflowTask,
      });
    },
    [
      moveAndResequenceWorkflowTask,
      moveWorkflowTask,
      updateWorkflowTask,
      userId,
      workflowFlatDropTasks,
    ]
  );

  const promoteElementWorkflowTaskToRoot = useCallback(
    async (dragged: PlannerTaskDragMeta) => {
      await promoteWorkflowTaskToRoot(dragged, workflowFlatDropTasks, {
        userId,
        moveTask: moveWorkflowTask,
        updateTask: updateWorkflowTask,
        moveAndResequence: moveAndResequenceWorkflowTask,
      });
    },
    [
      moveAndResequenceWorkflowTask,
      moveWorkflowTask,
      updateWorkflowTask,
      userId,
      workflowFlatDropTasks,
    ]
  );

  const plannerWorkflowMove = usePlannerTaskMove({
    userId,
    onCommitDrop: applyElementWorkflowDrop,
    onCommitRootDrop: promoteElementWorkflowTaskToRoot,
    onError: (message) => Alert.alert(t("common.errorTitle"), message),
  });

  const workflowSummary = useMemo(() => {
    const source =
      workflowScope === "shared"
        ? (nodeWorkflow?.shared ?? [])
        : (nodeWorkflow?.buildSpecific ?? []);
    const flat = flattenWorkflow(source as WorkflowTreeNode[]);
    const done = flat.filter((r) => r.status === "done").length;
    return { total: flat.length, done };
  }, [nodeWorkflow?.buildSpecific, nodeWorkflow?.shared, workflowScope]);

  const statusLabel = useMemo(() => formatNodeStatus(node), [node]);
  const costLabel = useMemo(() => formatCostSummary(node), [node]);
  const convertLabel =
    node.nodeType === "element" ? t("elements.convertToMaterial") : t("elements.convertToElement");
  const progressPercent = Math.max(0, Math.min(100, node.progressPercent ?? 0));
  const openWorkflowCount = fullWorkflowFlat.filter((task) => task.status !== "done").length;
  const nextTask = fullWorkflowFlat.find((task) => task.status !== "done");

  const filteredChildren = useMemo(() => {
    const query = structureSearch.trim().toLowerCase();
    if (!query) return node.children;
    return node.children.filter((child) =>
      [child.name, child.category, child.nodeType, formatNodeStatus(child)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [node.children, structureSearch]);

  const filteredParents = useMemo(() => {
    const query = structureSearch.trim().toLowerCase();
    if (!query) return node.parents;
    return node.parents.filter((parent) =>
      [parent.name, parent.nodeType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [node.parents, structureSearch]);

  const filteredBuildsUsing = useMemo(() => {
    const query = usageSearch.trim().toLowerCase();
    if (!query) return buildsUsing;
    return buildsUsing.filter((build) =>
      [build.name, build.character]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [buildsUsing, usageSearch]);

  const activityItems = useMemo(
    () => [
      {
        title: t("elements.activityProgress", {
          defaultValue: "{{pct}}% progress tracked",
          pct: progressPercent,
        }),
        detail: statusLabel,
        date: t("elements.activityNow", { defaultValue: "Live" }),
      },
      {
        title:
          node.imageStorageId || node.imageUrl
            ? t("elements.activityReferenceReady", { defaultValue: "Reference image is set" })
            : t("elements.activityReferenceMissing", { defaultValue: "Reference image needed" }),
        detail: t("elements.activityReferenceDetail", {
          defaultValue: "Use this as the visual guide while planning parts and tasks.",
        }),
        date: t("elements.activityReference", { defaultValue: "Reference" }),
      },
      {
        title: t("elements.activityParts", {
          defaultValue: "{{count}} parts or materials linked",
          count: node.children.length,
        }),
        detail: node.hasIncompleteDescendants
          ? t("elements.activityPartsOpen", {
              defaultValue: "Some linked work still needs attention.",
            })
          : t("elements.activityPartsClear", {
              defaultValue: "No incomplete linked work flagged.",
            }),
        date: t("elements.workbenchParts", { defaultValue: "Parts" }),
      },
      {
        title: t("elements.activityUsage", {
          defaultValue: "Used in {{count}} outfits",
          count: buildsUsing.length,
        }),
        detail:
          buildsUsing.length > 0
            ? buildsUsing
                .map((build) => build.name)
                .slice(0, 3)
                .join(", ")
            : t("elements.linkBuildEmpty"),
        date: t("elements.workbenchUsedIn", { defaultValue: "Used in" }),
      },
      {
        title: t("elements.activityTasks", {
          defaultValue: "{{done}} of {{count}} tasks complete",
          done: workflowSummary.done,
          count: workflowSummary.total,
        }),
        detail: nextTask
          ? t("elements.activityNextTask", {
              defaultValue: "Next: {{task}}",
              task: nextTask.title,
            })
          : t("elements.activityNoNextTask", {
              defaultValue: "No open task in the selected view.",
            }),
        date: t("elements.workbenchTasks", { defaultValue: "Tasks" }),
      },
      {
        title: t("elements.activityCreated", { defaultValue: "Element record created" }),
        detail: node.category || formatNodeTypeLabel(node.nodeType as CosplayNodeType),
        date: formatActivityDate(node._creationTime),
      },
    ],
    [
      buildsUsing,
      nextTask,
      node._creationTime,
      node.category,
      node.children.length,
      node.hasIncompleteDescendants,
      node.imageStorageId,
      node.imageUrl,
      node.nodeType,
      progressPercent,
      statusLabel,
      t,
      workflowSummary.done,
      workflowSummary.total,
    ]
  );

  const applyUpdate = (patch: Parameters<typeof update>[0]) => {
    void update({ ...patch, id, userId });
  };

  const openQuickEdit = useCallback(() => {
    setEditName(node.name);
    setEditNotes(node.notes ?? "");
    setEditTagsRaw(node.tags?.length ? node.tags.join(", ") : "");
    setEditCategory(node.category ?? undefined);
    const mode = (node.pricingMode as CosplayPricingMode | undefined) ?? "total";
    setEditPricingMode(mode === "per_unit" ? "per_unit" : "total");
    setEditDirectDollars(dollarsFromCents(node.directCostCents));
    setEditUnitCostDollars(dollarsFromCents(node.unitCostCents));
    setEditQuantityStr(node.quantity != null ? String(node.quantity) : "");
    setEditUnitLabel(node.unit ?? "");
    setPickedReferenceUri(null);
    setQuickEditVisible(true);
  }, [
    node.category,
    node.directCostCents,
    node.name,
    node.notes,
    node.pricingMode,
    node.quantity,
    node.tags,
    node.unit,
    node.unitCostCents,
  ]);

  const pickReferenceImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedReferenceUri(result.assets[0].uri);
    }
  }, []);

  const saveQuickEdit = useCallback(async () => {
    const trimmedName = editName.trim();
    if (!trimmedName || quickEditBusy) return;
    setQuickEditBusy(true);
    try {
      let imageStorageId: Id<"_storage"> | undefined;
      if (pickedReferenceUri) {
        const uploadUrl = await generateUploadUrl();
        imageStorageId = await uploadUriToConvexStorage(pickedReferenceUri, uploadUrl);
      }

      const tags = editTagsRaw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const directCostCents =
        editPricingMode === "total" ? (parseDollarsToCents(editDirectDollars) ?? null) : null;
      const unitCostCents =
        editPricingMode === "per_unit" ? (parseDollarsToCents(editUnitCostDollars) ?? null) : null;
      const quantityParsed = editQuantityStr.trim()
        ? Number.parseFloat(editQuantityStr.replace(",", "."))
        : null;
      const quantity =
        editPricingMode === "per_unit" && quantityParsed != null && !Number.isNaN(quantityParsed)
          ? quantityParsed
          : null;

      await update({
        id,
        userId,
        name: trimmedName,
        notes: editNotes.trim() ? editNotes.trim() : null,
        tags,
        category: editCategory ?? null,
        pricingMode: editPricingMode,
        directCostCents,
        unitCostCents,
        quantity,
        unit: editPricingMode === "per_unit" && editUnitLabel.trim() ? editUnitLabel.trim() : null,
        ...(imageStorageId ? { imageStorageId } : {}),
      });
      setQuickEditVisible(false);
      setPickedReferenceUri(null);
    } catch (e) {
      Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
    } finally {
      setQuickEditBusy(false);
    }
  }, [
    editCategory,
    editDirectDollars,
    editName,
    editNotes,
    editPricingMode,
    editQuantityStr,
    editTagsRaw,
    editUnitCostDollars,
    editUnitLabel,
    generateUploadUrl,
    id,
    pickedReferenceUri,
    quickEditBusy,
    t,
    update,
    userId,
  ]);

  const openPurchaseSheet = () => {
    const buttons = ELEMENT_PURCHASE_STATUSES.map((s) => ({
      text: s.replace("_", " "),
      onPress: () =>
        applyUpdate({
          id,
          userId,
          purchaseStatus: s,
        }),
    }));
    Alert.alert(t("elements.sheetPurchase"), undefined, [
      ...buttons,
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const openBuildSheet = () => {
    const buttons = ELEMENT_BUILD_STATUSES.map((s) => ({
      text: s.replace("_", " "),
      onPress: () =>
        applyUpdate({
          id,
          userId,
          buildStatus: s,
        }),
    }));
    Alert.alert(t("elements.sheetBuild"), undefined, [
      ...buttons,
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const toggleWorkflowDone = useCallback(
    (taskId: Id<"workflowItems">, nextDone: boolean) => {
      void updateWorkflowTask({
        id: taskId,
        userId,
        status: nextDone ? "done" : "not_started",
      });
    },
    [updateWorkflowTask, userId]
  );

  const confirmRemoveWorkflowTask = useCallback(
    (taskId: Id<"workflowItems">, title: string) => {
      Alert.alert(t("elements.workflowRemoveTitle"), title, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("elements.workflowRemoveAction"),
          style: "destructive",
          onPress: () => {
            void deleteWorkflowTask({ id: taskId, userId });
          },
        },
      ]);
    },
    [deleteWorkflowTask, t, userId]
  );

  const handleAddWorkflowTask = useCallback(async () => {
    const label = newWorkflowLabel.trim();
    if (!label || !userId) return;
    if (workflowScope === "outfit" && buildsUsing.length > 0 && !selectedWorkflowBuildId) {
      Alert.alert(t("common.errorTitle"), t("elements.workflowPickOutfit"));
      return;
    }
    const isBuildSpecific = workflowScope === "outfit" && !!selectedWorkflowBuildId;
    try {
      await createWorkflowTask({
        userId,
        title: label,
        kind: "task",
        category: "craft",
        scopeKind: isBuildSpecific ? "build_specific" : "shared",
        attachments: isBuildSpecific
          ? [
              {
                entityType: "build",
                entityId: selectedWorkflowBuildId as Id<"builds">,
                role: "primary",
                buildContextId: selectedWorkflowBuildId as Id<"builds">,
              },
              {
                entityType: "cosplayNode",
                entityId: id,
                role: "progress_source",
                buildContextId: selectedWorkflowBuildId as Id<"builds">,
              },
            ]
          : [{ entityType: "cosplayNode", entityId: id, role: "primary" }],
      });
      setNewWorkflowLabel("");
    } catch (e) {
      Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
    }
  }, [
    buildsUsing.length,
    createWorkflowTask,
    id,
    newWorkflowLabel,
    selectedWorkflowBuildId,
    userId,
    workflowScope,
    t,
  ]);

  const confirmRemoveLink = useCallback(
    (linkId: Id<"cosplayNodeLinks">, label: string) => {
      Alert.alert(t("elements.unlinkConfirmTitle"), label, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("elements.unlinkConfirmAction"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await removeChildLink({ id: linkId, userId });
              } catch (e) {
                Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
              }
            })();
          },
        },
      ]);
    },
    [removeChildLink, t, userId]
  );

  const confirmUnlinkBuild = useCallback(
    (buildId: Id<"builds">, name: string) => {
      Alert.alert(t("elements.unlinkConfirmTitle"), name, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("elements.unlinkConfirmAction"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await removeNodeFromBuild({ userId, buildId, cosplayNodeId: id });
              } catch (e) {
                Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
              }
            })();
          },
        },
      ]);
    },
    [id, removeNodeFromBuild, t, userId]
  );

  const onDragEnd = useCallback(
    async ({ data }: { data: ChildRow[] }) => {
      try {
        await reorderChildren({
          parentNodeId: id,
          userId,
          orderedLinkIds: data.map((c) => c.linkId),
        });
      } catch (e) {
        Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
      }
    },
    [id, reorderChildren, userId, t]
  );

  const renderChild = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ChildRow>) => (
      <ScaleDecorator>
        <Pressable
          onPress={() => router.push(APP_HREF.element(item._id as string))}
          onLongPress={drag}
          delayLongPress={160}
          className={`px-4 py-3 ${isActive ? "opacity-75" : ""}`}
        >
          <View className="flex-row items-center gap-3">
            {item.imageStorageId || item.imageUrl ? (
              <ConvexStorageImage
                storageId={item.imageStorageId}
                imageUrl={item.imageUrl}
                className="h-16 w-16 rounded-2xl"
                accessibilityLabel={item.name}
              />
            ) : (
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-kyar-panel dark:bg-kyar-dark-panel">
                <Text className="text-2xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {item.nodeType === "material" ? "◇" : "◆"}
                </Text>
              </View>
            )}

            <View className="min-w-0 flex-1">
              <MetaLabel>
                {formatNodeTypeLabel(item.nodeType as CosplayNodeType)} ·{" "}
                {formatOverallBucket(item.overallBucket)}
              </MetaLabel>
              <Text
                className="mt-1 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text"
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
                numberOfLines={1}
              >
                {formatNodeStatus(item)}
              </Text>
            </View>

            <View className="items-end gap-2">
              <Ionicons name="reorder-three" size={18} color={colors.textTertiary} />
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  confirmRemoveLink(item.linkId, item.name);
                }}
                hitSlop={8}
                accessibilityLabel={t("elements.unlinkChild")}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        </Pressable>
      </ScaleDecorator>
    ),
    [colors.textSecondary, colors.textTertiary, confirmRemoveLink, router, t]
  );

  const statusPickCurrent =
    workflowStatusPickId && visibleWorkflowRows.find((r) => r._id === workflowStatusPickId)?.status;

  return (
    <>
      <ScrollView
        className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
        scrollEnabled={!plannerWorkflowMove.dragMeta}
        contentContainerStyle={{
          paddingHorizontal: isWide ? 32 : 16,
          paddingTop: isWide ? 24 : 14,
          paddingBottom: 56,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width: "100%", maxWidth: 1240, alignSelf: "center", gap: isWide ? 24 : 18 }}>
          <View style={{ flexDirection: isWide ? "row" : "column", gap: isWide ? 24 : 16 }}>
            <ReferencePanel
              node={node}
              progressPercent={progressPercent}
              onEdit={openQuickEdit}
              t={t}
              isWide={isWide}
            />

            <SurfaceCard className="flex-1 px-5 py-5">
              <View className="flex-row flex-wrap items-start justify-between gap-4">
                <View className="min-w-0 flex-1">
                  <MetaLabel>
                    {formatNodeTypeLabel(node.nodeType as CosplayNodeType)}
                    {node.category ? ` · ${node.category}` : ""}
                  </MetaLabel>
                  <Text className="mt-3 font-serif text-5xl italic leading-tight text-kyar-text dark:text-kyar-dark-text">
                    {node.name}
                  </Text>
                  <Text className="mt-3 text-base leading-7 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                    {node.notes ||
                      t("elements.workbenchNoNotes", {
                        defaultValue:
                          "Add notes, sourcing details, or construction reminders here.",
                      })}
                  </Text>
                </View>
                <Button
                  title={t("elements.workbenchEditDetails", { defaultValue: "Edit details" })}
                  variant="secondary"
                  onPress={openQuickEdit}
                />
              </View>

              <View className="mt-6">
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
                    {t("elements.progressPercent", { pct: progressPercent })}
                  </Text>
                  <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                    {formatOverallBucket(node.overallBucket)}
                  </Text>
                </View>
                <ProgressTrack value={progressPercent} className="mt-3" />
              </View>

              <View className="mt-6 flex-row flex-wrap gap-3">
                <SummaryMetric
                  label={t("elements.workbenchStatus", { defaultValue: "Status" })}
                  value={statusLabel}
                />
                <SummaryMetric
                  label={t("elements.workbenchCost", { defaultValue: "Cost" })}
                  value={costLabel}
                />
                <SummaryMetric
                  label={t("elements.workbenchParts", { defaultValue: "Parts" })}
                  value={String(node.childCount ?? 0)}
                />
                <SummaryMetric
                  label={t("elements.workbenchOpenTasks", { defaultValue: "Open tasks" })}
                  value={String(openWorkflowCount)}
                />
              </View>
            </SurfaceCard>
          </View>

          <SurfaceCard className="px-2 py-2">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {(
                  [
                    {
                      id: "overview",
                      label: t("elements.workbenchOverview", { defaultValue: "Overview" }),
                      count: undefined,
                    },
                    {
                      id: "parts",
                      label: isWide
                        ? t("elements.workbenchPartsMaterials", {
                            defaultValue: "Parts & materials",
                          })
                        : t("elements.workbenchParts", { defaultValue: "Parts" }),
                      count: node.parents.length + node.children.length,
                    },
                    {
                      id: "usage",
                      label: t("elements.workbenchUsedIn", { defaultValue: "Used in" }),
                      count: buildsUsing.length,
                    },
                    {
                      id: "tasks",
                      label: t("elements.workbenchTasks", { defaultValue: "Tasks" }),
                      count: workflowSummary.total,
                    },
                    {
                      id: "activity",
                      label: t("elements.workbenchActivity", { defaultValue: "Activity" }),
                      count: activityItems.length,
                    },
                  ] as { id: WorkbenchTab; label: string; count?: number }[]
                ).map((tab) => (
                  <WorkbenchTabButton
                    key={tab.id}
                    active={activeTab === tab.id}
                    label={tab.label}
                    count={tab.count}
                    onPress={() => setActiveTab(tab.id)}
                  />
                ))}
              </View>
            </ScrollView>
          </SurfaceCard>

          {activeTab === "overview" ? (
            <View style={{ flexDirection: isWide ? "row" : "column", gap: 16 }}>
              <WorkbenchSection
                className="flex-1"
                eyebrow={t("elements.workbenchOverview", { defaultValue: "Overview" })}
                title={t("elements.workbenchWhatToKnow", { defaultValue: "What to know now" })}
                action={
                  <Button
                    title={t("elements.workbenchEditDetails", { defaultValue: "Edit details" })}
                    variant="secondary"
                    onPress={openQuickEdit}
                  />
                }
              >
                <View className="gap-3">
                  <StatusRow
                    label={t("elements.workbenchNextTask", { defaultValue: "Next task" })}
                    value={
                      nextTask?.title ??
                      t("elements.workbenchNoOpenTasks", { defaultValue: "No open tasks yet" })
                    }
                    onPress={() => setActiveTab("tasks")}
                  />
                  <StatusRow
                    label={t("elements.workbenchWhereUsed", { defaultValue: "Where it is used" })}
                    value={t("elements.activityUsage", {
                      defaultValue: "Used in {{count}} outfits",
                      count: buildsUsing.length,
                    })}
                    onPress={() => setActiveTab("usage")}
                  />
                  <StatusRow
                    label={t("elements.workbenchMadeFrom", { defaultValue: "Made from" })}
                    value={t("elements.activityParts", {
                      defaultValue: "{{count}} parts or materials linked",
                      count: node.children.length,
                    })}
                    onPress={() => setActiveTab("parts")}
                  />
                </View>
              </WorkbenchSection>

              <WorkbenchSection
                className="flex-1"
                eyebrow={t("elements.adjustStatus")}
                title={t("elements.workbenchProgressControls", {
                  defaultValue: "Progress controls",
                })}
              >
                {node.nodeType === "element" ? (
                  <View className="gap-3">
                    <StatusRow
                      label={t("elements.statusPurchase")}
                      value={prettyStatus(node.purchaseStatus)}
                      onPress={openPurchaseSheet}
                    />
                    <StatusRow
                      label={t("elements.statusBuild")}
                      value={prettyStatus(node.buildStatus)}
                      onPress={openBuildSheet}
                    />
                  </View>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {MATERIAL_STATUSES.map((s) => (
                      <FilterPill
                        key={s}
                        active={node.materialStatus === s}
                        label={s.replace("_", " ")}
                        onPress={() =>
                          applyUpdate({
                            id,
                            userId,
                            materialStatus: s,
                          })
                        }
                      />
                    ))}
                  </View>
                )}
                <View className="mt-5 flex-row flex-wrap gap-3">
                  <Button
                    title={convertLabel}
                    variant="secondary"
                    onPress={() =>
                      Alert.alert(t("elements.convertTitle"), convertLabel, [
                        { text: t("common.cancel"), style: "cancel" },
                        {
                          text: t("elements.convertAction"),
                          onPress: () => {
                            void onConvert();
                          },
                        },
                      ])
                    }
                  />
                  <Button
                    title={t("elements.workbenchDeleteItem", { defaultValue: "Delete item" })}
                    variant="secondary"
                    onPress={() =>
                      Alert.alert(
                        t("elements.workbenchDeleteTitle", { defaultValue: "Delete this item?" }),
                        t("elements.workbenchDeleteBody", {
                          defaultValue:
                            "This removes the item and its links. Remove a link instead if you only want it detached from an outfit or parent.",
                        }),
                        [
                          { text: t("common.cancel"), style: "cancel" },
                          {
                            text: t("elements.workbenchDeleteAction", {
                              defaultValue: "Delete item",
                            }),
                            style: "destructive",
                            onPress: () => {
                              void onDelete();
                            },
                          },
                        ]
                      )
                    }
                  />
                </View>
              </WorkbenchSection>
            </View>
          ) : null}

          {activeTab === "parts" ? (
            <WorkbenchSection
              eyebrow={t("elements.workbenchPartsMaterials", {
                defaultValue: "Parts & materials",
              })}
              title={t("elements.workbenchMadeFromTitle", {
                defaultValue: "What this is made from",
              })}
              action={
                <View className="flex-row flex-wrap gap-2">
                  <Button
                    title={t("elements.workbenchAddPart", { defaultValue: "Add part" })}
                    variant="secondary"
                    onPress={() => router.push(APP_HREF.elementLinkChild(id as string))}
                  />
                  <Button
                    title={t("elements.workbenchAddParent", { defaultValue: "Add parent" })}
                    variant="secondary"
                    onPress={() => router.push(APP_HREF.elementLinkParent(id as string))}
                  />
                </View>
              }
            >
              <TextInput
                value={structureSearch}
                onChangeText={setStructureSearch}
                placeholder={t("elements.workbenchSearchParts", {
                  defaultValue: "Search parts, materials, or parent pieces...",
                })}
                placeholderTextColor={colors.textTertiary}
                className="mb-5 min-h-[46px] rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
              />

              {filteredParents.length > 0 ? (
                <View className="mb-6 gap-3">
                  <MetaLabel>
                    {t("elements.workbenchPartOf", { defaultValue: "This is part of" })}
                  </MetaLabel>
                  {filteredParents.map((p) => (
                    <HierarchyRow
                      key={p._id}
                      title={p.name}
                      subtitle={formatNodeTypeLabel(p.nodeType as CosplayNodeType)}
                      onPress={() => router.push(APP_HREF.element(p._id as string))}
                      onRemove={() => confirmRemoveLink(p.linkId, p.name)}
                    />
                  ))}
                </View>
              ) : null}

              <View>
                <MetaLabel>
                  {t("elements.workbenchMadeFrom", { defaultValue: "Made from" })}
                </MetaLabel>
                {node.children.length > 0 ? (
                  structureSearch.trim() ? (
                    <View className="mt-3 gap-3">
                      {filteredChildren.map((child) => (
                        <ChildListRow
                          key={child.linkId}
                          item={child}
                          colors={colors}
                          t={t}
                          onPress={() => router.push(APP_HREF.element(child._id as string))}
                          onRemove={() => confirmRemoveLink(child.linkId, child.name)}
                        />
                      ))}
                    </View>
                  ) : (
                    <>
                      <Text className="mt-2 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                        {t("elements.childrenDragHint")}
                      </Text>
                      <DraggableFlatList
                        className="mt-3"
                        data={node.children}
                        keyExtractor={(item) => item.linkId as string}
                        onDragEnd={onDragEnd}
                        renderItem={renderChild}
                        scrollEnabled={false}
                        ItemSeparatorComponent={() => (
                          <View className="mx-4 border-t border-kyar-borderSubtle dark:border-kyar-dark-borderSubtle" />
                        )}
                        style={{ flexGrow: 0 }}
                      />
                    </>
                  )
                ) : (
                  <Text className="mt-3 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                    {t("elements.linkChildSubtitle")}
                  </Text>
                )}
              </View>
            </WorkbenchSection>
          ) : null}

          {activeTab === "usage" ? (
            <WorkbenchSection
              eyebrow={t("elements.workbenchUsedIn", { defaultValue: "Used in" })}
              title={t("elements.workbenchWhereThisBelongs", {
                defaultValue: "Where this belongs",
              })}
              action={<Button title={t("elements.linkToOutfit")} onPress={onLinkBuild} />}
            >
              <TextInput
                value={usageSearch}
                onChangeText={setUsageSearch}
                placeholder={t("elements.workbenchSearchUsage", {
                  defaultValue: "Search linked outfits...",
                })}
                placeholderTextColor={colors.textTertiary}
                className="mb-5 min-h-[46px] rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
              />

              {buildsUsingRaw === undefined ? (
                <Text className="text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {t("elements.workflowLoading")}
                </Text>
              ) : buildsUsing.length === 0 ? (
                <Text className="text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {t("elements.linkBuildEmpty")}
                </Text>
              ) : filteredBuildsUsing.length === 0 ? (
                <Text className="text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {t("elements.emptySearch")}
                </Text>
              ) : (
                <View className="gap-3">
                  {filteredBuildsUsing.map((build) => (
                    <BuildUsageRow
                      key={build._id}
                      build={build}
                      colors={colors}
                      t={t}
                      onPress={() => router.push(APP_HREF.build(build._id as string))}
                      onRemove={() => confirmUnlinkBuild(build._id, build.name)}
                    />
                  ))}
                </View>
              )}
            </WorkbenchSection>
          ) : null}

          {activeTab === "tasks" ? (
            <WorkbenchSection
              eyebrow={t("elements.workbenchTasks", { defaultValue: "Tasks" })}
              title={t("elements.workbenchTaskList", { defaultValue: "Work to do" })}
            >
              <View className="flex-row rounded-full border border-kyar-borderSubtle bg-kyar-panel p-1 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel">
                <SegmentedPill
                  active={workflowScope === "shared"}
                  label={t("elements.workflowShared")}
                  onPress={() => setWorkflowScope("shared")}
                />
                <SegmentedPill
                  active={workflowScope === "outfit"}
                  label={t("elements.workflowOutfit")}
                  onPress={() => setWorkflowScope("outfit")}
                />
              </View>

              {workflowScope === "outfit" && buildsUsing.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mt-4"
                  contentContainerStyle={{ gap: 8 }}
                >
                  {buildsUsing.map((b) => {
                    const selected = selectedWorkflowBuildId === b._id;
                    return (
                      <FilterPill
                        key={b._id}
                        active={selected}
                        label={b.name}
                        onPress={() =>
                          setSelectedWorkflowBuildId(selected ? "" : (b._id as Id<"builds">))
                        }
                      />
                    );
                  })}
                </ScrollView>
              ) : null}

              {workflowScope === "outfit" && buildsUsing.length === 0 ? (
                <Text className="mt-4 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {t("elements.workflowNoOutfits")}
                </Text>
              ) : null}

              <View className="mt-4 flex-row flex-wrap gap-2">
                {(["all", "open", "done"] as const).map((f) => (
                  <FilterPill
                    key={f}
                    active={workflowTaskFilter === f}
                    label={
                      f === "all"
                        ? t("elements.workflowFilterAll")
                        : f === "open"
                          ? t("elements.workflowFilterOpen")
                          : t("elements.workflowFilterDone")
                    }
                    onPress={() => setWorkflowTaskFilter(f)}
                  />
                ))}
              </View>

              <Text className="mt-4 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("elements.workflowCount", {
                  count: workflowSummary.total,
                  done: workflowSummary.done,
                })}
              </Text>

              {workflowTaskFilter !== "all" ? (
                <Text className="mt-2 text-xs text-kyar-meta dark:text-kyar-dark-meta">
                  {t("elements.workflowDragRequiresAllFilter", {
                    defaultValue: "Switch to All to reorder tasks with drag and drop.",
                  })}
                </Text>
              ) : null}

              {nodeWorkflow === undefined ? (
                <Text className="mt-4 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {t("elements.workflowLoading")}
                </Text>
              ) : workflowScope === "outfit" &&
                buildsUsing.length > 0 &&
                !selectedWorkflowBuildId ? (
                <Text className="mt-4 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {t("elements.workflowPickOutfit")}
                </Text>
              ) : visibleWorkflowRows.length === 0 ? (
                <Text className="mt-4 text-sm text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {t("elements.workflowEmpty")}
                </Text>
              ) : (
                <View className="mt-4 gap-3">
                  {workflowTaskFilter === "all" ? (
                    <WorkflowTaskRootDropZone
                      scopeKey={workflowDragScopeKey}
                      taskMove={plannerWorkflowMove}
                      label={t("elements.workflowDropToTopLevel", {
                        defaultValue: "Drop here to make it a top-level task",
                      })}
                    />
                  ) : null}
                  {visibleWorkflowRows.map((task) => (
                    <ElementWorkflowTaskRow
                      key={task._id}
                      task={task}
                      dragEnabled={workflowTaskFilter === "all"}
                      workflowDragScopeKey={workflowDragScopeKey}
                      siblingIndexById={workflowSiblingIndexById}
                      taskMove={plannerWorkflowMove}
                      colors={colors}
                      t={t}
                      checked={task.status === "done"}
                      onToggle={() => toggleWorkflowDone(task._id, task.status !== "done")}
                      onOpenStatus={() => setWorkflowStatusPickId(task._id)}
                      onRemove={() => confirmRemoveWorkflowTask(task._id, task.title)}
                    />
                  ))}
                </View>
              )}

              <View className="mt-4 flex-row items-end gap-2">
                <TextInput
                  value={newWorkflowLabel}
                  onChangeText={setNewWorkflowLabel}
                  placeholder={
                    workflowScope === "outfit"
                      ? t("elements.workflowAddPlaceholderOutfit")
                      : t("elements.workflowAddPlaceholderShared")
                  }
                  placeholderTextColor={colors.textTertiary}
                  className="min-h-[46px] flex-1 rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
                  editable={
                    !!userId &&
                    !(
                      workflowScope === "outfit" &&
                      buildsUsing.length > 0 &&
                      !selectedWorkflowBuildId
                    )
                  }
                  onSubmitEditing={() => void handleAddWorkflowTask()}
                />
                <Button
                  title={t("elements.workflowAdd")}
                  onPress={() => void handleAddWorkflowTask()}
                  disabled={
                    !userId ||
                    !newWorkflowLabel.trim() ||
                    (workflowScope === "outfit" &&
                      buildsUsing.length > 0 &&
                      !selectedWorkflowBuildId)
                  }
                />
              </View>
            </WorkbenchSection>
          ) : null}

          {activeTab === "activity" ? (
            <WorkbenchSection
              eyebrow={t("elements.workbenchActivity", { defaultValue: "Activity" })}
              title={t("elements.workbenchTrackingLog", { defaultValue: "Active tracking log" })}
            >
              <ActivityLog items={activityItems} />
            </WorkbenchSection>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={quickEditVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickEditVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setQuickEditVisible(false)}
        >
          <Pressable
            className="max-h-[92%] rounded-t-3xl border border-kyar-borderSubtle bg-kyar-surface px-4 pb-8 pt-4 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-4 flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1">
                <MetaLabel>
                  {t("elements.workbenchEditDetails", { defaultValue: "Edit details" })}
                </MetaLabel>
                <Text className="mt-1 font-serif text-3xl italic text-kyar-text dark:text-kyar-dark-text">
                  {node.name}
                </Text>
              </View>
              <Pressable
                onPress={() => setQuickEditVisible(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t("common.cancel")}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <SurfaceCard className="overflow-hidden">
                {pickedReferenceUri ? (
                  <Image
                    source={{ uri: pickedReferenceUri }}
                    className="h-64 w-full"
                    resizeMode="cover"
                  />
                ) : node.imageStorageId || node.imageUrl ? (
                  <ConvexStorageImage
                    storageId={node.imageStorageId}
                    imageUrl={node.imageUrl}
                    className="h-64 w-full"
                    accessibilityLabel={node.name}
                  />
                ) : (
                  <View className="h-56 items-center justify-center bg-kyar-panel dark:bg-kyar-dark-panel">
                    <Text className="text-5xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                      {node.nodeType === "material" ? "◇" : "◆"}
                    </Text>
                  </View>
                )}
                <View className="px-4 py-4">
                  <Button
                    title={t("elements.heroPick")}
                    variant="secondary"
                    onPress={() => void pickReferenceImage()}
                  />
                </View>
              </SurfaceCard>

              <SurfaceCard className="mt-4 px-4 py-4">
                <TextField
                  label={t("elements.nameLabel")}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t("elements.namePlaceholder")}
                  autoCapitalize="sentences"
                />

                <Text className="mt-5 text-sm font-medium text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("elements.notesLabel")}
                </Text>
                <TextInput
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder={t("elements.notesPlaceholder")}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  textAlignVertical="top"
                  className="mt-3 min-h-[112px] rounded-2xl border border-kyar-border bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-border dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
                />

                <TextField
                  className="mt-3"
                  label={t("elements.tagsLabel")}
                  value={editTagsRaw}
                  onChangeText={setEditTagsRaw}
                  placeholder={t("elements.tagsPlaceholder")}
                  autoCapitalize="none"
                />
              </SurfaceCard>

              <SurfaceCard className="mt-4 px-4 py-4">
                <MetaLabel>{t("elements.categoryLabel")}</MetaLabel>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
                  <View className="flex-row gap-2">
                    <FilterPill
                      active={editCategory === undefined}
                      label={t("elements.filterAll")}
                      onPress={() => setEditCategory(undefined)}
                    />
                    {COSPLAY_CATEGORIES.map((value) => (
                      <FilterPill
                        key={value}
                        active={editCategory === value}
                        label={value}
                        onPress={() => setEditCategory(value)}
                      />
                    ))}
                  </View>
                </ScrollView>
              </SurfaceCard>

              <SurfaceCard className="mt-4 px-4 py-4">
                <MetaLabel>{t("elements.pricingSection")}</MetaLabel>
                <View className="mt-4 flex-row rounded-full border border-kyar-borderSubtle bg-kyar-panel p-1 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel">
                  {COSPLAY_PRICING_MODES.map((mode) => (
                    <SegmentedPill
                      key={mode}
                      active={editPricingMode === mode}
                      label={
                        mode === "total" ? t("elements.pricingTotal") : t("elements.pricingPerUnit")
                      }
                      onPress={() => setEditPricingMode(mode)}
                    />
                  ))}
                </View>

                {editPricingMode === "total" ? (
                  <TextField
                    className="mt-4"
                    label={t("elements.directCostLabel")}
                    value={editDirectDollars}
                    onChangeText={setEditDirectDollars}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                ) : (
                  <>
                    <TextField
                      className="mt-4"
                      label={t("elements.unitCostLabel")}
                      value={editUnitCostDollars}
                      onChangeText={setEditUnitCostDollars}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                    />
                    <TextField
                      className="mt-4"
                      label={t("elements.quantityLabel")}
                      value={editQuantityStr}
                      onChangeText={setEditQuantityStr}
                      placeholder="1"
                      keyboardType="decimal-pad"
                    />
                    <TextField
                      className="mt-4"
                      label={t("elements.unitLabel")}
                      value={editUnitLabel}
                      onChangeText={setEditUnitLabel}
                      placeholder={t("elements.unitPlaceholder")}
                      autoCapitalize="none"
                    />
                  </>
                )}
              </SurfaceCard>
            </ScrollView>

            <View className="mt-4 flex-row gap-3">
              <Button
                title={t("common.cancel")}
                variant="secondary"
                onPress={() => setQuickEditVisible(false)}
                className="flex-1"
              />
              <Button
                title={quickEditBusy ? t("elements.saving") : t("common.save")}
                onPress={() => void saveQuickEdit()}
                loading={quickEditBusy}
                disabled={!editName.trim()}
                className="flex-1"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={workflowStatusPickId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setWorkflowStatusPickId(null)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setWorkflowStatusPickId(null)}
        >
          <Pressable
            className="max-h-[70%] rounded-t-3xl border border-kyar-borderSubtle bg-kyar-surface px-4 pb-8 pt-4 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="mb-3 text-center text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
              {t("elements.workflowStatus")}
            </Text>
            <ScrollView>
              {WORKFLOW_STATUSES.map((st) => (
                <Pressable
                  key={st}
                  onPress={() => {
                    if (workflowStatusPickId) {
                      void updateWorkflowTask({
                        id: workflowStatusPickId,
                        userId,
                        status: st,
                      });
                    }
                    setWorkflowStatusPickId(null);
                  }}
                  className={`border-b border-kyar-borderSubtle py-3 dark:border-kyar-dark-borderSubtle ${
                    statusPickCurrent === st ? "bg-kyar-panel dark:bg-kyar-dark-panel" : ""
                  }`}
                >
                  <Text className="text-base text-kyar-text dark:text-kyar-dark-text">
                    {st.replace(/_/g, " ")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button
              title={t("common.cancel")}
              variant="secondary"
              onPress={() => setWorkflowStatusPickId(null)}
              className="mt-4"
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ReferencePanel({
  node,
  progressPercent,
  onEdit,
  t,
  isWide,
}: {
  node: ElementDetailLoaded["node"];
  progressPercent: number;
  onEdit: () => void;
  t: TFunction;
  isWide: boolean;
}) {
  return (
    <View style={isWide ? { width: 380 } : undefined}>
      <SurfaceCard className="overflow-hidden">
        <View className={isWide ? "h-[460px] w-full" : "h-80 w-full"}>
          {node.imageStorageId || node.imageUrl ? (
            <ConvexStorageImage
              storageId={node.imageStorageId}
              imageUrl={node.imageUrl}
              className="h-full w-full"
              accessibilityLabel={node.name}
            />
          ) : (
            <View className="h-full w-full items-center justify-center bg-kyar-panel dark:bg-kyar-dark-panel">
              <Text className="text-6xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                {node.nodeType === "material" ? "◇" : "◆"}
              </Text>
            </View>
          )}
        </View>
        <View className="px-5 py-5">
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <MetaLabel>{t("elements.heroLabel", { defaultValue: "Reference" })}</MetaLabel>
              <Text className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("elements.workbenchReferenceHelp", {
                  defaultValue: "The visual guide for this element.",
                })}
              </Text>
            </View>
            <Button
              title={t("elements.workbenchEditImage", { defaultValue: "Edit image" })}
              variant="secondary"
              onPress={onEdit}
            />
          </View>
          <ProgressTrack value={progressPercent} className="mt-4" />
        </View>
      </SurfaceCard>
    </View>
  );
}

function WorkbenchSection({
  eyebrow,
  title,
  action,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <SurfaceCard className={["px-5 py-5", className].filter(Boolean).join(" ")}>
      <View>
        {eyebrow ? <MetaLabel>{eyebrow}</MetaLabel> : null}
        <Text
          className="mt-2 max-w-[320px] font-serif text-3xl italic leading-tight text-kyar-text dark:text-kyar-dark-text"
          numberOfLines={3}
        >
          {title}
        </Text>
        {action ? <View className="mt-4 flex-row flex-wrap gap-2">{action}</View> : null}
      </View>
      <View className="mt-5">{children}</View>
    </SurfaceCard>
  );
}

function WorkbenchTabButton({
  active,
  label,
  count,
  onPress,
}: {
  active: boolean;
  label: string;
  count?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-[44px] flex-row items-center gap-2 rounded-2xl px-3 py-2 ${
        active ? "bg-kyar-text dark:bg-kyar-dark-text" : "bg-transparent"
      }`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text
        className={`text-sm font-semibold ${
          active ? "text-kyar-bg dark:text-kyar-dark-bg" : "text-kyar-text dark:text-kyar-dark-text"
        }`}
      >
        {label}
      </Text>
      {count != null ? (
        <Text
          className={`text-xs ${
            active
              ? "text-kyar-bg/80 dark:text-kyar-dark-bg/80"
              : "text-kyar-textTertiary dark:text-kyar-dark-textTertiary"
          }`}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

function ProgressTrack({ value, className }: { value: number; className?: string }) {
  return (
    <View
      className={[
        "h-2 overflow-hidden rounded-full bg-kyar-muted dark:bg-kyar-dark-muted",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <View
        className="h-full rounded-full bg-kyar-text dark:bg-kyar-dark-text"
        style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
      />
    </View>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[132px] flex-1 rounded-2xl bg-kyar-panel px-4 py-4 dark:bg-kyar-dark-panel">
      <MetaLabel>{label}</MetaLabel>
      <Text className="mt-2 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
        {value}
      </Text>
    </View>
  );
}

function ChildListRow({
  item,
  colors,
  t,
  onPress,
  onRemove,
}: {
  item: ChildRow;
  colors: { textSecondary: string; textTertiary: string };
  t: TFunction;
  onPress: () => void;
  onRemove: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 active:opacity-80 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
    >
      <View className="flex-row items-center gap-3">
        {item.imageStorageId || item.imageUrl ? (
          <ConvexStorageImage
            storageId={item.imageStorageId}
            imageUrl={item.imageUrl}
            className="h-14 w-14 rounded-2xl"
            accessibilityLabel={item.name}
          />
        ) : (
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-kyar-surface dark:bg-kyar-dark-surface">
            <Text className="text-xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
              {item.nodeType === "material" ? "◇" : "◆"}
            </Text>
          </View>
        )}

        <View className="min-w-0 flex-1">
          <MetaLabel>
            {formatNodeTypeLabel(item.nodeType as CosplayNodeType)} ·{" "}
            {formatOverallBucket(item.overallBucket)}
          </MetaLabel>
          <Text
            className="mt-1 text-base font-semibold text-kyar-text dark:text-kyar-dark-text"
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
            numberOfLines={1}
          >
            {formatNodeStatus(item)}
          </Text>
        </View>

        <View className="items-end gap-2">
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            hitSlop={8}
            accessibilityLabel={t("elements.unlinkChild")}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

type BuildUsage = {
  _id: Id<"builds">;
  name: string;
  character?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  imageUrl?: string | null;
};

function BuildUsageRow({
  build,
  colors,
  t,
  onPress,
  onRemove,
}: {
  build: BuildUsage;
  colors: { textSecondary: string; textTertiary: string };
  t: TFunction;
  onPress: () => void;
  onRemove: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-4 active:opacity-80 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
    >
      <View className="flex-row items-center gap-3">
        {build.imageStorageId || build.imageUrl ? (
          <ConvexStorageImage
            storageId={build.imageStorageId}
            imageUrl={build.imageUrl}
            className="h-14 w-14 rounded-2xl"
            accessibilityLabel={build.name}
          />
        ) : (
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-kyar-surface dark:bg-kyar-dark-surface">
            <Ionicons name="shirt-outline" size={22} color={colors.textTertiary} />
          </View>
        )}
        <View className="min-w-0 flex-1">
          <MetaLabel>{build.character || t("common.builds")}</MetaLabel>
          <Text
            className="mt-1 text-base font-semibold text-kyar-text dark:text-kyar-dark-text"
            numberOfLines={1}
          >
            {build.name}
          </Text>
          <Text className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("elements.workbenchSharedUse", {
              defaultValue: "Changes here can be reused across this linked outfit.",
            })}
          </Text>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          hitSlop={8}
          accessibilityLabel={t("elements.unlinkConfirmAction")}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function ActivityLog({ items }: { items: { title: string; detail: string; date: string }[] }) {
  return (
    <View className="gap-3">
      {items.map((item, index) => (
        <View
          key={`${item.title}-${index}`}
          className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-4 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
        >
          <View className="flex-row gap-3">
            <View className="mt-1 h-2.5 w-2.5 rounded-full bg-kyar-text dark:bg-kyar-dark-text" />
            <View className="min-w-0 flex-1">
              <View className="flex-row flex-wrap items-baseline justify-between gap-2">
                <Text className="text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
                  {item.title}
                </Text>
                <Text className="text-xs uppercase tracking-meta text-kyar-meta dark:text-kyar-dark-meta">
                  {item.date}
                </Text>
              </View>
              <Text className="mt-1 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {item.detail}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function ElementWorkflowTaskRow({
  task,
  dragEnabled,
  workflowDragScopeKey,
  siblingIndexById,
  taskMove,
  colors,
  t,
  checked,
  onToggle,
  onOpenStatus,
  onRemove,
}: {
  task: FlatWorkflowRow;
  dragEnabled: boolean;
  workflowDragScopeKey: string;
  siblingIndexById: Map<string, number>;
  taskMove: PlannerTaskMoveController;
  colors: { textSecondary: string };
  t: TFunction;
  checked: boolean;
  onToggle: () => void;
  onOpenStatus: () => void;
  onRemove: () => void;
}) {
  const dragMeta = useMemo<PlannerTaskDragMeta>(
    () => ({
      taskId: task._id as string,
      scopeKey: workflowDragScopeKey,
      parentId: task.parentId ? (task.parentId as string) : undefined,
      siblingIndex: siblingIndexById.get(task._id as string) ?? 0,
      ancestorIds: (task.ancestorIds ?? []).map((a) => a as string),
    }),
    [siblingIndexById, task, workflowDragScopeKey]
  );

  const body: ReactNode = (
    <View className="px-3 py-3">
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={onToggle}
          className="h-9 w-9 items-center justify-center rounded-full border border-kyar-border dark:border-kyar-dark-border"
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
        >
          <Text className="text-sm text-kyar-text dark:text-kyar-dark-text">
            {checked ? "✓" : ""}
          </Text>
        </Pressable>

        <Pressable
          onPress={onOpenStatus}
          className="min-w-0 flex-1 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={task.title}
        >
          <Text
            className={`text-base ${
              checked
                ? "text-kyar-textTertiary line-through dark:text-kyar-dark-textTertiary"
                : "text-kyar-text dark:text-kyar-dark-text"
            }`}
          >
            {task.title}
          </Text>
          <Text className="mt-1 text-xs uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
            {task.kind} · {task.status.replace(/_/g, " ")} · {task.progressPercent}%
          </Text>
        </Pressable>

        {dragEnabled ? (
          <WorkflowTaskDragHandle taskId={task._id} dragMeta={dragMeta} taskMove={taskMove} />
        ) : null}
        <Pressable
          onPress={onOpenStatus}
          hitSlop={8}
          accessibilityLabel={t("elements.workflowStatus")}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityLabel={t("elements.workflowRemoveAction")}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  if (!dragEnabled) {
    return (
      <View style={{ marginLeft: task.depth * 12 }}>
        <View className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel">
          {body}
        </View>
      </View>
    );
  }

  return (
    <WorkflowTaskDragShell
      taskId={task._id}
      dragMeta={dragMeta}
      taskMove={taskMove}
      depthMargin={task.depth * 12}
      dropIntoLabel={t("buildDetail.dropIntoLabel")}
      rowLongPressDrag
    >
      {body}
    </WorkflowTaskDragShell>
  );
}

function StatusRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { colors } = useDesignTheme();

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-4 active:opacity-80 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <MetaLabel>{label}</MetaLabel>
          <Text className="mt-1 text-base font-medium text-kyar-text dark:text-kyar-dark-text">
            {value}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
    </Pressable>
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

function FilterPill({
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

function HierarchyRow({
  title,
  subtitle,
  onPress,
  onRemove,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { colors } = useDesignTheme();

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-4 active:opacity-80 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
            {title}
          </Text>
          <Text className="mt-1 text-xs uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
            {subtitle}
          </Text>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          hitSlop={8}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Pressable>
  );
}
