import { createLogger } from "~/logger";
import { crawl as crawlAwesome } from "~/pipeline/crawler/awesome-neovim";
import { crawl as crawlAwesomeVim } from "~/pipeline/crawler/awesome-vim";
import { crawl as crawlGithubSearch } from "~/pipeline/crawler/github-search";
import { crawl as crawlGitlabSearch } from "~/pipeline/crawler/gitlab-search";
import { normalizeRepository } from "./normalizator";
import { verify } from "./verificator";
import { generateInstallations as generateInstallationsForRepos } from "./installator";
import { updateGist, type GithubRepository } from "~/sdk/github";
import { GitlabRepository } from "~/sdk/gitlab";
import { config } from "~/config";
import { postProcessDatabase } from "./post-processor";
import type { Repository } from "./types";

const logger = createLogger({ context: "v2-pipeline" });

export async function runPipeline() {
  logger.info("🚀 Starting v2 production pipeline");

  const repos = await crawlAndDedupeRepositories();

  const normalizedRepositories = normalizeRepositories(repos);

  const verifiedRepositories = await verifyRepositories(normalizedRepositories);

  const repositoriesWithInstallations =
    await generateInstallations(verifiedRepositories);

  const minified = postProcessDatabase(repositoriesWithInstallations);

  await pushDatabases(minified);
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

function normalizeRepositories(
  repositories: Map<string, GithubRepository | GitlabRepository>,
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

async function pushDatabases(args: {
  jsonDatabaseMinified: string;
  jsonVimpackDatabaseMinified: string;
  jsonLazyDatabaseMinified: string;
}) {
  const start = Date.now();

  const [mainResult, vimpackResult, lazyResult] = await Promise.all([
    updateGist(config.pipeline.output.minifiedDbGistId, {
      files: {
        [config.pipeline.output.dbGistFilename]: {
          content: args.jsonDatabaseMinified,
        },
      },
    }),
    updateGist(config.pipeline.output.vimpackDbGistId, {
      files: {
        [config.pipeline.output.vimpackGistFilename]: {
          content: args.jsonVimpackDatabaseMinified,
        },
      },
    }),
    updateGist(config.pipeline.output.lazyDbGistId, {
      files: {
        [config.pipeline.output.lazyGistFilename]: {
          content: args.jsonLazyDatabaseMinified,
        },
      },
    }),
  ]);

  if (mainResult.error) {
    throw new Error(`Failed to update main database gist: ${mainResult.error}`);
  }
  if (vimpackResult.error) {
    throw new Error(`Failed to update vim.pack gist: ${vimpackResult.error}`);
  }
  if (lazyResult.error) {
    throw new Error(`Failed to update lazy.nvim gist: ${lazyResult.error}`);
  }

  const time = Date.now() - start;
  logger.info(
    `✅ All 3 databases uploaded to production in ${(time / 1000).toFixed(2)}s`,
  );
}
