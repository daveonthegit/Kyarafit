/**
 * Kyarafit → Cosapp.si converter ("Download for Cosapp.si").
 *
 * Turns one account's live Kyarafit rows into the rows of a Cosapp.si backup (`.cosapp`, format
 * `cosapp.si/backup`, schema version 2), meant to be imported in Cosapp.si with **Merge**. Pure and
 * dependency-free: the Convex action runs it on the server; the browser zips the result with the
 * photo bytes (see `web/src/lib/cosappArchive.ts`).
 *
 * Mapping rules (Cosapp.si allows one level of pieces and one flat task list):
 * - builds → builds; the build image becomes the build's `cover` photo.
 * - elements/materials (`cosplayNodes`) → pieces of their build. Nested parts are flattened to
 *   "Parent › Child" names. A node without a build inherits its ancestor's build, else the build a
 *   task attachment ties it to, else it goes into one "From Kyarafit library" idea build.
 * - hand-written workflow items → tasks (title, done, due date, notes; owner from attachments).
 *   Subtasks become "Parent › Step" tasks right after their parent. Generated Buy / Work on / Pack
 *   tasks are dropped (piece status and Cosapp's packing generator replace them); cancelled tasks
 *   are skipped.
 * - conventions, day plans and packing lists → conventions, dayPlans and packingItems.
 * - reference, process and progress-update photos → photos with captions and dates.
 * - social data (likes, comments, follows, groups, collaborators) is not carried over.
 *
 * Every id is derived from the Kyarafit id and every timestamp from the Kyarafit row, never from
 * the clock, so importing a newer export with Merge updates rows instead of duplicating them, and a
 * row the user has since edited in Cosapp.si keeps their edit (newer wins).
 */

export const COSAPP_BACKUP_FORMAT = "cosapp.si/backup";
/** Cosapp.si `BACKUP_SCHEMA_VERSION` this converter writes (photo covers, piece and convention photos). */
export const COSAPP_BACKUP_SCHEMA_VERSION = 2;
export const COSAPP_BACKUP_EXTENSION = "cosapp";
/** Written as the backup's `appVersion` so a Cosapp.si import can tell where the file came from. */
export const COSAPP_CONVERTER_VERSION = "kyarafit-converter/1";
export const EXPORT_MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const PHOTO_BATCH_BYTES = 4 * 1024 * 1024;
export const MAX_PHOTOS_PER_CALL = 200;
/** Name of the receipt entry inside the archive. Cosapp.si's import ignores entries outside `photos/`. */
export const COSAPP_RECEIPT_ENTRY = "kyarafit-receipt.json";
export const LIBRARY_BUILD_NAME = "From Kyarafit library";
/** Separator for flattened names ("Armor › Pauldron"). */
export const PATH_SEPARATOR = " › ";

// ---- Kyarafit input (plain shapes of the Convex documents; ids are strings) -------------------

interface KyRow {
  _id: string;
  _creationTime: number;
  updatedAt?: number;
  deletedAt?: number;
}

export interface KyBuild extends KyRow {
  name: string;
  character?: string;
  status: string;
  notes?: string;
  imageUrl?: string;
  imageStorageId?: string;
  budgetCents?: number;
  targetDate?: string;
}

export interface KyCosplayNode extends KyRow {
  buildId?: string;
  parentNodeId?: string;
  sortOrder?: number;
  nodeType: string;
  name: string;
  category?: string;
  tags?: string[];
  notes?: string;
  imageUrl?: string;
  imageStorageId?: string;
  sourceUrl?: string;
  pricingMode?: string;
  directCostCents?: number;
  unitCostCents?: number;
  quantity?: number;
  unit?: string;
  purchaseStatus?: string;
  buildStatus?: string;
  materialStatus?: string;
  manualOverallBucket?: string;
  buildInstructions?: string;
}

export interface KyWorkflowItem extends KyRow {
  title: string;
  notes?: string;
  status: string;
  parentId?: string;
  sortOrder: number;
  sourceKind: string;
  dueDate?: string;
}

export interface KyWorkflowAttachment extends KyRow {
  workflowItemId: string;
  entityType: string;
  entityId: string;
  role: string;
  buildContextId?: string;
}

export interface KyConvention extends KyRow {
  name: string;
  location?: string;
  imageUrl?: string;
  imageStorageId?: string;
  startDate: string;
  endDate: string;
  archived?: boolean;
}

export interface KyDayPlan extends KyRow {
  conventionId: string;
  date: string;
  buildId?: string;
  notes?: string;
}

export interface KyPackingItem extends KyRow {
  conventionId: string;
  cosplayNodeId?: string;
  label: string;
  notes?: string;
  checked: boolean;
  sortOrder?: number;
}

export interface KyBuildImage extends KyRow {
  buildId: string;
  imageStorageId?: string;
  imageUrl?: string;
  sortOrder: number;
}

export type KyImageRef =
  | { kind: "local"; uri: string; imageKey: string }
  | { kind: "url"; url: string }
  | { kind: "cloud"; storageId: string; imageKey: string };

