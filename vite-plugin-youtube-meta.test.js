import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RateLimitError,
  extractVideoMeta,
  findVideoIds,
  resolveVideoMeta,
} from './vite-plugin-youtube-meta.js';

test('discovers new content IDs, deduplicates them, and ignores comments', () => {
  assert.deepEqual(
    findVideoIds(`
      // videoId: 'ignored1234'
      const content = [
        { videoId: 'abcdefghijk' },
        { youtubeId: ' lmnopqrstuv ' },
        { videoId: 'abcdefghijk' },
        { videoId: 'invalid' },
        { title: "videoId: 'ignored5678'" },
      ];
    `),
    ['abcdefghijk', 'lmnopqrstuv']
  );
});

test('reads ID lists alongside single IDs', () => {
  assert.deepEqual(
    findVideoIds(`
      export const highlight = {
        title: 'youtubeIds',
        youtubeIds: ['abcdefghijk', ' lmnopqrstuv ', 'invalid', 'abcdefghijk'],
        videoIds: ['zyxwvutsrqp'],
      };
    `),
    ['abcdefghijk', 'lmnopqrstuv', 'zyxwvutsrqp']
  );
});

test('uses the largest playback format, not thumbnail or embed dimensions', () => {
  const data = {
    streamingData: {
      adaptiveFormats: [
        { width: 766, height: 480 },
        { width: 3444, height: 2160 },
        { mimeType: 'audio/webm' },
        { width: 0, height: 2160 },
      ],
      formats: [{ width: 574, height: 360 }],
    },
    videoDetails: {
      title: 'Intro - Dyson City',
      lengthSeconds: '94',
      description: 'Code sample: "};" and a backslash: \\',
      thumbnail: { width: 1280, height: 720 },
    },
  };
  assert.deepEqual(
    extractVideoMeta(`var ytInitialPlayerResponse = ${JSON.stringify(data)};`),
    { w: 3444, h: 2160, len: 94, title: 'Intro - Dyson City' }
  );
});

test('handles portrait and wide recordings without assuming a landscape ratio', () => {
  for (const [width, height] of [
    [1080, 1920],
    [1920, 1006],
  ]) {
    assert.deepEqual(
      extractVideoMeta(
        `var ytInitialPlayerResponse = ${JSON.stringify({
          streamingData: { formats: [{ width, height }] },
        })};`
      ),
      { w: width, h: height, len: 0, title: '' }
    );
  }
});

test('rejects blocked or missing metadata instead of guessing a ratio', () => {
  assert.throws(() => extractVideoMeta('<html>Consent required</html>'));
  assert.throws(() =>
    extractVideoMeta('var ytInitialPlayerResponse = {"playabilityStatus":{}};')
  );
});

test('uses cached entries, fetches only new IDs, and drops unused ones', async () => {
  const cached = {
    aaaaaaaaaaa: { w: 1920, h: 1080, len: 60, title: 'Cached' },
    zzzzzzzzzzz: { w: 1080, h: 1920, len: 30, title: 'No longer used' },
  };
  const fetched = [];
  const { meta, failures } = await resolveVideoMeta(
    ['bbbbbbbbbbb', 'aaaaaaaaaaa'],
    cached,
    async (id) => {
      fetched.push(id);
      return { w: 1280, h: 720, len: 10, title: 'Fresh' };
    }
  );
  assert.deepEqual(fetched, ['bbbbbbbbbbb']);
  assert.deepEqual(failures, {});
  assert.deepEqual(Object.keys(meta), ['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  assert.equal(meta.aaaaaaaaaaa.title, 'Cached');
});

test('reports failures without caching them', async () => {
  const { meta, failures } = await resolveVideoMeta(
    ['aaaaaaaaaaa', 'bbbbbbbbbbb'],
    {},
    async (id) => {
      if (id === 'bbbbbbbbbbb') throw new Error('HTTP 404');
      return { w: 1920, h: 1080, len: 1, title: '' };
    }
  );
  assert.deepEqual(Object.keys(meta), ['aaaaaaaaaaa']);
  assert.deepEqual(failures, { bbbbbbbbbbb: 'HTTP 404' });
});

test('stops requesting after a 429 and reports every unresolved ID', async () => {
  const ids = Array.from({ length: 12 }, (_, i) => String(i).padStart(11, 'x'));
  let calls = 0;
  const { meta, failures } = await resolveVideoMeta(ids, {}, async () => {
    calls++;
    throw new RateLimitError('HTTP 429');
  });
  assert.equal(calls, 4); // only the requests already in flight
  assert.deepEqual(meta, {});
  assert.deepEqual(Object.keys(failures).sort(), [...ids].sort());
});
