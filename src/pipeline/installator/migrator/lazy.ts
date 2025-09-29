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

export function migrate(
  chunk: ExtractedChunk,
  repository: Repository,
): MigratedChunk {
  const lazyConfig = chunk.extracted.trim();
  const source = createSourceWrapper(lazyConfig);
  const ast = luaparse.parse(source, { ranges: true });

  // Handle both function calls and return statements
  let argument: any;
  const firstNode = ast.body[0] as any;

  if (firstNode.type === "CallExpression") {
    // Function call like lazy({ ... })
    argument = firstNode.arguments[0];
  } else if (firstNode.type === "ReturnStatement") {
    // Return statement like return { ... }
    argument = firstNode.arguments[0];
  } else {
    throw new Error(`Unsupported AST node type: ${firstNode.type}`);
  }

  // Handle simple string case like "plugin/name"
  if (argument.type === "StringLiteral") {
    const migratedLazy = createSourceWrapper(lazyConfig);
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

  // Handle table case
  const table = argument as TableConstructorExpression;
  const dependencies = extractDependencies(table);
  const setupCall = extractSetupCall(table, source, repository);

  const migratedLazy = createSourceWrapper(lazyConfig);
  const migratedVimPack = generateVimPackConfig(
    repository,
    dependencies,
    setupCall,
  );

  // Validate generated Lua code
  try {
    luaparse.parse(migratedLazy);
  } catch (error) {
    throw new Error(
      `Failed to validate migratedLazy: ${error instanceof Error ? error.message : String(error)}\nContent: ${migratedLazy}`,
    );
  }

  try {
    luaparse.parse(migratedVimPack);
  } catch (error) {
    throw new Error(
      `Failed to validate migratedVimPack: ${error instanceof Error ? error.message : String(error)}\nContent: ${migratedVimPack}`,
    );
  }

  return {
    ...chunk,
    migratedLazy,
    migratedVimPack,
  };
}

export function generateLazyConfig(
  mainPlugin: string,
  dependencies: string[] = [],
) {
  const parts = [ensureQuotesAround(mainPlugin, '"')];

  if (dependencies.length > 0) {
    parts.push(
      `dependencies = { ${dependencies
        .map((it) => ensureQuotesAround(it, '"'))
        .join(", ")} }`,
    );
  }

  parts.push('event = "VeryLazy"');

  return `return { ${parts.join(", ")} }`;
}

function ensureQuotesAround(text: string, quote: string) {
  return `${quote}${text.replace(/^["']|["']$/g, "")}${quote}`;
}

function extractDependencies(table: TableConstructorExpression): string[] {
  const depsField = table.fields.find(
    (field) =>
      field.type === "TableKeyString" && field.key.name === "dependencies",
  );

  if (!depsField) return [];
  if (depsField.value.type !== "TableConstructorExpression") return [];

  const dependenciesTable = depsField.value as TableConstructorExpression;
  const deps: string[] = [];

  for (const depField of dependenciesTable.fields) {
    if (depField.type !== "TableValue") continue;

    if (depField.value.type === "StringLiteral") {
      // luaparse returns null in value field, use raw field and remove quotes
      const rawValue = depField.value.raw || "";
      const cleanValue = cleanQuotes(rawValue);
      if (cleanValue) {
        deps.push(cleanValue);
      }
      continue;
    }

    if (depField.value.type === "TableConstructorExpression") {
      const depTable = depField.value as TableConstructorExpression;
      const firstField = depTable.fields[0];
      if (
        firstField?.type === "TableValue" &&
        firstField.value.type === "StringLiteral"
      ) {
        // luaparse returns null in value field, use raw field and remove quotes
        const rawValue = firstField.value.raw || "";
        const cleanValue = cleanQuotes(rawValue);
        if (cleanValue) {
          deps.push(cleanValue);
        }
      }
    }
  }

  return deps;
}

function extractSetupCall(
  table: TableConstructorExpression,
  source: string,
  repository: Repository,
): string {
  const optsField = table.fields.find(
    (field) => field.type === "TableKeyString" && field.key.name === "opts",
  );

  if (optsField) {
    const moduleName = repository.name.replace(/\.nvim$/, "");
    const optsSource = extractFieldValue(optsField, source);
    return `require("${moduleName}").setup(${optsSource})`;
  }

  const configField = table.fields.find(
    (field) => field.type === "TableKeyString" && field.key.name === "config",
  );

  if (configField) {
    // Handle config = true case (means call setup() with no arguments)
    if (
      configField.value.type === "BooleanLiteral" &&
      configField.value.value === true
    ) {
      const moduleName = repository.full_name
        .split("/")[1]
        .replace(/\.nvim$/, "");
      return `require("${moduleName}").setup()`;
    }

    // Handle config = function() ... end case
    return extractFunctionBody(configField.value, source);
  }

  return "";
}
