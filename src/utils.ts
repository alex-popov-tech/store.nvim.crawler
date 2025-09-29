import asciidoctor from "asciidoctor";
import TurndownService from "turndown";

const turndownService = new TurndownService();
turndownService.addRule("fencedCodeBlocks", {
  filter: (node) => {
    return (
      node.nodeName === "PRE" &&
      node.firstChild !== null &&
      node.firstChild.nodeName === "CODE"
    );
  },
  replacement: (content, node) => {
    const code = node.textContent;
    if (node.firstChild && node.firstChild.nodeType === 1) {
      const lang =
        // @ts-expect-error i don't care until it works
        node.firstChild.getAttribute("class")?.replace(/^language-/, "") || "";
      return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
    }
    return `\n\`\`\`\n${code}\n\`\`\`\n`;
  },
});

export const utils = {
  adocToMarkdown: (adoc: string) => {
    const html = asciidoctor().convert(adoc);
    const markdown = turndownService.turndown(html as string);
    return markdown;
  },
};
