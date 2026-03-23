import { jsPDF } from "jspdf"
import type { AuditProject, Finding, PrivilegedRole, TrustAssumption, AttackScenario } from "@/lib/solay39-constants"
import { ratingOf } from "@/lib/solay39-constants"

interface Tier1Data {
  privilegedRoles?: PrivilegedRole[]
  trustAssumptions?: TrustAssumption[]
  architectureOverview?: string
  attackSurface?: AttackScenario[]
  toolingUsed?: string[]
  onChainValidation?: { label: string; status: "pass" | "fail" | "n/a"; detail?: string }[]
  governanceSecurity?: Record<string, unknown>
  upgradeabilityAnalysis?: Record<string, unknown>
  economicRisks?: { title: string; description: string; severity: string }[]
  integrationRisks?: { title: string; description: string; severity: string }[]
  invariantsChecked?: { name: string; status: "verified" | "violated" | "untested"; detail?: string }[]
  testingMethodology?: Record<string, unknown>
  engagement?: Record<string, unknown>
  scopeTable?: { file: string; sha256?: string; sloc?: number }[]
  riskModel?: Record<string, unknown>
  auditorProfile?: Record<string, unknown>
  limitations?: Record<string, unknown>
  manualReview?: {
    completedAt?: string
    auditorWalletEth?: string
    checksCompleted?: string
    findingsConfirmed?: number
    findingsRejected?: number
    manualFindingsAdded?: number
    signatureEth?: string
    reviewNotes?: string
  }
  securityChecklist?: {
    id: string
    category: string
    question: string
    severity: string
    status: "pass" | "fail" | "pending" | "n/a"
    note?: string
  }[]
  onChainAnalysis?: {
    executiveSummary?: string
    tokenEconomics?: string
    whaleDistribution?: string
    rugPullRisk?: string
    recommendation?: string
    overallRiskScore?: number
  }
}

const SEV_COLORS: Record<string, [number, number, number]> = {
  CRITICAL: [255, 45, 85],
  HIGH: [255, 107, 0],
  MEDIUM: [255, 214, 0],
  LOW: [0, 255, 136],
  INFO: [68, 85, 102],
}

/**
 * Generates a complete professional PDF audit report
 */
