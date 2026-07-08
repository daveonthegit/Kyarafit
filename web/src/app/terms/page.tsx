import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Kyarafit",
  description: "Terms governing your use of Kyarafit’s cosplay planning and convention tools.",
};

const EFFECTIVE_DATE = "April 22, 2026";

export default function TermsOfServicePage() {
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
            Legal
          </p>
          <div className="max-w-2xl">
            <h1 className="font-serif italic text-4xl tracking-tight sm:text-5xl">
              Terms of Service
            </h1>
            <p className="mt-4 text-sm leading-6 text-media-fg-70 sm:text-[15px]">
              Effective date: {EFFECTIVE_DATE}. These Terms of Service (“Terms”) govern your access
              to and use of Kyarafit’s websites, mobile applications, and related services
              (collectively, the “Service”) operated by Kyarafit (“we,” “us,” or “our”). By
              accessing or using the Service, you agree to these Terms. If you do not agree, do not
              use the Service.
            </p>
          </div>
        </header>

        <div className="mt-10 space-y-10 text-sm leading-6 text-media-fg-70">
          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              The Service
            </h2>
            <p className="mt-3">
              Kyarafit provides tools for cosplay wardrobe management, build tracking, convention
              planning, and related productivity features. We may modify, suspend, or discontinue
              parts of the Service at any time. We will make reasonable efforts to give notice of
              material changes where appropriate.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Eligibility and accounts
            </h2>
            <p className="mt-3">
              You must be able to form a binding contract in your jurisdiction and meet any minimum
              age required by applicable law (typically at least 13 years old in the United States).
              You are responsible for maintaining the confidentiality of your credentials and for
              all activity under your account. Notify us promptly at{" "}
              <a
                className="underline decoration-glass-border-strong hover:text-kyar-media-fg"
                href="mailto:kyarafit@kyarafit.com"
              >
                kyarafit@kyarafit.com
              </a>{" "}
              if you suspect unauthorized access.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              User content
            </h2>
            <p className="mt-3">
              You retain ownership of content you submit to the Service (“User Content”). You grant
              Kyarafit a non-exclusive, worldwide, royalty-free license to host, store, reproduce,
              display, and distribute User Content solely to operate, improve, and provide the
              Service to you and as described in our Privacy Policy. You represent that you have all
              rights necessary to grant this license and that your User Content does not violate
              third-party rights or applicable law.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Acceptable use
            </h2>
            <p className="mt-3">You agree not to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-media-fg-45">
              <li>
                Use the Service for unlawful, harmful, harassing, defamatory, obscene, or hateful
                purposes;
              </li>
              <li>
                Attempt to gain unauthorized access to systems, accounts, or data; interfere with
                the Service; or distribute malware;
              </li>
              <li>
                Scrape, crawl, or automate access to the Service in a way that impairs performance
                or violates our technical policies;
              </li>
              <li>Misrepresent your identity or affiliation;</li>
              <li>
                Upload content you do not have rights to use, or that infringes intellectual
                property or privacy rights of others;
              </li>
              <li>Circumvent security, usage limits, or billing controls.</li>
            </ul>
            <p className="mt-3">
              We may suspend or terminate access for violations or suspected abuse.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Third-party services and sign-in
            </h2>
            <p className="mt-3">
              The Service may integrate third-party authentication (such as Google or Apple),
              payment, email, or infrastructure providers. Your use of those services may be subject
              to their respective terms and privacy policies. We are not responsible for third-party
              services beyond our reasonable control.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Subscriptions and fees
            </h2>
            <p className="mt-3">
              If paid plans are offered, fees, billing cycles, and cancellation terms will be
              presented at purchase. Taxes may apply. Unless stated otherwise, subscriptions renew
              until cancelled. Refunds are handled according to the policy displayed at checkout or
              as required by law.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Intellectual property
            </h2>
            <p className="mt-3">
              The Service, including software, branding, design, and documentation (excluding your
              User Content), is owned by Kyarafit and its licensors and is protected by intellectual
              property laws. Except for the limited rights expressly granted in these Terms, no
              rights are transferred to you.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Disclaimers
            </h2>
            <p className="mt-3">
              THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND,
              WHETHER EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
              UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Limitation of liability
            </h2>
            <p className="mt-3">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, KYARAFIT AND ITS AFFILIATES, OFFICERS,
              DIRECTORS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR
              GOODWILL, ARISING FROM YOUR USE OF THE SERVICE. OUR AGGREGATE LIABILITY FOR ALL CLAIMS
              RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR
              THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED U.S. DOLLARS
              (US $100), EXCEPT WHERE PROHIBITED BY LAW.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Indemnity
            </h2>
            <p className="mt-3">
              You will defend, indemnify, and hold harmless Kyarafit from claims, damages, losses,
              and expenses (including reasonable attorneys’ fees) arising from your User Content,
              your use of the Service, or your violation of these Terms or applicable law.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Termination
            </h2>
            <p className="mt-3">
              You may stop using the Service at any time. You may delete your account where the
              product provides that option. We may suspend or terminate your access for breach of
              these Terms or for operational or legal reasons. Provisions that by their nature
              should survive termination (including ownership, disclaimers, limitation of liability,
              indemnity, and governing law) will survive.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Governing law and disputes
            </h2>
            <p className="mt-3">
              These Terms are governed by the laws of the United States and the State of Delaware,
              without regard to conflict-of-law principles, except where mandatory consumer
              protection laws in your jurisdiction require otherwise. Courts in Delaware shall have
              exclusive jurisdiction for disputes arising out of these Terms or the Service, unless
              applicable law requires a different venue for consumers.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Changes to these Terms
            </h2>
            <p className="mt-3">
              We may update these Terms from time to time. We will post the revised Terms on this
              page and update the effective date. If changes are material, we will provide
              additional notice where appropriate (such as by email or in-product notice). Continued
              use after the effective date constitutes acceptance of the updated Terms where
              permitted by law.
            </p>
          </section>

          <section className="border-t border-glass-divider pt-6 first:border-t-0 first:pt-0">
            <h2 className="font-serif italic text-2xl tracking-tight text-kyar-media-fg">
              Contact
            </h2>
            <p className="mt-3">
              Questions about these Terms:{" "}
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
            href="/privacy"
            className="inline-flex min-h-[44px] items-center rounded-full border border-glass-border-strong bg-glass-bar px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors hover:bg-glass-active"
          >
            Privacy Policy
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
