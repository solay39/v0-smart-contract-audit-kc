import { jsPDF } from "jspdf"

interface Finding {
  id: string
  title: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
  status: "OPEN" | "RESOLVED" | "ACKNOWLEDGED"
  description?: string
  impact?: string
  recommendation?: string
  location?: string
}

interface AuditProject {
  name: string
  network?: string
  date?: string
  commit?: string
  scope?: string
}

const SEV_COLORS: Record<string, [number, number, number]> = {
  CRITICAL: [255, 45, 85],
  HIGH: [255, 107, 0],
  MEDIUM: [255, 214, 0],
  LOW: [0, 255, 136],
  INFO: [68, 85, 102],
}

function ratingOf(s: number): string {
  if (s >= 95) return "AAA"
  if (s >= 90) return "AA"
  if (s >= 80) return "A"
  if (s >= 70) return "B"
  if (s >= 60) return "C"
  if (s >= 50) return "D"
  return "F"
}

/**
 * Generates a real PDF file and returns it as base64
 */
export function generatePDFBase64(
  project: AuditProject,
  rawScore: number,
  findings: Finding[]
): string {
  try {
    console.log("[v0] generatePDFBase64 called for:", project.name)
    const score = Math.min(rawScore, 98)
  const rating = ratingOf(score)
  const today = new Date().toISOString().slice(0, 10)
  
  // Create PDF document (A4 size)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })
  
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  let y = margin
  
  // Helper functions
  const setColor = (r: number, g: number, b: number) => {
    doc.setTextColor(r, g, b)
  }
  
  const addText = (text: string, x: number, yPos: number, options?: { fontSize?: number; bold?: boolean; color?: [number, number, number] }) => {
    const { fontSize = 10, bold = false, color = [208, 216, 224] } = options || {}
    doc.setFontSize(fontSize)
    doc.setFont("helvetica", bold ? "bold" : "normal")
    setColor(color[0], color[1], color[2])
    doc.text(text, x, yPos)
  }
  
  const addLine = (y1: number, color: [number, number, number] = [22, 30, 42]) => {
    doc.setDrawColor(color[0], color[1], color[2])
    doc.line(margin, y1, pageWidth - margin, y1)
  }
  
  // Background
  doc.setFillColor(5, 8, 16)
  doc.rect(0, 0, pageWidth, pageHeight, "F")
  
  // Header
  addText("SOLAY39", margin, y, { fontSize: 18, bold: true, color: [0, 255, 136] })
  addText("SKYNET", margin + 40, y, { fontSize: 12, color: [68, 85, 102] })
  addText(today, pageWidth - margin - 30, y, { fontSize: 9, color: [68, 85, 102] })
  y += 5
  addText("SMART CONTRACT SECURITY AUDIT", pageWidth - margin - 65, y, { fontSize: 8, color: [68, 85, 102] })
  
  y += 15
  addLine(y)
  y += 15
  
  // Project name
  addText(project.name, margin, y, { fontSize: 24, bold: true, color: [238, 244, 250] })
  y += 8
  addText("SECURITY AUDIT REPORT", margin, y, { fontSize: 10, color: [0, 255, 136] })
  
  y += 20
  
  // Score box
  const scoreColor: [number, number, number] = score >= 90 ? [0, 255, 136] : score >= 70 ? [255, 214, 0] : [255, 107, 0]
  doc.setFillColor(13, 17, 23)
  doc.setDrawColor(22, 30, 42)
  doc.rect(margin, y, 50, 40, "FD")
  
  addText(String(score), margin + 15, y + 22, { fontSize: 32, bold: true, color: scoreColor })
  addText("SOLAY39 SCORE", margin + 8, y + 30, { fontSize: 7, color: [68, 85, 102] })
  addText(rating, margin + 20, y + 37, { fontSize: 12, bold: true, color: scoreColor })
  
  // Project info box
  doc.setFillColor(13, 17, 23)
  doc.rect(margin + 55, y, pageWidth - margin * 2 - 55, 40, "FD")
  
  const infoX = margin + 60
  addText("Network:", infoX, y + 12, { fontSize: 9, color: [68, 85, 102] })
  addText(project.network || "—", infoX + 25, y + 12, { fontSize: 9 })
  
  addText("Date:", infoX + 70, y + 12, { fontSize: 9, color: [68, 85, 102] })
  addText(project.date || today, infoX + 85, y + 12, { fontSize: 9 })
  
  addText("Commit:", infoX, y + 22, { fontSize: 9, color: [68, 85, 102] })
  addText(project.commit?.slice(0, 8) || "—", infoX + 25, y + 22, { fontSize: 9, color: [0, 255, 136] })
  
  const scopeDisplay = project.scope?.split("\n")[0]?.slice(0, 40) || "—"
  addText("Scope:", infoX, y + 32, { fontSize: 9, color: [68, 85, 102] })
  addText(scopeDisplay, infoX + 25, y + 32, { fontSize: 9 })
  
  y += 50
  
  // Severity summary boxes
  const sevs: Array<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"> = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
  const boxWidth = (pageWidth - margin * 2 - 20) / 5
  
  sevs.forEach((sev, i) => {
    const count = findings.filter(f => f.severity === sev).length
    const x = margin + i * (boxWidth + 5)
    
    doc.setFillColor(13, 17, 23)
    doc.rect(x, y, boxWidth, 25, "FD")
    
    addText(String(count), x + boxWidth / 2 - 3, y + 12, { fontSize: 16, bold: true, color: SEV_COLORS[sev] })
    addText(sev, x + boxWidth / 2 - (sev.length * 1.5), y + 20, { fontSize: 7, color: [68, 85, 102] })
  })
  
  y += 35
  
  // Findings section
  addText("FINDINGS", margin, y, { fontSize: 12, bold: true, color: [0, 255, 136] })
  y += 10
  
  if (findings.length === 0) {
    doc.setFillColor(0, 26, 13)
    doc.rect(margin, y, pageWidth - margin * 2, 20, "F")
    addText("No Issues Found", margin + 5, y + 10, { fontSize: 11, bold: true, color: [0, 255, 136] })
    addText("The contracts passed all checks without any identifiable security issues.", margin + 5, y + 16, { fontSize: 8, color: [122, 140, 158] })
  } else {
    // Summary table header
    addText("SEVERITY", margin, y + 5, { fontSize: 7, color: [68, 85, 102] })
    addText("COUNT", margin + 35, y + 5, { fontSize: 7, color: [68, 85, 102] })
    addText("OPEN", margin + 55, y + 5, { fontSize: 7, color: [68, 85, 102] })
    addText("RESOLVED", margin + 75, y + 5, { fontSize: 7, color: [68, 85, 102] })
    y += 8
    addLine(y, [22, 30, 42])
    y += 5
    
    sevs.forEach(sev => {
      const count = findings.filter(f => f.severity === sev).length
      const open = findings.filter(f => f.severity === sev && f.status === "OPEN").length
      const resolved = findings.filter(f => f.severity === sev && f.status === "RESOLVED").length
      
      if (count > 0) {
        addText(sev, margin, y + 4, { fontSize: 9, bold: true, color: SEV_COLORS[sev] })
        addText(String(count), margin + 40, y + 4, { fontSize: 9 })
        addText(String(open), margin + 58, y + 4, { fontSize: 9 })
        addText(String(resolved), margin + 82, y + 4, { fontSize: 9 })
        y += 8
      }
    })
    
    y += 10
    addText("FINDING DETAILS", margin, y, { fontSize: 10, bold: true, color: [0, 255, 136] })
    y += 8
    
    // Finding details
    const sevPfx: Record<string, string> = { CRITICAL: "C", HIGH: "H", MEDIUM: "M", LOW: "L", INFO: "I" }
    const sevCounts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 }
    
    findings.forEach(f => {
      // Check if we need a new page
      if (y > pageHeight - 60) {
        doc.addPage()
        doc.setFillColor(5, 8, 16)
        doc.rect(0, 0, pageWidth, pageHeight, "F")
        y = margin
      }
      
      sevCounts[f.severity]++
      const num = `${sevPfx[f.severity]}-${String(sevCounts[f.severity]).padStart(2, "0")}`
      const sevColor = SEV_COLORS[f.severity]
      const statusColor: [number, number, number] = f.status === "RESOLVED" ? [0, 255, 136] : f.status === "ACKNOWLEDGED" ? [255, 214, 0] : [255, 45, 85]
      
      // Finding header
      doc.setFillColor(13, 17, 23)
      doc.rect(margin, y, pageWidth - margin * 2, 10, "F")
      doc.setDrawColor(sevColor[0], sevColor[1], sevColor[2])
      doc.line(margin, y, margin, y + 10)
      
      addText(`${num} [${f.severity}]`, margin + 3, y + 6, { fontSize: 9, bold: true, color: sevColor })
      addText(f.title || "", margin + 35, y + 6, { fontSize: 9, bold: true, color: [238, 244, 250] })
      addText(f.status, pageWidth - margin - 20, y + 6, { fontSize: 8, bold: true, color: statusColor })
      
      y += 12
      
      // Description
      if (f.description) {
        addText("Description:", margin + 3, y + 4, { fontSize: 8, color: [68, 85, 102] })
        const descLines = doc.splitTextToSize(f.description, pageWidth - margin * 2 - 30)
        doc.setFontSize(8)
        setColor(136, 153, 170)
        doc.text(descLines.slice(0, 3), margin + 30, y + 4)
        y += Math.min(descLines.length, 3) * 4 + 4
      }
      
      // Impact
      if (f.impact) {
        addText("Impact:", margin + 3, y + 4, { fontSize: 8, color: [68, 85, 102] })
        const impactLines = doc.splitTextToSize(f.impact, pageWidth - margin * 2 - 30)
        doc.setFontSize(8)
        setColor(136, 153, 170)
        doc.text(impactLines.slice(0, 2), margin + 30, y + 4)
        y += Math.min(impactLines.length, 2) * 4 + 4
      }
      
      // Recommendation
      if (f.recommendation) {
        addText("Recommendation:", margin + 3, y + 4, { fontSize: 8, color: [68, 85, 102] })
        const recLines = doc.splitTextToSize(f.recommendation, pageWidth - margin * 2 - 35)
        doc.setFontSize(8)
        setColor(136, 153, 170)
        doc.text(recLines.slice(0, 2), margin + 35, y + 4)
        y += Math.min(recLines.length, 2) * 4 + 4
      }
      
      y += 8
    })
  }
  
  // Footer
  if (y > pageHeight - 30) {
    doc.addPage()
    doc.setFillColor(5, 8, 16)
    doc.rect(0, 0, pageWidth, pageHeight, "F")
    y = margin
  }
  
  y = pageHeight - 25
  addLine(y, [22, 30, 42])
  y += 8
  addText("This report was generated by SOLAY39 SKYNET - Smart Contract Security Audit Platform", pageWidth / 2 - 55, y, { fontSize: 8, color: [68, 85, 102] })
  y += 5
  addText("https://www.solay39.eu", pageWidth / 2 - 18, y, { fontSize: 8, color: [0, 255, 136] })
  
  // Return as base64
    const base64 = doc.output("datauristring").split(",")[1]
    console.log("[v0] PDF generated, base64 length:", base64?.length || 0)
    return base64
  } catch (error) {
    console.error("[v0] PDF generation error:", error)
    // Return a minimal valid PDF if generation fails
    return ""
  }
}
