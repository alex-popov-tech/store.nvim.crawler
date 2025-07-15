export type RepositoryInfo = {
  full_name: string;
  author: string;
  name: string;
  html_url: string;
  description: string;
  homepage: string;

  topics: string[];
  tags: string[];

  stargazers_count: number;
  pretty_stargazers_count: string;

  open_issues_count: number;
  pretty_open_issues_count: string;

  forks_count: number;
  pretty_forks_count: string;

  pushed_at: string;
  pretty_pushed_at: string;
};

export type ProcessedRepositories = {
  meta: {
    total_count: number;
    max_full_name_length: number;
    max_pretty_stargazers_length: number;
    max_pretty_forks_length: number;
    max_pretty_issues_length: number;
    max_pretty_pushed_at_length: number;
  };
  items: RepositoryInfo[];
};

export type CrawlerOutput = {
  crawled_at: string;
  total_repositories: number;
  repositories: RepositoryInfo[];
};

export type YearRangeOptions = {
  yearStart?: Date;
  yearEnd?: Date;
};
