import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { FocalCoverImage } from "@/components/FocalCoverImage";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { FloatingCreateMenu, MetaLabel, SurfaceCard } from "@/ui";
import { ElementPortfolioCard } from "@/components/elements/ElementPortfolioCard";
import { ExplorerBranch, type ExplorerPathSegment } from "./ExplorerBranch";
import { HeroFocalModal } from "./HeroFocalModal";
import { BuildWorkflowTasks } from "./BuildWorkflowTasks";
import { NodeDetailSheet, type NodeDetailSheetRef } from "./NodeDetailSheet";
import { useNodeInspector, type NodeSelectionMeta } from "./useNodeInspector";
import { useExplorerMove } from "./useExplorerMove";

type BuildRow = Doc<"builds"> & {
  tasksTotal: number;
  tasksChecked: number;
  progress: number;
  workflowProgressPercent: number;
};

type OutlineNode = {
  _id: Id<"cosplayNodes">;
  name: string;
  depth: number;
  isRoot: boolean;
  progressPercent: number;
  nodeType?: string;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  childCount?: number;
};

type CollaboratorRow = {
  userId: string;
  role: string;
  email: string | null;
  name: string | null;
  username: string | null;
};

type TabId = "summary" | "explorer" | "tasks" | "board";
type BoardView = "all" | "references" | "progress" | "nodes";

type Props = {
  buildId: Id<"builds">;
  userId: string;
  build: BuildRow;
  heroUri: string | null;
  summary:
    | {
        progressPercent: number;
        tasksChecked: number;
        tasksTotal: number;
        linkedItemCount: number;
        linkedItemsCompleteCount: number;
        remainingDays: number | null;
        budgetDifferenceCents: number | null;
      }
    | null
    | undefined;
  outlineNodes: OutlineNode[] | undefined;
  refImages: Doc<"buildReferenceImages">[] | undefined;
  processPics: Doc<"buildProcessPictures">[] | undefined;
  collaborators?: CollaboratorRow[];
  onDuplicate?: () => void;
  onDelete?: () => void;
};

