import { Chunk } from "../types";
import {
  findMarkdownCodeBlocks,
  extractChunkWithContext,
} from "./markdown-code-block";
import {
  findXmlCodeBlocks,
  extractXmlChunkWithContext,
} from "./xml-code-block";

function cutChunks(repoName: string, readmeContent: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = readmeContent.split("\n");

  // Find markdown code blocks
  const markdownBlocks = findMarkdownCodeBlocks(lines);
  for (const block of markdownBlocks) {
    const chunk = extractChunkWithContext(lines, block);
    chunks.push(chunk);
  }

  // Find XML/HTML code blocks (details tags)
  const xmlBlocks = findXmlCodeBlocks(lines);
  for (const block of xmlBlocks) {
    const chunk = extractXmlChunkWithContext(lines, block);
    chunks.push(chunk);
  }

  // Filter by repo name (case-insensitive)
  return chunks.filter((chunk) =>
    chunk.content.trim().toLowerCase().includes(repoName.toLowerCase())
  );
}

// Public API
export const cutter = {
  cutChunks,
};
