import { drainSearchRepositories } from "~/sdk/github";
import type { GithubRepository } from "~/sdk/github";
import { createLogger } from "~/logger";
import { config } from "~/config";

const logger = createLogger({ context: "github-search-crawler-v2" });

export async function crawl(): Promise<Map<string, GithubRepository>> {
  logger.info("Starting GitHub search crawler");
  logger.info(
    `Search groups: ${Object.keys(config.pipeline.crawler.github).join(", ")}`,
  );

  // Calculate dynamic date filter using config setting
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - config.pipeline.crawler.lastUpdateAllowedInDays);
  const dateFilter = daysAgo.toISOString().split("T")[0];

  logger.info(
    `Using dynamic pushed filter: pushed:>${dateFilter} (${config.pipeline.crawler.lastUpdateAllowedInDays} days ago)`,
  );

  // Collect all queries from all search groups
  const allQueries: Array<{ query: string; searchGroup: string }> = [];
  
  for (const [searchGroup, queries] of Object.entries(config.pipeline.crawler.github)) {
    for (const baseQuery of queries) {
      const query = `${baseQuery} pushed:>${dateFilter}`;
      allQueries.push({ query, searchGroup });
    }
  }

  logger.info(`Will crawl ${allQueries.length} search queries sequentially to respect Search API limits`);
  logger.info(`🔍 Search API allows 30 requests/minute - each query uses 1-10+ requests for pagination`);

  // Simple sequential approach - let each query complete before starting the next
  // The drainSearchRepositories function handles parallel pagination internally
  const allRepos: GithubRepository[] = [];
  
  for (let i = 0; i < allQueries.length; i++) {
    const { query, searchGroup } = allQueries[i];
    const queryNumber = i + 1;
    
    logger.info(`🔍 Starting query ${queryNumber}/${allQueries.length}: "${query}" (group: ${searchGroup})`);
    const queryRepos = await drainSearchRepositories(query);
    allRepos.push(...queryRepos);
    logger.info(`✅ Completed query ${queryNumber}/${allQueries.length}: "${query}" -> ${queryRepos.length} repos`);
  }


  logger.info(
    `GitHub search crawling completed! Found ${allRepos.length} total repositories`,
  );

  // Convert to map keyed by full_name, removing duplicates
  const map = new Map<string, GithubRepository>();
  for (const repo of allRepos) {
    map.set(repo.full_name, repo);
  }

  logger.info(`Deduplicated to ${map.size} unique repositories`);

  return map;
}

