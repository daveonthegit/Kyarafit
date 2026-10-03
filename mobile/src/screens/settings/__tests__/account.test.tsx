import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createInstance } from "i18next";
import en from "@/i18n/locales/en.json";
import AccountScreen from "../../../../app/(app)/settings/account";

const h = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  generateUploadUrl: vi.fn(),
  updateProfileImage: vi.fn(),
  updateUser: vi.fn(),
  isUsernameAvailable: vi.fn(),
  listAccounts: vi.fn(),
  unlinkAccount: vi.fn(),
  getSession: vi.fn(),
  setPassword: vi.fn(),
  deleteAccount: vi.fn(),
  link: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn(),
  permission: vi.fn(),
  pick: vi.fn(),
  upload: vi.fn(),
  webPath: vi.fn(),
  openURL: vi.fn(),
  identity: { subject: "fixture-owner" } as { subject: string } | undefined,
  profile: {
    displayName: "Fixture Maker",
    username: "fixture_maker",
    bio: "Handmade costumes",
    profileVisibility: "private",
    image: null as string | null,
  },
  session: {
    user: { name: "Fixture Maker", username: "fixture_maker", email: "fixture@example.invalid" },
  },
  accounts: [{ id: "google-row", providerId: "google", accountId: "fixture-provider" }],
}));
const i18n = createInstance();
void i18n.init({ lng: "en", resources: { en: { translation: en } }, initAsync: false });
const translate = i18n.t.bind(i18n);
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock("react-native", async () =>
  (await import("@/test-support/rnMock")).createReactNativeMock()
);
vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ replace: h.replace, push: h.push }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => {},
}));
vi.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: h.permission,
  launchImageLibraryAsync: h.pick,
}));
vi.mock("expo-linking", () => ({ openURL: h.openURL }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: h.getItem, setItem: h.setItem },
}));
vi.mock("convex/_generated/api", () => ({
  api: {
    auth: { getCurrentUser: "identity" },
    users: {
      getByExternalId: "profile",
      updateProfile: "updateProfile",
      updateProfileImage: "updateProfileImage",
      checkUsernameAvailability: "availability",
    },
    files: { generateUploadUrl: "uploadUrl" },
  },
}));
vi.mock("convex/react", () => ({
  useQuery: (ref: string) =>
    ref === "identity"
      ? h.identity
      : ref === "profile"
        ? h.profile
        : { valid: true, available: true },
  useMutation: (ref: string) =>
    ref === "updateProfile"
      ? h.updateProfile
      : ref === "updateProfileImage"
        ? h.updateProfileImage
        : h.generateUploadUrl,
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: {
    updateUser: h.updateUser,
    isUsernameAvailable: h.isUsernameAvailable,
    listAccounts: h.listAccounts,
    unlinkAccount: h.unlinkAccount,
  },
  useSession: () => ({ session: h.session }),
  getSession: h.getSession,
  setCredentialPassword: h.setPassword,
  deleteAccount: h.deleteAccount,
}));
vi.mock("@/lib/auth/startSocialSignIn", () => ({ startSocialLink: h.link }));
vi.mock("@/lib/uploadConvexStorage", () => ({ uploadUriToConvexStorage: h.upload }));
vi.mock("@/lib/openWebAppPath", () => ({ openWebAppPath: h.webPath }));
vi.mock("@/components/ConvexStorageImage", () => ({
  ConvexStorageImage: () => <span>Fixture avatar</span>,
}));
vi.mock("@/ui", () => ({
  DataBoundary: ({
    status,
    loading,
    data,
    children,
  }: {
    status: string;
    loading: React.ReactNode;
    data: unknown;
    children: (data: unknown) => React.ReactNode;
  }) => (status === "loading" ? loading : children(data)),
}));

async function openAccount() {
  render(<AccountScreen />);
  await screen.findByText(en.settings.accountPage.savePassword);
}

