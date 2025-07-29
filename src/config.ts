import { cleanEnv, str, bool } from "envalid";

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
    (rn) => rn.trim().endsWith("dotfiles"),

    // plugin managers
    (rn) => rn.includes("pckr.nvim"),
    (rn) => rn.includes("lazy.nvim"),
    (rn) => rn.includes("rocks.nvim"),
    (rn) => rn.includes("nvim-plug"),

    // frameworks
    (rn) => rn.includes("AstroNvim"),
    (rn) => rn.includes("CyberNvim"),
    (rn) => rn.includes("LazyVim"),
    (rn) => rn.includes("kickstart"),
    (rn) => rn.includes("chaivim"),
    (rn) => rn.includes("NvChad"),
  ] as ((repoName: string) => boolean)[],

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
