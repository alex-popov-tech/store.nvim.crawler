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
  installationData: Record<string, FormattedChunk[]>,
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
): Promise<{ data: Record<string, FormattedChunk[]> } | { error: any }> {
  logger.info("📖 Starting: Installation Data Extraction");

  const installData: Record<string, FormattedChunk[]> = {};
  let readmeProcessed = 0;
  let readmeFailed = 0;

  // Create a limit function with the configured concurrency
  const limit = pLimit(config.crawler.concurrentRequestsLimit);

  logger.info(
    `Processing ${repositories.length} repositories with concurrency limit of ${config.crawler.concurrentRequestsLimit}`,
  );

  // Create all promises with p-limit
  const promises = repositories.map((repo, index) =>
    limit(async () => {
      try {
        const readme = await getRepositoryReadme(repo.full_name);

        if (readme.data) {
          const installations = processors.readme(repo.full_name, readme.data);

          if (installations.length > 0) {
            readmeProcessed++;
            installData[repo.full_name] = installations;
            logger.info(
              `[${index + 1}/${repositories.length}] Found ${installations.length} installation methods for ${repo.full_name}`,
            );
          } else {
            logger.warn(
              `[${index + 1}/${repositories.length}] No installations found for ${repo.full_name}`,
            );
          }
        } else {
          readmeFailed++;
          logger.warn(
            `[${index + 1}/${repositories.length}] Failed to fetch README for ${repo.full_name}`,
          );
        }
      } catch (error) {
        readmeFailed++;
        logger.error(
          `[${index + 1}/${repositories.length}] Error processing ${repo.full_name}: ${error}`,
        );
      }
    }),
  );

  // Wait for all processing to complete
  await Promise.all(promises);

  logger.info(
    `✅ Processed ${readmeProcessed} READMEs, ${readmeFailed} failed`,
  );
  logger.info(
    `Found installation data for ${Object.keys(installData).length} repositories`,
  );
  logger.info("Installation data extraction completed");

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
  install: Record<string, FormattedChunk[]>;
  minifiedDb: string;
}): Promise<{ error?: any }> {
  logger.info("💾 Starting: Saving to Filesystem");

  try {
    const stats = await stat(config.output.dir);
    // create dir if it doesn't exist
    if (!stats.isDirectory()) {
      await mkdir(config.output.dir);
    }

    await writeFile(
      `${config.output.dir}/${config.output.db}`,
      JSON.stringify(args.db, null, 2),
    );
    logger.info("✅ Results written to db.json");

    writeFile(
      `${config.output.dir}/${config.output.install}`,
      JSON.stringify(args.install, null, 2),
    );
    logger.info("✅ Installation data written to install.json");

    writeFile(
      `${config.output.dir}/${config.output.minifiedDb}`,
      args.minifiedDb,
    );
    logger.info("✅ Results written to db_minified.json");

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
    files: { [config.output.minifiedDb]: { content } },
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
  const saveResult = await saveToFilesystem({ db, minifiedDb, install });

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
