import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { authClient } from "@/lib/auth/auth-client";
import SettingsAccountPage from "./page";

const mockAccountDetailsContent = vi.fn();
const mockReplace = vi.fn();

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: vi.fn(),
    updateUser: vi.fn(),
  },
  deleteAccount: vi.fn(),
}));

vi.mock("@/components/layout/WebAppShell", () => ({
  WebAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

vi.mock("./AccountDetailsContent", () => ({
  AccountDetailsContent: (props: unknown) => {
    mockAccountDetailsContent(props);
    return <div>Account content</div>;
  },
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

  it("passes delete-account handler to account details content", () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: {
        user: {
          id: "user_123",
          email: "test@example.com",
          name: "Test User",
        },
      },
      isPending: false,
    } as ReturnType<typeof authClient.useSession>);

    render(<SettingsAccountPage />);

    expect(screen.getByText("Account content")).toBeInTheDocument();
    expect(mockAccountDetailsContent).toHaveBeenCalledWith(
      expect.objectContaining({
        onDeleteAccount: expect.any(Function),
      })
    );
  });
});
