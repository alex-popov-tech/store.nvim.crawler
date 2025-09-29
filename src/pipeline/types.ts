export type Repository = {
  source: "github" | "gitlab";
  /** Full repository name (owner/name) */
  full_name: string;
  /** Repository author/owner */
  author: string;
  /** Repository name only */
  name: string;
  url: string;
  description: string;
  tags: string[];
  stars: number;
  issues: number;
  created_at: string;
  updated_at: string;
  branch: string;
  pretty: {
    /** Formatted star count (e.g., "1.2k", "500") */
    stars: string;
    /** Formatted issues count (e.g., "1.2k", "500") */
    issues: string;
    /** Formatted relative time for creation (e.g., "2 years ago") */
    created_at: string;
    /** Formatted relative time for last update (e.g., "3 months ago") */
    updated_at: string;
  };
  /** README file path with branch (e.g., "main/README.md") */
  readme?: string;
};

export type RepositoryWithInstallationInfo = Repository & {
  install: {
    source: "default" | "lazy.nvim" | "packer.nvim" | "vim-plug";
    lazy: string;
    vimpack: string;
  };
};

export type PluginManager =
  | "lazy.nvim"
  | "packer.nvim"
  | "vim-plug"
  | "vim.pack";

export type InstallationsLazyNvim = {
  meta: { created_at: number };
  items: { [repoUrl: string]: string };
};

export type InstallationsVimPack = {
  meta: { created_at: number };
  items: { [repoUrl: string]: string };
};

export type Database = {
  meta: { created_at: number };
  items: Omit<Repository, "branch">[];
};
