import { drainSearchRepositories, GitlabRepository } from "~/sdk/gitlab";
import { createLogger } from "~/logger";
import { config } from "~/config";

const logger = createLogger({ context: "gitlab-search-crawler-v2" });

export async function crawl(): Promise<Map<string, GitlabRepository>> {
  logger.info("Starting GitLab search crawler");
  logger.info(
    `Search groups: ${Object.keys(config.pipeline.crawler.gitlab).join(", ")}`,
  );

  // Calculate dynamic date filter using config setting
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - config.pipeline.crawler.lastUpdateAllowedInDays);

  logger.info(
    `Using dynamic last activity filter: last_activity_after:${daysAgo.toISOString().split("T")[0]} (${config.pipeline.crawler.lastUpdateAllowedInDays} days ago)`,
  );

  const allRepos: GitlabRepository[] = [];
  let totalQueries = 0;
  let currentQuery = 0;

  // Count total queries for progress tracking
  for (const queries of Object.values(config.pipeline.crawler.gitlab)) {
    totalQueries += queries.length;
  }

  logger.info(
    `Will crawl ${totalQueries} search queries with 2s sleep between each page request`,
  );

  for (const [searchGroup, queries] of Object.entries(config.pipeline.crawler.gitlab)) {
    logger.info(
      `Processing search group: ${searchGroup} (${queries.length} queries)`,
    );

    for (const baseQuery of queries) {
      currentQuery++;

      // Extract topic from the query (assumes format like "topic:neovim-plugin ...")
      const topicMatch = baseQuery.match(/topic:([^\s]+)/);
      if (!topicMatch) {
        logger.warn(`No topic found in query: ${baseQuery}, skipping`);
        continue;
      }

      const topic = topicMatch[1];
      logger.info(
        `Crawling query ${currentQuery}/${totalQueries}: topic="${topic}"`,
      );

      // Extract date filters from query if present
      const dateOptions: {
        yearStart?: Date;
        yearEnd?: Date;
        lastUpdateAfter?: Date;
      } = {};

      const createdMatch = baseQuery.match(
        /created:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/,
      );
      if (createdMatch) {
        dateOptions.yearStart = new Date(createdMatch[1]);
        dateOptions.yearEnd = new Date(createdMatch[2]);
      }

      // Always apply the last update filter
      dateOptions.lastUpdateAfter = daysAgo;

      try {
        const queryRepos = await drainSearchRepositories(topic, dateOptions);
        allRepos.push(...queryRepos);

        logger.info(`Query completed: found ${queryRepos.length} repositories`);
      } catch (error) {
        logger.error(`Query failed for topic ${topic}: ${error}`);
        // Continue with other queries even if one fails
      }
    }
  }

  logger.info(
    `GitLab search crawling completed! Found ${allRepos.length} total repositories`,
  );

  const map = new Map<string, GitlabRepository>();
  for (const repo of allRepos) {
    // Use path_with_namespace as the key (equivalent to GitHub's full_name)
    map.set(repo.path_with_namespace, repo);
  }

  logger.info(`Deduplicated to ${map.size} unique repositories`);

  return map;
}
