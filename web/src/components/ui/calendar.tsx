"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const calendarNavButtonClass =
  "inline-flex items-center justify-center h-9 w-9 rounded-sm text-kyar-meta hover:text-black hover:bg-kyar-muted p-0 outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components: userComponents,
  ...props
}: CalendarProps) {
  const defaultClassNames = {
    months: "relative flex flex-col sm:flex-row gap-4",
    month: "w-full",
    month_caption: "relative mx-10 mb-1 flex h-9 items-center justify-center z-20",
    caption_label: "text-sm font-medium text-black",
    nav: "absolute top-0 flex w-full justify-between z-10",
    button_previous: calendarNavButtonClass,
    button_next: calendarNavButtonClass,
    weekday: "h-9 p-0 text-xs font-medium text-kyar-meta",
    day_button:
      "relative flex h-9 w-9 items-center justify-center whitespace-nowrap rounded-sm p-0 text-black outline-offset-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 hover:bg-kyar-muted data-[selected]:bg-black data-[selected]:text-white data-[selected]:hover:bg-black data-[selected]:hover:text-white data-[disabled]:pointer-events-none data-[disabled]:text-kyar-textMuted data-[disabled]:line-through data-[outside]:text-kyar-textMuted data-[outside]:data-[selected]:text-white data-[outside]:data-[selected]:bg-kyar-muted group-[.range-start:not(.range-end)]:rounded-e-none group-[.range-end:not(.range-start)]:rounded-s-none group-[.range-middle]:rounded-none group-data-[selected]:group-[.range-middle]:bg-kyar-muted group-data-[selected]:group-[.range-middle]:text-black",
    day: "group h-9 w-9 p-0 text-sm",
    range_start: "range-start",
    range_end: "range-end",
    range_middle: "range-middle",
    today:
      "*:after:pointer-events-none *:after:absolute *:after:bottom-1 *:after:start-1/2 *:after:z-10 *:after:size-[3px] *:after:-translate-x-1/2 *:after:rounded-full *:after:bg-kyar-accent data-[selected]:*:after:bg-white data-[disabled]:*:after:bg-kyar-textMuted",
    outside:
      "text-kyar-textMuted data-[selected]:bg-kyar-muted/50 data-[selected]:text-kyar-textMuted",
    hidden: "invisible",
    week_number: "h-9 p-0 text-xs font-medium text-kyar-meta",
  };

  const mergedClassNames: typeof defaultClassNames = Object.keys(defaultClassNames).reduce(
    (acc, key) => ({
      ...acc,
      [key]: classNames?.[key as keyof typeof classNames]
        ? cn(
            defaultClassNames[key as keyof typeof defaultClassNames],
            classNames[key as keyof typeof classNames]
          )
        : defaultClassNames[key as keyof typeof defaultClassNames],
    }),
    {} as typeof defaultClassNames
  );

  const defaultComponents = {
    Chevron: (props: {
      orientation?: "left" | "right" | "up" | "down";
      className?: string;
      size?: number;
      disabled?: boolean;
    }) => {
      if (props.orientation === "left") {
        return (
          <ChevronLeft
            size={props.size ?? 16}
            strokeWidth={2}
            aria-hidden="true"
            className={props.className}
          />
        );
      }
      if (props.orientation === "up") {
        return (
          <ChevronLeft
            size={props.size ?? 16}
            strokeWidth={2}
            aria-hidden="true"
            className={cn("rotate-90", props.className)}
          />
        );
      }
      if (props.orientation === "down") {
        return (
          <ChevronRight
            size={props.size ?? 16}
            strokeWidth={2}
            aria-hidden="true"
            className={cn("rotate-90", props.className)}
          />
        );
      }
      return (
        <ChevronRight
          size={props.size ?? 16}
          strokeWidth={2}
          aria-hidden="true"
          className={props.className}
        />
      );
    },
  };

  const mergedComponents = {
    ...defaultComponents,
    ...userComponents,
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-fit", className)}
      classNames={mergedClassNames}
      components={mergedComponents}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
