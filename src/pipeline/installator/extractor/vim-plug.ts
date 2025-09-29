export function extractFromVimPlug(
  vimCode: string,
  expectedRepo: string,
):
  | {
      extracted: string[];
    }
  | { error: string } {
  // Input validation
  if (!vimCode || typeof vimCode !== "string") {
    return { error: "Invalid vim code provided" };
  }

  // Extract all Plug commands in order
  const plugRegex = /^\s*Plug\s+(['"][^'"]+['"])/gm;
  const extracted: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = plugRegex.exec(vimCode)) !== null) {
    // prevent duplicates
    if (!extracted.includes(match[1])) {
      extracted.push(match[1]);
    }
  }

  if (extracted.length === 0) {
    return { error: "No Plug commands found" };
  }

  // Verify target plugin is present (check inside quotes)
  const hasTargetPlugin = extracted.some(
    (plug) => plug.slice(1, -1) === expectedRepo,
  );

  if (!hasTargetPlugin) {
    return { error: `Target plugin '${expectedRepo}' not found in chunk` };
  }

  return { extracted };
}
