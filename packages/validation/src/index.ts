export type ValidationSeverity = 'BLOCK' | 'WARN' | 'FLAG' | 'INFO';

export interface ValidationResult {
  ruleId: string;
  severity: ValidationSeverity;
  message: string;
  passed: boolean;
}

export function allBlockingRulesPass(results: ValidationResult[]): boolean {
  return results.every((result) => result.severity !== 'BLOCK' || result.passed);
}
