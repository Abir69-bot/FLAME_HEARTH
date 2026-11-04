/** Parses the small Markdown subset models write into plain blocks. Output is rendered as text, never as HTML. */

export type Block =
  | { kind: "p"; text: string }
  | { kind: "gap" }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; start: number; items: string[] }
  | { kind: "table"; rows: string[][] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;
const TABLE_RULE = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.split("\n")) {
    const last = blocks[blocks.length - 1];
    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);
    const heading = line.match(HEADING);
    if (!line.trim()) {
      if (last && last.kind !== "gap") blocks.push({ kind: "gap" });
    } else if (heading) {
      blocks.push({ kind: "h", text: heading[1] });
    } else if (bullet) {
      if (last?.kind === "ul") last.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
    } else if (numbered) {
      if (last?.kind === "ol") last.items.push(numbered[2]);
      else blocks.push({ kind: "ol", start: Number(numbered[1]), items: [numbered[2]] });
    } else if (line.trim().startsWith("|")) {
      if (TABLE_RULE.test(line)) continue;
      if (last?.kind === "table") last.rows.push(tableCells(line));
      else blocks.push({ kind: "table", rows: [tableCells(line)] });
    } else {
      blocks.push({ kind: "p", text: line });
    }
  }
  if (blocks[blocks.length - 1]?.kind === "gap") blocks.pop();
  return blocks;
}

export type InlinePart = { kind: "text" | "bold" | "code"; text: string };

export function parseInline(text: string): InlinePart[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter(Boolean)
    .map((seg) => {
      if (seg.length > 4 && seg.startsWith("**") && seg.endsWith("**")) return { kind: "bold", text: seg.slice(2, -2) };
      if (seg.length > 2 && seg.startsWith("`") && seg.endsWith("`")) return { kind: "code", text: seg.slice(1, -1) };
      return { kind: "text", text: seg };
    });
}
