import axios from "axios";
import { config } from "./config";
import type { YearRangeOptions } from "./types";
import { createLogger } from "./logger";

type GithubReadme = {
  content: string;
  encoding: string;
};

export type GithubRepository = {
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
};

type GithubSearchRepositories = {
  total_count: number;
  incomplete_results: boolean;
  items: GithubRepository[];
};

type GistUpdatePayload = {
  files: {
    [filename: string]: {
      content: string;
    };
  };
};

const logger = createLogger({ crawlerType: "github-client" });

const client = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    "User-Agent": "awesome-neovim-crawler",
    Accept: "application/vnd.github.v3+json",
    Authorization: `Bearer ${config.AUTH_TOKEN}`,
  },
});

export async function getRepositoryReadme(repo: string) {
  try {
    logger.processStart(`README fetch for ${repo}`);
    const response = await client.get<GithubReadme>(`/repos/${repo}/readme`);
    const content = Buffer.from(response.data.content, "base64").toString(
      "utf-8",
    );
    logger.processEnd(`Done fetching README for ${repo}`);
    return { data: content, error: null };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Failed to fetch README for ${repo}: ${errorMessage}`);

    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        logger.warn(`README not found for ${repo} (404)`);
      } else if (axiosError.response?.status === 403) {
        logger.error(
          `Access forbidden for ${repo} (403) - check token permissions`,
        );
      }
    }

    return { data: null, error };
  }
}

export async function searchRepositories(
  page: number,
  perPage: number = 100,
  options: YearRangeOptions = {},
) {
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  let query = "topic:neovim-plugin";

  try {
    logger.info(`Requesting page ${page}, perPage ${perPage}`);

    if (options.yearStart && options.yearEnd) {
      const startDate = options.yearStart.toISOString().split("T")[0];
      const endDate = options.yearEnd.toISOString().split("T")[0];
      query += ` created:${startDate}..${endDate}`;
    } else if (options.yearStart) {
      const startDate = options.yearStart.toISOString().split("T")[0];
      query += ` created:>=${startDate}`;
    } else if (options.yearEnd) {
      const endDate = options.yearEnd.toISOString().split("T")[0];
      query += ` created:<=${endDate}`;
    }

    const response = await client.get<GithubSearchRepositories>(
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

    logger.info("Rate limiting: waiting 10 seconds");
    await sleep(1000 * 10);

    logger.info(
      `Success - got ${response.data.items.length} items, total_count: ${response.data.total_count}`,
    );
    return { data: response.data, error: null };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(
      `Repository search failed for page ${page}/${perPage} with query "${query}": ${errorMessage}`,
    );

    // Add axios-specific error details
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as {
        response?: { status?: number; statusText?: string; data?: any };
      };
      if (axiosError.response) {
        logger.error(
          `HTTP ${axiosError.response.status} ${axiosError.response.statusText}`,
        );
        logger.debug(
          `Response body: ${JSON.stringify(axiosError.response.data, null, 2)}`,
        );
      }
    }

    return { data: null, error };
  }
}

export async function updateGist(gistId: string, payload: GistUpdatePayload) {
  try {
    logger.processStart(`gist ${gistId} update`);
    await client.patch(`/gists/${gistId}`, payload);
    logger.processEnd(`Updated gist ${gistId}`);
    return { error: null };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Failed to update gist ${gistId}: ${errorMessage}`);

    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        logger.error(`Gist ${gistId} not found (404)`);
      } else if (axiosError.response?.status === 403) {
        logger.error(
          `Access forbidden for gist ${gistId} (403) - check token permissions`,
        );
      }
    }

    return { error };
  }
}
