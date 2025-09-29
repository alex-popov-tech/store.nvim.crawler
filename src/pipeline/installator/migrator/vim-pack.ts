import type { Repository } from "~/pipeline/types";
import { cleanQuotes } from "./shared";

export function generateVimPackAddForDependency(dependencyName: string) {
  const cleanName = cleanQuotes(dependencyName);

  const url =
    cleanName.includes("/") && !cleanName.startsWith("http")
      ? `https://github.com/${cleanName}`
      : cleanName;

  return `vim.pack.add({ { src = '${url}' } })`;
}

export function generateVimPackConfig(
  repository: Repository,
  dependencies: string[] = [],
  setupCall?: string,
): string {
  const depLines = dependencies.map((dep) =>
    generateVimPackAddForDependency(dep),
  );
  const mainLine = `vim.pack.add({ { src = '${repository.url}' } })`;

  const lines = [...depLines, mainLine, ...(setupCall ? ["", setupCall] : [])];

  return lines.join("\n");
}