export interface KyProgressUpdate extends KyRow {
  buildId: string;
  createdAt: number;
  note?: string;
  imageRefs: KyImageRef[];
  progressPercent?: number;
}

/** What the server knows about a stored file (`_storage` system metadata). */
export interface KyStoredFile {
  storageId: string;
  size: number;
  contentType?: string;
  failure?: "missingImage" | "unsupportedImage" | "oversizeImage";
}

export interface KyarafitSnapshot {
  accountId: string;
  builds: KyBuild[];
  cosplayNodes: KyCosplayNode[];
  workflowItems: KyWorkflowItem[];
  workflowAttachments: KyWorkflowAttachment[];
  conventions: KyConvention[];
  conventionDayPlans: KyDayPlan[];
  packingListItems: KyPackingItem[];
  buildReferenceImages: KyBuildImage[];
  buildProcessPictures: KyBuildImage[];
  buildProgressUpdates: KyProgressUpdate[];
  /** Metadata for every storage id the rows above reference; a missing entry = file is gone. */
  storedFiles: KyStoredFile[];
}

// ---- Cosapp.si output (mirrors `packages/domain/src/types.ts` at schema version 2) -----------

interface CosappRow {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface CosappBuild extends CosappRow {
  character: string;
  series: string | null;
  status: "idea" | "in_progress" | "complete" | "archived";
  targetDate: string | null;
  targetLabel: string | null;
  budgetCents: number | null;
  notes: string | null;
}

export interface CosappPiece extends CosappRow {
  buildId: string;
  name: string;
  kind: "make" | "buy";
  status: "todo" | "in_progress" | "done";
  costCents: number | null;
  link: string | null;
  notes: string | null;
  position: number;
}

export interface CosappTask extends CosappRow {
  ownerKind: "build" | "none" | "convention";
  buildId: string | null;
  pieceId: string | null;
  conventionId: string | null;
  title: string;
  done: boolean;
  dueDate: string | null;
  remindAt: number | null;
  notes: string | null;
  position: number;
}

export interface CosappPhoto extends CosappRow {
  buildId: string | null;
  kind: "progress" | "reference" | "cover";
  fileName: string;
  caption: string | null;
  takenAt: number;
  pieceId: string | null;
  conventionId: string | null;
}

export interface CosappConvention extends CosappRow {
  name: string;
  startDate: string;
  endDate: string;
  location: string | null;
  badgeNote: string | null;
  hotelNote: string | null;
  notes: string | null;
}

export interface CosappDayPlan extends CosappRow {
  conventionId: string;
  date: string;
  buildId: string | null;
}

export interface CosappPackingItem extends CosappRow {
  conventionId: string;
  key: string;
  label: string;
  source: "generated" | "manual";
  checked: boolean;
  buildId: string | null;
  pieceId: string | null;
  position: number;
}

export interface CosappRows {
  builds: CosappBuild[];
  pieces: CosappPiece[];
  tasks: CosappTask[];
  photos: CosappPhoto[];
  conventions: CosappConvention[];
  dayPlans: CosappDayPlan[];
  packingItems: CosappPackingItem[];
}

export type CosappTable = keyof CosappRows;
export const COSAPP_TABLES: readonly CosappTable[] = [
  "builds",
  "pieces",
  "tasks",
  "photos",
  "conventions",
  "dayPlans",
  "packingItems",
];

export interface CosappBackupData {
  format: typeof COSAPP_BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: number;
  appVersion: string;
  rows: CosappRows;
}

/** One photo file the archive must carry: `photos/<fileName>` holds the bytes of `storageId`. */
export interface CosappPhotoFile {
  fileName: string;
  storageId: string;
  size: number;
}

// ---- Receipt -----------------------------------------------------------------------------------

/** Something carried over in a changed shape. */
export type CosappReshapeKind =
  | "subtaskFlattened"
  | "nestedPieceFlattened"
  | "libraryPiece"
  | "materialAsBuyPiece"
  | "progressNoteInBuildNotes"
  | "dayPlanNoteInConventionNotes";

/** Something not carried over, by reason. */
export type CosappDropKind =
  | "generatedTask"
  | "cancelledTask"
  | "ownerUnavailable"
  | "deviceOnlyImage"
  | "missingImage"
  | "unsupportedImage"
  | "oversizeImage"
  | "invalidConvention"
  | "dayPlanOutsideConvention"
  | "duplicateDayPlan"
  | "duplicatePackingItem"
  | "socialData";

export interface CosappReceipt {
  /** Live rows written per Cosapp.si table, and photo files in the archive. */
  counts: Record<CosappTable, number> & { photoFiles: number };
  droppedImages: { image: string; reason: CosappDropKind }[];
  reshaped: { kind: CosappReshapeKind; count: number }[];
  /** `count` is null for whole categories that are never exported (social data). */
  dropped: { kind: CosappDropKind; count: number | null }[];
}

export interface CosappExport {
  data: CosappBackupData;
  photoFiles: CosappPhotoFile[];
  photoSources: string[];
  receipt: CosappReceipt;
}

// ---- Helpers -------------------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(value: string | undefined): string | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? value
    : null;
}

