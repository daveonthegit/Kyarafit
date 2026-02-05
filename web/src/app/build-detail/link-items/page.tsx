'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchBuildItems, linkBuildItems } from '@/lib/api/builds';
import { fetchClosetItems } from '@/lib/api/closet';
import { BottomNav } from '@/components/layout/BottomNav';

export default function BuildLinkItemsPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: closetItems = [] } = useQuery({
    queryKey: ['closet', 'items'],
    queryFn: fetchClosetItems,
  });
  const { data: linkedIds = [] } = useQuery({
    queryKey: ['build-items', id],
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
      queryClient.invalidateQueries({ queryKey: ['build-items', id] });
      queryClient.invalidateQueries({ queryKey: ['build', id] });
      router.push(`/build-detail?id=${id}`);
    },
  });

  const save = () => {
    if (!id) return;
    linkMutation.mutate(Array.from(selectedIds));
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
    <div className="min-h-screen flex flex-col pb-32">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center justify-between">
        <Link href={`/build-detail?id=${id}`} className="text-[10px] font-semibold uppercase tracking-widest text-kyar-meta">
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
        <p className="text-sm text-kyar-textTertiary mb-6">
          Select items to include in this build. They will appear in packing lists when this build is assigned to a day.
        </p>
        {closetItems.length === 0 && (
          <p className="text-sm text-kyar-meta">No closet items yet. Add items from your closet first.</p>
        )}
        <ul className="space-y-0">
          {closetItems.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className="w-full flex items-center gap-3 py-4 border-b border-kyar-borderSubtle text-left hover:opacity-80"
              >
                <span
                  className={`w-4 h-4 border flex items-center justify-center shrink-0 ${
                    selectedIds.has(item.id) ? 'border-black bg-black' : 'border-kyar-border'
                  }`}
                >
                  {selectedIds.has(item.id) && (
                    <span className="material-symbols-outlined text-white text-sm">check</span>
                  )}
                </span>
                <span className="flex-1 text-sm font-medium uppercase tracking-wide">{item.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-kyar-textTertiary">{item.category}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>

      <BottomNav active="builds" />
    </div>
  );
}
