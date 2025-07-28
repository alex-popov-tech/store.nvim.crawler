import { crawlAwesomeNvim } from "./awesomeNvim";
import { crawlGithub } from "./github";
import { getRepository, GithubRepository } from "../sdk/github";
import { createLogger } from "../logger";
import { config } from "~/config";

const logger = createLogger({ context: "crawler orchestrator" });

// Constants
const YEAR_FROM = config.crawler.yearToPullPluginsFrom;
const TOPICS = config.crawler.topics;

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

  // 1. Crawl GitHub with multiple topics
  logger.info("Starting GitHub topic crawl");
  const githubResult = await crawlGithub({
    yearFrom: YEAR_FROM,
    topics: TOPICS,
  });
  if (!githubResult.data) {
    logger.error("GitHub crawl failed");
    return { error: githubResult.error };
  }

  // 2. Crawl awesome-neovim
  logger.info("Starting awesome-neovim crawl");
  const awesomeResult = await crawlAwesomeNvim();
  if (!awesomeResult.data) {
    logger.error("Awesome-neovim crawl failed");
    return { error: awesomeResult.error };
  }

  // 3. Merge results (update topics for duplicates)
  logger.info("Merging results from both sources");
  const mergedRepos = new Map<string, GithubRepository>(githubResult.data);

  for (const [repoName, awesomeRepo] of awesomeResult.data) {
    // if repo is in awesome-nvim list, but not crawled in github - manually add it
    if (!mergedRepos.has(repoName)) {
      const repo = await getRepository(repoName);
      if (repo.error) {
        logger.warn(
          `Failed to fetch full data for ${repoName} because of ${repo.error}`,
        );
        continue;
      }

      repo.data!.topics = [
        ...new Set([...repo.data!.topics, ...awesomeRepo.topics]),
      ];
      mergedRepos.set(repoName, repo.data!);
      continue;
    }

    // if repo crawled from github and present in awesome-list, update only topics
    const existingRepo = mergedRepos.get(repoName)!;
    existingRepo.topics = [
      ...new Set([...existingRepo.topics, ...awesomeRepo.topics]),
    ];
    logger.debug(
      `Merged topics for ${repoName}: ${existingRepo.topics.join(", ")}`,
    );
  }

  // 5. Return unified Map
  logger.info(`Crawling completed! Total repositories: ${mergedRepos.size}`);
  return { data: mergedRepos };
}
