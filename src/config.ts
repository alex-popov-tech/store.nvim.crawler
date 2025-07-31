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

    // plugin managers
    (r) => r.full_name.includes("pckr.nvim"),
    (r) => r.full_name.includes("lazy.nvim"),
    (r) => r.full_name.includes("rocks.nvim"),
    (r) => r.full_name.includes("nvim-plug"),

    // frameworks
    (r) => r.full_name.includes("AstroNvim"),
    (r) => r.full_name.includes("CyberNvim"),
    (r) => r.full_name.includes("LazyVim"),
    (r) => r.full_name.includes("kickstart"),
    (r) => r.full_name.includes("chaivim"),
    (r) => r.full_name.includes("NvChad"),
    (r) => r.full_name.includes("SpaceVim"),
    (r) => r.full_name.includes("LunarVim"),

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
    yearToPullPluginsFrom: 2013, // pull all plugins created at 2010 or later
    topics: ["nvim-plugin", "neovim-plugin"], // pull all plugins which have any of these topics
    // yearToPullPluginsFrom: 2025,
    // topics: ["nvim-plugin"],
  },

  output: {
    db: "db.json",
    install: "install.json",
    minifiedDb: "db_minified.json",
  },
};
