import { PluginManager } from "../types";

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
  migratedLazy: string;
  migratedVimPack: string;
};

export type FormattedChunk = {
  prev: string;
  after: string;
  content: string;
  pluginManager: PluginManager;
  scores: number[];
  verdict: Verdict;
  extracted: string;
  migratedLazy: string;
  migratedVimPack: string;
  formattedLazy: string;
  formattedVimPack: string;
};

/**
 * Ultra-minimal cache entry for installation results stored in remote gist
 * Map key = repository full_name, value = only essential data
 */
export type InstallationCacheEntry = {
  updated_at: string;
  source: "default" | "lazy.nvim" | "packer.nvim" | "vim-plug";
  lazy: string;
  vimpack: string;
};
export type InstallationCache = Map<string, InstallationCacheEntry>;

export type InstallationDebugEntry = {
  source: "cache" | "processed";
  install: {
    source: "default" | "lazy.nvim" | "packer.nvim" | "vim-plug";
    lazy: string;
    vimpack: string;
  };

  chunks?: FormattedChunk[];
  updated_at?: string;
  readme?: string;

  default?: {
    lazy: string;
    vimpack: string;
  };
};

export type InstallationDebug = Map<string, InstallationDebugEntry>;
