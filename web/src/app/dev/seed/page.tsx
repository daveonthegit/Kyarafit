"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import Link from "next/link";
import { api } from "convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function DevSeedPage() {
  const { userId } = useCurrentUser();
  const createStarterSeed = useMutation(api.seed.createStarter);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const handleSeed = async () => {
    if (!userId) {
      setMessage({ type: "error", text: "Sign in first." });
      return;
    }
    setMessage(null);
    setPending(true);
    try {
      const result = await createStarterSeed({});
      if (result.skipped) {
        setMessage({ type: "ok", text: "Skipped — you already have data." });
      } else {
        setMessage({
          type: "ok",
          text: `Created: build, convention, closet item (linked), and one task.`,
        });
      }
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to load sample data",
      });
    } finally {
      setPending(false);
    }
  };

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="min-h-screen p-8 max-w-md">
      <h1 className="font-serif text-2xl font-bold mb-2">Dev: Seed data</h1>
      <p className="text-sm text-kyar-meta mb-6">
        Creates one build, one convention, one closet item (linked to the build), and one task.
        Runs once per user (skips if you already have builds).
      </p>
      {!isDev && (
        <p className="text-sm text-red-600 mb-4">Not available in production.</p>
      )}
      {userId ? (
        <>
          <button
            type="button"
            onClick={handleSeed}
            disabled={pending || !isDev}
            className="px-4 py-2 text-sm font-medium border border-black rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {pending ? "Loading..." : "Load sample data"}
          </button>
          {message && (
            <p
              className={`mt-4 text-sm ${message.type === "error" ? "text-red-600" : "text-kyar-meta"}`}
              role="alert"
            >
              {message.text}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-kyar-meta">
          <Link href="/auth/signin" className="underline">
            Sign in
          </Link>{" "}
          to run seed.
        </p>
      )}
      <p className="mt-8 text-xs text-kyar-meta">
        <Link href="/builds" className="underline">
          ← Back to builds
        </Link>
      </p>
    </div>
  );
}
