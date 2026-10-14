import deployments from "@/data/deployments/solay39-registries.json"

export const metadata = {
  title: "Solay39 Registry Deployments | Governance Proof",
  description: "Deployment and governance verification status for the Solay39 registry contracts.",
}

type RegistryContract = (typeof deployments.contracts)[number]

function statusLabel(contract: RegistryContract) {
  return contract.status === "verified" ? "VERIFIED" : "PENDING VERIFICATION"
}

export default function Solay39RegistriesPage() {
  return (
    <main className="min-h-dvh bg-s39-bg0 px-5 py-10 text-s39-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <a href="/audit/inj-token" className="font-mono text-[10px] tracking-[0.14em] text-s39-cyan no-underline hover:text-s39-green">
          ← BACK TO TOKEN AUDIT
        </a>
        <header className="mt-8 border-b border-s39-green/20 pb-8">
          <p className="font-mono text-[10px] tracking-[0.2em] text-s39-green">GOVERNANCE / DEPLOYMENT PROOF</p>
          <h1 className="mt-3 font-mono text-2xl font-bold sm:text-4xl">Solay39 Registry Deployments</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-s39-dim">
            Separate on-chain evidence for the registry contracts. Token source and bytecode status are intentionally kept on the token audit page.
          </p>
        </header>

        <section className="mt-6 grid gap-3 text-[10px] font-mono sm:grid-cols-3">
          <div className="border border-s39-green/20 bg-s39-bg1 p-4"><span className="text-s39-dim">NETWORK</span><strong className="mt-2 block text-s39-white">{deployments.network}</strong></div>
          <div className="border border-s39-green/20 bg-s39-bg1 p-4"><span className="text-s39-dim">CHAIN ID</span><strong className="mt-2 block text-s39-white">{deployments.chainId}</strong></div>
          <div className="border border-s39-yellow/30 bg-s39-bg1 p-4"><span className="text-s39-dim">GOVERNANCE STATUS</span><strong className="mt-2 block text-s39-yellow">PENDING PROOF</strong></div>
        </section>

        <section className="mt-8 space-y-4" aria-label="Registry contracts">
          {deployments.contracts.map((contract) => (
            <article key={contract.name} className="border border-s39-green/20 bg-s39-bg1 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-mono text-lg font-bold text-s39-white">{contract.name}</h2>
                <span className="border border-s39-yellow/30 px-2 py-1 font-mono text-[9px] tracking-wider text-s39-yellow">{statusLabel(contract)}</span>
              </div>
              <dl className="mt-5 grid gap-4 text-[10px] sm:grid-cols-2">
                <div><dt className="text-s39-dim">CONTRACT ADDRESS</dt><dd className="mt-1 break-all font-mono text-s39-white">{contract.address || "Not supplied"}</dd></div>
                <div><dt className="text-s39-dim">OWNER</dt><dd className="mt-1 break-all font-mono text-s39-white">{contract.owner || "Not verified"}</dd></div>
                <div><dt className="text-s39-dim">TIMELOCK</dt><dd className="mt-1 break-all font-mono text-s39-white">{contract.timelock || "Not verified"}</dd></div>
                <div><dt className="text-s39-dim">EXPLORER</dt><dd className="mt-1 font-mono">{contract.etherscan ? <a href={contract.etherscan} target="_blank" rel="noreferrer" className="text-s39-cyan hover:text-s39-green">Open Etherscan</a> : <span className="text-s39-dim">Not supplied</span>}</dd></div>
              </dl>
              <p className="mt-5 border-t border-s39-green/10 pt-4 text-xs leading-5 text-s39-dim">{contract.notes}</p>
            </article>
          ))}
        </section>

        <aside className="mt-8 border border-s39-cyan/20 bg-s39-bg1 p-5 text-xs leading-6 text-s39-dim">
          <strong className="font-mono text-s39-cyan">Verification requirements</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5"><li>Confirm deployed bytecode and source on the network explorer.</li><li>Read owner and timelock from the live contracts.</li><li>Verify governance addresses are the intended multisig or timelock contracts.</li></ul>
        </aside>
      </div>
    </main>
  )
}
