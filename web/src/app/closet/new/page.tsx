"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CLOSET_CATEGORIES,
  createClosetItemSchema,
  type ClosetCategory,
} from "@kyarafit/design-system/types";
import { UnderlineInput } from "@/components/ui/UnderlineInput";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { createClosetItem } from "@/lib/api/closet";
import type { ClosetItem } from "@kyarafit/design-system/types";

export default function NewClosetItemPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClosetCategory>("other");
  const [tagsStr, setTagsStr] = useState("");
  const [notes, setNotes] = useState("");
  const [costDollars, setCostDollars] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: createClosetItem,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["closet", "items"] });
      const previous = queryClient.getQueryData<ClosetItem[]>(["closet", "items"]);
      const optimistic: ClosetItem = {
        id: "temp-" + Date.now(),
        name: input.name,
        category: input.category,
        tags: input.tags ?? [],
        notes: input.notes,
        imageUrl: input.imageUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ClosetItem[]>(["closet", "items"], (old) =>
        old ? [optimistic, ...old] : [optimistic]
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["closet", "items"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["closet", "items"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const parsed = createClosetItemSchema.safeParse({
      name: name.trim(),
      category,
      tags,
      notes: notes.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      costCents: costDollars.trim() ? Math.round(parseFloat(costDollars) * 100) : undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid fields");
      return;
    }
    mutation.mutate(parsed.data, {
      onSuccess: () => router.push("/closet"),
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to create"),
    });
  };

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 pt-12 pb-6 border-b border-kyar-borderSubtle">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10"
            aria-label="Close"
          >
            <span className="material-symbols-outlined font-light text-2xl">close</span>
          </button>
          <div className="text-center">
            <p className="meta-label">Kyarafit</p>
            <h1 className="font-serif text-2xl font-bold tracking-tight italic">New Item</h1>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8 max-w-md">
          <div>
            <label className="block text-[11px] font-sans-wide font-semibold uppercase tracking-wide text-kyar-meta mb-2">
              Photo (optional)
            </label>
            <ImageUpload
              category="closet"
              onImageSelected={(url) => setImageUrl(url)}
              currentImage={imageUrl}
            />
          </div>
          <UnderlineInput
            label="Item name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Arlecchino Wig"
            required
          />
          <div>
            <label className="block text-[11px] font-sans-wide font-semibold uppercase tracking-wide text-kyar-meta mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CLOSET_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`px-3 py-2 text-xs uppercase tracking-wide border border-black rounded-sm ${
                    category === c ? "bg-black text-white" : "bg-transparent text-black"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <UnderlineInput
            label="Tags (comma-separated)"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="wig, character, red"
          />
          <UnderlineInput
            label="Cost $ (optional)"
            type="number"
            min="0"
            step="0.01"
            value={costDollars}
            onChange={(e) => setCostDollars(e.target.value)}
            placeholder="0.00"
          />
          <UnderlineInput
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
          />
          {error && <p className="text-xs text-kyar-danger">{error}</p>}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-4 bg-black text-white text-[11px] font-sans-wide font-bold uppercase tracking-widest rounded-sm disabled:opacity-50"
          >
            {mutation.isPending ? "Saving…" : "Save Item"}
          </button>
        </form>
      </main>
    </div>
  );
}
