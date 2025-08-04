import { ExtractedChunk, MigratedChunk } from "../types";
import {
  parse as luaparserParse,
  TableConstructorExpression,
  TableKeyString,
} from "luaparse";

// Field mapping from packer to lazy
const FIELD_MAPPINGS: Record<string, string> = {
  requires: "dependencies",
  opt: "lazy",
  disable: "enabled", // needs value inversion
  run: "build",
};

// Fields that should cause migration to fail
const INCOMPATIBLE_FIELDS = [
  "as",
  "rocks",
  "module",
  "module_pattern",
  "fn",
  "after",
  "installer",
  "updater",
  "rtp",
];

function migrateStringConfiguration(chunk: ExtractedChunk): {
  val: MigratedChunk;
} {
  const code = chunk.extracted.trim();

  return {
    val: {
      ...chunk,
      migrated: `{ ${code}, event = "VeryLazy" }`,
    },
  };
}

function migrateTableConfiguration(
  chunk: ExtractedChunk,
): { val: MigratedChunk } | { error: string } {
  const code = chunk.extracted.trim();
  const parsedSource = `return ${code}`;

  // Parse the clean table from extractor
  let ast;
  try {
    ast = luaparserParse(parsedSource, { ranges: true });
  } catch (parseError: any) {
    return { error: `Failed to parse packer config: ${parseError.message}` };
  }

  const table = (ast.body[0] as any).arguments[0] as TableConstructorExpression;

  // Plugin name is always first field
  const pluginNameField = table.fields[0];
  if (
    pluginNameField.type !== "TableValue" ||
    pluginNameField.value.type !== "StringLiteral"
  ) {
    return { error: "Expected plugin name as first string literal" };
  }

  const transformedFields: string[] = [];
  let hasLazyLoading = false;

  // Add plugin name using raw value
  transformedFields.push(pluginNameField.value.raw!);

  // Process named fields (skip first field which is plugin name)
  for (let i = 1; i < table.fields.length; i++) {
    const field = table.fields[i];

    if (field.type !== "TableKeyString") {
      return { error: `Expected named field at position ${i}` };
    }

    const keyField = field as TableKeyString;
    const keyName = keyField.key.name;

    // Check for incompatible fields first
    if (INCOMPATIBLE_FIELDS.includes(keyName)) {
      return {
        error: `Incompatible packer field: '${keyName}' cannot be migrated to lazy.nvim`,
      };
    }

    // Check if this provides lazy loading
    if (["cmd", "ft", "event", "keys", "opt"].includes(keyName)) {
      hasLazyLoading = true;
    }

    // Handle unmapped fields - keep as-is
    if (!FIELD_MAPPINGS[keyName]) {
      const fieldSource = parsedSource.substring(
        (field as any).range![0],
        (field as any).range![1],
      );
      transformedFields.push(fieldSource);
      continue;
    }

    // Handle mapped fields
    const newKeyName = FIELD_MAPPINGS[keyName];

    // Special case: disable -> enabled (invert boolean)
    if (keyName === "disable") {
      const inverted = (keyField.value as any).value ? "false" : "true";
      transformedFields.push(`${newKeyName} = ${inverted}`);
      continue;
    }

    // Regular mapped field
    const valueSource =
      (keyField.value as any).raw ||
      parsedSource.substring(
        (keyField.value as any).range![0],
        (keyField.value as any).range![1],
      );
    transformedFields.push(`${newKeyName} = ${valueSource}`);
  }

  // Add default lazy loading if none exists
  if (!hasLazyLoading) {
    transformedFields.push('event = "VeryLazy"');
  }

  return {
    val: {
      ...chunk,
      migrated: `{ ${transformedFields.join(", ")} }`,
    },
  };
}

export function migratePacker(
  chunk: ExtractedChunk,
): { val: MigratedChunk } | { error: string } {
  const code = chunk.extracted.trim();

  if (!code) {
    return { error: "Empty packer configuration" };
  }

  // Simple string plugin config - no table braces
  if (!code.includes("{")) {
    return migrateStringConfiguration(chunk);
  }

  // Table configuration
  return migrateTableConfiguration(chunk);
}
