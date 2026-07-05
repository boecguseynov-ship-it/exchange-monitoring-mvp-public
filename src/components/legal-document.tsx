import Link from "next/link";
import { formatLegalUpdatedAt, type LegalPageContent } from "@/lib/legal-pages";

export type LegalBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

type LegalSectionBlock = Exclude<LegalBlock, { type: "heading" }>;

export function parseLegalBlocks(body: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push({ type: "list", items: list });
    list = [];
  };

  for (const rawLine of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2).trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function renderInlineLinks(text: string) {
  const parts: React.ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\((\/[^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<Link href={match[2]} key={`${match[2]}-${match.index}`}>{match[1]}</Link>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : text;
}

export function LegalDocument({ page }: { page: LegalPageContent }) {
  const sections: { heading: string; blocks: LegalSectionBlock[] }[] = [];
  let current: { heading: string; blocks: LegalSectionBlock[] } | null = null;

  for (const block of parseLegalBlocks(page.body)) {
    if (block.type === "heading") {
      current = { heading: block.text, blocks: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { heading: "", blocks: [] };
      sections.push(current);
    }
    current.blocks.push(block);
  }

  return (
    <article className="publicPage legalPage">
      <header className="legalHero">
        <span className="eyebrow">Документы</span>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
        <small>Обновлено: {formatLegalUpdatedAt(page.updatedAt)}</small>
      </header>

      {sections.map((section, index) => (
        <section className="legalSection" key={`${section.heading}-${index}`}>
          {section.heading && <h2>{section.heading}</h2>}
          {section.blocks.map((block, blockIndex) => {
            if (block.type === "paragraph") {
              return <p key={blockIndex}>{renderInlineLinks(block.text)}</p>;
            }
            return (
              <ul key={blockIndex}>
                {block.items.map((item) => <li key={item}>{renderInlineLinks(item)}</li>)}
              </ul>
            );
          })}
        </section>
      ))}
    </article>
  );
}
