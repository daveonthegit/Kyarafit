"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/ui/ImageUpload";

export default function EditConventionPage() {
  const params = useParams();
  const id = params.id as Id<"conventions">;
  const router = useRouter();
  const { userId } = useCurrentUser();
  const convention = useQuery(api.conventions.get, id ? { id } : "skip");
  const updateConvention = useMutation(api.conventions.update);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [isPending, setIsPending] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (convention && !initialized.current) {
      initialized.current = true;
      setName(convention.name);
      setLocation(convention.location ?? "");
      setDateRange({
        from: new Date(convention.startDate),
        to: new Date(convention.endDate),
      });
      setImageStorageId(convention.imageStorageId ?? null);
      setImageUrl(convention.imageUrl ?? "");
    }
  }, [convention]);

  const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "";
  const endDate = dateRange?.to
    ? format(dateRange.to, "yyyy-MM-dd")
    : dateRange?.from
      ? format(dateRange.from, "yyyy-MM-dd")
      : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate || !userId || !convention) return;
    if (convention.userId !== userId) return;
    setIsPending(true);
    try {
      await updateConvention({
        id,
        userId,
        name: name.trim(),
        location: location.trim() || undefined,
        startDate,
        endDate,
        imageUrl: imageUrl.trim() || undefined,
        imageStorageId: imageStorageId ?? undefined,
      });
      router.push(`/conventions/${id}`);
    } finally {
      setIsPending(false);
    }
  };

  if (convention === undefined) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Loading...</p>
      </WebAppShell>
    );
  }
  if (!convention) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Convention not found.</p>
        <Link href="/conventions" className="mt-4 text-sm underline">
          Back to Conventions
        </Link>
      </WebAppShell>
    );
  }
  if (convention.userId !== userId) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Not authorized to edit this convention.</p>
        <Link href={`/conventions/${id}`} className="mt-4 text-sm underline">
          Back to Convention
        </Link>
      </WebAppShell>
    );
  }

  return (
    <WebAppShell>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center gap-4">
        <Link
          href={`/conventions/${id}`}
          className="material-symbols-outlined font-light text-2xl"
          aria-label="Back to convention"
        >
          arrow_back
        </Link>
        <p className="meta-label">Edit Convention</p>
      </header>

      <main className="flex-1 py-8">
        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="block meta-label mb-2">NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Anime Expo"
              className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
            />
          </div>
          <div>
            <label className="block meta-label mb-2">LOCATION (OPTIONAL)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or venue"
              className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
            />
          </div>
          <div>
            <label className="block meta-label mb-2">DATES</label>
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
                <p className="mt-3 pt-3 border-t border-kyar-borderSubtle text-xs text-kyar-meta flex items-center gap-1.5">
                  <CalendarIcon className="size-3.5" />
                  {startDate}
                  {endDate && startDate !== endDate ? ` – ${endDate}` : ""}
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="block meta-label mb-2">IMAGE (OPTIONAL)</label>
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
          <Button
            type="submit"
            variant="primary"
            disabled={isPending || !name.trim() || !startDate || !endDate}
            className="w-full"
          >
            SAVE CHANGES
          </Button>
        </form>
      </main>
    </WebAppShell>
  );
}
