// Regenerates public/llms.txt from the *.data.ts content files.
// Run with `npm run llms`. Requires Node >= 22.18 (native TypeScript type stripping).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

// Static About copy (lives in JSX, not in a data file).
const ABOUT_INTRO = `### Techno Optimist

#### Into The Unknown

From the infinite potential of energy to the total actualization of entropy, **intelligence** charts a course for the pursuit of **meaning**, **mission** and **love**.

I believe that all problems are eventually solvable through technology without introducing any additional externality. Technology evolves—gradually or rapidly—to match the complexity of problems. Today's flawed solutions will never capture how easily these problems may be resolved in the future.

Technology emerges from the interactions between intelligent entities and the universe they inhabit, while intelligence improves and evolves through technology. Technology is not only an external manifestation of intelligence but it stands as the ultimate culmination.

Intelligence is the meta-problem underlying all challenges. Once intelligence is solved, we indirectly unlock solutions to every problem. The acceleration of ASI injects a second-order surge into all frontier sciences and engineering, placing us at an inflection point where the future will be unrecognizably better.

The exponential growth of compute power, digital data & artifacts, and nn-based AI signals a broad intelligence revolution in both scale and depth.

Technology has also been historically proven to be the only robust, consistent, and effective means to combat various social disparities, both directly and indirectly.

Acceleration follows an exponential curve while human imagination remains confined to linear velocity. A fundamental transformation may be daunting, yet it is equally if not more exhilarating, for the only way forward is *into the unknown*.`;

const SOCIALS = [
  { name: 'X', label: '@scottstts', href: 'https://x.com/scottstts/' },
  {
    name: 'LinkedIn',
    label: 'Scott Sun',
    href: 'https://www.linkedin.com/in/st-scottsun-inireland/',
  },
  { name: 'GitHub', label: 'scottstts', href: 'https://github.com/scottstts/' },
  {
    name: 'Instagram',
    label: '@scottstts',
    href: 'https://www.instagram.com/scottstts/',
  },
];

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
        (_, cls: string, text: string) =>
          cls.split(/\s+/).includes('italic') ? `*${text}*` : text
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
  const highlight = [
    '#### Highlight',
    `**${aboutHighlight.title}**`,
    aboutHighlight.description,
  ];
  if (aboutHighlight.youtubeId) {
    highlight.push(
      `Video: [${aboutHighlight.title}](${youtubeUrl(aboutHighlight.youtubeId)})`
    );
  }
  const socials = [
    '#### Find me on',
    SOCIALS.map((s) => `- ${s.name}: [${s.label}](${s.href})`).join('\n'),
  ];
  return ['## About', ABOUT_INTRO, ...highlight, ...socials].join('\n\n');
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
