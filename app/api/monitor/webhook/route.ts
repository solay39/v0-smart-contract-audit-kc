// ═══════════════════════════════════════════════════════════════════
// SOLAY39 — Alchemy Webhook Receiver
// app/api/monitor/webhook/route.ts
//
// Riceve gli eventi da Alchemy, analizza, invia alert.
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"

const ALERT_TOPICS = {
  OwnershipTransferred: "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0",
  Paused:               "0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258",
  Unpaused:             "0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa",
  Upgraded:             "0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b",
  AdminChanged:         "0x7e644d79422f17c01e4894b5f4f588d331ebfa28653d42ae832dc59e38c9798f",
}

async function sendTelegramAlert(message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
    }),
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const auditId = searchParams.get("auditId") || "unknown"

    const body = await req.json()
    const activity = body?.event?.activity || []

    const alerts: string[] = []

    for (const act of activity) {
      // Large transfer (>100 ETH equivalent as rough heuristic)
      const val = parseFloat(act.value || "0")
      if (val > 100) {
        alerts.push(`🚨 *LARGE TRANSFER* on audit \`${auditId}\`\n` +
          `Amount: ${val} ${act.asset}\n` +
          `From: \`${act.fromAddress}\`\n` +
          `To: \`${act.toAddress}\`\n` +
          `TX: \`${act.hash}\``)
      }

      // Critical event logs
      for (const log of (act.log ? [act.log] : [])) {
        const topic0 = log.topics?.[0]
        if (topic0 === ALERT_TOPICS.OwnershipTransferred) {
          alerts.push(`🔴 *OWNERSHIP TRANSFERRED* on audit \`${auditId}\`\n` +
            `New owner: \`${log.topics[2]?.slice(-40)}\`\n` +
            `TX: \`${act.hash}\``)
        }
        if (topic0 === ALERT_TOPICS.Paused) {
          alerts.push(`⏸ *CONTRACT PAUSED* on audit \`${auditId}\`\n` +
            `All transfers halted!\n` +
            `TX: \`${act.hash}\``)
        }
        if (topic0 === ALERT_TOPICS.Upgraded) {
          alerts.push(`🔄 *PROXY UPGRADED* on audit \`${auditId}\`\n` +
            `New implementation: \`${log.topics[1]?.slice(-40)}\`\n` +
            `TX: \`${act.hash}\``)
        }
      }
    }

    // Send all alerts
    for (const alert of alerts) {
      await sendTelegramAlert(alert)
    }

    return NextResponse.json({ received: true, alerts: alerts.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}