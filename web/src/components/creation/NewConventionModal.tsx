"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOfflineMutation } from "@/lib/offline";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { Calendar } from "@/components/ui/calendar";
import { ImageUpload } from "@/components/ui/ImageUpload";
import {
  CreationFooter,
  GlassLabel,
  GlassTextField,
  glassCalendarClassNames,
} from "@/components/creation/CreationFields";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

type NewConventionModalProps = {
  onDismiss: () => void;
  onSuccessComplete: () => void;
};

export function NewConventionModal({ onDismiss, onSuccessComplete }: NewConventionModalProps) {
  const router = useRouter();
  const t = useTranslations("Creation");
  const { userId } = useCurrentUser();
  const createConvention = useOfflineMutation(api.conventions.create);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [isPending, setIsPending] = useState(false);

  const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "";
  const endDate = dateRange?.to
    ? format(dateRange.to, "yyyy-MM-dd")
    : dateRange?.from
      ? format(dateRange.from, "yyyy-MM-dd")
      : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate || !userId) return;
    setIsPending(true);
    try {
      const convention = await createConvention({
        userId,
        name: name.trim(),
        location: location.trim() || undefined,
        startDate,
        endDate,
        imageUrl: imageUrl.trim() || undefined,
        imageStorageId: imageStorageId ?? undefined,
      });
      if (convention) {
        onSuccessComplete();
        router.push(`/conventions/${convention._id}`);
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AdaptiveModal
      open
      onClose={onDismiss}
      title={t("newEventTitle")}
      titleId="global-new-convention-modal-title"
      size="2xl"
      closeDisabled={isPending}
      closeLabel={t("close")}
      footer={(close) => (
        <CreationFooter
          onCancel={close}
          cancelLabel={t("cancel")}
          cancelDisabled={isPending}
          formId="new-convention-modal-form"
          submitLabel={isPending ? t("creating") : t("createEvent")}
          submitDisabled={isPending || !name.trim() || !startDate || !endDate}
        />
      )}
    >
      <form id="new-convention-modal-form" onSubmit={submit} className="space-y-[18px]">
        <p className="text-[13px] text-media-fg-70">{t("newEventIntro")}</p>
        <ImageUpload
          surface="glass"
          label={t("cover")}
          category="conventions"
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
          aside={
            <>
              <GlassTextField
                label={t("name")}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("eventNamePlaceholder")}
              />
              <GlassTextField
                label={t("locationLabel")}
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("locationPlaceholder")}
              />
            </>
          }
        />
        <div>
          <GlassLabel>{t("datesLabel")}</GlassLabel>
          <div className="mt-[3px] rounded-[10px] border border-glass-border-overlay bg-glass-active p-3">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              pagedNavigation
              showOutsideDays={false}
              className="mx-auto"
              classNames={glassCalendarClassNames}
            />
            {(startDate || endDate) && (
              <p className="mt-3 flex items-center gap-1.5 border-t border-glass-divider pt-3 text-xs tabular-nums text-media-fg-70">
                <CalendarIcon className="size-3.5" aria-hidden />
                {startDate}
                {endDate && startDate !== endDate ? ` – ${endDate}` : ""}
              </p>
            )}
          </div>
        </div>
      </form>
    </AdaptiveModal>
  );
}
