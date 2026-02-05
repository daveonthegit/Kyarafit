"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ClosetItem } from "@kyarafit/design-system/types";
import { fetchBuildItems, linkBuildItems } from "@/lib/api/builds";
import { fetchClosetItems } from "@/lib/api/closet";
import { BottomNav } from "@/components/layout/BottomNav";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";

export default function BuildLinkItemsPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: closetItems = [] } = useQuery({
    queryKey: ["closet", "items"],
    queryFn: fetchClosetItems,
  });
  const { data: linkedIds = [] } = useQuery({
    queryKey: ["build-items", id],
    queryFn: () => fetchBuildItems(id!),
    enabled: !!id,
  });

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

  const linkMutation = useMutation({
    mutationFn: (ids: string[]) => linkBuildItems(id!, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["build-items", id] });
      queryClient.invalidateQueries({ queryKey: ["build", id] });
      router.push(`/build-detail?id=${id}`);
    },
  });

  const save = () => {
    if (!id) return;
    linkMutation.mutate(Array.from(selectedIds));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && over.id === "build-drop-zone") {
      const itemId = active.id as string;
      // Add the item to selectedIds
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.add(itemId);
        return next;
      });
    }
  };

  if (!id) {
    return (
      <div className="min-h-screen flex flex-col pb-24 px-6 pt-12">
        <p className="meta-label">Missing build id.</p>
        <Link href="/builds" className="mt-4 text-sm underline">
          Back to Builds
        </Link>
      </div>
    );
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="min-h-screen flex flex-col pb-32">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center justify-between">
          <Link
            href={`/build-detail?id=${id}`}
            className="text-[10px] font-semibold uppercase tracking-widest text-kyar-meta"
          >
            Cancel
          </Link>
          <p className="meta-label">Link Closet Items</p>
          <button
            type="button"
            onClick={save}
            disabled={linkMutation.isPending}
            className="text-[10px] font-semibold uppercase tracking-widest text-black disabled:opacity-50"
          >
            Save
          </button>
        </header>

        <main className="flex-1 px-6 py-8">
          <p className="text-sm text-kyar-textTertiary mb-4">
            Select items to include in this build. They will appear in packing lists when this build
            is assigned to a day.
          </p>
          <p className="text-xs text-kyar-textTertiary mb-6 italic">
            Tip: Drag items onto the drop zone below to quickly add them
          </p>

          {/* Drop zone */}
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
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                onToggle={() => toggle(item.id)}
              />
            ))}
          </ul>
        </main>

        <BottomNav active="builds" />
      </div>
    </DndContext>
  );
}

// Draggable closet item component
function DraggableClosetItem({
  item,
  isSelected,
  onToggle,
}: {
  item: ClosetItem;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { type: "closetItem", item },
  });

  return (
    <li ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? "opacity-50" : ""}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-4 border-b border-kyar-borderSubtle text-left hover:opacity-80"
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
        <span className="flex-1 text-sm font-medium uppercase tracking-wide">{item.name}</span>
        <span className="text-[10px] uppercase tracking-wide text-kyar-textTertiary">
          {item.category}
        </span>
      </button>
    </li>
  );
}

// Droppable build zone component
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
