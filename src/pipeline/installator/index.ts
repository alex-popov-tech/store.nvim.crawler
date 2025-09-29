import { InstallationDebugEntry } from "./types";
import { createLogger } from "~/logger";
import { Repository, RepositoryWithInstallationInfo } from "../types";
import { config } from "~/config";
import pLimit from "p-limit";
import {
  isCacheHasFreshRecord,
  processSingleRepository,
  pullCache,
  updateCache,
  writeDebugOutput,
} from "./utils";

const logger = createLogger({ context: "installator" });

export async function generateInstallations(
  repositories: Map<string, Repository>,
): Promise<Map<string, RepositoryWithInstallationInfo>> {
  logger.info(
    `Starting cache-aware installation processing for ${repositories.size} repositories`,
  );

  const cache = await pullCache();
  const results = new Map<string, RepositoryWithInstallationInfo>();
  const debugEntries = new Map<string, InstallationDebugEntry>();
  const reposToProcess = [] as Array<Repository>;

  // First pass: check cache and collect repos that need processing
  for (const [fullName, repo] of repositories) {
    if (config.pipeline.installator.cache === false) {
      reposToProcess.push(repo);
      continue;
    }

    if (!isCacheHasFreshRecord(cache, repo)) {
      reposToProcess.push(repo);
      continue;
    }

    logger.debug(`${fullName}: using cached installation`);
    const cached = cache.get(repo.full_name)!;
    results.set(fullName, {
      ...repo,
      install: {
        source: cached.source,
        lazy: cached.lazy,
        vimpack: cached.vimpack,
      },
    });
    debugEntries.set(fullName, { source: "cache", install: cached });
  }

  logger.info(
    `Found ${reposToProcess.length} repositories to process (${repositories.size - reposToProcess.length} cache hits)`,
  );

  const limit = pLimit(config.pipeline.crawler.concurrentRequestsLimit);
  const tasks = reposToProcess.map((it) =>
    limit(async () => await processSingleRepository(it)),
  );
  const taskResults = await Promise.all(tasks);

  // Collect results and update cache
  for (const { repository, default: def, chunks } of taskResults) {
    results.set(repository.full_name, repository);

    cache.set(repository.full_name, {
      ...repository.install,
      updated_at: repository.updated_at,
    });
    debugEntries.set(repository.full_name, {
      source: "processed",
      updated_at: repository.updated_at,
      readme: repository.readme,
      install: repository.install,
      default: def,
      chunks,
    });
  }

  await updateCache(cache);
  const cacheHits = repositories.size - reposToProcess.length;

  logger.info(
    `Installation processing complete: ${repositories.size} total repositories, ` +
      `${cacheHits} cache hits, ${reposToProcess.length} processed, ` +
      `${results.size} final results`,
  );

  // Write rich debug output to local file
  writeDebugOutput(debugEntries);

  return results;
}
