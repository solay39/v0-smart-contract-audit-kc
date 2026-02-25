"use client"

import { cn } from "@/lib/utils"
import type { SeverityLevel } from "@/lib/solay39-constants"
import { SEV_CONFIG, scoreColor, ratingOf } from "@/lib/solay39-constants"

// ── Severity Badge ──────────────────────────────────────────────
export function SevBadge({ sev }: { sev: SeverityLevel }) {
  const config = SEV_CONFIG[sev] || SEV_CONFIG.INFO
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 text-[8px] tracking-widest font-bold border",
        config.bg,
        config.color,
        config.border
      )}
    >
      {sev}
    </span>
  )
}

// ── Score Ring ───────────────────────────────────────────────────
export function ScoreRing({ score, size = 110 }: { score: number; size?: number }) {
  const r = size / 2 - 7
  const circ = 2 * Math.PI * r
  const col = scoreColor(score)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#2a3340"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={3}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score / 100)}
          style={{
            filter: `drop-shadow(0 0 6px ${col}88)`,
            transition: "stroke-dashoffset 0.8s ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold leading-none"
          style={{ fontSize: size > 90 ? 20 : 14, color: col }}
        >
          {score}
        </span>
        <span className="text-[7px] text-s39-dim tracking-widest mt-0.5">
          {ratingOf(score)}
        </span>
      </div>
    </div>
  )
}

// ── Input ────────────────────────────────────────────────────────
export function S39Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multi = false,
}: {
  label?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  placeholder?: string
  type?: string
  multi?: boolean
}) {
  const baseClass =
    "w-full bg-s39-bg2 border border-s39-border text-s39-lite p-2 text-[11px] font-mono outline-none transition-colors focus:border-s39-green"

  return (
    <div className="mb-3">
      {label && (
        <div className="text-[8px] text-s39-dim tracking-[0.15em] uppercase mb-1">
          {label}
        </div>
      )}
      {multi ? (
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={3}
          className={cn(baseClass, "resize-y")}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={baseClass}
        />
      )}
    </div>
  )
}

// ── Button ───────────────────────────────────────────────────────
export function S39Btn({
  children,
  onClick,
  primary = false,
  danger = false,
  small = false,
  disabled = false,
  className: extraClass,
}: {
  children: React.ReactNode
  onClick?: () => void
  primary?: boolean
  danger?: boolean
  small?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "font-mono font-bold tracking-widest uppercase transition-all cursor-pointer",
        small ? "px-3.5 py-1 text-[9px]" : "px-5 py-2 text-[10px]",
        primary
          ? "bg-s39-green text-s39-bg0 border-none hover:opacity-85"
          : danger
          ? "bg-transparent text-s39-red border border-s39-red/30 hover:border-s39-red/60"
          : "bg-transparent text-s39-mid border border-s39-border hover:border-s39-green/30 hover:text-s39-green",
        disabled && "opacity-50 cursor-not-allowed",
        extraClass
      )}
    >
      {children}
    </button>
  )
}
