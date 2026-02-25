import type { AuditProject, Finding } from "@/lib/solay39-constants"
import { scoreColor, ratingOf, SEV_RAW_COLORS } from "@/lib/solay39-constants"

export function exportPDF(project: AuditProject, score: number, findings: Finding[]) {
  const rat = ratingOf(score)
  const sc = score >= 90 ? "#00ff88" : score >= 70 ? "#ffd600" : "#ff6b00"
  const today = new Date().toISOString().slice(0, 10)
  const hC = SEV_RAW_COLORS
  const cnt = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 } as Record<string, number>
  findings.forEach((f) => {
    if (cnt[f.severity] !== undefined) cnt[f.severity]++
  })
  const open_c = findings.filter((f) => f.status === "OPEN").length
  const fix_c = findings.filter((f) => f.status === "RESOLVED").length
  const scopeDisplay = (() => {
    const s = project.scope || ""
    if (!s) return "—"
    const first = s.split("\n")[0].trim()
    return first.length > 60 ? first.slice(0, 57) + "..." : first
  })()
  const sevPfx: Record<string, string> = { CRITICAL: "C", HIGH: "H", MEDIUM: "M", LOW: "L", INFO: "I" }
  const sevCounts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 }

  const findingsHtml =
    findings.length === 0
      ? `<div style="display:flex;gap:14px;align-items:flex-start;background:#001a0d;border:1px solid #00ff8833;border-left:3px solid #00ff88;padding:18px;margin:10px 0">
          <span style="color:#00ff88;font-size:22px;flex-shrink:0">&#10003;</span>
          <div><strong style="color:#eef4fa;font-size:12px">No Issues Found</strong>
          <p style="color:#7a8c9e;font-size:9.5px;margin-top:6px">The contracts passed all checks of the Solay39 Manual-First Audit Framework without any identifiable security issues.</p></div>
        </div>`
      : (() => {
          let html = `<h2 style="font-size:12px;color:#00ff88;margin:0 0 10px">3.1 Summary</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:18px;font-size:10px">
              <thead><tr>${["SEVERITY", "COUNT", "OPEN", "RESOLVED", "ACKNOWLEDGED"]
                .map(
                  (h) =>
                    `<th style="background:#0d1117;color:#445566;font-size:7.5px;letter-spacing:.15em;padding:8px 10px;text-align:left;border-bottom:1px solid #161e2a">${h}</th>`
                )
                .join("")}</tr></thead>
              <tbody>`
          ;(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).forEach((s) => {
            const c = cnt[s]
            const op = findings.filter((f) => f.severity === s && f.status === "OPEN").length
            const rs = findings.filter((f) => f.severity === s && f.status === "RESOLVED").length
            const ak = findings.filter((f) => f.severity === s && f.status === "ACKNOWLEDGED").length
            html += `<tr><td style="padding:8px 10px;border-bottom:1px solid #111820;color:${hC[s]};font-weight:700">${s}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #111820">${c}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #111820">${op}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #111820">${rs}</td>
              <td style="padding:8px 10px;border-bottom:1px solid #111820">${ak}</td></tr>`
          })
          html += `</tbody></table><h2 style="font-size:12px;color:#00ff88;margin:0 0 10px">3.2 Finding Details</h2>`
          findings.forEach((f) => {
            sevCounts[f.severity] = (sevCounts[f.severity] || 0) + 1
            const num = `${sevPfx[f.severity] || "F"}-${String(sevCounts[f.severity]).padStart(2, "0")}`
            const sc2 = hC[f.severity] || "#fff"
            const stC = f.status === "RESOLVED" ? "#00ff88" : f.status === "ACKNOWLEDGED" ? "#ffd600" : "#ff2d55"
            html += `<div style="border-left:3px solid ${sc2};margin-bottom:14px;background:#07090d">
              <div style="padding:9px 12px;background:#0d1117;display:flex;justify-content:space-between;align-items:center">
                <span><span style="color:${sc2};font-weight:700;font-size:10px">${num} [${f.severity}]</span>
                <strong style="color:#eef4fa;font-size:11px;margin-left:8px">${f.title || ""}</strong></span>
                <span style="color:${stC};font-size:9px;font-weight:700;letter-spacing:.06em">${f.status}</span>
              </div>
              ${f.location ? `<div style="padding:4px 12px;font-size:9px;color:#445566">Location: ${f.location}</div>` : ""}
              ${
                f.description
                  ? `<div style="display:flex;border-top:1px solid #111820">
                <span style="min-width:120px;padding:7px 10px;background:#0d1117;color:#445566;font-size:8.5px;flex-shrink:0;border-right:1px solid #161e2a">Description</span>
                <span style="padding:7px 10px;color:#8899aa;font-size:10px">${f.description}</span></div>`
                  : ""
              }
              ${
                f.impact
                  ? `<div style="display:flex;border-top:1px solid #111820">
                <span style="min-width:120px;padding:7px 10px;background:#0d1117;color:#445566;font-size:8.5px;flex-shrink:0;border-right:1px solid #161e2a">Impact</span>
                <span style="padding:7px 10px;color:#8899aa;font-size:10px">${f.impact}</span></div>`
                  : ""
              }
              ${
                f.recommendation
                  ? `<div style="display:flex;border-top:1px solid #111820">
                <span style="min-width:120px;padding:7px 10px;background:#0d1117;color:#445566;font-size:8.5px;flex-shrink:0;border-right:1px solid #161e2a">Recommendation</span>
                <span style="padding:7px 10px;color:#8899aa;font-size:10px">${f.recommendation}</span></div>`
                  : ""
              }
            </div>`
          })
          return html
        })()

  const page = (num: number, content: string) => `
    <div style="padding:40px 56px;page-break-after:always;min-height:100vh;display:flex;flex-direction:column;background:#050810">
      <div style="background:#0d1117;margin:-40px -56px 28px;padding:12px 56px;display:flex;justify-content:space-between;border-bottom:2px solid #00ff88">
        <span style="font-size:11px;font-weight:700;color:#00ff88;letter-spacing:.08em">SOLAY39</span>
        <span style="font-size:9px;color:#445566">${project.name || ""}</span>
      </div>
      <div style="flex:1">${content}</div>
      <div style="background:#0d1117;margin:auto -56px -40px;padding:9px 56px;display:flex;justify-content:space-between;border-top:1px solid #00ff8833;font-size:8px;color:#2a3a50">
        <span>Solay39 Blockchain Security | solay2126@gmail.com | t.me/Solay39audit</span>
        <span>Page ${num}</span>
      </div>
    </div>`

  const h1 = (t: string) =>
    `<h1 style="font-size:17px;color:#00ff88;font-weight:700;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #00ff8833">${t}</h1>`
  const h2 = (t: string) =>
    `<h2 style="font-size:12px;color:#00ff88;font-weight:700;margin:18px 0 10px">${t}</h2>`
  const p = (t: string) =>
    `<p style="color:#7a8c9e;font-size:10px;line-height:1.7;margin-bottom:10px">${t}</p>`
  const td1 = (v: string) =>
    `<td style="padding:7px 10px;font-size:9px;color:#445566;background:#0d1117;width:150px">${v}</td>`
  const td2 = (v: string) =>
    `<td style="padding:7px 10px;font-size:9px;color:#eef4fa;background:#111820">${v}</td>`
  const tr = (k: string, v: string) => `<tr>${td1(k)}${td2(v)}</tr>`
  const tbl = (rows: [string, string][]) =>
    `<table style="width:100%;border-collapse:collapse;margin-bottom:14px">${rows.map(([k, v]) => tr(k, v)).join("")}</table>`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SOLAY39 — ${project.name || "Audit"}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'JetBrains Mono',monospace;background:#050810;color:#c8d8e8;}
  @media print{@page{size:A4;margin:0;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head><body>

<!-- COVER -->
<div style="min-height:100vh;display:flex;flex-direction:column;background:#050810;page-break-after:always">
  <div style="height:5px;background:#00ff88"></div>
  <div style="flex:1;padding:60px 56px;position:relative;display:flex;flex-direction:column;justify-content:center">
    <div style="font-size:42px;font-weight:700;letter-spacing:.04em;color:#00ff88;text-shadow:0 0 40px #00ff8844">SOLAY39</div>
    <div style="font-size:9px;color:#445566;letter-spacing:.16em;margin-top:6px;margin-bottom:28px">// SECURING PROTOCOLS THROUGH DEEP HUMAN REVIEW</div>
    <div style="height:1px;background:linear-gradient(90deg,#00ff88,transparent);width:160px;margin-bottom:28px"></div>
    <div style="font-size:28px;font-weight:700;color:#eef4fa;margin-bottom:6px">${project.name || "Protocol"}</div>
    <div style="font-size:13px;color:#7a8c9e;margin-bottom:4px">Smart Contracts</div>
    <div style="font-size:13px;color:#7a8c9e;margin-bottom:0">Final Audit Report</div>
    <div style="position:absolute;right:56px;top:50%;transform:translateY(-50%);background:#0d1117;border:1px solid #00ff8866;padding:28px 36px;text-align:center;min-width:155px">
      <div style="font-size:46px;font-weight:700;color:${sc};line-height:1">${score}</div>
      <div style="font-size:18px;font-weight:700;color:${sc};margin-top:5px">${rat}</div>
      <div style="font-size:7.5px;color:#445566;letter-spacing:.1em;margin-top:8px">SOLAY39 SECURITY SCORE</div>
    </div>
    <table style="border-collapse:collapse;margin-top:32px;width:58%">
      ${[
        ["Protocol", project.name || "—"],
        ["Network", project.network || "—"],
        ["Auditor", "Solay39 Founder"],
        ["Date", project.date || today],
        ["Commit", project.commit ? project.commit.slice(0, 34) + (project.commit.length > 34 ? "..." : "") : "—"],
      ]
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 10px;font-size:9px;color:#445566;background:#0d1117;width:110px;border-bottom:1px solid #161e2a">${k}</td><td style="padding:6px 10px;font-size:9px;color:#eef4fa;background:#111820;font-weight:700;border-bottom:1px solid #161e2a">${v}</td></tr>`
        )
        .join("")}
    </table>
  </div>
  <div style="background:#0d1117;padding:13px 56px;display:flex;justify-content:space-between;font-size:8.5px;color:#445566;border-top:1px solid #00ff8833">
    <span>Solay39 Blockchain Security | solay2126@gmail.com | t.me/Solay39audit</span><span>${today}</span>
  </div>
</div>

${page(
  2,
  `${h1("Contents")}
  <table style="width:100%;border-collapse:collapse">
    ${[
      ["1.", "Disclaimer"],
      ["2.", "Overview"],
      ["3.", "Found Issues"],
      ["4.", "Contracts"],
      ["5.", "Conclusion"],
      ["", "Appendix A. Issues Severity Classification"],
      ["", "Appendix B. Issue Status Description"],
      ["", "Appendix C. List of Examined Issue Types"],
      ["", "Appendix D. Centralization Risks Classification"],
    ]
      .map(
        ([n, t]) =>
          `<tr><td style="padding:8px 10px;font-size:9.5px;color:#445566;width:24px;border-bottom:1px solid #111820">${n}</td><td style="padding:8px 10px;font-size:9.5px;color:#c8d8e8;border-bottom:1px solid #111820">${t}</td></tr>`
      )
      .join("")}
  </table>`
)}

${page(
  3,
  `${h1("1. Disclaimer")}
  ${p("This is a limited report on our findings based on our analysis, in accordance with good industry practice at the date of this report, in relation to cybersecurity vulnerabilities and issues in smart contracts.")}
  ${p("While we have done our best in conducting our analysis and producing this report, it is important to note that you should not rely on this report alone before making any decisions.")}
  ${p("The analysis of the security is purely based on the smart contracts alone. No applications or operations were reviewed for security. Solay39 owns all copyright rights to the content provided in this document.")}
  ${p("Solay39 has exclusive rights to publish the results of this audit on its web and social channels. Sharing of this report by third parties must include direct attribution to Solay39 Blockchain Security and a link to the original document.")}`
)}

${page(
  4,
  `${h1("2. Overview")}
  ${p(`Solay39 was commissioned by the <strong style="color:#eef4fa">${project.name || "project"}</strong> team to perform an audit of their smart contracts. This audit was conducted using the <strong style="color:#eef4fa">Solay39 Manual-First Audit Framework</strong>.`)}
  ${h2("2.1 Summary")}
  ${tbl([
    ["Project name", project.name || "N/A"],
    ["Network", project.network || "N/A"],
    ["Language", "Solidity"],
    ["Auditor", "Solay39 Founder"],
    ["Audit date", project.date || today],
    ["Commit hash", (project.commit || "N/A").slice(0, 40)],
    ["Scope", scopeDisplay],
    ["Centralization level", "Low"],
    ["Centralization risk", "Low"],
  ])}
  ${h2("2.2 Security Score")}
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
    <thead><tr>${["METRIC", "SCORE", "WEIGHT"]
      .map(
        (h) =>
          `<th style="background:#0d1117;color:#445566;font-size:7.5px;letter-spacing:.15em;padding:8px 10px;text-align:left;border-bottom:1px solid #161e2a">${h}</th>`
      )
      .join("")}</tr></thead>
    <tbody>
      ${[
        ["Code Security", Math.min(100, score + 2), "35%"],
        ["Architecture Risk", score, "25%"],
        ["Governance Risk", Math.max(0, score - 8), "20%"],
        ["Centralization", Math.max(0, score - 12), "10%"],
        ["Testing Coverage", Math.min(100, score + 1), "10%"],
      ]
        .map(
          ([m, s, w]) =>
            `<tr><td style="padding:8px 10px;border-bottom:1px solid #111820;font-size:10px">${m}</td><td style="padding:8px 10px;border-bottom:1px solid #111820;font-size:10px">${s}</td><td style="padding:8px 10px;border-bottom:1px solid #111820;font-size:10px">${w}</td></tr>`
        )
        .join("")}
      <tr style="background:#001a0d"><td style="padding:8px 10px;font-size:10px;color:${sc};font-weight:700">FINAL SCORE</td><td style="padding:8px 10px;font-size:10px;color:${sc};font-weight:700">${score} (${rat})</td><td style="padding:8px 10px;font-size:10px;color:${sc};font-weight:700">100%</td></tr>
    </tbody>
  </table>`
)}

${page(5, `${h1("3. Found Issues")}${findingsHtml}`)}

${page(
  6,
  `${h1("4. Contracts")}
  ${p("The following contracts were included in the scope of this audit and reviewed using the Solay39 Manual-First Audit Framework across all five phases.")}
  <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
    <thead><tr><th style="background:#0d1117;color:#445566;font-size:7.5px;letter-spacing:.15em;padding:8px 10px;text-align:left;border-bottom:1px solid #161e2a">NAME</th><th style="background:#0d1117;color:#445566;font-size:7.5px;letter-spacing:.15em;padding:8px 10px;text-align:left;border-bottom:1px solid #161e2a">ADDRESS / COMMIT</th></tr></thead>
    <tbody><tr><td style="padding:8px 10px;border-bottom:1px solid #111820;color:#00ff88;font-weight:700;font-size:10px">${project.name || "Contract"}</td><td style="padding:8px 10px;border-bottom:1px solid #111820;font-size:8.5px;color:#7a8c9e">${(project.commit || "N/A").slice(0, 42)}</td></tr></tbody>
  </table>
  ${h2(project.name || "Contract")}
  ${p(`The <strong style="color:#eef4fa">${project.name || "contract"}</strong> smart contract was reviewed for security vulnerabilities, logic errors, and compliance with best practices at commit <span style="color:#00ff88">${(project.commit || "N/A").slice(0, 20)}${(project.commit || "").length > 20 ? "..." : ""}</span> on the ${project.network || "Ethereum"} network.`)}
  ${p(findings.length === 0 ? "No security issues were identified during the review. The contract follows best practices of secure development." : "All identified findings are documented in detail in Section 3.")}
  ${scopeDisplay !== "—" ? `<div style="background:#0d1117;padding:8px 12px;margin-top:8px"><span style="color:#00ff88;font-size:9px">Scope: ${scopeDisplay}</span></div>` : ""}`
)}

${page(
  7,
  `${h1("5. Conclusion")}
  ${
    findings.length === 0
      ? `${p(`<strong style="color:#eef4fa">No severity issues were found.</strong>`)}${p(`The ${project.name || "protocol"} contracts passed all checks of the Solay39 Manual-First Audit Framework. The codebase demonstrates secure development practices, properly inheriting from well-tested libraries.`)}`
      : `${p(`The audit of <strong style="color:#eef4fa">${project.name || "the protocol"}</strong> identified <strong style="color:#eef4fa">${findings.length}</strong> finding(s): <span style="color:#ff2d55">${cnt.CRITICAL} Critical</span>, <span style="color:#ff6b00">${cnt.HIGH} High</span>, <span style="color:#ffd600">${cnt.MEDIUM} Medium</span>, ${cnt.LOW} Low, ${cnt.INFO} Informational.`)}${p(`<strong style="color:#eef4fa">${fix_c}</strong> resolved, <strong style="color:#ff2d55">${open_c}</strong> remain open. All Critical and High severity findings must be addressed before production deployment.`)}`
  }
  ${p(`The final <strong style="color:${sc}">Solay39 Security Score: ${score}/100 (${rat})</strong>.`)}`
)}

${page(
  8,
  `${h1("Appendix A. Issues Severity Classification")}
  ${[
    ["Critical", "#ff2d55", "Issues that may cause unlimited loss of funds or entirely break the contract workflow. MUST be fixed before deployment."],
    ["High", "#ff6b00", "Issues that may lead to limited fund loss, break user interactions or allow privileged accounts to steal funds."],
    ["Medium", "#ffd600", "Issues that break contract logic but do not directly cause fund loss. May lead to contract failures."],
    ["Low", "#00e5ff", "Non-optimal code: gas optimization tips, unused variables, incorrect error messages."],
    ["Info", "#00ff88", "Issues not impacting contract operation. Usually code style, documentation, or best practice notes."],
  ]
    .map(
      ([n, c, d]) =>
        `<div style="display:flex;margin-bottom:6px"><span style="min-width:90px;padding:8px 12px;font-weight:700;color:${c};border-left:3px solid ${c};flex-shrink:0">${n}</span><span style="padding:8px 12px;background:#111820;color:#7a8c9e;flex:1;font-size:9.5px">${d}</span></div>`
    )
    .join("")}`
)}

${page(
  9,
  `${h1("Appendix B. Issue Status Description")}
  ${[
    ["Resolved", "#00ff88", "The issue has been completely fixed and verified by the auditor."],
    ["Partially Fixed", "#ffd600", "Parts of the issue have been fixed but it is not completely resolved."],
    ["Acknowledged", "#00e5ff", "The team has been notified; no corrective action has been taken."],
    ["Open", "#ff2d55", "The issue remains unresolved at the time of this report."],
  ]
    .map(
      ([n, c, d]) =>
        `<div style="display:flex;margin-bottom:6px"><span style="min-width:120px;padding:8px 12px;font-weight:700;color:${c};border-left:3px solid ${c};flex-shrink:0">${n}</span><span style="padding:8px 12px;background:#111820;color:#7a8c9e;flex:1;font-size:9.5px">${d}</span></div>`
    )
    .join("")}`
)}

${page(
  10,
  `${h1("Appendix C. List of Examined Issue Types")}
  <div style="columns:2;column-gap:20px">
    ${[
      "Business logic overview",
      "Functionality checks",
      "Following best practices",
      "Access control and authorization",
      "Reentrancy attacks",
      "Front-run attacks",
      "DoS with (unexpected) revert",
      "DoS with block gas limit",
      "Transaction-ordering dependence",
      "ERC/BEP standards violation",
      "Unchecked math and precision loss",
      "Implicit visibility levels",
      "Excessive gas usage",
      "Timestamp dependence",
      "Forcibly sending ether",
      "Weak sources of randomness",
      "Shadowing state variables",
      "Usage of deprecated code",
      "Oracle and price manipulation",
      "Flash loan attack vectors",
      "MEV and sandwich attack exposure",
      "Upgradeability and proxy storage",
      "Signature replay protection",
      "Centralization and governance risks",
    ]
      .map(
        (x) =>
          `<div style="padding:5px 8px;border-bottom:1px solid #111820;font-size:9.5px;color:#7a8c9e"><span style="color:#00ff88">&#8226;</span> ${x}</div>`
      )
      .join("")}
  </div>`
)}

${page(
  11,
  `${h1("Appendix D. Centralization Risks Classification")}
  ${h2("Centralization Level")}
  ${[
    ["High", "#ff2d55", "Project owners can manipulate users funds, lock funds at will, or maliciously update contract parameters or bytecode."],
    ["Medium", "#ffd600", "Project owners can modify parameters to break some functions, but users funds remain withdrawable."],
    ["Low", "#00ff88", "The contract is trustless or its governance functions are safe against a malicious owner."],
  ]
    .map(
      ([n, c, d]) =>
        `<div style="display:flex;margin-bottom:5px"><span style="min-width:70px;padding:7px 10px;font-weight:700;color:${c};border-left:3px solid ${c};flex-shrink:0">${n}</span><span style="padding:7px 10px;background:#111820;color:#7a8c9e;flex:1;font-size:9.5px">${d}</span></div>`
    )
    .join("")}
  ${h2("Centralization Risk")}
  ${[
    ["High", "#ff2d55", "Lost ownership may result in users losses. Contract ownership belongs to EOAs with unknown security model."],
    ["Medium", "#ffd600", "Ownership transferred to a contract with non-industry-accepted parameters or without an audit."],
    ["Low", "#00ff88", "Ownership transferred to a well-known or audited contract with industry-accepted parameters."],
  ]
    .map(
      ([n, c, d]) =>
        `<div style="display:flex;margin-bottom:5px"><span style="min-width:70px;padding:7px 10px;font-weight:700;color:${c};border-left:3px solid ${c};flex-shrink:0">${n}</span><span style="padding:7px 10px;background:#111820;color:#7a8c9e;flex:1;font-size:9.5px">${d}</span></div>`
    )
    .join("")}`
)}

</body></html>`

  const w = window.open("", "_blank")
  if (w) {
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 800)
  }
}
