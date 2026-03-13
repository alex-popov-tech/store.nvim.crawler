import axios from "axios";
import { config } from "../config";
import { createLogger } from "../logger";
import { utils } from "~/utils";
import { Repository } from "../pipeline/types";

export type SearchOptions = {
  yearStart?: Date;
  yearEnd?: Date;
  lastUpdateAfter?: Date;
  topic: string;
};

export type GithubRepository = {
  created_at: string;
  full_name: string;
  description: string | null;
  homepage: string | null;
  html_url: string;
  stargazers_count: number;
  watchers_count: number;
  open_issues_count: number;
  forks_count: number;
  pushed_at: string;
  topics: string[];
  archived: boolean;
  default_branch: string;
};

export type GithubTreeItem = {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
};


type GithubSearchRepositories = {
  total_count: number;
  incomplete_results: boolean;
  items: GithubRepository[];
};


const logger = createLogger({ context: "github-client" });

const client = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    "User-Agent": "awesome-neovim-crawler",
    Accept: "application/vnd.github.v3+json",
    Authorization: `Bearer ${config.GITHUBB_TOKEN}`,
  },
});

// Rate-limit aware axios wrapper
const rateLimitClient = {
  get<T = any>(url: string, config?: any): Promise<any> {
    return rateLimitClient.request({ method: 'GET', url, ...config });
  },

  async request(config: any): Promise<any> {
    let response;

    try {
      response = await client.request(config);
    } catch (error: any) {
      if (error.response) {
        response = await rateLimitClient.handleRateLimit(error.response, () => client.request(config));
        if (response !== error.response) {
          return response;
        }
      }
      throw error;
    }

    response = await rateLimitClient.handleRateLimit(response, () => client.request(config));
    return response;
  },

  async handleRateLimit(response: any, retryRequest: () => Promise<any>): Promise<any> {
    const headers = response.headers;
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '0');
    const reset = headers['x-ratelimit-reset'];
    const resource = headers['x-ratelimit-resource'] || 'core';

    // Enhanced logging for all search API requests
    if (resource === 'search') {
      logger.info(`🔍 Search API: ${remaining} requests remaining (status: ${response.status})`);
    }

    if (response.status === 403 || response.status === 429) {
      // Check if we're hitting rate limits
      if (remaining < 100 && reset) {
        const resetTimestamp = parseInt(reset) * 1000;
        const now = Date.now();
        const randomBuffer = 1000 + Math.random() * 4000; // 1-5 seconds
        const waitTime = resetTimestamp - now + randomBuffer;

        if (waitTime > 0) {
          const resetDate = new Date(resetTimestamp);
          logger.warn(`🚨 GitHub rate limit hit for ${resource} (${remaining} remaining). Waiting ${Math.round(waitTime/1000)}s until ${resetDate.toISOString()}`);

          await new Promise(resolve => setTimeout(resolve, waitTime));

          logger.info(`✅ Rate limit reset for ${resource}, retrying request`);
          return retryRequest();
        }
      }
    }

    // Log warnings for low rate limits on successful requests
    if (response.status >= 200 && response.status < 300) {
      if (resource === 'search' && remaining <= 10) {
        const reset = response.headers['x-ratelimit-reset'];
        const resetDate = new Date(parseInt(reset) * 1000);
        logger.warn(`⚠️  Search API rate limit VERY low: ${remaining} requests remaining until ${resetDate.toISOString()}`);
      } else if (resource === 'core' && remaining < 200) {
        const reset = response.headers['x-ratelimit-reset'];
        const resetDate = new Date(parseInt(reset) * 1000);
        logger.warn(`⚠️  Core API rate limit low: ${remaining} requests remaining until ${resetDate.toISOString()}`);
      }
    }

    return response;
  }
};

export async function getRepository(
  fullName: string,
): Promise<{ data: GithubRepository | null; error: any }> {
  try {
    logger.info(`Starting: Fetching repository ${fullName}`);
    const response = await rateLimitClient.get<GithubRepository>(`/repos/${fullName}`);
    logger.info(`Done fetching repository ${fullName}`);
    return { data: response.data, error: null };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Failed to fetch repository ${fullName}: ${errorMessage}`);

    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        logger.warn(`Repository not found ${fullName} (404)`);
      } else if (axiosError.response?.status === 403) {
        logger.error(
          `Access forbidden for ${fullName} (403) - check token permissions`,
        );
      }
    }

    return { data: null, error };
  }
}

export async function getRepositoryReadme(
  repository: Repository,
): Promise<{ data: string; readmePath: string } | { error: string }> {
  const { full_name, branch } = repository;
  logger.info(`Starting: README fetch for ${full_name}`);

  const filenames = config.pipeline.crawler.readmes;

  for (const filename of filenames) {
    const url = `https://raw.githubusercontent.com/${full_name}/${branch}/${filename}`;

    const response = await axios.get(url, { validateStatus: () => true });

    if (response.status === 200) {
      const content = response.data;
      logger.info(
        `Done fetching README for ${full_name} from ${branch}/${filename}`,
      );
      if (filename.endsWith(".adoc")) {
        return {
          data: utils.adocToMarkdown(content),
          readmePath: `${branch}/${filename}`,
        };
      }
      return { data: content, readmePath: `${branch}/${filename}` };
    }
  }

  return {
    error: `README not found for ${full_name} in branch ${branch}`,
  };
}

