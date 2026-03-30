import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Lightweight markdown-to-semantic-HTML for crawler fallback.
 * Converts headings, lists, hrs, links, bold, and paragraphs.
 */
function markdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Horizontal rules
    if (/^---+$/.test(line.trim())) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push('<hr>');
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { out.push('</ul>'); inList = false; }
      const level = headingMatch[1].length;
      out.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }

    // List items
    if (line.match(/^\s*-\s+/)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*-\s+/, ''))}</li>`);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false; }
      continue;
    }

    // Paragraph
    if (inList) { out.push('</ul>'); inList = false; }
    out.push(`<p>${inline(line)}</p>`);
  }

  if (inList) out.push('</ul>');
  return out.join('\n');
}

/** Convert inline markdown: bold, italic, links */
function inline(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * Vite plugin that injects llms.txt content into the HTML for crawlers.
 *
 * The content lives inside <div id="root"> as a visually-hidden <article>.
 * When React mounts, createRoot().render() replaces it entirely.
 */
export default function crawlable() {
  return {
    name: 'vite-plugin-crawlable',
    transformIndexHtml(html) {
      let llmsContent;
      try {
        llmsContent = readFileSync(
          resolve(process.cwd(), 'public/llms.txt'),
          'utf-8'
        );
      } catch {
        console.warn('[crawlable] Could not read public/llms.txt, skipping.');
        return html;
      }

      const semanticHtml = markdownToHtml(llmsContent);

      const fallback = [
        '<article style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">',
        semanticHtml,
        '</article>',
      ].join('\n');

      return html.replace(
        '<div id="root"></div>',
        `<div id="root">${fallback}</div>`
      );
    },
  };
}
