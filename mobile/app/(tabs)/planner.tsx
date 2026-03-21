import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ChecklistRow } from "../../src/components/ui/ChecklistRow";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";

const TODAY = new Date().toISOString().slice(0, 10);

function formatDueDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  if (dateStr === TODAY) return "Today";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type TabView = "daily" | "events" | "calendar";

export default function PlannerTabScreen() {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const [view, setView] = useState<TabView>("daily");

  const plannerTasks = useQuery(api.buildTasks.listForPlanner, userId ? { userId } : "skip");
  const conventions = useQuery(api.conventions.list, userId ? { userId } : "skip");
  const updateTask = useMutation(api.buildTasks.update);

  const handleToggle = useCallback(
    async (taskId: Id<"buildTasks">, checked: boolean) => {
      if (!userId) return;
      try {
        await updateTask({ id: taskId, userId, checked });
      } catch {}
    },
    [userId, updateTask]
  );

  const tasks = plannerTasks ?? [];
  const checkedCount = tasks.filter((t) => t.checked).length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  const dateLabel = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const weekdayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
  });

  return (
    <View className="flex-1 bg-white">
      <View className="bg-white pt-14 border-b border-black/5">
        <View className="px-6 pb-4">
          <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-1">
            {view === "daily" ? weekdayLabel : "Circuit"}
          </Text>
          <Text className="font-serif text-[28px] font-bold italic text-black tracking-tight">
            {view === "daily" ? dateLabel : view === "calendar" ? "Calendar" : "Events"}
          </Text>
        </View>

        <View className="flex-row px-6 py-3 gap-2 border-t border-black/5">
          {(["daily", "events", "calendar"] as TabView[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setView(tab)}
              className={`px-6 py-2 rounded-full border ${
                view === tab ? "bg-black border-black" : "bg-[#F9F9F9] border-black/10"
              }`}
            >
              <Text
                className={`text-[10px] uppercase tracking-[0.2em] font-bold ${
                  view === tab ? "text-white" : "text-black"
                }`}
              >
                {tab}
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
                  <Text className="text-sm font-medium text-black">Progress</Text>
                  <Text className="text-[11px] text-black/60">
                    {checkedCount} / {totalCount} done
                  </Text>
                </View>
                <View className="h-1 bg-black/5 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-black rounded-full"
                    style={{ width: `${progressPct}%` }}
                  />
                </View>
              </View>
            )}

            {tasks.length === 0 && (
              <Text className="text-center mt-10 text-sm text-black/40">
                No tasks yet. Add builds and tasks to see them here.
              </Text>
            )}

            <View className="gap-0">
              {tasks.map((task) => (
                <View key={task._id} className="border-b border-black/5 py-3">
                  <ChecklistRow
                    label={task.label}
                    checked={task.checked}
                    onToggle={() => handleToggle(task._id, !task.checked)}
                  />
                  <View className="flex-row items-center gap-3 pl-8 mt-1">
                    {task.dueDate ? (
                      <Text className="text-[10px] uppercase tracking-widest text-black/40">
                        {formatDueDate(task.dueDate)}
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
                          {task.buildName}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {view === "events" && (
          <View className="gap-4">
            {!conventions || conventions.length === 0 ? (
              <Text className="text-center mt-10 text-sm text-black/40">No events yet.</Text>
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
                    {new Date(con.startDate).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    -{" "}
                    {new Date(con.endDate).toLocaleDateString("en-US", {
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
          <View className="items-center justify-center py-10">
            <Text className="text-sm text-black/40">Calendar view coming soon to mobile.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
