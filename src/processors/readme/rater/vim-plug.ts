import { TokenMatcher } from "./types";

export const vimPlugTokens: TokenMatcher[] = [
  // Score 4 - ~100% identifies vim-plug
  {
    description: "vim-plug - explicit mention",
    score: 4,
    matcher: (repoName, chunk) => {
      const contextText = chunk.prev + " " + chunk.content + " " + chunk.after;
      const match = /(?<![\w])vim-plug(?![\w])/i.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'vim-plug' found",
      };
    },
  },

  {
    description: "vimplug - explicit mention",
    score: 4,
    matcher: (repoName, chunk) => {
      const contextText = chunk.prev + " " + chunk.content + " " + chunk.after;
      const match = /(?<![\w])vimplug(?![\w])/i.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'vimplug' found",
      };
    },
  },

  {
    description: "vim plug - explicit mention",
    score: 4,
    matcher: (repoName, chunk) => {
      const contextText = chunk.prev + " " + chunk.content + " " + chunk.after;
      const match = /(?<![\w])vim\s+plug(?![\w])/i.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'vim plug' found",
      };
    },
  },

  {
    description: "Plug - keyword mention",
    score: 4,
    matcher: (repoName, chunk) => {
      const contextText = chunk.prev;
      // Match standalone 'Plug' word
      const match = /(?<![\w-])Plug(?![\w-])/.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'Plug' keyword found",
      };
    },
  },

  {
    description: "Plug ' - plugin definition with single quote",
    score: 4,
    matcher: (repoName, chunk) => {
      const match = /Plug\s+'/.test(chunk.content);
      return {
        success: match,
        error: match ? undefined : "No 'Plug '' pattern found",
      };
    },
  },

  {
    description: "plug#begin - initialization function",
    score: 4,
    matcher: (repoName, chunk) => {
      const contextText = chunk.prev + " " + chunk.content + " " + chunk.after;
      const match = /plug#begin/.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'plug#begin' found",
      };
    },
  },

  {
    description: "plug#end - finalization function",
    score: 4,
    matcher: (repoName, chunk) => {
      const contextText = chunk.prev + " " + chunk.content + " " + chunk.after;
      const match = /plug#end/.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'plug#end' found",
      };
    },
  },

  {
    description: ":PlugInstall - vim-plug command",
    score: 4,
    matcher: (repoName, chunk) => {
      const contextText = chunk.prev + " " + chunk.content + " " + chunk.after;
      const match = /:PlugInstall/.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No ':PlugInstall' found",
      };
    },
  },

  {
    description: "PlugInstall - vim-plug command reference",
    score: 4,
    matcher: (repoName, chunk) => {
      const match = /PlugInstall/.test(chunk.content);
      return {
        success: match,
        error: match ? undefined : "No 'PlugInstall' found",
      };
    },
  },

  {
    description: "UpdateRemotePlugins - vim-plug related command",
    score: 4,
    matcher: (repoName, chunk) => {
      const match = /UpdateRemotePlugins/.test(chunk.content);
      return {
        success: match,
        error: match ? undefined : "No 'UpdateRemotePlugins' found",
      };
    },
  },
];
