/** Automated suggestions are not execution evidence or founder approval. */
export function preliminaryAutomatedAssessment(input: Record<string, unknown>): Record<string, unknown> {
  const object = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const formal = object(input.formalVerification)
  const invariants = Array.isArray(formal.invariantsTested) ? formal.invariantsTested :
    Array.isArray(formal.invariants) ? formal.invariants : []
  const methodology = object(input.testingMethodology)
  const engagement = object(input.aiEngagement)
  const vectors = object(input.exploitSimulation).vectors
  return {
    ...input,
    analysisMode: "automated-candidates-pending-source-bound-evidence-and-founder-review",
    publicationStatus: "PRELIMINARY",
    executionEvidence: {
      exploitTests: "NOT_RUN",
      fuzzing: input.fuzzingResults ? "UNVERIFIED" : "NOT_RUN",
      formalVerification: input.formalVerificationResults ? "UNVERIFIED" : "NOT_RUN",
      manualReview: "PENDING", approval: "NOT_SIGNED",
    },
    // Preserve useful hypotheses, but strip invented PASS/VERIFIED/gas/runs/USD claims.
    verificationSuggestions: invariants.map(value => {
      const candidate = object(value)
      return { property: String(candidate.invariant || candidate.property || ""), status: "NOT_RUN" }
    }),
    attackSuggestions: Array.isArray(vectors) ? vectors.map(value => {
      const candidate = object(value)
      return {
        attackType: candidate.attackType, description: candidate.description,
        attackFlow: candidate.attackFlow, exploitCode: candidate.exploitCode, status: "UNVALIDATED_CANDIDATE",
      }
    }) : [],
    formalVerification: null, formalVerificationResults: null, fuzzingResults: null,
    exploitSimulation: null, confirmedPoCs: [],
    signedReport: null, onChainRecord: null, solanaAttestation: null, ipfsRecord: null,
    testingMethodology: {
      ...methodology, manualReviewHours: 0, fuzzingApplied: false, symbolicExecution: false,
      dynamicAnalysisTools: [], executionStatus: "NOT_RUN",
    },
    aiEngagement: {
      ...engagement, numberOfAuditors: 0, engineeringHours: 0, securityEngineersInvolved: 0,
      auditDurationDays: 0,
    },
    invariantsChecked: Array.isArray(input.invariantsChecked) ? input.invariantsChecked.map(value => ({
      ...object(value), status: "NOT_RUN", result: "NOT_RUN", passed: false,
      method: "Source-derived candidate; not an executed invariant test",
    })) : [],
    residualRisk: {
      ...object(input.residualRisk),
      overallResidualRisk: "UNASSESSED: execution evidence and founder review are pending.",
    },
  }
}
