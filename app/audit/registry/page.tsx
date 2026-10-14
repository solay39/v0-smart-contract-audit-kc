import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Registry Deployment Verification | Solay39",
  description: "On-chain deployment and governance verification for Solay39 registry contracts.",
}

const contracts = [
  { name: "AuditRegistry", key: "auditRegistry" },
  { name: "Solay39AuditRegistry", key: "solay39AuditRegistry" },
  { name: "Solay39EnterpriseRegistry", key: "solay39EnterpriseRegistry" },
]

export default function RegistryAuditPage() {
  return (
    <main className="min-h-dvh bg-s39-bg0 px-4 py-8 font-mono text-s39-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 border-b border-s39-line pb-6">
          <p className="mb-3 text-[10px] tracking-[0.2em] text-s39-cyan">SOLAY39 / ON-CHAIN REVIEW</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Registry deployment verification</h1>
          <p className="mt-3 max-w-2xl text-xs leading-6 text-s39-dim">
            Questa è la pagina corretta per verificare i registry Solay39. Inserisci rete, RPC e address reali per controllare bytecode, owner e timelock. La pagina INJ resta dedicata al token Injective.
          </p>
        </header>

        <section className="mb-8 grid gap-3 sm:grid-cols-3">
          <div className="border border-s39-line bg-s39-bg1 p-4"><p className="text-[9px] tracking-widest text-s39-dim">NETWORK</p><p className="mt-2 text-sm">Not configured</p></div>
          <div className="border border-s39-line bg-s39-bg1 p-4"><p className="text-[9px] tracking-widest text-s39-dim">RPC STATUS</p><p className="mt-2 text-sm text-amber-300">Awaiting endpoint</p></div>
          <div className="border border-s39-line bg-s39-bg1 p-4"><p className="text-[9px] tracking-widest text-s39-dim">GOVERNANCE</p><p className="mt-2 text-sm text-amber-300">Not verified</p></div>
        </section>

        <section className="mb-8 border border-s39-line bg-s39-bg1 p-5">
          <h2 className="text-sm font-bold">Deployment inputs</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {["Network / chain ID", "RPC URL", "Explorer base URL"].map((label) => (
              <label key={label} className="text-[10px] text-s39-dim">
                {label}
                <input aria-label={label} placeholder={`Enter ${label.toLowerCase()}`} className="mt-2 w-full border border-s39-line bg-s39-bg0 px-3 py-2 text-xs text-s39-white outline-none focus:border-s39-cyan" />
              </label>
            ))}
          </div>
          <p className="mt-4 text-[10px] leading-5 text-s39-dim">I valori non vengono considerati verificati finché non sono confrontati con una rete pubblica e con gli artifact del commit auditato.</p>
        </section>

        <section className="space-y-4">
          {contracts.map((contract) => (
            <article key={contract.key} className="border border-s39-line bg-s39-bg1 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-bold">{contract.name}</h2>
                <span className="border border-amber-400/30 px-2 py-1 text-[9px] tracking-widest text-amber-300">NOT VERIFIED</span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-[10px] text-s39-dim">Contract address<input aria-label={`${contract.name} contract address`} placeholder="0x..." className="mt-2 w-full border border-s39-line bg-s39-bg0 px-3 py-2 text-xs text-s39-white outline-none focus:border-s39-cyan" /></label>
                <label className="text-[10px] text-s39-dim">Expected commit SHA<input aria-label={`${contract.name} commit SHA`} placeholder="e.g. e48e117" className="mt-2 w-full border border-s39-line bg-s39-bg0 px-3 py-2 text-xs text-s39-white outline-none focus:border-s39-cyan" /></label>
              </div>
              <div className="mt-5 grid gap-3 text-[10px] sm:grid-cols-4">
                {['Bytecode match', 'Owner', 'Multisig / timelock', 'Explorer source'].map((check) => <div key={check} className="border border-s39-line px-3 py-3 text-s39-dim"><span className="text-amber-300">PENDING</span><br />{check}</div>)}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
