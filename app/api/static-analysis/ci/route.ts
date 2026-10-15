import { NextRequest, NextResponse } from "next/server"
import {
  dispatchStaticAnalysis,
  getStaticAnalysisJob,
  GithubAnalysisError,
  isGithubAnalysisConfigured,
  JOB_ID_PATTERN,
} from "@/lib/github-analysis-runner"

export const runtime = "nodejs"
export const maxDuration = 60

function errorResponse(error: unknown) {
  if (error instanceof GithubAnalysisError) {
    return NextResponse.json({ error: error.message }, { status: error.status >= 400 ? error.status : 500 })
  }
  console.error("[StaticAnalysisCI] Error:", error)
  return NextResponse.json({ error: error instanceof Error ? error.message : "Errore sconosciuto" }, { status: 500 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const code = body?.code
    const contractName = typeof body?.contractName === "string" ? body.contractName : "Contract"
    if (typeof code !== "string" || !/pragma\s+solidity/.test(code)) {
      return NextResponse.json({ error: "Serve codice Solidity con pragma solidity." }, { status: 400 })
    }
    if (!isGithubAnalysisConfigured()) {
      return NextResponse.json({ error: "GITHUB_TOKEN non configurato" }, { status: 500 })
    }
    const jobId = await dispatchStaticAnalysis(code, contractName)
    return NextResponse.json({ jobId, state: "queued" }, { status: 202 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId")
  if (!jobId) {
    return NextResponse.json({ configured: isGithubAnalysisConfigured(), runner: "github-actions" })
  }
  if (!JOB_ID_PATTERN.test(jobId)) {
    return NextResponse.json({ error: "jobId non valido" }, { status: 400 })
  }
  try {
    return NextResponse.json(await getStaticAnalysisJob(jobId))
  } catch (error) {
    return errorResponse(error)
  }
}
