"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { createPortal } from "react-dom";
import { X, Maximize2 } from "lucide-react";

type VisualTab = "all" | "references" | "progress" | "closet";

export type BuildVisualBoardClosetItem = {
  _id: Id<"closetItems">;
  name: string;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
};

type BuildVisualBoardProps = {
  buildId: Id<"builds">;
  userId: string | null;
  linkedItems: BuildVisualBoardClosetItem[];
  /** Opens link-closet modal (FAB) */
  onOpenLinkCloset: () => void;
  /** Wrap each closet item (e.g. droppable + card) for DnD targets */
  renderClosetCard: (item: BuildVisualBoardClosetItem) => React.ReactNode;
};

const TABS: { id: VisualTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "references", label: "References" },
  { id: "progress", label: "Progress" },
  { id: "closet", label: "Closet" },
];

export function BuildVisualBoard({
  buildId,
  userId: _userId,
  linkedItems,
  onOpenLinkCloset,
  renderClosetCard,
}: BuildVisualBoardProps) {
  const [tab, setTab] = useState<VisualTab>("all");
  const refs = useQuery(api.buildReferenceImages.listByBuild, { buildId });
  const progressPhotos = useQuery(api.buildProcessPictures.listByBuild, { buildId });

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFullscreen]);

  const allEmpty =
    (refs?.length ?? 0) === 0 && (progressPhotos?.length ?? 0) === 0 && linkedItems.length === 0;

  const itemsAll = useMemo(() => {
    const items: Array<{ type: string; id: string; sortKey: number; element: React.ReactNode }> =
      [];
    if (refs) {
      refs.forEach((r) =>
        items.push({
          type: "reference",
          id: r._id,
          sortKey: r._creationTime,
          element: (
            <button
              type="button"
              className="break-inside-avoid mb-4 w-full text-left rounded-2xl overflow-hidden bg-kyar-mutedWarm shadow-sm hover:shadow-md transition-all group relative flex flex-col cursor-pointer border border-transparent"
            >
              <ResolvedImage
                imageStorageId={r.imageStorageId}
                imageUrl={r.imageUrl}
                alt="Reference"
                className="w-full h-auto object-cover min-h-[120px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
                <p className="text-white text-xs font-medium truncate">Reference</p>
              </div>
            </button>
          ),
        })
      );
    }
    if (progressPhotos) {
      progressPhotos.forEach((p) =>
        items.push({
          type: "progress",
          id: p._id,
          sortKey: p._creationTime,
          element: (
            <button
              type="button"
              className="break-inside-avoid mb-4 w-full text-left rounded-2xl overflow-hidden bg-kyar-mutedWarm shadow-sm hover:shadow-md transition-all group relative flex flex-col cursor-pointer border border-transparent"
            >
              <ResolvedImage
                imageStorageId={p.imageStorageId}
                imageUrl={p.imageUrl}
                alt="Progress"
                className="w-full h-auto object-cover min-h-[120px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent pointer-events-none opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none flex items-center justify-between opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 sm:translate-y-2 sm:group-hover:translate-y-0">
                <p className="text-white text-xs font-medium truncate drop-shadow-md">
                  Day{" "}
                  {Math.ceil(
                    (p._creationTime -
                      (progressPhotos?.[progressPhotos.length - 1]?._creationTime ??
                        p._creationTime)) /
                      (1000 * 60 * 60 * 24)
                  ) + 1}
                </p>
                <span className="text-white/90 text-[10px] drop-shadow-md">
                  {new Date(p._creationTime).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </button>
          ),
        })
      );
    }
    linkedItems.forEach((c, i) =>
      items.push({
        type: "closet",
        id: c._id,
        sortKey: Date.now() - i,
        element: <div className="break-inside-avoid mb-4 w-full">{renderClosetCard(c)}</div>,
      })
    );
    return items.sort((a, b) => b.sortKey - a.sortKey);
  }, [refs, progressPhotos, linkedItems, renderClosetCard]);

  const itemsReferences = useMemo(() => itemsAll.filter((i) => i.type === "reference"), [itemsAll]);
  const itemsProgress = useMemo(() => itemsAll.filter((i) => i.type === "progress"), [itemsAll]);
  const itemsCloset = useMemo(() => itemsAll.filter((i) => i.type === "closet"), [itemsAll]);

  const filterSelectId = `visual-board-view-${buildId}`;

  const content = (
    <>
      <div className="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-kyar-borderSubtle pb-3 mb-6 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-serif text-xl sm:text-2xl text-kyar-text leading-none tracking-tight">
            Visual Board
          </h2>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="shrink-0 p-2 rounded-full hover:bg-kyar-borderSubtle text-kyar-textSecondary transition-colors"
            title={isFullscreen ? "Exit full screen" : "Expand full screen"}
            aria-label={isFullscreen ? "Exit full screen" : "Expand visual board full screen"}
          >
            {isFullscreen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex w-full sm:w-auto sm:min-w-[12rem] items-center gap-2">
          <label htmlFor={filterSelectId} className="sr-only">
            Visual board view
          </label>
          <select
            id={filterSelectId}
            value={tab}
            onChange={(e) => setTab(e.target.value as VisualTab)}
            className="w-full sm:w-auto min-h-[2.5rem] min-w-0 sm:min-w-[11rem] rounded-lg border border-kyar-borderSubtle bg-white py-2 pl-3 pr-9 text-sm text-kyar-text shadow-sm focus:outline-none focus:ring-2 focus:ring-kyar-accent/30 focus:border-kyar-accent cursor-pointer"
            aria-label="Visual board view"
          >
            {TABS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className={`w-full ${isFullscreen ? "overflow-y-auto min-h-0 h-[calc(100vh-140px)] pr-2" : ""}`}
      >
        {tab === "all" && (
          <div className="w-full">
            {allEmpty && (
              <div className="text-center py-10 bg-kyar-surface rounded-xl border border-kyar-borderSubtle">
                <p className="text-sm text-kyar-textTertiary mb-3">No images or items yet.</p>
                {_userId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFullscreen(false);
                      onOpenLinkCloset();
                    }}
                    className="text-[10px] uppercase tracking-widest text-kyar-text font-medium border border-kyar-cardBorder px-4 py-2 rounded hover:bg-kyar-muted transition-colors inline-block"
                  >
                    Link closet items
                  </button>
                ) : (
                  <p className="text-xs text-kyar-textTertiary">Sign in to link closet items.</p>
                )}
              </div>
            )}
            <div
              className={`columns-2 ${isFullscreen ? "sm:columns-3 md:columns-4 lg:columns-5" : "sm:columns-3"} gap-3 sm:gap-4 pb-12`}
            >
              {itemsAll.map((item) => (
                <div key={`${item.type}-${item.id}`}>{item.element}</div>
              ))}
            </div>
          </div>
        )}

        {tab === "references" && (
          <div className="w-full pb-12">
            {itemsReferences.length === 0 ? (
              <p className="text-sm text-kyar-textTertiary py-8 text-center border border-kyar-borderSubtle rounded-xl bg-kyar-surface">
                No reference images yet.
              </p>
            ) : (
              <div
                className={`columns-2 ${isFullscreen ? "sm:columns-3 md:columns-4 lg:columns-5" : "sm:columns-3"} gap-3 sm:gap-4`}
              >
                {itemsReferences.map((item) => (
                  <div key={`${item.type}-${item.id}`}>{item.element}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "progress" && (
          <div className="w-full pb-12">
            {itemsProgress.length === 0 ? (
              <p className="text-sm text-kyar-textTertiary py-8 text-center border border-kyar-borderSubtle rounded-xl bg-kyar-surface">
                No progress photos yet.
              </p>
            ) : (
              <div
                className={`columns-2 ${isFullscreen ? "sm:columns-3 md:columns-4 lg:columns-5" : "sm:columns-3"} gap-3 sm:gap-4`}
              >
                {itemsProgress.map((item) => (
                  <div key={`${item.type}-${item.id}`}>{item.element}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "closet" && (
          <div className="w-full pb-12">
            {itemsCloset.length === 0 ? (
              <div className="text-center py-8 border border-kyar-borderSubtle rounded-xl bg-kyar-surface">
                <p className="text-sm text-kyar-textTertiary mb-3">No closet items linked.</p>
                {_userId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFullscreen(false);
                      onOpenLinkCloset();
                    }}
                    className="text-[10px] uppercase tracking-widest text-kyar-text font-medium border border-kyar-cardBorder px-4 py-2 rounded hover:bg-kyar-muted transition-colors inline-block"
                  >
                    Link closet items
                  </button>
                ) : (
                  <p className="text-xs text-kyar-textTertiary">Sign in to link closet items.</p>
                )}
              </div>
            ) : (
              <div
                className={`columns-2 ${isFullscreen ? "sm:columns-3 md:columns-4 lg:columns-5" : "sm:columns-3"} gap-3 sm:gap-4`}
              >
                {itemsCloset.map((item) => (
                  <div key={`${item.type}-${item.id}`}>{item.element}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <aside className={`min-w-0 ${isFullscreen ? "hidden" : "block"}`}>{content}</aside>

      {isFullscreen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-white overflow-hidden flex flex-col p-6 sm:p-10">
            <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-col min-h-0">
              {content}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
