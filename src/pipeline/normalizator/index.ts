import type { GithubRepository } from "~/sdk/github";
import type { GitlabRepository } from "~/sdk/gitlab";
import type { EnrichedRepository } from "../enricher";
import type { Repository } from "../types";
import { config } from "~/config";

/**
 * Formats number with k/m suffixes (copied from src/processors/repository.ts)
 */
function formatNumber(num: number | null | undefined): string {
  // Guard against missing numeric fields (e.g. GitLab omits open_issues_count
  // when a project has the Issues feature disabled) so a single repo can't
  // crash the whole pipeline.
  const n = typeof num === "number" && Number.isFinite(num) ? num : 0;
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(".0", "") + "m";
  } else if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(".0", "") + "k";
  } else {
    return n.toLocaleString();
  }
}

/**
 * Normalizes a free-text description into a single render-safe line.
 *
 * The DB is the source of truth for display, so all trimming happens here:
 * strip tildes (markview artifacts) and collapse every whitespace run into a
 * single space. The critical part is newlines — GitHub forbids them in
 * descriptions, but GitLab allows them, and an embedded "\n" breaks single-line
 * consumers (e.g. Neovim's nvim_buf_set_lines rejects the whole batch when any
 * line contains a newline, leaving the list stuck).
 */
function normalizeDescription(description: string | null | undefined): string {
  return (description || "")
    .replace(/~/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formats relative time with precise day formatting
 */
function formatRelativeTime(dateString: string): string {
  // Input validation
  if (!dateString || dateString.trim() === "") {
    return "unknown date";
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return "invalid date";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle future dates
  if (diffMs < 0) {
    return "in the future";
  }

  // Calculate days directly from milliseconds to avoid compounding errors
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // For months and years, use actual calendar calculations for precision
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const dateYear = date.getFullYear();
  const dateMonth = date.getMonth();

  // Calculate month difference accounting for year rollover
  const diffMonths = (nowYear - dateYear) * 12 + (nowMonth - dateMonth);

  const diffYears = Math.floor(diffMonths / 12);

  // New sequence: today, yesterday, %d days ago, last week, then back to %d days ago
  if (diffDays === 0) {
    return "today";
  } else if (diffDays === 1) {
    return "yesterday";
  } else if (diffDays >= 2 && diffDays <= 6) {
    return `${diffDays} days ago`;
  } else if (diffDays >= 7 && diffDays <= 13) {
    return "last week";
  } else if (diffDays < 30) {
    return `${diffDays} days ago`;
  } else if (diffMonths === 0) {
    // If we're here, it means 30+ days but less than a full calendar month
    return `${diffDays} days ago`;
  } else if (diffMonths < 12) {
    return diffMonths === 1 ? "last month" : `${diffMonths} months ago`;
  } else {
    return diffYears === 1 ? "last year" : `${diffYears} years ago`;
  }
}

/**
 * Filters topics/tags by removing blacklisted words
 */
function filterTopicsToTags(topics: string[]): string[] {
  return topics
    .filter((topic) => {
      const lowerTopic = topic.toLowerCase();
      return !config.pipeline.normalizator.tagsToRemove.some(
        (blacklistedWord) => lowerTopic.includes(blacklistedWord),
      );
    })
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Normalizes a GitHub repository to our standardized Repository type
 */
function normalizeGithubRepository(githubRepo: GithubRepository & { stars_weekly: number; stars_monthly: number }): Repository {
  const [author, name] = githubRepo.full_name.split("/");

  return {
    source: "github",
    full_name: githubRepo.full_name,
    author: author || "",
    name: name || "",
    url: githubRepo.html_url,
    description: normalizeDescription(githubRepo.description),
    tags: filterTopicsToTags(githubRepo.topics),
    stars: {
      curr: githubRepo.stargazers_count,
      weekly: githubRepo.stars_weekly,
      monthly: githubRepo.stars_monthly,
    },
    issues: githubRepo.open_issues_count,
    created_at: githubRepo.created_at,
    updated_at: githubRepo.pushed_at,
    branch: githubRepo.default_branch,

    pretty: {
      stars: formatNumber(githubRepo.stargazers_count),
      issues: formatNumber(githubRepo.open_issues_count),
      created_at: formatRelativeTime(githubRepo.created_at),
      updated_at: formatRelativeTime(githubRepo.pushed_at),
    },
  };
}

/**
 * Normalizes a GitLab repository to our standardized Repository type
 */
function normalizeGitlabRepository(gitlabRepo: GitlabRepository & { stars_weekly: number; stars_monthly: number }): Repository {
  const [author, name] = gitlabRepo.path_with_namespace.split("/");

  return {
    source: "gitlab",
    full_name: gitlabRepo.path_with_namespace,
    author: author || "",
    name: name || "",
    url: gitlabRepo.web_url,
    description: normalizeDescription(gitlabRepo.description),
    tags: filterTopicsToTags(gitlabRepo.topics),
    stars: {
      curr: gitlabRepo.star_count,
      weekly: gitlabRepo.stars_weekly,
      monthly: gitlabRepo.stars_monthly,
    },
    issues: gitlabRepo.open_issues_count ?? 0,
    created_at: gitlabRepo.created_at,
    updated_at: gitlabRepo.last_activity_at,
    branch: gitlabRepo.default_branch,

    pretty: {
      stars: formatNumber(gitlabRepo.star_count),
      issues: formatNumber(gitlabRepo.open_issues_count),
      created_at: formatRelativeTime(gitlabRepo.created_at),
      updated_at: formatRelativeTime(gitlabRepo.last_activity_at),
    },
  };
}

/**
 * Normalizes a repository from any platform to our standardized Repository type
 */
export function normalizeRepository(
  repo: EnrichedRepository,
): Repository {
  return "web_url" in repo
    ? normalizeGitlabRepository(repo)
    : normalizeGithubRepository(repo);
}
