import fs from "fs";
import { fetchPublicContent } from "~/sdk/github";
import { config } from "~/config";
import { createLogger } from "~/logger";
import type { GithubRepository } from "~/sdk/github";
import type { GitlabRepository } from "~/sdk/gitlab";

const logger = createLogger({ context: "enricher" });

type StarHistory = Record<string, Record<string, number>>;

export type EnrichedRepository = (GithubRepository | GitlabRepository) & {
  stars_weekly: number;
  stars_monthly: number;
};

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatDate(d);
}

function getRepoUrl(repo: GithubRepository | GitlabRepository): string {
  return "web_url" in repo ? repo.web_url : repo.html_url;
}

function getRepoStars(repo: GithubRepository | GitlabRepository): number {
  return "web_url" in repo ? repo.star_count : repo.stargazers_count;
}

async function pullCache(): Promise<StarHistory> {
  const cacheUrl = `${config.pipeline.output.releaseBaseUrl}/${config.pipeline.enricher.cacheFilename}`;
  logger.info(`Pulling star history cache from ${cacheUrl}`);
  const rawResult = await fetchPublicContent(cacheUrl);
  if ("error" in rawResult) {
    logger.warn(`Failed to fetch star history cache: ${rawResult.error}, starting with empty cache`);
    return {};
  }

  if (!rawResult.content || rawResult.content.trim() === "") {
    logger.info("Star history cache is empty, starting with empty cache");
    return {};
  }

  return JSON.parse(rawResult.content);
}

function writeCache(history: StarHistory): void {
  const content = JSON.stringify(history, null, 2);
  fs.writeFileSync(config.pipeline.enricher.output.starHistory, content);
  logger.info(`Updated star history cache: ${config.pipeline.enricher.output.starHistory}`);
}

export async function enrich(
  repos: Map<string, GithubRepository | GitlabRepository>,
): Promise<Map<string, EnrichedRepository>> {
  logger.info(`Enriching ${repos.size} repositories with star history`);

  const history = await pullCache();
  const today = formatDate(new Date());
  const weekAgo = daysAgo(7);
  const monthAgo = daysAgo(30);

  const enriched = new Map<string, EnrichedRepository>();

  for (const [fullName, repo] of repos) {
    const url = getRepoUrl(repo);
    const currStars = getRepoStars(repo);

    // Initialize history for this repo if missing
    if (!history[url]) {
      history[url] = {};
    }

    // Record today's star count
    history[url][today] = currStars;

    // Calculate deltas — fall back to current stars (delta = 0) if no historical data
    const starsWeekAgo = history[url][weekAgo] ?? currStars;
    const starsMonthAgo = history[url][monthAgo] ?? currStars;

    const stars_weekly = currStars - starsWeekAgo;
    const stars_monthly = currStars - starsMonthAgo;

    // Prune dates older than 31 days
    for (const date of Object.keys(history[url])) {
      if (date < daysAgo(31)) {
        delete history[url][date];
      }
    }

    enriched.set(fullName, { ...repo, stars_weekly, stars_monthly });
  }

  writeCache(history);

  logger.info(
    `Enrichment complete: ${enriched.size} repositories, ${Object.keys(history).length} URLs in cache`,
  );

  return enriched;
}
