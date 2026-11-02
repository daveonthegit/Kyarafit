import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";

type Size = "tile" | "featured";

type Props = {
  buildId: Id<"builds">;
  buildName: string;
  currentUserId?: string | null;
  /**
   * "tile" = dense pills inside the PublicBuildCard photo tile;
   * "featured" = 44pt pills on the feed headline block (ref 12a).
   */
  size?: Size;
};

const SIZES: Record<Size, { minHeight: number; paddingHorizontal: number; icon: number }> = {
  tile: { minHeight: 34, paddingHorizontal: 12, icon: 13 },
  featured: { minHeight: 44, paddingHorizontal: 16, icon: 16 },
};

/**
 * Favorite + comment glass-outline pills with counts, plus the comments sheet.
 * Extracted from PublicBuildCard (Glass Studio 7.4) so the feed's featured
 * headline and the shared card run the exact same queries/mutations —
 * behaviorally identical to the pre-redesign card (like/unlike/add comment;
 * interactions are free for any signed-in user, REQ-018/080).
 */
export function BuildSocialActions({ buildId, buildName, currentUserId, size = "tile" }: Props) {
  const { t } = useTranslation();
  const likeCount = useQuery(api.buildLikes.countByBuild, { buildId });
  const comments = useQuery(api.buildComments.listByBuild, { buildId }) ?? [];
  const isLiked = useQuery(
    api.buildLikes.isLikedBy,
    currentUserId ? { userId: currentUserId, buildId } : "skip"
  );
  const likeBuild = useMutation(api.buildLikes.like);
  const unlikeBuild = useMutation(api.buildLikes.unlike);
  const addComment = useMutation(api.buildComments.add);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentPending, setCommentPending] = useState(false);

  const sizing = SIZES[size];
  const pillStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    minHeight: sizing.minHeight,
    paddingHorizontal: sizing.paddingHorizontal,
    borderRadius: 999,
    borderWidth: borderWidth.hairline,
    borderColor: glass.border.overlay,
    backgroundColor: glass.surface.bar,
  };
  const countStyle = {
    fontFamily: APP_FONT_FAMILIES.sansBold,
    fontSize: 10,
    letterSpacing: ls(0.14, 10),
    textTransform: "uppercase" as const,
    color: glass.text.fg,
  };

  const handleToggleLike = async () => {
    if (!currentUserId) return;
    if (isLiked) {
      await unlikeBuild({ userId: currentUserId, buildId });
      return;
    }
    await likeBuild({ userId: currentUserId, buildId });
  };

  const handleAddComment = async () => {
    const body = commentBody.trim();
    if (!currentUserId || !body || commentPending) return;
    setCommentPending(true);
    try {
      await addComment({ userId: currentUserId, buildId, body });
      setCommentBody("");
    } finally {
      setCommentPending(false);
    }
  };

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            void handleToggleLike();
          }}
          disabled={!currentUserId}
          accessibilityRole="button"
          accessibilityLabel={t("social.likeAction", { defaultValue: "Like" })}
          className="active:opacity-80"
          style={[pillStyle, !currentUserId ? { opacity: 0.5 } : null]}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={sizing.icon}
            color={isLiked ? glass.text.danger : glass.text.fg70}
          />
          <Text style={countStyle}>{likeCount ?? 0}</Text>
        </Pressable>

        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            setCommentsOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("social.commentsTitle")}
          className="active:opacity-80"
          style={pillStyle}
        >
          <Ionicons name="chatbubble-outline" size={sizing.icon} color={glass.text.fg70} />
          <Text style={countStyle}>{comments.length}</Text>
        </Pressable>
      </View>

      <Modal
        visible={commentsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentsOpen(false)}
      >
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: glass.scrimDim }}
          onPress={() => setCommentsOpen(false)}
        >
          <Pressable
            style={{
              maxHeight: "82%",
              borderTopLeftRadius: glass.radius.sheet,
              borderTopRightRadius: glass.radius.sheet,
              borderWidth: borderWidth.hairline,
              borderColor: glass.border.overlay,
              backgroundColor: glass.fallback.overlay,
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 32,
            }}
            onPress={(event) => event.stopPropagation()}
          >
            <Text
              style={{
                fontFamily: APP_FONT_FAMILIES.displayItalic,
                fontSize: 22,
                lineHeight: 25,
                color: glass.text.fg,
              }}
            >
              {t("social.commentsTitle")}
            </Text>
            <Text
              style={{
                marginTop: 6,
                fontFamily: APP_FONT_FAMILIES.sansRegular,
                fontSize: 12,
                lineHeight: 18,
                color: glass.text.fg70,
              }}
            >
              {buildName}
            </Text>

            <ScrollView style={{ marginTop: 18, maxHeight: "45%" }}>
              {comments.length === 0 ? (
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansRegular,
                    fontSize: 12,
                    lineHeight: 18,
                    color: glass.text.fg55,
                  }}
                >
                  {t("social.commentsEmpty")}
                </Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {comments.map((comment) => (
                    <View
                      key={comment._id}
                      style={{
                        borderRadius: 12,
                        borderWidth: borderWidth.hairline,
                        borderColor: glass.border.divider,
                        backgroundColor: glass.surface.field,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                          fontSize: 9,
                          letterSpacing: ls(0.14, 9),
                          textTransform: "uppercase",
                          color: glass.text.fg55,
                        }}
                      >
                        {comment.authorUsername ? `@${comment.authorUsername}` : comment.authorName}
                      </Text>
                      <Text
                        style={{
                          marginTop: 5,
                          fontFamily: APP_FONT_FAMILIES.sansRegular,
                          fontSize: 13,
                          lineHeight: 19,
                          color: glass.text.fg,
                        }}
                      >
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
                  placeholderTextColor={glass.text.fg45}
                  style={{
                    marginTop: 18,
                    minHeight: 104,
                    borderRadius: 12,
                    borderWidth: borderWidth.hairline,
                    borderColor: glass.border.default,
                    backgroundColor: glass.surface.field,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontFamily: APP_FONT_FAMILIES.sansRegular,
                    fontSize: 14,
                    color: glass.text.fg,
                  }}
                  multiline
                  textAlignVertical="top"
                />
                <Pressable
                  onPress={() => void handleAddComment()}
                  disabled={!commentBody.trim() || commentPending}
                  accessibilityRole="button"
                  className="active:opacity-80"
                  style={[
                    {
                      marginTop: 14,
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 999,
                      backgroundColor: glass.surface.solid,
                      paddingHorizontal: 22,
                    },
                    !commentBody.trim() || commentPending ? { opacity: 0.4 } : null,
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansBold,
                      fontSize: 10,
                      letterSpacing: ls(0.16, 10),
                      textTransform: "uppercase",
                      color: glass.text.ink,
                    }}
                  >
                    {commentPending ? t("social.commentPosting") : t("social.commentAction")}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text
                style={{
                  marginTop: 18,
                  fontFamily: APP_FONT_FAMILIES.sansRegular,
                  fontSize: 12,
                  lineHeight: 18,
                  color: glass.text.fg70,
                }}
              >
                {t("social.commentsSignIn")}
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
