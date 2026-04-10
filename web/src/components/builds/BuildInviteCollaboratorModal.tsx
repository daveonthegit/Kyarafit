"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { BuildDetailModalShell } from "@/components/builds/BuildDetailModalShell";

type BuildInviteCollaboratorModalProps = {
  open: boolean;
  onClose: () => void;
  buildId: Id<"builds">;
  ownerId: string;
};

export function BuildInviteCollaboratorModal({
  open,
  onClose,
  buildId,
  ownerId,
}: BuildInviteCollaboratorModalProps) {
  const addCollaborator = useMutation(api.buildCollaborators.addByEmail);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setRole("viewer");
      setFeedback(null);
      setError(null);
    }
  }, [open]);

  const invite = async () => {
    if (!email.trim()) return;
    setPending(true);
    setError(null);
    setFeedback(null);
    try {
      await addCollaborator({
        buildId,
        ownerId,
        email: email.trim(),
        role,
      });
      setEmail("");
      setFeedback("Invitation sent — invite another or tap Done.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setPending(false);
    }
  };

  return (
    <BuildDetailModalShell
      open={open}
      onClose={onClose}
      title="Invite collaborator"
      titleId="build-invite-modal-title"
      size="md"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full px-6 py-2.5 bg-kyar-text text-kyar-bg text-xs font-bold uppercase tracking-wider rounded-md"
        >
          Done
        </button>
      }
    >
      <p className="text-sm text-kyar-textSecondary mb-4">
        Enter their email and role. You can invite several people without closing this window.
      </p>
      {feedback && (
        <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          {feedback}
        </p>
      )}
      {error && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="space-y-3">
        <div>
          <label
            htmlFor="invite-email"
            className="block text-[10px] uppercase tracking-widest text-kyar-textTertiary mb-1"
          >
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full border border-kyar-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-kyar-accent/30 focus:border-kyar-accent"
            disabled={pending}
          />
        </div>
        <div>
          <label
            htmlFor="invite-role"
            className="block text-[10px] uppercase tracking-widest text-kyar-textTertiary mb-1"
          >
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
            className="w-full border border-kyar-border rounded-md px-3 py-2.5 text-sm bg-kyar-surface"
            disabled={pending}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
        </div>
        <button
          type="button"
          onClick={invite}
          disabled={pending || !email.trim()}
          className="w-full py-2.5 bg-kyar-text text-kyar-bg text-xs font-bold uppercase tracking-wider rounded-md disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send invite"}
        </button>
      </div>
    </BuildDetailModalShell>
  );
}
