import { AuthGlassFrame } from "@/components/auth/AuthGlassFrame";

/**
 * Web fallback for the app's claimed OAuth return link. The OS normally hands
 * `https://<app host>/native/auth/return` to the installed app; this page renders only when it
 * did not (app missing, or the browser kept the navigation). The code it forwards is bound to the
 * app's PKCE verifier, so it is useless to anything but the app that started sign-in.
 */
const FORWARDED = ["code", "error"] as const;
const VALUE = /^[A-Za-z0-9_.-]{1,128}$/;

export default async function NativeAuthReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const forward = new URLSearchParams();
  for (const key of FORWARDED) {
    const value = params[key];
    if (typeof value === "string" && VALUE.test(value)) forward.set(key, value);
  }
  const appLink = `kyarafit://native/auth/return${forward.size ? `?${forward}` : ""}`;

  return (
    <AuthGlassFrame icon="open_in_new" eyebrow="Almost there" title="Return to the app">
      <div className="text-center">
        <p className="mb-8 -mt-2 text-sm text-media-fg-70 leading-relaxed">
          Sign-in finished in your browser. Open Kyarafit on this device to continue.
        </p>
        <a
          href={appLink}
          className="block w-full min-h-[44px] rounded-full bg-glass-solid text-glass-ink py-3 text-[10px] uppercase tracking-[0.18em] font-bold hover:opacity-90 transition-opacity text-center"
        >
          Open Kyarafit
        </a>
      </div>
    </AuthGlassFrame>
  );
}
