import { cutter } from "./cutter";
import { rater } from "./rater";
import { extractor } from "./extractor";
import { migrator } from "./migrator";
import { formatter } from "./formatter";
import { FormattedChunk } from "./types";
import { createLogger } from "../../logger";

const logger = createLogger({ context: "readme-processor" });

export function processReadme(
  repoName: string,
  readmeContent: string,
): FormattedChunk[] {
  logger.info(`[${repoName}] Starting: Processing README`);

  const chunks = cutter.cutChunks(repoName, readmeContent);
  if (chunks.length === 0) {
    logger.warn(`[${repoName}] No chunks found in README`);
    return [];
  }
  logger.info(`[${repoName}] Cut ${chunks.length} chunks from README`);

  // Step 2: Rate each chunk and let only high-rated chunks pass
  const ratedChunks = rater.rateChunks(repoName, chunks);
  const highRatedChunks = ratedChunks.filter(
    (chunk) =>
      chunk.rates["packer.nvim"].verdict === "high" ||
      chunk.rates["lazy.nvim"].verdict === "high" ||
      chunk.rates["vim-plug"].verdict === "high",
  );
  logger.info(
    `[${repoName}] Rated ${ratedChunks.length} chunks, ${highRatedChunks.length} "high"-rated`,
  );

  if (highRatedChunks.length === 0) {
    logger.warn(`[${repoName}] No "high"-rated chunks found in cutted chunks`);
    return [];
  }

  // Step 3: Extract plugin configurations
  const extractedChunks = extractor.extractPlugins(highRatedChunks, repoName);
  if (extractedChunks.length === 0) {
    logger.warn(
      `[${repoName}] No VALID plugin configurations found in "high" rated chunks`,
    );
    return [];
  }

  logger.info(
    `[${repoName}] Extracted plugins configurations: ${extractedChunks.map((c) => c.pluginManager).join(", ")}`,
  );

  // Step 4: Migrate to lazy.nvim format
  const migratedChunks = migrator.migrateChunks(extractedChunks, repoName);
  logger.info(
    `[${repoName}] Migrated ${migratedChunks.length} plugins to lazy.nvim format`,
  );

  // Step 5: Format migrated code with lua-fmt
  const formattedChunks = formatter.formatChunks(migratedChunks, repoName);
  logger.info(
    `[${repoName}] Successfully formatted ${formattedChunks.length} plugin configurations`,
  );

  logger.info(
    `[${repoName}] Completed processing README: ${formattedChunks.length} valid configurations`,
  );
  return formattedChunks;
}
