import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

type Props = { params: Promise<{ buildId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { buildId } = await params;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl || !buildId) {
    return { title: "Build | Kyarafit" };
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const bundle = await client.query(api.builds.getPublicViewerBundle, {
      buildId: buildId as Id<"builds">,
    });
    if (!bundle?.build) {
      return { title: "Build | Kyarafit" };
    }
    const b = bundle.build;
    const title = b.character ? `${b.name} · ${b.character}` : b.name;
    const description =
      b.notes && b.notes.length > 160 ? `${b.notes.slice(0, 157)}…` : (b.notes ?? undefined);
    const images: string[] = [];
    if (b.imageUrl) images.push(b.imageUrl);
    return {
      title: `${title} | Kyarafit`,
      description,
      openGraph: {
        title: `${title} | Kyarafit`,
        description,
        ...(images.length ? { images } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} | Kyarafit`,
        description,
        ...(images.length ? { images } : {}),
      },
    };
  } catch {
    return { title: "Build | Kyarafit" };
  }
}

export default function PublicBuildLayout({ children }: { children: React.ReactNode }) {
  return children;
}
