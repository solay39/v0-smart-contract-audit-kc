import { requireFounder } from "@/lib/founder-auth"
/** Retired: count-only signatures cannot approve evidence-bound reports. */
export async function POST(req: Request) {
  const denied = await requireFounder(req)
  if (denied) return denied
  return Response.json({
    error: "Firma legacy disattivata. Usare la revisione storica con snapshot, nonce e approvazione non pubblicata.",
    replacement: "/founder/historical-reviews",
  }, { status: 410, headers: { "Cache-Control": "private, no-store" } })
}
