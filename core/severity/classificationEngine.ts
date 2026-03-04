// ═══════════════════════════════════════════════════════════════
// SOLAY39 — CWE + SWC Classification Engine
// /core/severity/classificationEngine.ts
// Maps vulnerability types to standard CWE/SWC identifiers
// ═══════════════════════════════════════════════════════════════

export interface Classification {
  cwe: string
  swc: string
  cweName?: string
  swcName?: string
}

const classificationMap: Record<string, Classification> = {
  ACCESS_CONTROL: {
    cwe: "CWE-284",
    swc: "SWC-105",
    cweName: "Improper Access Control",
    swcName: "Unprotected Ether Withdrawal",
  },
  REENTRANCY: {
    cwe: "CWE-841",
    swc: "SWC-107",
    cweName: "Improper Enforcement of Behavioral Workflow",
    swcName: "Reentrancy",
  },
  DOS: {
    cwe: "CWE-400",
    swc: "SWC-113",
    cweName: "Uncontrolled Resource Consumption",
    swcName: "DoS with Failed Call",
  },
  OVERFLOW: {
    cwe: "CWE-190",
    swc: "SWC-101",
    cweName: "Integer Overflow or Wraparound",
    swcName: "Integer Overflow and Underflow",
  },
  UNDERFLOW: {
    cwe: "CWE-191",
    swc: "SWC-101",
    cweName: "Integer Underflow",
    swcName: "Integer Overflow and Underflow",
  },
  TX_ORIGIN: {
    cwe: "CWE-290",
    swc: "SWC-115",
    cweName: "Authentication Bypass by Spoofing",
    swcName: "Authorization through tx.origin",
  },
  SELFDESTRUCT: {
    cwe: "CWE-664",
    swc: "SWC-106",
    cweName: "Improper Control of a Resource Through its Lifetime",
    swcName: "Unprotected SELFDESTRUCT Instruction",
  },
  DELEGATECALL: {
    cwe: "CWE-829",
    swc: "SWC-112",
    cweName: "Inclusion of Functionality from Untrusted Control Sphere",
    swcName: "Delegatecall to Untrusted Callee",
  },
  TIMESTAMP: {
    cwe: "CWE-330",
    swc: "SWC-116",
    cweName: "Use of Insufficiently Random Values",
    swcName: "Block values as a proxy for time",
  },
  FLOATING_PRAGMA: {
    cwe: "CWE-693",
    swc: "SWC-103",
    cweName: "Protection Mechanism Failure",
    swcName: "Floating Pragma",
  },
  UNCHECKED_RETURN: {
    cwe: "CWE-252",
    swc: "SWC-104",
    cweName: "Unchecked Return Value",
    swcName: "Unchecked Call Return Value",
  },
  FLASH_LOAN: {
    cwe: "CWE-362",
    swc: "SWC-107",
    cweName: "Race Condition",
    swcName: "Reentrancy (Flash Loan variant)",
  },
  ORACLE: {
    cwe: "CWE-20",
    swc: "SWC-107",
    cweName: "Improper Input Validation",
    swcName: "Reentrancy (Oracle variant)",
  },
  FRONT_RUNNING: {
    cwe: "CWE-362",
    swc: "SWC-114",
    cweName: "Concurrent Execution Using Shared Resource with Improper Synchronization",
    swcName: "Transaction Order Dependence",
  },
  SIGNATURE_REPLAY: {
    cwe: "CWE-294",
    swc: "SWC-121",
    cweName: "Authentication Bypass by Capture-replay",
    swcName: "Missing Protection against Signature Replay Attacks",
  },
}

/**
 * Classify a vulnerability type to CWE + SWC codes.
 * Accepts uppercase type keys like "REENTRANCY", "ACCESS_CONTROL", etc.
 */
export function classify(type: string): Classification {
  return classificationMap[type.toUpperCase()] || {
    cwe: "UNCLASSIFIED",
    swc: "UNCLASSIFIED",
  }
}

/**
 * Auto-classify from a finding title string.
 * Searches the title for known keywords and returns the best match.
 */
export function classifyFromTitle(title: string): Classification {
  const t = title.toLowerCase()

  if (t.includes("reentrancy")) return classificationMap.REENTRANCY
  if (t.includes("access control") || (t.includes("missing") && t.includes("control")))
    return classificationMap.ACCESS_CONTROL
  if (t.includes("overflow")) return classificationMap.OVERFLOW
  if (t.includes("underflow")) return classificationMap.UNDERFLOW
  if (t.includes("tx.origin")) return classificationMap.TX_ORIGIN
  if (t.includes("selfdestruct") || t.includes("self destruct")) return classificationMap.SELFDESTRUCT
  if (t.includes("delegatecall")) return classificationMap.DELEGATECALL
  if (t.includes("timestamp")) return classificationMap.TIMESTAMP
  if (t.includes("pragma") || t.includes("floating")) return classificationMap.FLOATING_PRAGMA
  if (t.includes("unchecked")) return classificationMap.UNCHECKED_RETURN
  if (t.includes("flash loan") || t.includes("flashloan")) return classificationMap.FLASH_LOAN
  if (t.includes("oracle")) return classificationMap.ORACLE
  if (t.includes("front") && t.includes("run")) return classificationMap.FRONT_RUNNING
  if (t.includes("dos") || t.includes("denial")) return classificationMap.DOS
  if (t.includes("signature") && (t.includes("replay") || t.includes("malleab")))
    return classificationMap.SIGNATURE_REPLAY

  return { cwe: "UNCLASSIFIED", swc: "UNCLASSIFIED" }
}

/**
 * Get all supported classification types.
 */
export function getSupportedTypes(): string[] {
  return Object.keys(classificationMap)
}
