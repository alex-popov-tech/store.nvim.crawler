import { ExtractedChunk, MigratedChunk } from "../types";
import type { Repository } from "~/pipeline/types";
import { generateVimPackConfig } from "./vim-pack";
import * as luaparse from "luaparse";
import { TableConstructorExpression } from "luaparse";
import {
  cleanQuotes,
  createSourceWrapper,
  extractFieldValue,
  extractFunctionBody,
} from "./shared";

const PACKER_TO_LAZY_FIELD_MAP: Record<string, string> = {
  opt: "lazy",
  lazy: "lazy",
  run: "build",
  build: "build",
  cmd: "cmd",
  ft: "ft",
  keys: "keys",
  event: "event",
  config: "config",
  tag: "tag",
  branch: "branch",
  version: "version",
  opts: "opts",
  setup: "init",
  priority: "priority",
  dependencies: "dependencies",
};

export function migrate(
  chunk: ExtractedChunk,
  repository: Repository,
): MigratedChunk {
  const packerConfig = chunk.extracted.trim();
  const source = createSourceWrapper(packerConfig);
  const ast = luaparse.parse(source, { ranges: true });
  const argument = (ast.body[0] as any).arguments[0];

  // Handle simple string case like "plugin/name"
  if (argument.type === "StringLiteral") {
    const pluginName = cleanQuotes(argument.raw || "");

    const migratedLazy = generateSimpleLazyConfig(pluginName);
    const migratedVimPack = generateVimPackConfig(repository, []);

    // Validate generated Lua code
    luaparse.parse(migratedLazy);
    luaparse.parse(migratedVimPack);

    return {
      ...chunk,
      migratedLazy,
      migratedVimPack,
    };
  }

  // Handle table case like { "plugin/name", config = ... }
  if (argument.type === "TableConstructorExpression") {
    const table = argument as TableConstructorExpression;

    const migratedLazy = migratePackerConfigToLazy(
      table,
      source,
      repository.full_name,
    );
    const migratedVimPack = generateVimPackFromPacker(
      table,
      source,
      repository,
    );

    // Validate generated Lua code
    luaparse.parse(migratedLazy);
    luaparse.parse(migratedVimPack);

    return {
      ...chunk,
      migratedLazy,
      migratedVimPack,
    };
  }

  throw new Error(`Unsupported packer configuration type: ${argument.type}`);
}

function generateSimpleLazyConfig(pluginName: string): string {
  return `return { "${pluginName}", event = "VeryLazy" }`;
}

function migratePackerConfigToLazy(
  table: TableConstructorExpression,
  source: string,
  repoFullName: string,
): string {
  const lazyFields: string[] = [];

  lazyFields.push(`"${repoFullName}"`);
  for (const field of table.fields) {
    if (field.type !== "TableKeyString") continue;

    const fieldName = field.key.name;

    if (fieldName === "requires") {
      const fieldValue = extractFieldValue(field, source);
      lazyFields.push(`dependencies = ${fieldValue}`);
      continue;
    }
    const lazyFieldName = PACKER_TO_LAZY_FIELD_MAP[fieldName];
    if (lazyFieldName) {
      const fieldValue = extractFieldValue(field, source);
      lazyFields.push(`${lazyFieldName} = ${fieldValue}`);
    }
  }

  const hasLazyLoading = lazyFields.some(
    (field) =>
      field.includes("cmd =") ||
      field.includes("ft =") ||
      field.includes("event =") ||
      field.includes("keys =") ||
      field.includes("lazy ="),
  );

  if (!hasLazyLoading) {
    lazyFields.push('event = "VeryLazy"');
  }

  return `return { ${lazyFields.join(", ")} }`;
}

function extractSetupFromConfig(
  table: TableConstructorExpression,
  source: string,
): string {
  const configField = table.fields.find(
    (field) => field.type === "TableKeyString" && field.key.name === "config",
  );

  if (configField) {
    // Handle config = true case (means call setup() with no arguments)
    if (configField.value.type === "BooleanLiteral" && configField.value.value === true) {
      // Extract plugin name from the first field of the table
      const firstField = table.fields[0];
      if (firstField?.type === "TableValue" && firstField.value.type === "StringLiteral") {
        const pluginName = cleanQuotes(firstField.value.raw || "");
        const moduleName = pluginName.split('/')[1]?.replace(/\.nvim$/, "") || pluginName;
        return `require("${moduleName}").setup()`;
      }
    }

    // Handle config = function() ... end case
    return extractFunctionBody(configField.value, source);
  }

  return "";
}

function extractDependenciesFromPackerRequires(
  table: TableConstructorExpression,
  source: string,
): string[] {
  const requiresField = table.fields.find(
    (field) => field.type === "TableKeyString" && field.key.name === "requires",
  );

  if (!requiresField) return [];

  const dependencies: string[] = [];

  // Handle single string dependency
  if (requiresField.value.type === "StringLiteral") {
    const rawValue = requiresField.value.raw || "";
    const cleanValue = cleanQuotes(rawValue);
    if (cleanValue) {
      dependencies.push(cleanValue);
    }
    return dependencies;
  }

  // Handle table of dependencies
  if (requiresField.value.type === "TableConstructorExpression") {
    const requiresTable = requiresField.value as TableConstructorExpression;

    for (const depField of requiresTable.fields) {
      if (depField.type !== "TableValue") continue;

      if (depField.value.type === "StringLiteral") {
        const rawValue = depField.value.raw || "";
        const cleanValue = cleanQuotes(rawValue);
        if (cleanValue) {
          dependencies.push(cleanValue);
        }
        continue;
      }

      // Handle nested table case like { 'plugin/name', opt = true }
      if (depField.value.type === "TableConstructorExpression") {
        const depTable = depField.value as TableConstructorExpression;
        const firstField = depTable.fields[0];
        if (
          firstField?.type === "TableValue" &&
          firstField.value.type === "StringLiteral"
        ) {
          const rawValue = firstField.value.raw || "";
          const cleanValue = cleanQuotes(rawValue);
          if (cleanValue) {
            dependencies.push(cleanValue);
          }
        }
      }
    }
  }

  return dependencies;
}

function generateVimPackFromPacker(
  table: TableConstructorExpression,
  source: string,
  repository: Repository,
): string {
  const dependencies = extractDependenciesFromPackerRequires(table, source);
  const setupCall = extractSetupFromConfig(table, source);

  return generateVimPackConfig(repository, dependencies, setupCall);
}
