import asciidoctor from "asciidoctor";
import TurndownService from "turndown";

const turndownService = new TurndownService();
turndownService.addRule("fencedCodeBlocks", {
  filter: (node) => {
    return (
      node.nodeName === "PRE" &&
      node.firstChild &&
      node.firstChild.nodeName === "CODE"
    );
  },
  replacement: (content, node) => {
    const code = node.textContent;
    const lang =
      node.firstChild.getAttribute("class")?.replace(/^language-/, "") || "";
    return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
  },
});

export const utils = {
  adocToMarkdown: (adoc: string) => {
    const html = asciidoctor().convert(adoc);
    const markdown = turndownService.turndown(html);
    return markdown;
  },
};
