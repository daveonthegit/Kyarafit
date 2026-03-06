"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Packing lives under Events (conventions). Redirect so existing links work.
 */
export default function PackingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/conventions");
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <p className="text-sm text-kyar-textTertiary">Redirecting…</p>
    </div>
  );
}
