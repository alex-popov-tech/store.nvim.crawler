import { ExtractedChunk, MigratedChunk } from "../types";
import type { Repository } from "~/pipeline/types";
import { generateVimPackConfig } from "./vim-pack";
import { generateLazyConfig } from "./lazy";
import * as luaparse from "luaparse";

export function migrate(
  chunk: ExtractedChunk,
  repository: Repository,
): MigratedChunk {
  const plugins = chunk.extracted
    .split("\n")
    .filter((line: string) => line.trim());

  const mainPlugin = plugins.find((p: string) =>
    p.includes(`'${repository.full_name}'`) || p.includes(`"${repository.full_name}"`)
  )!;
  const dependencies = plugins
    .filter((p: string) => p !== mainPlugin);

  const migratedLazy = generateLazyConfig(mainPlugin, dependencies);
  const migratedVimPack = generateVimPackConfig(repository, dependencies);

  // Validate generated Lua code
  luaparse.parse(migratedLazy);
  luaparse.parse(migratedVimPack);

  return {
    ...chunk,
    migratedLazy,
    migratedVimPack,
  };
}