export async function drainSearchRepositories(
  query: string,
): Promise<GithubRepository[]> {
  const perPage = 100;

  logger.info(`Starting to drain query: "${query}"`);

  try {
    // Step 1: Get first page to discover pagination info
    const firstResponse = await rateLimitClient.get<GithubSearchRepositories>(
      "/search/repositories",
      {
        params: {
          q: query,
          per_page: perPage,
          page: 1,
          sort: "updated",
          order: "desc",
        },
      },
    );

    const { items: firstPageItems, total_count } = firstResponse.data;

    // Hard fail if we hit the GitHub API 1000 result limit
    if (total_count >= 1000) {
      const errorMsg = `Query "${query}" returned ${total_count} repositories, exceeding GitHub's 1000 result limit. Please refine the query.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    logger.info(
      `Fetched ${firstPageItems.length} repos, ${firstPageItems.length}/${total_count} total for "${query}"`,
    );

    // Early return if only one page
    if (firstPageItems.length < perPage || firstPageItems.length === 0) {
      logger.info(`Completed draining "${query}": found ${firstPageItems.length} repositories`);
      return firstPageItems;
    }

    // Step 2: Calculate remaining pages needed and fetch sequentially
    const totalPages = Math.ceil(Math.min(total_count, 1000) / perPage);
    const remainingPages = Array.from({length: totalPages - 1}, (_, i) => i + 2);

    logger.info(
      `Query "${query}" has ${totalPages} pages total, fetching ${remainingPages.length} remaining pages sequentially`,
    );

    // Step 3: Sequential fetch all remaining pages
    const pageResults: GithubRepository[][] = [];

    for (const page of remainingPages) {
      logger.debug(`Fetching page ${page} for "${query}"`);
      const response = await rateLimitClient.get<GithubSearchRepositories>(
        "/search/repositories",
        {
          params: {
            q: query,
            per_page: perPage,
            page: page,
            sort: "updated",
            order: "desc",
          },
        },
      );

      const { items } = response.data;
      logger.debug(`Fetched page ${page}: ${items.length} repos for "${query}"`);
      pageResults.push(items);
    }

    // Step 4: Combine all results
    const allRepos = [firstPageItems, ...pageResults].flat();

    logger.info(`Completed draining "${query}": found ${allRepos.length} repositories`);
    return allRepos;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error(`Repository search failed for query "${query}": ${errorMessage}`);
    throw error;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getRepositoryTree(
  fullName: string,
  branch: string,
): Promise<{ data: GithubTreeItem[] } | { error: any }> {
  try {
    logger.info(`Starting: Fetching tree for ${fullName}@${branch}`);
    const response = await rateLimitClient.get(
      `/repos/${fullName}/git/trees/${branch}?recursive=1`
    );
    logger.info(`Done fetching tree for ${fullName}@${branch}`);
    return { data: response.data.tree || [] };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Failed to fetch tree for ${fullName}@${branch}: ${errorMessage}`);
    return { error };
  }
}

export async function getRepositoryDocFile(
  repository: Repository,
): Promise<{ docPaths: string[] } | { error: string }> {
  const { full_name, branch } = repository;
  logger.info(`Starting: doc file lookup for ${full_name}`);

  try {
    const response = await rateLimitClient.get(
      `/repos/${full_name}/contents/doc`,
      { params: { ref: branch } },
    );

    const items: { name: string; type: string }[] = response.data;
    if (!Array.isArray(items)) {
      return { error: `Unexpected response for doc listing of ${full_name}` };
    }

    const txtFiles = items
      .filter((item) => item.type === "file" && item.name.endsWith(".txt"))
      .map((item) => item.name)
      .sort();

    if (txtFiles.length === 0) {
      return { error: `No .txt files in doc/ for ${full_name}` };
    }

    const docPaths = txtFiles.map(f => `${branch}/doc/${f}`);
    logger.info(`Found ${docPaths.length} doc file(s) for ${full_name}: ${docPaths.join(", ")}`);
    return { docPaths };
  } catch {
    return { error: `Failed to list doc/ for ${full_name}` };
  }
}

export async function fetchPublicContent(url: string): Promise<{ content: string } | { error: any }> {
  logger.info(`Starting: public content fetch from ${url}`);
  const response = await axios.get(url, {
    validateStatus: () => true,
    timeout: 30000,
    responseType: 'text',
    maxRedirects: 5,
  });

  if (response.status === 404) {
    logger.warn(`Not found (404): ${url}`);
    return { content: "" };
  }

  if (response.status >= 200 && response.status < 300) {
    logger.info(`Fetched public content, size: ${response.data.length} bytes`);
    return { content: response.data };
  }

  logger.error(`Failed to fetch public content: HTTP ${response.status}`);
  return { error: `HTTP ${response.status}: ${response.statusText}` };
}
