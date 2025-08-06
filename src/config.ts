import { cleanEnv, str, bool } from "envalid";
import { GithubRepository } from "./sdk";

const env = cleanEnv(process.env, {
  AUTH_TOKEN: str(),

  LOG_LEVEL: str({
    default: "info",
    choices: ["debug", "info", "warn", "error"],
  }),

  UPDATE_GIST_ID: str({ default: "" }),
});

export const config = {
  ...env,
  REPOSITORIES_BLACKLIST: [
    // random repositories which for some reason have
    // topics like 'neovim-plugin' and get crawled
    (r) => r.full_name.trim().endsWith("dotfiles"),
    (r) => r.full_name.trim().endsWith("vimrc"),

    // plugin managers
    (r) => r.full_name.includes("pckr.nvim"),
    (r) => r.full_name.includes("lazy.nvim"),
    (r) => r.full_name.includes("packer.nvim"),
    (r) => r.full_name.includes("rocks.nvim"),
    (r) => r.full_name.includes("nvim-plug"),
    (r) => r.full_name.includes("minpac"),

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

    // archieved repos
    (r) => r.archived,
  ] as ((repoName: GithubRepository) => boolean)[],

  TAGS_BLACKLIST: ["neovim", "nvim", "vim", "lua", "plugin"],

  cutter: {
    // max amount of context lines to be included in each chunk
    contextLinesBefore: 3,
    contextLinesAfter: 3,
  },

  crawler: {
    readmes: ["README.md", "readme.md", "Readme.md", "README.adoc", "store.md"],
    topics: [
      "nvim-plugin",
      "nvim-plugins",
      "neovim-plugin",
      "neovim-plugins",
      "neovim-theme",
      "neovim-colorscheme",
    ],
    // limit concurrent README fetch requests
    concurrentRequestsLimit: 40,
    // last update should be not longer than 3 years ago ( attempt to detect dead plugins )
    lastUpdateAllowedInDays: 365 * 3,
  },

  output: {
    db: "output/db.json",
    install: "output/install.json",
    dbMinified: "output/db_minified.json",
    topicRanges: "output/topic_ranges.json",
  },
};
