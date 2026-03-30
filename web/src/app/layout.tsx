import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { AuthGate } from "@/components/AuthGate";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { AppProviders } from "@/components/providers/AppProviders";
import { getToken } from "@/lib/auth/auth-server";

export const metadata: Metadata = {
  title: "Kyarafit – Editorial Cosplay Lookbook",
  description: "Organize your cosplay wardrobe, track builds, and plan character coords.",
};

// Force dynamic rendering - most pages require authentication
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const token = await getToken();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* display=swap so Material Symbols swap in when ready; optional often leaves ligature text visible */}
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@24,100..700,0..1&display=swap"
          as="style"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@24,100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen bg-kyar-bg text-kyar-text font-sans antialiased"
        suppressHydrationWarning
      >
        <ConvexClientProvider initialToken={token}>
          <LocaleProvider>
            <AppProviders>
              <AuthGate>{children}</AuthGate>
            </AppProviders>
          </LocaleProvider>
        </ConvexClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
