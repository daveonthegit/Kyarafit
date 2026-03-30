import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ChecklistRow } from "../../src/components/ui/ChecklistRow";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";
import { ProgressBar } from "../../src/components/shared";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router";
import { listPlannerTasks, toggleTaskChecked } from "../../src/storage/buildTasksRepo";

const TODAY = new Date().toISOString().slice(0, 10);

function formatDueDate(
  dateStr: string | undefined,
  todayIso: string,
  locale: string,
  t: (key: string) => string
): string {
  if (!dateStr) return "";
  if (dateStr === todayIso) return t("Planner.today");
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type TabView = "daily" | "events" | "calendar";

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export default function PlannerTabScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const router = useRouter();
  const { userId } = useCurrentUser();
  const [view, setView] = useState<TabView>("daily");
  const [monthCursor, setMonthCursor] = useState(() => new Date());

  const plannerTasks = useQuery(api.workflow.listPlanner, userId ? { userId } : "skip");
  const conventions = useQuery(api.conventions.list, userId ? { userId } : "skip");
  const updateTask = useMutation(api.workflow.update);
  const [localTasks, setLocalTasks] = useState<
    Array<{
      _id: string;
      title: string;
      status: string;
      dueDate?: string;
      buildId?: string;
      buildName?: string | null;
      progressPercent: number;
    }>
  >([]);

  useFocusEffect(
    useCallback(() => {
      if (userId) return;
      listPlannerTasks()
        .then((tasks) =>
          setLocalTasks(
            tasks.map((task) => ({
              _id: task.id,
              title: task.label,
              status: task.checked ? "done" : "not_started",
              dueDate: task.dueDate,
              buildId: task.buildId,
              buildName: task.buildId,
              progressPercent: task.checked ? 100 : 0,
            }))
          )
        )
        .catch(() => setLocalTasks([]));
    }, [userId])
  );

  const handleToggle = useCallback(
    async (taskId: Id<"workflowItems">, checked: boolean) => {
      if (!userId) {
        const localTask = localTasks.find((task) => task._id === taskId);
        if (!localTask?.buildId) return;
        await toggleTaskChecked(taskId, localTask.buildId);
        const refreshed = await listPlannerTasks();
        setLocalTasks(
          refreshed.map((task) => ({
            _id: task.id,
            title: task.label,
            status: task.checked ? "done" : "not_started",
            dueDate: task.dueDate,
            buildId: task.buildId,
            buildName: task.buildId,
            progressPercent: task.checked ? 100 : 0,
          }))
        );
        return;
      }
      try {
        await updateTask({ id: taskId, userId, status: checked ? "done" : "not_started" });
      } catch {}
    },
    [localTasks, updateTask, userId]
  );

  const tasks = userId ? (plannerTasks ?? []) : localTasks;
  const tasksByDueDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (task.dueDate) {
        map.set(task.dueDate, (map.get(task.dueDate) ?? 0) + 1);
      }
    }
    return map;
  }, [tasks]);

  const y = monthCursor.getFullYear();
  const m = monthCursor.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const dim = daysInMonth(y, m);
  const monthLabel = monthCursor.toLocaleDateString(locale, { month: "long", year: "numeric" });

  const checkedCount = tasks.filter((task) => task.status === "done").length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  const now = new Date();
  const dateLabel = now.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const weekdayLabel = now.toLocaleDateString(locale, {
    weekday: "long",
  });

  const viewTabs: { id: TabView; labelKey: string }[] = [
    { id: "daily", labelKey: "Planner.tabDaily" },
    { id: "events", labelKey: "Planner.tabEvents" },
    { id: "calendar", labelKey: "Planner.tabCalendar" },
  ];

  const calInitials = [
    t("Planner.calSun"),
    t("Planner.calMon"),
    t("Planner.calTue"),
    t("Planner.calWed"),
    t("Planner.calThu"),
    t("Planner.calFri"),
    t("Planner.calSat"),
  ];

  return (
    <View className="flex-1 bg-white">
      <View className="bg-white pt-14 border-b border-black/5">
        <View className="px-6 pb-4">
          <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-1">
            {view === "daily" ? weekdayLabel : t("Planner.circuit")}
          </Text>
          <Text className="font-serif text-[28px] font-bold italic text-black tracking-tight">
            {view === "daily"
              ? dateLabel
              : view === "calendar"
                ? t("Planner.calendarTitle")
                : t("Planner.eventsTitle")}
          </Text>
        </View>

        <View className="flex-row px-6 py-3 gap-2 border-t border-black/5">
          {viewTabs.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setView(tab.id)}
              className={`px-6 py-2 rounded-full border ${
                view === tab.id ? "bg-black border-black" : "bg-[#F9F9F9] border-black/10"
              }`}
            >
              <Text
                className={`text-[10px] uppercase tracking-[0.2em] font-bold ${
                  view === tab.id ? "text-white" : "text-black"
                }`}
              >
                {t(tab.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 140 }}>
        {view === "daily" && (
          <>
            {totalCount > 0 && (
              <View className="mb-6">
                <View className="flex-row justify-between items-end mb-2">
                  <Text className="text-sm font-medium text-black">{t("Planner.progress")}</Text>
                  <Text className="text-[11px] text-black/60">
                    {t("Planner.progressLine", {
                      checked: checkedCount,
                      total: totalCount,
                      done: t("Planner.done"),
                    })}
                  </Text>
                </View>
                <ProgressBar progress={progressPct} height={4} />
              </View>
            )}

            {tasks.length === 0 && (
              <Text className="text-center mt-10 text-sm text-black/40">
                {t("Planner.noTasks")}
              </Text>
            )}

            <View className="gap-0">
              {tasks.map((task) => (
                <View key={task._id} className="border-b border-black/5 py-3">
                  <ChecklistRow
                    label={task.title}
                    checked={task.status === "done"}
                    onToggle={() =>
                      handleToggle(task._id as Id<"workflowItems">, task.status !== "done")
                    }
                  />
                  <View className="flex-row items-center gap-3 pl-8 mt-1">
                    {task.dueDate ? (
                      <Text className="text-[10px] uppercase tracking-widest text-black/40">
                        {formatDueDate(task.dueDate, TODAY, locale, t)}
                      </Text>
                    ) : null}
                    {task.buildId ? (
                      <Pressable
                        onPress={() =>
                          router.push({ pathname: "/build-detail", params: { id: task.buildId } })
                        }
                        hitSlop={8}
                      >
                        <Text className="text-[11px] text-black/60 underline">
                          {task.buildName ?? "Build"}
                        </Text>
                      </Pressable>
                    ) : null}
                    <Text className="text-[10px] uppercase tracking-widest text-black/30">
                      {task.status.split("_").join(" ")}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {view === "events" && (
          <View className="gap-4">
            {!conventions || conventions.length === 0 ? (
              <Text className="text-center mt-10 text-sm text-black/40">
                {t("Planner.noEvents")}
              </Text>
            ) : (
              conventions.map((con) => (
                <Pressable
                  key={con._id}
                  className="border border-black/10 rounded-xl p-4 bg-[#F9F9F9]"
                  onPress={() =>
                    router.push({ pathname: "/convention-detail", params: { id: con._id } })
                  }
                >
                  <Text className="font-serif text-xl text-black">{con.name}</Text>
                  <Text className="text-[10px] uppercase tracking-widest text-black/50 mt-1">
                    {new Date(con.startDate).toLocaleDateString(locale, {
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    -{" "}
                    {new Date(con.endDate).toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        {view === "calendar" && (
          <View>
            {!userId ? (
              <Text className="text-center text-sm text-black/40">
                {t("Planner.signInCalendar")}
              </Text>
            ) : (
              <>
                <View className="flex-row justify-between items-center mb-4">
                  <Pressable
                    onPress={() => setMonthCursor(new Date(y, m - 1, 1))}
                    className="px-3 py-2 border border-black/10 rounded-full"
                  >
                    <Text className="text-xs font-semibold text-black">‹</Text>
                  </Pressable>
                  <Text className="font-serif text-lg italic text-black">{monthLabel}</Text>
                  <Pressable
                    onPress={() => setMonthCursor(new Date(y, m + 1, 1))}
                    className="px-3 py-2 border border-black/10 rounded-full"
                  >
                    <Text className="text-xs font-semibold text-black">›</Text>
                  </Pressable>
                </View>
                <View className="flex-row justify-between mb-2 px-1">
                  {calInitials.map((d, idx) => (
                    <Text
                      key={idx}
                      className="w-[12%] text-center text-[10px] uppercase text-black/40"
                    >
                      {d}
                    </Text>
                  ))}
                </View>
                <View className="flex-row flex-wrap">
                  {Array.from({ length: firstDow }).map((_, i) => (
                    <View key={`pad-${i}`} className="w-[14.28%] aspect-square p-0.5" />
                  ))}
                  {Array.from({ length: dim }).map((_, i) => {
                    const day = i + 1;
                    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const n = tasksByDueDate.get(iso) ?? 0;
                    return (
                      <View key={iso} className="w-[14.28%] aspect-square p-0.5">
                        <View className="flex-1 border border-black/5 rounded-md items-center justify-center bg-white">
                          <Text className="text-xs text-black">{day}</Text>
                          {n > 0 ? (
                            <View className="absolute bottom-1 w-1 h-1 rounded-full bg-black" />
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Text className="text-[10px] text-black/45 mt-4 text-center">
                  {t("Planner.calendarDots")}
                </Text>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
