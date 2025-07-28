import { Chunk } from "../types";

export interface TokenMatcher {
  matcher: (chunk: Chunk) => {
    success: boolean;
    error?: string;
  };
  description: string;
  score: number;
}
