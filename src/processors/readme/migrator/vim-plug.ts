import { ExtractedChunk, MigratedChunk } from "../types";

export function migrateVimPlug(
  chunk: ExtractedChunk,
): { val: MigratedChunk } | { error: string } {
  // Split by newlines as vim-plug extracted format is newline-separated plugin strings
  const plugins = chunk.extracted.split("\n").filter((line) => line.trim());

  if (plugins.length === 0) {
    return { error: "No plugins found in vim-plug extraction" };
  }

  // Plugins already include quotes from extraction
  const cleanPlugins = plugins.map((p) => p.trim());

  // First plugin is the main one
  const mainPlugin = cleanPlugins[0];

  // Build lazy.nvim configuration
  if (cleanPlugins.length === 1) {
    // Single plugin, simple format
    return {
      val: {
        ...chunk,
        migrated: `{ ${mainPlugin}, event = "VeryLazy" }`,
      },
    };
  }

  // Multiple plugins, first is main, rest are dependencies
  const dependencies = cleanPlugins.slice(1).join(", ");
  return {
    val: {
      ...chunk,
      migrated: `{ ${mainPlugin}, dependencies = { ${dependencies} }, event = "VeryLazy" }`,
    },
  };
}
