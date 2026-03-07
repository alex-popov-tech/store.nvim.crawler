import { cleanEnv, str } from "envalid";
import * as dotenv from "dotenv";

dotenv.config();
const env = cleanEnv(process.env, {
  GITHUBB_TOKEN: str(),
  GITLAB_TOKEN: str(),

  LOG_LEVEL: str({
    default: "info",
    choices: ["debug", "info", "warn", "error"],
  }),
});

export const config = {
  ...env,
  pipeline: {
    output: {
      releaseBaseUrl:
        "https://github.com/alex-popov-tech/store.nvim.crawler/releases/latest/download",
      dbFilename: "db.json",
      lazyFilename: "lazy.nvim.json",
      vimpackFilename: "vim.pack.json",
      db: "output/db.json",
      dbMinified: "output/db_minified.json",
      vimpackDb: "output/vimpack_db.json",
      vimpackDbMinified: "output/vimpack_db_minified.json",
      lazyDb: "output/lazy_db.json",
      lazyDbMinified: "output/lazy_db_minified.json",
    },

    crawler: {
      readmes: [
        "README.md",
        "readme.md",
        "store.md",
        "Readme.md",
        "README.adoc",
        "README.markdown",
        "README.mkd",
        "readme.mkd",
      ],
      github: {
        "vim-and-neovim-in-name": [
          "vim in:name stars:>100 archived:false", // ~803 repos
          "nvim in:name stars:10..15 archived:false", // ~561 repos
          "nvim in:name stars:15..30 archived:false", // ~846 repos
          "nvim in:name stars:30..50 archived:false", // ~509 repos
          "nvim in:name stars:50..100 archived:false", // ~464 repos
          "nvim in:name stars:100..200 archived:false", // ~359 repos
          "nvim in:name stars:>200 archived:false", // ~622 repos
        ],
        "nvim-plugin": [
          "topic:nvim-plugin created:2017-01-01..2023-12-31 archived:false", // ~431 repos
          "topic:nvim-plugin created:2024-01-01..2025-12-31 archived:false", // ~555 repos
          "topic:nvim-plugin created:>=2026-01-01 archived:false", // future repos
        ],
        "nvim-plugins": [
          "topic:nvim-plugins created:2018-01-01..2025-12-31 archived:false", // ~63 repos
          "topic:nvim-plugins created:>=2026-01-01 archived:false", // future repos
        ],
        "neovim-plugin": [
          "topic:neovim-plugin created:2013-01-01..2021-06-30 archived:false", // ~266 repos
          "topic:neovim-plugin created:2021-07-01..2021-12-31 archived:false", // ~116 repos
          "topic:neovim-plugin created:2022-01-01..2022-12-31 archived:false", // ~407 repos
          "topic:neovim-plugin created:2023-01-01..2023-12-31 archived:false", // ~614 repos
          "topic:neovim-plugin created:2024-01-01..2024-06-30 archived:false", // ~470 repos
          "topic:neovim-plugin created:2024-07-01..2024-12-31 archived:false", // ~459 repos
          "topic:neovim-plugin created:2025-01-01..2025-06-30 archived:false", // split from 2025
          "topic:neovim-plugin created:2025-07-01..2025-12-31 archived:false", // split from 2025
          "topic:neovim-plugin created:>=2026-01-01 archived:false", // future repos
        ],
        "neovim-plugins": [
          "topic:neovim-plugins created:2016-01-01..2025-12-31 archived:false", // ~168 repos
          "topic:neovim-plugins created:>=2026-01-01 archived:false", // future repos
        ],
        "neovim-theme": [
          "topic:neovim-theme created:2014-01-01..2025-12-31 archived:false", // ~176 repos
          "topic:neovim-theme created:>=2026-01-01 archived:false", // future repos
        ],
        "neovim-colorscheme": [
          "topic:neovim-colorscheme created:2014-01-01..2025-12-31 archived:false", // ~294 repos
          "topic:neovim-colorscheme created:>=2026-01-01 archived:false", // future repos
        ],
        "neovim-and-plugin-topics": [
          "topic:neovim topic:plugin created:2013-01-01..2025-12-31 archived:false", // ~466 repos
          "topic:neovim topic:plugin created:>=2026-01-01 archived:false", // future repos
        ],
      },
      gitlab: {
        "neovim-plugin": [
          "topic:neovim-plugin created:2020-01-01..2025-12-31 archived:false", // ~26 repos
          "topic:neovim-plugin created:>=2026-01-01 archived:false", // future repos
        ],
      },
      // limit concurrent README fetch requests
      concurrentRequestsLimit: 40,
      // last update should be not longer than 3 years ago ( attempt to detect dead plugins )
      lastUpdateAllowedInDays: 365 * 3,
    },
    normalizator: {
      // result data should not have those tags, as they are not useful
      tagsToRemove: ["neovim", "nvim", "vim", "lua", "plugin"],
    },
    enricher: {
      cacheFilename: "star_history.json",
      output: {
        starHistory: "output/star_history.json",
      },
    },
    verificator: {
      cache: true,
      cacheLifetimeInDays: 30,
      concurrentRequestsLimit: 40,
      cacheFilename: "verification_cache.json",
      blacklist: [
        (r) => r.full_name.endsWith("vimrc"),

        // plugin managers
        (r) => r.full_name.includes("pckr.nvim"),
        (r) => r.full_name.includes("lazy.nvim"),
        (r) => r.full_name.includes("packer.nvim"),
        (r) => r.full_name.includes("rocks.nvim"),
        (r) => r.full_name.includes("nvim-plug"),
        (r) => r.full_name.includes("minpac"),
        (r) => r.full_name.includes("Vundle.vim"),

        // frameworks
        (r) => r.full_name.includes("AstroNvim"),
        (r) => r.full_name.includes("CyberNvim"),
        (r) => r.full_name.includes("LazyVim"),
        (r) => r.full_name.includes("kickstart"),
        (r) => r.full_name.includes("chaivim"),
        (r) => r.full_name.includes("NvChad"),
        (r) => r.full_name.includes("SpaceVim"),
        (r) => r.full_name.includes("LunarVim"),
        (r) => r.full_name.includes("ayamir/nvimdots"),
        (r) => r.full_name.includes("nyoom.nvim"),
        (r) => r.full_name.toLowerCase().includes("sigma.nvim"),
        (r) => r.full_name.includes("SigmaVimRc"),
        (r) => r.full_name.includes("one.nvim"),
        (r) => r.full_name.includes("nvim-ide"),
      ] as ((repoName: { full_name: string }) => boolean)[],
      output: {
        verificationCache: "output/verificator_cache.json",
      },
    },
    installator: {
      cache: true,
      cacheLifetimeInDays: 7,
      cacheFilename: "installation_cache.json",
      cutter: {
        // max amount of context lines to be included in each chunk
        contextLinesBefore: 3,
        contextLinesAfter: 3,
      },
      output: {
        installationCache: "output/installation_cache.json",
        debug: "output/installator_debug.json",
      },
    },
  },
};
