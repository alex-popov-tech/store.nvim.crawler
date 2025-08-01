import { ExtractedChunk, MigratedChunk } from "../types";

export function migrateVimPlug(
  chunk: ExtractedChunk,
  repoName: string,
): { val: MigratedChunk } | { error: string } {
  // Split by newlines as vim-plug extracted format is newline-separated plugin strings
  const plugins = chunk.extracted.split("\n").filter((line) => line.trim());

  if (plugins.length === 0) {
    return { error: "No plugins found in vim-plug extraction" };
  }

  // Plugins already include quotes from extraction
  const cleanPlugins = plugins.map((p) => p.trim());

  // Find the main plugin (the one that includes repoName)
  const mainPlugin = cleanPlugins.find((p) => p.includes(repoName));
  
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

  // Multiple plugins, repoName is main, rest are dependencies
  const dependencies = cleanPlugins
    .filter((p) => p !== mainPlugin)
    .join(", ");
    
  return {
    val: {
      ...chunk,
      migrated: `{ ${mainPlugin}, dependencies = { ${dependencies} }, event = "VeryLazy" }`,
    },
  };
}
