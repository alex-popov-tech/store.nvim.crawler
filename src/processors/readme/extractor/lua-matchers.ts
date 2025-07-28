import { Matcher } from "./types";
import {
  Node,
  TableConstructorExpression,
  StringLiteral,
  TableValue,
} from "luaparse";

/**
 * Helper function to extract source code from a table node
 */
function extractTableSourceCode(
  tableNode: TableConstructorExpression,
  fullSource: string,
): string | null {
  const nodeWithRange = tableNode as any;
  if (nodeWithRange.range) {
    return fullSource.substring(nodeWithRange.range[0], nodeWithRange.range[1]);
  }
  // If no range available, we cannot extract properly - return null to fail cleanly
  return null;
}

/**
 * Lua-based matchers that work for both lazy.nvim and packer.nvim
 * by focusing on the content (plugin tables/strings) rather than context
 */
export const matchers: Matcher[] = [
  {
    name: "matchPluginTable",
    description:
      "Matches any table { 'plugin/name', ... } regardless of context",
    matcher: (
      node: Node,
      depth: number,
      fullSourceCode: string,
      expectedRepo: string,
    ): string | null => {
      // Only match TableConstructorExpression nodes
      if (node.type !== "TableConstructorExpression") return null;

      // Only check tables with fields
      if (!node.fields || node.fields.length === 0) return null;

      const table = node as TableConstructorExpression;
      const firstField = table.fields[0];

      // First field must be a TableValue with StringLiteral
      if (firstField.type !== "TableValue") return null;

      const tableValue = firstField as TableValue;
      if (tableValue.value?.type !== "StringLiteral") {
        // Check for nested table structure { { "plugin/name", ... } }
        if (tableValue.value?.type === "TableConstructorExpression") {
          const nestedTable = tableValue.value as TableConstructorExpression;

          // The nested table must have fields
          if (!nestedTable.fields || nestedTable.fields.length === 0)
            return null;

          // First field of nested table must be plugin name
          const nestedFirstField = nestedTable.fields[0];
          if (nestedFirstField.type !== "TableValue") return null;

          const nestedTableValue = nestedFirstField as TableValue;
          if (nestedTableValue.value?.type !== "StringLiteral") return null;

          // Extract and validate plugin name from nested table
          const nestedStringLiteral = nestedTableValue.value as StringLiteral;
          const nestedPluginName =
            nestedStringLiteral.raw?.slice(1, -1) || nestedStringLiteral.value;

          if (nestedPluginName.toLowerCase() !== expectedRepo.toLowerCase())
            return null;

          // Extract the inner table source code
          return extractTableSourceCode(nestedTable, fullSourceCode);
        }
        return null;
      }

      // Extract and validate plugin name from direct table
      const stringLiteral = tableValue.value as StringLiteral;
      const pluginName = stringLiteral.raw?.slice(1, -1) || stringLiteral.value;

      if (pluginName.toLowerCase() !== expectedRepo.toLowerCase()) return null;

      // Extract table source code directly
      return extractTableSourceCode(table, fullSourceCode);
    },
  },

  {
    name: "matchPluginString",
    description: "Matches standalone plugin name strings",
    matcher: (
      node: Node,
      depth: number,
      fullSourceCode: string,
      expectedRepo: string,
    ): string | null => {
      if (node.type !== "StringLiteral") return null;

      const stringLiteral = node as StringLiteral;
      const pluginName = stringLiteral.raw?.slice(1, -1) || stringLiteral.value;

      if (pluginName.toLowerCase() !== expectedRepo.toLowerCase()) return null;

      return `"${expectedRepo}"`;
    },
  },
];

