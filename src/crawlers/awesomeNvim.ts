import {
  getRepositoryReadme,
  getRepository,
  GithubRepository,
} from "../sdk/github";
import { createLogger } from "../logger";

type ParsedRepo = {
  full_name: string;
  topics: string[];
};

const AWESOME_NEOVIM_REPO = "rockerBOO/awesome-neovim";
const logger = createLogger({ context: "awesome neovim crawler" });

// Helper function to process repositories in batches with concurrency control
async function processRepositoriesInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R | null>,
  batchSize: number = 10,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));

    // Filter out null results
    for (const result of batchResults) {
      if (result !== null) {
        results.push(result);
      }
    }

    if (i + batchSize < items.length) {
      logger.info(`Processed ${i + batchSize}/${items.length} repositories`);
    }
  }

  return results;
}

function parseAwesomeNvimReadme(readmeContent: string) {
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
        logger.info(`Processing category: ${title}`);
      } else if (level === 3) {
        // Subcategory (### LSP Installer, ### Diagnostics, etc.)
        currentTags = [currentTags[0], title];
        logger.info(`Processing subcategory: ${title}`);
      } else if (level === 4) {
        // Sub-subcategory
        // Ensure we have at least 2 levels before adding a third
        if (currentTags.length === 1) {
          // If we only have main category, add placeholder as intermediate level
          currentTags = [currentTags[0], "EMPTY_TAG", title];
        } else {
          currentTags = [currentTags[0], currentTags[1], title];
        }
        logger.info(`Processing sub-subcategory: ${title}`);
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

export async function crawlAwesomeNvim(): Promise<
  { data: Map<string, GithubRepository> } | { error: any }
> {
  logger.info("Starting: awesome-neovim crawler");

  const readmeResult = await getRepositoryReadme(AWESOME_NEOVIM_REPO);
  if (readmeResult.error) {
    logger.error("Failed to fetch content from rockerBOO/awesome-neovim");
    return { error: readmeResult.error };
  }

  const parsedRepos = parseAwesomeNvimReadme(readmeResult.data);

  logger.info(
    `Fetching full repository data for ${parsedRepos.size} repositories`,
  );

  // Convert map to array for processing
  const repoEntries = Array.from(parsedRepos.entries());

  // Process repositories in batches to fetch full data
  const validRepos = await processRepositoriesInBatches(
    repoEntries,
    async ([repoName, parsedRepo]) => {
      const result = await getRepository(repoName);

      if (result.error) {
        logger.error(
          `Failed to fetch repository data for ${repoName}: ${result.error}`,
        );
        return null;
      }

      if (!result.data) {
        logger.warn(`No data returned for repository ${repoName}`);
        return null;
      }

      // At this point, result.data is guaranteed to be valid
      const repo = result.data;

      // Check if repository topics include 'neovim' or 'nvim'
      const isNvimPlugin = repo.topics.some(
        (topic) =>
          topic.toLowerCase().includes("neovim") ||
          topic.toLowerCase().includes("nvim"),
      );

      if (!isNvimPlugin) {
        logger.warn(
          `Skipping ${repoName} - not a neovim plugin (topics: ${repo.topics.join(", ")})`,
        );
        return null;
      }

      // Add awesome tags to repository topics
      repo.topics = [...new Set([...repo.topics, ...parsedRepo.topics])];

      return repo;
    },
    10, // Process 10 repositories concurrently
  );

  // Convert back to map
  const resultMap = new Map<string, GithubRepository>();
  for (const repo of validRepos) {
    resultMap.set(repo.full_name, repo);
  }

  logger.info(
    `awesome-neovim crawler completed! Found ${resultMap.size} valid neovim repositories (filtered from ${parsedRepos.size})`,
  );

  return { data: resultMap };
}
