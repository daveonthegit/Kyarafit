import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useCurrentUser } from "../src/hooks/useCurrentUser";

export default function ConventionEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const conventionId = id as Id<"conventions"> | undefined;
  const { userId } = useCurrentUser();

  const convention = useQuery(api.conventions.get, conventionId ? { id: conventionId } : "skip");
  const updateConvention = useMutation(api.conventions.update);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pending, setPending] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (convention && !initialized.current) {
      initialized.current = true;
      setName(convention.name);
      setLocation(convention.location ?? "");
      setStartDate(convention.startDate);
      setEndDate(convention.endDate);
    }
  }, [convention]);

  const submit = async () => {
    if (!conventionId || !userId || !name.trim() || !startDate || !endDate) {
      Alert.alert("Check fields", "Name and start/end dates (YYYY-MM-DD) are required.");
      return;
    }
    setPending(true);
    try {
      await updateConvention({
        id: conventionId,
        userId,
        name: name.trim(),
        location: location.trim() || undefined,
        startDate,
        endDate,
      });
      router.replace({
        pathname: "/convention-detail",
        params: { id: conventionId },
      } as unknown as Parameters<typeof router.replace>[0]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    } finally {
      setPending(false);
    }
  };

  if (!conventionId) {
    return (
      <View className="flex-1 bg-white justify-center px-6">
        <Text className="text-sm text-black/50">Missing convention id.</Text>
      </View>
    );
  }

  if (convention === undefined) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!convention || convention.userId !== userId) {
    return (
      <View className="flex-1 bg-white px-6 pt-16">
        <Text className="text-sm text-black/50">Not found or not authorized.</Text>
        <Pressable className="mt-4" onPress={() => router.back()}>
          <Text className="text-black underline">Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
        <View className="flex-row items-center gap-4 px-6 pt-14 pb-4 border-b border-black/5">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
          <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
            Events
          </Text>
        </View>

        <View className="px-6 mt-8">
          <Text className="font-serif text-3xl italic text-black mb-8">Edit event</Text>

          <Text className="text-[10px] uppercase tracking-[0.2em] text-black/45 mb-2">Name</Text>
          <TextInput
            className="border border-black/10 rounded-md px-3 py-3 text-sm text-black mb-6"
            value={name}
            onChangeText={setName}
            placeholder="Convention name"
          />

          <Text className="text-[10px] uppercase tracking-[0.2em] text-black/45 mb-2">
            Location
          </Text>
          <TextInput
            className="border border-black/10 rounded-md px-3 py-3 text-sm text-black mb-6"
            value={location}
            onChangeText={setLocation}
            placeholder="City, venue"
          />

          <Text className="text-[10px] uppercase tracking-[0.2em] text-black/45 mb-2">
            Start date (YYYY-MM-DD)
          </Text>
          <TextInput
            className="border border-black/10 rounded-md px-3 py-3 text-sm text-black mb-4"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2025-06-01"
            autoCapitalize="none"
          />

          <Text className="text-[10px] uppercase tracking-[0.2em] text-black/45 mb-2">
            End date (YYYY-MM-DD)
          </Text>
          <TextInput
            className="border border-black/10 rounded-md px-3 py-3 text-sm text-black mb-8"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2025-06-03"
            autoCapitalize="none"
          />

          <Pressable
            className={`bg-black py-4 items-center rounded-full ${pending ? "opacity-50" : ""}`}
            onPress={submit}
            disabled={pending}
          >
            <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
              {pending ? "Saving…" : "Save changes"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
