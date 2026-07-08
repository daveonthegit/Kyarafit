import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Kyarafit",
  description:
    "How Kyarafit collects, uses, and protects your account data, cosplay planning content, and uploads.",
};

const EFFECTIVE_DATE = "April 22, 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="relative min-h-screen text-kyar-media-fg">
      <div className="fixed inset-0 bg-studio-wall" aria-hidden />
      <div className="relative z-10 mx-auto flex w-full max-w-[1600px] items-center gap-6 px-6 pt-5 lg:px-10">
        <Link
          href="/"
          className="font-serif italic text-[21px] leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded"
        >
          Kyarafit
        </Link>
      </div>
      <article className="relative z-10 mx-auto my-10 max-w-[760px] rounded-glass border border-glass-border bg-glass backdrop-blur-glass px-6 py-10 sm:px-10 sm:py-12">
        <header className="border-b border-glass-divider-strong pb-8">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-media-fg-55">
            Privacy
          </p>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="font-serif italic text-4xl tracking-tight sm:text-5xl">
                Privacy Policy
              </h1>
              <p className="mt-4 text-sm leading-6 text-media-fg-70 sm:text-[15px]">
                Effective date: {EFFECTIVE_DATE}. Kyarafit (“we,” “us,” or “our”) operates a cosplay
                wardrobe, build-tracking, and convention-planning service (“Service”). This Privacy
                Policy describes how we collect, use, disclose, and safeguard information when you
                use our websites, mobile apps, and related features.
              </p>
            </div>

            <div className="rounded-[10px] border border-glass-border bg-glass-active px-5 py-4 lg:max-w-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-media-fg-70">Summary</p>
              <p className="mt-2 text-sm leading-6 text-media-fg-70">
                We collect data needed to run your account and sync your content. We do not sell
                your personal information or use cross-app ad tracking for targeted ads.
              </p>
            </div>
          </div>
        </header>

        <div className="mt-10 space-y-10 text-sm leading-6 text-media-fg-70">
          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">Scope</h2>
            <p className="mt-3">
              This policy applies to personal information processed in connection with the Service.
              If you do not agree with this policy, please do not use the Service.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Information we collect
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-media-fg-45">
              <li>
                <strong className="text-kyar-media-fg">Account and authentication.</strong> Email
                address, display name, username, password hash (stored securely by our auth
                provider), session tokens, and similar identifiers needed to create and secure your
                account. If you use Google or Apple sign-in, we receive profile identifiers from
                those providers according to your permission choices.
              </li>
              <li>
                <strong className="text-kyar-media-fg">Content you create.</strong> Cosplay builds,
                wardrobe items, convention plans, packing lists, notes, and other planning data you
                enter or upload while using the Service.
              </li>
              <li>
                <strong className="text-kyar-media-fg">Images.</strong> Photos or files you
                explicitly choose to upload for items, builds, avatars, or progress tracking.
              </li>
              <li>
                <strong className="text-kyar-media-fg">Device and local storage.</strong> To support
                offline use and session persistence, the app may store limited data on your device
                (for example cached content or tokens). Web browsers may store auth-related data
                locally so you remain signed in across visits.
              </li>
              <li>
                <strong className="text-kyar-media-fg">Communications.</strong> Messages you send to
                us (such as support email) and transactional emails we send (verification, password
                reset).
              </li>
              <li>
                <strong className="text-kyar-media-fg">Billing (if enabled).</strong> If paid
                features are offered, payment status and subscription metadata may be processed by
                our payment provider; we do not store full payment card numbers on our servers.
              </li>
            </ul>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Information we do not collect by default
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-media-fg-45">
              <li>Precise GPS location (convention “location” fields are text you type).</li>
              <li>Contacts or address books.</li>
              <li>Health, fitness, or medical data.</li>
              <li>Advertising identifiers for cross-app ad targeting.</li>
              <li>
                Photos or files from your device unless you explicitly select them for upload.
              </li>
            </ul>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              How we use information
            </h2>
            <p className="mt-3">We use personal information to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-media-fg-45">
              <li>Provide, maintain, and improve the Service;</li>
              <li>Authenticate users and protect accounts;</li>
              <li>Sync your content across devices when you are signed in;</li>
              <li>Store and display images and user-created content;</li>
              <li>
                Send transactional emails (verification, password reset, service-related notices);
              </li>
              <li>Operate optional subscription or billing features if enabled;</li>
              <li>Detect abuse, fraud, and security incidents;</li>
              <li>Comply with law and enforce our Terms of Service.</li>
            </ul>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Legal bases (EEA, UK, Switzerland)
            </h2>
            <p className="mt-3">
              Where applicable, we rely on: (1) performance of a contract with you; (2) our
              legitimate interests in operating and securing the Service (balanced against your
              rights); (3) consent where required (for example optional marketing, if offered); and
              (4) legal obligations.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Sharing and subprocessors
            </h2>
            <p className="mt-3">
              We share information with service providers who assist us in hosting, authentication,
              database and file storage, email delivery, payments, and analytics infrastructure
              necessary to run the Service. Depending on features you use, providers may include
              Convex, Better Auth, Google or Apple (for social sign-in), Resend (transactional
              email), Stripe (billing, if enabled), and hosting vendors for our web application.
            </p>
            <p className="mt-3">
              We may disclose information if required by law, legal process, or governmental
              request, or to protect the rights, safety, and security of users, Kyarafit, or others.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              International transfers
            </h2>
            <p className="mt-3">
              Our infrastructure may process data in the United States and other countries where our
              providers operate. Where required, we use appropriate safeguards (such as standard
              contractual clauses) for transfers from the EEA, UK, or Switzerland.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Retention
            </h2>
            <p className="mt-3">
              We retain personal information as long as your account is active or as needed to
              provide the Service. After account deletion, we delete or anonymize cloud-synced
              profile data and user content associated with your account within a reasonable period,
              except where retention is required for legal, security, or billing dispute purposes.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Your rights
            </h2>
            <p className="mt-3">
              Depending on your location, you may have rights to access, correct, delete, or export
              your personal information, and to object to or restrict certain processing. You may
              exercise deletion through in-app account settings where available, or contact us using
              the email below. You may lodge a complaint with your local data protection authority.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              California residents
            </h2>
            <p className="mt-3">
              California residents may have additional rights under the CCPA/CPRA, including to
              know, delete, and correct personal information, and to opt out of certain sharing (we
              do not “sell” personal information or share it for cross-context behavioral
              advertising as defined under California law). To submit a request, email us at the
              address below.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Children&apos;s privacy
            </h2>
            <p className="mt-3">
              The Service is not directed to children under 13 (or the minimum age required in your
              jurisdiction). We do not knowingly collect personal information from children. If you
              believe we have collected information from a child, contact us and we will take
              appropriate steps.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Security
            </h2>
            <p className="mt-3">
              We implement technical and organizational measures designed to protect personal
              information. No method of transmission or storage is completely secure; use the
              Service at your own risk.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Changes to this policy
            </h2>
            <p className="mt-3">
              We may update this Privacy Policy from time to time. We will post the revised policy
              on this page and update the effective date. Continued use of the Service after changes
              become effective constitutes acceptance of the revised policy, where permitted by law.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              No sale of personal data
            </h2>
            <p className="mt-3">
              Kyarafit does not sell your personal information and does not use third-party ad-tech
              for cross-app tracking to deliver targeted advertising.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Contact
            </h2>
            <p className="mt-3">
              For privacy or data requests, contact{" "}
              <a
                className="underline decoration-glass-border-strong hover:text-kyar-media-fg"
                href="mailto:kyarafit@kyarafit.com"
              >
                kyarafit@kyarafit.com
              </a>
              .
            </p>
          </section>
        </div>

        <nav className="mt-12 flex flex-wrap gap-3" aria-label="Legal">
          <Link
            href="/terms"
            className="inline-flex min-h-[44px] items-center rounded-full border border-glass-border-strong bg-glass-bar px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors hover:bg-glass-active"
          >
            Terms of Service
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-full border border-glass-border-strong bg-glass-bar px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors hover:bg-glass-active"
          >
            Back to home
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex min-h-[44px] items-center rounded-full border border-glass-border-strong bg-glass-bar px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors hover:bg-glass-active"
          >
            Create account
          </Link>
        </nav>
      </article>
    </main>
  );
}
