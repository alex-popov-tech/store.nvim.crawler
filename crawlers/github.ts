import { GithubRepository, searchRepositories } from "../github-client";
import type { YearRangeOptions } from "../types";
import { createLogger } from "../logger";

const logger = createLogger({ crawlerType: "github search repos crawler" });

async function crawlTimeRange(
  periodLabel: string,
  options: YearRangeOptions,
  perPage: number = 100,
) {
  const repos = [];

  for (let page = 1; ; page++) {
    logger.progress(`Fetching ${periodLabel} page ${page}`);
    const result = await searchRepositories(page, perPage, options);

    if (result.error) {
      logger.error(`Failed to search GitHub repositories for ${periodLabel}`);
      return { data: null, error: result.error };
    }

    const { items, total_count } = result.data!;
    repos.push(...items);
    logger.progressEnd();
    logger.info(
      `Fetched ${items.length} repos, ${repos.length}/${total_count} total for ${periodLabel}`,
    );

    if (items.length < perPage || items.length === 0) {
      break;
    }
  }

  return { data: repos, error: null };
}

export async function crawlGithub() {
  logger.processStart("GitHub topic crawler");

  const allRepos = [];
  const perPage = 100;
  const startYear = 2014;
  // const endYear = new Date().getFullYear();
  const endYear = 2015;

  logger.info(
    `Searching repositories with topic "neovim-plugin" from ${startYear} to ${endYear}`,
  );

  for (let year = startYear; year <= endYear; year++) {
    logger.info(`Crawling repositories created in ${year}`);

    const yearStart = new Date(`${year}-01-01`);
    const yearEnd = new Date(`${year}-12-31`);
    const yearOptions: YearRangeOptions = { yearStart, yearEnd };

    const yearResult = await crawlTimeRange(`${year}`, yearOptions, perPage);
    if (yearResult.error) {
      return { data: null, error: yearResult.error };
    }
    allRepos.push(...yearResult.data!);
  }

  logger.processEnd(
    `GitHub crawling completed! Found ${allRepos.length} repositories from ${startYear} to ${endYear}`,
  );

  const map = new Map<string, GithubRepository>();
  for (const repo of allRepos) {
    map.set(repo.full_name, repo);
  }

  return { data: map, error: null };
}
