import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Albert_Sans, Bodoni_Moda, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthGate } from "@/components/AuthGate";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { AppProviders } from "@/components/providers/AppProviders";
import { getToken } from "@/lib/auth/auth-server";

export const metadata: Metadata = {
  title: "Kyarafit - Cosplay Studio Planner",
  description:
    "Organize wardrobe pieces, track builds, and plan conventions with studio-grade clarity.",
};

const body = Albert_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-body",
});

const display = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-explorer-mono",
});

// Force dynamic rendering - most pages require authentication
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const token = await getToken();

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='kyar-theme';var t=localStorage.getItem(k);if(t!=='dark'&&t!=='light'){t='light';}document.documentElement.setAttribute('data-theme',t);document.documentElement.classList.toggle('dark',t==='dark');}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.classList.remove('dark');}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@24,100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${body.variable} ${display.variable} ${jetbrainsMono.variable} min-h-screen bg-kyar-bg text-kyar-text font-sans antialiased`}
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
