import type { Metadata } from "next";
import "./globals.css";
import { AuthGate } from "@/components/AuthGate";
import { QueryProvider } from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "Kyarafit – Editorial Cosplay Lookbook",
  description: "Organize your cosplay wardrobe, track builds, and plan character coords.",
};

// Force dynamic rendering - most pages require authentication
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@24,100..700,0..1"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-kyar-bg text-kyar-text font-sans antialiased" suppressHydrationWarning>
        <QueryProvider>
          <AuthGate>{children}</AuthGate>
        </QueryProvider>
      </body>
    </html>
  );
}
