import { ExtractedChunk, PluginManager, RatedChunk } from "../types";
import { extractFromLuaAST } from "./luaparse";
import { matchers as packerMatchers } from "./packer";
import { matchers as lazyMatchers } from "./lazy";
import { extractFromVimPlug } from "./vim-plug";
import { createLogger } from "../../../logger";

const logger = createLogger({ context: "extractor" });

function extractPackerPlugins(
  ratedChunk: RatedChunk,
  expectedRepo: string,
): { val: ExtractedChunk } | { error: string } {
  const result = extractFromLuaAST({
    luaCode: ratedChunk.content,
    matchers: packerMatchers,
    maxDepth: 3,
    expectedRepo,
  });

  if (result.error || !result.nodes || result.nodes.length === 0) {
    return { error: result.error || "No matching nodes found" };
  }

  // Warn if more than one node was extracted
  if (result.nodes.length > 1) {
    logger.warn(
      `[${expectedRepo}] Expected 1 packer.nvim configuration node, found ${result.nodes.length}. Using first match.`,
    );
  }

  // The matcher already returned the formatted content
  const firstNode = result.nodes[0];
  const extracted = firstNode.sourceCode; // This is now the formatted output from the matcher

  return {
    val: {
      prev: ratedChunk.prev,
      after: ratedChunk.after,
      content: ratedChunk.content,
      pluginManager: "packer.nvim",
      ...ratedChunk.rates["packer.nvim"],
      extracted,
    },
  };
}

function extractLazyPlugins(
  ratedChunk: RatedChunk,
  expectedRepo: string,
): { val: ExtractedChunk } | { error: string } {
  const result = extractFromLuaAST({
    luaCode: ratedChunk.content,
    matchers: lazyMatchers,
    maxDepth: 3,
    expectedRepo,
  });

  if (result.error || !result.nodes || result.nodes.length === 0) {
    return { error: result.error || "No matching nodes found" };
  }

  // Warn if more than one node was extracted
  if (result.nodes.length > 1) {
    logger.warn(
      `[${expectedRepo}] Expected 1 lazy.nvim configuration node, found ${result.nodes.length}. Using first match.`,
    );
  }

  // The matcher already returned the formatted content
  const firstNode = result.nodes[0];
  const extracted = firstNode.sourceCode; // This is now the formatted output from the matcher

  return {
    val: {
      prev: ratedChunk.prev,
      after: ratedChunk.after,
      content: ratedChunk.content,
      pluginManager: "lazy.nvim",
      ...ratedChunk.rates["lazy.nvim"],
      extracted,
    },
  };
}

function extractVimPlugPlugins(
  ratedChunk: RatedChunk,
  expectedRepo: string,
): { val: ExtractedChunk } | { error: string } {
  const result = extractFromVimPlug(ratedChunk.content, expectedRepo);

  if ("error" in result) {
    return { error: result.error };
  }

  // The extractor already returned the formatted content
  const extracted = result.extracted.join("\n");

  return {
    val: {
      prev: ratedChunk.prev,
      after: ratedChunk.after,
      content: ratedChunk.content,
      pluginManager: "vim-plug",
      ...ratedChunk.rates["vim-plug"],
      extracted,
    },
  };
}

export const extractor = {
  extractPlugins: (
    ratedChunks: RatedChunk[],
    expectedRepo: string,
  ): ExtractedChunk[] => {
    const extractedChunks: ExtractedChunk[] = [];
    let failedExtractions = 0;

    // extract all 'high' rated chunks
    for (const ratedChunk of ratedChunks) {
      if (ratedChunk.rates["packer.nvim"].verdict === "high") {
        const result = extractPackerPlugins(ratedChunk, expectedRepo);
        if ("error" in result) {
          logger.debug(`[${expectedRepo}] Failed to extract packer.nvim config: ${result.error}`);
          failedExtractions++;
          continue;
        }
        extractedChunks.push(result.val);
      } else if (ratedChunk.rates["lazy.nvim"].verdict === "high") {
        const result = extractLazyPlugins(ratedChunk, expectedRepo);
        if ("error" in result) {
          logger.debug(`[${expectedRepo}] Failed to extract lazy.nvim config: ${result.error}`);
          failedExtractions++;
          continue;
        }
        extractedChunks.push(result.val);
      } else if (ratedChunk.rates["vim-plug"].verdict === "high") {
        const result = extractVimPlugPlugins(ratedChunk, expectedRepo);
        if ("error" in result) {
          logger.debug(`[${expectedRepo}] Failed to extract vim-plug config: ${result.error}`);
          failedExtractions++;
          continue;
        }
        extractedChunks.push(result.val);
      }
    }

    if (failedExtractions > 0) {
      logger.debug(`[${expectedRepo}] Failed to extract ${failedExtractions} configurations`);
    }

    // Leave only first extracted chunk for each plugin
    // (as it's probably first, most minimal and 'default' example)
    const result = {} as Record<PluginManager, ExtractedChunk>;
    for (const extractedChunk of extractedChunks) {
      const pm = extractedChunk.pluginManager;
      if (!result[pm]) {
        result[pm] = extractedChunk;
      }
    }
    return Object.values(result);
  },
};
