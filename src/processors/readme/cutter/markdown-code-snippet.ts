import { Chunk } from "../types";

export function findMarkdownCodeSnippets(
  lines: string[],
  repoName: string,
): Chunk[] {
  const chunks: Chunk[] = [];
  const repoNameLower = repoName.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Find the first inline code snippet in the line
    const match = line.match(/`([^`]+)`/);
    
    if (match && match[1] && match[1].toLowerCase().includes(repoNameLower)) {
      const snippetStart = match.index!;
      const snippetEnd = snippetStart + match[0].length;
      
      // Extract context before the snippet (same line)
      const prev = line.substring(0, snippetStart).trimEnd();
      
      // Extract context after the snippet (same line)
      const after = line.substring(snippetEnd).trimStart();
      
      chunks.push({
        prev,
        after,
        content: match[1], // Content without backticks
      });
    }
  }

  return chunks;
}