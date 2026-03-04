import fs from "fs";
import pLimit from "p-limit";
import { fetchPublicContent } from "~/sdk/github";
import { Repository } from "../types";
import { config } from "~/config";
import { createLogger } from "~/logger";
import { VerificationCache, VerificationCacheEntry, VerificationResult } from "./types";
import { checkFileStructure } from "./file-structure";

const logger = createLogger({ context: "verificator" });

async function pullCache(): Promise<Map<string, VerificationCacheEntry>> {
  if (config.pipeline.verificator.cache === false) {
    return new Map();
  }

  const cacheUrl = `${config.pipeline.output.releaseBaseUrl}/${config.pipeline.verificator.cacheFilename}`;
  logger.info(`Pulling verification cache from ${cacheUrl}`);
  const rawResult = await fetchPublicContent(cacheUrl);
  if ("error" in rawResult) {
    logger.warn(`Failed to fetch verification cache: ${rawResult.error}, starting with empty cache`);
    return new Map();
  }

  if (!rawResult.content || rawResult.content.trim() === "") {
    logger.info(
      "Verification cache content is empty, starting with empty cache",
    );
    return new Map();
  }

  const cacheObject: VerificationCache = JSON.parse(rawResult.content);
  return new Map(Object.entries(cacheObject));
}

function isCacheHasFreshRecord(
  cache: Map<string, VerificationCacheEntry>,
  repository: Repository,
): boolean {
  const cached = cache.get(repository.full_name);
  if (!cached) return false;

  // Legacy entry without timestamps — treat as stale
  if (!cached.cached_at || !cached.updated_at) return false;

  const repoUpdated = new Date(repository.updated_at);
  const cachedUpdated = new Date(cached.updated_at);

  // Repo not updated since last cache — nothing changed
  if (repoUpdated <= cachedUpdated) return true;

  // Repo was updated — check if cache is still within TTL
  const ageInDays =
    (Date.now() - new Date(cached.cached_at).getTime()) /
    (24 * 60 * 60 * 1000);
  return ageInDays < config.pipeline.verificator.cacheLifetimeInDays;
}

function updateCache(cache: Map<string, VerificationCacheEntry>): void {
  const cacheContent = JSON.stringify(Object.fromEntries(cache), null, 2);

  fs.writeFileSync(config.pipeline.verificator.output.verificationCache, cacheContent);
  logger.info(`Updated verification cache file: ${config.pipeline.verificator.output.verificationCache}`);
}

/**
 * Verifies repositories and returns only valid plugins
 *
 * @param repositories - Map of repository full_name to Repository objects
 * @returns Map of verified plugin repositories
 */
export async function verify(
  repositories: Map<string, Repository>,
): Promise<Map<string, Repository>> {
  logger.info(`Starting verification of ${repositories.size} repositories`);

  const cache = await pullCache();
  const results = new Map<string, Repository>();

  // Prepare repositories that need verification (stale or missing cache)
  const reposToVerify: Array<[string, Repository]> = [];

  // First pass: check cache freshness and collect repos that need verification
  for (const [fullName, repo] of repositories) {
    logger.debug(`Processing repository: ${fullName}`);

    if (!isCacheHasFreshRecord(cache, repo)) {
      logger.debug(`${fullName}: stale or missing cache, queuing for verification`);
      reposToVerify.push([fullName, repo]);
      continue;
    }

    const cached = cache.get(fullName)!;
    if (cached.isPlugin) {
      results.set(fullName, repo);
      logger.debug(`${fullName}: cached as plugin`);
    } else {
      logger.debug(`${fullName}: cached as not-plugin - ${cached.reason}`);
    }
  }

  logger.info(
    `Found ${reposToVerify.length} repositories to verify concurrently`,
  );

  const limit = pLimit(config.pipeline.verificator.concurrentRequestsLimit);

  const verificationPromises = reposToVerify.map(([fullName, repo]) =>
    limit(async () => {
      try {
        logger.debug(`Verifying repository: ${fullName}`);

        // Check repository name against blacklist
        if (
          config.pipeline.verificator.blacklist.some((blacklistFn) => blacklistFn(repo))
        ) {
          const result: VerificationResult = {
            isPlugin: false,
            reason: "repository name matches blacklist pattern",
          };
          logger.debug(`${fullName}: failed name check`);
          return { fullName, repo, result, success: false };
        }

        // Check file structure
        const structureResult = await checkFileStructure(repo);

        if (structureResult.isPlugin) {
          logger.debug(`${fullName}: verified as plugin`);
          return { fullName, repo, result: structureResult, success: true };
        } else {
          logger.debug(
            `${fullName}: failed structure check - ${structureResult.reason}`,
          );
          return { fullName, repo, result: structureResult, success: false };
        }
      } catch (error) {
        logger.error(`Error verifying ${fullName}: ${error}`);
        return {
          fullName,
          repo,
          result: {
            isPlugin: false,
            reason: `verification error: ${error instanceof Error ? error.message : "unknown error"}`,
          },
          success: false,
        };
      }
    }),
  );

  // Wait for all verifications to complete
  const verificationResults = await Promise.all(verificationPromises);

  // Process results and stamp cache entries
  let newlyVerified = 0;
  let newlyFailed = 0;
  for (const { fullName, repo, result, success } of verificationResults) {
    cache.set(fullName, {
      ...result,
      updated_at: repo.updated_at,
      cached_at: new Date().toISOString(),
    });
    if (success && result.isPlugin) {
      results.set(fullName, repo);
      newlyVerified++;
    } else {
      newlyFailed++;
    }
  }

  // Update cache if we have new results
  if (newlyVerified > 0 || newlyFailed > 0) {
    updateCache(cache);
  }

  const cacheHits = repositories.size - newlyVerified - newlyFailed;
  const cachePluginHits = results.size - newlyVerified;
  const cacheNotPluginHits = cacheHits - cachePluginHits;

  logger.info(
    `Verification complete: ${repositories.size} total, ${cacheHits} cache hits ` +
      `(${cachePluginHits} plugins, ${cacheNotPluginHits} not-plugins), ` +
      `${newlyVerified} newly verified, ${newlyFailed} newly failed, ` +
      `${results.size} final verified plugins`,
  );

  return results;
}
