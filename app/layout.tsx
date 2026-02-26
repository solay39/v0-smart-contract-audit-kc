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
  title: 'SOLAY39 — Security Rating | The Independent Security Standard for Web3',
  description: 'Independent security ratings for Web3 protocols. Manual-first audit framework with AI-powered verification and transparent penalty-based scoring.',
  generator: 'v0.app',
  metadataBase: new URL('https://www.solay39.eu'),
  openGraph: {
    title: 'SOLAY39 Security Rating',
    description: 'The independent security standard for Web3. Manual-first audits with transparent, penalty-based scoring across 6 categories.',
    url: 'https://www.solay39.eu',
    siteName: 'SOLAY39 Security Rating',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SOLAY39 Security Rating',
    description: 'The independent security standard for Web3. Manual-first audits with transparent, penalty-based scoring across 6 categories.',
  },
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
