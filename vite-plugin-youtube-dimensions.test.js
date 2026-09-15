import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractVideoDimensions,
  findVideoIds,
} from './vite-plugin-youtube-dimensions.js';

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
      description: 'Code sample: "};" and a backslash: \\',
      thumbnail: { width: 1280, height: 720 },
    },
  };
  assert.deepEqual(
    extractVideoDimensions(
      `var ytInitialPlayerResponse = ${JSON.stringify(data)};`
    ),
    [3444, 2160]
  );
});

test('handles portrait and wide recordings without assuming a landscape ratio', () => {
  for (const [width, height] of [
    [1080, 1920],
    [1920, 1006],
  ]) {
    assert.deepEqual(
      extractVideoDimensions(
        `var ytInitialPlayerResponse = ${JSON.stringify({
          streamingData: { formats: [{ width, height }] },
        })};`
      ),
      [width, height]
    );
  }
});

test('rejects blocked or missing metadata instead of guessing a ratio', () => {
  assert.throws(() => extractVideoDimensions('<html>Consent required</html>'));
  assert.throws(() =>
    extractVideoDimensions(
      'var ytInitialPlayerResponse = {"playabilityStatus":{}};'
    )
  );
});
