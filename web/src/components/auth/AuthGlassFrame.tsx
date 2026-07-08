"use client";

/**
 * Shared auth-screen frame (refs 11b/13a–13c): full-bleed studio wall (the
 * 13g no-imagery fallback — auth has no user photography yet) under the
 * vertical page scrim, with a centered heavier-glass card (overlay weight:
 * 0.14 / blur 30) chosen so form fields keep AA contrast.
 */
export function AuthGlassFrame({
  eyebrow = "Welcome to",
  title = "Kyarafit",
  icon,
  children,
}: {
  eyebrow?: string;
  title?: string;
  /** Optional Material Symbol shown above the title (e.g. mark_email_unread) */
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-10 text-kyar-media-fg">
      <div className="absolute inset-0 bg-studio-wall" aria-hidden />
      <div className="absolute inset-0 bg-scrim-page-vertical" aria-hidden />

      <div className="relative w-full max-w-md rounded-glass-overlay bg-glass-overlay backdrop-blur-glass-overlay border border-glass-border-overlay shadow-glass-overlay p-8 sm:p-10">
        <div className="text-center mb-8">
          {icon && (
            <span
              className="material-symbols-outlined mb-4 block text-4xl text-media-fg-70"
              style={{ fontVariationSettings: '"FILL" 0, "wght" 200, "GRAD" 0, "opsz" 24' }}
              aria-hidden
            >
              {icon}
            </span>
          )}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-media-fg-55">
            {eyebrow}
          </p>
          <h1 className="font-serif text-4xl italic tracking-tight">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