export function BuildDetailBody(props: Props) {
  const { t } = useTranslation();
  const { colors } = useDesignTheme();
  const router = useRouter();
  const {
    buildId,
    userId,
    build,
    heroUri,
    summary,
    outlineNodes,
    refImages,
    processPics,
    collaborators,
    onDuplicate,
    onDelete,
  } = props;

  const [tab, setTab] = useState<TabId>("summary");
  const [boardView, setBoardView] = useState<BoardView>("all");
  const [focalOpen, setFocalOpen] = useState(false);
  const [rootOrderIds, setRootOrderIds] = useState<Id<"cosplayNodes">[]>([]);
  const [explorerSearch, setExplorerSearch] = useState("");
  const [selectedPath, setSelectedPath] = useState<ExplorerPathSegment[]>([]);
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [rootFrame, setRootFrame] = useState({ x: 0, y: 0 });
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState("");
  const [quickCreateType, setQuickCreateType] = useState<"element" | "material">("element");
  const [quickCreateParentId, setQuickCreateParentId] = useState<Id<"cosplayNodes"> | null>(null);
  const [quickCreateBusy, setQuickCreateBusy] = useState(false);

  const detailSheetRef = useRef<NodeDetailSheetRef>(null);
  const rootViewRef = useRef<View>(null);
  const inspector = useNodeInspector({ buildId, userId });

  const openNodeSheet = useCallback(
    (meta: NodeSelectionMeta, path: ExplorerPathSegment[]) => {
      setSelectedPath(path);
      void inspector.commitSelection(meta);
      detailSheetRef.current?.present();
    },
    [inspector]
  );

  const handleSheetDismiss = useCallback(() => {
    void inspector.commitSelection(null);
  }, [inspector]);

  const handleSheetUnlink = useCallback(async () => {
    await inspector.unlinkSelected();
    detailSheetRef.current?.dismiss();
  }, [inspector]);

  const isOwner = build.userId === userId;

  const updateBuild = useMutation(api.builds.update);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const addRef = useMutation(api.buildReferenceImages.add);
  const removeRef = useMutation(api.buildReferenceImages.remove);
  const addProcess = useMutation(api.buildProcessPictures.add);
  const removeProcess = useMutation(api.buildProcessPictures.remove);
  const createNode = useMutation(api.cosplayNodes.create);
  const addNodesToBuild = useMutation(api.builds.addNodesToBuild);
  const addChildLink = useMutation(api.cosplayNodes.addChildLink);

  const roots = useMemo(() => (outlineNodes ?? []).filter((node) => node.isRoot), [outlineNodes]);
  const boardRootElements = useMemo(
    () => (outlineNodes ?? []).filter((node) => node.nodeType === "element" && node.isRoot),
    [outlineNodes]
  );
  const boardElements = useMemo(
    () => (outlineNodes ?? []).filter((node) => node.nodeType === "element"),
    [outlineNodes]
  );

  const boardItemsAll = useMemo(() => {
    const items: (
      | {
          key: string;
          type: "reference";
          sortKey: number;
          imageStorageId?: Id<"_storage"> | null;
          imageUrl?: string | null;
        }
      | {
          key: string;
          type: "progress";
          sortKey: number;
          imageStorageId?: Id<"_storage"> | null;
          imageUrl?: string | null;
          dayLabel: string;
        }
      | {
          key: string;
          type: "node";
          sortKey: number;
          node: OutlineNode;
        }
    )[] = [];
    (refImages ?? []).forEach((r) =>
      items.push({
        key: `ref-${r._id}`,
        type: "reference",
        sortKey: r._creationTime,
        imageStorageId: r.imageStorageId,
        imageUrl: r.imageUrl,
      })
    );
    const oldestProgress = processPics?.[processPics.length - 1]?._creationTime ?? Date.now();
    (processPics ?? []).forEach((p) =>
      items.push({
        key: `progress-${p._id}`,
        type: "progress",
        sortKey: p._creationTime,
        imageStorageId: p.imageStorageId,
        imageUrl: p.imageUrl,
        dayLabel: `Day ${Math.ceil((p._creationTime - oldestProgress) / (1000 * 60 * 60 * 24)) + 1}`,
      })
    );
    boardRootElements.forEach((node, index) =>
      items.push({
        key: `node-${node._id}`,
        type: "node",
        sortKey: Date.now() - index,
        node,
      })
    );
    return items.sort((a, b) => b.sortKey - a.sortKey);
  }, [boardRootElements, processPics, refImages]);

  const boardItemsReferences = useMemo(
    () => boardItemsAll.filter((item) => item.type === "reference"),
    [boardItemsAll]
  );
  const boardItemsProgress = useMemo(
    () => boardItemsAll.filter((item) => item.type === "progress"),
    [boardItemsAll]
  );
  const boardItemsNodes = useMemo(
    () =>
      boardElements.map((node, index) => ({
        key: `node-${node._id}`,
        type: "node" as const,
        sortKey: boardElements.length - index,
        node,
      })),
    [boardElements]
  );

  const boardVisibleItems = useMemo(() => {
    if (boardView === "references") return boardItemsReferences;
    if (boardView === "progress") return boardItemsProgress;
    if (boardView === "nodes") return boardItemsNodes;
    return boardItemsAll;
  }, [boardItemsAll, boardItemsNodes, boardItemsProgress, boardItemsReferences, boardView]);

  const boardColumns = useMemo(() => {
    const left: typeof boardVisibleItems = [];
    const right: typeof boardVisibleItems = [];
    boardVisibleItems.forEach((item, index) => {
      if (index % 2 === 0) left.push(item);
      else right.push(item);
    });
    return [left, right] as const;
  }, [boardVisibleItems]);

  const rootsMembershipSig = useMemo(
    () => [...roots.map((root) => root._id as string)].sort().join("|"),
    [roots]
  );

  useEffect(() => {
    setRootOrderIds(roots.map((root) => root._id));
  }, [rootsMembershipSig, roots]);

  const rootMap = useMemo(() => {
    const next = new Map<string, OutlineNode>();
    for (const root of roots) {
      next.set(root._id as string, root);
    }
    return next;
  }, [roots]);

  const orderedRoots = useMemo(() => {
    if (rootOrderIds.length === 0) return roots;
    return rootOrderIds.map((id) => rootMap.get(id as string)).filter(Boolean) as OutlineNode[];
  }, [rootMap, rootOrderIds, roots]);
  const sectionItems = useMemo(
    () =>
      [
        { id: "summary", label: t("buildDetail.tabSummary") },
        { id: "explorer", label: t("buildDetail.tabExplorer") },
        { id: "tasks", label: t("buildDetail.tabTasks") },
        { id: "board", label: t("buildDetail.tabBoard") },
      ] as { id: TabId; label: string }[],
    [t]
  );
  const activeSection = sectionItems.find((item) => item.id === tab) ?? sectionItems[0];

  const explorerMove = useExplorerMove({
    buildId,
    userId,
    rootOrderIds,
    setRootOrderIds,
    onError: (message) => Alert.alert(t("common.errorTitle"), message),
  });

  const pickAndUpload = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("buildDetail.needPhotoAccess"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const url = await generateUploadUrl();
    const storageId = await uploadUriToConvexStorage(
      asset.uri,
      url,
      asset.mimeType ?? "image/jpeg"
    );
    return storageId;
  }, [generateUploadUrl, t]);

  const onAddReference = useCallback(async () => {
    try {
      const storageId = await pickAndUpload();
      if (!storageId) return;
      await addRef({ buildId, userId, imageStorageId: storageId });
    } catch (e) {
      Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
    }
  }, [addRef, buildId, pickAndUpload, t, userId]);

  const onAddProcess = useCallback(async () => {
    try {
      const storageId = await pickAndUpload();
      if (!storageId) return;
      await addProcess({ buildId, userId, imageStorageId: storageId });
    } catch (e) {
      Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
    }
  }, [addProcess, buildId, pickAndUpload, t, userId]);

  const saveFocal = useCallback(
    async (fx: number, fy: number) => {
      try {
        await updateBuild({ id: buildId, userId, imageFocalX: fx, imageFocalY: fy });
      } catch (e) {
        Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
      }
    },
    [buildId, t, updateBuild, userId]
  );

  const filteredRoots = useMemo(() => {
    const needle = explorerSearch.trim().toLowerCase();
    if (!needle) return orderedRoots;
    return orderedRoots.filter((node) =>
      `${node.name} ${node.nodeType ?? ""}`.toLowerCase().includes(needle)
    );
  }, [explorerSearch, orderedRoots]);

  const summaryMetrics = useMemo(() => {
    if (!summary) return [];
    return [
      {
        key: "progress",
        label: t("buildDetail.summaryProgress", { pct: Math.round(summary.progressPercent) }),
      },
      {
        key: "tasks",
        label: t("buildDetail.summaryTasks", {
          checked: summary.tasksChecked,
          total: summary.tasksTotal,
        }),
      },
      {
        key: "linked",
        label: t("buildDetail.summaryLinked", {
          done: summary.linkedItemsCompleteCount,
          total: summary.linkedItemCount,
        }),
      },
      ...(summary.remainingDays != null
        ? [
            {
              key: "due",
              label: t("buildDetail.summaryDue", { days: summary.remainingDays }),
            },
          ]
        : []),
    ];
  }, [summary, t]);
  const quickNotesCard =
    build.notes && (tab === "summary" || tab === "explorer") ? (
      <SurfaceCard className="mx-4 mb-3 px-4 py-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <MetaLabel>{t("buildDetail.notesLabel")}</MetaLabel>
            <Text className="mt-3 text-sm leading-7 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {build.notes}
            </Text>
          </View>
          <Pressable
            onPress={() => setTab("summary")}
            className="rounded-full border border-kyar-borderSubtle px-3 py-2 dark:border-kyar-dark-borderSubtle"
          >
            <Text className="text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
              {t("buildDetail.tabSummary")}
            </Text>
          </Pressable>
        </View>
      </SurfaceCard>
    ) : null;

  const openLinkElements = useCallback(() => {
    setActionsMenuOpen(false);
    router.push(APP_HREF.buildLinkElements(buildId));
  }, [buildId, router]);

  const openNotes = useCallback(() => {
    setActionsMenuOpen(false);
    setTab("summary");
  }, []);

  const openFocalPoint = useCallback(() => {
    setActionsMenuOpen(false);
    setTab("summary");
    setFocalOpen(true);
  }, []);

  const openSelectedElement = useCallback(() => {
    if (!inspector.selected?.nodeId) return;
    detailSheetRef.current?.dismiss();
    router.push(APP_HREF.element(inspector.selected.nodeId as string));
  }, [inspector.selected?.nodeId, router]);

  const openQuickCreate = useCallback(
    (type: "element" | "material", parentId?: Id<"cosplayNodes"> | null) => {
      setQuickCreateType(type);
      setQuickCreateParentId(parentId ?? null);
      setQuickCreateName("");
      setQuickCreateOpen(true);
    },
    []
  );

  const openQuickCreateFromSheet = useCallback(
    (type: "element" | "material") => {
      if (!inspector.selected?.nodeId) return;
      detailSheetRef.current?.dismiss();
      openQuickCreate(type, inspector.selected.nodeId);
    },
    [inspector.selected?.nodeId, openQuickCreate]
  );

  const openChildFromSheet = useCallback(
    (childId: Id<"cosplayNodes">, index: number) => {
      const detail = inspector.selectedDetail;
      const parentMeta = inspector.selected;
      if (!detail?.children || !parentMeta) return;
      const child = detail.children[index];
      if (!child || child._id !== childId) return;

      const siblingLinkIds = detail.children.map((entry) => entry.linkId);
      const childMeta: NodeSelectionMeta = {
        nodeId: child._id,
        isRoot: false,
        parentNodeId: detail._id,
        siblingLinkIds,
        siblingIndex: index,
      };
      const basePath =
        selectedPath.length > 0 ? selectedPath : [{ label: detail.name, meta: parentMeta }];
      openNodeSheet(childMeta, [...basePath, { label: child.name, meta: childMeta }]);
    },
    [inspector.selected, inspector.selectedDetail, openNodeSheet, selectedPath]
  );

  const handleQuickCreate = useCallback(async () => {
    const name = quickCreateName.trim();
    if (!name || quickCreateBusy) return;
    setQuickCreateBusy(true);
    try {
      const node = await createNode({
        userId,
        nodeType: quickCreateType,
        name,
        tags: [],
      });
      if (!node?._id) throw new Error("Could not create node");

      if (quickCreateParentId) {
        await addChildLink({
          userId,
          parentNodeId: quickCreateParentId,
          childNodeId: node._id,
          linkMode: "owned",
        });
      } else {
        await addNodesToBuild({
          userId,
          buildId,
          cosplayNodeIds: [node._id],
        });
      }

      setQuickCreateOpen(false);
      setQuickCreateName("");
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setQuickCreateBusy(false);
    }
  }, [
    addChildLink,
    addNodesToBuild,
    buildId,
    createNode,
    quickCreateBusy,
    quickCreateName,
    quickCreateParentId,
    quickCreateType,
    t,
    userId,
  ]);

  const updateRootFrame = useCallback(() => {
    rootViewRef.current?.measureInWindow?.((x, y) => {
      setRootFrame({ x, y });
    });
  }, []);

  useEffect(() => {
    if (!explorerMove.dragMeta) return;
    updateRootFrame();
  }, [explorerMove.dragMeta, updateRootFrame]);

  const summaryHero = (
    <SurfaceCard className="overflow-hidden">
      <View className="relative aspect-[16/11] w-full bg-kyar-muted dark:bg-kyar-dark-muted">
        {heroUri ? (
          <FocalCoverImage
            uri={heroUri}
            focalX={build.imageFocalX}
            focalY={build.imageFocalY}
            className="absolute inset-0"
          />
        ) : (
          <View className="absolute inset-0 items-center justify-center">
            <Text className="text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
              {t("home.heroFallback")}
            </Text>
          </View>
        )}
        <View className="absolute inset-x-0 bottom-0 bg-kyar-text/38 px-5 pb-5 pt-10 dark:bg-kyar-dark-text/40">
          {build.character ? (
            <MetaLabel className="text-kyar-bg">{build.character}</MetaLabel>
          ) : null}
          <Text
            style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
            className="mt-2 text-4xl italic leading-[40px] text-kyar-bg"
          >
            {build.name}
          </Text>
        </View>
      </View>

      <View className="gap-3 px-5 py-4">
        <View className="flex-row flex-wrap gap-2">
          <View className="rounded-full bg-kyar-panel px-3 py-2 dark:bg-kyar-dark-panel">
            <Text className="text-xs font-semibold uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
              {build.status}
            </Text>
          </View>
          {summary ? (
            <View className="rounded-full bg-kyar-panel px-3 py-2 dark:bg-kyar-dark-panel">
              <Text className="text-xs font-semibold uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                {Math.round(summary.progressPercent)}%
              </Text>
            </View>
          ) : null}
        </View>

        {heroUri ? (
          <Pressable onPress={() => setFocalOpen(true)} className="self-start">
            <Text className="text-sm font-semibold underline text-kyar-text dark:text-kyar-dark-text">
              {t("buildDetail.adjustFocal")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SurfaceCard>
  );

  const summaryStatsCard =
    summaryMetrics.length > 0 ? (
      <SurfaceCard className="px-4 py-4">
        <View className="flex-row flex-wrap gap-3">
          {summaryMetrics.map((item) => (
            <View
              key={item.key}
              className="min-w-[46%] flex-1 rounded-2xl bg-kyar-panel px-4 py-4 dark:bg-kyar-dark-panel"
            >
              <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </SurfaceCard>
    ) : null;

  const collaboratorsBlock =
    collaborators && collaborators.length > 0 ? (
      <SurfaceCard className="px-4 py-4">
        <View className="flex-row items-center justify-between">
          <View>
            <MetaLabel>{t("buildDetail.collaborators")}</MetaLabel>
            <Text
              style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
              className="mt-2 text-[30px] italic text-kyar-text dark:text-kyar-dark-text"
            >
              Team
            </Text>
          </View>
        </View>

        <View className="mt-4 gap-3">
          {collaborators.map((collaborator) => (
            <View
              key={collaborator.userId}
              className="flex-row items-center justify-between rounded-2xl bg-kyar-panel px-4 py-4 dark:bg-kyar-dark-panel"
            >
              <Text className="flex-1 text-sm text-kyar-text dark:text-kyar-dark-text">
                {collaborator.name ??
                  collaborator.username ??
                  collaborator.email ??
                  collaborator.userId}
              </Text>
              <Text className="text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                {collaborator.role === "editor"
                  ? t("buildDetail.roleEditor")
                  : collaborator.role === "viewer"
                    ? t("buildDetail.roleViewer")
                    : collaborator.role}
              </Text>
            </View>
          ))}
        </View>
      </SurfaceCard>
    ) : null;

  const imageRail = (
    title: string,
    onAdd: () => void,
    items: Doc<"buildReferenceImages">[] | Doc<"buildProcessPictures">[] | undefined,
    onRemove: (id: string) => void
  ) => (
    <View>
      <MetaLabel>{title}</MetaLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
        <Pressable
          onPress={onAdd}
          className="mr-3 h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-kyar-border bg-kyar-panel dark:border-kyar-dark-border dark:bg-kyar-dark-panel"
        >
          <Text className="text-2xl text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            +
          </Text>
        </Pressable>
        {(items ?? []).map((item) => (
          <View key={item._id} className="mr-3 h-24 w-24 overflow-hidden rounded-2xl">
            <ConvexStorageImage
              storageId={item.imageStorageId}
              imageUrl={item.imageUrl}
              className="h-full w-full"
            />
            <Pressable
              onPress={() =>
                Alert.alert(t("buildDetail.removePhotoTitle"), "", [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("buildDetail.removeConfirm"),
                    style: "destructive",
                    onPress: () => onRemove(item._id),
                  },
                ])
              }
              className="absolute right-1 top-1 rounded-full bg-kyar-text/60 px-2 py-1 dark:bg-kyar-dark-text/60"
            >
              <Text className="text-[10px] font-bold text-kyar-bg dark:text-kyar-dark-bg">×</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View
      ref={rootViewRef}
      onLayout={updateRootFrame}
      className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
    >
      <View className="px-4 pb-3">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => {
              setSectionMenuOpen((value) => !value);
              setActionsMenuOpen(false);
            }}
            className="min-h-[56px] flex-1 flex-row items-center justify-between rounded-3xl border border-kyar-borderSubtle bg-kyar-surface px-4 py-3 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
          >
            <View>
              <MetaLabel>{t("buildDetail.sectionLabel", { defaultValue: "Section" })}</MetaLabel>
              <Text
                style={{ fontFamily: APP_FONT_FAMILIES.sansSemiBold }}
                className="mt-1 text-base text-kyar-text dark:text-kyar-dark-text"
              >
                {activeSection.label}
              </Text>
            </View>
            <Text className="text-base text-kyar-meta dark:text-kyar-dark-meta">
              {sectionMenuOpen ? "▴" : "▾"}
            </Text>
          </Pressable>

          {isOwner ? (
            <Pressable
              onPress={() => {
                setActionsMenuOpen((value) => !value);
                setSectionMenuOpen(false);
              }}
              className="h-14 w-14 items-center justify-center rounded-full border border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
            >
              <Text className="text-xl text-kyar-text dark:text-kyar-dark-text">⋯</Text>
            </Pressable>
          ) : null}
        </View>

        {sectionMenuOpen ? (
          <SurfaceCard className="mt-2 gap-1 px-2 py-2">
            {sectionItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setTab(item.id);
                  setSectionMenuOpen(false);
                }}
                className={`rounded-2xl px-4 py-3 ${
                  tab === item.id ? "bg-kyar-text dark:bg-kyar-dark-text" : "bg-transparent"
                }`}
              >
                <Text
                  className={`text-[11px] font-semibold uppercase tracking-widest ${
                    tab === item.id
                      ? "text-kyar-bg dark:text-kyar-dark-bg"
                      : "text-kyar-text dark:text-kyar-dark-text"
                  }`}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </SurfaceCard>
        ) : null}

        {actionsMenuOpen ? (
          <SurfaceCard className="mt-2 gap-1 px-2 py-2">
            {build.notes ? (
              <Pressable onPress={openNotes} className="rounded-2xl px-4 py-3">
                <Text className="text-[11px] font-semibold uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                  {t("buildDetail.notesLabel")}
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={openLinkElements} className="rounded-2xl px-4 py-3">
              <Text className="text-[11px] font-semibold uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                {t("buildDetail.linkElements")}
              </Text>
            </Pressable>
            {heroUri ? (
              <Pressable onPress={openFocalPoint} className="rounded-2xl px-4 py-3">
                <Text className="text-[11px] font-semibold uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                  {t("buildDetail.adjustFocal")}
                </Text>
              </Pressable>
            ) : null}
            {onDuplicate ? (
              <Pressable
                onPress={() => {
                  setActionsMenuOpen(false);
                  onDuplicate();
                }}
                className="rounded-2xl px-4 py-3"
              >
                <Text className="text-[11px] font-semibold uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                  {t("buildDetail.duplicate")}
                </Text>
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                onPress={() => {
                  setActionsMenuOpen(false);
                  onDelete();
                }}
                className="rounded-2xl px-4 py-3"
              >
                <Text className="text-[11px] font-semibold uppercase tracking-widest text-kyar-danger dark:text-kyar-dark-danger">
                  {t("buildDetail.deleteBuildAction")}
                </Text>
              </Pressable>
            ) : null}
          </SurfaceCard>
        ) : null}
      </View>

      {quickNotesCard}

      <View className="min-h-0 flex-1">
        {tab === "summary" ? (
          <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-16">
            {summaryHero}
            {summaryStatsCard}

            <SurfaceCard className="gap-6 px-4 py-4">
              <Pressable
                onPress={openLinkElements}
                className="items-center rounded-full bg-kyar-text py-3 active:opacity-90 dark:bg-kyar-dark-text"
              >
                <Text className="font-semibold text-kyar-bg dark:text-kyar-dark-bg">
                  {t("buildDetail.linkElements")}
                </Text>
              </Pressable>

              {imageRail(
                t("buildDetail.referenceImages"),
                onAddReference,
                refImages,
                (id) => void removeRef({ id: id as Id<"buildReferenceImages">, userId })
              )}
              {imageRail(
                t("buildDetail.processPictures"),
                onAddProcess,
                processPics,
                (id) => void removeProcess({ id: id as Id<"buildProcessPictures">, userId })
              )}
            </SurfaceCard>

            {collaboratorsBlock}
          </ScrollView>
        ) : null}

        {tab === "explorer" ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-4 px-4 pb-16"
            scrollEnabled={!explorerMove.dragMeta}
          >
            <SurfaceCard className="overflow-hidden">
              <View className="gap-3 border-b border-kyar-borderSubtle px-4 py-4 dark:border-kyar-dark-borderSubtle">
                <TextInput
                  value={explorerSearch}
                  onChangeText={setExplorerSearch}
                  placeholder={t("elements.searchPlaceholder")}
                  placeholderTextColor={colors.textTertiary}
                  className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
                />

                <View className="flex-row items-center justify-between gap-3">
                  <Text className="text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                    {explorerSearch.trim()
                      ? `${filteredRoots.length} matches`
                      : `${orderedRoots.length} roots`}
                  </Text>
                  <Pressable
                    onPress={openLinkElements}
                    className="rounded-full border border-kyar-borderSubtle px-4 py-2 dark:border-kyar-dark-borderSubtle"
                  >
                    <Text className="text-[10px] uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                      {t("buildDetail.linkElements")}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="border-b border-kyar-borderSubtle px-4 py-3 dark:border-kyar-dark-borderSubtle"
                scrollEnabled={!explorerMove.dragMeta}
              >
                <View className="flex-row items-center gap-1.5">
                  <Pressable
                    onPress={() => {
                      setSelectedPath([]);
                      void inspector.commitSelection(null);
                    }}
                  >
                    <Text className="text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {build.name}
                    </Text>
                  </Pressable>
                  {selectedPath.map((segment, index) => (
                    <View
                      key={`${segment.meta.nodeId}-${index}`}
                      className="flex-row items-center gap-1.5"
                    >
                      <Text className="text-xs text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                        /
                      </Text>
                      <Pressable
                        onPress={() =>
                          openNodeSheet(segment.meta, selectedPath.slice(0, index + 1))
                        }
                      >
                        <Text
                          className={`text-xs ${
                            index === selectedPath.length - 1
                              ? "text-kyar-text dark:text-kyar-dark-text"
                              : "text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
                          }`}
                        >
                          {segment.label}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View className="gap-2 border-b border-kyar-borderSubtle px-4 py-3 dark:border-kyar-dark-borderSubtle">
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={() => openQuickCreate("element")}
                    className="rounded-full border border-kyar-borderSubtle px-4 py-2 dark:border-kyar-dark-borderSubtle"
                  >
                    <Text className="text-[10px] uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                      {t("elements.newElementShort")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openQuickCreate("material")}
                    className="rounded-full border border-kyar-borderSubtle px-4 py-2 dark:border-kyar-dark-borderSubtle"
                  >
                    <Text className="text-[10px] uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                      {t("elements.newMaterialShort")}
                    </Text>
                  </Pressable>
                  {inspector.selected?.nodeId ? (
                    <>
                      <Pressable
                        onPress={() => openQuickCreate("element", inspector.selected?.nodeId)}
                        className="rounded-full border border-kyar-borderSubtle px-4 py-2 dark:border-kyar-dark-borderSubtle"
                      >
                        <Text className="text-[10px] uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                          {t("buildDetail.addChildElement", { defaultValue: "Child element" })}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => openQuickCreate("material", inspector.selected?.nodeId)}
                        className="rounded-full border border-kyar-borderSubtle px-4 py-2 dark:border-kyar-dark-borderSubtle"
                      >
                        <Text className="text-[10px] uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                          {t("buildDetail.addChildMaterial", { defaultValue: "Child material" })}
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
                {inspector.selectedDetail ? (
                  <Text className="text-xs leading-5 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                    {t("buildDetail.explorerSelectionHint", {
                      defaultValue:
                        "Select a node to open detail, create children, or reorganize the tree.",
                    })}
                  </Text>
                ) : null}
              </View>

              <View className="px-4 py-4">
                {explorerSearch.trim() ? (
                  filteredRoots.length > 0 ? (
                    filteredRoots.map((root) => (
                      <ExplorerBranch
                        key={root._id}
                        node={root}
                        buildId={buildId}
                        depth={0}
                        isRoot
                        rootIndex={rootOrderIds.findIndex((id) => id === root._id)}
                        selectedNodeId={inspector.selected?.nodeId ?? null}
                        onSelect={openNodeSheet}
                        onStartMove={explorerMove.startDrag}
                        onMovePointer={explorerMove.updateDragPoint}
                        onEndMove={explorerMove.finishDrag}
                        registerRow={explorerMove.registerRow}
                        unregisterRow={explorerMove.unregisterRow}
                        draggingNodeId={explorerMove.dragVisualState.draggingNodeId}
                        dragOverNodeId={explorerMove.dragVisualState.dragOverNodeId}
                        dragOverZone={explorerMove.dragVisualState.dragOverZone}
                      />
                    ))
                  ) : (
                    <Text className="py-8 text-center text-kyar-meta dark:text-kyar-dark-meta">
                      {t("buildDetail.outlineEmpty")}
                    </Text>
                  )
                ) : orderedRoots.length > 0 ? (
                  <>
                    <Text className="mb-3 text-xs text-kyar-meta dark:text-kyar-dark-meta">
                      {t("buildDetail.outlineDragHint", {
                        defaultValue:
                          "Long-press any linked element to move it, nest it, or drag it back to root.",
                      })}
                    </Text>
                    {explorerMove.dragMeta ? (
                      <View
                        ref={explorerMove.registerRootDropZone}
                        className={`mb-3 rounded-2xl border border-dashed px-4 py-3 ${
                          explorerMove.dragVisualState.dragOverNodeId === "__root__"
                            ? "border-kyar-text bg-kyar-panelRaised dark:border-kyar-dark-text dark:bg-kyar-dark-panelRaised"
                            : "border-kyar-borderSubtle bg-kyar-panel dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
                        }`}
                      >
                        <Text className="text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                          {t("buildDetail.dropToRootLabel", {
                            defaultValue: "Drop here to move to root",
                          })}
                        </Text>
                      </View>
                    ) : null}

                    {orderedRoots.map((root) => (
                      <ExplorerBranch
                        key={root._id}
                        node={root}
                        buildId={buildId}
                        depth={0}
                        isRoot
                        rootIndex={rootOrderIds.findIndex((id) => id === root._id)}
                        selectedNodeId={inspector.selected?.nodeId ?? null}
                        onSelect={openNodeSheet}
                        onStartMove={explorerMove.startDrag}
                        onMovePointer={explorerMove.updateDragPoint}
                        onEndMove={explorerMove.finishDrag}
                        registerRow={explorerMove.registerRow}
                        unregisterRow={explorerMove.unregisterRow}
                        draggingNodeId={explorerMove.dragVisualState.draggingNodeId}
                        dragOverNodeId={explorerMove.dragVisualState.dragOverNodeId}
                        dragOverZone={explorerMove.dragVisualState.dragOverZone}
                      />
                    ))}
                  </>
                ) : (
                  <Text className="py-8 text-center text-kyar-meta dark:text-kyar-dark-meta">
                    {t("buildDetail.outlineEmpty")}
                  </Text>
                )}
              </View>
            </SurfaceCard>
          </ScrollView>
        ) : null}

        {tab === "tasks" ? (
          <View className="flex-1 pb-8">
            <BuildWorkflowTasks buildId={buildId} userId={userId} t={t} />
          </View>
        ) : null}

        {tab === "board" ? (
          <ScrollView className="flex-1" contentContainerClassName="px-4 pb-16 pt-2">
            <SurfaceCard className="gap-4 px-4 py-4">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="font-serif text-2xl italic text-kyar-text dark:text-kyar-dark-text">
                  {t("buildDetail.tabBoard")}
                </Text>
                <Pressable
                  onPress={openLinkElements}
                  className="rounded-full border border-kyar-borderSubtle px-3 py-2 dark:border-kyar-dark-borderSubtle"
                >
                  <Text className="text-[10px] uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                    {t("buildDetail.linkElements")}
                  </Text>
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {([
                    { id: "all", label: "All" },
                    { id: "references", label: "References" },
                    { id: "progress", label: "Progress" },
                    { id: "nodes", label: "Elements" },
                  ] as { id: BoardView; label: string }[]).map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => setBoardView(item.id)}
                      className={`rounded-full border px-4 py-2 ${
                        boardView === item.id
                          ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                          : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                      }`}
                    >
                      <Text
                        className={`text-[10px] uppercase tracking-widest ${
                          boardView === item.id
                            ? "text-kyar-bg dark:text-kyar-dark-bg"
                            : "text-kyar-text dark:text-kyar-dark-text"
                        }`}
                      >
                        {t(`buildDetail.boardFilter${item.label}`, { defaultValue: item.label })}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {boardVisibleItems.length === 0 ? (
                <Text className="py-8 text-center text-kyar-meta dark:text-kyar-dark-meta">
                  {boardView === "references"
                    ? t("buildDetail.referencesEmpty", { defaultValue: "No reference images yet." })
                    : boardView === "progress"
                      ? t("buildDetail.progressEmpty", { defaultValue: "No progress photos yet." })
                      : boardView === "nodes"
                        ? t("buildDetail.nodesEmpty", { defaultValue: "No linked elements yet." })
                        : t("buildDetail.boardEmpty")}
                </Text>
              ) : (
                <View className="flex-row gap-3">
                  {boardColumns.map((col, colIndex) => (
                    <View key={`col-${colIndex}`} className="flex-1 gap-3">
                      {col.map((item) => {
                        if (item.type === "node") {
                          const node = item.node;
                          return (
                            <Pressable
                              key={item.key}
                              onPress={() => router.push(APP_HREF.element(node._id as string))}
                            >
                              <ElementPortfolioCard
                                variant="grid"
                                item={{
                                  name: node.name,
                                  category: node.nodeType === "material" ? "materials" : "elements",
                                  imageStorageId: node.imageStorageId ?? null,
                                  imageUrl: node.imageUrl ?? null,
                                  nodeType: (node.nodeType as "element" | "material") ?? "element",
                                  progressPercent: node.progressPercent ?? 0,
                                  childCount: node.childCount ?? 0,
                                  typeBadge:
                                    node.nodeType === "material"
                                      ? t("elements.typeMaterial")
                                      : t("elements.typeElement"),
                                  statusBadge: t("elements.progressPercent", {
                                    pct: Math.round(node.progressPercent ?? 0),
                                  }),
                                }}
                                progressLabel={t("elements.progressPercent", {
                                  pct: Math.round(node.progressPercent ?? 0),
                                })}
                                childrenLabel={t("elements.childCount", {
                                  count: node.childCount ?? 0,
                                  defaultValue:
                                    (node.childCount ?? 0) === 1 ? "1 child" : `${node.childCount ?? 0} children`,
                                })}
                              />
                            </Pressable>
                          );
                        }

                        return (
                          <View
                            key={item.key}
                            className="overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-muted shadow-soft dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-muted"
                          >
                            <View className="relative min-h-[120px]">
                              {item.imageStorageId || item.imageUrl ? (
                                <ConvexStorageImage
                                  storageId={item.imageStorageId}
                                  imageUrl={item.imageUrl}
                                  className="h-full w-full"
                                />
                              ) : (
                                <View className="h-[140px] items-center justify-center">
                                  <Text className="text-3xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                                    ⌁
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View className="px-3 py-2">
                              <Text className="text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                                {item.type === "reference"
                                  ? t("buildDetail.referenceImages")
                                  : t("buildDetail.processPictures")}
                              </Text>
                              {item.type === "progress" ? (
                                <Text className="mt-1 text-xs text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                                  {item.dayLabel}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}
            </SurfaceCard>
          </ScrollView>
        ) : null}
      </View>

      {explorerMove.dragMeta && explorerMove.dragVisualState.dragPoint ? (
        <View
          pointerEvents="none"
          className="absolute"
          style={{
            left: Math.max(12, explorerMove.dragVisualState.dragPoint.x - rootFrame.x - 120),
            top: Math.max(12, explorerMove.dragVisualState.dragPoint.y - rootFrame.y - 36),
          }}
        >
          <View className="rounded-full bg-kyar-text px-4 py-3 shadow-fab dark:bg-kyar-dark-text">
            <Text className="text-[11px] font-semibold uppercase tracking-widest text-kyar-bg dark:text-kyar-dark-bg">
              {explorerMove.dragMeta.name}
            </Text>
          </View>
        </View>
      ) : null}

      {tab === "explorer" && !explorerMove.dragMeta ? (
        <FloatingCreateMenu
          actions={[
            {
              key: "new-element",
              label: t("elements.newElementShort"),
              icon: "sparkles-outline",
              onPress: () => router.push(APP_HREF.elementNewWithType("element")),
            },
            {
              key: "new-material",
              label: t("elements.newMaterialShort"),
              icon: "cube-outline",
              onPress: () => router.push(APP_HREF.elementNewWithType("material")),
            },
            {
              key: "link-existing",
              label: t("buildDetail.linkElements"),
              icon: "git-network-outline",
              onPress: openLinkElements,
            },
          ]}
          bottomOffset={96}
        />
      ) : null}

      <HeroFocalModal
        visible={focalOpen && !!heroUri}
        imageUri={heroUri ?? ""}
        initialFocalX={build.imageFocalX}
        initialFocalY={build.imageFocalY}
        onClose={() => setFocalOpen(false)}
        onSave={saveFocal}
      />

      <NodeDetailSheet
        ref={detailSheetRef}
        detail={inspector.selectedDetail}
        selected={inspector.selected}
        inspectorForm={inspector.inspectorForm}
        persistStatus={inspector.persistStatus}
        onFormChange={inspector.setInspectorForm}
        onFlushSave={() => void inspector.flushSave()}
        onCreateChild={openQuickCreateFromSheet}
        onOpenDetail={openSelectedElement}
        onSelectChild={openChildFromSheet}
        onUnlink={handleSheetUnlink}
        onDismiss={handleSheetDismiss}
      />

      <Pressable
        className={quickCreateOpen ? "absolute inset-0 bg-black/40" : "hidden"}
        onPress={() => {
          if (!quickCreateBusy) setQuickCreateOpen(false);
        }}
      >
        {quickCreateOpen ? (
          <Pressable
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-kyar-borderSubtle bg-kyar-surface px-5 pb-8 pt-5 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
              {quickCreateParentId
                ? t("buildDetail.quickCreateChildTitle", { defaultValue: "Create child node" })
                : t("buildDetail.quickCreateRootTitle", { defaultValue: "Create linked node" })}
            </Text>
            <Text className="mt-2 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {quickCreateParentId
                ? t("buildDetail.quickCreateChildBody", {
                    defaultValue: "Add a new node directly under the currently selected element.",
                  })
                : t("buildDetail.quickCreateRootBody", {
                    defaultValue:
                      "Add a brand-new element or material directly into this build explorer.",
                  })}
            </Text>
            <TextInput
              value={quickCreateName}
              onChangeText={setQuickCreateName}
              placeholder={t("elements.namePlaceholder")}
              placeholderTextColor={colors.textTertiary}
              className="mt-4 rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
            />
            <View className="mt-4 flex-row gap-3">
              <Pressable
                onPress={() => setQuickCreateType("element")}
                className={`flex-1 rounded-full border px-4 py-3 ${
                  quickCreateType === "element"
                    ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                    : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                }`}
              >
                <Text
                  className={`text-center text-xs font-semibold uppercase tracking-wide ${
                    quickCreateType === "element"
                      ? "text-kyar-bg dark:text-kyar-dark-bg"
                      : "text-kyar-text dark:text-kyar-dark-text"
                  }`}
                >
                  {t("elements.typeElement")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setQuickCreateType("material")}
                className={`flex-1 rounded-full border px-4 py-3 ${
                  quickCreateType === "material"
                    ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                    : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                }`}
              >
                <Text
                  className={`text-center text-xs font-semibold uppercase tracking-wide ${
                    quickCreateType === "material"
                      ? "text-kyar-bg dark:text-kyar-dark-bg"
                      : "text-kyar-text dark:text-kyar-dark-text"
                  }`}
                >
                  {t("elements.typeMaterial")}
                </Text>
              </Pressable>
            </View>
            <View className="mt-4 flex-row gap-3">
              <Pressable
                onPress={() => setQuickCreateOpen(false)}
                className="flex-1 rounded-full border border-kyar-borderSubtle px-4 py-3 dark:border-kyar-dark-borderSubtle"
              >
                <Text className="text-center text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleQuickCreate()}
                disabled={!quickCreateName.trim() || quickCreateBusy}
                className="flex-1 rounded-full bg-kyar-text px-4 py-3 disabled:opacity-40 dark:bg-kyar-dark-text"
              >
                <Text className="text-center text-sm font-semibold text-kyar-bg dark:text-kyar-dark-bg">
                  {quickCreateBusy ? t("elements.creating") : t("elements.create")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}
