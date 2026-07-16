/**
 * Chat markdown wire format — stored in existing `content` string field.
 * Compatible with plain text; formatting is opt-in via markers.
 */

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/^```\w*\n?/, "").replace(/```$/, "")
    )
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/==(.*?)==/g, "$1")
    .replace(/\{\{color:([^}]+)\}\}(.*?)\{\{\/color\}\}/g, "$2")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/<\/?u>/gi, "")
    .trim();
}

/** Plain length used for empty checks / send button */
export function richTextIsEmpty(md: string): boolean {
  return stripMarkdown(md).replace(/\s+/g, "").length === 0;
}

function applyInlineMarkdown(escaped: string): string {
  let s = escaped;

  // Color: {{color:#hex}}text{{/color}}
  s = s.replace(
    /\{\{color:([#\w%,().\s-]+)\}\}([\s\S]*?)\{\{\/color\}\}/g,
    '<span class="chat-rt-color" style="color:$1">$2</span>'
  );

  // Highlight ==text==
  s = s.replace(
    /==([^=]+)==/g,
    '<mark class="chat-rt-mark">$1</mark>'
  );

  // Underline via <u>…</u> (already escaped as &lt;u&gt; etc — use literal markers)
  // Use ++text++ for underline to avoid HTML in storage
  s = s.replace(/\+\+([^+]+)\+\+/g, '<u class="chat-rt-u">$1</u>');

  // Bold **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="chat-rt-b">$1</strong>');

  // Italic *text* (single asterisk, not part of **)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em class="chat-rt-i">$2</em>');

  // Italic _text_
  s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em class="chat-rt-i">$2</em>');

  // Strikethrough ~~text~~
  s = s.replace(/~~([^~]+)~~/g, '<del class="chat-rt-s">$1</del>');

  // Inline code `code`
  s = s.replace(
    /`([^`\n]+)`/g,
    '<code class="chat-rt-code">$1</code>'
  );

  // Links [label](url)
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/g,
    (_m, label, url) => {
      const href = url.startsWith("http") ? url : `https://${url}`;
      return `<a class="chat-rt-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
  );

  // Autolink bare URLs
  s = s.replace(
    /(^|[\s(>])((?:https?:\/\/|www\.)[^\s<]+)/g,
    (_m, pre, url) => {
      const href = url.startsWith("http") ? url : `https://${url}`;
      return `${pre}<a class="chat-rt-link" href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    }
  );

  // Mentions @name
  s = s.replace(
    /(^|[\s(])@([\w.-]{1,32})/g,
    '$1<span class="chat-rt-mention">@$2</span>'
  );

  // Hashtags #tag
  s = s.replace(
    /(^|[\s(])#([\w]{2,40})/g,
    '$1<span class="chat-rt-hashtag">#$2</span>'
  );

  return s;
}

/**
 * Convert markdown (wire format) → safe HTML for contentEditable / display shell.
 */
export function markdownToHtml(md: string): string {
  if (!md) return "";

  const blocks: string[] = [];
  let remaining = md.replace(/\r\n/g, "\n");

  // Extract fenced code blocks first
  remaining = remaining.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
    const token = `__CODEBLOCK_${blocks.length}__`;
    const safe = escapeHtml(code.replace(/\n$/, ""));
    blocks.push(
      `<pre class="chat-rt-pre" data-lang="${escapeHtml(lang || "")}"><code class="chat-rt-codeblock">${safe}</code></pre>`
    );
    return token;
  });

  const lines = remaining.split("\n");
  const htmlLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Placeholder for code block
    const blockMatch = line.match(/^__CODEBLOCK_(\d+)__$/);
    if (blockMatch) {
      htmlLines.push(blocks[Number(blockMatch[1])]);
      i++;
      continue;
    }

    // Block quote
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const inner = applyInlineMarkdown(escapeHtml(quoteLines.join("\n"))).replace(
        /\n/g,
        "<br/>"
      );
      htmlLines.push(`<blockquote class="chat-rt-quote">${inner}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      htmlLines.push(
        `<ul class="chat-rt-ul">${items
          .map((it) => `<li>${applyInlineMarkdown(escapeHtml(it))}</li>`)
          .join("")}</ul>`
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      htmlLines.push(
        `<ol class="chat-rt-ol">${items
          .map((it) => `<li>${applyInlineMarkdown(escapeHtml(it))}</li>`)
          .join("")}</ol>`
      );
      continue;
    }

    // Empty line → paragraph break
    if (line.trim() === "") {
      htmlLines.push("<div><br/></div>");
      i++;
      continue;
    }

    htmlLines.push(
      `<div>${applyInlineMarkdown(escapeHtml(line))}</div>`
    );
    i++;
  }

  return htmlLines.join("");
}

function walkNode(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(node.textContent || "");
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "br") {
    out.push("\n");
    return;
  }

  if (tag === "pre" || (tag === "code" && el.classList.contains("chat-rt-codeblock"))) {
    const lang = el.getAttribute("data-lang") || el.parentElement?.getAttribute("data-lang") || "";
    const code = el.textContent || "";
    out.push(`\`\`\`${lang}\n${code.replace(/\n$/, "")}\n\`\`\``);
    return;
  }

  if (tag === "code") {
    out.push("`" + (el.textContent || "") + "`");
    return;
  }

  if (tag === "strong" || tag === "b") {
    out.push("**");
    Array.from(el.childNodes).forEach((c) => walkNode(c, out));
    out.push("**");
    return;
  }

  if (tag === "em" || tag === "i") {
    out.push("*");
    Array.from(el.childNodes).forEach((c) => walkNode(c, out));
    out.push("*");
    return;
  }

  if (tag === "u") {
    out.push("++");
    Array.from(el.childNodes).forEach((c) => walkNode(c, out));
    out.push("++");
    return;
  }

  if (tag === "del" || tag === "s" || tag === "strike") {
    out.push("~~");
    Array.from(el.childNodes).forEach((c) => walkNode(c, out));
    out.push("~~");
    return;
  }

  if (tag === "mark") {
    out.push("==");
    Array.from(el.childNodes).forEach((c) => walkNode(c, out));
    out.push("==");
    return;
  }

  if (tag === "span" && el.classList.contains("chat-rt-color")) {
    const color = el.style.color || "#e11d48";
    out.push(`{{color:${color}}}`);
    Array.from(el.childNodes).forEach((c) => walkNode(c, out));
    out.push("{{/color}}");
    return;
  }

  if (tag === "a") {
    const href = el.getAttribute("href") || "";
    const label = el.textContent || href;
    out.push(`[${label}](${href})`);
    return;
  }

  if (tag === "blockquote") {
    const inner: string[] = [];
    Array.from(el.childNodes).forEach((c) => walkNode(c, inner));
    const text = inner.join("").split("\n").map((l) => `> ${l}`).join("\n");
    out.push(text + "\n");
    return;
  }

  if (tag === "ul") {
    Array.from(el.children).forEach((li) => {
      const inner: string[] = [];
      walkNode(li, inner);
      out.push(`- ${inner.join("").trim()}\n`);
    });
    return;
  }

  if (tag === "ol") {
    Array.from(el.children).forEach((li, idx) => {
      const inner: string[] = [];
      walkNode(li, inner);
      out.push(`${idx + 1}. ${inner.join("").trim()}\n`);
    });
    return;
  }

  if (tag === "li") {
    Array.from(el.childNodes).forEach((c) => walkNode(c, out));
    return;
  }

  if (tag === "div" || tag === "p") {
    Array.from(el.childNodes).forEach((c) => walkNode(c, out));
    out.push("\n");
    return;
  }

  Array.from(el.childNodes).forEach((c) => walkNode(c, out));
}

/** Serialize contentEditable DOM → markdown wire format */
export function htmlToMarkdown(root: HTMLElement): string {
  const out: string[] = [];
  Array.from(root.childNodes).forEach((c) => walkNode(c, out));
  return out
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trimEnd();
}

/** Convert pasted HTML fragment → markdown */
export function pastedHtmlToMarkdown(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  // Strip scripts/styles
  tmp.querySelectorAll("script,style").forEach((n) => n.remove());
  return htmlToMarkdown(tmp);
}

/** Inline-only markdown HTML for single-line previews (sidebar, notifications) */
export function markdownToPreviewHtml(md: string): string {
  if (!md.trim()) return "";

  const line = md
    .replace(/\r\n/g, "\n")
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/^```\w*\n?/, "").replace(/\n?```$/, " ").trim()
    )
    .split("\n")
    .map((l) =>
      l
        .replace(/^>\s?/, "")
        .replace(/^[-*]\s+/, "• ")
        .replace(/^\d+\.\s+/, "")
        .trim()
    )
    .filter(Boolean)
    .join(" ");

  return applyInlineMarkdown(escapeHtml(line));
}

export type FormatCommand =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "code"
  | "codeblock"
  | "link"
  | "ul"
  | "ol"
  | "quote"
  | "highlight"
  | "color"
  | "mention"
  | "undo"
  | "redo";

export function wrapSelectionMarkdown(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder = "text"
): { value: string; start: number; end: number } {
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  const selStart = start + before.length;
  const selEnd = selStart + selected.length;
  return { value: next, start: selStart, end: selEnd };
}
