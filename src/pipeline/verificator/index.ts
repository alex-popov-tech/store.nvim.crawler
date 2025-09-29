import fs from "fs";
import pLimit from "p-limit";
import { updateGist, getRawGistContent } from "~/sdk/github";
import { Repository } from "../types";
import { config } from "~/config";
import { createLogger } from "~/logger";
import { VerificationCache, VerificationResult } from "./types";
import { checkFileStructure } from "./file-structure";

const logger = createLogger({ context: "verificator" });

async function pullCache(): Promise<Map<string, VerificationResult>> {
  if (config.pipeline.verificator.cache === false) {
    return new Map();
  }

  logger.info("Pulling verification cache from raw gist URL");
  const rawResult = await getRawGistContent(config.pipeline.verificator.rawUrl);
  if ("error" in rawResult) {
    throw new Error(
      `Failed to fetch verification cache from raw URL: ${rawResult.error}`,
    );
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

async function updateCache(
  originalCache: Map<string, VerificationResult>,
  verified: Map<string, VerificationResult>,
  failed: Map<string, VerificationResult>,
): Promise<void> {
  const newCache = new Map(originalCache);

  for (const [fullName, result] of verified) {
    newCache.set(fullName, result);
  }
  for (const [fullName, result] of failed) {
    newCache.set(fullName, result);
  }

  const newCacheContent = JSON.stringify(Object.fromEntries(newCache), null, 2);

  // Always write to filesystem for local review and CI artifacts
  fs.writeFileSync(config.pipeline.verificator.output.verificationCache, newCacheContent);
  logger.info("Updated verification cache file");

  // Early return if cache size unchanged
  if (originalCache.size === newCache.size) {
    logger.info("Cache size unchanged, skipping gist push");
    return;
  }

  logger.info("Cache size changed, pushing to gist");
  const updateResult = await updateGist(config.pipeline.verificator.gistId, {
    files: {
      "verification_cache.json": {
        content: newCacheContent,
      },
    },
  });

  if (updateResult.error) {
    throw new Error(
      `Failed to update verification cache gist: ${updateResult.error}`,
    );
  }

  logger.info("Successfully pushed verification cache to gist");
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
  const failed = new Map<string, VerificationResult>();
  const verified = new Map<string, VerificationResult>();

  // Prepare repositories that need verification (not in cache)
  const reposToVerify: Array<[string, Repository]> = [];

  // First pass: check cache and collect repos that need verification
  for (const [fullName, repo] of repositories) {
    logger.debug(`Processing repository: ${fullName}`);

    // Check cache first
    const cached = cache.get(fullName);

    if (cached?.isPlugin) {
      results.set(fullName, repo);
      logger.debug(`${fullName}: cached as plugin`);
      continue;
    }

    if (cached && !cached.isPlugin) {
      logger.debug(`${fullName}: cached as not-plugin - ${cached.reason}`);
      continue;
    }

    // Not in cache, add to verification queue
    logger.debug(`${fullName}: not cached, queuing for verification`);
    reposToVerify.push([fullName, repo]);
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

  // Process results
  for (const { fullName, repo, result, success } of verificationResults) {
    if (success && result.isPlugin) {
      results.set(fullName, repo);
      verified.set(fullName, result);
    } else {
      failed.set(fullName, result);
    }
  }

  // Update cache if we have new results
  if (verified.size > 0 || failed.size > 0) {
    await updateCache(cache, verified, failed);
  }

  const cacheHits = repositories.size - verified.size - failed.size;
  const cachePluginHits = results.size - verified.size;
  const cacheNotPluginHits = cacheHits - cachePluginHits;

  logger.info(
    `Verification complete: ${repositories.size} total, ${cacheHits} cache hits ` +
      `(${cachePluginHits} plugins, ${cacheNotPluginHits} not-plugins), ` +
      `${verified.size} newly verified, ${failed.size} newly failed, ` +
      `${results.size} final verified plugins`,
  );

  return results;
}
