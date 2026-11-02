import { NextResponse } from "next/server"
import { getAllAudits } from "@/lib/mock-db"

export async function GET() {
  return NextResponse.json({ audits: await getAllAudits() })
}
