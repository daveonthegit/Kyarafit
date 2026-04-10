import Link from "next/link";

const sections = [
  {
    title: "What Kyarafit collects",
    body: "Kyarafit collects the account details you use to sign in, the cosplay builds and planning content you create, images you choose to upload, and limited device-local cache data needed for offline and signed-in experiences.",
  },
  {
    title: "What Kyarafit does not collect",
    body: "Kyarafit does not collect precise location, contacts, health data, advertising identifiers, or cross-app tracking data. Convention locations are only stored when you type them into the app.",
  },
  {
    title: "How your data is used",
    body: "We use your data to run your account, sync your content across devices, store your uploaded images, secure sign-in flows, and support optional billing features if subscriptions are enabled.",
  },
  {
    title: "Local and cloud storage",
    body: "On mobile, Kyarafit can keep local offline data on your device. When you sign in, your synced profile, builds, convention plans, and uploaded images are stored with Kyarafit's backend providers.",
  },
  {
    title: "Your choices",
    body: "You can sign out, review this policy in the app, and delete your account from Settings > Account Details. Account deletion permanently removes your cloud-synced Kyarafit content.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-kyar-bg text-kyar-text">
      <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <div className="border-b border-kyar-borderSubtle pb-8">
          <p className="meta-label mb-2 opacity-40">Privacy</p>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Privacy Policy</h1>
              <p className="mt-4 text-sm leading-6 text-kyar-textSecondary sm:text-[15px]">
                Effective date: April 10, 2026. This policy explains how Kyarafit handles account
                data, user-created cosplay planning content, uploaded images, and the local device
                cache used for signed-in and offline experiences.
              </p>
            </div>

            <div className="rounded-2xl border border-kyar-borderSubtle bg-kyar-surface px-5 py-4 shadow-soft lg:max-w-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-kyar-textSecondary">
                Quick summary
              </p>
              <p className="mt-2 text-sm leading-6 text-kyar-textSecondary">
                Kyarafit collects only the data needed to run your account, sync your builds, and
                store images you choose to upload. It does not sell personal data or use ad-tech
                tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:gap-5">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-kyar-borderSubtle bg-kyar-surface px-5 py-5 shadow-soft"
            >
              <h2 className="font-serif text-2xl tracking-tight">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-kyar-textSecondary">{section.body}</p>
            </section>
          ))}

          <section className="rounded-2xl border border-kyar-borderSubtle bg-kyar-surface px-5 py-5 shadow-soft">
            <h2 className="font-serif text-2xl tracking-tight">Service providers</h2>
            <p className="mt-3 text-sm leading-6 text-kyar-textSecondary">
              Kyarafit currently relies on third-party infrastructure for authentication, cloud
              storage, email delivery, and hosting. These providers may include Convex, Better Auth,
              Google or GitHub sign-in, Resend for transactional emails, and Stripe if paid
              subscriptions launch.
            </p>
          </section>

          <section className="rounded-2xl border border-kyar-borderSubtle bg-kyar-surface px-5 py-5 shadow-soft">
            <h2 className="font-serif text-2xl tracking-tight">No sale of personal data</h2>
            <p className="mt-3 text-sm leading-6 text-kyar-textSecondary">
              Kyarafit does not sell personal data and does not use third-party advertising or
              cross-app tracking for ad targeting.
            </p>
          </section>

          <section className="rounded-2xl border border-kyar-borderSubtle bg-kyar-surface px-5 py-5 shadow-soft">
            <h2 className="font-serif text-2xl tracking-tight">Contact</h2>
            <p className="mt-3 text-sm leading-6 text-kyar-textSecondary">
              For privacy or security questions, email{" "}
              <a
                className="underline decoration-kyar-border hover:text-kyar-text"
                href="mailto:kyarafit@kyarafit.com"
              >
                kyarafit@kyarafit.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-full border border-kyar-borderSubtle px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-kyar-text transition-colors hover:border-kyar-text hover:bg-kyar-muted"
          >
            Back to home
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex min-h-[44px] items-center rounded-full border border-kyar-borderSubtle px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-kyar-text transition-colors hover:border-kyar-text hover:bg-kyar-muted"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
