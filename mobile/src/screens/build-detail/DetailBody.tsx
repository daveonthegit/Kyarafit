import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { borderWidth, glass } from "@kyarafit/design-system/rn";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { FloatingCreateMenu } from "@/ui";
import {
  GlassBar,
  GlassPanel,
  GlassStatusChip,
  GlassTextField,
  PhotoBackdrop,
  PhotoPill,
  scrimGradientProps,
  type GlassStatusTone,
} from "@/ui/glass";
import {
  GlassBody,
  GlassHairlineProgress,
  GlassMeta,
  GlassOutlineButton,
  GlassSolidButton,
} from "./glassAtoms";
import { ExplorerBranch, type ExplorerPathSegment } from "./ExplorerBranch";
import { HeroFocalModal } from "./HeroFocalModal";
import { BuildWorkflowTasks } from "./BuildWorkflowTasks";
import { NodeDetailSheet, type NodeDetailSheetRef } from "./NodeDetailSheet";
import { useNodeInspector, type NodeSelectionMeta } from "./useNodeInspector";
import { useExplorerMove } from "./useExplorerMove";
import { BuildProgressTimeline } from "./BuildProgressTimeline";
import { useOfflineMutation } from "@/offline";

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

type TabId = "summary" | "explorer" | "tasks" | "board" | "updates";
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
  /** Deep-link target section (e.g. Board pill on the Builds pager). */
  initialTab?: TabId;
};

function buildStatusTone(status: string): GlassStatusTone {
  const value = status.toLowerCase();
  if (value.includes("done") || value.includes("complete") || value === "built") return "success";
  if (value.includes("progress") || value === "wip" || value === "active") return "active";
  if (value.includes("block") || value.includes("wait")) return "warning";
  return "neutral";
}

