/**
 * Verification result for a single repository
 */
export type VerificationResult =
  | { isPlugin: true }
  | { isPlugin: false; reason: string };

/**
 * Cache entry with timestamps for TTL + update-based invalidation
 */
export type VerificationCacheEntry = {
  updated_at: string;   // repo's updated_at at cache time
  cached_at: string;    // ISO timestamp when cached
} & VerificationResult;

/**
 * Cache of verification results keyed by repository full_name
 */
export type VerificationCache = Record<string, VerificationCacheEntry>;