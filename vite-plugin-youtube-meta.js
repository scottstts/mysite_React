import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const moduleId = 'virtual:youtube-meta';
const resolvedId = `\0${moduleId}`;

// Fetched metadata is committed alongside this plugin, so a build only asks
// YouTube about videos it hasn't seen before.
const cacheFile = 'youtube-meta.json';

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

export class RateLimitError extends Error {}

const fetchVideoMeta = async (videoId) => {
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 429) {
    throw new RateLimitError(
      'YouTube is rate-limiting this network (HTTP 429)'
    );
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return extractVideoMeta(await response.text());
};

// Metadata for every ID: cached entries as they are, the rest fetched. A 429
// stops all further requests, since more of them only prolong the block.
// Returns entries for exactly `ids` (dropping videos the site no longer
// uses), plus each ID that couldn't be resolved and why.
export async function resolveVideoMeta(
  ids,
  cached,
  fetchMeta = fetchVideoMeta
) {
  const meta = {};
  const failures = {};
  const pending = [];
  for (const id of ids) {
    if (cached[id]) meta[id] = cached[id];
    else pending.push(id);
  }

  let rateLimited = null;
  const worker = async () => {
    while (pending.length && !rateLimited) {
      const id = pending.shift();
      try {
        meta[id] = await fetchMeta(id);
      } catch (error) {
        if (error instanceof RateLimitError) rateLimited ??= error;
        failures[id] = error.message;
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  for (const id of pending)
    failures[id] = `not fetched: ${rateLimited.message}`;

  const sorted = Object.fromEntries(
    Object.keys(meta)
      .sort()
      .map((id) => [id, meta[id]])
  );
  return { meta: sorted, failures };
}

export default function youtubeMeta() {
  let root;
  let isBuild = false;

  return {
    name: 'youtube-meta',
    configResolved(config) {
      root = config.root;
      isBuild = config.command === 'build';
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

      const cachePath = resolve(root, cacheFile);
      const previous = existsSync(cachePath)
        ? readFileSync(cachePath, 'utf8')
        : '{}\n';
      const { meta, failures } = await resolveVideoMeta(
        [...ids],
        JSON.parse(previous)
      );

      // Saved even when some videos failed, so the next run only retries those.
      const next = `${JSON.stringify(meta, null, 2)}\n`;
      if (next !== previous) writeFileSync(cachePath, next);

      const failed = Object.entries(failures);
      if (failed.length) {
        const list = failed.map(([id, reason]) => `  ${id}: ${reason}`);
        const summary = `Missing playback metadata for ${failed.length}/${ids.size} videos:\n${list.join('\n')}`;
        // A build with a guessed frame is not one to ship; the dev server keeps
        // running on 16:9 so work can go on.
        if (isBuild) {
          this.error(
            `${summary}\nFetched results are saved to ${cacheFile}; run the build again later.`
          );
        }
        this.warn(`${summary}\nUsing a 16:9 playback frame for these in dev.`);
      } else {
        this.info(`Resolved playback metadata for ${ids.size} videos.`);
      }
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
