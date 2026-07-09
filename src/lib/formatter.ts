/**
 * Safely formats article body text by parsing BB-codes and Markdown,
 * then wrapping paragraphs and other block elements into HTML.
 */
export function formatArticleBody(text: string): string {
  if (!text) return "";

  // 1. Escape HTML to prevent arbitrary injection
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Parse BB-codes
  html = html
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<strong>$1</strong>")
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<em>$1</em>")
    .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>")
    .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, "<s>$1</s>")
    .replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, "<blockquote>$1</blockquote>")
    .replace(/\[h1\]([\s\S]*?)\[\/h1\]/gi, "<h1>$1</h1>")
    .replace(/\[h2\]([\s\S]*?)\[\/h2\]/gi, "<h2>$1</h2>")
    .replace(/\[h3\]([\s\S]*?)\[\/h3\]/gi, "<h3>$1</h3>")
    .replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>')
    .replace(/\[url\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\[img\]([\s\S]*?)\[\/img\]/gi, '<img src="$1" alt="image" style="max-width:100%; height:auto; border-radius:8px; margin:16px 0;" />');

  // 3. Parse Markdown inline formatting
  // Bold: **text** or __text__
  html = html
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.*?)__/g, "<strong>$1</strong>");
  // Italic: *text* or _text_
  html = html
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/_(.*?)_/g, "<em>$1</em>");
  // Strikethrough: ~~text~~
  html = html.replace(/~~(.*?)~~/g, "<s>$1</s>");
  // Markdown images: ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%; height:auto; border-radius:8px; margin:16px 0;" />');
  // Markdown links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // 4. Split into blocks/paragraphs by double newlines and wrap them
  const blocks = html.split(/\n{2,}/).filter(Boolean);

  const parsedBlocks = blocks.map((block) => {
    const trimmed = block.trim();

    // Check if it's already a block element we generated
    if (trimmed.startsWith("<blockquote") || trimmed.startsWith("<h1") || trimmed.startsWith("<h2") || trimmed.startsWith("<h3") || trimmed.startsWith("<img")) {
      return trimmed;
    }

    // Check for Markdown headings
    if (trimmed.startsWith("### ")) {
      return `<h3>${trimmed.slice(4)}</h3>`;
    }
    if (trimmed.startsWith("## ")) {
      return `<h2>${trimmed.slice(3)}</h2>`;
    }
    if (trimmed.startsWith("# ")) {
      return `<h1>${trimmed.slice(2)}</h1>`;
    }

    // Check for Markdown blockquotes
    if (trimmed.startsWith("&gt; ")) {
      return `<blockquote>${trimmed.slice(5)}</blockquote>`;
    }
    if (trimmed.startsWith("> ")) {
      return `<blockquote>${trimmed.slice(2)}</blockquote>`;
    }

    // Check for lists
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items = trimmed.split(/\n[-*]\s+/).map(item => {
        const clean = item.replace(/^[-*]\s+/, "");
        return `<li>${clean}</li>`;
      });
      return `<ul style="list-style-type: disc; padding-left: 20px; margin: 16px 0;">${items.join("")}</ul>`;
    }

    // Default to paragraph, replace remaining single newlines with <br />
    return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
  });

  return parsedBlocks.join("\n");
}