function text(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function joinNotes(parts: (string | null | undefined)[]): string | null {
  const kept = parts.map((p) => text(p)).filter((p): p is string => p !== null);
  return kept.length ? kept.join("\n\n") : null;
}

function cents(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function stamps(row: KyRow, dependencies: { updatedAt?: number; _creationTime?: number }[] = []): CosappRow {
  const createdAt = Math.floor(row._creationTime);
  const updatedAt =
    typeof row.updatedAt === "number" && Number.isFinite(row.updatedAt)
      ? Math.max(Math.floor(row.updatedAt), createdAt)
      : createdAt;
  return {
    id: "", createdAt,
    updatedAt: dependencies.reduce((latest, dependency) => Math.max(latest,
      typeof dependency.updatedAt === "number" && Number.isFinite(dependency.updatedAt) ? Math.floor(dependency.updatedAt) : 0,
      typeof dependency._creationTime === "number" && Number.isFinite(dependency._creationTime) ? Math.floor(dependency._creationTime) : 0), updatedAt),
    deletedAt: null,
  };
}

function live<T extends KyRow>(rows: T[]): T[] {
  return rows.filter((row) => row.deletedAt == null);
}

function bySortOrder<T extends KyRow & { sortOrder?: number }>(a: T, b: T): number {
  return (
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
    a._creationTime - b._creationTime ||
    a._id.localeCompare(b._id)
  );
}

function dayString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Cosapp.si ids for Kyarafit rows. Convex ids are lowercase alphanumerics, so these stay file-name safe. */
export const cosappId = {
  build: (id: string) => `ky-b-${id}`,
  piece: (id: string) => `ky-p-${id}`,
  task: (id: string) => `ky-t-${id}`,
  convention: (id: string) => `ky-c-${id}`,
  packingItem: (id: string) => `ky-k-${id}`,
  libraryBuild: (accountId: string) => `ky-b-library-${encodeURIComponent(accountId)}`,
};

class Receipt {
  private reshapedCounts = new Map<CosappReshapeKind, number>();
  private droppedCounts = new Map<CosappDropKind, number>();
  private droppedImages: CosappReceipt["droppedImages"] = [];

  dropImage(image: string, reason: CosappDropKind) {
    this.droppedImages.push({ image, reason });
    this.drop(reason);
  }

  reshape(kind: CosappReshapeKind, count = 1) {
    this.reshapedCounts.set(kind, (this.reshapedCounts.get(kind) ?? 0) + count);
  }

  drop(kind: CosappDropKind, count = 1) {
    this.droppedCounts.set(kind, (this.droppedCounts.get(kind) ?? 0) + count);
  }

  build(rows: CosappRows, photoFiles: number): CosappReceipt {
    const counts = Object.fromEntries(
      COSAPP_TABLES.map((table) => [table, rows[table].length])
    ) as Record<CosappTable, number>;
    return {
      counts: { ...counts, photoFiles },
      droppedImages: this.droppedImages,
      reshaped: [...this.reshapedCounts].map(([kind, count]) => ({ kind, count })),
      dropped: [
        ...[...this.droppedCounts].map(([kind, count]) => ({ kind, count })),
        { kind: "socialData" as const, count: null },
      ],
    };
  }
}

// ---- Converter -----------------------------------------------------------------------------------

export interface ConvertOptions {
  /** `exportedAt` of the backup (the only clock reading; rows never use it). */
  now: number;
}

export function convertKyarafitToCosapp(
  snapshot: KyarafitSnapshot,
  options: ConvertOptions
): CosappExport {
  const receipt = new Receipt();
  const files = new Map(snapshot.storedFiles.map((file) => [file.storageId, file]));
  const photoFiles: CosappPhotoFile[] = [];
  const photos: CosappPhoto[] = [];

  const photoSources = new Set<string>();
  const addPhoto = (
    image: { storageId?: string; url?: string },
    row: Omit<CosappPhoto, "fileName">
  ): "added" | "dropped" => {
    const source = image.storageId || text(image.url);
    if (!source) return "dropped";
    if (!image.storageId && !/^https?:\/\//i.test(source)) {
      receipt.dropImage(source, "deviceOnlyImage");
      return "dropped";
    }
    photoSources.add(source);
    const file = files.get(source);
    if (!file || file.failure || file.size <= 0) {
      receipt.dropImage(source, file?.failure ?? "missingImage");
      return "dropped";
    }
    const mime = file.contentType?.split(";")[0].trim().toLowerCase() ?? "";
    // No usable type recorded: keep it for now; the archive builder checks the bytes themselves.
    const extension =
      mime === "" || mime === "application/octet-stream" ? "jpg" : IMAGE_EXTENSIONS[mime];
    if (!extension) {
      receipt.dropImage(source, "unsupportedImage");
      return "dropped";
    }
    if (file.size > EXPORT_MAX_PHOTO_BYTES) {
      receipt.dropImage(source, "oversizeImage");
      return "dropped";
    }
    const fileName = `${row.id}.${extension}`;
    photos.push({ ...row, fileName });
    photoFiles.push({ fileName, storageId: source, size: file.size });
    return "added";
  };

  // -- builds
  const kyBuilds = live(snapshot.builds).sort(
    (a, b) => a._creationTime - b._creationTime || a._id.localeCompare(b._id)
  );
  const buildNotes = new Map<string, (string | null)[]>();
  const builds: CosappBuild[] = [];
  const buildRow = new Map<string, CosappBuild>();
  for (const build of kyBuilds) {
    const id = cosappId.build(build._id);
    const name = text(build.name);
    const character = text(build.character) ?? name ?? "Untitled build";
    const row: CosappBuild = {
      ...stamps(build),
      id,
      character,
      series: null,
      status: buildStatus(build.status),
      targetDate: isoDate(build.targetDate),
      targetLabel: null,
      budgetCents: cents(build.budgetCents),
      notes: null,
    };
    builds.push(row);
    buildRow.set(build._id, row);
    buildNotes.set(build._id, [name && name !== character ? name : null, build.notes ?? null]);
  }
  const exportedBuild = (kyBuildId: string | undefined) =>
    kyBuildId ? buildRow.get(kyBuildId) : undefined;

  for (const build of kyBuilds) {
    const row = buildRow.get(build._id)!;
    addPhoto(
      { storageId: build.imageStorageId, url: build.imageUrl },
      {
        ...stamps(build),
        id: `ky-cover-b-${build._id}`,
        buildId: row.id,
        kind: "cover",
        caption: null,
        takenAt: Math.floor(build._creationTime),
        pieceId: null,
        conventionId: null,
      }
    );
  }

  // -- pieces
  const nodes = new Map(live(snapshot.cosplayNodes).map((node) => [node._id, node]));
  const liveAttachments = live(snapshot.workflowAttachments);
  const nodeContextBuild = new Map<string, string>();
  for (const attachment of liveAttachments) {
    if (attachment.entityType !== "cosplayNode" || !attachment.buildContextId) continue;
    if (!exportedBuild(attachment.buildContextId)) continue;
    if (!nodeContextBuild.has(attachment.entityId)) {
      nodeContextBuild.set(attachment.entityId, attachment.buildContextId);
    }
  }
  /** Ancestors from the root down to the node itself; a missing or deleted parent ends the chain. */
  const lineage = (node: KyCosplayNode): KyCosplayNode[] => {
    const chain = [node];
    const seen = new Set([node._id]);
    let current = node;
    while (current.parentNodeId) {
      const parent = nodes.get(current.parentNodeId);
      if (!parent || seen.has(parent._id)) break;
      chain.unshift(parent);
      seen.add(parent._id);
      current = parent;
    }
    return chain;
  };
  type Placement = { kind: "build"; kyBuildId: string } | { kind: "library" } | { kind: "gone" };
  const placeNode = (chain: KyCosplayNode[]): Placement => {
    for (const node of [...chain].reverse()) {
      if (node.buildId) {
        return exportedBuild(node.buildId)
          ? { kind: "build", kyBuildId: node.buildId }
          : { kind: "gone" };
      }
    }
    for (const node of [...chain].reverse()) {
      const context = nodeContextBuild.get(node._id);
      if (context) return { kind: "build", kyBuildId: context };
    }
    return { kind: "library" };
  };

  const orderedNodes = treeOrder([...nodes.values()], (node) => node.parentNodeId, nodes);
  const libraryNodes = orderedNodes.filter((node) => placeNode(lineage(node)).kind === "library");
  let libraryBuildId: string | null = null;
  if (libraryNodes.length) {
    const first = [...libraryNodes].sort(
      (a, b) => a._creationTime - b._creationTime || a._id.localeCompare(b._id)
    )[0];
    const latest = Math.max(...libraryNodes.map((node) => stamps(node).updatedAt));
    libraryBuildId = cosappId.libraryBuild(snapshot.accountId);
    builds.push({
      ...stamps(first),
      updatedAt: Math.max(latest, Math.floor(first._creationTime)),
      id: libraryBuildId,
      character: LIBRARY_BUILD_NAME,
      series: null,
      status: "idea",
      targetDate: null,
      targetLabel: null,
      budgetCents: null,
      notes:
        "Elements from your Kyarafit library that weren't part of a build. Move them into a build or delete them.",
    });
  }

  const pieces: CosappPiece[] = [];
  const pieceRow = new Map<string, CosappPiece>();
  const piecePosition = new Map<string, CosappPiece>();
  for (const node of orderedNodes) {
    const chain = lineage(node);
    const placement = placeNode(chain);
    if (placement.kind === "gone") {
      receipt.drop("ownerUnavailable");
      continue;
    }
    const buildId =
      placement.kind === "build" ? buildRow.get(placement.kyBuildId)!.id : libraryBuildId!;
    if (placement.kind === "library") receipt.reshape("libraryPiece");
    if (chain.length > 1) receipt.reshape("nestedPieceFlattened");
    const material = node.nodeType === "material";
    if (material) receipt.reshape("materialAsBuyPiece");
    const previous = piecePosition.get(buildId);
    const position = previous ? previous.position + 1 : 0;
    const name =
      chain
        .map((n) => text(n.name))
        .filter(Boolean)
        .join(PATH_SEPARATOR) || "Untitled piece";
    const row: CosappPiece = {
      ...stamps(node, [...chain, ...liveAttachments.filter((attachment) => attachment.entityType === "cosplayNode" && chain.some((ancestor) => ancestor._id === attachment.entityId)), ...(previous ? [previous] : [])]),
      id: cosappId.piece(node._id),
      buildId,
      name,
      kind: material || (node.purchaseStatus && !node.buildStatus) ? "buy" : "make",
      status: pieceStatus(node),
      costCents: pieceCost(node),
      link: text(node.sourceUrl),
      notes: null,
      position,
    };
    const notes: (string | null)[] = [
      node.notes ?? null,
      node.buildInstructions ?? null,
      node.category ? `Category: ${node.category}` : null,
      node.tags?.length ? `Tags: ${node.tags.join(", ")}` : null,
      node.quantity && node.quantity > 1
        ? `Quantity: ${node.quantity}${node.unit ? ` ${node.unit}` : ""}`
        : null,
    ];
    addPhoto(
      { storageId: node.imageStorageId, url: node.imageUrl },
      {
        ...stamps(node, [row]),
        id: `ky-ph-n-${node._id}`,
        buildId,
        kind: "reference",
        caption: null,
        takenAt: Math.floor(node._creationTime),
        pieceId: row.id,
        conventionId: null,
      }
    );
    row.notes = joinNotes(notes);
    pieces.push(row);
    pieceRow.set(node._id, row);
    piecePosition.set(buildId, row);
  }

  // -- build photos: references, process pictures, progress updates
  const galleries: [KyBuildImage[], "reference" | "progress", string][] = [
    [snapshot.buildReferenceImages, "reference", "r"],
    [snapshot.buildProcessPictures, "progress", "g"],
  ];
  for (const [rows, kind, tag] of galleries) {
    for (const image of live(rows).sort(bySortOrder)) {
      const build = exportedBuild(image.buildId);
      if (!build) {
        receipt.drop("ownerUnavailable");
        continue;
      }
      addPhoto(
        { storageId: image.imageStorageId, url: image.imageUrl },
        {
          ...stamps(image),
          id: `ky-ph-${tag}-${image._id}`,
          buildId: build.id,
          kind,
          caption: null,
          takenAt: Math.floor(image._creationTime),
          pieceId: null,
          conventionId: null,
        }
      );
    }
  }
  for (const update of live(snapshot.buildProgressUpdates).sort(
    (a, b) => a.createdAt - b.createdAt || a._id.localeCompare(b._id)
  )) {
    const build = exportedBuild(update.buildId);
    if (!build) {
      receipt.drop("ownerUnavailable");
      continue;
    }
    build.updatedAt = Math.max(build.updatedAt, stamps(update).updatedAt);
    const note = text(update.note);
    const percent =
      typeof update.progressPercent === "number" && Number.isFinite(update.progressPercent)
        ? ` (${Math.round(update.progressPercent)}%)`
        : "";
    let added = 0;
    update.imageRefs.forEach((ref, index) => {
      if (ref.kind === "local") {
        // The file only ever lived on the device that took it; the server never had the bytes.
        receipt.dropImage(ref.uri, "deviceOnlyImage");
        return;
      }
      const result = addPhoto(
        ref.kind === "cloud" ? { storageId: ref.storageId } : { url: ref.url },
        {
          ...stamps(update),
          id: `ky-ph-u-${update._id}-${index}`,
          buildId: build.id,
          kind: "progress",
          caption: note,
          takenAt: Math.floor(update.createdAt),
          pieceId: null,
          conventionId: null,
        }
      );
      if (result === "added") added += 1;
    });
    if (note && added === 0) {
      buildNotes.get(update.buildId)!.push(`Progress ${dayString(update.createdAt)}${percent}: ${note}`);
      receipt.reshape("progressNoteInBuildNotes");
    }
  }
  for (const build of kyBuilds) {
    buildRow.get(build._id)!.notes = joinNotes(buildNotes.get(build._id)!);
  }

  // -- conventions
  const conventions: CosappConvention[] = [];
  const conventionRow = new Map<string, CosappConvention>();
  const conventionNotes = new Map<string, (string | null)[]>();
  for (const convention of live(snapshot.conventions).sort(
    (a, b) => a._creationTime - b._creationTime || a._id.localeCompare(b._id)
  )) {
    const startDate = isoDate(convention.startDate);
    const name = text(convention.name);
    if (!startDate || !name) {
      receipt.drop("invalidConvention");
      continue;
    }
    const end = isoDate(convention.endDate);
    const row: CosappConvention = {
      ...stamps(convention),
      id: cosappId.convention(convention._id),
      name,
      startDate,
      endDate: end && end >= startDate ? end : startDate,
      location: text(convention.location),
      badgeNote: null,
      hotelNote: null,
      notes: null,
    };
    conventions.push(row);
    conventionRow.set(convention._id, row);
    conventionNotes.set(convention._id, [convention.archived ? "Archived in Kyarafit." : null]);
    addPhoto(
      { storageId: convention.imageStorageId, url: convention.imageUrl },
      {
        ...stamps(convention),
        id: `ky-cover-c-${convention._id}`,
        buildId: null,
        kind: "cover",
        caption: null,
        takenAt: Math.floor(convention._creationTime),
        pieceId: null,
        conventionId: row.id,
      }
    );
  }

  // -- day plans (one per convention day; the newest Kyarafit row wins)
  const dayPlans: CosappDayPlan[] = [];
  const newestDay = new Map<string, KyDayPlan>();
  for (const plan of live(snapshot.conventionDayPlans)) {
    const convention = conventionRow.get(plan.conventionId);
    if (!convention) {
      receipt.drop("ownerUnavailable");
      continue;
    }
    const date = isoDate(plan.date);
    if (!date || date < convention.startDate || date > convention.endDate) {
      receipt.drop("dayPlanOutsideConvention");
      continue;
    }
    const key = `${plan.conventionId}:${date}`;
    const prior = newestDay.get(key);
    if (prior) {
      receipt.drop("duplicateDayPlan");
      const priorStamp = stamps(prior).updatedAt;
      const stamp = stamps(plan).updatedAt;
      if (stamp < priorStamp || (stamp === priorStamp && plan._id < prior._id)) continue;
    }
    newestDay.set(key, plan);
  }
  const plannedBuilds = new Map<string, Set<string>>();
  for (const plan of [...newestDay.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.conventionId.localeCompare(b.conventionId)
  )) {
    const convention = conventionRow.get(plan.conventionId)!;
    const build = exportedBuild(plan.buildId);
    dayPlans.push({
      ...stamps(plan, [convention, ...(build ? [build] : [])]),
      id: `${convention.id}:${plan.date}`,
      conventionId: convention.id,
      date: plan.date,
      buildId: build?.id ?? null,
    });
    if (build) {
      const set = plannedBuilds.get(convention.id) ?? new Set<string>();
      set.add(build.id);
      plannedBuilds.set(convention.id, set);
    }
    convention.updatedAt = Math.max(convention.updatedAt, stamps(plan).updatedAt);
    const note = text(plan.notes);
    if (note) {
      conventionNotes.get(plan.conventionId)!.push(`${plan.date}: ${note}`);
      receipt.reshape("dayPlanNoteInConventionNotes");
    }
  }
  for (const [kyId, row] of conventionRow) row.notes = joinNotes(conventionNotes.get(kyId)!);

  // -- packing
  const packingItems: CosappPackingItem[] = [];
  const packingPosition = new Map<string, CosappPackingItem>();
  const packingKeys = new Set<string>();
  for (const item of live(snapshot.packingListItems).sort(bySortOrder)) {
    const convention = conventionRow.get(item.conventionId);
    if (!convention) {
      receipt.drop("ownerUnavailable");
      continue;
    }
    const piece = item.cosplayNodeId ? pieceRow.get(item.cosplayNodeId) : undefined;
    // Generated only when Cosapp.si's own generator would produce it, so a regenerate keeps it.
    const generated = piece && plannedBuilds.get(convention.id)?.has(piece.buildId);
    const id = cosappId.packingItem(item._id);
    const key = generated ? `piece:${piece.id}` : `manual:${id}`;
    const dedupe = `${convention.id}|${key}`;
    if (packingKeys.has(dedupe)) {
      receipt.drop("duplicatePackingItem");
      continue;
    }
    packingKeys.add(dedupe);
    const label = text(item.label) ?? piece?.name ?? "Item";
    const note = text(item.notes);
    const previous = packingPosition.get(convention.id);
    const position = previous ? previous.position + 1 : 0;
    const row: CosappPackingItem = {
      ...stamps(item, [convention, ...(piece ? [piece] : []), ...[...newestDay.values()].filter((plan) => plan.conventionId === item.conventionId), ...(previous ? [previous] : [])]),
      id,
      conventionId: convention.id,
      key,
      label: generated ? piece.name : note ? `${label} (${note})` : label,
      source: generated ? "generated" : "manual",
      checked: item.checked === true,
      buildId: generated ? piece.buildId : null,
      pieceId: generated ? piece.id : null,
      position,
    };
    packingItems.push(row);
    packingPosition.set(convention.id, row);
  }

  // -- tasks
  const items = new Map(live(snapshot.workflowItems).map((item) => [item._id, item]));
  const attachmentsByItem = new Map<string, KyWorkflowAttachment[]>();
  for (const attachment of liveAttachments) {
    const list = attachmentsByItem.get(attachment.workflowItemId) ?? [];
    list.push(attachment);
    attachmentsByItem.set(attachment.workflowItemId, list);
  }
  type Owner =
    | { kind: "build"; buildId: string; pieceId: string | null }
    | { kind: "convention"; conventionId: string }
    | { kind: "none" }
    | { kind: "gone" };
  const ownerCache = new Map<string, Owner>();
  const ownAttachmentOwner = (item: KyWorkflowItem): Owner | null => {
    const attachments = (attachmentsByItem.get(item._id) ?? []).filter((a) =>
      ["build", "cosplayNode", "convention"].includes(a.entityType)
    );
    if (!attachments.length) return null;
    for (const attachment of attachments) {
      if (attachment.entityType !== "cosplayNode") continue;
      const piece = pieceRow.get(attachment.entityId);
      if (piece) return { kind: "build", buildId: piece.buildId, pieceId: piece.id };
    }
    const builds = attachments
      .filter((a) => a.entityType === "build")
      .sort((a, b) => Number(b.role === "primary") - Number(a.role === "primary"));
    for (const attachment of builds) {
      const build = exportedBuild(attachment.entityId);
      if (build) return { kind: "build", buildId: build.id, pieceId: null };
    }
    for (const attachment of attachments) {
      if (attachment.entityType !== "convention") continue;
      const convention = conventionRow.get(attachment.entityId);
      if (convention) return { kind: "convention", conventionId: convention.id };
    }
    // A piece whose build was dropped still tells us its build context.
    for (const attachment of attachments) {
      if (attachment.entityType !== "cosplayNode") continue;
      const build = exportedBuild(attachment.buildContextId);
      if (build) return { kind: "build", buildId: build.id, pieceId: null };
    }
    return { kind: "gone" };
  };
  const ownerOf = (item: KyWorkflowItem, seen = new Set<string>()): Owner => {
    const cached = ownerCache.get(item._id);
    if (cached) return cached;
    const parent = item.parentId ? items.get(item.parentId) : undefined;
    const owner = parent && !seen.has(parent._id)
      ? ownerOf(parent, new Set([...seen, item._id]))
      : ownAttachmentOwner(item) ?? { kind: "none" as const };
    ownerCache.set(item._id, owner);
    return owner;
  };
  const titleOf = (item: KyWorkflowItem): { title: string; depth: number; ancestors: KyWorkflowItem[] } => {
    const parts = [text(item.title) ?? "Untitled task"];
    const ancestors = [item];
    const seen = new Set([item._id]);
    let current = item;
    while (current.parentId) {
      const parent = items.get(current.parentId);
      if (!parent || seen.has(parent._id)) break;
      parts.unshift(text(parent.title) ?? "Untitled task");
      ancestors.unshift(parent);
      seen.add(parent._id);
      current = parent;
    }
    return { title: parts.join(PATH_SEPARATOR), depth: parts.length - 1, ancestors };
  };

  const tasks: CosappTask[] = [];
  const taskPosition = new Map<string, CosappTask>();
  for (const item of treeOrder([...items.values()], (i) => i.parentId, items)) {
    if (item.sourceKind !== "manual") {
      if (item.sourceKind === "automation" || item.sourceKind === "packing") receipt.drop("generatedTask");
      continue;
    }
    if (item.status === "cancelled") {
      receipt.drop("cancelledTask");
      continue;
    }
    const owner = ownerOf(item);
    if (owner.kind === "gone") {
      receipt.drop("ownerUnavailable");
      continue;
    }
    const { title, depth, ancestors } = titleOf(item);
    if (depth > 0) receipt.reshape("subtaskFlattened");
    const ownerKey =
      owner.kind === "build"
        ? `b:${owner.buildId}`
        : owner.kind === "convention"
          ? `c:${owner.conventionId}`
          : "none";
    const previous = taskPosition.get(ownerKey);
    const position = previous ? previous.position + 1 : 0;
    const rootAttachments = attachmentsByItem.get(ancestors[0]._id) ?? [];
    const row: CosappTask = {
      ...stamps(item, [...ancestors, ...rootAttachments, ...rootAttachments.flatMap((attachment) => {
        const piece = attachment.entityType === "cosplayNode" ? pieceRow.get(attachment.entityId) : undefined;
        return piece ? [piece] : [];
      }), ...(previous ? [previous] : [])]),
      id: cosappId.task(item._id),
      ownerKind: owner.kind,
      buildId: owner.kind === "build" ? owner.buildId : null,
      pieceId: owner.kind === "build" ? owner.pieceId : null,
      conventionId: owner.kind === "convention" ? owner.conventionId : null,
      title,
      done: item.status === "done",
      dueDate: isoDate(item.dueDate),
      remindAt: null,
      notes: text(item.notes),
      position,
    };
    tasks.push(row);
    taskPosition.set(ownerKey, row);
  }

  const rows: CosappRows = {
    builds,
    pieces,
    tasks,
    photos,
    conventions,
    dayPlans,
    packingItems,
  };
  return {
    data: {
      format: COSAPP_BACKUP_FORMAT,
      schemaVersion: COSAPP_BACKUP_SCHEMA_VERSION,
      exportedAt: options.now,
      appVersion: COSAPP_CONVERTER_VERSION,
      rows,
    },
    photoFiles,
    photoSources: [...photoSources],
    receipt: receipt.build(rows, photoFiles.length),
  };
}

/** Parents before children, siblings by `sortOrder`; rows whose parent is not in `byId` are roots. */
function treeOrder<T extends KyRow & { sortOrder?: number }>(
  rows: T[],
  parentOf: (row: T) => string | undefined,
  byId: Map<string, T>
): T[] {
  const children = new Map<string, T[]>();
  const roots: T[] = [];
  for (const row of rows) {
    const parent = parentOf(row);
    if (parent && byId.has(parent) && parent !== row._id) {
      const list = children.get(parent) ?? [];
      list.push(row);
      children.set(parent, list);
    } else {
      roots.push(row);
    }
  }
  const ordered: T[] = [];
  const visited = new Set<string>();
  const visit = (row: T) => {
    if (visited.has(row._id)) return;
    visited.add(row._id);
    ordered.push(row);
    for (const child of (children.get(row._id) ?? []).sort(bySortOrder)) visit(child);
  };
  for (const root of roots.sort(bySortOrder)) visit(root);
  // Rows caught in a parent cycle have no root; keep them rather than lose them.
  for (const row of [...rows].sort(bySortOrder)) visit(row);
  return ordered;
}

function buildStatus(status: string): CosappBuild["status"] {
  switch (status) {
    case "wip":
      return "in_progress";
    case "ready":
      return "complete";
    case "archived":
      return "archived";
    default:
      return "idea";
  }
}

function pieceStatus(node: KyCosplayNode): CosappPiece["status"] {
  switch (node.manualOverallBucket) {
    case "complete":
      return "done";
    case "in_progress":
      return "in_progress";
    case "incomplete":
      return "todo";
  }
  if (node.nodeType === "material") {
    if (node.materialStatus === "complete" || node.materialStatus === "bought") return "done";
    if (node.materialStatus === "in_use") return "in_progress";
    return "todo";
  }
  if (node.buildStatus === "built") return "done";
  if (node.buildStatus === "wip") return "in_progress";
  if (!node.buildStatus && node.purchaseStatus === "bought") return "done";
  return "todo";
}

function pieceCost(node: KyCosplayNode): number | null {
  const unit = cents(node.unitCostCents);
  const quantity =
    typeof node.quantity === "number" && Number.isFinite(node.quantity) && node.quantity > 0
      ? node.quantity
      : null;
  const perUnit = unit !== null && quantity !== null ? Math.round(unit * quantity) : null;
  if (node.pricingMode === "per_unit" && perUnit !== null) return perUnit;
  return cents(node.directCostCents) ?? perUnit;
}

/**
 * Whether bytes are an image Cosapp.si's restore can keep: JPEG, PNG, WebP or HEIF/HEIC (an ISO
 * media "ftyp" box). Anything else would make the whole import fail, so it is left out instead.
 */
export function isCosappImage(bytes: Uint8Array): boolean {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (bytes.length >= 4 && bytes[0] === 0x89 && ascii(1, 4) === "PNG") return true;
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return true;
  return bytes.length >= 12 && ascii(4, 8) === "ftyp";
}

/**
 * Remove photo rows whose bytes could not be fetched (the stored file vanished after the rows were
 * read) or are not a usable image, so the archive still satisfies Cosapp.si's "every live photo has
 * its file" rule and its restore never meets bytes it cannot keep.
 */
export function withoutPhotoFiles(
  result: CosappExport,
  missing: Set<string>,
  reason: "missingImage" | "unsupportedImage" | "oversizeImage" = "missingImage"
): CosappExport {
  if (!missing.size) return result;
  const photos = result.data.rows.photos.filter((photo) => !missing.has(photo.fileName));
  const photoFiles = result.photoFiles.filter((file) => !missing.has(file.fileName));
  const removed = result.data.rows.photos.length - photos.length;
  const dropped = [...result.receipt.dropped];
  const index = dropped.findIndex((entry) => entry.kind === reason);
  if (index >= 0) {
    dropped[index] = { kind: reason, count: (dropped[index].count ?? 0) + removed };
  } else {
    dropped.unshift({ kind: reason, count: removed });
  }
  return {
    data: { ...result.data, rows: { ...result.data.rows, photos } },
    photoFiles,
    photoSources: result.photoSources,
    receipt: {
      ...result.receipt,
      droppedImages: [...result.receipt.droppedImages, ...result.photoFiles.filter((file) => missing.has(file.fileName)).map((file) => ({ image: file.storageId, reason }))],
      counts: { ...result.receipt.counts, photos: photos.length, photoFiles: photoFiles.length },
      dropped,
    },
  };
}

/**
 * Split the photo files into bounded fetch batches. Larger files use multiple byte ranges.
 * Each storage id is
 * fetched once even when several photo rows share it.
 */
export function planPhotoBatches(files: CosappPhotoFile[], maxBytes: number): string[][] {
  const sizes = new Map<string, number>();
  for (const file of files) sizes.set(file.storageId, file.size);
  const batches: string[][] = [];
  let current: string[] = [];
  let bytes = 0;
  for (const [storageId, size] of sizes) {
    if (current.length && (bytes + Math.min(size, PHOTO_BATCH_BYTES) > Math.min(maxBytes, PHOTO_BATCH_BYTES) || current.length >= MAX_PHOTOS_PER_CALL)) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(storageId);
    bytes += Math.min(size, PHOTO_BATCH_BYTES);
  }
  if (current.length) batches.push(current);
  return batches;
}
