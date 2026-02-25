"use client"

import { useState } from "react"
import { FOUNDER_EMAIL, FOUNDER_PASS, PUB_EMAIL, TG_URL } from "@/lib/solay39-constants"
import { S39Input, S39Btn } from "@/components/solay39-ui"

export function LoginScreen({
  onFounder,
  onGuest,
}: {
  onFounder: () => void
  onGuest: () => void
}) {
  const [email, setEmail] = useState("")
  const [pass, setPass] = useState("")
  const [err, setErr] = useState("")

  const login = () => {
    if (email === FOUNDER_EMAIL && pass === FOUNDER_PASS) {
      onFounder()
    } else {
      setErr("Invalid credentials.")
    }
  }

  return (
    <main className="min-h-dvh bg-s39-bg0 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="animate-[fadeUp_0.6s_ease] text-center mb-10">
        <h1
          className="text-3xl sm:text-4xl font-bold text-s39-green tracking-wider animate-[glow_3s_infinite]"
        >
          SOLAY39
        </h1>
        <p className="text-[8px] sm:text-[9px] text-s39-dim tracking-[0.22em] mt-1">
          SMART CONTRACT SECURITY AUDIT PLATFORM
        </p>
      </div>

      {/* Login Card */}
      <div className="bg-s39-bg1 border border-s39-border p-6 sm:p-8 w-full max-w-[360px] animate-[fadeUp_0.7s_ease]">
        <div className="text-[9px] text-s39-mid tracking-[0.15em] mb-5">
          FOUNDER ACCESS
        </div>
        <S39Input
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="founder@solay39.com"
          type="email"
        />
        <S39Input
          label="Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="••••••••••"
          type="password"
        />
        {err && <div className="text-s39-red text-[9px] mb-2.5">{err}</div>}
        <S39Btn primary onClick={login} className="w-full mb-3">
          Access Workspace
        </S39Btn>
        <div className="text-center">
          <button
            onClick={onGuest}
            className="text-[9px] text-s39-dim hover:text-s39-green transition-colors cursor-pointer bg-transparent border-none font-mono"
          >
            {"View public portfolio ->"}
          </button>
        </div>
      </div>

      {/* Footer links */}
      <div className="mt-10 flex gap-5 flex-wrap justify-center">
        <a
          href={`mailto:${PUB_EMAIL}`}
          className="text-[8px] text-s39-dim tracking-widest hover:text-s39-mid transition-colors"
        >
          {PUB_EMAIL}
        </a>
        <a
          href={TG_URL}
          target="_blank"
          rel="noreferrer"
          className="text-[8px] text-s39-dim tracking-widest hover:text-s39-mid transition-colors"
        >
          t.me/Solay39audit
        </a>
      </div>
    </main>
  )
}
