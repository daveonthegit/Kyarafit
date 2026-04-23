import { Text, View } from "react-native";
import type { Id } from "convex/_generated/dataModel";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";

type Props = {
  imageStorageId?: Id<"_storage"> | null;
  imageUrl?: string | null;
  label: string;
  size?: number;
};

export function ProfileAvatar({ imageStorageId, imageUrl, label, size = 88 }: Props) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="overflow-hidden border border-kyar-borderSubtle bg-kyar-muted dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-muted"
    >
      {imageStorageId || imageUrl ? (
        <ConvexStorageImage
          storageId={imageStorageId}
          imageUrl={imageUrl}
          className="h-full w-full"
        />
      ) : (
        <View className="h-full items-center justify-center">
          <Text className="text-xl font-semibold text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {initials || "?"}
          </Text>
        </View>
      )}
    </View>
  );
}
