import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConventionForm } from "./ConventionForm";

const h = vi.hoisted(() => ({ save: vi.fn(), submit: vi.fn(), alert: vi.fn() }));
vi.mock("react-native", async () => {
  const { createReactNativeMock } = await import("@/test-support/rnMock");
  return { ...(await createReactNativeMock()), Alert: { alert: h.alert } };
});
vi.mock("expo-router", () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/images/localImageStore", () => ({ useSaveLocalImage: () => h.save }));
vi.mock("expo-image-picker", () => ({
  MediaTypeOptions: { Images: "images" },
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: "file:///picked.jpg" }] }),
}));
vi.mock("@/components/ConvexStorageImage", () => ({ ConvexStorageImage: () => null }));
vi.mock("./GlassDateField", () => ({ GlassDateField: () => null }));
vi.mock("@/ui/glass", () => ({
  PhotoBackdrop: () => null,
  GlassPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  GlassTextField: ({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) =>
    <input aria-label={label} value={value} onChange={(event) => onChangeText(event.target.value)} />,
  PhotoPill: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) =>
    <button disabled={disabled} onClick={onPress}>{label}</button>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  h.save.mockResolvedValue({ uri: "file:///vault/photo" });
  h.submit.mockResolvedValue(undefined);
});
afterEach(cleanup);

it.each(["copy", "submit"])("reports %s failures and keeps the convention draft retryable", async (failure) => {
  if (failure === "copy") h.save.mockRejectedValueOnce(new Error("disk full"));
  else h.submit.mockRejectedValueOnce(new Error("disk full"));
  render(<ConventionForm title="Convention" eyebrow="Plan" subtitle="Details" submitLabel="Save" submittingLabel="Saving"
    initialValues={{ name: "Draft", startDate: "2026-11-01", endDate: "2026-11-02" }} onSubmit={h.submit} />);
  fireEvent.change(screen.getByLabelText("conventions.fieldName"), { target: { value: "Kept draft" } });
  fireEvent.click(screen.getAllByRole("button", { name: "conventions.chooseImageAction" })[0]);
  await waitFor(() => expect(screen.getByRole("button", { name: "conventions.removeImageAction" })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(h.alert).toHaveBeenCalledWith("common.errorTitle", "disk full"));
  if (failure === "copy") expect(h.submit).not.toHaveBeenCalled();
  expect((screen.getByLabelText("conventions.fieldName") as HTMLInputElement).value).toBe("Kept draft");
  expect(screen.getByRole("button", { name: "conventions.removeImageAction" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(h.submit).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Kept draft", imageUrl: "file:///vault/photo" })));
});
