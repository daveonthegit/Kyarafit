import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import { convertKyarafitToCosapp } from "@kyarafit/design-system/domain/cosappExport";
import { rememberLocalAccount } from "@/lib/auth/localAccount";
import { decodeBackup } from "@/test/cosappBackupParser";
import { CosappExportSection } from "./CosappExportSection";
import enMessages from "../../../messages/en.json";
import esMessages from "../../../messages/es.json";

// Spec: Settings → Backup & data → "Download for Cosapp.si" builds a Cosapp.si backup from the
// account's server copy and then says what came over and what was left out.

const client = {
  action:
    vi.fn<(ref: FunctionReference<"action">, args: Record<string, unknown>) => Promise<unknown>>(),
};
const user = { userId: "user-1", isLoading: false, isAuthenticated: true };
let locale: "en" | "es" = "en";

vi.mock("convex/react", () => ({ useConvex: () => client }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => user }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    key === "description"
      ? (locale === "en" ? enMessages : esMessages).CosappExport.description
      : key === "dropped.nonOwnedBuildTasks"
        ? (locale === "en" ? enMessages : esMessages).CosappExport.dropped.nonOwnedBuildTasks
        : values
          ? `${key} ${JSON.stringify(values)}`
          : key,
}));

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function serve() {
  const result = convertKyarafitToCosapp(
    {
      accountId: "user-1",
      builds: [
        { _id: "b1", _creationTime: 1, name: "Frieren", status: "wip", imageStorageId: "s1" },
      ],
      cosplayNodes: [],
      workflowItems: [
        {
          _id: "w1",
          _creationTime: 2,
          title: "Buy wig",
          status: "not_started",
          sortOrder: 0,
          sourceKind: "automation",
        },
      ],
      workflowAttachments: [],
      conventions: [],
      conventionDayPlans: [],
      packingListItems: [],
      buildReferenceImages: [],
      buildProcessPictures: [],
      buildProgressUpdates: [],
      storedFiles: [{ storageId: "s1", size: JPEG.length, contentType: "image/jpeg" }],
    },
    { now: Date.UTC(2026, 10, 3) }
  );
  client.action.mockImplementation(async (ref, args) => {
    if (getFunctionName(ref) === "cosappExport:prepare") return result;
    expect(getFunctionName(ref)).toBe("cosappExport:photoBytes");
    return (args.storageIds as string[]).map((storageId) => ({
      storageId,
      bytes: JPEG.slice().buffer,
    }));
  });
}

function captureDownloads() {
  const blobs: Blob[] = [];
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:mock";
    }),
    revokeObjectURL: vi.fn(),
  });
  const names: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    names.push(this.download);
  });
  return { blobs, names };
}

describe("CosappExportSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    user.isAuthenticated = true;
    locale = "en";
    rememberLocalAccount("user-1");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    [
      "en",
      "Import this once into a fresh Cosapp.si; importing a newer export again merges by newest edit and may not reflect deletions made in Kyarafit.",
    ],
    [
      "es",
      "Importa este archivo una sola vez en Cosapp.si sin datos previos; volver a importar una exportación más reciente combina los datos según la edición más reciente y puede no reflejar las eliminaciones hechas en Kyarafit.",
    ],
  ] as const)("shows the one-time migration warning before download in %s", (language, notice) => {
    locale = language;
    render(<CosappExportSection />);
    expect(screen.getByText((content) => content.includes(notice))).toBeVisible();
  });

  it.each(["en", "es"] as const)(
    "downloads a Cosapp.si backup and shows the receipt in %s",
    async (language) => {
      locale = language;
      serve();
      const { blobs, names } = captureDownloads();
      render(<CosappExportSection />);
      fireEvent.click(screen.getByRole("button", { name: "button" }));

      await waitFor(() => expect(names).toHaveLength(1));
      expect(names[0]).toMatch(/^kyarafit-for-cosapp-\d{4}-\d{2}-\d{2}\.cosapp$/);
      const archive = decodeBackup(new Uint8Array(await blobs[0].arrayBuffer()));
      expect(
        archive.data.rows.builds.map((b) => (b as unknown as { character: string }).character)
      ).toEqual(["Frieren"]);
      expect(archive.photos.size).toBe(1);

      expect(screen.getByTestId("cosapp-receipt-counts")).toHaveTextContent(
        'counts.builds {"count":1}'
      );
      expect(screen.getByTestId("cosapp-receipt-dropped")).toHaveTextContent(
        'dropped.generatedTask {"count":1}'
      );
      expect(screen.getByTestId("cosapp-receipt-dropped")).toHaveTextContent("dropped.socialData");
      expect(screen.getByTestId("cosapp-receipt-dropped")).toHaveTextContent(
        language === "en"
          ? "Tasks attached to builds you do not own are not exported."
          : "No se exportan las tareas asociadas a builds que no te pertenecen."
      );
    }
  );

  it("says so and downloads nothing when the export fails", async () => {
    client.action.mockRejectedValue(new Error("offline"));
    const { blobs } = captureDownloads();
    render(<CosappExportSection />);
    fireEvent.click(screen.getByRole("button", { name: "button" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("failed");
    expect(blobs).toHaveLength(0);
  });

  it("is unavailable without a signed-in account", () => {
    user.isAuthenticated = false;
    render(<CosappExportSection />);
    expect(screen.getByRole("button", { name: "button" })).toBeDisabled();
    expect(screen.getByText("needsConnection")).toBeInTheDocument();
  });
});
