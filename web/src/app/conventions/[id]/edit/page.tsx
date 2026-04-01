"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { WebAppShell } from "@/components/layout/WebAppShell";
import type { Id } from "convex/_generated/dataModel";

/** Legacy URL: editing now lives on the convention detail page. */
export default function EditConventionRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<"conventions">;

  useEffect(() => {
    router.replace(`/conventions/${id}?edit=1`);
  }, [id, router]);

  return (
    <WebAppShell>
      <p className="meta-label pt-12">Loading...</p>
    </WebAppShell>
  );
}
