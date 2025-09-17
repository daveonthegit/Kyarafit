import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ClientOnly from '@/components/ClientOnly'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Kyarafit - Cosplay Wardrobe & Outfit Planning',
  description: 'Organize your cosplay wardrobe, track builds, and plan perfect character coords.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning={true}>
        <ClientOnly>
          {children}
        </ClientOnly>
      </body>
    </html>
  )
}
