"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

export default function BuildLinkItemsPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") as Id<"builds"> | null;
  const router = useRouter();
  const { userId } = useCurrentUser();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const closetItems = useQuery(api.closetItems.list, userId ? { userId } : "skip") ?? [];
  const linkedIds = useQuery(api.builds.getItems, id ? { buildId: id } : "skip") ?? [];
  const linkItemsMut = useMutation(api.builds.linkItems);

  useEffect(() => {
    if (linkedIds.length > 0) setSelectedIds(new Set(linkedIds));
  }, [linkedIds]);

  const toggle = useCallback((itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const [isSaving, setIsSaving] = useState(false);
  const save = async () => {
    if (!id || !userId) return;
    setIsSaving(true);
    try {
      await linkItemsMut({
        userId,
        buildId: id,
        closetItemIds: Array.from(selectedIds) as Id<"closetItems">[],
      });
      router.push(`/build-detail?id=${id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && over.id === "build-drop-zone") {
      const itemId = active.id as string;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(itemId);
        return next;
      });
    }
  };

  if (!id) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Missing build id.</p>
        <Link href="/builds" className="mt-4 text-sm underline">
          Back to Builds
        </Link>
      </WebAppShell>
    );
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <WebAppShell>
        <header className="sticky top-0 z-40 bg-kyar-bgWarm/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center justify-between">
          <Link
            href="/builds"
            className="text-[10px] font-semibold uppercase tracking-widest text-kyar-meta"
          >
            Cancel
          </Link>
          <p className="meta-label">Link Closet Items</p>
          <button
            type="button"
            onClick={save}
            disabled={isSaving}
            className="text-[10px] font-semibold uppercase tracking-widest text-black disabled:opacity-50"
          >
            Save
          </button>
        </header>

        <main className="flex-1 py-8">
          <p className="text-sm text-kyar-textTertiary mb-4">
            Select items to include in this build. They will appear in packing lists when this build
            is assigned to a day.
          </p>

          <DroppableBuildZone>
            <div className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-2xl">move_down</span>
              <div>
                <p className="font-medium">Drop items here to add to build</p>
                <p className="text-xs text-kyar-textTertiary">
                  {selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} selected
                </p>
              </div>
            </div>
          </DroppableBuildZone>

          {closetItems.length === 0 && (
            <p className="text-sm text-kyar-meta mt-6">
              No closet items yet. Add items from your closet first.
            </p>
          )}
          <ul className="space-y-0 mt-6">
            {closetItems.map((item) => (
              <DraggableClosetItem
                key={item._id}
                item={item}
                isSelected={selectedIds.has(item._id)}
                onToggle={() => toggle(item._id)}
              />
            ))}
          </ul>
        </main>
      </WebAppShell>
    </DndContext>
  );
}

function DraggableClosetItem({
  item,
  isSelected,
  onToggle,
}: {
  item: { _id: string; name: string; category: string };
  isSelected: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item._id,
    data: { type: "closetItem", item },
  });

  return (
    <li
      ref={setNodeRef}
      className={`flex items-center gap-3 py-4 border-b border-kyar-borderSubtle ${isDragging ? "opacity-50" : ""}`}
    >
      <span
        className="material-symbols-outlined text-kyar-textTertiary cursor-grab touch-none shrink-0"
        {...listeners}
        {...attributes}
        aria-hidden
      >
        drag_indicator
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 flex items-center gap-3 text-left hover:opacity-80 min-w-0"
      >
        <span
          className={`w-4 h-4 border flex items-center justify-center shrink-0 ${
            isSelected ? "border-black bg-black" : "border-kyar-border"
          }`}
        >
          {isSelected && (
            <span className="material-symbols-outlined text-white text-sm">check</span>
          )}
        </span>
        <span className="flex-1 text-sm font-medium uppercase tracking-wide truncate">
          {item.name}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-kyar-textTertiary shrink-0">
          {item.category}
        </span>
      </button>
    </li>
  );
}

function DroppableBuildZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "build-drop-zone",
    data: { type: "buildZone" },
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-lg p-6 transition-all ${
        isOver
          ? "border-kyar-accent bg-kyar-accent/10 scale-105"
          : "border-kyar-border bg-kyar-muted"
      }`}
    >
      {children}
    </div>
  );
}
