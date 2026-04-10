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
import { ChevronLeft, ChevronRight, PlusCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Separator } from "@/components/ui/Separator";
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

export function FullScreenCalendar({
  data,
  addHref = "/builds",
  addLabel = "Add task",
}: FullScreenCalendarProps) {
  const today = startOfToday();
  const [selectedDay, setSelectedDay] = React.useState(today);
  const [currentMonth, setCurrentMonth] = React.useState(format(today, "MMM-yyyy"));
  const firstDayCurrentMonth = parse(currentMonth, "MMM-yyyy", new Date());
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const days = eachDayOfInterval({
    start: startOfWeek(firstDayCurrentMonth),
    end: endOfWeek(endOfMonth(firstDayCurrentMonth)),
  });

  function previousMonth() {
    const firstDayNextMonth = add(firstDayCurrentMonth, { months: -1 });
    setCurrentMonth(format(firstDayNextMonth, "MMM-yyyy"));
  }

  function nextMonth() {
    const firstDayNextMonth = add(firstDayCurrentMonth, { months: 1 });
    setCurrentMonth(format(firstDayNextMonth, "MMM-yyyy"));
  }

  function goToToday() {
    setCurrentMonth(format(today, "MMM-yyyy"));
    setSelectedDay(today);
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Calendar Header */}
      <div className="flex flex-col space-y-4 p-4 md:flex-row md:items-center md:justify-between md:space-y-0 lg:flex-none">
        <div className="flex flex-auto">
          <div className="flex items-center gap-4">
            <div className="hidden w-20 flex-col items-center justify-center rounded-sm border border-kyar-cardBorder bg-kyar-surfaceWarm p-0.5 md:flex">
              <span className="p-1 text-[10px] uppercase tracking-wider text-kyar-meta">
                {format(today, "MMM")}
              </span>
              <div className="flex w-full items-center justify-center rounded-sm border border-kyar-cardBorder bg-kyar-bgWarm p-0.5 text-lg font-semibold text-kyar-text">
                {format(today, "d")}
              </div>
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold text-kyar-text">
                {format(firstDayCurrentMonth, "MMMM, yyyy")}
              </h2>
              <p className="text-sm text-kyar-textTertiary">
                {format(firstDayCurrentMonth, "MMM d, yyyy")} –{" "}
                {format(endOfMonth(firstDayCurrentMonth), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 md:flex-row md:gap-6">
          <Separator orientation="vertical" className="hidden h-6 lg:block" />

          <div className="inline-flex w-full -space-x-px rounded-sm border border-kyar-cardBorder md:w-auto rtl:space-x-reverse">
            <button
              type="button"
              onClick={previousMonth}
              aria-label="Previous month"
              className="min-h-[44px] min-w-[44px] rounded-none border-0 border-r border-kyar-cardBorder bg-kyar-surfaceWarm text-kyar-text hover:bg-kyar-mutedWarm focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 first:rounded-l-sm last:rounded-r-sm"
            >
              <ChevronLeft size={16} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="min-h-[44px] flex-1 rounded-none border-0 border-r border-kyar-cardBorder bg-kyar-surfaceWarm px-4 text-[10px] uppercase tracking-wider text-kyar-text hover:bg-kyar-mutedWarm focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 md:flex-none last:rounded-r-sm last:border-r-0"
            >
              Today
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="min-h-[44px] min-w-[44px] rounded-none border-0 bg-kyar-surfaceWarm text-kyar-text hover:bg-kyar-mutedWarm focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 first:rounded-l-sm last:rounded-r-sm"
            >
              <ChevronRight size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>

          <Separator orientation="vertical" className="hidden h-6 md:block" />
          <Separator orientation="horizontal" className="block w-full md:hidden" />

          {addHref && (
            <Link href={addHref} className="w-full md:w-auto">
              <Button variant="secondary" className="w-full gap-2 md:w-auto">
                <PlusCircle size={16} strokeWidth={2} aria-hidden />
                <span>{addLabel}</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="lg:flex lg:flex-auto lg:flex-col">
        {/* Week days header */}
        <div className="grid grid-cols-7 border-b border-l border-kyar-cardBorder text-center text-[10px] font-semibold uppercase tracking-wider leading-6 text-kyar-meta lg:flex-none">
          <div className="border-r border-kyar-cardBorder py-2.5">Sun</div>
          <div className="border-r border-kyar-cardBorder py-2.5">Mon</div>
          <div className="border-r border-kyar-cardBorder py-2.5">Tue</div>
          <div className="border-r border-kyar-cardBorder py-2.5">Wed</div>
          <div className="border-r border-kyar-cardBorder py-2.5">Thu</div>
          <div className="border-r border-kyar-cardBorder py-2.5">Fri</div>
          <div className="py-2.5">Sat</div>
        </div>

        {/* Calendar days */}
        <div className="flex text-xs leading-6 lg:flex-auto">
          {/* Desktop grid */}
          <div className="hidden w-full border-x border-kyar-cardBorder lg:grid lg:grid-cols-7 lg:grid-rows-5">
            {days.map((day, dayIdx) =>
              !isDesktop ? (
                <button
                  key={dayIdx}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    isEqual(day, selectedDay) && "text-kyar-bg",
                    !isEqual(day, selectedDay) &&
                      !isToday(day) &&
                      isSameMonth(day, firstDayCurrentMonth) &&
                      "text-kyar-text",
                    !isEqual(day, selectedDay) &&
                      !isToday(day) &&
                      !isSameMonth(day, firstDayCurrentMonth) &&
                      "text-kyar-textTertiary",
                    (isEqual(day, selectedDay) || isToday(day)) && "font-semibold",
                    "flex h-14 flex-col border-b border-r border-kyar-cardBorder px-3 py-2 hover:bg-kyar-mutedWarm focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  )}
                >
                  <time
                    dateTime={format(day, "yyyy-MM-dd")}
                    className={cn(
                      "ml-auto flex size-6 items-center justify-center rounded-full",
                      isEqual(day, selectedDay) && isToday(day) && "bg-kyar-text text-kyar-bg",
                      isEqual(day, selectedDay) && !isToday(day) && "bg-kyar-text text-kyar-bg"
                    )}
                  >
                    {format(day, "d")}
                  </time>
                  {data.filter((d) => isSameDay(d.day, day)).length > 0 && (
                    <div>
                      {data
                        .filter((d) => isSameDay(d.day, day))
                        .map((date) => (
                          <div
                            key={date.day.toISOString()}
                            className="-mx-0.5 mt-auto flex flex-wrap-reverse"
                          >
                            {date.events.map((event) => (
                              <span
                                key={event.id}
                                className="mx-0.5 mt-1 h-1.5 w-1.5 rounded-full bg-kyar-textTertiary"
                              />
                            ))}
                          </div>
                        ))}
                    </div>
                  )}
                </button>
              ) : (
                <div
                  key={dayIdx}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    dayIdx === 0 && colStartClasses[getDay(day)],
                    !isEqual(day, selectedDay) &&
                      !isToday(day) &&
                      !isSameMonth(day, firstDayCurrentMonth) &&
                      "bg-kyar-mutedWarm/50 text-kyar-textTertiary",
                    "relative flex cursor-pointer flex-col border-b border-r border-kyar-cardBorder hover:bg-kyar-mutedWarm focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  )}
                >
                  <header className="flex items-center justify-between p-2.5">
                    <span
                      className={cn(
                        isEqual(day, selectedDay) && "text-kyar-bg",
                        !isEqual(day, selectedDay) &&
                          !isToday(day) &&
                          isSameMonth(day, firstDayCurrentMonth) &&
                          "text-kyar-text",
                        !isEqual(day, selectedDay) &&
                          !isToday(day) &&
                          !isSameMonth(day, firstDayCurrentMonth) &&
                          "text-kyar-textTertiary",
                        isEqual(day, selectedDay) && isToday(day) && "rounded-full bg-kyar-text",
                        isEqual(day, selectedDay) && !isToday(day) && "rounded-full bg-kyar-text",
                        (isEqual(day, selectedDay) || isToday(day)) && "font-semibold",
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs"
                      )}
                    >
                      <time dateTime={format(day, "yyyy-MM-dd")}>{format(day, "d")}</time>
                    </span>
                  </header>
                  <div className="flex-1 p-2.5">
                    {data
                      .filter((d) => isSameDay(d.day, day))
                      .map((dayData) => (
                        <div key={dayData.day.toISOString()} className="space-y-1.5">
                          {dayData.events.slice(0, 2).map((event) => (
                            <EventBlock key={event.id} event={event} />
                          ))}
                          {dayData.events.length > 2 && (
                            <p className="text-[10px] uppercase tracking-wider text-kyar-meta">
                              +{dayData.events.length - 2} more
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
          <div className="isolate grid w-full grid-cols-7 grid-rows-5 border-x border-kyar-cardBorder lg:hidden">
            {days.map((day, dayIdx) => (
              <button
                key={dayIdx}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={cn(
                  isEqual(day, selectedDay) && "text-kyar-bg",
                  !isEqual(day, selectedDay) &&
                    !isToday(day) &&
                    isSameMonth(day, firstDayCurrentMonth) &&
                    "text-kyar-text",
                  !isEqual(day, selectedDay) &&
                    !isToday(day) &&
                    !isSameMonth(day, firstDayCurrentMonth) &&
                    "text-kyar-textTertiary",
                  (isEqual(day, selectedDay) || isToday(day)) && "font-semibold",
                  "flex h-14 flex-col border-b border-r border-kyar-cardBorder px-3 py-2 hover:bg-kyar-mutedWarm focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                )}
              >
                <time
                  dateTime={format(day, "yyyy-MM-dd")}
                  className={cn(
                    "ml-auto flex size-6 items-center justify-center rounded-full",
                    isEqual(day, selectedDay) && isToday(day) && "bg-kyar-text text-kyar-bg",
                    isEqual(day, selectedDay) && !isToday(day) && "bg-kyar-text text-kyar-bg"
                  )}
                >
                  {format(day, "d")}
                </time>
                {data.filter((d) => isSameDay(d.day, day)).length > 0 && (
                  <div>
                    {data
                      .filter((d) => isSameDay(d.day, day))
                      .map((date) => (
                        <div
                          key={date.day.toISOString()}
                          className="-mx-0.5 mt-auto flex flex-wrap-reverse"
                        >
                          {date.events.map((event) => (
                            <span
                              key={event.id}
                              className="mx-0.5 mt-1 h-1.5 w-1.5 rounded-full bg-kyar-textTertiary"
                            />
                          ))}
                        </div>
                      ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventBlock({ event }: { event: CalendarEvent }) {
  const content = (
    <div className="flex flex-col items-start gap-0.5 rounded-sm border border-kyar-cardBorder bg-kyar-surfaceWarm p-2 text-xs leading-tight">
      <p className="font-medium leading-none text-kyar-text">{event.name}</p>
      {event.time && <p className="leading-none text-kyar-textTertiary">{event.time}</p>}
    </div>
  );
  if (event.href) {
    return (
      <Link
        href={event.href}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded-sm"
      >
        {content}
      </Link>
    );
  }
  return content;
}
