import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Bodoni_Moda, Inter, JetBrains_Mono, Montserrat, Playfair_Display } from "next/font/google";
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

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  variable: "--font-montserrat",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-playfair-display",
});

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-bodoni-moda",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@24,100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${inter.variable} ${montserrat.variable} ${playfairDisplay.variable} ${bodoniModa.variable} ${jetbrainsMono.variable} min-h-screen bg-kyar-bg text-kyar-text font-sans antialiased`}
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
