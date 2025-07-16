#!/usr/bin/env node

import { crawlAwesomeNvim } from "./crawlers/awesomeNvim";
import { crawlGithub } from "./crawlers/github";
import { GithubRepository, updateGist } from "./github-client";
import { processRepositories } from "./processing";
import { ProcessedRepositories } from "./types";
import { writeFileSync } from "fs";
import { config } from "./config";
import { createLogger } from "./logger";

const logger = createLogger({ crawlerType: "main" });

// for gist, we leave only info required by plugin,
// some additional data is saved only in artifacts for debugging
function createLightweightVersion(
  processedRepositories: ProcessedRepositories,
): unknown {
  const lightweightItems = processedRepositories.items.map((repo) => {
    const {
      topics,
      forks_count,
      open_issues_count,
      ...lightweightRepo
    } = repo;
    return lightweightRepo;
  });

  return {
    meta: processedRepositories.meta,
    items: lightweightItems,
  };
}

async function main() {
  logger.processStart("crawler application");
  const awesomeNvimCrawlResult = await crawlAwesomeNvim();
  if (awesomeNvimCrawlResult.error) {
    throw awesomeNvimCrawlResult.error;
  }
  logger.info(
    `Found ${awesomeNvimCrawlResult.data!.size} repositories from awesome-nvim`,
  );

  const githubCrawlResult = await crawlGithub();
  if (githubCrawlResult.error) {
    throw githubCrawlResult.error;
  }
  logger.info(`Found ${githubCrawlResult.data!.size} repositories from GitHub`);

  const crawledRepositories = [] as GithubRepository[];

  for (const [full_name, repo] of githubCrawlResult.data!.entries()) {
    // awesome has same info, only difference are tags parsed from readme
    const awesomeRepo = awesomeNvimCrawlResult.data!.get(full_name);
    crawledRepositories.push({
      ...repo,
      topics: [...new Set([...repo.topics, ...(awesomeRepo?.topics ?? [])])],
    });
  }

  const processedRepositories = processRepositories(crawledRepositories);
  logger.info(
    `Processed ${processedRepositories.meta.total_count} total repositories`,
  );

  if (config.UPDATE_FS) {
    writeFileSync(
      config.OUTPUT_FILENAME,
      JSON.stringify(processedRepositories, null, 2),
    );
    logger.info("Results written to crawler_results.json");
  }

  if (config.UPDATE_GIST) {
    const lightweightVersion = createLightweightVersion(processedRepositories);
    const gistResult = await updateGist(config.GIST_ID, {
      files: {
        [config.OUTPUT_FILENAME]: {
          content: JSON.stringify(lightweightVersion, null, 2),
        },
      },
    });

    if (gistResult.error) {
      logger.error(`Failed to update gist: ${gistResult.error}`);
      process.exit(1);
    }
  }

  logger.processEnd(
    `Complete! ${processedRepositories.meta.total_count} repositories processed`,
  );
}

main().catch((error) => {
  logger.error(`Application error: ${error.message}`);
  process.exit(1);
});
