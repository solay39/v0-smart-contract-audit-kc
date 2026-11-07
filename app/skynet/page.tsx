import type { Metadata } from "next"
import { SkynetDiscovery } from "@/components/skynet-discovery"

export const metadata: Metadata = {
  title: "Skynet Explorer | Solay39",
  description:
    "Esplora i report pubblici Solay39 per progetto e rete. Evidenze, limiti e stato preliminare senza rating non verificati.",
  alternates: { canonical: "https://www.solay39.eu/skynet" },
}
export default function SkynetPage() {
  return <SkynetDiscovery />
}
