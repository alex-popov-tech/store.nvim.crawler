import fs from "fs";
import { createLogger } from "~/logger";
import { config } from "~/config";
import type {
  Database,
  InstallationsLazyNvim,
  InstallationsVimPack,
  Repository,
  RepositoryWithInstallationInfo,
} from "../types";

const logger = createLogger({ context: "v2-post-processor" });

type ProcessedRepository = Omit<Repository, "branch">;

type ProcessedDatabase = {
  meta: {
    created_at: number;
  };
  items: ProcessedRepository[];
};

export function postProcessDatabase(
  repositories: Map<string, RepositoryWithInstallationInfo>,
) {
  logger.info("🔄 Starting post-processing...");

  // 1. Create installation databases from cache
  const lazyItems: InstallationsLazyNvim = {
    meta: { created_at: Date.now() },
    items: {},
  };
  const vimpackItems: InstallationsVimPack = {
    meta: { created_at: Date.now() },
    items: {},
  };
  const database: Database = { meta: { created_at: Date.now() }, items: [] };

  for (const [_, repo] of repositories) {
    const { branch: _, install, ...rest } = repo;
    lazyItems.items[repo.full_name] = install.lazy;
    vimpackItems.items[repo.full_name] = install.vimpack;
    database.items.push(rest);
  }

  database.items = database.items.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  // save local artifacts and return minified versions for upload
  const log = (name: string, path: string, bytes: number) =>
    logger.info(`Saved ${name} to ${path} (${bytes} bytes)`);
  const jsonDatabase = JSON.stringify(database, null, 2);
  fs.writeFileSync(config.pipeline.output.db, jsonDatabase);
  log("database", config.pipeline.output.db, jsonDatabase.length);
  const jsonDatabaseMinified = JSON.stringify(database);
  fs.writeFileSync(config.pipeline.output.dbMinified, jsonDatabaseMinified);
  log(
    "minified database",
    config.pipeline.output.dbMinified,
    jsonDatabaseMinified.length,
  );

  const jsonVimpackDatabase = JSON.stringify(vimpackItems, null, 2);
  fs.writeFileSync(config.pipeline.output.vimpackDb, jsonVimpackDatabase);
  log("database", config.pipeline.output.vimpackDb, jsonVimpackDatabase.length);
  const jsonVimpackDatabaseMinified = JSON.stringify(vimpackItems);
  fs.writeFileSync(
    config.pipeline.output.vimpackDbMinified,
    jsonVimpackDatabaseMinified,
  );
  log(
    "minified database",
    config.pipeline.output.vimpackDbMinified,
    jsonVimpackDatabaseMinified.length,
  );

  const jsonLazyDatabase = JSON.stringify(lazyItems, null, 2);
  fs.writeFileSync(config.pipeline.output.lazyDb, jsonLazyDatabase);
  log("database", config.pipeline.output.lazyDb, jsonLazyDatabase.length);
  const jsonLazyDatabaseMinified = JSON.stringify(lazyItems);
  fs.writeFileSync(
    config.pipeline.output.lazyDbMinified,
    jsonLazyDatabaseMinified,
  );
  log(
    "minified database",
    config.pipeline.output.lazyDbMinified,
    jsonLazyDatabaseMinified.length,
  );

  return {
    jsonDatabaseMinified,
    jsonVimpackDatabaseMinified,
    jsonLazyDatabaseMinified,
  };
}
