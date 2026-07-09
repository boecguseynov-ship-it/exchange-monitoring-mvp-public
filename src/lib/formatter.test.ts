import { describe, expect, it } from "vitest";
import { formatArticleBody } from "./formatter";

describe("formatArticleBody", () => {
  it("should parse BB-codes correctly", () => {
    const text = "[b]Bold Text[/b] and [i]Italic Text[/i] and [u]Underlined[/u] and [s]Strikethrough[/s]";
    const html = formatArticleBody(text);
    expect(html).toContain("<strong>Bold Text</strong>");
    expect(html).toContain("<em>Italic Text</em>");
    expect(html).toContain("<u>Underlined</u>");
    expect(html).toContain("<s>Strikethrough</s>");
  });

  it("should parse BB-code headings and quotes", () => {
    const text = "[h1]Heading 1[/h1]\n\n[h2]Heading 2[/h2]\n\n[quote]Quoted text[/quote]";
    const html = formatArticleBody(text);
    expect(html).toContain("<h1>Heading 1</h1>");
    expect(html).toContain("<h2>Heading 2</h2>");
    expect(html).toContain("<blockquote>Quoted text</blockquote>");
  });

  it("should parse Markdown inline styles", () => {
    const text = "Some **bold** and *italic* text here.";
    const html = formatArticleBody(text);
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("should parse Markdown headings and blockquotes", () => {
    const text = "# Heading 1\n\n## Heading 2\n\n> Quote line";
    const html = formatArticleBody(text);
    expect(html).toContain("<h1>Heading 1</h1>");
    expect(html).toContain("<h2>Heading 2</h2>");
    expect(html).toContain("<blockquote>Quote line</blockquote>");
  });

  it("should parse links and images for both BB-code and Markdown", () => {
    const text = "[url=https://google.com]Google[/url] or [Link](https://yandex.ru)\n\n[img]https://test.com/image.png[/img] or ![Alt text](https://test.com/img.jpg)";
    const html = formatArticleBody(text);
    expect(html).toContain('<a href="https://google.com" target="_blank" rel="noopener noreferrer">Google</a>');
    expect(html).toContain('<a href="https://yandex.ru" target="_blank" rel="noopener noreferrer">Link</a>');
    expect(html).toContain('<img src="https://test.com/image.png"');
    expect(html).toContain('<img src="https://test.com/img.jpg" alt="Alt text"');
  });

  it("should parse lists correctly", () => {
    const text = "- Item 1\n- Item 2\n- Item 3";
    const html = formatArticleBody(text);
    expect(html).toContain('<ul style="list-style-type: disc; padding-left: 20px; margin: 16px 0;">');
    expect(html).toContain("<li>Item 1</li>");
    expect(html).toContain("<li>Item 2</li>");
    expect(html).toContain("<li>Item 3</li>");
  });

  it("should replace single newlines with br tags inside paragraphs", () => {
    const text = "First line.\nSecond line.";
    const html = formatArticleBody(text);
    expect(html).toBe("<p>First line.<br />Second line.</p>");
  });
});