/** Segmented pill pair (active = solid light + ink; QA-3 segmented exemption). */
function SegmentedPair<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 4,
        borderRadius: 999,
        backgroundColor: glass.surface.bar,
        padding: 4,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            disabled={disabled}
            style={{
              flex: 1,
              minHeight: 36,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              backgroundColor: active ? glass.surface.solid : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: active ? APP_FONT_FAMILIES.sansSemiBold : APP_FONT_FAMILIES.sansMedium,
                fontSize: 11,
                color: active ? glass.text.ink : glass.text.fg70,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const SHEET_STYLE = {
  borderTopLeftRadius: glass.radius.sheet,
  borderTopRightRadius: glass.radius.sheet,
  borderWidth: borderWidth.hairline,
  borderColor: glass.border.overlay,
  backgroundColor: glass.fallback.overlay,
} as const;

function SheetGrip() {
  return (
    <View
      style={{
        alignSelf: "center",
        marginBottom: 14,
        height: 4,
        width: 44,
        borderRadius: 2,
        backgroundColor: glass.border.strong,
      }}
    />
  );
}

export function BuildDetailBody(props: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
    initialTab,
  } = props;

  const [tab, setTab] = useState<TabId>(initialTab ?? "summary");
  const [boardView, setBoardView] = useState<BoardView>("all");
  const [boardFullscreen, setBoardFullscreen] = useState(false);
  const [boardLightbox, setBoardLightbox] = useState<{
    imageStorageId: Id<"_storage"> | null;
    imageUrl: string | null;
    label: string;
    dayLabel?: string | null;
  } | null>(null);
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

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor">("viewer");
  const [invitePending, setInvitePending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

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

  const updateBuild = useOfflineMutation(api.builds.update);
  const generateUploadUrl = useOfflineMutation(api.files.generateUploadUrl);
  const addRef = useOfflineMutation(api.buildReferenceImages.add);
  const removeRef = useOfflineMutation(api.buildReferenceImages.remove);
  const addProcess = useOfflineMutation(api.buildProcessPictures.add);
  const removeProcess = useOfflineMutation(api.buildProcessPictures.remove);
  const createNode = useOfflineMutation(api.cosplayNodes.create);
  const addNodesToBuild = useOfflineMutation(api.builds.addNodesToBuild);
  const addChildLink = useOfflineMutation(api.cosplayNodes.addChildLink);
  const addCollaboratorByEmail = useOfflineMutation(api.buildCollaborators.addByEmail);
  const removeCollaborator = useOfflineMutation(api.buildCollaborators.remove);

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
        { id: "updates", label: t("buildDetail.tabUpdates", { defaultValue: "Updates" }) },
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
      <GlassBar style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 14 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <View style={{ minWidth: 0, flex: 1 }}>
            <GlassMeta size={9} tone="fg55">
              {t("buildDetail.notesLabel")}
            </GlassMeta>
            <GlassBody size={13} tone="fg70" style={{ marginTop: 6 }} numberOfLines={3}>
              {build.notes}
            </GlassBody>
          </View>
          <PhotoPill
            variant="outline"
            size="sm"
            label={t("buildDetail.tabSummary")}
            onPress={() => setTab("summary")}
          />
        </View>
      </GlassBar>
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

  useEffect(() => {
    if (!inviteModalOpen) return;
    setInviteEmail("");
    setInviteRole("viewer");
    setInviteError(null);
    setInviteFeedback(null);
  }, [inviteModalOpen]);

  const handleSendCollaboratorInvite = useCallback(async () => {
    const email = inviteEmail.trim();
    if (!email || invitePending) return;
    setInvitePending(true);
    setInviteError(null);
    setInviteFeedback(null);
    try {
      await addCollaboratorByEmail({
        buildId,
        ownerId: userId,
        email,
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteFeedback(t("buildDetail.inviteSuccess"));
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : t("buildDetail.inviteErrorGeneric"));
    } finally {
      setInvitePending(false);
    }
  }, [addCollaboratorByEmail, buildId, inviteEmail, invitePending, inviteRole, t, userId]);

  const confirmRemoveCollaborator = useCallback(
    (collaboratorUserId: string) => {
      Alert.alert(t("buildDetail.inviteRemoveTitle"), t("buildDetail.inviteRemoveBody"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("buildDetail.inviteRemove"),
          style: "destructive",
          onPress: () => {
            void removeCollaborator({
              buildId,
              ownerId: userId,
              userId: collaboratorUserId,
            });
          },
        },
      ]);
    },
    [buildId, removeCollaborator, t, userId]
  );

  const updateRootFrame = useCallback(() => {
    rootViewRef.current?.measureInWindow?.((x, y) => {
      setRootFrame({ x, y });
    });
  }, []);

  useEffect(() => {
    if (!explorerMove.dragMeta) return;
    updateRootFrame();
  }, [explorerMove.dragMeta, updateRootFrame]);

  const headlineProgress = summary ? summary.progressPercent : build.progress;
  const headlineTasksChecked = summary?.tasksChecked ?? build.tasksChecked;
  const headlineTasksTotal = summary?.tasksTotal ?? build.tasksTotal;

  const headlineBlock = (
    <View style={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 14 }}>
      <GlassMeta size={9} tone="fg70" bold tracking={0.26}>
        {[build.character, build.status].filter(Boolean).join(" · ") || build.status}
      </GlassMeta>
      <Text
        numberOfLines={2}
        style={{
          marginTop: 6,
          fontFamily: APP_FONT_FAMILIES.displayItalic,
          fontStyle: "italic",
          fontSize: 38,
          lineHeight: 38,
          color: glass.text.fg,
        }}
      >
        {build.name}
      </Text>
      <GlassHairlineProgress percent={headlineProgress} style={{ marginTop: 12 }} />
      <GlassMeta size={9} tone="fg55" style={{ marginTop: 6 }}>
        {t("buildDetail.headlineTasksMeta", {
          defaultValue: "{{checked}} / {{total}} tasks · {{pct}}%",
          checked: headlineTasksChecked,
          total: headlineTasksTotal,
          pct: Math.round(headlineProgress),
        })}
      </GlassMeta>
    </View>
  );

  const menuItemStyle = { minHeight: 44, justifyContent: "center" as const, borderRadius: 10, paddingHorizontal: 14 };

  const imageRail = (
    title: string,
    onAdd: () => void,
    items: Doc<"buildReferenceImages">[] | Doc<"buildProcessPictures">[] | undefined,
    onRemove: (id: string) => void
  ) => (
    <View>
      <GlassMeta size={10} tone="fg70" bold>
        {title}
      </GlassMeta>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          style={{
            marginRight: 10,
            height: 96,
            width: 96,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: glass.border.strong,
            backgroundColor: glass.surface.field,
          }}
        >
          <Ionicons name="add" size={20} color={glass.text.fg70} />
        </Pressable>
        {(items ?? []).map((item) => (
          <View
            key={item._id}
            style={{
              marginRight: 10,
              height: 96,
              width: 96,
              borderRadius: 12,
              overflow: "hidden",
              borderWidth: borderWidth.hairline,
              borderColor: glass.border.divider,
            }}
          >
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
              hitSlop={8}
              style={{
                position: "absolute",
                right: 4,
                top: 4,
                height: 22,
                width: 22,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 11,
                backgroundColor: glass.scrimDim,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: glass.text.fg }}>×</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const boardTile = (
    item: (typeof boardVisibleItems)[number],
    colIndex: number,
    rowIndex: number
  ) => {
    const tall = (colIndex + rowIndex) % 2 === 0;
    if (item.type === "node") {
      const node = item.node;
      const pct = Math.round(node.progressPercent ?? 0);
      return (
        <Pressable
          key={item.key}
          onPress={() => router.push(APP_HREF.element(node._id as string))}
          style={{
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: borderWidth.hairline,
            borderColor: glass.border.divider,
            backgroundColor: glass.surface.field,
          }}
        >
          <View style={{ height: tall ? 150 : 110 }}>
            {node.imageStorageId || node.imageUrl ? (
              <ConvexStorageImage
                storageId={node.imageStorageId}
                imageUrl={node.imageUrl}
                className="h-full w-full"
              />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name={node.nodeType === "material" ? "cube-outline" : "diamond-outline"}
                  size={22}
                  color={glass.text.fg45}
                />
              </View>
            )}
          </View>
          <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: APP_FONT_FAMILIES.displayItalic,
                fontStyle: "italic",
                fontSize: 17,
                color: glass.text.fg,
              }}
            >
              {node.name}
            </Text>
            <GlassHairlineProgress percent={pct} style={{ marginTop: 8 }} />
            <GlassMeta size={9} tone="fg55" style={{ marginTop: 6 }}>
              {`${
                node.nodeType === "material"
                  ? t("elements.typeMaterial")
                  : t("elements.typeElement")
              } · ${pct}%`}
            </GlassMeta>
          </View>
        </Pressable>
      );
    }

    const kindLabel =
      item.type === "reference"
        ? t("buildDetail.referenceImages")
        : t("buildDetail.processPictures");
    return (
      <Pressable
        key={item.key}
        onPress={() =>
          setBoardLightbox({
            imageStorageId: item.imageStorageId ?? null,
            imageUrl: item.imageUrl ?? null,
            label: kindLabel,
            dayLabel: item.type === "progress" ? item.dayLabel : null,
          })
        }
        style={{
          height: tall ? 200 : 150,
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: borderWidth.hairline,
          borderColor: glass.border.divider,
          backgroundColor: glass.surface.field,
        }}
      >
        {item.imageStorageId || item.imageUrl ? (
          <ConvexStorageImage
            storageId={item.imageStorageId}
            imageUrl={item.imageUrl}
            className="h-full w-full"
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="image-outline" size={22} color={glass.text.fg45} />
          </View>
        )}
        <LinearGradient
          {...scrimGradientProps(glass.scrim.pageVertical)}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 64 }}
          pointerEvents="none"
        />
        <View style={{ position: "absolute", left: 10, bottom: 8 }}>
          <GlassMeta size={9} tone="fg">
            {item.type === "progress" ? `${kindLabel} · ${item.dayLabel}` : kindLabel}
          </GlassMeta>
        </View>
      </Pressable>
    );
  };

  const boardAddTile =
    boardView === "nodes" ? null : (
      <Pressable
        onPress={() => void (boardView === "progress" ? onAddProcess() : onAddReference())}
        accessibilityRole="button"
        style={{
          minHeight: 110,
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          borderRadius: 16,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: glass.border.strong,
          backgroundColor: glass.surface.field,
        }}
      >
        <Ionicons name="add" size={18} color={glass.text.fg70} />
        <GlassMeta size={9} tone="fg70">
          {t("buildDetail.boardAddImage", { defaultValue: "Add image" })}
        </GlassMeta>
      </Pressable>
    );

  const boardPanel = (isFullscreen = false) => (
    <View style={{ gap: 14, padding: 14 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.displayItalic,
            fontStyle: "italic",
            fontSize: 22,
            color: glass.text.fg,
          }}
        >
          {t("buildDetail.tabBoard")}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <PhotoPill
            variant="outline"
            size="sm"
            label={
              isFullscreen
                ? t("common.close", { defaultValue: "Close" })
                : t("common.fullscreen", { defaultValue: "Fullscreen" })
            }
            onPress={() => setBoardFullscreen((value) => !value)}
          />
          {!isFullscreen ? (
            <PhotoPill
              variant="outline"
              size="sm"
              label={t("buildDetail.linkElements")}
              onPress={openLinkElements}
            />
          ) : null}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(
            [
              { id: "all", label: "All" },
              { id: "references", label: "References" },
              { id: "progress", label: "Progress" },
              { id: "nodes", label: "Elements" },
            ] as { id: BoardView; label: string }[]
          ).map((item) => {
            const active = boardView === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setBoardView(item.id)}
                style={{
                  minHeight: 34,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  backgroundColor: active ? glass.surface.solid : glass.surface.bar,
                  borderWidth: active ? 0 : 1,
                  borderColor: glass.border.default,
                }}
              >
                <GlassMeta size={9} tone={active ? "ink" : "fg"} bold>
                  {t(`buildDetail.boardFilter${item.label}`, { defaultValue: item.label })}
                </GlassMeta>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {boardVisibleItems.length === 0 ? (
        <View style={{ gap: 12 }}>
          {boardAddTile}
          <GlassBody size={13} tone="fg55" style={{ paddingVertical: 24, textAlign: "center" }}>
            {boardView === "references"
              ? t("buildDetail.referencesEmpty", { defaultValue: "No reference images yet." })
              : boardView === "progress"
                ? t("buildDetail.progressEmpty", { defaultValue: "No progress photos yet." })
                : boardView === "nodes"
                  ? t("buildDetail.nodesEmpty", { defaultValue: "No linked elements yet." })
                  : t("buildDetail.boardEmpty")}
          </GlassBody>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {boardColumns.map((col, colIndex) => (
            <View key={`col-${colIndex}`} style={{ flex: 1, gap: 10 }}>
              {colIndex === 0 ? boardAddTile : null}
              {col.map((item, rowIndex) => boardTile(item, colIndex, rowIndex))}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View ref={rootViewRef} onLayout={updateRootFrame} style={{ flex: 1 }}>
      <PhotoBackdrop
        imageUrl={heroUri}
        focalX={build.imageFocalX}
        focalY={build.imageFocalY}
      />

      {headlineBlock}

      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <GlassBar style={{ flex: 1, borderRadius: 14 }}>
            <Pressable
              onPress={() => {
                setSectionMenuOpen((value) => !value);
                setActionsMenuOpen(false);
              }}
              accessibilityRole="button"
              style={{
                minHeight: 52,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <View>
                <GlassMeta size={9} tone="fg55">
                  {t("buildDetail.sectionLabel", { defaultValue: "Section" })}
                </GlassMeta>
                <Text
                  style={{
                    marginTop: 2,
                    fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                    fontSize: 14,
                    color: glass.text.fg,
                  }}
                >
                  {activeSection.label}
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: glass.text.fg55 }}>
                {sectionMenuOpen ? "▴" : "▾"}
              </Text>
            </Pressable>
          </GlassBar>

          {isOwner ? (
            <GlassBar style={{ borderRadius: 999 }}>
              <Pressable
                onPress={() => {
                  setActionsMenuOpen((value) => !value);
                  setSectionMenuOpen(false);
                }}
                accessibilityRole="button"
                style={{ height: 52, width: 52, alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={glass.text.fg} />
              </Pressable>
            </GlassBar>
          ) : null}
        </View>

        {sectionMenuOpen ? (
          <GlassPanel blur={false} style={{ marginTop: 8, padding: 6, gap: 2 }}>
            {sectionItems.map((item) => {
              const active = tab === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setTab(item.id);
                    setSectionMenuOpen(false);
                  }}
                  style={[menuItemStyle, active && { backgroundColor: glass.surface.solid }]}
                >
                  <GlassMeta size={10} tone={active ? "ink" : "fg"} bold>
                    {item.label}
                  </GlassMeta>
                </Pressable>
              );
            })}
          </GlassPanel>
        ) : null}

        {actionsMenuOpen ? (
          <GlassPanel blur={false} style={{ marginTop: 8, padding: 6, gap: 2 }}>
            {build.notes ? (
              <Pressable onPress={openNotes} style={menuItemStyle}>
                <GlassMeta size={10} tone="fg" bold>
                  {t("buildDetail.notesLabel")}
                </GlassMeta>
              </Pressable>
            ) : null}
            <Pressable onPress={openLinkElements} style={menuItemStyle}>
              <GlassMeta size={10} tone="fg" bold>
                {t("buildDetail.linkElements")}
              </GlassMeta>
            </Pressable>
            {heroUri ? (
              <Pressable onPress={openFocalPoint} style={menuItemStyle}>
                <GlassMeta size={10} tone="fg" bold>
                  {t("buildDetail.adjustFocal")}
                </GlassMeta>
              </Pressable>
            ) : null}
            {onDuplicate ? (
              <Pressable
                onPress={() => {
                  setActionsMenuOpen(false);
                  onDuplicate();
                }}
                style={menuItemStyle}
              >
                <GlassMeta size={10} tone="fg" bold>
                  {t("buildDetail.duplicate")}
                </GlassMeta>
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                onPress={() => {
                  setActionsMenuOpen(false);
                  onDelete();
                }}
                style={menuItemStyle}
              >
                <GlassMeta size={10} tone="danger" bold>
                  {t("buildDetail.deleteBuildAction")}
                </GlassMeta>
              </Pressable>
            ) : null}
          </GlassPanel>
        ) : null}
      </View>

      {quickNotesCard}

      <View
        style={{
          minHeight: 0,
          flex: 1,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <GlassPanel style={{ flex: 1 }}>
          {tab === "summary" ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 18, padding: 14 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <GlassStatusChip tone={buildStatusTone(build.status)} label={build.status} />
                {summary ? (
                  <GlassStatusChip
                    tone="neutral"
                    label={`${Math.round(summary.progressPercent)}%`}
                  />
                ) : null}
                {heroUri ? (
                  <PhotoPill
                    variant="text"
                    size="sm"
                    label={t("buildDetail.adjustFocal")}
                    onPress={() => setFocalOpen(true)}
                  />
                ) : null}
              </View>

              {summaryMetrics.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {summaryMetrics.map((item) => (
                    <View
                      key={item.key}
                      style={{
                        minWidth: "46%",
                        flex: 1,
                        borderRadius: 10,
                        borderWidth: borderWidth.hairline,
                        borderColor: glass.border.divider,
                        backgroundColor: glass.surface.field,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                      }}
                    >
                      <GlassBody size={12} tone="fg70">
                        {item.label}
                      </GlassBody>
                    </View>
                  ))}
                </View>
              ) : null}

              <GlassSolidButton
                label={t("buildDetail.linkElements")}
                onPress={openLinkElements}
              />

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

              {collaborators !== undefined ? (
                <View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <View style={{ minWidth: 0, flex: 1 }}>
                      <GlassMeta size={9} tone="fg55">
                        {t("buildDetail.collaborators")}
                      </GlassMeta>
                      <Text
                        style={{
                          marginTop: 4,
                          fontFamily: APP_FONT_FAMILIES.displayItalic,
                          fontStyle: "italic",
                          fontSize: 24,
                          color: glass.text.fg,
                        }}
                      >
                        {t("buildDetail.teamHeading")}
                      </Text>
                    </View>
                    <PhotoPill
                      variant="outline"
                      size="sm"
                      label={t("buildDetail.inviteCollaborator")}
                      onPress={() => setInviteModalOpen(true)}
                    />
                  </View>

                  {collaborators.length === 0 ? (
                    <GlassBody size={13} tone="fg55" style={{ marginTop: 12 }}>
                      {t("buildDetail.collaboratorsEmpty")}
                    </GlassBody>
                  ) : (
                    <View style={{ marginTop: 12, gap: 8 }}>
                      {collaborators.map((collaborator) => (
                        <View
                          key={collaborator.userId}
                          style={{
                            minHeight: 44,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            borderRadius: 10,
                            borderWidth: borderWidth.hairline,
                            borderColor: glass.border.divider,
                            backgroundColor: glass.surface.field,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                          }}
                        >
                          <GlassBody
                            size={13}
                            tone="fg"
                            numberOfLines={1}
                            style={{ minWidth: 0, flex: 1 }}
                          >
                            {collaborator.name ??
                              collaborator.username ??
                              collaborator.email ??
                              collaborator.userId}
                          </GlassBody>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <GlassMeta size={9} tone="fg55">
                              {collaborator.role === "editor"
                                ? t("buildDetail.roleEditor")
                                : collaborator.role === "viewer"
                                  ? t("buildDetail.roleViewer")
                                  : collaborator.role}
                            </GlassMeta>
                            <Pressable
                              onPress={() => confirmRemoveCollaborator(collaborator.userId)}
                              accessibilityRole="button"
                              hitSlop={8}
                              style={{ minHeight: 34, justifyContent: "center" }}
                            >
                              <GlassMeta size={9} tone="danger" bold>
                                {t("buildDetail.inviteRemove")}
                              </GlassMeta>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}
            </ScrollView>
          ) : null}

          {tab === "explorer" ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
              scrollEnabled={!explorerMove.dragMeta}
            >
              <GlassTextField
                value={explorerSearch}
                onChangeText={setExplorerSearch}
                placeholder={t("elements.searchPlaceholder")}
              />

              <View
                style={{
                  marginTop: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <GlassMeta size={9} tone="fg55">
                  {explorerSearch.trim()
                    ? t("buildDetail.explorerMatches", {
                        defaultValue: "{{count}} matches",
                        count: filteredRoots.length,
                      })
                    : t("buildDetail.explorerRoots", {
                        defaultValue: "{{count}} roots",
                        count: orderedRoots.length,
                      })}
                </GlassMeta>
                <PhotoPill
                  variant="outline"
                  size="sm"
                  label={t("buildDetail.linkElements")}
                  onPress={openLinkElements}
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{
                  marginTop: 12,
                  borderBottomWidth: borderWidth.hairline,
                  borderBottomColor: glass.border.divider,
                }}
                contentContainerStyle={{ paddingBottom: 10 }}
                scrollEnabled={!explorerMove.dragMeta}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Pressable
                    onPress={() => {
                      setSelectedPath([]);
                      void inspector.commitSelection(null);
                    }}
                    style={{ minHeight: 28, justifyContent: "center" }}
                  >
                    <GlassBody size={12} tone="fg70">
                      {build.name}
                    </GlassBody>
                  </Pressable>
                  {selectedPath.map((segment, index) => (
                    <View
                      key={`${segment.meta.nodeId}-${index}`}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                    >
                      <GlassBody size={12} tone="fg45">
                        /
                      </GlassBody>
                      <Pressable
                        onPress={() =>
                          openNodeSheet(segment.meta, selectedPath.slice(0, index + 1))
                        }
                        style={{ minHeight: 28, justifyContent: "center" }}
                      >
                        <GlassBody
                          size={12}
                          tone={index === selectedPath.length - 1 ? "fg" : "fg70"}
                        >
                          {segment.label}
                        </GlassBody>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View style={{ marginTop: 12, gap: 8 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <PhotoPill
                    variant="outline"
                    size="sm"
                    label={t("elements.newElementShort")}
                    onPress={() => openQuickCreate("element")}
                  />
                  <PhotoPill
                    variant="outline"
                    size="sm"
                    label={t("elements.newMaterialShort")}
                    onPress={() => openQuickCreate("material")}
                  />
                  {inspector.selected?.nodeId ? (
                    <>
                      <PhotoPill
                        variant="outline"
                        size="sm"
                        label={t("buildDetail.addChildElement", { defaultValue: "Child element" })}
                        onPress={() => openQuickCreate("element", inspector.selected?.nodeId)}
                      />
                      <PhotoPill
                        variant="outline"
                        size="sm"
                        label={t("buildDetail.addChildMaterial", {
                          defaultValue: "Child material",
                        })}
                        onPress={() => openQuickCreate("material", inspector.selected?.nodeId)}
                      />
                    </>
                  ) : null}
                </View>
                {inspector.selectedDetail ? (
                  <GlassBody size={12} tone="fg55">
                    {t("buildDetail.explorerSelectionHint", {
                      defaultValue:
                        "Select a node to open detail, create children, or reorganize the tree.",
                    })}
                  </GlassBody>
                ) : null}
              </View>

              <View style={{ marginTop: 14 }}>
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
                    <GlassBody
                      size={13}
                      tone="fg55"
                      style={{ paddingVertical: 24, textAlign: "center" }}
                    >
                      {t("buildDetail.outlineEmpty")}
                    </GlassBody>
                  )
                ) : orderedRoots.length > 0 ? (
                  <>
                    <GlassMeta size={9} tone="fg55" style={{ marginBottom: 10 }}>
                      {t("buildDetail.explorerDragHelper", {
                        defaultValue: "Long-press a row to drag, nest, or reorder",
                      })}
                    </GlassMeta>
                    {explorerMove.dragMeta ? (
                      <View
                        ref={explorerMove.registerRootDropZone}
                        style={{
                          marginBottom: 10,
                          borderRadius: 10,
                          borderWidth:
                            explorerMove.dragVisualState.dragOverNodeId === "__root__" ? 1.5 : 1,
                          borderColor:
                            explorerMove.dragVisualState.dragOverNodeId === "__root__"
                              ? glass.drop.intoRing
                              : glass.border.divider,
                          backgroundColor:
                            explorerMove.dragVisualState.dragOverNodeId === "__root__"
                              ? glass.surface.active
                              : glass.surface.field,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                        }}
                      >
                        <GlassMeta size={9} tone="fg70">
                          {t("buildDetail.dropToRootLabel", {
                            defaultValue: "Drop here to move to root",
                          })}
                        </GlassMeta>
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
                  <GlassBody
                    size={13}
                    tone="fg55"
                    style={{ paddingVertical: 24, textAlign: "center" }}
                  >
                    {t("buildDetail.outlineEmpty")}
                  </GlassBody>
                )}
              </View>
            </ScrollView>
          ) : null}

          {tab === "tasks" ? (
            <View style={{ flex: 1, paddingBottom: 12 }}>
              <BuildWorkflowTasks buildId={buildId} userId={userId} t={t} />
            </View>
          ) : null}

          {tab === "board" ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
              {boardPanel(false)}
            </ScrollView>
          ) : null}

          {tab === "updates" ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
            >
              <BuildProgressTimeline buildId={buildId} userId={userId} />
            </ScrollView>
          ) : null}
        </GlassPanel>
      </View>

      {explorerMove.dragMeta && explorerMove.dragVisualState.dragPoint ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: Math.max(12, explorerMove.dragVisualState.dragPoint.x - rootFrame.x - 120),
            top: Math.max(12, explorerMove.dragVisualState.dragPoint.y - rootFrame.y - 36),
          }}
        >
          <View
            style={{
              borderRadius: 999,
              backgroundColor: glass.surface.solid,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <GlassMeta size={10} tone="ink" bold>
              {explorerMove.dragMeta.name}
            </GlassMeta>
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

      <Modal
        visible={boardFullscreen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setBoardFullscreen(false)}
      >
        <View style={{ flex: 1 }}>
          <PhotoBackdrop
            imageUrl={heroUri}
            focalX={build.imageFocalX}
            focalY={build.imageFocalY}
            kenBurns={false}
          />
          <View
            style={{
              flex: 1,
              paddingHorizontal: 16,
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <GlassPanel style={{ flex: 1 }}>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
                {boardPanel(true)}
              </ScrollView>
            </GlassPanel>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!boardLightbox}
        animationType="fade"
        transparent
        onRequestClose={() => setBoardLightbox(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: glass.statusCutout,
            paddingHorizontal: 16,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <View
            style={{
              marginBottom: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ minWidth: 0, flex: 1 }}>
              <GlassMeta size={10} tone="fg70" bold>
                {boardLightbox?.label ?? ""}
              </GlassMeta>
              {boardLightbox?.dayLabel ? (
                <GlassBody size={12} tone="fg55" style={{ marginTop: 4 }}>
                  {boardLightbox.dayLabel}
                </GlassBody>
              ) : null}
            </View>
            <PhotoPill
              variant="outline"
              size="sm"
              label={t("common.close", { defaultValue: "Close" })}
              onPress={() => setBoardLightbox(null)}
            />
          </View>
          <View
            style={{
              flex: 1,
              overflow: "hidden",
              borderRadius: 16,
              borderWidth: borderWidth.hairline,
              borderColor: glass.border.divider,
            }}
          >
            {boardLightbox ? (
              <ConvexStorageImage
                storageId={boardLightbox.imageStorageId}
                imageUrl={boardLightbox.imageUrl}
                className="h-full w-full"
              />
            ) : null}
          </View>
        </View>
      </Modal>

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
        style={
          quickCreateOpen
            ? { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: glass.scrimDim }
            : { display: "none" }
        }
        onPress={() => {
          if (!quickCreateBusy) setQuickCreateOpen(false);
        }}
      >
        {quickCreateOpen ? (
          <Pressable
            style={[
              SHEET_STYLE,
              {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                paddingHorizontal: 20,
                paddingTop: 14,
                paddingBottom: insets.bottom + 24,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <SheetGrip />
            <Text
              style={{
                fontFamily: APP_FONT_FAMILIES.displayItalic,
                fontStyle: "italic",
                fontSize: 22,
                color: glass.text.fg,
              }}
            >
              {quickCreateParentId
                ? t("buildDetail.quickCreateChildTitle", { defaultValue: "Create child node" })
                : t("buildDetail.quickCreateRootTitle", { defaultValue: "Create linked node" })}
            </Text>
            <GlassBody size={13} tone="fg70" style={{ marginTop: 6 }}>
              {quickCreateParentId
                ? t("buildDetail.quickCreateChildBody", {
                    defaultValue: "Add a new node directly under the currently selected element.",
                  })
                : t("buildDetail.quickCreateRootBody", {
                    defaultValue:
                      "Add a brand-new element or material directly into this build explorer.",
                  })}
            </GlassBody>
            <View style={{ marginTop: 14 }}>
              <GlassTextField
                value={quickCreateName}
                onChangeText={setQuickCreateName}
                placeholder={t("elements.namePlaceholder")}
              />
            </View>
            <View style={{ marginTop: 14 }}>
              <SegmentedPair
                options={[
                  { value: "element", label: t("elements.typeElement") },
                  { value: "material", label: t("elements.typeMaterial") },
                ]}
                value={quickCreateType}
                onChange={setQuickCreateType}
              />
            </View>
            <View style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
              <GlassOutlineButton
                label={t("common.cancel")}
                onPress={() => setQuickCreateOpen(false)}
                style={{ flex: 1 }}
              />
              <GlassSolidButton
                label={quickCreateBusy ? t("elements.creating") : t("elements.create")}
                onPress={() => void handleQuickCreate()}
                disabled={!quickCreateName.trim() || quickCreateBusy}
                style={{ flex: 1 }}
              />
            </View>
          </Pressable>
        ) : null}
      </Pressable>

      <Pressable
        style={
          inviteModalOpen
            ? {
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                zIndex: 60,
                backgroundColor: glass.scrimDim,
              }
            : { display: "none" }
        }
        onPress={() => {
          if (!invitePending) setInviteModalOpen(false);
        }}
      >
        {inviteModalOpen ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1, justifyContent: "flex-end" }}
          >
            <Pressable
              style={[
                SHEET_STYLE,
                {
                  paddingHorizontal: 20,
                  paddingTop: 14,
                  paddingBottom: insets.bottom + 24,
                },
              ]}
              onPress={(event) => event.stopPropagation()}
            >
              <SheetGrip />
              <View
                style={{
                  marginBottom: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.displayItalic,
                    fontStyle: "italic",
                    fontSize: 22,
                    color: glass.text.fg,
                  }}
                >
                  {t("buildDetail.inviteModalTitle")}
                </Text>
                <PhotoPill
                  variant="outline"
                  size="sm"
                  label={t("buildDetail.inviteDone")}
                  onPress={() => {
                    if (!invitePending) setInviteModalOpen(false);
                  }}
                />
              </View>
              <GlassBody size={13} tone="fg70">
                {t("buildDetail.inviteModalBody")}
              </GlassBody>
              {inviteFeedback ? (
                <View
                  style={{
                    marginTop: 12,
                    borderRadius: 10,
                    borderWidth: borderWidth.hairline,
                    borderColor: glass.border.divider,
                    backgroundColor: glass.surface.field,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <GlassBody size={13} tone="fg">
                    {inviteFeedback}
                  </GlassBody>
                </View>
              ) : null}
              {inviteError ? (
                <GlassBody size={13} tone="danger" style={{ marginTop: 12 }}>
                  {inviteError}
                </GlassBody>
              ) : null}
              <View style={{ marginTop: 16 }}>
                <GlassTextField
                  label={t("buildDetail.inviteEmailLabel")}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder={t("buildDetail.inviteEmailPlaceholder")}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!invitePending}
                />
              </View>
              <GlassMeta size={10} tone="fg70" bold style={{ marginTop: 16, marginBottom: 8 }}>
                {t("buildDetail.inviteRoleLabel")}
              </GlassMeta>
              <SegmentedPair
                options={[
                  { value: "viewer", label: t("buildDetail.roleViewer") },
                  { value: "editor", label: t("buildDetail.roleEditor") },
                ]}
                value={inviteRole}
                onChange={setInviteRole}
                disabled={invitePending}
              />
              <GlassSolidButton
                label={invitePending ? t("buildDetail.inviteSending") : t("buildDetail.inviteSend")}
                onPress={() => void handleSendCollaboratorInvite()}
                disabled={invitePending || !inviteEmail.trim()}
                style={{ marginTop: 20 }}
              />
            </Pressable>
          </KeyboardAvoidingView>
        ) : null}
      </Pressable>
    </View>
  );
}
