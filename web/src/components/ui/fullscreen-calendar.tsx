"use client";

import * as React from "react";
import {
  add,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isEqual,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfToday,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";

export interface CalendarEvent {
  id: string;
  name: string;
  time?: string;
  datetime: string;
  /** Optional href for task/build/convention link */
  href?: string;
}

export interface CalendarDayData {
  day: Date;
  events: CalendarEvent[];
}

export interface FullScreenCalendarProps {
  data: CalendarDayData[];
  /** Optional: show "New" / add action (e.g. link to builds) */
  addHref?: string;
  addLabel?: string;
}

const colStartClasses = [
  "",
  "col-start-2",
  "col-start-3",
  "col-start-4",
  "col-start-5",
  "col-start-6",
  "col-start-7",
];

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset";

/**
 * Month calendar rendered on glass (Planner → Calendar tab).
 * On-glass text tiers, glass hairline dividers; today = light ring, selected =
 * solid light + ink (segmented-control state, not a CTA — QA-3 exception).
 */
export function FullScreenCalendar({
  data,
  addHref = "/builds",
  addLabel,
}: FullScreenCalendarProps) {
  const t = useTranslations("Planner");
  const locale = useLocale();
  const today = startOfToday();
  const [selectedDay, setSelectedDay] = React.useState(today);
  const [currentMonth, setCurrentMonth] = React.useState(format(today, "MMM-yyyy"));
  const firstDayCurrentMonth = parse(currentMonth, "MMM-yyyy", new Date());
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const days = eachDayOfInterval({
    start: startOfWeek(firstDayCurrentMonth),
    end: endOfWeek(endOfMonth(firstDayCurrentMonth)),
  });
  const weekdayLabels = days
    .slice(0, 7)
    .map((day) => day.toLocaleDateString(locale, { weekday: "short" }));

  function previousMonth() {
    setCurrentMonth(format(add(firstDayCurrentMonth, { months: -1 }), "MMM-yyyy"));
  }

  function nextMonth() {
    setCurrentMonth(format(add(firstDayCurrentMonth, { months: 1 }), "MMM-yyyy"));
  }

  function goToToday() {
    setCurrentMonth(format(today, "MMM-yyyy"));
    setSelectedDay(today);
  }

  const eventsFor = (day: Date) => data.filter((d) => isSameDay(d.day, day));

  /** Day-number badge: selected = solid light/ink, today = light ring. */
  const dayBadgeClass = (day: Date) =>
    cn(
      "flex items-center justify-center rounded-full tabular-nums transition-colors duration-150 ease-out",
      isEqual(day, selectedDay)
        ? "bg-glass-solid text-glass-ink font-semibold"
        : isToday(day)
          ? "ring-1 ring-inset ring-kyar-media-fg text-kyar-media-fg font-semibold"
          : isSameMonth(day, firstDayCurrentMonth)
            ? "text-kyar-media-fg"
            : "text-media-fg-45"
    );

  const compactCell = (day: Date, dayIdx: number) => {
    const dayEvents = eventsFor(day);
    return (
      <button
        key={dayIdx}
        type="button"
        onClick={() => setSelectedDay(day)}
        aria-pressed={isEqual(day, selectedDay)}
        className={cn(
          "flex h-14 flex-col items-end border-b border-r border-glass-divider px-1.5 py-1.5 transition-colors duration-150 ease-out hover:bg-glass-active",
          focusRing
        )}
      >
        <time
          dateTime={format(day, "yyyy-MM-dd")}
          className={cn("size-6 text-xs", dayBadgeClass(day))}
        >
          {format(day, "d")}
        </time>
        {dayEvents.length > 0 && (
          <div className="mt-auto flex w-full flex-wrap-reverse justify-end gap-0.5">
            {dayEvents.flatMap((date) =>
              date.events.map((event) => (
                <span key={event.id} className="h-1.5 w-1.5 rounded-full bg-media-fg-70" />
              ))
            )}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-1 flex-col text-kyar-media-fg">
      {/* Calendar Header */}
      <div className="flex flex-col gap-4 px-2 pb-4 pt-2 md:flex-row md:items-center md:justify-between lg:flex-none">
        <div className="flex items-center gap-4">
          <div className="hidden w-14 flex-col items-center justify-center rounded-[10px] border border-glass-border-strong py-1 md:flex">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-media-fg-55">
              {today.toLocaleDateString(locale, { month: "short" })}
            </span>
            <span className="text-lg font-semibold tabular-nums leading-tight">
              {format(today, "d")}
            </span>
          </div>
          <div className="flex flex-col">
            <h2 className="font-serif italic text-[24px] leading-tight">
              {firstDayCurrentMonth.toLocaleDateString(locale, { month: "long", year: "numeric" })}
            </h2>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-media-fg-55">
              {firstDayCurrentMonth.toLocaleDateString(locale, {
                month: "short",
                day: "numeric",
              })}{" "}
              –{" "}
              {endOfMonth(firstDayCurrentMonth).toLocaleDateString(locale, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex flex-1 items-center rounded-full border border-glass-border md:flex-none">
            <button
              type="button"
              onClick={previousMonth}
              aria-label={t("calendarPrevious")}
              className={cn(
                "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-l-full text-media-fg-70 transition-colors duration-150 ease-out hover:bg-glass-active hover:text-kyar-media-fg",
                focusRing
              )}
            >
              <ChevronLeft size={16} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className={cn(
                "min-h-[44px] flex-1 border-x border-glass-divider px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg transition-colors duration-150 ease-out hover:bg-glass-active md:flex-none",
                focusRing
              )}
            >
              {t("calendarToday")}
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label={t("calendarNext")}
              className={cn(
                "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-full text-media-fg-70 transition-colors duration-150 ease-out hover:bg-glass-active hover:text-kyar-media-fg",
                focusRing
              )}
            >
              <ChevronRight size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>

          {addHref && (
            <Link
              href={addHref}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-2 rounded-full border border-glass-border-strong px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg transition-colors duration-150 ease-out hover:bg-glass-active",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              )}
            >
              <Plus size={14} strokeWidth={2} aria-hidden />
              <span>{addLabel ?? t("addTask")}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="lg:flex lg:flex-auto lg:flex-col">
        {/* Week days header */}
        <div className="grid grid-cols-7 border-y border-l border-glass-divider-strong text-center text-[9px] font-bold uppercase tracking-[0.16em] leading-6 text-media-fg-55 lg:flex-none">
          {weekdayLabels.map((label, index) => (
            <div key={index} className="border-r border-glass-divider py-2">
              {label}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="flex text-xs leading-6 lg:flex-auto">
          {/* Desktop grid */}
          <div className="hidden w-full border-l border-glass-divider lg:grid lg:grid-cols-7 lg:grid-rows-5">
            {days.map((day, dayIdx) =>
              !isDesktop ? (
                compactCell(day, dayIdx)
              ) : (
                <div
                  key={dayIdx}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    dayIdx === 0 && colStartClasses[getDay(day)],
                    !isSameMonth(day, firstDayCurrentMonth) && "bg-glass-bar",
                    "relative flex min-h-[96px] cursor-pointer flex-col border-b border-r border-glass-divider transition-colors duration-150 ease-out hover:bg-glass-active"
                  )}
                >
                  <header className="flex items-center justify-between p-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedDay(day);
                      }}
                      aria-pressed={isEqual(day, selectedDay)}
                      className={cn("h-7 w-7 text-xs", dayBadgeClass(day), focusRing)}
                    >
                      <time dateTime={format(day, "yyyy-MM-dd")}>{format(day, "d")}</time>
                    </button>
                  </header>
                  <div className="flex-1 px-2 pb-2">
                    {eventsFor(day).map((dayData) => (
                      <div key={dayData.day.toISOString()} className="space-y-1">
                        {dayData.events.slice(0, 2).map((event) => (
                          <EventBlock key={event.id} event={event} />
                        ))}
                        {dayData.events.length > 2 && (
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-media-fg-55">
                            {t("calendarMore", { count: dayData.events.length - 2 })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Mobile grid */}
          <div className="isolate grid w-full grid-cols-7 grid-rows-5 border-l border-glass-divider lg:hidden">
            {days.map((day, dayIdx) => compactCell(day, dayIdx))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventBlock({ event }: { event: CalendarEvent }) {
  const content = (
    <div className="flex flex-col items-start gap-0.5 rounded-[8px] border border-glass-border bg-glass-bar px-2 py-1.5 leading-tight transition-colors duration-150 ease-out hover:bg-glass-active">
      <p className="w-full truncate text-[11px] font-medium text-kyar-media-fg">{event.name}</p>
      {event.time && (
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-media-fg-55">
          {event.time}
        </p>
      )}
    </div>
  );
  if (event.href) {
    return (
      <Link
        href={event.href}
        onClick={(e) => e.stopPropagation()}
        className="block rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
      >
        {content}
      </Link>
    );
  }
  return content;
}
