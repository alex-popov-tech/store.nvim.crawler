import axios from "axios";
import { config } from "../config";
import { createLogger } from "../logger";

export type SearchOptions = {
  yearStart?: Date;
  yearEnd?: Date;
  topic: string;
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

const logger = createLogger({ context: "github-client" });

const client = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    "User-Agent": "awesome-neovim-crawler",
    Accept: "application/vnd.github.v3+json",
    Authorization: `Bearer ${config.AUTH_TOKEN}`,
  },
});

export async function getRepository(
  fullName: string,
): Promise<{ data: GithubRepository | null; error: any }> {
  try {
    logger.info(`Starting: Fetching repository ${fullName}`);
    const response = await client.get<GithubRepository>(`/repos/${fullName}`);
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

export async function getRepositoryReadme(repo: string) {
  logger.info(`Starting: README fetch for ${repo}`);

  // Try different combinations of branches and filenames
  const branches = ["main", "master"];
  const filenames = ["README.md", "readme.md"];

  for (const branch of branches) {
    for (const filename of filenames) {
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filename}`;

      try {
        const response = await axios.get(url);
        const content = response.data;
        logger.info(
          `Done fetching README for ${repo} from ${branch}/${filename}`,
        );
        return { data: content, error: null };
      } catch (error) {
        // Continue to next combination on 404, but log other errors
        if (error && typeof error === "object" && "response" in error) {
          const axiosError = error as { response?: { status?: number } };
          if (axiosError.response?.status === 404) {
            logger.debug(
              `README not found at ${branch}/${filename} for ${repo}`,
            );
            continue; // Try next combination
          } else if (axiosError.response?.status === 403) {
            logger.error(
              `Access forbidden for ${repo} at ${branch}/${filename} (403) - check token permissions`,
            );
            return { data: null, error };
          } else {
            logger.warn(
              `Unexpected error fetching ${repo} from ${branch}/${filename}: ${axiosError.response?.status}`,
            );
            continue; // Try next combination
          }
        } else {
          logger.warn(
            `Network error fetching ${repo} from ${branch}/${filename}: ${error}`,
          );
          continue; // Try next combination
        }
      }
    }
  }

  // If we get here, all combinations failed
  const errorMessage = `README not found for ${repo} in any of the tried locations`;
  logger.error(errorMessage);
  logger.warn(
    `Tried all combinations: ${branches.map((b) => filenames.map((f) => `${b}/${f}`).join(", ")).join(", ")}`,
  );

  return { data: null, error: new Error(errorMessage) };
}

export async function searchRepositories(
  page: number,
  perPage: number = 100,
  options: SearchOptions,
) {
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  let query = `topic:${options.topic}`;

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

  try {
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

    logger.info("Rate limiting: waiting 5 seconds");
    await sleep(1000 * 5);

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
    logger.info(`Starting: gist ${gistId} update`);
    await client.patch(`/gists/${gistId}`, payload);
    logger.info(`Updated gist ${gistId}`);
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
