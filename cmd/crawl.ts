#!/usr/bin/env node

import { crawl } from "~/crawlers";
import { getRepositoryReadme, GithubRepository, updateGist } from "~/sdk";
import { processors } from "~/processors";
import { config } from "~/config";
import { writeFile, mkdir, stat } from "fs/promises";
import { createLogger } from "../src/logger";
import { ProcessedRepositories } from "~";
import { FormattedChunk } from "~/processors/readme/types";
import pLimit from "p-limit";
import path from "path";

const logger = createLogger({ context: "main" });

/**
 * Step 1: Crawl repositories from all sources
 */
async function crawlRepositories(): Promise<
  { data: GithubRepository[] } | { error: any }
> {
  logger.info("🔍 Starting: Repository Discovery");

  try {
    const crawlResult = await crawl();
    if ("error" in crawlResult) {
      return { error: crawlResult.error };
    }

    const filteredRepos = Array.from(crawlResult.data.values()).filter(
      (repo) => !config.REPOSITORIES_BLACKLIST.some((bl) => bl(repo)),
    );

    logger.info(
      `✅ Discovered ${filteredRepos.length} repositories after filtering`,
    );
    logger.info("Repository discovery completed");

    return { data: filteredRepos };
  } catch (error) {
    logger.error(`❌ Failed to crawl repositories: ${error}`);
    return { error };
  }
}

/**
 * Step 2: Enhance repositories info for store.nvim to consume on frontend ( pre-processing )
 */
function processRepositoriesData(
  repositories: GithubRepository[],
  installationData: Record<
    string,
    { installations: FormattedChunk[]; readmePath: string }
  >,
): ProcessedRepositories {
  logger.info("⚙️ Starting: Repository Processing");

  const processedRepos = processors.repositories(
    repositories,
    installationData,
  );

  logger.info(`✅ Processed ${processedRepos.meta.total_count} repositories`);
  logger.info("Repository processing completed");

  return processedRepos;
}

/**
 * Step 3: Generate installation instructions
 */
async function generateInstallationInstructions(
  repositories: GithubRepository[],
): Promise<
  | {
      data: Record<
        string,
        { installations: FormattedChunk[]; readmePath: string }
      >;
    }
  | { error: any }
> {
  logger.info("📖 Starting: Installation Data Extraction");

  const installData: Record<
    string,
    { installations: FormattedChunk[]; readmePath: string }
  > = {};

  // Create a limit function with the configured concurrency
  const limit = pLimit(config.crawler.concurrentRequestsLimit);

  logger.info(
    `Processing ${repositories.length} repositories with concurrency limit of ${config.crawler.concurrentRequestsLimit}`,
  );

  let readmeProcessed = 0;
  let readmeProcessedEmpty = 0;
  let readmeNotfound = 0;
  const promises = repositories.map((repo) =>
    limit(async () => {
      const readme = await getRepositoryReadme(repo.full_name);
      if ("error" in readme) {
        logger.warn(
          `Cannot fetch README for ${repo.full_name} because of\n${readme.error}`,
        );
        readmeNotfound++;
        return;
      }

      const installations = processors.readme(repo.full_name, readme.data);
      if (!installations.length) {
        logger.warn(`No installations found for ${repo.full_name}`);
        readmeProcessedEmpty++;
        return;
      }

      readmeProcessed++;
      installData[repo.full_name] = {
        installations,
        readmePath: readme.readmePath,
      };
    }),
  );

  // Wait for all processing to complete
  await Promise.all(promises);

  logger.info(`✅ Processed ${repositories.length} repositories`);
  logger.info(`❓ ${readmeNotfound} README's not found`);
  logger.info(`❔ ${readmeProcessedEmpty} have no installations in README`);
  logger.info(
    `✨ ${readmeProcessed} README's processed successfully with installation instructions`,
  );

  return { data: installData };
}

/**
 * Sort repositories by installation status and recency
 */
function sortRepositories(repositories: ProcessedRepositories): void {
  repositories.items.sort((a, b) => {
    // Primary: Has installation instructions (with instructions first)
    const aHasInstall = a.install && a.install!.lazyConfig.length > 0;
    const bHasInstall = b.install && b.install!.lazyConfig.length > 0;

    if (aHasInstall !== bHasInstall) {
      return bHasInstall ? 1 : -1; // Repos with install instructions first
    }

    // Secondary: pushed_at timestamp (most recent first within each group)
    if (a.pushed_at !== b.pushed_at) {
      return b.pushed_at - a.pushed_at;
    }

    // Final: star count (higher first)
    return b.stargazers_count - a.stargazers_count;
  });
}

