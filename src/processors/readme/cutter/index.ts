import { createLogger } from "~/logger";
import { Chunk } from "../types";
import {
  findMarkdownCodeBlocks,
  extractChunkWithContext,
} from "./markdown-code-block";
import {
  findXmlCodeBlocks,
  extractXmlChunkWithContext,
} from "./xml-code-block";
import { findMarkdownCodeSnippets } from "./markdown-code-snippet";

const logger = createLogger({ context: "cutter" });

function cutChunks(repoName: string, readmeContent: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = readmeContent.split("\n");

  // Find markdown code blocks
  const markdownBlocks = findMarkdownCodeBlocks(lines);
  for (const block of markdownBlocks) {
    const chunk = extractChunkWithContext(lines, block);
    chunks.push(chunk);
  }
  if (markdownBlocks.length > 0) {
    logger.info(`Found ${markdownBlocks.length} markdown code blocks`);
  }

  // Find XML/HTML code blocks (details tags)
  const xmlBlocks = findXmlCodeBlocks(lines);
  for (const block of xmlBlocks) {
    const chunk = extractXmlChunkWithContext(lines, block);
    chunks.push(chunk);
  }
  if (xmlBlocks.length > 0) {
    logger.info(`Found ${xmlBlocks.length} XML/HTML code blocks`);
  }

  // Find markdown inline code snippets
  const snippetChunks = findMarkdownCodeSnippets(lines, repoName);
  chunks.push(...snippetChunks);
  if (snippetChunks.length > 0) {
    logger.info(`Found ${snippetChunks.length} inline code snippets`);
  }

  // Filter by repo name (case-insensitive)
  return chunks.filter((chunk) =>
    chunk.content.trim().toLowerCase().includes(repoName.toLowerCase()),
  );
}

// Public API
export const cutter = {
  cutChunks,
};
