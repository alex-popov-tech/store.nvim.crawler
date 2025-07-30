import { PluginManager } from "~/types";

export type Verdict = "high" | "medium" | "low";

export type Chunk = {
  prev: string;
  after: string;
  content: string;
};

export type RatedChunk = {
  prev: string;
  after: string;
  content: string;
  rates: {
    [K in PluginManager]: {
      scores: number[];
      verdict: Verdict;
    };
  };
};

export type ExtractedChunk = {
  prev: string;
  after: string;
  content: string;
  pluginManager: PluginManager;
  scores: number[];
  verdict: Verdict;
  extracted: string;
};

export type MigratedChunk = {
  prev: string;
  after: string;
  content: string;
  pluginManager: PluginManager;
  scores: number[];
  verdict: Verdict;
  extracted: string;
  migrated: string;
};

export type FormattedChunk = {
  prev: string;
  after: string;
  content: string;
  pluginManager: PluginManager;
  scores: number[];
  verdict: Verdict;
  extracted: string;
  migrated: string;
  formatted: string;
};
