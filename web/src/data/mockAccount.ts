/**
 * Fictional demo account for marketing only (landing page, Remotion hero, static previews).
 * Not loaded from Convex and not tied to any real user.
 *
 * Static assets live under `public/mock/` in subfolders:
 * - `mock/builds/` — build cover images
 * - `mock/elements/` — cosplay element / “closet” piece photos (elements are your wardrobe in-app)
 * - `mock/convention/` — convention hero / key art (see `ecaf-hero.jpg`)
 */
import { mockAssetUrl } from "@/lib/mockAssetUrl";

export type MockBuild = {
  id: string;
  name: string;
  character?: string;
  status: string;
  progress: number;
  imageSrc: string;
  projectIndex: number;
};

export type MockElementNode = {
  id: string;
  name: string;
  category: string;
  nodeType: "element" | "material";
  statusLabel: string;
  progressPercent: number;
  childCount: number;
  imageSrc: string;
  /** Path under `public/` for Remotion `staticFile()` */
  remotionPublicPath: string;
};

export type MockBuildTask = {
  label: string;
  checked: boolean;
  meta?: string;
};

export type MockConventionDay = {
  /** e.g. Fri */
  dayLabel: string;
  /** Short date for UI */
  dateLabel: string;
  /** Which mock build is worn this day (from `builds`) */
  buildId: string;
};

export type MockConvention = {
  title: string;
  subtitle: string;
  location?: string;
  /** Hero image path under `public/` */
  heroImageSrc: string;
  startDateLabel: string;
  endDateLabel: string;
  /** Three-day lineup using mock builds */
  days: MockConventionDay[];
  packingItems: string[];
  packingPreviewRows: { label: string; done: boolean }[];
};

export const MOCK_ACCOUNT = {
  profile: {
    displayName: "Riley Chen",
    tagline: "Demo portfolio — marketing preview only",
  },

  /** Cosplay elements = in-app “closet” pieces (same graph as /elements). */
  elements: [
    {
      id: "el-1",
      name: "Zhongli spear",
      category: "prop",
      nodeType: "element" as const,
      statusLabel: "Complete",
      progressPercent: 100,
      childCount: 1,
      imageSrc: mockAssetUrl("mock", "elements", "Zhongli Spear.jpg"),
      remotionPublicPath: "mock/elements/Zhongli Spear.jpg",
    },
    {
      id: "el-2",
      name: "Maka scythe",
      category: "prop",
      nodeType: "element" as const,
      statusLabel: "WIP",
      progressPercent: 65,
      childCount: 0,
      imageSrc: mockAssetUrl("mock", "elements", "Maka Scythe.jpg"),
      remotionPublicPath: "mock/elements/Maka Scythe.jpg",
    },
    {
      id: "el-3",
      name: "Heels",
      category: "footwear",
      nodeType: "element" as const,
      statusLabel: "Complete",
      progressPercent: 100,
      childCount: 0,
      imageSrc: mockAssetUrl("mock", "elements", "Heels.jpg"),
      remotionPublicPath: "mock/elements/Heels.jpg",
    },
    {
      id: "el-4",
      name: "Blue contacts",
      category: "accessory",
      nodeType: "material" as const,
      statusLabel: "Complete",
      progressPercent: 100,
      childCount: 0,
      imageSrc: mockAssetUrl("mock", "elements", "Blue Contacts.jpg"),
      remotionPublicPath: "mock/elements/Blue Contacts.jpg",
    },
    {
      id: "el-5",
      name: "Red scarf",
      category: "accessory",
      nodeType: "element" as const,
      statusLabel: "Incomplete",
      progressPercent: 20,
      childCount: 0,
      imageSrc: mockAssetUrl("mock", "elements", "red_scarf.png"),
      remotionPublicPath: "mock/elements/red_scarf.png",
    },
    {
      id: "el-6",
      name: "Blonde wig",
      category: "wig",
      nodeType: "element" as const,
      statusLabel: "Complete",
      progressPercent: 100,
      childCount: 2,
      imageSrc: mockAssetUrl("mock", "elements", "blonde_wig.jpg"),
      remotionPublicPath: "mock/elements/blonde_wig.jpg",
    },
  ] satisfies MockElementNode[],

  builds: [
    {
      id: "b-1",
      name: "Fubuki",
      character: "One-Punch Man",
      status: "wip",
      progress: 72,
      imageSrc: mockAssetUrl("mock", "builds", "Fubuki.jpg"),
      projectIndex: 1,
    },
    {
      id: "b-2",
      name: "Gwen",
      character: "League of Legends",
      status: "ready",
      progress: 100,
      imageSrc: mockAssetUrl("mock", "builds", "Gwen.jpg"),
      projectIndex: 2,
    },
    {
      id: "b-3",
      name: "Hu Tao",
      character: "Genshin Impact",
      status: "wip",
      progress: 35,
      imageSrc: mockAssetUrl("mock", "builds", "Hutao.jpg"),
      projectIndex: 3,
    },
    {
      id: "b-4",
      name: "Sunday",
      character: "Honkai: Star Rail",
      status: "idea",
      progress: 0,
      imageSrc: mockAssetUrl("mock", "builds", "Sunday.jpg"),
      projectIndex: 4,
    },
  ] satisfies MockBuild[],

  buildTasks: [
    {
      label: "Pattern corset panels",
      checked: true,
      meta: "→ hero wig",
    },
    { label: "Prime and seal base coat", checked: true },
    { label: "Add edge highlights", checked: false },
    { label: "Install fasteners", checked: false },
  ] satisfies MockBuildTask[],

  convention: {
    title: "East Coast Anime Fest",
    subtitle: "ECAF 2026",
    location: "New York, NY",
    heroImageSrc: mockAssetUrl("mock", "convention", "ecaf-hero.jpg"),
    startDateLabel: "Nov 7",
    endDateLabel: "Nov 9",
    days: [
      { dayLabel: "Fri", dateLabel: "Nov 7", buildId: "b-1" },
      { dayLabel: "Sat", dateLabel: "Nov 9", buildId: "b-2" },
      { dayLabel: "Sun", dateLabel: "Nov 10", buildId: "b-3" },
    ],
    packingItems: ["Gauntlets", "Cooling underlayer", "Boots", "Repair kit", "Badge"],
    packingPreviewRows: [
      { label: "Gauntlets", done: true },
      { label: "Cooling underlayer", done: false },
      { label: "Boots", done: false },
    ],
  } satisfies MockConvention,
} as const;

export function mockBuildById(id: string): MockBuild | undefined {
  return MOCK_ACCOUNT.builds.find((b) => b.id === id);
}

/** Task progress as 0–100 for donuts / bars (derived from checked/total). */
export function mockBuildTaskProgressPercent(tasks: readonly MockBuildTask[]): number {
  const total = tasks.length;
  if (total === 0) return 0;
  const done = tasks.filter((t) => t.checked).length;
  return Math.round((done / total) * 100);
}

export const LANDING_BUILDS: MockBuild[] = [...MOCK_ACCOUNT.builds];

export const LANDING_NODES: MockElementNode[] = [...MOCK_ACCOUNT.elements];

export const LANDING_BUILD_TASKS: MockBuildTask[] = [...MOCK_ACCOUNT.buildTasks];