export function generatePDFBase64(
  project: AuditProject,
  rawScore: number,
  findings: Finding[],
  tier1?: Tier1Data
): string {
  try {
    console.log("[v0] generatePDFBase64 called for:", project.name)
    console.log("[v0] tier1 data received:", {
      hasPrivilegedRoles: tier1?.privilegedRoles?.length || 0,
      hasTrustAssumptions: tier1?.trustAssumptions?.length || 0,
      hasArchitecture: !!tier1?.architectureOverview,
      hasAttackSurface: tier1?.attackSurface?.length || 0,
      hasTooling: tier1?.toolingUsed?.length || 0,
      hasSecurityChecklist: tier1?.securityChecklist?.length || 0,
      hasOnChainAnalysis: !!tier1?.onChainAnalysis,
      hasManualReview: !!tier1?.manualReview,
    })
    const score = Math.min(rawScore, 98)
    const rating = ratingOf(score)
    const today = new Date().toISOString().slice(0, 10)
    
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })
    
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    let y = margin
    
    // Helper functions
    const setColor = (r: number, g: number, b: number) => doc.setTextColor(r, g, b)
    
    const addText = (text: string, x: number, yPos: number, opts?: { size?: number; bold?: boolean; color?: [number, number, number] }) => {
      const { size = 10, bold = false, color = [208, 216, 224] } = opts || {}
      doc.setFontSize(size)
      doc.setFont("helvetica", bold ? "bold" : "normal")
      setColor(color[0], color[1], color[2])
      doc.text(text, x, yPos)
    }
    
    const addLine = (yPos: number, c: [number, number, number] = [22, 30, 42]) => {
      doc.setDrawColor(c[0], c[1], c[2])
      doc.line(margin, yPos, pageWidth - margin, yPos)
    }
    
    const checkPage = (needed: number = 40) => {
      if (y > pageHeight - needed) {
        doc.addPage()
        doc.setFillColor(5, 8, 16)
        doc.rect(0, 0, pageWidth, pageHeight, "F")
        y = margin
        return true
      }
      return false
    }
    
    const addSection = (title: string) => {
      checkPage(50)
      y += 8
      addText(title, margin, y, { size: 12, bold: true, color: [0, 255, 136] })
      y += 8
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PAGE 1: Cover / Executive Summary
    // ═══════════════════════════════════════════════════════════════
    doc.setFillColor(5, 8, 16)
    doc.rect(0, 0, pageWidth, pageHeight, "F")
    
    // Header
    addText("SOLAY39", margin, y, { size: 18, bold: true, color: [0, 255, 136] })
    addText("SKYNET", margin + 40, y, { size: 12, color: [68, 85, 102] })
    addText(today, pageWidth - margin - 25, y, { size: 9, color: [68, 85, 102] })
    y += 5
    addText("SMART CONTRACT SECURITY AUDIT", pageWidth - margin - 55, y, { size: 8, color: [68, 85, 102] })
    y += 10
    addLine(y)
    y += 15
    
    // Project Title
    addText(project.name, margin, y, { size: 22, bold: true, color: [238, 244, 250] })
    y += 8
    addText("SECURITY AUDIT REPORT", margin, y, { size: 10, color: [0, 255, 136] })
    y += 15
    
    // Score Box
    const scoreColor: [number, number, number] = score >= 90 ? [0, 255, 136] : score >= 70 ? [255, 214, 0] : [255, 107, 0]
    doc.setFillColor(13, 17, 23)
    doc.setDrawColor(22, 30, 42)
    doc.rect(margin, y, 45, 35, "FD")
    addText(String(score), margin + 13, y + 18, { size: 28, bold: true, color: scoreColor })
    addText("SOLAY39 SCORE", margin + 5, y + 25, { size: 7, color: [68, 85, 102] })
    addText(rating, margin + 17, y + 32, { size: 11, bold: true, color: scoreColor })
    
    // Project Info Box
    doc.setFillColor(13, 17, 23)
    doc.rect(margin + 50, y, pageWidth - margin * 2 - 50, 35, "FD")
    const ix = margin + 55
    addText("Network:", ix, y + 10, { size: 8, color: [68, 85, 102] })
    addText(project.network || "—", ix + 20, y + 10, { size: 8 })
    addText("Date:", ix + 60, y + 10, { size: 8, color: [68, 85, 102] })
    addText(project.date || today, ix + 75, y + 10, { size: 8 })
    addText("Commit:", ix, y + 18, { size: 8, color: [68, 85, 102] })
    addText(project.commit?.slice(0, 8) || "—", ix + 20, y + 18, { size: 8, color: [0, 255, 136] })
    addText("Scope:", ix, y + 26, { size: 8, color: [68, 85, 102] })
    addText((project.scope?.split("\n")[0] || "—").slice(0, 50), ix + 20, y + 26, { size: 8 })
    y += 45
    
    // Severity Summary
    const sevs: Array<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"> = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
    const boxW = (pageWidth - margin * 2 - 16) / 5
    sevs.forEach((sev, i) => {
      const cnt = findings.filter(f => f.severity === sev).length
      const bx = margin + i * (boxW + 4)
      doc.setFillColor(13, 17, 23)
      doc.rect(bx, y, boxW, 20, "FD")
      addText(String(cnt), bx + boxW / 2 - 3, y + 10, { size: 14, bold: true, color: SEV_COLORS[sev] })
      addText(sev, bx + boxW / 2 - sev.length * 1.3, y + 17, { size: 6, color: [68, 85, 102] })
    })
    y += 30
    
    // Executive Summary
    addSection("1. EXECUTIVE SUMMARY")
    const execSum = tier1?.onChainAnalysis?.executiveSummary || 
      `This security audit was conducted on ${project.name} deployed on ${project.network || "Ethereum"}. ` +
      `The audit identified ${findings.length} findings across various severity levels. ` +
      `The overall security score is ${score}/100 (${rating}).`
    const execLines = doc.splitTextToSize(execSum, pageWidth - margin * 2)
    doc.setFontSize(9)
    setColor(136, 153, 170)
    doc.text(execLines.slice(0, 6), margin, y)
    y += Math.min(execLines.length, 6) * 4 + 5
    
    // ═══════════��═══════════════════════════════════════════════════
    // FINDINGS SUMMARY
    // ═══════════════════════════════════════════════════════════════
    addSection("2. FINDINGS SUMMARY")
    
    // Table header
    addText("SEVERITY", margin, y, { size: 7, color: [68, 85, 102] })
    addText("COUNT", margin + 30, y, { size: 7, color: [68, 85, 102] })
    addText("OPEN", margin + 50, y, { size: 7, color: [68, 85, 102] })
    addText("RESOLVED", margin + 70, y, { size: 7, color: [68, 85, 102] })
    addText("ACKNOWLEDGED", margin + 95, y, { size: 7, color: [68, 85, 102] })
    y += 3
    addLine(y)
    y += 5
    
    sevs.forEach(sev => {
      const all = findings.filter(f => f.severity === sev)
      if (all.length > 0) {
        addText(sev, margin, y, { size: 8, bold: true, color: SEV_COLORS[sev] })
        addText(String(all.length), margin + 35, y, { size: 8 })
        addText(String(all.filter(f => f.status === "OPEN").length), margin + 53, y, { size: 8 })
        addText(String(all.filter(f => f.status === "RESOLVED").length), margin + 78, y, { size: 8 })
        addText(String(all.filter(f => f.status === "ACKNOWLEDGED").length), margin + 105, y, { size: 8 })
        y += 6
      }
    })
    y += 5
    
    // ═══════════════════════════════════════════════════════════════
    // FINDING DETAILS
    // ═══════════════════════════════════════════════════════════════
    addSection("3. FINDING DETAILS")
    
    if (findings.length === 0) {
      doc.setFillColor(0, 26, 13)
      doc.rect(margin, y, pageWidth - margin * 2, 15, "F")
      addText("No Issues Found", margin + 5, y + 8, { size: 10, bold: true, color: [0, 255, 136] })
      y += 20
    } else {
      const sevPfx: Record<string, string> = { CRITICAL: "C", HIGH: "H", MEDIUM: "M", LOW: "L", INFO: "I" }
      const sevCounts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 }
      
      findings.forEach(f => {
        checkPage(45)
        sevCounts[f.severity]++
        const num = `${sevPfx[f.severity]}-${String(sevCounts[f.severity]).padStart(2, "0")}`
        const sc = SEV_COLORS[f.severity]
        const stC: [number, number, number] = f.status === "RESOLVED" ? [0, 255, 136] : f.status === "ACKNOWLEDGED" ? [255, 214, 0] : [255, 45, 85]
        
        // Header bar
        doc.setFillColor(13, 17, 23)
        doc.rect(margin, y, pageWidth - margin * 2, 8, "F")
        doc.setDrawColor(sc[0], sc[1], sc[2])
        doc.line(margin, y, margin, y + 8)
        
        addText(`${num} [${f.severity}]`, margin + 2, y + 5, { size: 8, bold: true, color: sc })
        addText((f.title || "").slice(0, 50), margin + 30, y + 5, { size: 8, bold: true, color: [238, 244, 250] })
        addText(f.status, pageWidth - margin - 18, y + 5, { size: 7, bold: true, color: stC })
        y += 10
        
        if (f.description) {
          const dl = doc.splitTextToSize(f.description, pageWidth - margin * 2 - 25)
          addText("Description:", margin + 2, y, { size: 7, color: [68, 85, 102] })
          doc.setFontSize(7)
          setColor(136, 153, 170)
          doc.text(dl.slice(0, 3), margin + 25, y)
          y += Math.min(dl.length, 3) * 3 + 2
        }
        
        if (f.impact) {
          const il = doc.splitTextToSize(f.impact, pageWidth - margin * 2 - 25)
          addText("Impact:", margin + 2, y, { size: 7, color: [68, 85, 102] })
          doc.setFontSize(7)
          setColor(136, 153, 170)
          doc.text(il.slice(0, 2), margin + 25, y)
          y += Math.min(il.length, 2) * 3 + 2
        }
        
        if (f.recommendation) {
          const rl = doc.splitTextToSize(f.recommendation, pageWidth - margin * 2 - 30)
          addText("Recommendation:", margin + 2, y, { size: 7, color: [68, 85, 102] })
          doc.setFontSize(7)
          setColor(136, 153, 170)
          doc.text(rl.slice(0, 2), margin + 30, y)
          y += Math.min(rl.length, 2) * 3 + 2
        }
        
        y += 5
      })
    }
    
    // ═══════════════════════════════════════════════════════════════
    // SCOPE & METHODOLOGY
    // ═══════════════════════════════════════════════════════════════
    checkPage(60)
    addSection("4. SCOPE & METHODOLOGY")
    
    if (tier1?.scopeTable && tier1.scopeTable.length > 0) {
      addText("FILES IN SCOPE", margin, y, { size: 8, bold: true, color: [68, 85, 102] })
      y += 5
      tier1.scopeTable.slice(0, 8).forEach(s => {
        addText(`• ${s.file}`, margin + 2, y, { size: 7 })
        if (s.sloc) addText(`${s.sloc} SLOC`, margin + 100, y, { size: 7, color: [68, 85, 102] })
        y += 4
      })
      y += 3
    }
    
    if (tier1?.toolingUsed && tier1.toolingUsed.length > 0) {
      checkPage(50)
      addText("TOOLS APPLIED", margin, y, { size: 8, bold: true, color: [68, 85, 102] })
      y += 5
      tier1.toolingUsed.forEach(tool => {
        checkPage(8)
        addText("[APPLIED]", margin + 2, y, { size: 7, bold: true, color: [0, 255, 136] })
        addText(tool, margin + 22, y, { size: 7 })
        y += 4
      })
      y += 3
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PRIVILEGED ROLES
    // ═══════════════════════════════════════════════════════════════
    if (tier1?.privilegedRoles && tier1.privilegedRoles.length > 0) {
      checkPage(50)
      addSection("5. PRIVILEGED ROLES & ACCESS CONTROL")
      tier1.privilegedRoles.forEach(r => {
        checkPage(20)
        addText(`• ${r.role}`, margin + 2, y, { size: 8, bold: true, color: [238, 244, 250] })
        y += 4
        if (r.permissions) {
          const pl = doc.splitTextToSize(r.permissions.join(", "), pageWidth - margin * 2 - 10)
          doc.setFontSize(7)
          setColor(136, 153, 170)
          doc.text(pl.slice(0, 2), margin + 5, y)
          y += Math.min(pl.length, 2) * 3 + 2
        }
      })
    }
    
    // ═══════════════════════════════════════════════════════════════
    // TRUST ASSUMPTIONS
    // ═══════════════════════════════════════════════════════════════
    if (tier1?.trustAssumptions && tier1.trustAssumptions.length > 0) {
      checkPage(50)
      addSection("6. TRUST ASSUMPTIONS")
      tier1.trustAssumptions.forEach(t => {
        checkPage(15)
        addText(`• ${t.title}`, margin + 2, y, { size: 8, bold: true, color: [238, 244, 250] })
        y += 4
        if (t.description) {
          const tl = doc.splitTextToSize(t.description, pageWidth - margin * 2 - 10)
          doc.setFontSize(7)
          setColor(136, 153, 170)
          doc.text(tl.slice(0, 2), margin + 5, y)
          y += Math.min(tl.length, 2) * 3 + 2
        }
      })
    }
    
    // ═══════════════════════════════════════════════════════════════
    // SECURITY CHECKLIST
    // ═══════════════════════════════════════════════════════════════
    if (tier1?.securityChecklist && tier1.securityChecklist.length > 0) {
      checkPage(60)
      addSection("7. SECURITY CHECKLIST")
      const passed = tier1.securityChecklist.filter(c => c.status === "pass").length
      const failed = tier1.securityChecklist.filter(c => c.status === "fail").length
      const total = tier1.securityChecklist.length
      
      addText(`${passed}/${total} checks passed`, margin, y, { size: 9, color: [0, 255, 136] })
      if (failed > 0) addText(`${failed} failed`, margin + 50, y, { size: 9, color: [255, 45, 85] })
      y += 8
      
      // Group by category - show ALL categories and ALL checks
      const cats = [...new Set(tier1.securityChecklist.map(c => c.category))]
      cats.forEach(cat => {
        checkPage(30)
        addText(cat.toUpperCase(), margin, y, { size: 8, bold: true, color: [68, 85, 102] })
        y += 5
        tier1.securityChecklist?.filter(c => c.category === cat).forEach(c => {
          checkPage(10)
          const stColor: [number, number, number] = c.status === "pass" ? [0, 255, 136] : c.status === "fail" ? [255, 45, 85] : [255, 214, 0]
          addText(c.status === "pass" ? "[PASS]" : c.status === "fail" ? "[FAIL]" : "[N/A]", margin + 2, y, { size: 7, bold: true, color: stColor })
          addText(c.question.slice(0, 80), margin + 18, y, { size: 7 })
          y += 4
        })
        y += 3
      })
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ON-CHAIN ANALYSIS
    // ═══════════════════════════════════════════════════════════════
    if (tier1?.onChainAnalysis) {
      checkPage(80)
      addSection("8. ON-CHAIN AI ANALYSIS")
      
      if (tier1.onChainAnalysis.overallRiskScore !== undefined) {
        const riskColor: [number, number, number] = tier1.onChainAnalysis.overallRiskScore <= 30 ? [0, 255, 136] : tier1.onChainAnalysis.overallRiskScore <= 60 ? [255, 214, 0] : [255, 45, 85]
        addText(`Risk Score: ${tier1.onChainAnalysis.overallRiskScore}/100`, margin, y, { size: 10, bold: true, color: riskColor })
        y += 8
      }
      
      if (tier1.onChainAnalysis.executiveSummary) {
        addText("Executive Summary:", margin, y, { size: 8, bold: true, color: [68, 85, 102] })
        y += 4
        const esl = doc.splitTextToSize(tier1.onChainAnalysis.executiveSummary, pageWidth - margin * 2)
        doc.setFontSize(7)
        setColor(136, 153, 170)
        doc.text(esl.slice(0, 5), margin + 2, y)
        y += Math.min(esl.length, 5) * 3 + 4
      }
      
      if (tier1.onChainAnalysis.tokenEconomics) {
        checkPage(40)
        addText("Token Economics:", margin, y, { size: 8, bold: true, color: [68, 85, 102] })
        y += 4
        const tel = doc.splitTextToSize(tier1.onChainAnalysis.tokenEconomics, pageWidth - margin * 2)
        doc.setFontSize(7)
        setColor(136, 153, 170)
        doc.text(tel.slice(0, 6), margin + 2, y)
        y += Math.min(tel.length, 6) * 3 + 4
      }
      
      if (tier1.onChainAnalysis.whaleDistribution) {
        checkPage(40)
        addText("Whale Distribution:", margin, y, { size: 8, bold: true, color: [68, 85, 102] })
        y += 4
        const wdl = doc.splitTextToSize(tier1.onChainAnalysis.whaleDistribution, pageWidth - margin * 2)
        doc.setFontSize(7)
        setColor(136, 153, 170)
        doc.text(wdl.slice(0, 5), margin + 2, y)
        y += Math.min(wdl.length, 5) * 3 + 4
      }
      
      if (tier1.onChainAnalysis.rugPullRisk) {
        checkPage(40)
        addText("Rug Pull Risk Assessment:", margin, y, { size: 8, bold: true, color: [255, 107, 0] })
        y += 4
        const rpl = doc.splitTextToSize(tier1.onChainAnalysis.rugPullRisk, pageWidth - margin * 2)
        doc.setFontSize(7)
        setColor(136, 153, 170)
        doc.text(rpl.slice(0, 6), margin + 2, y)
        y += Math.min(rpl.length, 6) * 3 + 4
      }
      
      if (tier1.onChainAnalysis.recommendation) {
        checkPage(40)
        addText("Recommendation:", margin, y, { size: 8, bold: true, color: [0, 255, 136] })
        y += 4
        const rcl = doc.splitTextToSize(tier1.onChainAnalysis.recommendation, pageWidth - margin * 2)
        doc.setFontSize(7)
        setColor(136, 153, 170)
        doc.text(rcl.slice(0, 5), margin + 2, y)
        y += Math.min(rcl.length, 5) * 3 + 4
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ARCHITECTURE OVERVIEW
    // ═══════════════════════════════════════════════════════════════
    if (tier1?.architectureOverview) {
      checkPage(50)
      addSection("10. SYSTEM ARCHITECTURE")
      const aol = doc.splitTextToSize(tier1.architectureOverview, pageWidth - margin * 2)
      doc.setFontSize(8)
      setColor(136, 153, 170)
      doc.text(aol.slice(0, 10), margin, y)
      y += Math.min(aol.length, 10) * 4 + 5
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ATTACK SURFACE
    // ═══════════════════════════════════════════════════════════════
    if (tier1?.attackSurface && tier1.attackSurface.length > 0) {
      checkPage(50)
      addSection("11. ATTACK SURFACE ANALYSIS")
      tier1.attackSurface.slice(0, 5).forEach(a => {
        const sevC = SEV_COLORS[a.severity as keyof typeof SEV_COLORS] || [136, 153, 170]
        addText(`• ${a.title || a.name}`, margin + 2, y, { size: 8, bold: true, color: sevC })
        y += 4
        if (a.description) {
          const adl = doc.splitTextToSize(a.description, pageWidth - margin * 2 - 5)
          doc.setFontSize(7)
          setColor(136, 153, 170)
          doc.text(adl.slice(0, 2), margin + 5, y)
          y += Math.min(adl.length, 2) * 3 + 3
        }
      })
    }
    
    // ═══════════════════════════════════════════════════════════════
    // MANUAL REVIEW
    // ═══════════════════════════════════════════════════════════════
    if (tier1?.manualReview?.completedAt) {
      checkPage(40)
      addSection("9. MANUAL REVIEW ATTESTATION")
      addText(`Completed: ${tier1.manualReview.completedAt}`, margin, y, { size: 8 })
      y += 5
      if (tier1.manualReview.checksCompleted) {
        addText(`Checks: ${tier1.manualReview.checksCompleted}`, margin, y, { size: 8 })
        y += 5
      }
      if (tier1.manualReview.findingsConfirmed !== undefined) {
        addText(`Confirmed: ${tier1.manualReview.findingsConfirmed} | Rejected: ${tier1.manualReview.findingsRejected || 0} | Added: ${tier1.manualReview.manualFindingsAdded || 0}`, margin, y, { size: 8 })
        y += 5
      }
      if (tier1.manualReview.signatureEth) {
        addText(`ETH Signature: ${tier1.manualReview.signatureEth.slice(0, 30)}...`, margin, y, { size: 7, color: [0, 255, 136] })
        y += 5
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════════════════════
    const pages = doc.getNumberOfPages()
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i)
      doc.setFillColor(5, 8, 16)
      doc.setDrawColor(22, 30, 42)
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)
      addText("SOLAY39 SKYNET - Smart Contract Security Audit Platform", pageWidth / 2 - 45, pageHeight - 10, { size: 7, color: [68, 85, 102] })
      addText("https://www.solay39.eu", pageWidth / 2 - 18, pageHeight - 6, { size: 7, color: [0, 255, 136] })
      addText(`Page ${i} of ${pages}`, pageWidth - margin - 15, pageHeight - 10, { size: 7, color: [68, 85, 102] })
    }
    
    const base64 = doc.output("datauristring").split(",")[1]
    console.log("[v0] PDF generated, base64 length:", base64?.length || 0)
    return base64
  } catch (error) {
    console.error("[v0] PDF generation error:", error)
    return ""
  }
}
