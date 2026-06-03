import { readFileSync } from 'fs';
import { resolve } from 'path';
import process from 'node:process';

/**
 * Lightweight markdown-to-semantic-HTML for crawler fallback.
 * Converts headings, lists, hrs, blockquotes, bold, italic, links,
 * markdown images, and YouTube/video links.
 *
 * Note: markdown images are emitted as crawlable media links instead of
 * real <img> tags so this hidden fallback does not trigger duplicate
 * image downloads before React mounts.
 */
function markdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Horizontal rules
    if (/^---+$/.test(trimmed)) {
      closeList();
      out.push('<hr>');
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      out.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      closeList();
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }

    // Standalone markdown image: ![alt](url)
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      closeList();
      out.push(mediaLink(imageMatch[1], imageMatch[2], 'image', true));
      continue;
    }

    // List items
    if (line.match(/^\s*-\s+/)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^\s*-\s+/, ''))}</li>`);
      continue;
    }

    // Empty line
    if (trimmed === '') {
      closeList();
      continue;
    }

    // Paragraph
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  return out.join('\n');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return escapeHtml(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(href) {
  const trimmed = String(href).trim();
  if (/^(https?:|mailto:|\/)/i.test(trimmed)) return trimmed;
  return '#';
}

function linkToHtml(label, href) {
  const safe = safeHref(href);
  const isVideo = /(?:youtube\.com\/watch\?v=|youtu\.be\/)/i.test(safe);
  const mediaAttr = isVideo ? ' data-media-type="video"' : '';
  return `<a href="${escapeAttr(safe)}"${mediaAttr}>${escapeHtml(label)}</a>`;
}

function mediaLink(label, href, type, block = false) {
  const safe = safeHref(href);
  const text = type === 'image' ? `Image: ${label || safe}` : label || safe;
  const html = `<a href="${escapeAttr(safe)}" data-media-type="${escapeAttr(type)}">${escapeHtml(text)}</a>`;
  return block ? `<figure>${html}</figure>` : html;
}

/** Convert inline markdown: images, links, bold, italic */
function inline(text) {
  const tokens = [];
  const stash = (html) => {
    tokens.push(html);
    return `\u0000${tokens.length - 1}\u0000`;
  };

  const withTokens = String(text)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, href) =>
      stash(mediaLink(alt, href, 'image'))
    )
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) =>
      stash(linkToHtml(label, href))
    );

  return escapeHtml(withTokens)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\u0000(\d+)\u0000/g, (_match, index) => tokens[Number(index)]);
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

      const rootPattern = /(<div\b[^>]*\bid=["']root["'][^>]*>)(\s*)<\/div>/;
      if (!rootPattern.test(html)) {
        console.warn('[crawlable] Could not find empty #root div, skipping.');
        return html;
      }

      return html.replace(rootPattern, (_match, openTag) => {
        return `${openTag}${fallback}</div>`;
      });
    },
  };
}