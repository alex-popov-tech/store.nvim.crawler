import { TokenMatcher } from "./types";

export const packerTokens: TokenMatcher[] = [
  // Score 4 - ~100% identifies packer.nvim
  {
    description: "packer.nvim - explicit mention",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.content;
      const match = /packer\.nvim/i.test(contextText.toLowerCase());
      return {
        success: match,
        error: match ? undefined : "No 'packer.nvim' found in context",
      };
    },
  },

  {
    description: "packer.startup - initialization function",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.content;
      const match = /packer\.startup/.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'packer.startup' found in context",
      };
    },
  },

  {
    description: "require('packer') - initialization function",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.content;
      const match = /require\s*\(\s*['"]packer['"]\s*\)/.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No require('packer') found in context",
      };
    },
  },

  {
    description: ":Packer - packer command",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.after;
      const match = /:Packer/.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No ':Packer' command found",
      };
    },
  },

  {
    description: "use { - packer plugin definition",
    score: 4,
    matcher: (chunk) => {
      const match = /use\s*\{/.test(chunk.content);
      return {
        success: match,
        error: match ? undefined : "No 'use {' pattern found",
      };
    },
  },

  {
    description: "use ( - packer plugin definition",
    score: 4,
    matcher: (chunk) => {
      const match = /use\s*\(['{"]/.test(chunk.content);
      return {
        success: match,
        error: match ? undefined : "No 'use (' pattern found",
      };
    },
  },

  {
    description: "use ' - packer plugin definition with single quote",
    score: 4,
    matcher: (chunk) => {
      const match = /^\s*use\s*['"]/.test(chunk.content);
      return {
        success: match,
        error: match ? undefined : "No 'use '' pattern found",
      };
    },
  },

  {
    description: "requires = - dependencies specification in lua table",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for requires = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /requires\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'requires =' in lua table context found",
      };
    },
  },

  {
    description: "opt = - optional plugin loading in lua table",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for opt = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /opt\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'opt =' in lua table context found",
      };
    },
  },

  {
    description: "disabled = true|false - plugin disable control in lua table",
    score: 2,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for disabled = true/false within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /disabled\s*=\s*(true|false)/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match
          ? undefined
          : "No 'disabled = true/false' in lua table context found",
      };
    },
  },

  {
    description: "as = - plugin alias in lua table",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for as = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /as\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'as =' in lua table context found",
      };
    },
  },

  {
    description: "setup = - setup function in lua table",
    score: 2,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for setup = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /setup\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'setup =' in lua table context found",
      };
    },
  },

  {
    description: "run = - build/post-install command in lua table",
    score: 2,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for run = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /run\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'run =' in lua table context found",
      };
    },
  },

  {
    description: "fn = - function specification in lua table",
    score: 2,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for fn = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /fn\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'fn =' in lua table context found",
      };
    },
  },

  {
    // sometimes present in other configs
    description: "module = - module specification in lua table",
    score: 2,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for module = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /module\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'module =' in lua table context found",
      };
    },
  },

  {
    description: "{ 'author/plugin' } - plugin spec pattern",
    score: 4,
    matcher: (chunk) => {
      const match = /\{\s*['"](\w+)\/\w+['"]\s*\}/.test(
        chunk.content.replace(/\n/g, " "),
      );
      return {
        success: match,
        error: match ? undefined : "No plugin spec pattern found",
      };
    },
  },

  // Score 3 - ~90% identifies packer.nvim
  {
    description: "packer - keyword mention",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.content;
      // Match standalone 'packer' word
      const match = /(?<![\w-])packer(?![\w-])/i.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'packer' keyword found",
      };
    },
  },

  {
    description: "Packer - capitalized keyword mention",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.content;
      // Match standalone 'Packer' word
      const match = /(?<![\w-])Packer(?![\w-])/.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'Packer' keyword found",
      };
    },
  },

  // Score 2 - ~70% identifies packer.nvim
  {
    description: "{ ['\"'] - Lua table with quote start",
    score: 2,
    matcher: (chunk) => {
      const match = /\s*\{\s*['"]/.test(chunk.content);
      return {
        success: match,
        error: match ? undefined : "No Lua table with quote pattern found",
      };
    },
  },

  {
    description: "cmd = - command specification",
    score: 2,
    matcher: (chunk) => {
      const match = /cmd\s*=/.test(chunk.content);
      return {
        success: match,
        error: match ? undefined : "No 'cmd =' pattern found",
      };
    },
  },

  {
    description: "ft = - filetype specification",
    score: 2,
    matcher: (chunk) => {
      const match = /ft\s*=/.test(chunk.content);
      return {
        success: match,
        error: match ? undefined : "No 'ft =' pattern found",
      };
    },
  },

  {
    description: "config = - configuration function",
    score: 2,
    matcher: (chunk) => {
      const match = /config\s*=/.test(chunk.content);
      return {
        success: match,
        error: match ? undefined : "No 'config =' pattern found",
      };
    },
  },

  {
    description: "event = - event specification",
    score: 2,
    matcher: (chunk) => {
      const match = /event\s*=/.test(chunk.content);
      return {
        success: match,
        error: match ? undefined : "No 'event =' pattern found",
      };
    },
  },

  {
    description: "keys = - keybinding specification",
    score: 2,
    matcher: (chunk) => {
      const match = /keys\s*=/.test(chunk.content);
      return {
        success: match,
        error: match ? undefined : "No 'keys =' pattern found",
      };
    },
  },

  // Lua table with quoted plugin pattern (replaces shared pattern)
  {
    description: "Lua table with quoted plugin name",
    score: 2,
    matcher: (chunk) => {
      const match = /\{\s*["'][^"']+\/[^"']+["']/.test(
        chunk.content.replace(/\n/g, " "),
      );
      return {
        success: match,
        error: match ? undefined : "No Lua table with quoted plugin found",
      };
    },
  },
];
