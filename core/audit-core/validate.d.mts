export interface ValidationError { code: string; msg: string }
export interface ValidationResult { ok: boolean; publishable: boolean; errors: ValidationError[]; warnings: string[]; unresolved_candidates: boolean }
export function validateReport(
  report: any,
  opts: { sourceText: string; baseDir?: string; readArtifact?: (p: string) => Uint8Array | string | null }
): ValidationResult
