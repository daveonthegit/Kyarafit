import { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useCurrentUser } from "../src/hooks/useCurrentUser";
import { useTranslation } from "react-i18next";

export default function GroupNewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userId } = useCurrentUser();
  const createGroup = useMutation(api.groups.create);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!userId || !name.trim()) {
      Alert.alert(t("GroupNew.nameRequired"), t("GroupNew.enterName"));
      return;
    }
    setPending(true);
    try {
      const group = await createGroup({
        userId,
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
      });
      if (group?._id) {
        router.replace({
          pathname: "/group-detail",
          params: { id: group._id as string },
        } as unknown as Parameters<typeof router.replace>[0]);
      }
    } catch (err) {
      Alert.alert(
        t("Common.error"),
        err instanceof Error ? err.message : t("GroupNew.createFailed")
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
        <View className="flex-row items-center gap-4 px-6 pt-14 pb-4 border-b border-black/5">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
          <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
            {t("GroupNew.meta")}
          </Text>
        </View>

        <View className="px-6 mt-8">
          <Text className="font-serif text-3xl italic text-black mb-8">New group</Text>

          <Text className="text-[10px] uppercase tracking-[0.2em] text-black/45 mb-2">Name</Text>
          <TextInput
            className="border border-black/10 rounded-md px-3 py-3 text-sm text-black mb-6"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sailor Moon squad"
            placeholderTextColor="rgba(0,0,0,0.35)"
            maxLength={500}
          />

          <Text className="text-[10px] uppercase tracking-[0.2em] text-black/45 mb-2">
            {t("GroupNew.description")}
          </Text>
          <TextInput
            className="border border-black/10 rounded-md px-3 py-3 text-sm text-black mb-6 min-h-[88px]"
            value={description}
            onChangeText={setDescription}
            placeholder={t("GroupNew.descriptionPlaceholder")}
            placeholderTextColor="rgba(0,0,0,0.35)"
            multiline
            textAlignVertical="top"
            maxLength={10000}
          />

          <Text className="text-[10px] uppercase tracking-[0.2em] text-black/45 mb-2">
            {t("GroupNew.visibility")}
          </Text>
          <View className="flex-row gap-2 mb-8">
            <Pressable
              onPress={() => setVisibility("private")}
              className={`px-4 py-2 rounded-full border ${visibility === "private" ? "border-black bg-black/5" : "border-black/10"}`}
            >
              <Text className="text-[10px] uppercase font-bold text-black">
                {t("GroupNew.private")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setVisibility("public")}
              className={`px-4 py-2 rounded-full border ${visibility === "public" ? "border-black bg-black/5" : "border-black/10"}`}
            >
              <Text className="text-[10px] uppercase font-bold text-black">
                {t("GroupNew.public")}
              </Text>
            </Pressable>
          </View>

          <Pressable
            className={`bg-black py-4 items-center rounded-full ${pending ? "opacity-50" : ""}`}
            onPress={submit}
            disabled={pending}
          >
            <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
              {pending ? t("GroupNew.creating") : t("GroupNew.create")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
