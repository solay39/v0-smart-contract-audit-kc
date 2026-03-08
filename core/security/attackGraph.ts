// core/security/attackGraph.ts
// Attack graph generator - visualizes exploit chains

export interface AttackNode {
  id: string
  type: "vulnerability" | "entry" | "goal" | "step"
  label: string
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  description?: string
}

export interface AttackEdge {
  from: string
  to: string
  label?: string
  probability?: number
}

export interface AttackGraph {
  nodes: AttackNode[]
  edges: AttackEdge[]
  entryPoints: string[]
  goals: string[]
  criticalPaths: string[][]
}

export interface Vulnerability {
  type: string
  severity: string
  location: string
  description: string
  dependencies?: string[]
}

// Build attack graph from vulnerabilities
export function buildAttackGraph(vulnerabilities: Vulnerability[]): AttackGraph {
  const nodes: AttackNode[] = []
  const edges: AttackEdge[] = []
  const entryPoints: string[] = []
  const goals: string[] = []

  // Add entry point
  nodes.push({
    id: "ENTRY",
    type: "entry",
    label: "Attacker Entry",
    description: "External caller with no special privileges",
  })
  entryPoints.push("ENTRY")

  // Add goal node
  nodes.push({
    id: "GOAL",
    type: "goal",
    label: "Exploit Success",
    description: "Attacker achieves financial gain or system compromise",
  })
  goals.push("GOAL")

  // Process each vulnerability
  vulnerabilities.forEach((v, i) => {
    const nodeId = `VULN_${i}`

    nodes.push({
      id: nodeId,
      type: "vulnerability",
      label: v.type,
      severity: v.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      description: v.description,
    })

    // Connect from entry if no dependencies
    if (!v.dependencies || v.dependencies.length === 0) {
      edges.push({
        from: "ENTRY",
        to: nodeId,
        label: "Direct exploit",
        probability: severityToProbability(v.severity),
      })
    } else {
      // Connect from dependencies
      v.dependencies.forEach((dep) => {
        const depNode = nodes.find((n) => n.label === dep)
        if (depNode) {
          edges.push({
            from: depNode.id,
            to: nodeId,
            label: `Requires ${dep}`,
            probability: 0.7,
          })
        }
      })
    }

    // Connect critical vulnerabilities to goal
    if (v.severity === "CRITICAL" || v.severity === "HIGH") {
      edges.push({
        from: nodeId,
        to: "GOAL",
        label: "Leads to exploit",
        probability: v.severity === "CRITICAL" ? 0.9 : 0.7,
      })
    }
  })

  // Find critical paths (BFS from entry to goal)
  const criticalPaths = findCriticalPaths(nodes, edges, "ENTRY", "GOAL")

  return {
    nodes,
    edges,
    entryPoints,
    goals,
    criticalPaths,
  }
}

function severityToProbability(severity: string): number {
  switch (severity) {
    case "CRITICAL":
      return 0.9
    case "HIGH":
      return 0.75
    case "MEDIUM":
      return 0.5
    case "LOW":
      return 0.25
    default:
      return 0.1
  }
}

function findCriticalPaths(
  nodes: AttackNode[],
  edges: AttackEdge[],
  start: string,
  end: string
): string[][] {
  const paths: string[][] = []
  const queue: { node: string; path: string[] }[] = [{ node: start, path: [start] }]

  while (queue.length > 0) {
    const { node, path } = queue.shift()!

    if (node === end) {
      paths.push(path)
      continue
    }

    const nextEdges = edges.filter((e) => e.from === node)
    for (const edge of nextEdges) {
      if (!path.includes(edge.to)) {
        queue.push({ node: edge.to, path: [...path, edge.to] })
      }
    }
  }

  // Sort by path length (shorter = more critical)
  return paths.sort((a, b) => a.length - b.length).slice(0, 5)
}

// Generate Mermaid diagram from attack graph
export function toMermaid(graph: AttackGraph): string {
  const lines: string[] = ["graph TD"]

  // Add nodes with styling
  graph.nodes.forEach((node) => {
    let style = ""
    switch (node.type) {
      case "entry":
        style = `${node.id}[["${node.label}"]]`
        break
      case "goal":
        style = `${node.id}(("${node.label}"))`
        break
      case "vulnerability":
        const shape = node.severity === "CRITICAL" ? "{{" : "["
        const shapeEnd = node.severity === "CRITICAL" ? "}}" : "]"
        style = `${node.id}${shape}"${node.label}"${shapeEnd}`
        break
      default:
        style = `${node.id}["${node.label}"]`
    }
    lines.push(`    ${style}`)
  })

  // Add edges
  graph.edges.forEach((edge) => {
    const label = edge.label ? `|${edge.label}|` : ""
    lines.push(`    ${edge.from} -->${label} ${edge.to}`)
  })

  // Add styling
  lines.push("")
  lines.push("    classDef critical fill:#ff0000,color:#fff")
  lines.push("    classDef high fill:#ff6600,color:#fff")
  lines.push("    classDef medium fill:#ffcc00,color:#000")
  lines.push("    classDef low fill:#00cc00,color:#fff")

  graph.nodes.forEach((node) => {
    if (node.severity) {
      lines.push(`    class ${node.id} ${node.severity.toLowerCase()}`)
    }
  })

  return lines.join("\n")
}

// Calculate overall risk score
export function calculateRiskScore(graph: AttackGraph): {
  score: number
  level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  breakdown: { category: string; score: number }[]
} {
  const breakdown: { category: string; score: number }[] = []

  // Count vulnerabilities by severity
  const criticalCount = graph.nodes.filter((n) => n.severity === "CRITICAL").length
  const highCount = graph.nodes.filter((n) => n.severity === "HIGH").length
  const mediumCount = graph.nodes.filter((n) => n.severity === "MEDIUM").length
  const lowCount = graph.nodes.filter((n) => n.severity === "LOW").length

  breakdown.push({ category: "Critical Vulns", score: criticalCount * 25 })
  breakdown.push({ category: "High Vulns", score: highCount * 15 })
  breakdown.push({ category: "Medium Vulns", score: mediumCount * 5 })
  breakdown.push({ category: "Low Vulns", score: lowCount * 1 })

  // Bonus for exploit chains
  const chainBonus = graph.criticalPaths.length * 5
  breakdown.push({ category: "Exploit Chains", score: chainBonus })

  const totalScore = breakdown.reduce((sum, b) => sum + b.score, 0)
  const normalizedScore = Math.min(100, totalScore)

  let level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  if (normalizedScore >= 75 || criticalCount > 0) level = "CRITICAL"
  else if (normalizedScore >= 50 || highCount > 0) level = "HIGH"
  else if (normalizedScore >= 25) level = "MEDIUM"
  else level = "LOW"

  return { score: normalizedScore, level, breakdown }
}
