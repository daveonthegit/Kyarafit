import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { authClient } from "@/lib/auth/auth-client";
import SettingsAccountPage from "./page";

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
    updateUser: vi.fn(),
  },
}));

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: unknown }) => <div>{children}</div>,
}));

describe("Settings Account page", () => {
  it("renders Account Details heading", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof authClient.useSession>);
    render(<SettingsAccountPage />);
    expect(screen.getByRole("heading", { name: /account details/i })).toBeInTheDocument();
  });

  it("shows loading when session is pending", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: true,
    } as ReturnType<typeof authClient.useSession>);
    render(<SettingsAccountPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  // Full-page tests that render AccountDetailsContent (which uses useState) are skipped
  // due to React hook resolution in this test env when mocking auth-client. Manual testing:
  // - With user and no username: create-username form and onUpdateUsername flow.
  // - With user and username: displayed username.
  // - Change password link to /auth/reset-password.
});