describe("Glass account actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.identity = { subject: "fixture-owner" };
    h.profile.profileVisibility = "private";
    h.profile.image = null;
    h.accounts = [{ id: "google-row", providerId: "google", accountId: "fixture-provider" }];
    h.listAccounts.mockImplementation(async () => ({ data: h.accounts }));
    h.updateUser.mockResolvedValue({});
    h.updateProfile.mockResolvedValue(null);
    h.isUsernameAvailable.mockResolvedValue({ data: { available: true } });
    h.getSession.mockResolvedValue(null);
    h.setPassword.mockResolvedValue({});
    h.deleteAccount.mockResolvedValue({});
    h.unlinkAccount.mockResolvedValue({});
    h.getItem.mockResolvedValue(null);
    h.setItem.mockResolvedValue(null);
    h.permission.mockResolvedValue({ granted: true });
    h.pick.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///fixture.jpg", mimeType: "image/jpeg" }],
    });
    h.generateUploadUrl.mockResolvedValue("https://uploads.example.invalid/fixture");
    h.upload.mockResolvedValue("fixture-storage");
  });
  afterEach(cleanup);

  it("renders a loading boundary without exposing account actions", () => {
    h.identity = undefined;
    render(<AccountScreen />);
    expect(screen.queryByText(en.settings.accountPage.deleteAction)).toBeNull();
    expect(screen.getAllByLabelText(en.common.loading).length).toBeGreaterThan(0);
  });
  it("hides email until revealed, then persists hide/show", async () => {
    await openAccount();
    expect(screen.queryByText("fixture@example.invalid")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.settings.accountPage.show }));
    expect(screen.getByText("fixture@example.invalid")).toBeTruthy();
    expect(h.setItem).toHaveBeenCalledWith("kyar_account_email_visible", "true");
    fireEvent.click(screen.getByRole("button", { name: en.settings.accountPage.hide }));
    expect(screen.queryByText("fixture@example.invalid")).toBeNull();
  });
  it("saves the display name to auth and profile and refreshes the session", async () => {
    await openAccount();
    fireEvent.click(screen.getByRole("button", { name: "Edit display name" }));
    fireEvent.change(screen.getByLabelText(en.settings.displayName), {
      target: { value: "  New name  " },
    });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(h.updateProfile).toHaveBeenCalledWith({ displayName: "New name" }));
    expect(h.updateUser).toHaveBeenCalledWith({ name: "New name" });
    expect(h.getSession).toHaveBeenCalled();
  });
  it("retains the edited value and reports an auth save error", async () => {
    h.updateUser.mockResolvedValue({ error: { message: "Fixture save failed" } });
    await openAccount();
    fireEvent.click(screen.getByRole("button", { name: "Edit display name" }));
    fireEvent.change(screen.getByLabelText(en.settings.displayName), {
      target: { value: "Keep this" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await screen.findByText("Fixture save failed");
    expect((screen.getByLabelText(en.settings.displayName) as HTMLInputElement).value).toBe(
      "Keep this"
    );
    expect(h.updateProfile).not.toHaveBeenCalled();
  });
  it("checks username availability and normalizes the submitted username", async () => {
    await openAccount();
    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.change(screen.getByLabelText(en.settings.username), {
      target: { value: "New_Name!" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(h.updateProfile).toHaveBeenCalledWith({ username: "new_name" }));
    expect(h.isUsernameAvailable).toHaveBeenCalledWith({ username: "new_name" });
  });
  it("saves bio text through the existing profile mutation", async () => {
    await openAccount();
    fireEvent.click(screen.getByRole("button", { name: "Edit bio" }));
    fireEvent.change(screen.getByLabelText(en.settings.accountPage.sectionBio), {
      target: { value: "  New bio  " },
    });
    fireEvent.click(screen.getByRole("button", { name: en.common.save }));
    await waitFor(() => expect(h.updateProfile).toHaveBeenCalledWith({ bio: "New bio" }));
    expect(screen.queryByLabelText(en.settings.accountPage.sectionBio)).toBeNull();
  });

  it("does not upload when photo permission is denied or picking is cancelled", async () => {
    h.permission.mockResolvedValue({ granted: false });
    await openAccount();
    fireEvent.click(
      screen.getAllByRole("button", { name: en.settings.accountPage.changePicture })[0]
    );
    await waitFor(() => expect(h.permission).toHaveBeenCalledOnce());
    expect(h.pick).not.toHaveBeenCalled();
    h.permission.mockResolvedValue({ granted: true });
    h.pick.mockResolvedValue({ canceled: true, assets: [] });
    fireEvent.click(
      screen.getAllByRole("button", { name: en.settings.accountPage.changePicture })[0]
    );
    await waitFor(() => expect(h.pick).toHaveBeenCalledOnce());
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.updateProfileImage).not.toHaveBeenCalled();
  });

  it("keeps profile visibility segmented, saving through the existing mutation", async () => {
    await openAccount();
    fireEvent.click(screen.getByRole("button", { name: en.settings.accountPage.change }));
    expect(
      screen.getByRole("radio", { name: en.settings.profilePrivate }).getAttribute("aria-checked")
    ).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: en.settings.profilePublic }));
    await waitFor(() =>
      expect(h.updateProfile).toHaveBeenCalledWith({ profileVisibility: "public" })
    );
  });
  it("does not allow unlinking the last usable sign-in provider", async () => {
    await openAccount();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));
    expect(h.unlinkAccount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.settings.accountPage.linkApple }));
    await waitFor(() => expect(h.link).toHaveBeenCalledWith("apple"));
  });
  it("allows unlinking when another sign-in method exists", async () => {
    h.accounts.push({
      id: "credential-row",
      providerId: "credential",
      accountId: "fixture-credential",
    });
    render(<AccountScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect Google" }));
    await waitFor(() =>
      expect(h.unlinkAccount).toHaveBeenCalledWith({
        providerId: "google",
        accountId: "fixture-provider",
      })
    );
  });
  it("validates password length and confirmation before setting a password", async () => {
    await openAccount();
    const save = () =>
      fireEvent.click(screen.getByRole("button", { name: en.settings.accountPage.savePassword }));
    save();
    await screen.findByText(en.settings.accountPage.passwordMinError);
    expect(h.setPassword).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(en.settings.accountPage.newPasswordPlaceholder), {
      target: { value: "fixture-password" },
    });
    save();
    await screen.findByText(en.settings.accountPage.passwordMismatch);
    fireEvent.change(screen.getByLabelText(en.settings.accountPage.confirmPasswordPlaceholder), {
      target: { value: "fixture-password" },
    });
    save();
    await waitFor(() =>
      expect(h.setPassword).toHaveBeenCalledWith({ newPassword: "fixture-password" })
    );
  });
  it("keeps image picking, upload, and attachment parameters unchanged", async () => {
    await openAccount();
    fireEvent.click(
      screen.getAllByRole("button", { name: en.settings.accountPage.changePicture })[0]
    );
    await waitFor(() =>
      expect(h.updateProfileImage).toHaveBeenCalledWith({ storageId: "fixture-storage" })
    );
    expect(h.pick).toHaveBeenCalledWith({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    expect(h.upload).toHaveBeenCalledWith(
      "file:///fixture.jpg",
      "https://uploads.example.invalid/fixture",
      "image/jpeg"
    );
  });
  it("requires exact DELETE confirmation and cancellation clears the draft", async () => {
    await openAccount();
    const open = () =>
      fireEvent.click(screen.getByRole("button", { name: en.settings.accountPage.deleteAction }));
    open();
    fireEvent.click(screen.getByRole("button", { name: en.settings.accountPage.confirmDelete }));
    await screen.findByText(en.settings.accountPage.typeDeleteError);
    expect(h.deleteAccount).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(en.settings.accountPage.typeDeleteLabel), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }));
    open();
    expect(
      (screen.getByLabelText(en.settings.accountPage.typeDeleteLabel) as HTMLInputElement).value
    ).toBe("");
    fireEvent.change(screen.getByLabelText(en.settings.accountPage.typeDeleteLabel), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.settings.accountPage.confirmDelete }));
    await waitFor(() => expect(h.deleteAccount).toHaveBeenCalledOnce());
    expect(h.replace).toHaveBeenCalled();
  });
  it("reports deletion errors without navigating away", async () => {
    h.deleteAccount.mockResolvedValue({ error: { message: "Fixture deletion failed" } });
    await openAccount();
    fireEvent.click(screen.getByRole("button", { name: en.settings.accountPage.deleteAction }));
    fireEvent.change(screen.getByLabelText(en.settings.accountPage.typeDeleteLabel), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.settings.accountPage.confirmDelete }));
    await screen.findByText("Fixture deletion failed");
    expect(h.replace).not.toHaveBeenCalled();
  });
  it("keeps legal navigation wired to the web paths", async () => {
    await openAccount();
    fireEvent.click(screen.getByRole("button", { name: en.settings.accountPage.termsOfService }));
    fireEvent.click(screen.getByRole("button", { name: en.settings.accountPage.privacyPolicy }));
    expect(h.webPath.mock.calls.map(([path]) => path)).toEqual(["/terms", "/privacy"]);
  });
});
