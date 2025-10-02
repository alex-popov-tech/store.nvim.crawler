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
      minifiedDbGistId: "92d1366bfeb168d767153a24be1475b5",
      dbGistFilename: "db.json",
      minifiedDbGistRawUrl:
        "https://gist.githubusercontent.com/alex-popov-tech/92d1366bfeb168d767153a24be1475b5/raw/db.json",
      db: "output/db.json",
      dbMinified: "output/db_minified.json",

      vimpackDbGistId: "18a46177d6473e12bc2c854e2548f127",
      vimpackGistFilename: "vim.pack.json",
      vimpackDb: "output/vimpack_db.json",
      vimpackDbMinified: "output/vimpack_db_minified.json",

      lazyDbGistId: "6629a59e7910aa08b1aa5cdc0519b8b4",
      lazyGistFilename: "lazy.nvim.json",
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
        ],
        "nvim-plugins": [
          "topic:nvim-plugins created:2018-01-01..2025-12-31 archived:false", // ~63 repos
        ],
        "neovim-plugin": [
          "topic:neovim-plugin created:2013-01-01..2021-06-30 archived:false", // ~266 repos
          "topic:neovim-plugin created:2021-07-01..2021-12-31 archived:false", // ~116 repos
          "topic:neovim-plugin created:2022-01-01..2022-12-31 archived:false", // ~407 repos
          "topic:neovim-plugin created:2023-01-01..2023-12-31 archived:false", // ~614 repos
          "topic:neovim-plugin created:2024-01-01..2024-06-30 archived:false", // ~470 repos
          "topic:neovim-plugin created:2024-07-01..2024-12-31 archived:false", // ~459 repos
          "topic:neovim-plugin created:2025-01-01..2025-12-31 archived:false", // ~677 repos
        ],
        "neovim-plugins": [
          "topic:neovim-plugins created:2016-01-01..2025-12-31 archived:false", // ~168 repos
        ],
        "neovim-theme": [
          "topic:neovim-theme created:2014-01-01..2025-12-31 archived:false", // ~176 repos
        ],
        "neovim-colorscheme": [
          "topic:neovim-colorscheme created:2014-01-01..2025-12-31 archived:false", // ~294 repos
        ],
        "neovim-and-plugin-topics": [
          "topic:neovim topic:plugin created:2013-01-01..2025-12-31 archived:false", // ~466 repos
        ],
      },
      gitlab: {
        "neovim-plugin": [
          "topic:neovim-plugin created:2020-01-01..2025-12-31 archived:false", // ~26 repos
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
    verificator: {
      cache: true,
      concurrentRequestsLimit: 40,
      // for updating through api
      gistId: "8a47bb5ef75c59e80e94a3417c48d056",
      // for fetching, avoiding github api transmission limits
      rawUrl:
        "https://gist.githubusercontent.com/alex-popov-tech/8a47bb5ef75c59e80e94a3417c48d056/raw/verification_cache.json",
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
      cache: false,
      // for updating through api
      cacheGistId: "d72a6787a7a009534dfee7e230827af2",
      // for fetching, avoiding github api transmission limits
      cacheGistRawUrl:
        "https://gist.githubusercontent.com/alex-popov-tech/d72a6787a7a009534dfee7e230827af2/raw/installation_cache.json",
      cutter: {
        // max amount of context lines to be included in each chunk
        contextLinesBefore: 3,
        contextLinesAfter: 3,
      },
      output: {
        install: "output/installator_cache.json",
      },
    },
  },
};
