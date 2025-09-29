import {
  getRepositoryTree as getGithubRepositoryTree,
  GithubTreeItem,
} from "~/sdk/github";
import {
  getRepositoryTree as getGitlabRepositoryTree,
  GitlabTreeItem,
} from "~/sdk/gitlab";
import { Repository } from "../types";
import { VerificationResult } from "./types";

function analyzeTreeStructure(
  tree: (GithubTreeItem | GitlabTreeItem)[],
): VerificationResult {
  const files = tree
    .filter((item) => item.type === "blob")
    .map((item) => item.path);
    
  const directories = tree
    .filter((item) => item.type === "tree")
    .map((item) => item.path);

  // Exclude config repositories that have init files in root
  const hasInitLua = files.some((f) => f === "init.lua");
  const hasInitVim = files.some((f) => f === "init.vim");
  if (hasInitLua || hasInitVim) {
    const configFile = hasInitLua ? "init.lua" : "init.vim";
    return { isPlugin: false, reason: `appears to be a vim/neovim config (has ${configFile} in root)` };
  }

  // Additional configuration file checks
  const hasVimrc = files.some((f) => f === ".vimrc" || f === "vimrc");
  if (hasVimrc) {
    return { isPlugin: false, reason: "appears to be a vim config (has .vimrc/vimrc in root)" };
  }

  // Check for plugin/ directory AND files
  const hasPluginDir = directories.some((d) => d === "plugin");
  const pluginVimFiles = files.filter(
    (f) => f.startsWith("plugin/") && f.endsWith(".vim"),
  );
  const pluginLuaFiles = files.filter(
    (f) => f.startsWith("plugin/") && f.endsWith(".lua"),
  );
  if (hasPluginDir && (pluginVimFiles.length > 0 || pluginLuaFiles.length > 0)) {
    return { isPlugin: true };
  }

  // Check for lua/ directory AND files
  const hasLuaDir = directories.some((d) => d === "lua");
  const luaFiles = files.filter(
    (f) => f.startsWith("lua/") && f.endsWith(".lua"),
  );
  if (hasLuaDir && luaFiles.length > 0) {
    return { isPlugin: true };
  }

  // Check for autoload/ directory AND files
  const hasAutoloadDir = directories.some((d) => d === "autoload");
  const autoloadFiles = files.filter(
    (f) => f.startsWith("autoload/") && f.endsWith(".vim"),
  );
  if (hasAutoloadDir && autoloadFiles.length > 0) {
    return { isPlugin: true };
  }

  // Check for colors/ directory AND files
  const hasColorsDir = directories.some((d) => d === "colors");
  const colorsVimFiles = files.filter(
    (f) => f.startsWith("colors/") && f.endsWith(".vim"),
  );
  const colorsLuaFiles = files.filter(
    (f) => f.startsWith("colors/") && f.endsWith(".lua"),
  );
  if (hasColorsDir && (colorsVimFiles.length > 0 || colorsLuaFiles.length > 0)) {
    return { isPlugin: true };
  }

  // Check for ftplugin/ directory AND files
  const hasFtpluginDir = directories.some((d) => d === "ftplugin");
  const ftpluginVimFiles = files.filter(
    (f) => f.startsWith("ftplugin/") && f.endsWith(".vim"),
  );
  if (hasFtpluginDir && ftpluginVimFiles.length > 0) {
    return { isPlugin: true };
  }

  // Check for syntax/ directory AND files
  const hasSyntaxDir = directories.some((d) => d === "syntax");
  const syntaxVimFiles = files.filter(
    (f) => f.startsWith("syntax/") && f.endsWith(".vim"),
  );
  if (hasSyntaxDir && syntaxVimFiles.length > 0) {
    return { isPlugin: true };
  }

  // Check for ftdetect/ directory AND files
  const hasFtdetectDir = directories.some((d) => d === "ftdetect");
  const ftdetectVimFiles = files.filter(
    (f) => f.startsWith("ftdetect/") && f.endsWith(".vim"),
  );
  if (hasFtdetectDir && ftdetectVimFiles.length > 0) {
    return { isPlugin: true };
  }

  // Check for ftdetect/ and syntax/ directories both with .vim files (original combined check)
  if (hasFtdetectDir && ftdetectVimFiles.length > 0 && 
      hasSyntaxDir && syntaxVimFiles.length > 0) {
    return { isPlugin: true };
  }

  return { isPlugin: false, reason: "no plugin file structure found" };
}

export async function checkFileStructure(
  repo: Repository,
): Promise<VerificationResult> {
  const tree =
    repo.source === "gitlab"
      ? await getGitlabRepositoryTree(repo.full_name, repo.branch)
      : await getGithubRepositoryTree(repo.full_name, repo.branch);

  if ("error" in tree) {
    return { isPlugin: false, reason: `failed to fetch repository tree` };
  }

  return analyzeTreeStructure(tree.data);
}
