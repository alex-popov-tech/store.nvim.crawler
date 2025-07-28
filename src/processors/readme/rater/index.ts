import { Chunk, RatedChunk, PluginManager, Verdict } from "../types";
import { lazyTokens } from "./lazy";
import { packerTokens } from "./packer";
import { TokenMatcher } from "./types";
import { vimPlugTokens } from "./vim-plug";

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

function rateWithTokens(chunk: Chunk, tokens: TokenMatcher[]): RatingResult {
  let totalScore = 0;
  const matchedTokens = [];

  for (const token of tokens) {
    const result = token.matcher(chunk);

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

function rateChunk(chunk: Chunk): RatedChunk {
  const rates: Partial<RatedChunk["rates"]> = {};

  for (const [manager, tokens] of Object.entries(raters) as [
    PluginManager,
    TokenMatcher[],
  ][]) {
    const result = rateWithTokens(chunk, tokens);
    const verdictInfo = calculateVerdictForManager(result);

    rates[manager] = {
      scores: verdictInfo.scores,
      verdict: verdictInfo.level,
    };
  }

  return {
    ...chunk,
    rates: rates as RatedChunk["rates"],
  };
}

function rateChunks(chunks: Chunk[]): RatedChunk[] {
  return chunks.map((chunk) => rateChunk(chunk));
}

// Public API
export const rater = {
  rateChunks,
};
