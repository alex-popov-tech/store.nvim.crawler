import { ExtractedChunk, MigratedChunk } from "../types";
import type { Repository } from "~/pipeline/types";
import { migrate as migrateVimPlug } from "./vim-plug";
import { migrate as migratePacker } from "./packer";
import { migrate as migrateLazy } from "./lazy";
import { createLogger } from "~/logger";

const logger = createLogger({ context: "migrator" });

function migrateChunk(
  chunk: ExtractedChunk,
  repository: Repository,
): MigratedChunk {
  switch (chunk.pluginManager) {
    case "vim-plug":
      return migrateVimPlug(chunk, repository);
    case "packer.nvim":
      return migratePacker(chunk, repository);
    case "lazy.nvim":
      return migrateLazy(chunk, repository);
    default:
      throw new Error(
        `Unknown plugin manager: ${chunk.pluginManager} passed for migration`,
      );
  }
}

export function migrateChunks(
  chunks: ExtractedChunk[],
  repository: Repository,
): MigratedChunk[] {
  const migrated: MigratedChunk[] = [];
  let failedMigrations = 0;

  for (const chunk of chunks) {
    try {
      const result = migrateChunk(chunk, repository);
      migrated.push(result);
    } catch (error) {
      logger.debug(
        `[${repository.full_name}] Failed to migrate ${chunk.pluginManager} chunk: ${error instanceof Error ? error.message : String(error)}`,
      );
      failedMigrations++;
    }
  }

  if (failedMigrations > 0) {
    logger.warn(
      `[${repository.full_name}] Failed to migrate ${failedMigrations} chunks`,
    );
  }

  return migrated;
}