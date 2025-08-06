import { GithubRepository } from "~/sdk/github";
import { ProcessedRepositories, RepositoryInfo } from "~/types";
import { config } from "~/config";
import { FormattedChunk } from "./readme/types";
import { createLogger } from "~/logger";

const logger = createLogger({ context: "repository processor" });

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(".0", "") + "m";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(".0", "") + "k";
  } else {
    return num.toLocaleString();
  }
}

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();

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

  if (diffDays < 30) {
    return diffDays <= 7
      ? "this week"
      : diffDays <= 14
        ? "last week"
        : `${diffDays} days ago`;
  } else if (diffMonths === 0) {
    // If we're here, it means 30+ days but less than a full calendar month
    return `${diffDays} days ago`;
  } else if (diffMonths < 12) {
    return diffMonths === 1 ? "last month" : `${diffMonths} months ago`;
  } else {
    return diffYears === 1 ? "last year" : `${diffYears} years ago`;
  }
}

export function processRepositories(
  repositories: Map<string, GithubRepository>,
  installationData: Map<
    string,
    { installations: FormattedChunk[]; readmePath: string }
  >,
): ProcessedRepositories {
  const processedRepositories = {
    meta: {
      version: 2,
      total_count: 0, // Will be incremented for each processed repository
      installable_count: 0,
      crawled_at: Date.now(),
      crawled_in_sec: 0, // will be filled later
      max_full_name_length: 0,
      max_pretty_stargazers_length: 0,
      max_pretty_forks_length: 0,
      max_pretty_issues_length: 0,
      max_pretty_pushed_at_length: 0,
    },
    items: [],
  } as ProcessedRepositories;

  for (const [full_name, installData] of installationData.entries()) {
    const repo = repositories.get(full_name);
    if (!repo) {
      logger.error(
        `❌ Repository ${full_name} is found in installations, but not in repositories`,
      );
      continue;
    }

    const { readmePath, installations } = installData;
    if (!readmePath || !installations) {
      logger.error(
        `❌ Repository ${full_name} have no readmePath or installations`,
      );
      continue;
    }

    const [author, name] = full_name.split("/");
    const pushedAtUnix = new Date(repo.pushed_at).getTime();

    const item: RepositoryInfo = {
      full_name: repo.full_name,
      author: author || "",
      name: name || "",
      html_url: repo.html_url,
      description: repo.description ?? "",
      homepage: repo.homepage ?? "",
      created_at: new Date(repo.created_at).getTime(),

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

    processedRepositories.meta.installable_count +=
      installations.length > 0 ? 1 : 0;
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

    item.readme = readmePath;

    // Apply installation config during processing
    if (installations.length) {
      const lazy = installations.find(
        (option) => option.pluginManager === "lazy.nvim",
      );
      const packer = installations.find(
        (option) => option.pluginManager === "packer.nvim",
      );
      const vimPlug = installations.find(
        (option) => option.pluginManager === "vim-plug",
      );

      if (lazy) {
        item.install = {
          initial: "lazy.nvim",
          lazyConfig: lazy.formatted,
        };
      } else if (packer) {
        item.install = {
          initial: "packer.nvim",
          lazyConfig: packer.formatted,
        };
      } else if (vimPlug) {
        item.install = {
          initial: "vim-plug",
          lazyConfig: vimPlug.formatted,
        };
      }
    }

    processedRepositories.items.push(item);
    processedRepositories.meta.total_count++;
  }

  return processedRepositories;
}
