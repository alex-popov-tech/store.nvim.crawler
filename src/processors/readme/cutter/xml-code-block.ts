import { Chunk } from "../types";
import { config } from "~/config";

export function findXmlCodeBlocks(
  lines: string[],
): Array<{ start: number; end: number; language?: string }> {
  const blocks: Array<{ start: number; end: number; language?: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Look for <details> tags
    if (line.includes("<details>")) {
      // Find the summary end
      let summaryEnd = i;
      for (let s = i; s < lines.length; s++) {
        if (lines[s].trim().includes("</summary>")) {
          summaryEnd = s;
          break;
        }
      }

      // Find the closing </details> tag
      for (let j = summaryEnd + 1; j < lines.length; j++) {
        if (lines[j].trim().includes("</details>")) {
          // Content is everything between </summary> and </details>
          const contentStart = summaryEnd + 1;
          const contentEnd = j - 1;

          if (contentStart <= contentEnd) {
            blocks.push({
              start: contentStart,
              end: contentEnd,
            });
          }

          i = j; // Skip processed lines
          break;
        }
      }
    }
  }

  return blocks;
}

export function extractXmlChunkWithContext(
  lines: string[],
  block: { start: number; end: number; language?: string },
): Chunk {
  const content = lines.slice(block.start, block.end + 1).join("\n");

  // Extract context before (this will include the <details><summary> part)
  const prevLines = getXmlContext(
    lines,
    block.start - 1,
    -1,
    config.cutter.contextLinesBefore,
  );
  const prev = prevLines.join("\n").trim();

  // Extract context after (this will include the </details> part)
  const afterLines = getXmlContext(
    lines,
    block.end + 1,
    1,
    config.cutter.contextLinesAfter,
  );
  const after = afterLines.join("\n").trim();

  return {
    prev,
    after,
    content,
  };
}

function getXmlContext(
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

    // Stop if we hit markdown code blocks (but allow HTML tags in context)
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
