import { Chunk } from "../types";
import { config } from "~/config";

export function findMarkdownCodeBlocks(
  lines: string[],
): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number; language?: string }> = [];
  let inBlock = false;
  let blockStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("```") || line.startsWith("'''")) {
      if (!inBlock) {
        // Starting a code block
        inBlock = true;
        blockStart = i;
      } else {
        // Ending a code block
        inBlock = false;

        // Only add block if it has content (start < end means there are lines between backticks)
        if (blockStart < i - 1) {
          blocks.push({
            start: blockStart, // Include the opening ``` line
            end: i, // Include the closing ``` line
          });
        }
      }
    }
  }

  return blocks;
}

export function extractChunkWithContext(
  lines: string[],
  block: { start: number; end: number; language?: string },
): Chunk {
  // Extract content without the fence markers
  // block.start is the line with opening ```, block.end is the line with closing ```
  // We want the content between them
  const content = lines.slice(block.start + 1, block.end).join("\n");

  // Extract context before
  const prevLines = getContext(
    lines,
    block.start - 1,
    -1,
    config.pipeline.installator.cutter.contextLinesBefore,
  );
  const prev = prevLines.join("\n").trim();

  // Extract context after
  const afterLines = getContext(
    lines,
    block.end + 1,
    1,
    config.pipeline.installator.cutter.contextLinesAfter,
  );
  const after = afterLines.join("\n").trim();

  return {
    prev,
    after,
    content,
  };
}

function getContext(
  lines: string[],
  startingLineIndex: number,
  diff: number,
  maxLines: number,
): string[] {
  const contextLines: string[] = [];
  let collectedLines = 0;

  for (
    let currentIndex = startingLineIndex;
    collectedLines < maxLines &&
    currentIndex >= 0 &&
    currentIndex < lines.length;
    currentIndex += diff
  ) {
    const line = lines[currentIndex];

    // Stop if we hit a code block marker
    if (line.trim().startsWith("```") || line.trim().startsWith("'''")) {
      break;
    }

    // Only count non-empty lines towards maxLines limit
    if (line.trim() !== "") {
      collectedLines++;
    }

    // Add line to context (whether empty or not)
    if (diff > 0) {
      contextLines.push(line);
    } else {
      contextLines.unshift(line); // Prepend for reverse iteration
    }
  }

  return contextLines;
}
