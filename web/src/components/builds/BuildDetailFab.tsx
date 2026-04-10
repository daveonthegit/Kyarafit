"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, ImageIcon, Camera, Link2, UserPlus, ListTodo } from "lucide-react";

export type BuildDetailFabModal = "reference" | "progress" | "linkNodes" | "task" | "invite";

type BuildDetailFabProps = {
  hidden?: boolean;
  userId: string | null;
  showInviteCollaborator?: boolean;
  onOpenModal: (modal: BuildDetailFabModal) => void;
};

export function BuildDetailFab({
  hidden,
  userId,
  showInviteCollaborator,
  onOpenModal,
}: BuildDetailFabProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  if (hidden || typeof document === "undefined") return null;

  const close = () => setOpen(false);

  const openModal = (m: BuildDetailFabModal) => {
    onOpenModal(m);
    close();
  };

  const fab = (
    <div
      ref={rootRef}
      className="fixed bottom-6 right-6 z-[10050] flex flex-col items-end gap-2 pointer-events-none"
      aria-label="Build quick actions"
    >
      <div
        className={`flex flex-col gap-2 items-end pointer-events-auto transition-all duration-200 ${
          open
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none invisible"
        }`}
      >
        {userId && (
          <>
            <button
              type="button"
              onClick={() => openModal("reference")}
              className="flex items-center gap-2 rounded-full bg-kyar-surface border border-kyar-borderSubtle pl-4 pr-3 py-2.5 text-sm text-kyar-text shadow-md hover:bg-kyar-mutedWarm transition-colors"
            >
              <span>Reference image</span>
              <ImageIcon className="w-4 h-4 shrink-0 text-kyar-textSecondary" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => openModal("progress")}
              className="flex items-center gap-2 rounded-full bg-kyar-surface border border-kyar-borderSubtle pl-4 pr-3 py-2.5 text-sm text-kyar-text shadow-md hover:bg-kyar-mutedWarm transition-colors"
            >
              <span>Progress photo</span>
              <Camera className="w-4 h-4 shrink-0 text-kyar-textSecondary" aria-hidden />
            </button>
          </>
        )}
        {userId && (
          <button
            type="button"
            onClick={() => openModal("linkNodes")}
            className="flex items-center gap-2 rounded-full bg-kyar-surface border border-kyar-borderSubtle pl-4 pr-3 py-2.5 text-sm text-kyar-text shadow-md hover:bg-kyar-mutedWarm transition-colors"
          >
            <span>Link elements or materials</span>
            <Link2 className="w-4 h-4 shrink-0 text-kyar-textSecondary" aria-hidden />
          </button>
        )}
        {userId && (
          <button
            type="button"
            onClick={() => openModal("task")}
            className="flex items-center gap-2 rounded-full bg-kyar-surface border border-kyar-borderSubtle pl-4 pr-3 py-2.5 text-sm text-kyar-text shadow-md hover:bg-kyar-mutedWarm transition-colors"
          >
            <span>Add task</span>
            <ListTodo className="w-4 h-4 shrink-0 text-kyar-textSecondary" aria-hidden />
          </button>
        )}
        {showInviteCollaborator && (
          <button
            type="button"
            onClick={() => openModal("invite")}
            className="flex items-center gap-2 rounded-full bg-kyar-surface border border-kyar-borderSubtle pl-4 pr-3 py-2.5 text-sm text-kyar-text shadow-md hover:bg-kyar-mutedWarm transition-colors"
          >
            <span>Invite collaborator</span>
            <UserPlus className="w-4 h-4 shrink-0 text-kyar-textSecondary" aria-hidden />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-kyar-text text-kyar-bg shadow-lg hover:opacity-90 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={open ? "Close quick actions" : "Open quick actions"}
      >
        <Plus className={`h-7 w-7 transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
      </button>
    </div>
  );

  return createPortal(fab, document.body);
}
