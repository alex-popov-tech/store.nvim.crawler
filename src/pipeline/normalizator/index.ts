import type { GithubRepository } from "~/sdk/github";
import type { GitlabRepository } from "~/sdk/gitlab";
import type { Repository } from "../types";
import { config } from "~/config";

/**
 * Formats number with k/m suffixes (copied from src/processors/repository.ts)
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(".0", "") + "m";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(".0", "") + "k";
  } else {
    return num.toLocaleString();
  }
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
function normalizeGithubRepository(githubRepo: GithubRepository): Repository {
  const [author, name] = githubRepo.full_name.split("/");

  return {
    source: "github",
    full_name: githubRepo.full_name,
    author: author || "",
    name: name || "",
    url: githubRepo.html_url,
    description: (githubRepo.description || "").replace(/~/g, ""),
    tags: filterTopicsToTags(githubRepo.topics),
    stars: githubRepo.stargazers_count,
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
function normalizeGitlabRepository(gitlabRepo: GitlabRepository): Repository {
  const [author, name] = gitlabRepo.path_with_namespace.split("/");

  return {
    source: "gitlab",
    full_name: gitlabRepo.path_with_namespace,
    author: author || "",
    name: name || "",
    url: gitlabRepo.web_url,
    description: (gitlabRepo.description || "").replace(/~/g, ""),
    tags: filterTopicsToTags(gitlabRepo.topics),
    stars: gitlabRepo.star_count,
    issues: gitlabRepo.open_issues_count,
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
  repo: GithubRepository | GitlabRepository,
): Repository {
  return "web_url" in repo
    ? normalizeGitlabRepository(repo)
    : normalizeGithubRepository(repo);
}
