import axios from "axios";
import { config } from "../config";
import { createLogger } from "../logger";
import { utils } from "~/utils";

export type SearchOptions = {
  yearStart?: Date;
  yearEnd?: Date;
  lastUpdateAfter?: Date;
  topic: string;
};

export type GitlabRepository = {
  id: number;
  path_with_namespace: string;
  name: string;
  description: string | null;
  web_url: string;
  homepage: string | null;
  default_branch: string;
  created_at: string;
  last_activity_at: string;
  updated_at: string | null;
  star_count: number;
  forks_count: number;
  open_issues_count: number;
  topics: string[];
  archived: boolean;
  readme_url?: string; // Direct URL to README from GitLab
  tag_list: string[]; // Raw GitLab field
  owner: {
    id: number;
    username: string;
    name: string;
    state: string;
    locked: boolean;
    avatar_url: string;
    web_url: string;
    public_email?: string;
  };
  _links: {
    self: string;
    issues: string;
    merge_requests: string;
    repo_branches: string;
    labels: string;
    events: string;
    members: string;
    cluster_agents: string;
  };
  namespace: {
    id: number;
    name: string;
    path: string;
    kind: string;
    full_path: string;
    parent_id: number | null;
    avatar_url: string;
    web_url: string;
  };
};

export type GitlabTreeItem = {
  id: string;
  name: string;
  type: "tree" | "blob";
  path: string;
  mode: string;
};

type SearchRepositories = {
  total_count?: number;
  items: GitlabRepository[];
};

const logger = createLogger({ context: "gitlab-client" });

// GitLab API client setup
const client = axios.create({
  baseURL: "https://gitlab.com/api/v4",
  headers: {
    "User-Agent": "awesome-neovim-crawler",
    "Content-Type": "application/json",
    ...(config.GITLAB_TOKEN && {
      Authorization: `Bearer ${config.GITLAB_TOKEN}`,
    }),
  },
  validateStatus: () => true, // Don't throw on non-200 status codes
});

export async function getRepository(
  projectId: string | number,
): Promise<{ data: GitlabRepository } | { error: string }> {
  logger.info(`Starting: Fetching GitLab project ${projectId}`);

  const response = await client.get<GitlabRepository>(
    `/projects/${encodeURIComponent(projectId)}`,
  );

  if (response.status === 200) {
    logger.info(`Done fetching GitLab project ${projectId}`);
    return { data: response.data };
  }

  const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  logger.error(`Failed to fetch GitLab project ${projectId}: ${errorMessage}`);

  if (response.status === 404) {
    return { error: `GitLab project not found: ${projectId}` };
  }

  if (response.status === 403) {
    return {
      error: `Access forbidden for GitLab project ${projectId} - check token permissions`,
    };
  }

  return { error: errorMessage };
}

export async function getRepositoryReadme(
  readmeUrl: string,
): Promise<{ data: string; readmePath: string } | { error: string }> {
  logger.info(`Starting: README fetch from URL ${readmeUrl}`);

  // Convert GitLab blob URL to raw URL for direct fetch
  // https://gitlab.com/user/repo/-/blob/branch/readme.md -> https://gitlab.com/user/repo/-/raw/branch/readme.md
  const rawUrl = readmeUrl.replace("/-/blob/", "/-/raw/");

  logger.info(`Fetching README from: ${rawUrl}`);

  // Use axios directly for the raw file with flat error handling
  const axiosClient = axios.create({
    headers: {
      "User-Agent": "awesome-neovim-crawler",
    },
    validateStatus: () => true, // Don't throw on non-200 status codes
  });

  const response = await axiosClient.get(rawUrl);

  if (response.status === 200) {
    const content = response.data;

    // Extract path from URL for reporting
    const urlParts = readmeUrl.split("/-/blob/");
    const readmePath = urlParts[1] || "readme.md";

    logger.info(`Done fetching README from URL: ${readmePath}`);

    if (readmePath.endsWith(".adoc")) {
      return {
        data: utils.adocToMarkdown(content),
        readmePath,
      };
    }
    return { data: content, readmePath };
  }

  const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  logger.error(`Failed to fetch README from ${rawUrl}: ${errorMessage}`);

  if (response.status === 404) {
    return { error: `README not found at URL: ${readmeUrl}` };
  }

  return { error: errorMessage };
}

