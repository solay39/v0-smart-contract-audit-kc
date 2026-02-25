import { generateText } from "ai"

const SYSTEM_PROMPT = `You are an elite smart contract security auditor using the Solay39 Manual-First Audit Framework.
Analyze the provided Solidity code and identify security vulnerabilities.

You MUST respond ONLY with a valid JSON object (no markdown, no code fences, no explanation outside JSON).
The JSON must follow this exact structure:
{
  "findings": [
    {
      "title": "string - name of the vulnerability",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
      "location": "string - function or line where the issue is found",
      "description": "string - detailed explanation of the issue",
      "impact": "string - what could happen if exploited",
      "recommendation": "string - how to fix it"
    }
  ]
}

If no vulnerabilities are found, return: { "findings": [] }
Be thorough but precise. Focus on real vulnerabilities.`

export async function POST(req: Request) {
  try {
    const { code } = await req.json()

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return Response.json({ error: "No code provided" }, { status: 400 })
    }

    const truncatedCode = code.slice(0, 15000)

    const result = await generateText({
      model: "openai/gpt-4o-mini",
      system: SYSTEM_PROMPT,
      prompt: `Analyze this smart contract for security vulnerabilities:\n\n${truncatedCode}`,
      maxOutputTokens: 4096,
    })

    const text = result.text.trim()

    let parsed: { findings: Array<{
      title: string
      severity: string
      location: string
      description: string
      impact: string
      recommendation: string
    }> }

    try {
      // Try direct parse first
      parsed = JSON.parse(text)
    } catch {
      // Try to extract JSON from potential markdown code fences
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch?.[1]) {
        parsed = JSON.parse(jsonMatch[1].trim())
      } else {
        // Try to find JSON object in text
        const braceStart = text.indexOf("{")
        const braceEnd = text.lastIndexOf("}")
        if (braceStart !== -1 && braceEnd !== -1) {
          parsed = JSON.parse(text.slice(braceStart, braceEnd + 1))
        } else {
          console.error("[v0] Failed to parse AI response:", text.slice(0, 500))
          return Response.json({
            error: "AI returned an invalid response format. Please try again.",
            findings: [],
          }, { status: 500 })
        }
      }
    }

    const validSeverities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
    const findings = (parsed.findings ?? []).map((f) => ({
      title: String(f.title || "Untitled Finding"),
      severity: validSeverities.includes(f.severity) ? f.severity : "INFO",
      location: String(f.location || "Unknown"),
      description: String(f.description || ""),
      impact: String(f.impact || ""),
      recommendation: String(f.recommendation || ""),
    }))

    return Response.json({ findings })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("[v0] Skynet AI error:", msg)
    return Response.json(
      {
        error: `AI analysis failed: ${msg.includes("API") || msg.includes("401") || msg.includes("key") ? "Missing or invalid API key. Please configure your AI provider." : "An unexpected error occurred. Please try again."}`,
        findings: [],
      },
      { status: 500 }
    )
  }
}
