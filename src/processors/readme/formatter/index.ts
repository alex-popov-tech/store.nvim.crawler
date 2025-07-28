import { formatText } from "lua-fmt";
import * as luaparse from "luaparse";
import { MigratedChunk, FormattedChunk } from "../types";
import { createLogger } from "../../../logger";

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

function formatChunks(chunks: MigratedChunk[], repositoryFullName: string): FormattedChunk[] {
  const formattedChunks: FormattedChunk[] = [];

  for (const chunk of chunks) {
    const result = formatLuaCode(chunk.migrated);

    if (result.success) {
      formattedChunks.push({
        prev: chunk.prev,
        after: chunk.after,
        content: chunk.content,
        pluginManager: chunk.pluginManager,
        scores: chunk.scores,
        verdict: chunk.verdict,
        extracted: chunk.extracted,
        migrated: chunk.migrated,
        formatted: result.formatted,
      });
    } else {
      logger.debug(`[${repositoryFullName}] Failed to format chunk: ${result.error}`);
    }
  }

  return formattedChunks;
}

function formatLuaCode(code: string): FormatResult {
  try {
    // Wrap the code in a return statement to make it valid Lua for formatting
    const wrappedCode = `return ${code}`;

    // First, validate with luaparse for comprehensive syntax checking
    try {
      luaparse.parse(wrappedCode);
    } catch (parseError) {
      return {
        success: false,
        error:
          parseError instanceof Error ? parseError.message : String(parseError),
      };
    }

    // Then format with lua-fmt
    const formatted = formatText(wrappedCode);

    // Remove the "return " prefix after formatting
    const finalFormatted = formatted.replace(/^return\s+/, "");

    return {
      success: true,
      formatted: finalFormatted,
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
};
