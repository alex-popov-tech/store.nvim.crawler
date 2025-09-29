import { parse as luaparserParse, Node, Chunk, Options } from "luaparse";
import { Matcher } from "./types";

type NodeWithRange = Node & {
  range?: [number, number];
};

function walkAST(
  node: Node | Node[],
  callback: (node: Node, depth: number) => boolean,
  depth = 0,
) {
  if (!node || typeof node !== "object") return;

  // Handle arrays of nodes
  if (Array.isArray(node)) {
    node.forEach((child) => walkAST(child, callback, depth + 1));
    return;
  }

  // Call the callback - if it returns false, stop traversing this branch
  const shouldContinue = callback(node, depth);
  if (shouldContinue !== true) return;

  // Traverse children based on node properties
  Object.entries(node).forEach(([key, value]) => {
    if (key === "parent" || key === "type" || key === "loc" || !value) return;

    if (Array.isArray(value)) {
      value.forEach((child) => {
        if (child && typeof child === "object" && child.type) {
          walkAST(child, callback, depth + 1);
        }
      });
    } else if (typeof value === "object" && value.type) {
      walkAST(value, callback, depth + 1);
    }
  });
}

// Normalize Lua code to handle top-level tables
function normalize(code: string): string {
  // Split into lines and find first non-comment, non-empty line
  const lines = code.split("\n");
  let firstNonCommentLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed && !trimmed.startsWith("--")) {
      if (trimmed.startsWith("{")) {
        firstNonCommentLineIndex = i;
      }
      break;
    }
  }

  // If the code starts with '{' (top-level table), prepend 'return' to that line
  if (firstNonCommentLineIndex >= 0) {
    const modifiedLines = [...lines];
    modifiedLines[firstNonCommentLineIndex] =
      `return ${lines[firstNonCommentLineIndex]}`;

    // NEW LOGIC: Find last } and cut everything after it
    const modifiedCode = modifiedLines.join("\n");
    const lastBraceIndex = modifiedCode.lastIndexOf("}");

    if (lastBraceIndex !== -1) {
      return modifiedCode.substring(0, lastBraceIndex + 1);
    }

    return modifiedCode;
  }

  // Otherwise, return as-is
  return code;
}

export function extractFromLuaAST({
  luaCode,
  matchers,
  maxDepth = 5,
  expectedRepo,
}: {
  luaCode: string;
  matchers: Matcher[];
  maxDepth?: number;
  expectedRepo: string;
}) {
  // Input validation with early returns
  if (!luaCode || typeof luaCode !== "string") {
    return { nodes: null, error: "Invalid lua code provided" };
  }

  if (!matchers || !Array.isArray(matchers) || matchers.length === 0) {
    return { nodes: null, error: "No matchers provided" };
  }

  // Normalize the code first to handle top-level tables
  const normalizedCode = normalize(luaCode);

  let ast: Chunk;
  try {
    const parseOptions: Partial<Options> = {
      locations: true,
      ranges: true,
      comments: false,
    };
    ast = luaparserParse(normalizedCode, parseOptions);
  } catch (parseError: any) {
    return {
      nodes: null,
      error: `Parsing failed: ${parseError.message}`,
    };
  }

  const foundNodes: Array<{
    node: Node;
    depth: number;
    matcherIndex: number;
    matcher: string;
    sourceCode: string;
  }> = [];

  // Walk AST with depth limit and apply matchers
  walkAST(
    ast,
    (node, depth) => {
      // Stop traversing if depth exceeded
      if (depth > maxDepth) {
        return false;
      }

      // Apply matchers until first match
      for (let i = 0; i < matchers.length; i++) {
        const matcher = matchers[i];
        const extractedContent = matcher.matcher(
          node,
          depth,
          normalizedCode,
          expectedRepo,
        );

        if (extractedContent !== null) {
          const nodeWithRange = node as NodeWithRange;
          const sourceCode = nodeWithRange.range
            ? luaCode.substring(nodeWithRange.range[0], nodeWithRange.range[1])
            : `[${node.type}]`; // fallback for nodes without range

          foundNodes.push({
            node,
            depth,
            matcherIndex: i,
            matcher: matcher.name,
            sourceCode: extractedContent, // Use the extracted content from matcher
          });
          break; // Stop checking other matchers for this node
        }
      }

      return true; // Continue traversing children
    },
    0,
  );

  return {
    nodes: foundNodes,
    error: foundNodes.length === 0 ? "No nodes found matching criteria" : null,
  };
}
