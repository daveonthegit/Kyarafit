"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import {
  CLOSET_CATEGORIES,
  createClosetItemSchema,
  type ClosetCategory,
} from "@kyarafit/design-system/types";
import { UnderlineInput } from "@/components/ui/UnderlineInput";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

export default function NewClosetItemPage() {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const createItem = useMutation(api.closetItems.create);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClosetCategory>("other");
  const [tagsStr, setTagsStr] = useState("");
  const [notes, setNotes] = useState("");
  const [costDollars, setCostDollars] = useState("");
  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!userId) return;

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

    setIsPending(true);
    try {
      await createItem({
        userId,
        name: parsed.data.name,
        category: parsed.data.category,
        tags: parsed.data.tags ?? [],
        notes: parsed.data.notes,
        imageStorageId: imageStorageId ?? undefined,
        imageUrl: parsed.data.imageUrl,
        costCents: parsed.data.costCents ?? undefined,
      });
      router.push("/closet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setIsPending(false);
    }
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
              onImageSelected={(result) => {
                if ("imageStorageId" in result && result.imageStorageId) {
                  setImageStorageId(result.imageStorageId);
                  setImageUrl("");
                } else {
                  setImageUrl(result.imageUrl ?? "");
                  setImageStorageId(null);
                }
              }}
              currentImage={imageUrl || undefined}
              currentStorageId={imageStorageId ?? undefined}
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
            disabled={isPending}
            className="w-full py-4 bg-black text-white text-[11px] font-sans-wide font-bold uppercase tracking-widest rounded-sm disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save Item"}
          </button>
        </form>
      </main>
    </div>
  );
}
