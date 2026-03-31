"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { WebAppShell } from "@/components/layout/WebAppShell";

function LegacyBuildDetailRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  useEffect(() => {
    if (id) {
      router.replace(`/build-detail/${id}`);
    }
  }, [id, router]);

  if (id) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Redirecting…</p>
      </WebAppShell>
    );
  }

  return (
    <WebAppShell>
      <p className="meta-label pt-12">Missing build id.</p>
      <Link href="/builds" className="mt-4 text-sm underline">
        Back to Builds
      </Link>
    </WebAppShell>
  );
}

export default function BuildDetailLegacyPage() {
  return (
    <Suspense
      fallback={
        <WebAppShell>
          <p className="meta-label pt-12">Loading…</p>
        </WebAppShell>
      }
    >
      <LegacyBuildDetailRedirect />
    </Suspense>
  );
}
