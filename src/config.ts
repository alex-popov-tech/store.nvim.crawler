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
    // pull all plugins which have any of these topics
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
    dir: "output",
    db: "db.json",
    install: "install.json",
    minifiedDb: "db_minified.json",
    topicRanges: "topic_ranges.json",
  },
};
