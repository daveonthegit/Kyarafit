import { ActivityIndicator, Image, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

type Props = {
  storageId: Id<"_storage"> | null | undefined;
  /** When set, skips storage lookup */
  imageUrl?: string | null;
  className?: string;
  accessibilityLabel?: string;
};

/** Resolves Convex `imageStorageId` to a signed URL on the client. */
export function ConvexStorageImage({ storageId, imageUrl, className, accessibilityLabel }: Props) {
  const fromStorage = useQuery(api.files.getUrl, !imageUrl && storageId ? { storageId } : "skip");

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        className={className}
        accessibilityLabel={accessibilityLabel}
        resizeMode="cover"
      />
    );
  }

  if (!storageId) {
    return <View className={`bg-kyar-muted dark:bg-kyar-dark-muted ${className ?? ""}`} />;
  }

  if (fromStorage === undefined) {
    return (
      <View
        className={`items-center justify-center bg-kyar-muted dark:bg-kyar-dark-muted ${className ?? ""}`}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (!fromStorage) {
    return <View className={`bg-kyar-muted dark:bg-kyar-dark-muted ${className ?? ""}`} />;
  }

  return (
    <Image
      source={{ uri: fromStorage }}
      className={className}
      accessibilityLabel={accessibilityLabel}
      resizeMode="cover"
    />
  );
}
