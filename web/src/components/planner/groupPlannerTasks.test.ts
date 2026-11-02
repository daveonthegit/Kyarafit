import { describe, it, expect } from "vitest";
import {
  groupPlannerTasks,
  isPlannerTaskOverdue,
  listPlannerBuildFilters,
  plannerLocalDate,
  type GroupablePlannerTask,
} from "./groupPlannerTasks";

const TODAY = "2026-11-02";

function task(title: string, extra: Partial<GroupablePlannerTask> = {}): GroupablePlannerTask {
  return { title, status: "not_started", ...extra };
}

const titles = (list: GroupablePlannerTask[]) => list.map((t) => t.title);

describe("groupPlannerTasks", () => {
  it("should_put_tasks_due_today_in_today", () => {
    const groups = groupPlannerTasks([task("Sand armor", { dueDate: TODAY })], { today: TODAY });
    expect(titles(groups.today)).toEqual(["Sand armor"]);
    expect(groups.week).toEqual([]);
    expect(groups.later).toEqual([]);
  });

  it("should_put_open_overdue_tasks_in_today_and_flag_them", () => {
    const overdue = task("Style wig", { dueDate: "2026-10-30", status: "in_progress" });
    const groups = groupPlannerTasks([overdue], { today: TODAY });
    expect(titles(groups.today)).toEqual(["Style wig"]);
    expect(isPlannerTaskOverdue(overdue, TODAY)).toBe(true);
  });

  it("should_move_closed_past_due_tasks_to_later_without_flagging", () => {
    const finished = task("Old fitting", { dueDate: "2026-10-30", status: "done" });
    const cancelled = task("Dropped idea", { dueDate: "2026-10-01", status: "cancelled" });
    const groups = groupPlannerTasks([finished, cancelled], { today: TODAY });
    expect(groups.today).toEqual([]);
    expect(titles(groups.later)).toEqual(["Dropped idea", "Old fitting"]);
    expect(isPlannerTaskOverdue(finished, TODAY)).toBe(false);
  });

  it("should_keep_done_tasks_due_today_in_today", () => {
    const groups = groupPlannerTasks([task("Glue gems", { dueDate: TODAY, status: "done" })], {
      today: TODAY,
    });
    expect(titles(groups.today)).toEqual(["Glue gems"]);
  });

  it("should_put_tasks_due_in_the_next_seven_days_in_this_week", () => {
    const groups = groupPlannerTasks(
      [
        task("Tomorrow", { dueDate: "2026-11-03" }),
        task("Edge of week", { dueDate: "2026-11-09" }),
        task("Past the week", { dueDate: "2026-11-10" }),
      ],
      { today: TODAY }
    );
    expect(titles(groups.week)).toEqual(["Tomorrow", "Edge of week"]);
    expect(titles(groups.later)).toEqual(["Past the week"]);
  });

  it("should_put_tasks_without_a_due_date_in_later_after_dated_ones", () => {
    const groups = groupPlannerTasks(
      [task("Someday"), task("Next month", { dueDate: "2026-12-01" })],
      { today: TODAY }
    );
    expect(titles(groups.later)).toEqual(["Next month", "Someday"]);
  });

  it("should_sort_by_due_date_then_manual_order_then_title", () => {
    const groups = groupPlannerTasks(
      [
        task("B second", { dueDate: TODAY, sortOrder: 1 }),
        task("Overdue first", { dueDate: "2026-11-01", sortOrder: 9 }),
        task("A first", { dueDate: TODAY, sortOrder: 0 }),
        task("C tie", { dueDate: TODAY, sortOrder: 1 }),
      ],
      { today: TODAY }
    );
    expect(titles(groups.today)).toEqual(["Overdue first", "A first", "B second", "C tie"]);
  });

  it("should_ignore_a_time_component_on_due_dates", () => {
    const groups = groupPlannerTasks([task("Timestamped", { dueDate: `${TODAY}T23:00:00` })], {
      today: TODAY,
    });
    expect(titles(groups.today)).toEqual(["Timestamped"]);
  });

  it("should_only_keep_tasks_of_the_selected_build", () => {
    const tasks = [
      task("Raiden today", { buildId: "raiden", dueDate: TODAY }),
      task("Hu Tao today", { buildId: "hutao", dueDate: TODAY }),
      task("Packing", { dueDate: TODAY }),
      task("Raiden later", { buildId: "raiden" }),
    ];
    const filtered = groupPlannerTasks(tasks, { today: TODAY, buildId: "raiden" });
    expect(titles(filtered.today)).toEqual(["Raiden today"]);
    expect(titles(filtered.later)).toEqual(["Raiden later"]);

    const all = groupPlannerTasks(tasks, { today: TODAY, buildId: null });
    expect(all.today).toHaveLength(3);
  });
});

describe("listPlannerBuildFilters", () => {
  const tasks = [
    task("a", { buildId: "raiden", buildName: "Raiden Shogun" }),
    task("b", { buildId: "hutao", buildName: "Hu Tao" }),
    task("c", { buildId: "hutao", buildName: "Hu Tao", status: "done" }),
    task("d", { buildId: "nezuko", buildName: "Nezuko", status: "done" }),
    task("e"),
  ];

  it("should_list_one_tab_per_build_with_open_tasks_sorted_by_name", () => {
    expect(listPlannerBuildFilters(tasks)).toEqual([
      { buildId: "hutao", buildName: "Hu Tao" },
      { buildId: "raiden", buildName: "Raiden Shogun" },
    ]);
  });

  it("should_keep_the_selected_build_tab_after_its_last_task_is_checked", () => {
    expect(listPlannerBuildFilters(tasks, "nezuko").map((b) => b.buildId)).toEqual([
      "hutao",
      "nezuko",
      "raiden",
    ]);
  });
});

describe("plannerLocalDate", () => {
  it("should_use_the_local_calendar_day", () => {
    expect(plannerLocalDate(new Date(2026, 10, 2, 23, 30))).toBe("2026-11-02");
  });
});
