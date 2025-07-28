import { GithubRepository, searchRepositories } from "../sdk/github";
import type { YearRangeOptions } from "../types";
import { createLogger } from "../logger";

const logger = createLogger({ context: "github search repos crawler" });

/**
 * Generates quarterly date ranges from a starting year to current date
 * @param yearFrom - Starting year (e.g., 2010)
 * @returns Array of quarterly date ranges
 */
function generateQuarterlyRangesFrom(
  yearFrom: number,
): Array<{ from: Date; to: Date }> {
  const ranges: Array<{ from: Date; to: Date }> = [];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentQuarter = Math.floor(currentDate.getMonth() / 3);

  for (let year = yearFrom; year <= currentYear; year++) {
    const maxQuarter = year === currentYear ? currentQuarter : 3;

    for (let quarter = 0; quarter <= maxQuarter; quarter++) {
      const from = new Date(year, quarter * 3, 1);
      const to = new Date(year, quarter * 3 + 3, 0); // Last day of the quarter
      ranges.push({ from, to });
    }
  }

  return ranges;
}

async function crawlTimeRange(
  periodLabel: string,
  options: YearRangeOptions & { topic: string },
  perPage: number = 100,
) {
  const repos = [] as GithubRepository[];

  for (let page = 1; ; page++) {
    const result = await searchRepositories(page, perPage, options);

    if (result.error) {
      logger.error(`Failed to search GitHub repositories for ${periodLabel}`);
      return { data: null, error: result.error };
    }

    const { items, total_count } = result.data!;
    repos.push(...items);
    logger.info(
      `Fetched ${items.length} repos, ${repos.length}/${total_count} total for ${periodLabel}`,
    );

    if (items.length < perPage || items.length === 0) {
      break;
    }
  }

  return { data: repos, error: null };
}

export async function crawlGithub(opts: {
  yearFrom: number;
  topics: string[];
}): Promise<{ data: Map<string, GithubRepository> | null; error: any }> {
  logger.info("Starting: GitHub topic crawler");

  const allRepos = [] as GithubRepository[];
  const perPage = 100;
  const quarterlyRanges = generateQuarterlyRangesFrom(opts.yearFrom);

  logger.info(
    `Searching repositories with topics ${opts.topics.join(", ")} from ${opts.yearFrom}`,
  );

  for (const topic of opts.topics) {
    logger.info(`Crawling repositories for topic: ${topic}`);

    for (const dateRange of quarterlyRanges) {
      const quarterNum = Math.floor(dateRange.from.getMonth() / 3) + 1;
      const quarterLabel = `${dateRange.from.getFullYear()}-Q${quarterNum}`;
      logger.info(`Crawling ${topic} repositories created in ${quarterLabel}`);

      const rangeOptions = {
        yearStart: dateRange.from,
        yearEnd: dateRange.to,
        topic,
      };

      const rangeResult = await crawlTimeRange(
        `${topic} ${quarterLabel}`,
        rangeOptions,
        perPage,
      );
      if (rangeResult.error) {
        logger.error(
          `Failed to crawl ${topic} for ${quarterLabel}, continuing...`,
        );
        continue;
      }
      allRepos.push(...rangeResult.data!);
    }
  }

  logger.info(
    `GitHub crawling completed! Found ${allRepos.length} repositories`,
  );

  const map = new Map<string, GithubRepository>();
  for (const repo of allRepos) {
    map.set(repo.full_name, repo);
  }

  return { data: map, error: null };
}
