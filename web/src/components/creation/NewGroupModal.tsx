"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { Sheet } from "@/components/ui/sheet";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";

type NewGroupModalProps = {
  onDismiss: () => void;
  onSuccessComplete: () => void;
};

export function NewGroupModal({ onDismiss, onSuccessComplete }: NewGroupModalProps) {
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
      if (group?._id) {
        onSuccessComplete();
        router.push(`/g/${group._id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onDismiss}
      title="New group"
      titleId="global-new-group-modal-title"
      closeDisabled={pending}
      footer={
        <button
          type="submit"
          form="new-group-modal-form"
          disabled={pending || !name.trim()}
          className="w-full bg-kyar-text py-4 text-[10px] font-bold uppercase tracking-widest text-kyar-bg rounded-full disabled:opacity-50 hover:bg-kyar-text/90 transition-colors shadow-md"
        >
          {pending ? "Creating…" : "Create group"}
        </button>
      }
    >
      <form id="new-group-modal-form" onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block meta-label">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={500}
            placeholder="e.g. Sailor Moon squad"
            className="w-full border-0 border-b border-kyar-borderSubtle bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:border-kyar-text focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="mb-2 block meta-label">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={10000}
            rows={3}
            placeholder="What’s this group cosplay about?"
            className="w-full border border-kyar-borderSubtle bg-transparent rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-kyar-text transition-colors"
          />
        </div>
        <div>
          <span className="block meta-label mb-2">Visibility</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setVisibility("private")}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border ${
                visibility === "private"
                  ? "border-kyar-text bg-kyar-muted text-kyar-text"
                  : "border-kyar-border text-kyar-textTertiary hover:border-kyar-text"
              }`}
            >
              Private
            </button>
            <button
              type="button"
              onClick={() => setVisibility("public")}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border ${
                visibility === "public"
                  ? "border-kyar-text bg-kyar-muted text-kyar-text"
                  : "border-kyar-border text-kyar-textTertiary hover:border-kyar-text"
              }`}
            >
              Public
            </button>
          </div>
          <p className="text-[11px] text-kyar-textTertiary mt-2">
            Public groups can be seen by anyone. Private only by members.
          </p>
        </div>
        {error && (
          <p className="text-sm text-kyar-danger" role="alert">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}
