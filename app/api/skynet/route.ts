import { generateText, Output } from "ai"
import { z } from "zod"

export async function POST(req: Request) {
  try {
    const { code } = await req.json()

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return Response.json(
        { error: "No code provided" },
        { status: 400 }
      )
    }

    const result = await generateText({
      model: "anthropic/claude-sonnet-4-20250514",
      output: Output.object({
        schema: z.object({
          findings: z.array(
            z.object({
              title: z.string(),
              severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]),
              location: z.string(),
              description: z.string(),
              impact: z.string(),
              recommendation: z.string(),
            })
          ),
        }),
      }),
      system:
        "You are an elite smart contract security auditor using the Solay39 Manual-First Audit Framework. Analyze the provided Solidity code and identify security vulnerabilities. Return findings as a structured JSON with title, severity (CRITICAL/HIGH/MEDIUM/LOW/INFO), location, description, impact, and recommendation for each finding. Be thorough but precise.",
      prompt: `Analyze this smart contract for security vulnerabilities:\n\n${code}`,
    })

    const findings = result.output?.findings ?? []
    return Response.json({ findings })
  } catch (error) {
    console.error("Skynet AI error:", error)
    return Response.json(
      {
        error: "AI analysis failed. Please check your connection and try again.",
        findings: [],
      },
      { status: 500 }
    )
  }
}