export async function searchRepositories(
  page: number,
  perPage: number = 100,
  options: SearchOptions,
): Promise<{ data: SearchRepositories } | { error: string }> {
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  logger.info(`Requesting GitLab page ${page}, perPage ${perPage}`);

  const params: any = {
    topic: options.topic,
    per_page: perPage,
    page: page,
    order_by: "updated_at",
    sort: "desc",
    simple: false,
    membership: false,
  };

  if (options.yearStart && options.yearEnd) {
    params.created_after = options.yearStart.toISOString().split("T")[0];
    params.created_before = options.yearEnd.toISOString().split("T")[0];
  } else if (options.yearStart) {
    params.created_after = options.yearStart.toISOString().split("T")[0];
  } else if (options.yearEnd) {
    params.created_before = options.yearEnd.toISOString().split("T")[0];
  }

  if (options.lastUpdateAfter) {
    params.last_activity_after = options.lastUpdateAfter
      .toISOString()
      .split("T")[0];
  }

  const response = await client.get<GitlabRepository[]>("/projects", {
    params,
  });

  if (response.status === 200) {
    const items = response.data.map((repo) => {
      repo.topics = repo.tag_list || [];
      return repo;
    });

    logger.info("Rate limiting: waiting 2 seconds for GitLab");
    await sleep(2000);

    logger.info(`Success - got ${items.length} items from GitLab`);

    return {
      data: {
        items,
        total_count: items.length,
      },
    };
  }

  const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  logger.error(
    `GitLab repository search failed for page ${page}/${perPage} with topic "${options.topic}": ${errorMessage}`,
  );

  if (response.status === 403) {
    return { error: `Access forbidden - check GitLab token permissions` };
  }

  if (response.status === 401) {
    return { error: `Unauthorized - invalid GitLab token` };
  }

  return { error: errorMessage };
}

export async function getRepositoryTree(
  projectId: string | number,
  ref: string = "main",
): Promise<{ data: GitlabTreeItem[] } | { error: string }> {
  logger.info(`Starting: Fetching GitLab repository tree for ${projectId}`);

  const response = await client.get<GitlabTreeItem[]>(
    `/projects/${encodeURIComponent(projectId)}/repository/tree`,
    {
      params: {
        ref,
        recursive: true,  // Enable recursive to get all files
        per_page: 100,
      },
    },
  );

  if (response.status === 200) {
    logger.info(`Done fetching GitLab repository tree for ${projectId}`);
    return { data: response.data };
  }

  const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  logger.error(
    `Failed to fetch GitLab repository tree ${projectId}: ${errorMessage}`,
  );

  if (response.status === 404) {
    return { error: `GitLab repository tree not found: ${projectId}` };
  }

  if (response.status === 403) {
    return {
      error: `Access forbidden for GitLab repository tree ${projectId} - check token permissions`,
    };
  }

  return { error: errorMessage };
}

export async function drainSearchRepositories(
  topic: string,
  options?: {
    yearStart?: Date;
    yearEnd?: Date;
    lastUpdateAfter?: Date;
  },
): Promise<GitlabRepository[]> {
  logger.info(`Starting GitLab search for topic: ${topic}`);

  const allRepos: GitlabRepository[] = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  const searchOptions: SearchOptions = {
    topic,
    ...options,
  };

  while (hasMore) {
    const result = await searchRepositories(page, perPage, searchOptions);

    if ("error" in result) {
      throw new Error(`GitLab search failed: ${result.error}`);
    }

    const { items } = result.data;
    allRepos.push(...items);

    logger.info(`GitLab search page ${page}: got ${items.length} repositories`);

    // Continue if we got a full page
    hasMore = items.length === perPage;
    page++;

    // Safety break to avoid infinite loops
    if (page > 100) {
      logger.warn("GitLab search stopped at page 100 to prevent infinite loop");
      break;
    }
  }

  logger.info(
    `GitLab search completed for topic ${topic}: ${allRepos.length} total repositories`,
  );
  return allRepos;
}
