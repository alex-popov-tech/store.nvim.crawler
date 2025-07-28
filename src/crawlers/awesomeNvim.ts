import { getRepositoryReadme } from "../sdk/github";
import { createLogger } from "../logger";

type ParsedRepo = {
  full_name: string;
  topics: string[];
};

const AWESOME_NEOVIM_REPO = "rockerBOO/awesome-neovim";
const logger = createLogger({ context: "awesome neovim crawler" });

function parseAwesomeNvimReadme(readmeContent: string) {
  const githubUrlRegex =
    /\[([^\]]+)\]\(https:\/\/github\.com\/([^\/\s\)]+)\/([^\/\s\)]+)\)/g;
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
      logger.debug(`Found Contents section at line ${processedLines}`);
      continue;
    }

    if (!inContentsSection) continue;

    // Stop when we reach External section
    if (line.trim() === "## External") {
      logger.debug(`Reached External section at line ${processedLines}`);
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

    // Extract GitHub URLs from current line (can be multiple per line)
    let match;
    while ((match = githubUrlRegex.exec(line)) !== null) {
      const [, , owner, repo] = match;

      // Skip certain types of links
      if (owner === "github" || repo.includes("#") || repo.includes("?")) {
        continue;
      }

      repos.set(`${owner}/${repo}`, {
        full_name: `${owner}/${repo}`,
        topics: ["awesome", ...currentTags]
          .filter((tag) => tag && tag !== "EMPTY_TAG")
          .map((it) => it.toLowerCase()),
      });
    }

    // Reset regex lastIndex for next line
    githubUrlRegex.lastIndex = 0;
  }

  logger.info(`Completed parsing. Found ${repos.size} repositories`);
  return repos;
}

export async function crawlAwesomeNvim() {
  logger.info("Starting: awesome-neovim crawler");

  const readmeResult = await getRepositoryReadme(AWESOME_NEOVIM_REPO);
  if (readmeResult.error) {
    logger.error("Failed to fetch content from rockerBOO/awesome-neovim");
    return { data: null, error: readmeResult.error };
  }

  const repos = parseAwesomeNvimReadme(readmeResult.data!);

  logger.info(
    `awesome-neovim crawler completed! Found ${repos.size} repositories`,
  );

  return { data: repos, error: null };
}
