import { formatText } from "lua-fmt";
import { MigratedChunk, FormattedChunk } from "../types";
import { createLogger } from "~/logger";

const logger = createLogger({ context: "formatter" });

type FormatResult =
  | {
      success: true;
      formatted: string;
    }
  | {
      success: false;
      error: string;
    };

function formatChunks(
  chunks: MigratedChunk[],
  repositoryFullName: string,
): FormattedChunk[] {
  const formattedChunks: FormattedChunk[] = [];

  for (const chunk of chunks) {
    const lazyResult = formatLuaCode(chunk.migratedLazy);
    const vimPackResult = formatVimPackCode(chunk.migratedVimPack);

    if (lazyResult.success && vimPackResult.success) {
      formattedChunks.push({
        prev: chunk.prev,
        after: chunk.after,
        content: chunk.content,
        pluginManager: chunk.pluginManager,
        scores: chunk.scores,
        verdict: chunk.verdict,
        extracted: chunk.extracted,
        migratedLazy: chunk.migratedLazy,
        migratedVimPack: chunk.migratedVimPack,
        formattedLazy: lazyResult.formatted,
        formattedVimPack: vimPackResult.formatted,
      });
    } else {
      const errors = [];
      if (!lazyResult.success) errors.push(`lazy: ${(lazyResult as any).error}`);
      if (!vimPackResult.success) errors.push(`vimpack: ${(vimPackResult as any).error}`);

      logger.info(
        `[${repositoryFullName}] Failed to format chunk: ${errors.join(', ')}`,
      );
    }
  }

  return formattedChunks;
}

function formatLuaCode(code: string): FormatResult {
  try {
    const formatted = formatText(code, { lineWidth: 30 });

    return {
      success: true,
      formatted: formatted.trim(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function formatVimPackCode(code: string): FormatResult {
  try {
    const formatted = formatText(code, { lineWidth: 80 });

    return {
      success: true,
      formatted: formatted.trim(),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const formatter = {
  formatChunks,
  formatLuaCode,
  formatVimPackCode,
};
