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
  variant = "centered",
  mediaSrc = "/images/auth/fikri-ali-kurnia-ABoHCuDGHBE-unsplash.jpg",
  mediaKicker = "The cosplay studio planner",
  mediaTitle = "Made by hand.\nPlanned with care.",
  children,
}: {
  eyebrow?: string;
  title?: string;
  /** Optional Material Symbol shown above the title (e.g. mark_email_unread) */
  icon?: string;
  variant?: "centered" | "split";
  mediaSrc?: string;
  mediaKicker?: string;
  mediaTitle?: string;
  children: React.ReactNode;
}) {
  const header = (
    <div className={variant === "split" ? "mb-7" : "text-center mb-8"}>
      {icon && (
        <span
          className="material-symbols-outlined mb-4 block text-4xl text-media-fg-70"
          style={{ fontVariationSettings: '"FILL" 0, "wght" 200, "GRAD" 0, "opsz" 24' }}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-media-fg-55">
        {eyebrow}
      </p>
      <h1
        className={
          variant === "split"
            ? "font-serif text-[40px] italic tracking-[-0.01em]"
            : "font-serif text-4xl italic tracking-tight"
        }
      >
        {title}
      </h1>
    </div>
  );

  if (variant === "split") {
    return (
      <div className="min-h-screen bg-[rgb(8_8_14)] text-kyar-media-fg">
        <main className="relative min-h-screen overflow-hidden">
          <img
            src={mediaSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[32%_center] lg:w-[55%]"
            aria-hidden
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(8_8_14/0.38),rgb(8_8_14/0.74)_52%,rgb(8_8_14/0.96)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(8_8_14/0.82),rgb(8_8_14/0.16)_42%,rgb(8_8_14/0.42)_100%)] lg:bg-[linear-gradient(to_top,rgb(8_8_14/0.76),transparent_42%,rgb(8_8_14/0.2)_100%)]" />

          <span className="absolute left-9 top-8 z-10 hidden font-serif text-[22px] italic text-kyar-media-fg lg:block">
            Kyarafit
          </span>

          <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(480px,1fr)]">
            <section className="hidden min-h-0 flex-col justify-end px-8 pb-12 lg:flex xl:px-12">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-media-fg-70">
                {mediaKicker}
              </p>
              <h2 className="max-w-[540px] whitespace-pre-line font-serif text-[52px] italic leading-[0.98] tracking-[-0.02em] text-kyar-media-fg [text-shadow:0_3px_14px_rgb(12_11_20/0.45)]">
                {mediaTitle}
              </h2>
            </section>

            <section className="flex min-h-0 items-center justify-center px-6 py-12 sm:px-10 lg:bg-[linear-gradient(180deg,oklch(0.16_0.014_278),oklch(0.12_0.012_278))] lg:px-16">
              <div className="w-full max-w-[340px]">
                {header}
                {children}
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 py-10 text-kyar-media-fg">
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <img src={mediaSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div
        className="absolute inset-0 bg-scrim-page-vertical-mobile sm:bg-scrim-page-vertical"
        aria-hidden
      />

      <div className="relative w-full max-w-[400px] rounded-glass-overlay bg-glass-overlay backdrop-blur-glass-overlay border border-glass-border-overlay shadow-glass-overlay p-8 sm:p-10">
        {header}
        {children}
      </div>
    </div>
  );
}