/**
 * Step 4: Save separate json's for plugins info, and readme's processing results
 */
async function saveToFilesystem(args: {
  db: ProcessedRepositories;
  install: Record<
    string,
    { readmePath: string; installations: FormattedChunk[] }
  >;
  dbMinified: string;
}): Promise<{ error?: any }> {
  logger.info("💾 Starting: Saving to Filesystem");

  try {
    const dbpath = path.resolve(".", config.output.db);
    const dbMinifiedpath = path.resolve(".", config.output.dbMinified);
    const installpath = path.resolve(".", config.output.install);

    const dir = path.dirname(dbpath);
    const stats = await stat(dir);
    if (!stats.isDirectory()) {
      await mkdir(dir);
    }

    await writeFile(dbpath, JSON.stringify(args.db, null, 2));
    logger.info(`✅ DB written to ${dbpath}`);

    await writeFile(dbMinifiedpath, args.dbMinified);
    logger.info(`✅ DB minified written to ${dbMinifiedpath}`);

    await writeFile(installpath, JSON.stringify(args.install, null, 2));
    logger.info(`✅ Installation data written to ${installpath}`);

    logger.info("Filesystem save completed");
    return {};
  } catch (error) {
    logger.error(`❌ Failed to save files: ${error}`);
    return { error };
  }
}

/**
 * Step 5: Update GitHub Gist
 */
async function updateGistDb(content: string) {
  if (!config.UPDATE_GIST_ID) {
    logger.info("🌐 Gist update disabled, skipping gist upload");
    return;
  }

  logger.info("🌐 Starting: GitHub Gist Update");

  const gistResult = await updateGist(config.UPDATE_GIST_ID, {
    files: { [config.output.dbMinified]: { content } },
  });

  if (gistResult.error) {
    throw gistResult.error;
  }

  logger.info("✅ Gist updated successfully");
  logger.info("GitHub gist update completed");
}

/**
 * Create lightweight version for gist (removes heavy data)
 * @returns json minified repsesentation
 */
function compressDb(processedRepositories: ProcessedRepositories): string {
  const lightweightItems = processedRepositories.items.map((repo: any) => {
    const { topics, forks_count, open_issues_count, ...lightweightRepo } = repo;
    return lightweightRepo;
  });

  return JSON.stringify({
    meta: processedRepositories.meta,
    items: lightweightItems,
  });
}

/**
 * Main orchestrator function
 */
async function main() {
  const start = Date.now();
  logger.info("🚀 Store.nvim Crawler Starting");

  // Step 1: Crawl repositories
  const crawlResult = await crawlRepositories();
  if ("error" in crawlResult) {
    logger.error(
      `💥 Pipeline failed at repository discovery: ${crawlResult.error}`,
    );
    throw crawlResult.error;
  }

  // Step 2: Extract installation instructions
  const installResult = await generateInstallationInstructions(
    crawlResult.data,
  );
  if ("error" in installResult) {
    logger.error(
      `💥 Pipeline failed at installation extraction: ${installResult.error}`,
    );
    throw installResult.error;
  }
  const { data: install } = installResult;

  // Step 3: Process repository metadata with installation data
  const db = processRepositoriesData(crawlResult.data, install);
  db.meta.crawled_in_sec = Math.round((Date.now() - start) / 1000);

  // Apply natural filtering: plugins with installations first, then without, both sorted by pushed_at
  sortRepositories(db);
  logger.info(
    "✅ Applied natural filtering - prioritized recent updates and proper installation instructions",
  );

  const minifiedDb = compressDb(db);

  // Step 4: Save to filesystem full versions
  const saveResult = await saveToFilesystem({
    db,
    dbMinified: minifiedDb,
    install,
  });

  if ("error" in saveResult) {
    logger.error(`💥 Pipeline failed at filesystem save: ${saveResult.error}`);
    throw saveResult.error;
  }

  // Step 5: Update gist
  await updateGistDb(minifiedDb);

  logger.info(
    `🎉 Crawling completed successfully in ${Math.round((Date.now() - start) / 1000)}sec!
${db.meta.total_count} repositories processed`,
  );
}

main().catch((error) => {
  logger.error(`💥 Application error: ${error}`);
  throw error;
});
