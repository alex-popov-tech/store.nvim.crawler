/**
 * Verification result for a single repository
 */
export type VerificationResult = 
  | { isPlugin: true }
  | { isPlugin: false; reason: string };

/**
 * Cache of verification results keyed by repository URL
 * Key: Full repository URL (e.g., "https://github.com/owner/repo")
 * Value: Verification result
 */
export type VerificationCache = Record<string, VerificationResult>;