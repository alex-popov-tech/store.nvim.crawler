import { cutter } from "./cutter";
import { rater } from "./rater";
import { extractor } from "./extractor";
import { migrateChunks } from "./migrator";
import { formatter } from "./formatter";
import { config } from "~/config";
import { createLogger } from "~/logger";
import {
  getRepositoryReadme as getGithubRepositoryReadme,
  updateGist,
  getRawGistContent,
} from "~/sdk/github";
import { getRepositoryReadme as getGitlabRepositoryReadme } from "~/sdk/gitlab";
import { FormattedChunk, InstallationCache, InstallationDebug } from "./types";
import { Repository, RepositoryWithInstallationInfo } from "../types";
import { writeFileSync } from "fs";
import { generateLazyConfig } from "./migrator/lazy";
import { generateVimPackConfig } from "./migrator/vim-pack";

const logger = createLogger({ context: "installator" });

export async function pullCache(): Promise<InstallationCache> {
  const rawResult = await getRawGistContent(
    config.pipeline.installator.cacheGistRawUrl,
  );
  if ("error" in rawResult) {
    throw new Error(
      `Failed to fetch installation cache from raw URL: ${rawResult.error}`,
    );
  }

  if (!rawResult.content || rawResult.content.trim() === "") {
    logger.info(
      "Installation cache content is empty, starting with empty cache",
    );
    return new Map();
  }

  const cacheObject: InstallationCache = JSON.parse(rawResult.content);
  return new Map(Object.entries(cacheObject));
}

export async function updateCache(cache: InstallationCache) {
  const cacheContent = JSON.stringify(Object.fromEntries(cache), null, 2);

  logger.info("Pushing minimal installation cache to gist");
  const updateResult = await updateGist(
    config.pipeline.installator.cacheGistId,
    {
      files: {
        "installation_cache.json": {
          content: cacheContent,
        },
      },
    },
  );

  if (updateResult.error) {
    throw new Error(
      `Failed to update installation cache gist: ${updateResult.error}`,
    );
  }

  logger.info("Successfully pushed minimal installation cache to gist");
}

export function isCacheHasFreshRecord(
  cache: InstallationCache,
  repository: Repository,
): boolean {
  const cached = cache.get(repository.full_name);
  if (!cached) {
    return false;
  }

  const repoUpdated = new Date(repository.updated_at);
  const cachedUpdated = new Date(cached.updated_at);

  // Cache is valid if repository hasn't been updated since caching
  return repoUpdated <= cachedUpdated;
}

export async function getRepositoryReadme(
  repository: Repository,
): Promise<{ data: string; readmePath: string } | { error: string }> {
  return repository.source === "github"
    ? await getGithubRepositoryReadme(repository)
    : await getGitlabRepositoryReadme(
        repository.url + "/-/blob/" + repository.branch + "/README.md",
      );
}

export function writeDebugOutput(debugEntries: InstallationDebug) {
  // Convert Map to array of values for JSON serialization
  const debugArray = Array.from(debugEntries.values());

  writeFileSync(
    config.pipeline.installator.output.install,
    JSON.stringify(debugArray, null, 2),
  );
  logger.info(
    `Written ${debugEntries.size} debug entries to ${config.pipeline.installator.output.install}`,
  );
}

export async function processSingleRepository(repository: Repository): Promise<{
  repository: RepositoryWithInstallationInfo;
  chunks: FormattedChunk[];
  default: { lazy: string; vimpack: string };
}> {
  const defaultLazy = generateLazyConfig(repository.full_name);
  const defaultVimpack = generateVimPackConfig(repository);
  const defaultResult = {
    repository: {
      ...repository,
      install: {
        source: "default" as const,
        lazy: defaultLazy,
        vimpack: defaultVimpack,
      },
    },
    chunks: [],
    default: { lazy: defaultLazy, vimpack: defaultVimpack },
  };

  // Try to get README
  const readmeResult = await getRepositoryReadme(repository);
  // No README found - use default config
  if ("error" in readmeResult) {
    logger.info(
      `[${repository.full_name}] No README found, using default config`,
    );
    return defaultResult;
  }
  defaultResult.repository.readme = readmeResult.readmePath;

  // Process README with existing 5-stage pipeline
  const { chunks, install } = processReadme(repository, readmeResult.data);

  if (chunks.length === 0) {
    // README processing failed - use default config but include readme path
    logger.info(
      `[${repository.full_name}] README processing failed, using default config`,
    );
    return defaultResult;
  }

  return {
    repository: {
      ...repository,
      readme: readmeResult.readmePath,
      install: install!,
    },
    chunks,
    default: { lazy: defaultLazy, vimpack: defaultVimpack },
  };
}

