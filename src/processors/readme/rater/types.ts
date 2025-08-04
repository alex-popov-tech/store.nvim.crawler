import { Chunk } from "../types";

export interface TokenMatcher {
  matcher: (
    repoName: string,
    chunk: Chunk,
  ) => {
    success: boolean;
    error?: string;
  };
  description: string;
  score: number;
}
