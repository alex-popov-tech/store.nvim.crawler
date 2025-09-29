import {
  getRepositoryReadme,
  getRepository,
  GithubRepository,
} from "~/sdk/github";
import { createLogger } from "~/logger";
import pLimit from "p-limit";
import { config } from "~/config";

type ParsedRepo = {
  full_name: string;
  topics: string[];
};

const AWESOME_NEOVIM_REPO = "rockerBOO/awesome-neovim";
const logger = createLogger({ context: "awesome-neovim-crawler-v2" });

function parseAwesomeNvimReadme(
  readmeContent: string,
): Map<string, ParsedRepo> {
  const githubUrlRegex =
    /\[([^\]]+)\]\(https:\/\/github\.com\/([^\/\s\)]+)\/([^\/\s\)]+)\)/;
  const repos = new Map<string, ParsedRepo>();
  const lines = readmeContent.split("\n");

  let currentTags: string[] = [];
  let inContentsSection = false;
  let processedLines = 0;

  logger.info(`Parsing ${lines.length} lines from README`);

  for (const line of lines) {
    processedLines++;
    if (processedLines % 100 === 0) {
      logger.info(`Parsing line ${processedLines}/${lines.length}`);
    }

    // Skip until we reach the Contents section
    if (line.trim() === "## Contents") {
      inContentsSection = true;
      logger.info(`Found Contents section at line ${processedLines}`);
      continue;
    }

    if (!inContentsSection) continue;

    // Stop when we reach External section
    if (line.trim() === "## External") {
      logger.info(`Reached External section at line ${processedLines}`);
      break;
    }

    // Parse headings to track current tags
    const headingMatch = line.match(/^(#+)\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();

      // Skip certain meta headings
      if (title.includes("requires Neovim") || title.includes("back to top")) {
        continue;
      }

      // Adjust tags array based on heading level
      if (level === 2) {
        // Main category (## LSP, ## Plugin Manager, etc.)
        currentTags = [title];
        logger.debug(`Processing category: ${title}`);
      } else if (level === 3) {
        // Subcategory (### LSP Installer, ### Diagnostics, etc.)
        currentTags = [currentTags[0], title];
        logger.debug(`Processing subcategory: ${title}`);
      } else if (level === 4) {
        // Sub-subcategory
        // Ensure we have at least 2 levels before adding a third
        if (currentTags.length === 1) {
          // If we only have main category, add placeholder as intermediate level
          currentTags = [currentTags[0], "EMPTY_TAG", title];
        } else {
          currentTags = [currentTags[0], currentTags[1], title];
        }
        logger.debug(`Processing sub-subcategory: ${title}`);
      }
      continue;
    }

    // Extract only the first GitHub URL from current line
    const match = line.match(githubUrlRegex);
    if (match) {
      const [, , owner, repo] = match;

      // Skip certain types of links
      if (owner === "github" || repo.includes("#") || repo.includes("?")) {
        continue;
      }

      // Only store if not already present (first occurrence wins)
      const repoKey = `${owner}/${repo}`;
      if (!repos.has(repoKey)) {
        repos.set(repoKey, {
          full_name: repoKey,
          topics: ["awesome", ...currentTags]
            .filter((tag) => tag && tag !== "EMPTY_TAG")
            .map((it) => it.toLowerCase()),
        });
      }
    }
  }

  logger.info(`Completed parsing. Found ${repos.size} repositories`);
  return repos;
}

export async function crawl(): Promise<Map<string, GithubRepository>> {
  logger.info("Starting awesome-neovim crawler");

  // Fetch README from awesome-neovim repository
  const readmeResult = await getRepositoryReadme({
    full_name: AWESOME_NEOVIM_REPO,
    branch: "main",
  } as unknown as any);
  if ("error" in readmeResult) {
    throw new Error(
      `Failed to fetch README from ${AWESOME_NEOVIM_REPO}: ${readmeResult.error}`,
    );
  }

  // Parse repositories from README
  const parsedRepos = parseAwesomeNvimReadme(readmeResult.data);

  logger.info(
    `Fetching repository data for ${parsedRepos.size} repositories with concurrency limit of ${config.pipeline.crawler.concurrentRequestsLimit}`,
  );

  // Create concurrency limiter
  const limit = pLimit(config.pipeline.crawler.concurrentRequestsLimit);

  // Convert map to array for processing
  const repoEntries = Array.from(parsedRepos.entries());

  // Process all repositories with concurrency control
  const promises = repoEntries.map(([repoName, parsedRepo]) =>
    limit(async () => {
      const result = await getRepository(repoName);

      // Handle errors (including 404s)
      if (result.error) {
        logger.debug(`Skipping ${repoName}: ${result.error}`);
        return null;
      }

      if (!result.data) {
        logger.warn(`No data returned for repository ${repoName}`);
        return null;
      }

      const repo = result.data;

      // Merge topics from README parsing with repository topics
      repo.topics = [...new Set([...repo.topics, ...parsedRepo.topics])];

      logger.debug(
        `Successfully fetched ${repoName} with ${repo.topics.length} topics`,
      );
      return repo;
    }),
  );

  // Wait for all promises and filter out null results
  const results = await Promise.all(promises);
  const validRepos = results.filter(
    (repo): repo is GithubRepository => repo !== null,
  );

  // Convert to map keyed by full_name
  const resultMap = new Map<string, GithubRepository>();
  for (const repo of validRepos) {
    resultMap.set(repo.full_name, repo);
  }

  const skippedCount = parsedRepos.size - resultMap.size;
  logger.info(
    `Awesome-neovim crawler completed! ` +
      `Fetched ${resultMap.size} repositories, skipped ${skippedCount} (404s or errors)`,
  );

  return resultMap;
}

