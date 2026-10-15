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
  title: 'Crypto Smart Contract Audit | SOLAY39 Security Rating',
  description: 'Get a professional Web3 audit with SOLAY39. Manual review, AI verification, penalty-based rating and Skynet anti-hacker monitoring for your token. Request now.',
  keywords: 'crypto audit, smart contract audit, token security audit, Web3 audit, DeFi security, contract vulnerability check, blockchain audit service',
  generator: 'v0.app',
  metadataBase: new URL('https://solay39.eu'),
  alternates: {
    canonical: 'https://solay39.eu',
  },
  openGraph: {
    title: 'Crypto Audit with SOLAY39 — Independent Web3 Security Standard',
    description: 'Manual-first smart contract auditing with Skynet post-audit monitoring. Trusted by Injective, Fetch.ai, chiliZ.',
    url: 'https://solay39.eu',
    siteName: 'SOLAY39 Security Rating',
    type: 'website',
    images: [
      {
        url: 'https://www.solay39.eu/og-audit.png',
        width: 1200,
        height: 630,
        alt: 'SOLAY39 Crypto Smart Contract Audit',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crypto Audit with SOLAY39 — Independent Web3 Security Standard',
    description: 'Manual-first smart contract auditing with Skynet post-audit monitoring. Trusted by Injective, Fetch.ai, chiliZ.',
    images: ['https://www.solay39.eu/og-audit.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
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

// Schema.org structured data for SEO
const schemaOrgData = {
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "SOLAY39 Crypto Audit",
  "serviceType": "Smart Contract Security Audit",
  "provider": {
    "@type": "Organization",
    "name": "SOLAY39",
    "url": "https://solay39.eu",
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "email": "solay2126@gmail.com"
    }
  },
  "description": "Independent Web3 security audit with manual review, AI verification, penalty-based rating and Skynet post-audit monitoring.",
  "url": "https://solay39.eu",
  "areaServed": "Worldwide",
  "audience": {
    "@type": "Audience",
    "audienceType": "Crypto Projects, DeFi Protocols, Token Founders"
  },
  "offers": {
    "@type": "Offer",
    "description": "Smart contract audit with published SOLAY39 Security Rating",
    "url": "https://solay39.eu/audit"
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18059133257" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-18059133257');
            `,
          }}
        />
        {/* Schema.org structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgData) }}
        />
      </head>
      <body className="font-mono antialiased bg-background text-foreground">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
