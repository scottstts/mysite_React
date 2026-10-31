import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const moduleId = 'virtual:youtube-meta';
const resolvedId = `\0${moduleId}`;

export function findVideoIds(source) {
  const ids = new Set();
  const tree = ts.createSourceFile(
    'content.ts',
    source,
    ts.ScriptTarget.Latest
  );
  const add = (literal) => {
    const id = literal.text.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(id)) ids.add(id);
  };
  const visit = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(tree).replace(/['"]/g, '');
      const value = node.initializer;
      if (/^(videoId|youtubeId)$/.test(name) && ts.isStringLiteralLike(value)) {
        add(value);
      } else if (
        /^(videoIds|youtubeIds)$/.test(name) &&
        ts.isArrayLiteralExpression(value)
      ) {
        value.elements.filter(ts.isStringLiteralLike).forEach(add);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return [...ids];
}

export function extractVideoMeta(html) {
  // Read JSON as data, never execute scripts from the watch page. Unlike
  // oEmbed sizes and thumbnails, playback formats describe the actual video.
  const match = /ytInitialPlayerResponse\s*=\s*(?=\{)/.exec(html);
  if (!match) throw new Error('Playback metadata missing');
  const start = match.index + match[0].length;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let end = start;
  // Descriptions can contain braces or semicolons inside JSON strings.
  for (; end < html.length; end++) {
    const character = html[end];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === '{') depth++;
    else if (character === '}' && --depth === 0) break;
  }
  const data = JSON.parse(html.slice(start, end + 1));
  const formats = [
    ...(data.streamingData?.adaptiveFormats ?? []),
    ...(data.streamingData?.formats ?? []),
  ].filter(
    ({ width, height }) =>
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0
  );
  // Lower resolutions round pixel dimensions and can subtly change the ratio.
  formats.sort((a, b) => b.width * b.height - a.width * a.height);
  if (!formats.length) throw new Error('Playback dimensions unavailable');
  const length = Number(data.videoDetails?.lengthSeconds);
  return {
    w: formats[0].width,
    h: formats[0].height,
    len: Number.isFinite(length) ? length : 0,
    title: data.videoDetails?.title ?? '',
  };
}

export default function youtubeMeta() {
  let root;
  const cache = new Map();

  return {
    name: 'youtube-meta',
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      if (id === moduleId) return resolvedId;
    },
    async load(id) {
      if (id !== resolvedId) return;
      const sourceRoot = resolve(root, 'src');
      const files = readdirSync(sourceRoot, { recursive: true })
        .filter((file) => file.endsWith('.data.ts'))
        .map((file) => resolve(sourceRoot, file));
      const ids = new Set();
      for (const file of files) {
        this.addWatchFile(file);
        findVideoIds(readFileSync(file, 'utf8')).forEach((id) => ids.add(id));
      }

      const meta = {};
      const pending = [...ids];
      // Bound both concurrent requests and total time spent on unavailable videos.
      const worker = async () => {
        while (pending.length) {
          const videoId = pending.shift();
          try {
            if (!cache.has(videoId)) {
              const response = await fetch(
                `https://www.youtube.com/watch?v=${videoId}`,
                { signal: AbortSignal.timeout(10000) }
              );
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              cache.set(videoId, extractVideoMeta(await response.text()));
            }
            meta[videoId] = cache.get(videoId);
          } catch (error) {
            this.warn(
              `${videoId}: ${error.message}; using a 16:9 playback frame.`
            );
          }
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));
      this.info(
        `Resolved playback metadata for ${Object.keys(meta).length}/${ids.size} videos.`
      );
      return `export default ${JSON.stringify(meta)};`;
    },
    handleHotUpdate({ file, server }) {
      if (!file.endsWith('.data.ts')) return;
      const module = server.moduleGraph.getModuleById(resolvedId);
      if (module) {
        server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      }
    },
  };
}