function processReadme(
  repository: Repository,
  readmeContent: string,
): {
  chunks: FormattedChunk[];
  install?: {
    source: "default" | "lazy.nvim" | "packer.nvim" | "vim-plug";
    lazy: string;
    vimpack: string;
  };
} {
  logger.info(`[${repository.full_name}] Starting: Processing README`);

  const cutedChunks = cutter.cutChunks(repository.full_name, readmeContent);
  if (cutedChunks.length === 0) {
    logger.warn(`[${repository.full_name}] No chunks found in README`);
    return { chunks: [] };
  }
  logger.info(
    `[${repository.full_name}] Cut ${cutedChunks.length} chunks from README`,
  );

  // Step 2: Rate each chunk and let only high-rated chunks pass
  const ratedChunks = rater.rateChunks(repository.full_name, cutedChunks);
  const highRatedChunks = ratedChunks.filter(
    (chunk) =>
      chunk.rates["packer.nvim"].verdict === "high" ||
      chunk.rates["lazy.nvim"].verdict === "high" ||
      chunk.rates["vim-plug"].verdict === "high",
  );
  logger.info(
    `[${repository.full_name}] Rated ${ratedChunks.length} chunks, ${highRatedChunks.length} "high"-rated`,
  );

  if (highRatedChunks.length === 0) {
    logger.warn(
      `[${repository.full_name}] No "high"-rated chunks found in cutted chunks`,
    );
    return { chunks: [] };
  }

  // Step 3: Extract plugin configurations
  const extractedChunks = extractor.extractPlugins(
    highRatedChunks,
    repository.full_name,
  );
  if (extractedChunks.length === 0) {
    logger.warn(
      `[${repository.full_name}] No VALID plugin configurations found in "high" rated chunks`,
    );
    return { chunks: [] };
  }

  logger.info(
    `[${repository.full_name}] Extracted plugins configurations: ${extractedChunks.map((c) => c.pluginManager).join(", ")}`,
  );

  // Step 4: Migrate to lazy.nvim format
  const migratedChunks = migrateChunks(extractedChunks, repository);
  logger.info(
    `[${repository.full_name}] Migrated ${migratedChunks.length} plugins to lazy.nvim format`,
  );

  // Step 5: Format migrated code with lua-fmt
  const chunks = formatter.formatChunks(migratedChunks, repository.full_name);
  logger.info(
    `[${repository.full_name}] Successfully formatted ${chunks.length} plugin configurations`,
  );

  logger.info(
    `[${repository.full_name}] Completed processing README: ${chunks.length} valid configurations`,
  );

  // Find preferred chunk by priority
  const lazy = chunks.find((chunk) => chunk.pluginManager === "lazy.nvim");
  const packer = chunks.find((chunk) => chunk.pluginManager === "packer.nvim");
  const vimPlug = chunks.find((chunk) => chunk.pluginManager === "vim-plug");

  switch (true) {
    case !!lazy:
      return {
        chunks,
        install: {
          source: "lazy.nvim" as const,
          lazy: lazy.formattedLazy,
          vimpack: lazy.formattedVimPack,
        },
      };
    case !!packer:
      return {
        chunks,
        install: {
          source: "packer.nvim" as const,
          lazy: packer.formattedLazy,
          vimpack: packer.formattedVimPack,
        },
      };
    case !!vimPlug:
      return {
        chunks,
        install: {
          source: "vim-plug" as const,
          lazy: vimPlug.formattedLazy,
          vimpack: vimPlug.formattedVimPack,
        },
      };
    default:
      logger.error(
        `[${repository.full_name}] No valid chunk found in processed chunks`,
      );
      return { chunks: [] };
  }
}
