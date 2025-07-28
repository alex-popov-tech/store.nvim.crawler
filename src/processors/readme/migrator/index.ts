import { ExtractedChunk, MigratedChunk } from "../types";
import { migrateVimPlug } from "./vim-plug";
import { migratePacker } from "./packer";
import { createLogger } from "../../../logger";

const logger = createLogger({ context: "migrator" });

function migrateChunk(
  chunk: ExtractedChunk,
): { val: MigratedChunk } | { error: string } {
  switch (chunk.pluginManager) {
    case "vim-plug":
      return migrateVimPlug(chunk);
    case "packer.nvim":
      return migratePacker(chunk);
    case "lazy.nvim":
      // Already in lazy format, just transform type
      return {
        val: {
          ...chunk,
          migrated: chunk.extracted,
        },
      };
    default:
      return { error: `Unknown plugin manager: ${chunk.pluginManager}` };
  }
}

function migrateChunks(chunks: ExtractedChunk[], repositoryFullName: string): MigratedChunk[] {
  const migrated: MigratedChunk[] = [];
  let failedMigrations = 0;

  for (const chunk of chunks) {
    const result = migrateChunk(chunk);
    if ("error" in result) {
      logger.debug(
        `[${repositoryFullName}] Failed to migrate ${chunk.pluginManager} chunk: ${result.error}`,
      );
      failedMigrations++;
      continue;
    }
    migrated.push(result.val);
  }

  if (failedMigrations > 0) {
    logger.warn(`[${repositoryFullName}] Failed to migrate ${failedMigrations} chunks`);
  }

  return migrated;
}

// Public API
export const migrator = {
  migrateChunk,
  migrateChunks,
};
