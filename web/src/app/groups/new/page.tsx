"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

export default function NewGroupPage() {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const createGroup = useMutation(api.groups.create);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !name.trim()) return;
    setError(null);
    setPending(true);
    try {
      const group = await createGroup({
        userId,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
      });
      if (group?._id) router.push(`/g/${group._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setPending(false);
    }
  };

  return (
    <WebAppShell>
      <header className="pt-16 pb-6 flex justify-between items-end">
        <div>
          <p className="meta-label mb-2 opacity-40">Groups</p>
          <h1 className="font-serif text-4xl tracking-tight">New group</h1>
        </div>
        <Link href="/groups" className="p-2 -mr-2" aria-label="Back to groups">
          <span className="material-symbols-outlined font-light text-2xl">arrow_back</span>
        </Link>
      </header>

      <main className="mt-10 max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary mb-2">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={500}
              placeholder="e.g. Sailor Moon squad"
              className="w-full border border-kyar-cardBorder rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kyar-accent/50"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary mb-2">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={10000}
              rows={3}
              placeholder="What’s this group cosplay about?"
              className="w-full border border-kyar-cardBorder rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kyar-accent/50"
            />
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-[0.2em] font-medium text-kyar-textTertiary mb-2">
              Visibility
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border ${
                  visibility === "private"
                    ? "border-black bg-kyar-muted text-black"
                    : "border-kyar-border text-kyar-textTertiary hover:border-black"
                }`}
              >
                Private
              </button>
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border ${
                  visibility === "public"
                    ? "border-black bg-kyar-muted text-black"
                    : "border-kyar-border text-kyar-textTertiary hover:border-black"
                }`}
              >
                Public
              </button>
            </div>
            <p className="text-[11px] text-kyar-textTertiary mt-1">
              Public groups can be seen by anyone. Private only by members.
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="flex-1 bg-black text-white py-3 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create group"}
            </button>
            <Link
              href="/groups"
              className="px-6 py-3 border border-kyar-border text-sm font-semibold uppercase tracking-wider hover:border-black rounded-sm inline-flex items-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </WebAppShell>
  );
}
