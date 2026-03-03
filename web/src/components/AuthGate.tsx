"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { authClient } from "@/lib/auth/auth-client";

const PUBLIC_PATHS = ["/", "/auth/signin", "/auth/signup", "/auth/verify-email", "/auth/reset-password"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!isPublic && !session) {
      router.replace("/auth/signin");
    }
  }, [session, isPending, pathname, router]);

  return <>{children}</>;
}
