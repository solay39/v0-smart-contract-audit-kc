import { NextResponse } from "next/server"
import { getAuditById } from "@/lib/mock-db"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const audit = await getAuditById(id)
  return audit ? NextResponse.json({ audit }) : NextResponse.json({ error: "not found" }, { status: 404 })
}
