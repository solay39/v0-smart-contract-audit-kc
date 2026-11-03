import Link from "next/link"

const links = [
  { href: "/", label: "Portfolio" },
  { href: "/benchmark", label: "Benchmark" },
  { href: "/verification", label: "Verification" },
  { href: "/methodology", label: "Methodology" },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-s39-border bg-s39-bg0/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-5 px-5 sm:px-8">
        <Link href="/" className="shrink-0 text-xs font-bold tracking-[0.18em] text-s39-white">
          SOLAY39 <span className="font-normal text-s39-mid">/ SECURITY</span>
        </Link>
        <nav aria-label="Main navigation" className="flex flex-wrap justify-end gap-x-4 gap-y-2 text-[10px] text-s39-mid sm:gap-x-6 sm:text-xs">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-s39-white">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
