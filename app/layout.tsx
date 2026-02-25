import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'SOLAY39 — Smart Contract Security Audit Platform',
  description: 'Enterprise-grade smart contract security audits. Manual-first audit framework with AI-powered verification. Securing protocols through deep human review.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#030608',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body className="font-mono antialiased bg-background text-foreground">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
