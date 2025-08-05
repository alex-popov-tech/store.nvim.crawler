import { GithubRepository, searchRepositories } from "../sdk/github";
import type { YearRangeOptions } from "../types";
import { createLogger } from "../logger";
import { config } from "../config";

const logger = createLogger({ context: "github search repos crawler" });

const TOPIC_CRAWLING_SCHEDULES = {
  "nvim-plugin": [
    {
      from: new Date(2017, 0, 1),
      to: new Date(2023, 11, 31),
      label: "2017-2023",
    }, // 463 repos
    {
      from: new Date(2024, 0, 1),
      to: new Date(2025, 11, 31),
      label: "2024-2025",
    }, // 526 repos
  ],
  "nvim-plugins": [
    {
      from: new Date(2018, 0, 1),
      to: new Date(2025, 11, 31),
      label: "2018-2025",
    }, // 61 repos
  ],
  "neovim-plugin": [
    {
      from: new Date(2013, 0, 1),
      to: new Date(2021, 11, 31),
      label: "2013-2021",
    }, // 618 repos
    { from: new Date(2022, 0, 1), to: new Date(2022, 11, 31), label: "2022" }, // 451 repos
    { from: new Date(2023, 0, 1), to: new Date(2023, 11, 31), label: "2023" }, // 644 repos
    { from: new Date(2024, 0, 1), to: new Date(2024, 11, 31), label: "2024" }, // 961 repos
    { from: new Date(2025, 0, 1), to: new Date(2025, 11, 31), label: "2025" }, // 587 repos
  ],
  "neovim-plugins": [
    {
      from: new Date(2016, 0, 1),
      to: new Date(2025, 11, 31),
      label: "2016-2025",
    }, // 159 repos
  ],
  "neovim-theme": [
    {
      from: new Date(2014, 0, 1),
      to: new Date(2025, 11, 31),
      label: "2014-2025",
    }, // 161 repos
  ],
  "neovim-colorscheme": [
    {
      from: new Date(2014, 0, 1),
      to: new Date(2025, 11, 31),
      label: "2014-2025",
    }, // 296 repos
  ],
} as const;

/**
 * Generates topic-specific optimized date ranges based on historical data
 * @param topic - The topic to generate ranges for
 * @returns Array of date ranges with labels
 * @throws Error if topic is not in TOPIC_CRAWLING_SCHEDULES
 */
function generateTopicOptimizedRanges(
  topic: string,
): Array<{ from: Date; to: Date; label: string }> {
  if (!(topic in TOPIC_CRAWLING_SCHEDULES)) {
    throw new Error(
      `No optimized crawling schedule found for topic '${topic}'. Please add it to TOPIC_CRAWLING_SCHEDULES.`,
    );
  }

  const schedule =
    TOPIC_CRAWLING_SCHEDULES[topic as keyof typeof TOPIC_CRAWLING_SCHEDULES];
  return schedule.map((range) => ({ ...range }));
}

async function crawlTimeRange(
  periodLabel: string,
  options: YearRangeOptions & { topic: string },
  perPage: number = 100,
): Promise<{ data: GithubRepository[] } | { error: any }> {
  const repos = [] as GithubRepository[];

  for (let page = 1; ; page++) {
    const result = await searchRepositories(page, perPage, options);

    if ("error" in result) {
      logger.error(
        `Failed to search GitHub repositories for ${periodLabel}: ${result.error}`,
      );
      return { error: result.error };
    }

    const { items, total_count } = result.data;

    // Check if we hit the GitHub API 1000 result limit
    if (total_count >= 1000) {
      const errorMsg = `Hit GitHub API limit: ${total_count} repositories found for ${periodLabel}. Please use smaller date ranges!`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    repos.push(...items);
    logger.info(
      `Fetched ${items.length} repos, ${repos.length}/${total_count} total for ${periodLabel}`,
    );

    if (items.length < perPage || items.length === 0) {
      break;
    }
  }

  return { data: repos };
}

export async function crawlGithub(opts: {
  topics: string[];
}): Promise<{ data: Map<string, GithubRepository> } | { error: any }> {
  logger.info("Starting: GitHub topic crawler");

  const allRepos = [] as GithubRepository[];
  const perPage = 100;

  // Calculate last update cutoff date to filter dead plugins
  const lastUpdateCutoff = new Date();
  lastUpdateCutoff.setDate(
    lastUpdateCutoff.getDate() - config.crawler.lastUpdateAllowedInDays,
  );

  logger.info(`Searching repositories with topics ${opts.topics.join(", ")}`);
  logger.info(
    `Filtering plugins last updated after ${lastUpdateCutoff.toISOString().split("T")[0]} (${config.crawler.lastUpdateAllowedInDays} days ago)`,
  );

  for (const topic of opts.topics) {
    logger.info(`Crawling repositories for topic: ${topic}`);

    // Get topic-specific optimized ranges
    const topicRanges = generateTopicOptimizedRanges(topic);
    logger.info(
      `Using ${topicRanges.length} optimized date ranges for ${topic} (based on historical data)`,
    );

    for (const dateRange of topicRanges) {
      logger.info(
        `Crawling ${topic} repositories created in ${dateRange.label}`,
      );

      const rangeOptions = {
        yearStart: dateRange.from,
        yearEnd: dateRange.to,
        lastUpdateAfter: lastUpdateCutoff,
        topic,
      };

      const rangeResult = await crawlTimeRange(
        `${topic} ${dateRange.label}`,
        rangeOptions,
        perPage,
      );
      if ("error" in rangeResult) {
        logger.error(
          `Failed to crawl ${topic} for ${dateRange.label}, continuing...`,
        );
        continue;
      }
      allRepos.push(...rangeResult.data);
    }
  }

  logger.info(
    `GitHub crawling completed! Found ${allRepos.length} repositories`,
  );

  const map = new Map<string, GithubRepository>();
  for (const repo of allRepos) {
    map.set(repo.full_name, repo);
  }

  return { data: map };
}
