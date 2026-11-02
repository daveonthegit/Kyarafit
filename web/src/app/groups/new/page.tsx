"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMutation } from "convex/react";
import { can } from "@kyarafit/design-system/domain/entitlements";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { PhotoPill } from "@/components/ui/PhotoPill";
import { GroupFields, glassErrorClass } from "@/components/creation/CreationFields";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useFeatureAccess } from "@/lib/api/useTier";
import { api } from "convex/_generated/api";

export default function NewGroupPage() {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const { tier } = useFeatureAccess();
  const t = useTranslations("Social");
  const tc = useTranslations("Creation");
  // REQ-019: creating a group is paid; joining and participating stay free.
  const canCreateGroup = can(tier, "group_create");
  const createGroup = useMutation(api.groups.create);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !name.trim() || !canCreateGroup) return;
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
      setError(err instanceof Error ? err.message : tc("failedToCreateGroup"));
    } finally {
      setPending(false);
    }
  };

  return (
    <WebAppShell fullBleed>
      <div className="relative flex flex-1 flex-col text-kyar-media-fg">
        <div className="absolute inset-0 bg-studio-wall" aria-hidden />

        <div className="relative z-10 mx-auto flex w-full max-w-[1600px] items-center gap-4 px-4 pt-6 sm:px-6 lg:px-10">
          <Link
            href="/groups"
            aria-label={tc("backToGroups")}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-media-fg-70 transition-colors hover:bg-glass-active hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
          >
            <span className="material-symbols-outlined font-light text-2xl" aria-hidden>
              arrow_back
            </span>
          </Link>
        </div>

        <main className="relative z-10 mx-auto mb-16 mt-4 w-full max-w-[560px] flex-1 px-4 sm:px-6">
          {/* ONE glass work panel (13d anatomy, page form) */}
          <div className="rounded-glass border border-glass-border bg-glass backdrop-blur-glass">
            <div className="border-b border-glass-divider-strong px-6 py-5 sm:px-8">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.22em] text-media-fg-70">
                {tc("groupsEyebrow")}
              </span>
              <h1 className="font-serif text-[30px] font-normal italic tracking-[-0.01em]">
                {tc("newGroupTitle")}
              </h1>
            </div>

            {!canCreateGroup ? (
              <div className="px-6 py-6 sm:px-8">
                <UpgradePrompt
                  surface="glass"
                  message={t("groupCreatePaidMessage")}
                  linkText={t("viewPlan")}
                />
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="space-y-[18px] px-6 py-6 sm:px-8">
                  <GroupFields
                    name={name}
                    onNameChange={setName}
                    description={description}
                    onDescriptionChange={setDescription}
                    visibility={visibility}
                    onVisibilityChange={setVisibility}
                    labels={{
                      name: tc("name"),
                      namePlaceholder: tc("groupNamePlaceholder"),
                      description: tc("descriptionLabel"),
                      descriptionPlaceholder: tc("groupDescriptionPlaceholder"),
                      visibility: tc("visibilityLabel"),
                      private: tc("visibility_private"),
                      public: tc("visibility_public"),
                      visibilityHint: tc("visibilityHint"),
                    }}
                  />
                  {error && (
                    <p className={glassErrorClass} role="alert">
                      {error}
                    </p>
                  )}
                </div>
                <div className="flex gap-2.5 border-t border-glass-divider-strong px-6 py-4 sm:px-8">
                  <Link
                    href="/groups"
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-glass-border-strong bg-glass-bar px-[22px] text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg backdrop-blur-glass-chip transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  >
                    {tc("cancel")}
                  </Link>
                  <PhotoPill
                    type="submit"
                    variant="solid"
                    disabled={pending || !name.trim()}
                    className="flex-1"
                  >
                    {pending ? tc("creating") : tc("createGroup")}
                  </PhotoPill>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
    </WebAppShell>
  );
}
