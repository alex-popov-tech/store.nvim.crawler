import { crawlAwesomeNvim } from "./awesomeNvim";
import { crawlGithub } from "./github";
import { GithubRepository } from "../sdk/github";
import { createLogger } from "../logger";
import { config } from "~/config";

const logger = createLogger({ context: "crawler orchestrator" });

// Constants
const YEAR_FROM = config.crawler.yearToPullPluginsFrom;
const TOPICS = config.crawler.topics;

/**
 * Run GitHub topic crawl
 */
async function runGithubCrawl() {
  logger.info("Starting GitHub topic crawl");
  const result = await crawlGithub({
    yearFrom: YEAR_FROM,
    topics: TOPICS,
  });

  if ("error" in result) {
    logger.error("GitHub crawl failed");
    return { error: result.error };
  }

  logger.info(`GitHub crawl completed with ${result.data.size} repositories`);
  return result;
}

/**
 * Run awesome-neovim crawl
 */
async function runAwesomeCrawl() {
  logger.info("Starting awesome-neovim crawl");
  const result = await crawlAwesomeNvim();

  if ("error" in result) {
    logger.error("Awesome-neovim crawl failed");
    return { error: result.error };
  }

  logger.info(
    `Awesome-neovim crawl completed with ${result.data.size} repositories`,
  );
  return result;
}

/**
 * Main crawling orchestrator
 * Combines results from GitHub topic search and awesome-neovim
 */
export async function crawl(): Promise<
  | { data: Map<string, GithubRepository> }
  | {
      error: any;
    }
> {
  logger.info("Starting: Unified crawler");

  // Run both crawlers in parallel
  const [githubResult, awesomeResult] = await Promise.all([
    runGithubCrawl(),
    runAwesomeCrawl(),
  ]);

  // Check for errors - both crawlers must succeed
  const githubFailed = "error" in githubResult;
  const awesomeFailed = "error" in awesomeResult;

  if (githubFailed || awesomeFailed) {
    const errors: any = {};
    if (githubFailed) errors.github = githubResult.error;
    if (awesomeFailed) errors.awesome = awesomeResult.error;

    logger.error("One or more crawlers failed - both are required");
    return { error: errors };
  }

  // Start with awesome repos as base (they have fuller info)
  const mergedRepos = new Map<string, GithubRepository>(awesomeResult.data);

  // Add GitHub repos that aren't in awesome list
  let addedCount = 0;
  for (const [repoName, githubRepo] of githubResult.data) {
    if (!mergedRepos.has(repoName)) {
      mergedRepos.set(repoName, githubRepo);
      addedCount++;
    }
  }

  logger.info(
    `Merge complete: ${awesomeResult.data.size} from awesome-neovim, ` +
      `${addedCount} additional from GitHub, ` +
      `${mergedRepos.size} total`,
  );

  // Return unified Map
  logger.info(`Crawling completed! Total repositories: ${mergedRepos.size}`);
  return { data: mergedRepos };
}
