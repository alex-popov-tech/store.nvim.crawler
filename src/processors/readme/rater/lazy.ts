import { TokenMatcher } from "./types";

export const lazyTokens: TokenMatcher[] = [
  // Score 4 - ~100% identifies lazy.nvim
  {
    description: "lazy.nvim - explicit mention",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.content;
      const match = /lazy.nvim/i.test(contextText.toLowerCase());
      return {
        success: match,
        error: match ? undefined : "No 'lazy.nvim' found",
      };
    },
  },

  {
    description: "lazy.vim - explicit mention",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.content;
      const match = /lazy.vim/i.test(contextText.toLowerCase());
      return {
        success: match,
        error: match ? undefined : "No 'lazy.vim' found",
      };
    },
  },

  {
    description: "VeryLazy - lazy.nvim specific event",
    score: 4,
    matcher: (chunk) => {
      const match = /["']VeryLazy["']/.test(chunk.content);
      return {
        success: match,
        error: match ? undefined : "No 'VeryLazy' found",
      };
    },
  },

  {
    description:
      "require('lazy') - primary function call to initialize lazy.nvim",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.content;
      const match = /require\s*\(\s*['"]lazy['"]\s*\)/.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No require('lazy') pattern found",
      };
    },
  },

  {
    description: ":Lazy - lazy.nvim command",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.after;
      const match = /:Lazy/.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No ':Lazy' command found",
      };
    },
  },

  {
    description:
      "dependencies = - distinctive keyword for specifying dependencies in lua table",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for dependencies = within a lua table context (table somewhere in the context)
      const hasTable = /\{/.test(contextText);
      const hasKey = /dependencies\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match
          ? undefined
          : "No 'dependencies =' in lua table context found",
      };
    },
  },

  {
    description: "lazy = - lazy loading control in lua table",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for lazy = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /lazy\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'lazy =' in lua table context found",
      };
    },
  },

  {
    description:
      "enabled = true|false - plugin enable/disable control in lua table",
    score: 2,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for enabled = true/false within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /enabled\s*=\s*(true|false)/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match
          ? undefined
          : "No 'enabled = true/false' in lua table context found",
      };
    },
  },

  {
    description: "priority = - loading priority control in lua table",
    score: 2,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for priority = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /priority\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'priority =' in lua table context found",
      };
    },
  },

  {
    description: "build = - build/post-install command in lua table",
    score: 2,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for build = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /build\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'build =' in lua table context found",
      };
    },
  },

  {
    description: "version = - version constraint in lua table",
    score: 2,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for version = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /version\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'version =' in lua table context found",
      };
    },
  },

  {
    description: "pin = - pin to specific commit in lua table",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for pin = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /pin\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'pin =' in lua table context found",
      };
    },
  },

  {
    description: "init = - initialization function in lua table",
    score: 2,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for init = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /init\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'init =' in lua table context found",
      };
    },
  },

  {
    description: "{ 'author/plugin' } - plugin spec with single quotes",
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

  // Score 3 - ~90% identifies lazy.nvim
  {
    description: "lazy - keyword mention in heading",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.prev;
      // Match standalone 'lazy' word, not as part of other words
      const match = /(?<![\w-])#+.*lazy(?![\w-])/i.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'lazy' keyword found",
      };
    },
  },

  {
    description: "lazy - keyword mention",
    score: 2,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.content;
      // Match standalone 'lazy' word, not as part of other words
      const match = /(?<![\w-])lazy(?![\w-])/i.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'lazy' keyword found",
      };
    },
  },

  {
    description: "LazyNvim - capitalized keyword mention",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.content;
      // Match standalone 'Lazy' word, not as part of other words
      const match = /(?<![\w-])LazyNvim(?![\w-])/.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'LazyNvim' keyword found",
      };
    },
  },

  {
    description: "LazyVim - capitalized keyword mention",
    score: 4,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.content;
      // Match standalone 'Lazy' word, not as part of other words
      const match = /(?<![\w-])LazyVim(?![\w-])/.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'LazyVim' keyword found",
      };
    },
  },

  {
    description: "Lazy - capitalized keyword mention",
    score: 3,
    matcher: (chunk) => {
      const contextText = chunk.prev + " " + chunk.content;
      // Match standalone 'Lazy' word, not as part of other words
      const match = /(?<![\w-])Lazy(?![\w-])/.test(contextText);
      return {
        success: match,
        error: match ? undefined : "No 'Lazy' keyword found",
      };
    },
  },

  {
    description: "opts = - configuration options in lua table",
    score: 2,
    matcher: (chunk) => {
      const contextText = chunk.content;
      // Check for opts = within a lua table context
      const hasTable = /\{/.test(contextText);
      const hasKey = /opts\s*=/.test(chunk.content);
      const match = hasTable && hasKey;
      return {
        success: match,
        error: match ? undefined : "No 'opts =' in lua table context found",
      };
    },
  },

  // Score 2 - ~70% identifies lazy.nvim
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
