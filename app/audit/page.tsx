import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Crypto Smart Contract Audit | SOLAY39 Security Rating',
  description: 'Get a professional Web3 audit with SOLAY39. Manual review, AI verification, penalty-based rating and Skynet anti-hacker monitoring for your token. Request now.',
  keywords: 'crypto audit, smart contract audit, token security audit, Web3 audit, DeFi security, contract vulnerability check, blockchain audit service',
  alternates: {
    canonical: 'https://solay39.eu/audit',
  },
  openGraph: {
    title: 'Crypto Audit with SOLAY39 — Independent Web3 Security Standard',
    description: 'Manual-first smart contract auditing with Skynet post-audit monitoring. Trusted by Injective, Fetch.ai, chiliZ.',
    url: 'https://solay39.eu/audit',
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
}



export default function AuditLandingPage() {
  return (
    <div className="min-h-screen bg-[#030608] text-[#c8d8e8]">
      {/* Header */}
      <header className="border-b border-[#1e2a3a] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-[#00ff88] font-bold text-xl tracking-wider">
            SOLAY39
          </Link>
          <nav className="flex items-center gap-6 text-xs tracking-widest">
            <Link href="/" className="text-[#7a8c9e] hover:text-[#00ff88] transition-colors">
              PORTFOLIO
            </Link>
            <Link href="/skynet-pro" className="text-[#7a8c9e] hover:text-[#00e5ff] transition-colors">
              SKYNET PRO
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-20 border-b border-[#1e2a3a]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 bg-[#00ff8811] border border-[#00ff8833] text-[#00ff88] text-[10px] tracking-[0.2em] uppercase mb-8">
            Independent Web3 Security Standard
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Crypto Smart Contract Audit
            <span className="block text-[#00ff88]">with SOLAY39 Security Rating</span>
          </h1>
          <p className="text-lg text-[#7a8c9e] mb-10 max-w-2xl mx-auto leading-relaxed">
            Manual-first smart contract auditing with AI verification, penalty-based scoring, 
            and <span className="text-[#00e5ff]">Skynet post-audit monitoring</span>. 
            Trusted by Injective, Fetch.ai, and chiliZ.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:solay2126@gmail.com?subject=Audit%20Request"
              className="px-8 py-4 bg-[#00ff88] text-[#030608] font-bold text-sm tracking-wider hover:bg-[#00ff88dd] transition-colors"
            >
              REQUEST AN AUDIT
            </a>
            <a
              href="https://t.me/Solay39audit"
              target="_blank"
              rel="noreferrer"
              className="px-8 py-4 border border-[#00e5ff] text-[#00e5ff] font-bold text-sm tracking-wider hover:bg-[#00e5ff11] transition-colors"
            >
              CONTACT ON TELEGRAM
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">
            Why Choose <span className="text-[#00ff88]">SOLAY39</span>?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-[#0a0e14] border border-[#1e2a3a] p-6">
              <div className="w-12 h-12 bg-[#00ff8811] border border-[#00ff8833] flex items-center justify-center mb-4">
                <span className="text-[#00ff88] text-xl">1</span>
              </div>
              <h3 className="font-bold text-lg mb-3">Manual-First Review</h3>
              <p className="text-sm text-[#7a8c9e] leading-relaxed">
                Every audit starts with deep human analysis. Our auditors manually review your code 
                line-by-line before any automated tools.
              </p>
            </div>
            {/* Feature 2 */}
            <div className="bg-[#0a0e14] border border-[#1e2a3a] p-6">
              <div className="w-12 h-12 bg-[#00e5ff11] border border-[#00e5ff33] flex items-center justify-center mb-4">
                <span className="text-[#00e5ff] text-xl">2</span>
              </div>
              <h3 className="font-bold text-lg mb-3">AI Verification Layer</h3>
              <p className="text-sm text-[#7a8c9e] leading-relaxed">
                After manual review, our AI systems cross-verify findings to catch edge cases 
                and ensure comprehensive coverage.
              </p>
            </div>
            {/* Feature 3 */}
            <div className="bg-[#0a0e14] border border-[#1e2a3a] p-6">
              <div className="w-12 h-12 bg-[#ffd60011] border border-[#ffd60033] flex items-center justify-center mb-4">
                <span className="text-[#ffd600] text-xl">3</span>
              </div>
              <h3 className="font-bold text-lg mb-3">Skynet Monitoring</h3>
              <p className="text-sm text-[#7a8c9e] leading-relaxed">
                Post-audit protection included. Skynet monitors your token 24/7 for threats, 
                whale movements, and suspicious activity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Rating Scale */}
      <section className="px-6 py-16 border-t border-[#1e2a3a]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8">
            Transparent <span className="text-[#00ff88]">Penalty-Based</span> Rating
          </h2>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {[
              { rating: 'AAA', range: '90-98', color: '#00ff88' },
              { rating: 'AA', range: '80-89', color: '#7dff7d' },
              { rating: 'A', range: '70-79', color: '#ffd600' },
              { rating: 'B', range: '60-69', color: '#ff9500' },
              { rating: 'C', range: '<60', color: '#ff2d55' },
            ].map((item) => (
              <div 
                key={item.rating}
                className="px-6 py-4 bg-[#0a0e14] border border-[#1e2a3a] text-center min-w-[100px]"
              >
                <div className="text-2xl font-bold mb-1" style={{ color: item.color }}>
                  {item.rating}
                </div>
                <div className="text-xs text-[#7a8c9e]">{item.range}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-[#7a8c9e] max-w-2xl mx-auto">
            Our scoring starts at 100 and deducts points for each vulnerability found. 
            Critical issues carry heavier penalties. The result is a transparent, 
            comparable security rating.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 border-t border-[#1e2a3a] bg-[#0a0e14]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to Secure Your Protocol?
          </h2>
          <p className="text-[#7a8c9e] mb-8 max-w-xl mx-auto">
            Get your SOLAY39 Security Rating in 5-14 days. Full vulnerability report, 
            remediation guidance, and post-audit Skynet monitoring included.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:solay2126@gmail.com?subject=Audit%20Request"
              className="px-8 py-4 bg-[#00ff88] text-[#030608] font-bold text-sm tracking-wider hover:bg-[#00ff88dd] transition-colors"
            >
              GET YOUR FREE AUDIT QUOTE
            </a>
            <a
              href="https://t.me/Solay39audit"
              target="_blank"
              rel="noreferrer"
              className="px-8 py-4 border border-[#1e2a3a] text-[#c8d8e8] font-bold text-sm tracking-wider hover:border-[#00ff88] hover:text-[#00ff88] transition-colors"
            >
              TELEGRAM: @Solay39audit
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-[#1e2a3a] text-center">
        <div className="text-xs text-[#445566]">
          SOLAY39 Security Rating — The Independent Security Standard for Web3
        </div>
      </footer>
    </div>
  )
}
