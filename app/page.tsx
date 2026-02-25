"use client"

import { useState } from "react"
import { LoginScreen } from "@/components/login-screen"
import { SkynetPublic } from "@/components/skynet-public"
import { AuditWorkspace } from "@/components/audit-workspace"

type Screen = "login" | "skynet" | "workspace"

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
        <SkynetPublic onBack={() => setScreen("login")} />
      )}
      {screen === "workspace" && (
        <AuditWorkspace onLogout={() => setScreen("login")} />
      )}
    </>
  )
}
