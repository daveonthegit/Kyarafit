import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsAccountPage from "./page";

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
  },
}));

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { authClient } from "@/lib/auth/auth-client";

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

  it("shows email and name when user is signed in", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: {
        user: {
          id: "u1",
          email: "user@example.com",
          name: "Test User",
          image: null,
        },
      },
      isPending: false,
    } as ReturnType<typeof authClient.useSession>);
    render(<SettingsAccountPage />);
    expect(screen.getByTestId("account-email")).toHaveTextContent("user@example.com");
    expect(screen.getByTestId("account-name")).toHaveTextContent("Test User");
  });

  it("renders change password link", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { id: "u1", email: "a@b.com", name: "A", image: null } },
      isPending: false,
    } as ReturnType<typeof authClient.useSession>);
    render(<SettingsAccountPage />);
    const link = screen.getByRole("link", { name: /change password/i });
    expect(link).toHaveAttribute("href", "/auth/reset-password");
  });
});
