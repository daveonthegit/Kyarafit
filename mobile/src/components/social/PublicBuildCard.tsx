import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { MetaLabel, SurfaceCard } from "@/ui";

type Props = {
  build: {
    _id: Id<"builds">;
    name: string;
    character?: string | null;
    imageStorageId?: Id<"_storage"> | null;
    imageUrl?: string | null;
    ownerUsername?: string | null;
    ownerName?: string | null;
    tasksChecked?: number;
    tasksTotal?: number;
  };
  onPress: () => void;
  onPressOwner?: () => void;
  currentUserId?: string | null;
};

export function PublicBuildCard({ build, onPress, onPressOwner, currentUserId }: Props) {
  const { t } = useTranslation();
  const likeCount = useQuery(api.buildLikes.countByBuild, { buildId: build._id });
  const comments = useQuery(api.buildComments.listByBuild, { buildId: build._id }) ?? [];
  const isLiked = useQuery(
    api.buildLikes.isLikedBy,
    currentUserId ? { userId: currentUserId, buildId: build._id } : "skip"
  );
  const likeBuild = useMutation(api.buildLikes.like);
  const unlikeBuild = useMutation(api.buildLikes.unlike);
  const addComment = useMutation(api.buildComments.add);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentPending, setCommentPending] = useState(false);
  const ownerLabel = build.ownerUsername ? `@${build.ownerUsername}` : (build.ownerName ?? null);

  const handleToggleLike = async () => {
    if (!currentUserId) return;
    if (isLiked) {
      await unlikeBuild({ userId: currentUserId, buildId: build._id });
      return;
    }
    await likeBuild({ userId: currentUserId, buildId: build._id });
  };

  const handleAddComment = async () => {
    const body = commentBody.trim();
    if (!currentUserId || !body || commentPending) return;
    setCommentPending(true);
    try {
      await addComment({ userId: currentUserId, buildId: build._id, body });
      setCommentBody("");
    } finally {
      setCommentPending(false);
    }
  };

  return (
    <>
      <Pressable onPress={onPress} className="active:opacity-90">
        <SurfaceCard className="overflow-hidden">
          <View className="aspect-[4/3] w-full bg-kyar-muted dark:bg-kyar-dark-muted">
            {build.imageStorageId || build.imageUrl ? (
              <ConvexStorageImage
                storageId={build.imageStorageId}
                imageUrl={build.imageUrl}
                className="h-full w-full"
              />
            ) : (
              <View className="h-full items-center justify-center">
                <Text className="text-4xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  ◇
                </Text>
              </View>
            )}
          </View>

          <View className="gap-2 px-4 py-4">
            {build.character ? <MetaLabel>{build.character}</MetaLabel> : null}
            <Text
              style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
              className="text-[30px] italic leading-[32px] text-kyar-text dark:text-kyar-dark-text"
              numberOfLines={2}
            >
              {build.name}
            </Text>

            {typeof build.tasksTotal === "number" && build.tasksTotal > 0 ? (
              <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {build.tasksChecked ?? 0} / {build.tasksTotal} tasks
              </Text>
            ) : null}

            {ownerLabel ? (
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  onPressOwner?.();
                }}
                disabled={!onPressOwner}
                className="self-start"
              >
                <Text className="text-xs uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
                  {ownerLabel}
                </Text>
              </Pressable>
            ) : null}

            <View className="mt-2 flex-row items-center gap-3 border-t border-kyar-borderSubtle pt-3 dark:border-kyar-dark-borderSubtle">
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  void handleToggleLike();
                }}
                disabled={!currentUserId}
                className="flex-row items-center gap-2 rounded-full border border-kyar-borderSubtle px-3 py-2 active:opacity-80 disabled:opacity-50 dark:border-kyar-dark-borderSubtle"
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={16}
                  color={isLiked ? "#c35563" : "#6d675f"}
                />
                <Text className="text-xs font-semibold uppercase tracking-wide text-kyar-text dark:text-kyar-dark-text">
                  {likeCount ?? 0}
                </Text>
              </Pressable>

              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  setCommentsOpen(true);
                }}
                className="flex-row items-center gap-2 rounded-full border border-kyar-borderSubtle px-3 py-2 active:opacity-80 dark:border-kyar-dark-borderSubtle"
              >
                <Ionicons name="chatbubble-outline" size={16} color="#6d675f" />
                <Text className="text-xs font-semibold uppercase tracking-wide text-kyar-text dark:text-kyar-dark-text">
                  {comments.length}
                </Text>
              </Pressable>
            </View>
          </View>
        </SurfaceCard>
      </Pressable>

      <Modal
        visible={commentsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentsOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setCommentsOpen(false)}
        >
          <Pressable
            className="max-h-[82%] rounded-t-3xl border border-kyar-borderSubtle bg-kyar-surface px-5 pb-8 pt-5 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
              {t("social.commentsTitle")}
            </Text>
            <Text className="mt-2 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {build.name}
            </Text>

            <ScrollView className="mt-5 max-h-[45%]">
              {comments.length === 0 ? (
                <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("social.commentsEmpty")}
                </Text>
              ) : (
                <View className="gap-3">
                  {comments.map((comment) => (
                    <View
                      key={comment._id}
                      className="rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
                    >
                      <Text className="text-xs uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
                        {comment.authorUsername ? `@${comment.authorUsername}` : comment.authorName}
                      </Text>
                      <Text className="mt-2 text-sm leading-6 text-kyar-text dark:text-kyar-dark-text">
                        {comment.body}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {currentUserId ? (
              <>
                <TextInput
                  value={commentBody}
                  onChangeText={setCommentBody}
                  placeholder={t("social.commentPlaceholder")}
                  className="mt-5 min-h-[104px] rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
                  multiline
                  textAlignVertical="top"
                />
                <Pressable
                  onPress={() => void handleAddComment()}
                  disabled={!commentBody.trim() || commentPending}
                  className="mt-4 items-center rounded-full bg-kyar-text px-4 py-3 disabled:opacity-40 dark:bg-kyar-dark-text"
                >
                  <Text className="text-sm font-semibold text-kyar-bg dark:text-kyar-dark-bg">
                    {commentPending ? t("social.commentPosting") : t("social.commentAction")}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text className="mt-5 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("social.commentsSignIn")}
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
