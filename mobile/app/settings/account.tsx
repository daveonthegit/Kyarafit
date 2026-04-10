import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { authClient, deleteAccount } from "../../src/lib/auth/client";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";
import { StorageImage } from "../../src/components/shared";
import { postToConvexUpload } from "../../src/lib/convexUpload";
import { getWebAppOrigin } from "../../src/lib/webOrigin";
import { clearSignedInAccountData } from "../../src/storage/accountData";

export default function SettingsAccountScreen() {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const { data: session, loading: sessionLoading } = authClient.useSession();
  const convexUser = useQuery(api.users.getByExternalId, userId ? { externalId: userId } : "skip");

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const updateProfileImage = useMutation(api.users.updateProfileImage);
  const updateProfile = useMutation(api.users.updateProfile);

  const user = session?.user;

  const [displayNameEdit, setDisplayNameEdit] = useState<string | null>(null);
  const [displayNameLoading, setDisplayNameLoading] = useState(false);
  const [usernameEdit, setUsernameEdit] = useState<string | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [bioEdit, setBioEdit] = useState<string | null>(null);
  const [bioLoading, setBioLoading] = useState(false);
  const [visEdit, setVisEdit] = useState<"private" | "public" | null>(null);
  const [uploading, setUploading] = useState(false);

  const displayUsername =
    (user as { username?: string; displayUsername?: string } | undefined)?.displayUsername ??
    (user as { username?: string } | undefined)?.username ??
    convexUser?.username;

  const pickProfileImage = useCallback(async () => {
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission", "Photo library access is needed.");
      return;
    }
    setUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const res = await fetch(asset.uri);
      const buf = await res.arrayBuffer();
      const uploadUrl = await generateUploadUrl();
      const storageId = await postToConvexUpload(uploadUrl, buf, asset.mimeType ?? "image/jpeg");
      await updateProfileImage({ storageId });
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setUploading(false);
    }
  }, [userId, generateUploadUrl, updateProfileImage]);

  const saveDisplayName = async () => {
    const trimmed = (displayNameEdit ?? "").trim();
    setDisplayNameLoading(true);
    try {
      const result = (await authClient.updateUser({ name: trimmed })) as {
        error?: { message?: string };
      };
      if (result?.error) {
        Alert.alert("Error", result.error.message ?? "Could not update name.");
      } else {
        await updateProfile({ displayName: trimmed || undefined });
        setDisplayNameEdit(null);
      }
    } catch {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setDisplayNameLoading(false);
    }
  };

  const saveUsername = async () => {
    const raw = (usernameEdit ?? "").trim().toLowerCase();
    setUsernameError(null);
    setUsernameLoading(true);
    try {
      await updateProfile({ username: raw || undefined });
      setUsernameEdit(null);
    } catch (e) {
      setUsernameError(e instanceof Error ? e.message : "Could not update username.");
    } finally {
      setUsernameLoading(false);
    }
  };

  const saveBio = async () => {
    const trimmed = (bioEdit ?? "").trim();
    setBioLoading(true);
    try {
      await updateProfile({ bio: trimmed || undefined });
      setBioEdit(null);
    } finally {
      setBioLoading(false);
    }
  };

  const openPasswordReset = () => {
    const origin = getWebAppOrigin();
    if (!origin) {
      Alert.alert(
        "Configure EXPO_PUBLIC_WEB_ORIGIN",
        "Set your web app URL in .env to open password reset."
      );
      return;
    }
    Linking.openURL(`${origin.replace(/\/$/, "")}/auth/reset-password`);
  };

  const openPrivacyPolicy = () => {
    const origin = getWebAppOrigin();
    if (!origin) {
      Alert.alert(
        "Privacy policy unavailable",
        "Set EXPO_PUBLIC_WEB_ORIGIN so the app can open the hosted privacy policy."
      );
      return;
    }
    Linking.openURL(`${origin.replace(/\/$/, "")}/privacy`);
  };

  const openSupportEmail = () => {
    Linking.openURL("mailto:kyarafit@kyarafit.com?subject=Kyarafit%20privacy%20request");
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This permanently removes your Kyarafit account, cloud-synced builds, convention plans, and uploaded images.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Final confirmation",
              "Deleting your account also clears this device's cached signed-in data. Local-only guest data created while signed out is not part of your cloud account.",
              [
                { text: "Keep account", style: "cancel" },
                {
                  text: "Delete permanently",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      const result = await deleteAccount();
                      if (result?.error) {
                        throw new Error(
                          result.error.message ??
                            "We couldn't delete your account right now. Please try again."
                        );
                      }
                      await clearSignedInAccountData();
                      router.replace("/auth");
                    } catch (error) {
                      Alert.alert(
                        "Delete failed",
                        error instanceof Error
                          ? error.message
                          : "We couldn't delete your account right now. Please try again."
                      );
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  if (sessionLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!user || !userId) {
    return (
      <View className="flex-1 bg-white px-8 pt-16">
        <Pressable onPress={() => router.back()} className="mb-6">
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text className="text-sm text-black/50">Not signed in.</Text>
        <Pressable
          className="mt-4 border border-black py-3 items-center"
          onPress={() => router.push("/auth")}
        >
          <Text className="text-[11px] uppercase tracking-[0.2em] font-semibold text-black">
            Sign in
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>
        <View className="flex-row justify-between items-end px-8 pt-16 pb-6">
          <View>
            <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/40 mb-2">
              Settings
            </Text>
            <Text className="font-serif text-3xl text-black tracking-tight">Account Details</Text>
          </View>
          <Pressable onPress={() => router.back()} className="mb-2">
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
        </View>

        <View className="px-8 gap-6">
          <View className="border-b border-black/5 pb-4">
            <Text className="text-[11px] uppercase tracking-widest text-black/45 mb-2">
              Profile picture
            </Text>
            <View className="flex-row items-center gap-4">
              <View className="w-16 h-16 rounded-full overflow-hidden border border-black/10 bg-[#F5F5F5]">
                {convexUser?.imageStorageId ? (
                  <StorageImage
                    imageStorageId={convexUser.imageStorageId}
                    imageUrl={convexUser.image}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : user.image ? (
                  <Image
                    source={{ uri: user.image }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Ionicons name="person" size={28} color="#999" />
                  </View>
                )}
              </View>
              <Pressable onPress={pickProfileImage} disabled={uploading}>
                <Text className="text-[11px] uppercase tracking-widest text-black underline">
                  {uploading ? "Uploading…" : "Change picture"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View className="border-b border-black/5 pb-4">
            <Text className="text-[11px] uppercase tracking-widest text-black/45 mb-1">Email</Text>
            <Text className="text-sm text-black">{user.email ?? "—"}</Text>
          </View>

          <View className="border-b border-black/5 pb-4">
            <Text className="text-[11px] uppercase tracking-widest text-black/45 mb-1">
              Display name
            </Text>
            {displayNameEdit === null ? (
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm flex-1">{user.name ?? "—"}</Text>
                <Pressable onPress={() => setDisplayNameEdit(user.name ?? "")}>
                  <Text className="text-[11px] uppercase tracking-widest text-black underline">
                    Edit
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="gap-2">
                <TextInput
                  className="border-b border-black/10 py-2 text-sm text-black"
                  value={displayNameEdit}
                  onChangeText={setDisplayNameEdit}
                  placeholder="Display name"
                  editable={!displayNameLoading}
                />
                <View className="flex-row gap-3">
                  <Pressable onPress={saveDisplayName} disabled={displayNameLoading}>
                    <Text className="text-[11px] uppercase text-black underline">Save</Text>
                  </Pressable>
                  <Pressable onPress={() => setDisplayNameEdit(null)}>
                    <Text className="text-[11px] uppercase text-black/50">Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          <View className="border-b border-black/5 pb-4">
            <Text className="text-[11px] uppercase tracking-widest text-black/45 mb-1">
              Username
            </Text>
            {usernameEdit === null ? (
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm flex-1">
                  {displayUsername ? `@${displayUsername}` : "—"}
                </Text>
                <Pressable onPress={() => setUsernameEdit(convexUser?.username ?? "")}>
                  <Text className="text-[11px] uppercase tracking-widest text-black underline">
                    Edit
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="gap-2">
                <TextInput
                  className="border-b border-black/10 py-2 text-sm text-black"
                  value={usernameEdit}
                  onChangeText={(t) => {
                    setUsernameEdit(t.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                    setUsernameError(null);
                  }}
                  placeholder="username"
                  autoCapitalize="none"
                  editable={!usernameLoading}
                />
                {usernameError ? (
                  <Text className="text-xs text-red-600">{usernameError}</Text>
                ) : null}
                <View className="flex-row gap-3">
                  <Pressable onPress={saveUsername} disabled={usernameLoading}>
                    <Text className="text-[11px] uppercase text-black underline">Save</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setUsernameEdit(null);
                      setUsernameError(null);
                    }}
                  >
                    <Text className="text-[11px] uppercase text-black/50">Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          <View className="border-b border-black/5 pb-4">
            <Text className="text-[11px] uppercase tracking-widest text-black/45 mb-1">Bio</Text>
            {bioEdit === null ? (
              <View className="flex-row items-start justify-between gap-2">
                <Text className="text-sm text-black/70 flex-1">{convexUser?.bio ?? "—"}</Text>
                <Pressable onPress={() => setBioEdit(convexUser?.bio ?? "")}>
                  <Text className="text-[11px] uppercase tracking-widest text-black underline">
                    Edit
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="gap-2">
                <TextInput
                  className="border border-black/10 rounded-md p-3 text-sm text-black min-h-[88px]"
                  value={bioEdit}
                  onChangeText={setBioEdit}
                  multiline
                  textAlignVertical="top"
                  editable={!bioLoading}
                />
                <View className="flex-row gap-3">
                  <Pressable onPress={saveBio} disabled={bioLoading}>
                    <Text className="text-[11px] uppercase text-black underline">Save</Text>
                  </Pressable>
                  <Pressable onPress={() => setBioEdit(null)}>
                    <Text className="text-[11px] uppercase text-black/50">Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          <View className="border-b border-black/5 pb-4">
            <Text className="text-[11px] uppercase tracking-widest text-black/45 mb-1">
              Public profile
            </Text>
            {visEdit === null ? (
              <View className="flex-row items-center flex-wrap gap-2">
                <Text className="text-sm">
                  {convexUser?.profileVisibility === "public" ? "Public" : "Private"}
                </Text>
                <Pressable
                  onPress={() =>
                    setVisEdit(convexUser?.profileVisibility === "public" ? "public" : "private")
                  }
                >
                  <Text className="text-[11px] uppercase tracking-widest text-black underline">
                    Change
                  </Text>
                </Pressable>
                {convexUser?.profileVisibility === "public" && convexUser?.username ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/user/[username]",
                        params: { username: convexUser.username! },
                      } as unknown as Parameters<typeof router.push>[0])
                    }
                  >
                    <Text className="text-[11px] uppercase tracking-widest text-black underline">
                      View profile
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                <Pressable
                  className="px-4 py-2 border border-black/10 rounded-full"
                  onPress={async () => {
                    try {
                      await updateProfile({ profileVisibility: "public" });
                      setVisEdit(null);
                    } catch (e) {
                      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  <Text className="text-[10px] uppercase font-bold">Public</Text>
                </Pressable>
                <Pressable
                  className="px-4 py-2 border border-black/10 rounded-full"
                  onPress={async () => {
                    try {
                      await updateProfile({ profileVisibility: "private" });
                      setVisEdit(null);
                    } catch (e) {
                      Alert.alert("Error", e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  <Text className="text-[10px] uppercase font-bold">Private</Text>
                </Pressable>
                <Pressable onPress={() => setVisEdit(null)}>
                  <Text className="text-[11px] uppercase text-black/50">Cancel</Text>
                </Pressable>
              </View>
            )}
            <Text className="text-[11px] text-black/40 mt-2">
              Public: others can see your profile and public builds.
            </Text>
          </View>

          <Pressable onPress={openPasswordReset}>
            <Text className="text-[11px] uppercase tracking-widest text-black underline">
              Change password
            </Text>
          </Pressable>
          <Text className="text-[11px] text-black/45 -mt-4 mb-4">
            Opens the web app to send a reset link to your email.
          </Text>

          <View className="border-t border-black/5 pt-4 mb-10">
            <Text className="text-[11px] uppercase tracking-widest text-black/45 mb-2">
              Data & privacy
            </Text>
            <Text className="text-[11px] text-black/60 leading-5">
              When you sign in, Kyarafit stores your profile, cosplay builds, uploaded images, and
              convention plans in the cloud. This device also keeps signed-in cache data locally so
              you can keep working smoothly.
            </Text>
            <View className="mt-4 gap-3">
              <Pressable onPress={openPrivacyPolicy}>
                <Text className="text-[11px] uppercase tracking-widest text-black underline">
                  Privacy policy
                </Text>
              </Pressable>
              <Pressable onPress={openSupportEmail}>
                <Text className="text-[11px] uppercase tracking-widest text-black underline">
                  Security & support
                </Text>
              </Pressable>
              <Pressable onPress={confirmDeleteAccount}>
                <Text className="text-[11px] uppercase tracking-widest text-red-600 underline">
                  Delete account
                </Text>
              </Pressable>
            </View>
            <Text className="text-[11px] text-black/45 mt-3 leading-5">
              Deleting your account permanently removes cloud-synced content and clears this
              device&apos;s signed-in cache. Local-only guest data created while signed out is
              managed separately from your cloud account.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
