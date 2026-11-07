import type { Metadata } from "next"
import { SkynetDiscovery } from "@/components/skynet-discovery"

export const metadata: Metadata = {
  title: "Skynet Explorer | Solay39",
  description:
    "Explore public Solay39 reports by project and network. Evidence, limitations and preliminary status without unverified ratings.",
  alternates: { canonical: "https://www.solay39.eu/skynet" },
}
export default function SkynetPage() {
  return <SkynetDiscovery />
}
