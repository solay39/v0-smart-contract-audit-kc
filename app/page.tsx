"use client"

import { useState } from "react"
import { LoginScreen } from "@/components/login-screen"
import { SkynetPublic } from "@/components/skynet-public"
import { SkynetDiscovery } from "@/components/skynet-discovery"
import { AuditWorkspace } from "@/components/audit-workspace"

type Screen = "login" | "skynet" | "classic" | "workspace"

export default function Home() {
  const [screen, setScreen] = useState<Screen>("login")

  return (
    <>
      {screen === "login" && (
        <LoginScreen
          onFounder={() => setScreen("workspace")}
          onGuest={() => setScreen("skynet")}
        />
      )}
      {screen === "skynet" && (
        <SkynetDiscovery onBack={() => setScreen("login")} onClassic={() => setScreen("classic")} />
      )}
      {screen === "classic" && (
        <SkynetPublic onBack={() => setScreen("skynet")} />
      )}
      {screen === "workspace" && (
        <AuditWorkspace
          onLogout={() => {
            void fetch("/api/founder/session", { method: "DELETE" }).catch(() => {})
            setScreen("login")
          }}
        />
      )}
    </>
  )
}
