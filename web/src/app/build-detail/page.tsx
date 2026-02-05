"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, useDroppable } from "@dnd-kit/core";
import { BottomNav } from "@/components/layout/BottomNav";
import { TaskChecklist } from "@/components/builds/TaskChecklist";
import { fetchBuild, fetchBuildItems, fetchBuildTasks, updateBuildTask } from "@/lib/api/builds";
import { fetchClosetItems } from "@/lib/api/closet";

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

export default function BuildDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const queryClient = useQueryClient();

  const { data: build, isLoading } = useQuery({
    queryKey: ["build", id],
    queryFn: () => fetchBuild(id!),
    enabled: !!id,
  });
  const { data: closetItemIds = [] } = useQuery({
    queryKey: ["build-items", id],
    queryFn: () => fetchBuildItems(id!),
    enabled: !!id,
  });
  const { data: closetItems = [] } = useQuery({
    queryKey: ["closet", "items"],
    queryFn: fetchClosetItems,
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["build-tasks", id],
    queryFn: () => fetchBuildTasks(id!),
    enabled: !!id,
  });

  const linkedItems = closetItems.filter((c) => closetItemIds.includes(c.id));
  const totalCostCents = linkedItems.reduce((sum, i) => sum + (i.costCents ?? 0), 0);

  // Task assignment mutation
  const assignTask = useMutation({
    mutationFn: ({ taskId, closetItemId }: { taskId: string; closetItemId: string | null }) =>
      updateBuildTask(id!, taskId, { closetItemId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["build-tasks", id] });
    },
  });

  // Handle drag end for task assignment
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const taskId = active.id as string;
      const closetItemId = over.id as string;

      // Assign task to closet item
      assignTask.mutate({ taskId, closetItemId });
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col pb-24 px-6 pt-12">
        <p className="meta-label">Loading…</p>
      </div>
    );
  }

  if (!build) {
    return (
      <div className="min-h-screen flex flex-col pb-24 px-6 pt-12">
        <p className="meta-label">Build not found.</p>
        <Link href="/builds" className="mt-4 text-sm underline">
          Back to Builds
        </Link>
      </div>
    );
  }

  const tasksChecked = tasks.filter((t) => t.checked).length;
  const tasksTotal = tasks.length;
  const completionPercent = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;

  // Calculate days until deadline
  const getDaysRemaining = (targetDate: string | null | undefined) => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = getDaysRemaining(build.targetDate);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="min-h-screen flex flex-col pb-24">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md px-6 pt-12 pb-4 flex items-center gap-4">
          <button type="button" onClick={() => router.back()}>
            <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
          </button>
          <span className="flex-1 meta-label">{build.name}</span>
          <Link href={`/builds/edit?id=${id}`} className="hover:opacity-70">
            <span className="material-symbols-outlined font-light text-xl">edit</span>
          </Link>
        </header>

        <main className="mt-20 mb-12">
          {/* Hero image */}
          {build.imageUrl && (
            <div className="w-full aspect-[3/4] bg-gray-50 mb-6">
              <img src={build.imageUrl} alt={build.name} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Project overview */}
          <div className="px-6 mb-8">
            <p className="text-[10px] uppercase tracking-wide text-kyar-textTertiary mb-2">
              {build.status}
            </p>
            <h1 className="font-serif text-4xl font-bold italic tracking-tight mb-2">
              {build.name}
            </h1>
            {build.character && (
              <p className="text-sm text-kyar-textTertiary">Character: {build.character}</p>
            )}
          </div>

          {/* Metrics / Summary */}
          <div className="px-6 mb-8 space-y-6">
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary">
                  Completion
                </span>
                <span className="text-xl font-bold">{completionPercent}%</span>
              </div>
              <div className="h-[2px] bg-gray-200 w-full">
                <div
                  className="h-full bg-black transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <p className="text-xs text-kyar-textTertiary mt-1">
                {tasksChecked} of {tasksTotal} tasks complete
              </p>
            </div>

            {/* Deadline */}
            {build.targetDate && daysRemaining !== null && (
              <div>
                <span className="text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary block mb-2">
                  Deadline
                </span>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">event</span>
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(build.targetDate).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p
                      className={`text-xs ${
                        daysRemaining < 0
                          ? "text-red-600"
                          : daysRemaining <= 7
                            ? "text-orange-600"
                            : "text-kyar-textTertiary"
                      }`}
                    >
                      {daysRemaining < 0
                        ? `${Math.abs(daysRemaining)} days overdue`
                        : daysRemaining === 0
                          ? "Due today!"
                          : `${daysRemaining} days remaining`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <section className="px-6 mb-10">
            <h2 className="font-serif text-xl italic border-b border-black pb-2 mb-4">Tasks</h2>
            <p className="text-xs text-kyar-textTertiary mb-4 italic">
              Drag tasks onto closet items or click the link button to assign them
            </p>
            <TaskChecklist
              buildId={id}
              tasks={tasks}
              linkedItems={linkedItems}
              enableDragDrop={true}
            />
          </section>

          {/* Budget Tracker */}
          {build.budgetCents != null && (
            <section className="px-6 mb-12">
              <h2 className="font-serif text-xl italic border-b border-black pb-2 mb-4">
                Budget Tracker
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-medium">
                      Spent: {formatCents(totalCostCents)}
                    </span>
                    <span className="text-sm font-medium">
                      Budget: {formatCents(build.budgetCents)}
                    </span>
                  </div>
                  <div className="h-[2px] bg-gray-200 w-full">
                    <div
                      className="h-full bg-black transition-all"
                      style={{
                        width: `${Math.min(100, (totalCostCents / (build.budgetCents || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  {totalCostCents > (build.budgetCents || 0) && (
                    <p className="text-xs text-red-600 mt-1">
                      Over budget by {formatCents(totalCostCents - (build.budgetCents || 0))}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-sm underline underline-offset-2 text-kyar-textSecondary hover:opacity-70"
                  onClick={() => {
                    // Navigate to expenses view (using linked items as expenses)
                    alert(
                      `Linked items total: ${formatCents(totalCostCents)}\n\nItems:\n${linkedItems.map((i) => `- ${i.name}: ${formatCents(i.costCents || 0)}`).join("\n")}`
                    );
                  }}
                >
                  View expenses breakdown
                </button>
              </div>
            </section>
          )}

          <section className="px-6 mb-12">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-serif text-xl italic border-b border-black pb-2">
                Associated Closet Items ({linkedItems.length})
              </h2>
              <Link
                href={`/build-detail/link-items?id=${id}`}
                className="text-[10px] font-semibold uppercase tracking-widest border border-black px-3 py-2 hover:bg-kyar-muted"
              >
                Link items
              </Link>
            </div>
            {linkedItems.length === 0 && (
              <p className="text-sm text-kyar-meta">
                No closet items linked. Tap &quot;Link items&quot; to add pieces from your closet.
              </p>
            )}
            {linkedItems.length > 0 && (
              <p className="text-xs text-kyar-textTertiary mb-4 italic">
                Drop tasks here to assign them to items
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              {linkedItems.map((item) => (
                <DroppableClosetItem key={item.id} item={item}>
                  <div className="flex flex-col gap-2">
                    {item.imageUrl ? (
                      <div className="aspect-square bg-gray-50 overflow-hidden">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square bg-gray-50 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-kyar-textTertiary">
                          image
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                      <p className="text-xs text-kyar-textTertiary">
                        {item.category}
                        {item.costCents != null ? ` · ${formatCents(item.costCents)}` : ""}
                      </p>
                    </div>
                  </div>
                </DroppableClosetItem>
              ))}
            </div>
          </section>

          {/* Progress Photos - Placeholder for future implementation */}
          <section className="px-6 mb-12">
            <h2 className="font-serif text-xl italic border-b border-black pb-2 mb-4">
              Progress Photos
            </h2>
            <div className="border border-dashed border-kyar-border p-6 text-center">
              <span className="material-symbols-outlined text-4xl text-kyar-textTertiary mb-2">
                photo_library
              </span>
              <p className="text-sm text-kyar-textTertiary">
                Progress photos feature coming soon. Track your build with photos and dates.
              </p>
            </div>
          </section>
        </main>

        <BottomNav active="builds" />
      </div>
    </DndContext>
  );
}

// Droppable closet item component
function DroppableClosetItem({ item, children }: { item: any; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: item.id,
    data: { type: "closetItem", item },
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all ${isOver ? "ring-2 ring-kyar-accent shadow-lg scale-105" : ""}`}
    >
      {children}
    </div>
  );
}
