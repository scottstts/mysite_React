// Regenerates public/llms.txt from the *.data.ts content files.
// Run with `npm run llms`. Requires Node >= 22.18 (native TypeScript type stripping).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { about } from '../src/features/about/about.data.ts';
import { aboutHighlight } from '../src/features/about/highlight.data.ts';
import { inspirations } from '../src/features/inspirations/inspirations.data.ts';
import { apps } from '../src/features/portfolio/apps.data.ts';
import { projects } from '../src/features/projects/projects.data.ts';
import type { AppStatusValue, VideoSlideData } from '../src/types/content.ts';

const SITE_URL = 'https://scottsun.io';
const IMAGE_BASE_URL = `${SITE_URL}/content_imgs`;
const SOURCE_URL = 'https://github.com/scottstts/mysite_React';
const OUTPUT_PATH = fileURLToPath(
  new URL('../public/llms.txt', import.meta.url)
);

// Convert the limited HTML used in data descriptions into Markdown.
function htmlToMarkdown(html: string): string {
  return (
    html
      // Font Awesome icons are decorative
      .replace(/\s*<i\s+class="fa-[^"]*"[^>]*>\s*<\/i>/g, '')
      .replace(
        /<a\s+href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/g,
        (_, href: string, text: string) => `[${text.trim()}](${href})`
      )
      .replace(
        /<span\s+class="cmd-text">([\s\S]*?)<\/span>/g,
        (_, text: string) => `\`${text.trim()}\``
      )
      .replace(
        /<span\s+class="([^"]*)">([\s\S]*?)<\/span>/g,
        (_, cls: string, text: string) => {
          const classes = cls.split(/\s+/);
          if (classes.includes('highlight-glow')) return `**${text}**`;
          if (classes.includes('italic') || classes.includes('eater-regular'))
            return `*${text}*`;
          return text;
        }
      )
      .replace(/<br\s*\/?>/g, '\n')
      // Drop any remaining tags
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .split('\n')
      .map((line) => line.trim().replace(/^•\s*/, '- '))
      .join('\n')
      // Collapse blank runs; keep bullet lists tight
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^(- .*)\n\n(?=- )/gm, '$1\n')
      .replace(/^(- .*)\n\n(?=- )/gm, '$1\n')
      .trim()
  );
}

const youtubeUrl = (id: string) => `https://youtu.be/${id}`;

const imageAlt = (file: string) =>
  file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');

function renderImages(title: string, images?: string[]): string[] {
  if (!images?.length) return [];
  return [
    '**Images:**',
    images
      .map((img) => `![${title} — ${imageAlt(img)}](${IMAGE_BASE_URL}/${img})`)
      .join('\n'),
  ];
}

function renderVideos(videos?: VideoSlideData[]): string[] {
  if (!videos?.length) return [];
  return [
    '**Videos:**',
    videos.map((v) => `- [${v.title}](${youtubeUrl(v.videoId)})`).join('\n'),
  ];
}

const statusLabel = (status: AppStatusValue) =>
  typeof status === 'string' ? status : status.label;

function renderAbout(): string {
  const intro = [
    `### ${about.title}`,
    `#### ${about.heading}`,
    htmlToMarkdown(about.lead),
    htmlToMarkdown(about.body),
  ];
  const highlight = [
    '#### Highlight',
    `**${aboutHighlight.title}**`,
    aboutHighlight.description,
  ];
  // Same validation as AboutTab.tsx: invalid IDs are skipped.
  const videoIds = aboutHighlight.youtubeIds
    .map((id) => id.trim())
    .filter((id) => /^[a-zA-Z0-9_-]{11}$/.test(id));
  if (videoIds.length) {
    highlight.push(
      '**Videos:**',
      videoIds
        .map(
          (id, i) =>
            `- [${aboutHighlight.title} — Video ${i + 1}](${youtubeUrl(id)})`
        )
        .join('\n')
    );
  }
  const socials = [
    `#### ${about.socialsHeading}`,
    about.socials
      .map((s) => `- ${s.name}: [${s.handle}](${s.href})`)
      .join('\n'),
  ];
  return ['## About', ...intro, ...highlight, ...socials].join('\n\n');
}

function renderPortfolio(): string {
  const entries = apps.map((app) =>
    [
      `### ${app.title}`,
      ...(app.status ? [`**Status:** ${statusLabel(app.status)}`] : []),
      `**Tagline:** ${app.tagline}`,
      ...renderImages(app.title, app.images),
      ...renderVideos(app.videos),
      htmlToMarkdown(app.description),
      ...(app.showLink && app.link ? [`- Link: ${app.link}`] : []),
    ].join('\n\n')
  );
  return ['## Portfolio', ...entries].join('\n\n');
}

function renderLearningJourney(): string {
  const entries = projects.map((project) =>
    [
      `### ${project.title} (${project.date})`,
      ...renderImages(project.title, project.images),
      ...renderVideos(project.videos),
      htmlToMarkdown(project.description),
    ].join('\n\n')
  );
  return ['## Learning Journey', ...entries].join('\n\n');
}

function renderInspirations(): string {
  const entries = inspirations.map((person) =>
    [`### ${person.name}`, htmlToMarkdown(person.description)].join('\n\n')
  );
  return ['## Inspirations', ...entries].join('\n\n');
}

const header = `# Scott Sun

> Scott Sun | Frontier AI Chaser. Build Stuff.
> Website: ${SITE_URL}`;

const footer = `## Source

- Website: ${SITE_URL}
- Source: ${SOURCE_URL}`;

const output =
  [
    header,
    renderAbout(),
    renderPortfolio(),
    renderLearningJourney(),
    renderInspirations(),
    footer,
  ].join('\n\n---\n\n') + '\n';

writeFileSync(OUTPUT_PATH, output);
console.warn(`Wrote ${OUTPUT_PATH}`);
