import { Node } from "luaparse";

// Only types used across multiple files or as public API
export interface Matcher {
  name: string;
  description: string;
  matcher: (
    node: Node,
    depth: number,
    sourceCode: string,
    expectedRepo: string,
  ) => string | null;
}

