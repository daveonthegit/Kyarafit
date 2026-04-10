"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Sheet } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

type NewConventionModalProps = {
  onDismiss: () => void;
  onSuccessComplete: () => void;
};

export function NewConventionModal({ onDismiss, onSuccessComplete }: NewConventionModalProps) {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const createConvention = useMutation(api.conventions.create);
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
    <Sheet
      open
      onClose={onDismiss}
      title="New event"
      titleId="global-new-convention-modal-title"
      size="2xl"
      closeDisabled={isPending}
      footer={
        <Button
          type="submit"
          form="new-convention-modal-form"
          disabled={isPending || !name.trim() || !startDate || !endDate}
          className="w-full bg-kyar-text py-4 text-[10px] font-bold uppercase tracking-widest text-kyar-bg rounded-full disabled:opacity-50 hover:bg-kyar-text/90 transition-colors shadow-md"
        >
          {isPending ? "Creating…" : "Create event"}
        </Button>
      }
    >
      <form id="new-convention-modal-form" onSubmit={submit} className="space-y-5">
        <p className="text-sm text-kyar-textSecondary">
          Pick a date range and name. Image is optional.
        </p>
        <div>
          <label className="mb-2 block meta-label">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Anime Expo"
            className="w-full border-0 border-b border-kyar-borderSubtle bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:border-kyar-text focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="mb-2 block meta-label">Location (optional)</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City or venue"
            className="w-full border-0 border-b border-kyar-borderSubtle bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:border-kyar-text focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="mb-2 block meta-label">Dates</label>
          <div className="rounded-lg border border-kyar-borderSubtle bg-kyar-muted/30 p-3">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              pagedNavigation
              showOutsideDays={false}
              className="mx-auto"
              classNames={{
                months: "gap-6 sm:gap-8",
                month:
                  "relative first-of-type:before:hidden before:absolute max-sm:before:inset-x-2 max-sm:before:h-px max-sm:before:-top-2 sm:before:inset-y-2 sm:before:w-px before:bg-kyar-borderSubtle sm:before:-left-4",
              }}
            />
            {(startDate || endDate) && (
              <p className="mt-3 flex items-center gap-1.5 border-t border-kyar-borderSubtle pt-3 text-xs text-kyar-meta">
                <CalendarIcon className="size-3.5" />
                {startDate}
                {endDate && startDate !== endDate ? ` – ${endDate}` : ""}
              </p>
            )}
          </div>
        </div>
        <div>
          <label className="mb-2 block meta-label">Image (optional)</label>
          <ImageUpload
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
          />
        </div>
      </form>
    </Sheet>
  );
}
