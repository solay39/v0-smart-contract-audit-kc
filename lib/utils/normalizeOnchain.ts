export function toBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true" || normalized === "1") return true
    if (normalized === "false" || normalized === "0" || normalized === "") return false
  }
  return undefined
}

export function toStringOrUndefined(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  return String(value)
}
