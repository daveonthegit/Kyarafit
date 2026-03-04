"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "convex/react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/Button";

export default function NewConventionPage() {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const createConvention = useMutation(api.conventions.create);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
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
      });
      if (convention) router.push(`/conventions/${convention._id}`);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm px-6 pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center gap-4">
        <Link href="/conventions" className="material-symbols-outlined font-light text-2xl">
          arrow_back
        </Link>
        <p className="meta-label">New Convention</p>
      </header>

      <main className="flex-1 px-6 py-8">
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
          <Button
            type="submit"
            variant="primary"
            disabled={isPending || !name.trim() || !startDate || !endDate}
            className="w-full"
          >
            CREATE CONVENTION
          </Button>
        </form>
      </main>
    </div>
  );
}
