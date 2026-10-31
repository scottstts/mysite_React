import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const moduleId = 'virtual:image-ratios';
const resolvedId = `\0${moduleId}`;
const imageDir = 'public/content_imgs';

// JPEG start-of-frame markers carry the pixel size; the rest are skipped.
const SOF = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

// Reads width and height from the file header, without decoding the image.
export function readImageSize(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length && buffer[offset] === 0xff) {
      const marker = buffer[offset + 1];
      if (SOF.has(marker)) {
        return [
          buffer.readUInt16BE(offset + 7),
          buffer.readUInt16BE(offset + 5),
        ];
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
    throw new Error('JPEG size marker missing');
  }
  if (buffer.toString('ascii', 1, 4) === 'PNG') {
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  }
  if (buffer.toString('ascii', 0, 3) === 'GIF') {
    return [buffer.readUInt16LE(6), buffer.readUInt16LE(8)];
  }
  if (buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
      return [buffer.readUIntLE(24, 3) + 1, buffer.readUIntLE(27, 3) + 1];
    }
    if (chunk === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
    }
    if (chunk === 'VP8 ') {
      return [
        buffer.readUInt16LE(26) & 0x3fff,
        buffer.readUInt16LE(28) & 0x3fff,
      ];
    }
  }
  throw new Error('Unsupported image format');
}

// Exposes { 'file.jpeg': width / height } for every content image, so prints
// can be laid out at their true shape before the image itself downloads.
export default function imageRatios() {
  let root;

  return {
    name: 'image-ratios',
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      if (id === moduleId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;
      const dir = resolve(root, imageDir);
      const ratios = {};
      for (const file of readdirSync(dir)) {
        if (file.startsWith('.')) continue;
        try {
          const [width, height] = readImageSize(
            readFileSync(resolve(dir, file))
          );
          ratios[file] = Math.round((width / height) * 10000) / 10000;
        } catch (error) {
          this.warn(`${file}: ${error.message}; its print uses a 1.6 ratio.`);
        }
      }
      return `export default ${JSON.stringify(ratios)};`;
    },
    // Re-measure when an image is added, replaced or removed, or when a data
    // file starts using one, so a new print has its shape without a restart.
    configureServer(server) {
      const dir = resolve(root, imageDir);
      const refresh = (file) => {
        if (!file.startsWith(dir) && !file.endsWith('.data.ts')) return;
        const module = server.moduleGraph.getModuleById(resolvedId);
        if (!module) return;
        server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.add(dir);
      for (const event of ['add', 'change', 'unlink']) {
        server.watcher.on(event, refresh);
      }
    },
  };
}
