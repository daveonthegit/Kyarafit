"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/client";

const PUBLIC_PATHS = ["/", "/auth/signin", "/auth/signup"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!isPublic && !session) {
      router.replace("/auth/signin");
    }
  }, [session, loading, pathname, router]);

  return <>{children}</>;
}
