#!/usr/bin/env node

import { crawl } from "~/crawlers";
import { getRepositoryReadme, GithubRepository, updateGist } from "~/sdk";
import { processors } from "~/processors";
import { config } from "~/config";
import { writeFileSync } from "fs";
import { createLogger } from "../src/logger";
import { ProcessedRepositories } from "~";
import { FormattedChunk } from "~/processors/readme/types";

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
      (repo) => !config.REPOSITORIES_BLACKLIST.some((bl) => bl(repo.full_name)),
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
): ProcessedRepositories {
  logger.info("⚙️ Starting: Repository Processing");

  const processedRepos = processors.repositories(repositories);

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
  const CHUNK_SIZE = 10;

  // Process repositories in chunks
  for (let i = 0; i < repositories.length; i += CHUNK_SIZE) {
    const chunk = repositories.slice(i, i + CHUNK_SIZE);
    const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(repositories.length / CHUNK_SIZE);

    logger.info(
      `📦 Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} repositories)`,
    );

    // Process all repositories in the chunk in parallel
    const chunkPromises = chunk.map(async (repo) => {
      const readme = await getRepositoryReadme(repo.full_name);
      if (readme.data) {
        const installations = processors.readme(repo.full_name, readme.data);
        return {
          repoName: repo.full_name,
          installations,
        };
      } else {
        return {
          repoName: repo.full_name,
          installations: [],
        };
      }
    });

    // Wait for all READMEs in the chunk to be processed
    const chunkResults = await Promise.all(chunkPromises);

    // Process results
    for (const result of chunkResults) {
      if (result.installations.length === 0) {
        logger.warn(`No installations found for ${result.repoName}`);
        continue;
      }
      readmeProcessed++;
      installData[result.repoName] = result.installations;
      logger.debug(
        `Found ${result.installations!.length} installation methods for ${result.repoName}`,
      );
    }
  }

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
 * Step 4: Save separate json's for plugins info, and readme's processing results
 */
function saveToFilesystem(args: {
  db: ProcessedRepositories;
  install: Record<string, FormattedChunk[]>;
  minifiedDb: string;
}): { error?: any } {
  logger.info("💾 Starting: Saving to Filesystem");

  try {
    writeFileSync(config.output.db, JSON.stringify(args.db, null, 2));
    logger.info("✅ Results written to db.json");

    writeFileSync(config.output.install, JSON.stringify(args.install, null, 2));
    logger.info("✅ Installation data written to install.json");

    writeFileSync(config.output.minifiedDb, args.minifiedDb);
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
    files: { "db.json": { content } },
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
  logger.info("🚀 Store.nvim Crawler Starting");

  // Step 1: Crawl repositories
  const crawlResult = await crawlRepositories();
  if ("error" in crawlResult) {
    logger.error(
      `💥 Pipeline failed at repository discovery: ${crawlResult.error}`,
    );
    throw crawlResult.error;
  }

  // Step 2: Process repository metadata
  const db = processRepositoriesData(crawlResult.data);

  // Step 3: Extract installation instructions
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

  for (const repo of db.items) {
    const options = installResult.data[repo.full_name];
    if (!options?.length) {
      continue;
    }
    const lazy = options.find((option) => option.pluginManager === "lazy.nvim");
    const packer = options.find(
      (option) => option.pluginManager === "packer.nvim",
    );
    const vimPlug = options.find(
      (option) => option.pluginManager === "vim-plug",
    );
    if (lazy) {
      repo.installationConfig = lazy.formatted;
    } else if (packer) {
      repo.installationConfig = packer.formatted;
    } else if (vimPlug) {
      repo.installationConfig = vimPlug.formatted;
    }
  }

  const minifiedDb = compressDb(db);

  // Step 4: Save to filesystem full versions
  const saveResult = saveToFilesystem({ db, minifiedDb, install });

  if ("error" in saveResult) {
    logger.error(`💥 Pipeline failed at filesystem save: ${saveResult.error}`);
    throw saveResult.error;
  }

  // Step 5: Update gist
  await updateGistDb(minifiedDb);

  logger.info(
    `🎉 Crawling completed successfully! ${db.meta.total_count} repositories processed`,
  );
}

main().catch((error) => {
  logger.error(`💥 Application error: ${error}`);
  throw error;
});
