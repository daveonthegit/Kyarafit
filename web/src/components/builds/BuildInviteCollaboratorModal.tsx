"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { BuildDetailModalShell } from "@/components/builds/BuildDetailModalShell";
import { PhotoPill } from "@/components/ui/PhotoPill";

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
        <PhotoPill type="button" variant="outline" onClick={onClose} className="w-full">
          Done
        </PhotoPill>
      }
    >
      <p className="mb-4 text-sm leading-relaxed text-media-fg-70">
        Enter their email and role. You can invite several people without closing this window.
      </p>
      {feedback && (
        <p className="mb-3 rounded-[10px] bg-on-glass-chip-done-bg px-3 py-2 text-[13px] text-on-glass-chip-done-fg">
          {feedback}
        </p>
      )}
      {error && (
        <p className="mb-3 text-sm text-on-glass-danger" role="alert">
          {error}
        </p>
      )}
      <div className="space-y-3">
        <div>
          <label
            htmlFor="invite-email"
            className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55"
          >
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="glass-field min-h-[44px] w-full px-3 py-2.5 text-sm"
            disabled={pending}
          />
        </div>
        <div>
          <label
            htmlFor="invite-role"
            className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-55"
          >
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
            className="glass-field min-h-[44px] w-full px-3 py-2.5 text-sm [color-scheme:dark]"
            disabled={pending}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
        </div>
        <PhotoPill
          type="button"
          variant="solid"
          onClick={invite}
          disabled={pending || !email.trim()}
          className="w-full"
        >
          {pending ? "Sending…" : "Send invite"}
        </PhotoPill>
      </div>
    </BuildDetailModalShell>
  );
}
