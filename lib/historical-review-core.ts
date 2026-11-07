import { createHash, randomUUID } from "node:crypto"
import { getAddress, verifyMessage } from "ethers"
import { z } from "zod"
import { REVIEW_CHECKS, type ReviewDraft, type ReviewSnapshot, type ReviewState, type ReviewChallenge } from "./historical-review-types"

export class ReviewError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message) }
}
export function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number" && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`
  }
  throw new ReviewError("INVALID_JSON", "Contenuto non canonizzabile.", 400)
}
export const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex")
export const byteDigest = (value: Buffer) => createHash("sha256").update(value).digest("hex")
export const snapshotHash = (snapshot: ReviewSnapshot) => digest(snapshot)
export const reviewKey = (snapshot: ReviewSnapshot) => digest({ auditId: snapshot.auditId, snapshotHash: snapshotHash(snapshot) })
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const note = z.string().max(12_000)
const checkSchema = z.object({ status: z.enum(["pending", "pass", "fail"]), note }).strict()
const decisionSchema = z.object({
  decision: z.enum(["pending", "false_positive", "confirmed_open", "resolved", "accepted_risk", "verified_observation"]),
  severity: z.enum(["UNRATED", "INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  rationale: note, evidenceRefs: z.array(hash).max(30),
}).strict()
export const draftSchema = z.object({
  scope: note, conclusion: note, residualRisks: note,
  checks: z.object({
    target: checkSchema, source: checkSchema, authority: checkSchema, execution: checkSchema,
    triage: checkSchema, limitations: checkSchema, conclusion: checkSchema,
  }).strict(),
  decisions: z.record(z.string(), decisionSchema),
  acknowledgements: z.object({ limitsReviewed: z.boolean(), noPublication: z.boolean(), noSafetyGuarantee: z.boolean() }).strict(),
}).strict()
export function emptyDraft(snapshot: ReviewSnapshot): ReviewDraft {
  return {
    scope: "", conclusion: "", residualRisks: "",
    checks: Object.fromEntries(REVIEW_CHECKS.map(([id]) => [id, { status: "pending", note: "" }])) as ReviewDraft["checks"],
    decisions: Object.fromEntries(snapshot.findings.map(f => [f.id, {
      decision: "pending", severity: "UNRATED", rationale: "", evidenceRefs: [],
    }])),
    acknowledgements: { limitsReviewed: false, noPublication: false, noSafetyGuarantee: false },
  }
}
export function initialState(snapshot: ReviewSnapshot): ReviewState {
  return { reviewKey: reviewKey(snapshot), auditId: snapshot.auditId, snapshotHash: snapshotHash(snapshot),
    version: 0, draft: emptyDraft(snapshot), challenge: null, approval: null }
}
export function validateDraft(snapshot: ReviewSnapshot, input: unknown): ReviewDraft {
  const parsed = draftSchema.safeParse(input)
  if (!parsed.success) throw new ReviewError("INVALID_DRAFT", "Formato della bozza non valido.", 400)
  const draft = parsed.data as ReviewDraft
  if (canonical(Object.keys(draft.decisions).sort()) !== canonical(snapshot.findings.map(f => f.id).sort())) {
    throw new ReviewError("FINDING_SET_CHANGED", "Non è possibile aggiungere o rimuovere finding dallo snapshot.", 400)
  }
  const refs = new Set(snapshot.refs.map(ref => ref.sha256))
  for (const decision of Object.values(draft.decisions)) {
    if (decision.evidenceRefs.some(ref => !refs.has(ref))) {
      throw new ReviewError("UNKNOWN_EVIDENCE", "Riferimento non presente nelle evidenze acquisite.", 400)
    }
  }
  return draft
}
export function approvalBlockers(snapshot: ReviewSnapshot, draft: ReviewDraft): string[] {
  const blockers = [...snapshot.technicalBlockers]
  if (draft.scope.trim().length < 60) blockers.push("Definire lo scope revisionato (almeno 60 caratteri).")
  if (draft.conclusion.trim().length < 80) blockers.push("Scrivere la conclusione revisionata (almeno 80 caratteri).")
  if (draft.residualRisks.trim().length < 20) blockers.push("Dichiarare rischi residui e limiti (almeno 20 caratteri).")
  for (const [id, label] of REVIEW_CHECKS) {
    if (draft.checks[id].status !== "pass" || draft.checks[id].note.trim().length < 20) blockers.push(`${label}: serve un esito pass motivato.`)
  }
  const incomplete = snapshot.findings.filter(finding => {
    const d = draft.decisions[finding.id]
    return !d || d.decision === "pending" || d.rationale.trim().length < 30 || !d.evidenceRefs.length
      || (d.decision !== "false_positive" && d.severity === "UNRATED")
  })
  if (incomplete.length) blockers.push(`${incomplete.length} finding senza decisione, motivazione o evidenza.`)
  if (snapshot.findings.some(f => draft.decisions[f.id]?.decision === "verified_observation"
      && draft.decisions[f.id].severity !== "INFO")) blockers.push("Un'osservazione informativa verificata deve essere classificata INFO; non può nascondere un finding di severità superiore.")
  const executedRefs = new Set(snapshot.refs.filter(ref => /\/(?:forge-results|runtime-summary|chain-summary)\.json$/.test(ref.label)).map(ref => ref.sha256))
  if (snapshot.findings.some(f => draft.decisions[f.id]?.decision === "resolved"
      && !draft.decisions[f.id].evidenceRefs.some(ref => executedRefs.has(ref)))) {
    blockers.push("Un finding dichiarato risolto richiede un riferimento a esecuzioni o stato acquisito, non soltanto al vecchio testo o alla compilazione.")
  }
  if (snapshot.findings.some(f => {
    const d = draft.decisions[f.id]
    return d?.decision === "confirmed_open" || (d?.decision === "accepted_risk" && ["HIGH", "CRITICAL"].includes(d.severity))
  })) blockers.push("Finding confermati aperti o rischi HIGH/CRITICAL non risolti impediscono l'approvazione.")
  if (Object.values(draft.acknowledgements).some(value => value !== true)) blockers.push("Confermare limiti, assenza di pubblicazione e assenza di garanzia assoluta.")
  return blockers
}
export function allowedWallets(raw: string): string[] {
  const entries = raw.split(",").map(x => x.trim()).filter(Boolean)
  if (!entries.length) throw new ReviewError("WALLET_CONFIGURATION", "Configurare esplicitamente il wallet del founder.", 503)
  try { return [...new Set(entries.map(x => getAddress(x).toLowerCase()))] }
  catch { throw new ReviewError("WALLET_CONFIGURATION", "Allowlist wallet non valida.", 503) }
}
export function requireWallet(wallet: string, allowlist: string[]): string {
  let normalized: string
  try { normalized = getAddress(wallet).toLowerCase() }
  catch { throw new ReviewError("INVALID_WALLET", "Indirizzo wallet non valido.", 400) }
  if (!allowlist.length || !allowlist.includes(normalized)) throw new ReviewError("WALLET_DENIED", "Wallet non autorizzato.", 403)
  return normalized
}
export function assertCurrent(snapshot: ReviewSnapshot, state: ReviewState, key: string, version: number) {
  if (key !== reviewKey(snapshot) || state.reviewKey !== key || state.snapshotHash !== snapshotHash(snapshot)) throw new ReviewError("STALE_SNAPSHOT", "Lo snapshot è cambiato. Riaprire la revisione.")
  if (state.version !== version) throw new ReviewError("STALE_VERSION", "Bozza modificata in un'altra sessione. Ricaricare.")
  if (state.approval) throw new ReviewError("FROZEN_REVIEW", "La revisione approvata è immutabile.")
}
export function challengePayload(snapshot: ReviewSnapshot, state: ReviewState, challenge: Omit<ReviewChallenge, "message" | "payloadHash">, domain: string) {
  return {
    protocol: "solay39-historical-review/v1", action: "APPROVE_UNPUBLISHED", domain,
    auditId: snapshot.auditId, reviewKey: state.reviewKey, snapshotHash: state.snapshotHash,
    originalReportHash: snapshot.originalReportHash, sourceDigests: snapshot.sourceDigests,
    evidenceHash: snapshot.evidenceHash, draftHash: digest(state.draft),
    nonce: challenge.nonce, wallet: challenge.wallet, issuedAt: challenge.issuedAt, expiresAt: challenge.expiresAt,
  }
}
export function challengeMessage(snapshot: ReviewSnapshot, payload: ReturnType<typeof challengePayload>) {
  const display = (value: string) => value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, " ").slice(0, 240)
  return [
    "Solay39 | Founder historical audit review | v1",
    `Domain: ${payload.domain}`, "Action: APPROVE_UNPUBLISHED", `Audit ID: ${snapshot.auditId}`,
    `Contract: ${display(snapshot.name)}`, `Network: ${display(snapshot.network)}`, `Address: ${snapshot.address || "NOT_CONFIRMED"}`,
    `Snapshot SHA-256: ${payload.snapshotHash}`, `Original report SHA-256: ${payload.originalReportHash}`,
    `Evidence SHA-256: ${payload.evidenceHash}`, `Decisions SHA-256: ${payload.draftHash}`,
    `Payload SHA-256: ${digest(payload)}`, `Wallet: ${payload.wallet}`, `Nonce: ${payload.nonce}`,
    `Issued: ${payload.issuedAt}`, `Expires: ${payload.expiresAt}`,
    "Approvo esclusivamente la revisione dello scope e delle conclusioni mostrati.",
    "Non autorizzo pubblicazione, transazioni, trasferimenti o certificazioni di sicurezza assoluta.",
  ].join("\n")
}
export function createChallenge(snapshot: ReviewSnapshot, state: ReviewState, wallet: string, domain: string, now = Date.now()): ReviewState {
  assertCurrent(snapshot, state, state.reviewKey, state.version)
  if (state.approval) throw new ReviewError("FROZEN_REVIEW", "Revisione già approvata.")
  const blockers = approvalBlockers(snapshot, validateDraft(snapshot, state.draft))
  if (blockers.length) throw new ReviewError("REVIEW_INCOMPLETE", blockers.join("\n"), 422)
  const base = { nonce: randomUUID(), wallet, issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60_000).toISOString(), draftHash: digest(state.draft) }
  const payload = challengePayload(snapshot, state, base, domain)
  return { ...state, version: state.version + 1, challenge: { ...base, payloadHash: digest(payload), message: challengeMessage(snapshot, payload) } }
}
export function approve(snapshot: ReviewSnapshot, state: ReviewState, signature: string, nonce: string, domain: string, wallets: string[], now = Date.now()): ReviewState {
  assertCurrent(snapshot, state, state.reviewKey, state.version)
  if (state.approval) throw new ReviewError("FROZEN_REVIEW", "Revisione già approvata.")
  const challenge = state.challenge
  if (!challenge || challenge.nonce !== nonce) throw new ReviewError("CHALLENGE_MISSING", "Challenge assente, sostituita o già utilizzata.")
  if (Date.parse(challenge.expiresAt) <= now || Date.parse(challenge.issuedAt) > now) throw new ReviewError("CHALLENGE_EXPIRED", "Challenge scaduta. Generarne una nuova.")
  requireWallet(challenge.wallet, wallets)
  if (digest(state.draft) !== challenge.draftHash) throw new ReviewError("STALE_DRAFT", "Le decisioni sono cambiate dopo la preparazione della firma.")
  const payload = challengePayload(snapshot, state, challenge, domain)
  if (digest(payload) !== challenge.payloadHash || challenge.message !== challengeMessage(snapshot, payload)) throw new ReviewError("CHALLENGE_BINDING", "Dominio, report o evidenze non corrispondono alla challenge.")
  const blockers = approvalBlockers(snapshot, validateDraft(snapshot, state.draft))
  if (blockers.length) throw new ReviewError("REVIEW_INCOMPLETE", blockers.join("\n"), 422)
  let recovered: string
  try { recovered = verifyMessage(challenge.message, signature).toLowerCase() }
  catch { throw new ReviewError("INVALID_SIGNATURE", "Firma non valida.", 400) }
  if (recovered !== challenge.wallet) throw new ReviewError("INVALID_SIGNATURE", "Firma di un wallet diverso da quello della challenge.", 403)
  return { ...state, version: state.version + 1, challenge: null, approval: {
    id: digest({ key: state.reviewKey, nonce, signature }), nonce, wallet: recovered, signature, challenge,
    message: challenge.message, payloadHash: challenge.payloadHash, snapshotHash: state.snapshotHash,
    approvedAt: new Date(now).toISOString(), publication: "UNPUBLISHED", assertion: "FOUNDER_REVIEW_OF_DECLARED_SCOPE",
  } }
}
export function verifyStoredState(snapshot: ReviewSnapshot, state: ReviewState, domain: string): ReviewState {
  if (state.reviewKey !== reviewKey(snapshot) || state.snapshotHash !== snapshotHash(snapshot)
      || state.auditId !== snapshot.auditId || !Number.isSafeInteger(state.version) || state.version < 0) {
    throw new ReviewError("CORRUPT_STATE", "Record persistito non coerente con lo snapshot.", 503)
  }
  validateDraft(snapshot, state.draft)
  const a = state.approval
  if (a) {
    const payload = challengePayload(snapshot, state, a.challenge, domain)
    let valid = false
    try {
      valid = a.publication === "UNPUBLISHED" && a.assertion === "FOUNDER_REVIEW_OF_DECLARED_SCOPE"
        && a.snapshotHash === state.snapshotHash && a.nonce === a.challenge.nonce
        && a.payloadHash === digest(payload) && a.message === challengeMessage(snapshot, payload)
        && a.message === a.challenge.message && a.payloadHash === a.challenge.payloadHash
        && a.challenge.draftHash === digest(state.draft)
        && a.wallet === a.challenge.wallet && verifyMessage(a.message, a.signature).toLowerCase() === a.wallet
        && a.id === digest({ key: state.reviewKey, nonce: a.nonce, signature: a.signature })
        && Date.parse(a.approvedAt) >= Date.parse(a.challenge.issuedAt)
        && Date.parse(a.approvedAt) < Date.parse(a.challenge.expiresAt)
        && approvalBlockers(snapshot, state.draft).length === 0 && state.challenge === null
    } catch { valid = false }
    if (!valid) throw new ReviewError("CORRUPT_APPROVAL", "Approvazione persistita non verificabile.", 503)
  }
  return state
}
