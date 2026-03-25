import { Image, View, type ImageProps } from "react-native";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { KyarIcon } from "./KyarIcon";
import { colors } from "@kyarafit/design-system/rn";

export type StorageImageProps = Omit<ImageProps, "source"> & {
  imageStorageId?: Id<"_storage"> | null;
  imageUrl?: string | null;
};

/**
 * Resolves Convex storage to a public URL, or uses `imageUrl` when present.
 */
export function StorageImage({ imageStorageId, imageUrl, style, ...rest }: StorageImageProps) {
  const fromStorage = useQuery(
    api.files.getUrl,
    imageStorageId ? { storageId: imageStorageId } : "skip"
  );
  const uri = imageUrl ?? fromStorage ?? undefined;
  if (!uri) {
    return (
      <View
        style={[
          { backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
          style,
        ]}
      >
        <KyarIcon name="image" size={28} color={colors.textTertiary} />
      </View>
    );
  }
  return <Image source={{ uri }} style={style} {...rest} />;
}
