import { GithubRepository } from "~/sdk/github";
import { ProcessedRepositories, RepositoryInfo } from "~/types";
import { config } from "~/config";

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(".0", "") + "m";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(".0", "") + "k";
  } else {
    return num.toLocaleString();
  }
}

const now = new Date();
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return "less than a minute ago";
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  } else if (diffDays < 30) {
    return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  } else if (diffMonths < 12) {
    return diffMonths === 1 ? "last month" : `${diffMonths} months ago`;
  } else {
    return diffYears === 1 ? "last year" : `${diffYears} years ago`;
  }
}

export function processRepositories(
  repositories: GithubRepository[],
): ProcessedRepositories {
  const processedRepositories = {
    meta: {
      total_count: repositories.length,
      crawled_at: Math.floor(Date.now() / 1000),
      max_full_name_length: 0,
      max_pretty_stargazers_length: 0,
      max_pretty_forks_length: 0,
      max_pretty_issues_length: 0,
      max_pretty_pushed_at_length: 0,
    },
    items: [],
  } as ProcessedRepositories;

  for (const repo of repositories) {
    const [author, name] = repo.full_name.split("/");
    const pushedAtUnix = Math.floor(new Date(repo.pushed_at).getTime() / 1000);
    const item: RepositoryInfo = {
      full_name: repo.full_name,
      author: author || "",
      name: name || "",
      html_url: repo.html_url,
      description: repo.description ?? "",
      homepage: repo.homepage ?? "",
      created_at: Math.floor(new Date(repo.created_at).getTime() / 1000),

      topics: repo.topics,
      tags: repo.topics
        .filter((topic) => {
          const lowerTopic = topic.toLowerCase();
          return !config.TAGS_BLACKLIST.some((blacklistedWord) =>
            lowerTopic.includes(blacklistedWord),
          );
        })
        .sort((a, b) => a.localeCompare(b)),

      stargazers_count: repo.stargazers_count,
      pretty_stargazers_count: formatNumber(repo.stargazers_count),

      forks_count: repo.forks_count,
      pretty_forks_count: formatNumber(repo.forks_count),

      open_issues_count: repo.open_issues_count,
      pretty_open_issues_count: formatNumber(repo.open_issues_count),

      pushed_at: pushedAtUnix,
      pretty_pushed_at: formatRelativeTime(repo.pushed_at),
    };

    // Track maximum lengths
    processedRepositories.meta.max_full_name_length = Math.max(
      processedRepositories.meta.max_full_name_length,
      item.full_name.length,
    );
    processedRepositories.meta.max_pretty_stargazers_length = Math.max(
      processedRepositories.meta.max_pretty_stargazers_length,
      item.pretty_stargazers_count.length,
    );
    processedRepositories.meta.max_pretty_forks_length = Math.max(
      processedRepositories.meta.max_pretty_forks_length,
      item.pretty_forks_count.length,
    );
    processedRepositories.meta.max_pretty_issues_length = Math.max(
      processedRepositories.meta.max_pretty_issues_length,
      item.pretty_open_issues_count.length,
    );
    processedRepositories.meta.max_pretty_pushed_at_length = Math.max(
      processedRepositories.meta.max_pretty_pushed_at_length,
      item.pretty_pushed_at.length,
    );
    processedRepositories.items.push(item);
  }

  return processedRepositories;
}
