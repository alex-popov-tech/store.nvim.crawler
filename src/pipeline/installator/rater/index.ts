import { PluginManager } from "../../types";
import { Chunk, RatedChunk, Verdict } from "../types";
import { lazyTokens } from "./lazy";
import { packerTokens } from "./packer";
import { TokenMatcher } from "./types";
import { vimPlugTokens } from "./vim-plug";
import { createLogger } from "~/logger";

const logger = createLogger({ context: "rater" });

// Inline type for rating result
interface RatingResult {
  score: number;
  matchedTokens: Array<{
    description: string;
    score: number;
    result: {
      success: boolean;
      error?: string;
    };
  }>;
}

const raters: Record<PluginManager, TokenMatcher[]> = {
  "lazy.nvim": lazyTokens,
  "packer.nvim": packerTokens,
  "vim-plug": vimPlugTokens,
  "vim.pack": [], // vim.pack instructions won't be rated (they're rare in READMEs)
};

function calculateVerdictForManager(ratingResult: RatingResult): {
  level: Verdict;
  scores: number[];
} {
  const scores = ratingResult.matchedTokens.map((t) => t.score);
  let score4Count = scores.filter((s) => s === 4).length;
  let score3Count = scores.filter((s) => s === 3).length;
  let score2Count = scores.filter((s) => s === 2).length;

  if (score4Count >= 1) {
    return { level: "high", scores };
  } else if (score3Count >= 2) {
    return { level: "high", scores };
  } else if (score3Count === 1 && score2Count >= 1) {
    return { level: "high", scores };
  } else if (score3Count === 1 && score2Count === 0) {
    return { level: "medium", scores };
  } else {
    return { level: "low", scores };
  }
}

function rateWithTokens(
  repoName: string,
  chunk: Chunk,
  tokens: TokenMatcher[],
): RatingResult {
  let totalScore = 0;
  const matchedTokens = [];

  for (const token of tokens) {
    const result = token.matcher(repoName, chunk);

    if (result.success) {
      totalScore += token.score;
      matchedTokens.push({
        description: token.description,
        score: token.score,
        result,
      });
    }
  }

  return {
    score: totalScore,
    matchedTokens,
  };
}

function rateChunk(repoName: string, chunk: Chunk): RatedChunk {
  const rates: Partial<RatedChunk["rates"]> = {};

  for (const [manager, tokens] of Object.entries(raters) as [
    PluginManager,
    TokenMatcher[],
  ][]) {
    const result = rateWithTokens(repoName, chunk, tokens);
    const verdictInfo = calculateVerdictForManager(result);

    rates[manager] = {
      scores: verdictInfo.scores,
      verdict: verdictInfo.level,
    };
  }

  // if found more than 1 'high' - leave only one which has the highest score
  const isHighTie =
    Object.values(rates).filter((r) => r.verdict === "high").length > 1;
  if (isHighTie) {
    const sum = (nums: number[]) => nums.reduce((a, b) => a + b, 0);
    const pluginManagersScores = Object.entries(rates)
      .map(([pm, r]) => ({ pm, r: sum(r.scores) }))
      .sort((a, b) => b.r - a.r);
    const pluginManagerWithHighestScore = pluginManagersScores[0];
    for (const [pm, r] of Object.entries(rates)) {
      if (pm === pluginManagerWithHighestScore.pm) {
        r.verdict = "high";
      } else {
        r.verdict = "medium";
      }
    }
  }

  return {
    ...chunk,
    rates: rates as RatedChunk["rates"],
  };
}

function rateChunks(repoName: string, chunks: Chunk[]): RatedChunk[] {
  const result = chunks.map((chunk) => rateChunk(repoName, chunk));
  logger.debug(`Rated chunks: ${JSON.stringify(result, null, 2)}`);
  return result;
}

// Public API
export const rater = {
  rateChunks,
};
