import { createLogger } from "~/logger";
import { crawl as crawlAwesome } from "~/pipeline/crawler/awesome-neovim";
import { crawl as crawlAwesomeVim } from "~/pipeline/crawler/awesome-vim";
import { crawl as crawlGithubSearch } from "~/pipeline/crawler/github-search";
import { crawl as crawlGitlabSearch } from "~/pipeline/crawler/gitlab-search";
import { normalizeRepository } from "./normalizator";
import { enrich, type EnrichedRepository } from "./enricher";
import { verify } from "./verificator";
import { generateInstallations as generateInstallationsForRepos } from "./installator";
import { type GithubRepository } from "~/sdk/github";
import { GitlabRepository } from "~/sdk/gitlab";
import { postProcessDatabase } from "./post-processor";
import type { Repository } from "./types";

const logger = createLogger({ context: "v2-pipeline" });

export async function runPipeline() {
  logger.info("🚀 Starting v2 production pipeline");

  const repos = await crawlAndDedupeRepositories();

  const enrichedRepos = await enrichRepositories(repos);

  const normalizedRepositories = normalizeRepositories(enrichedRepos);

  const verifiedRepositories = await verifyRepositories(normalizedRepositories);

  const repositoriesWithInstallations =
    await generateInstallations(verifiedRepositories);

  postProcessDatabase(repositoriesWithInstallations);

  logger.info("🎉 v2 Pipeline completed successfully!");
  logger.info(
    `📈 Final Result: ${repositoriesWithInstallations.size} verified plugin repositories`,
  );
}

async function crawlAndDedupeRepositories(): Promise<
  Map<string, GithubRepository | GitlabRepository>
> {
  const start = Date.now();
  const [githubSearch, githubAwesome, githubAwesomeVim, gitlabSearch] =
    await Promise.all([
      crawlAwesome(),
      crawlAwesomeVim(),
      crawlGithubSearch(),
      crawlGitlabSearch(),
    ]);
  const crawlingTime = Date.now() - start;
  logger.info(`✅ GitHub search crawler: ${githubSearch.size} repositories`);
  logger.info(`✅ Awesome-nvim crawler: ${githubAwesome.size} repositories`);
  logger.info(`✅ Awesome-vim crawler: ${githubAwesomeVim.size} repositories`);
  logger.info(`✅ GitLab search crawler: ${gitlabSearch.size} repositories`);
  logger.info(`⏱️  Crawling completed in ${(crawlingTime / 1000).toFixed(2)}s`);

  // Start with GitHub search results as base
  const mergedRepositories = new Map<
    string,
    GithubRepository | GitlabRepository
  >(githubSearch);

  // Apply awesome-nvim results (second priority - curated list)
  for (const [fullName, awesomeRepo] of githubAwesome) {
    mergedRepositories.set(fullName, awesomeRepo);
  }
  // Apply awesome-vim results (highest priority - most specific tags)
  for (const [fullName, awesomeVimRepo] of githubAwesomeVim) {
    mergedRepositories.set(fullName, awesomeVimRepo);
  }
  // Add GitLab repositories, avoiding mirrors based on updated_at timestamp
  for (const [fullName, gitlabRepo] of gitlabSearch) {
    const existingRepo = mergedRepositories.get(fullName);
    // Repository exists on GitHub - always keep GitHub version
    if (!existingRepo) {
      mergedRepositories.set(fullName, gitlabRepo);
      continue;
    }
  }

  logger.info(
    `✅ Merged into ${mergedRepositories.size} repositories ( from ${githubSearch.size + githubAwesome.size + githubAwesomeVim.size + gitlabSearch.size} )`,
  );

  return mergedRepositories;
}

async function enrichRepositories(
  repositories: Map<string, GithubRepository | GitlabRepository>,
): Promise<Map<string, EnrichedRepository>> {
  const start = Date.now();
  const enriched = await enrich(repositories);
  const time = Date.now() - start;
  logger.info(
    `✅ Enriched ${enriched.size} repositories with star history in ${(time / 1000).toFixed(2)}s`,
  );
  return enriched;
}

function normalizeRepositories(
  repositories: Map<string, EnrichedRepository>,
) {
  const normalizedRepositories = new Map<string, Repository>();
  for (const [fullName, repo] of repositories) {
    normalizedRepositories.set(fullName, normalizeRepository(repo));
  }
  return normalizedRepositories;
}

async function verifyRepositories(
  repositories: Map<string, Repository>,
): Promise<Map<string, Repository>> {
  const start = Date.now();
  const repos = await verify(repositories);
  const time = Date.now() - start;
  logger.info(
    `✅ Verified ${repos.size} plugin repositories in ${(time / 1000).toFixed(2)}s`,
  );
  return repos;
}

async function generateInstallations(repositories: Map<string, Repository>) {
  const start = Date.now();
  const result = await generateInstallationsForRepos(repositories);
  const time = Date.now() - start;
  logger.info(
    `✅ Generated installation instructions for ${repositories.size} repositories in ${(time / 1000).toFixed(2)}s`,
  );
  return result;
}
