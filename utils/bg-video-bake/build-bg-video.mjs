import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { get } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const rendererPath = resolve(scriptDir, 'renderer.html');
const inputPath = resolve(scriptDir, 'input/bg_video.webm');
const outputPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(scriptDir, 'output/bg_video.webm');

const workRoot = '/private/tmp/mysite-bg-bake-work';
const sourceFramesDir = resolve(workRoot, 'source_frames');
const overlayFramesDir = resolve(workRoot, 'overlay_frames');
const encodedPath = resolve(workRoot, 'bg_video.encoded.webm');
const chromeUserDataDir = resolve(workRoot, 'chrome-profile');

const width = 3840;
const height = 2160;
const frameCount = 151;
const fps = 30;

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const preferredFfmpegPaths = [
  process.env.FFMPEG,
  '/opt/homebrew/Cellar/ffmpeg/8.0_1/bin/ffmpeg',
  '/opt/homebrew/bin/ffmpeg',
  'ffmpeg',
].filter(Boolean);

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

const findFfmpeg = () => {
  for (const candidate of preferredFfmpegPaths) {
    if (candidate.includes('/') && !existsSync(candidate)) {
      continue;
    }

    return candidate;
  }

  return 'ffmpeg';
};

const run = (command, args, options = {}) =>
  new Promise((resolveRun, rejectRun) => {
    console.log(`$ ${command} ${args.join(' ')}`);
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ['ignore', 'inherit', 'inherit'],
      ...options,
    });

    child.on('error', rejectRun);
    child.on('close', (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${command} exited with code ${code}`));
      }
    });
  });

const readHttpJson = (url) =>
  new Promise((resolveRead, rejectRead) => {
    get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolveRead(JSON.parse(body));
        } catch (error) {
          rejectRead(error);
        }
      });
    }).on('error', rejectRead);
  });

const waitForWebSocketUrl = (chrome) =>
  new Promise((resolveUrl, rejectUrl) => {
    const timeout = setTimeout(() => {
      rejectUrl(new Error('Timed out waiting for Chrome DevTools URL'));
    }, 15000);

    const onData = (chunk) => {
      const text = chunk.toString();
      const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);

      if (match) {
        clearTimeout(timeout);
        chrome.stderr.off('data', onData);
        resolveUrl(match[1]);
      }
    };

    chrome.stderr.on('data', onData);
  });

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.eventHandlers = new Map();

    this.ready = new Promise((resolveReady, rejectReady) => {
      this.ws.addEventListener('open', resolveReady, { once: true });
      this.ws.addEventListener('error', rejectReady, { once: true });
    });

    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);

      if (message.id && this.pending.has(message.id)) {
        const { resolveCommand, rejectCommand } = this.pending.get(message.id);
        this.pending.delete(message.id);

        if (message.error) {
          rejectCommand(new Error(message.error.message));
        } else {
          resolveCommand(message.result || {});
        }

        return;
      }

      if (message.method && this.eventHandlers.has(message.method)) {
        for (const handler of this.eventHandlers.get(message.method)) {
          handler(message.params || {});
        }
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;

    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));

    return new Promise((resolveCommand, rejectCommand) => {
      this.pending.set(id, { resolveCommand, rejectCommand });
    });
  }

  once(method) {
    return new Promise((resolveEvent) => {
      const handler = (params) => {
        this.off(method, handler);
        resolveEvent(params);
      };

      this.on(method, handler);
    });
  }

  on(method, handler) {
    if (!this.eventHandlers.has(method)) {
      this.eventHandlers.set(method, new Set());
    }

    this.eventHandlers.get(method).add(handler);
  }

  off(method, handler) {
    const handlers = this.eventHandlers.get(method);
    if (!handlers) {
      return;
    }

    handlers.delete(handler);
  }

  close() {
    this.ws.close();
  }
}

const renderOverlayFrames = async () => {
  await mkdir(overlayFramesDir, { recursive: true });
  await rm(chromeUserDataDir, { recursive: true, force: true });
  await mkdir(chromeUserDataDir, { recursive: true });

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${chromeUserDataDir}`,
    `--window-size=${width},${height}`,
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-extensions',
    'about:blank',
  ]);

  chrome.stdout.on('data', () => {});

  try {
    const browserWsUrl = await waitForWebSocketUrl(chrome);
    const port = new URL(browserWsUrl).port;

    let targets = [];
    for (let attempt = 0; attempt < 50; attempt++) {
      targets = await readHttpJson(`http://127.0.0.1:${port}/json/list`);
      if (targets.some((target) => target.type === 'page')) {
        break;
      }
      await wait(100);
    }

    const pageTarget = targets.find((target) => target.type === 'page');
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error('Chrome did not expose a page target');
    }

    const page = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await page.ready;
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: width,
      screenHeight: height,
    });
    await page.send('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 0, g: 0, b: 0, a: 0 },
    });

    const loadEvent = page.once('Page.loadEventFired');
    await page.send('Page.navigate', { url: pathToFileURL(rendererPath).href });
    await loadEvent;

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const expression = `window.renderFrame(${frameIndex}, ${frameCount})`;
      const result = await page.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });

      if (result.exceptionDetails) {
        throw new Error(`Renderer failed at frame ${frameIndex}`);
      }

      const screenshot = await page.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false,
      });
      const filename = `overlay_${String(frameIndex + 1).padStart(4, '0')}.png`;
      await writeFile(resolve(overlayFramesDir, filename), screenshot.data, 'base64');

      if ((frameIndex + 1) % 25 === 0 || frameIndex === frameCount - 1) {
        console.log(`rendered ${frameIndex + 1}/${frameCount} overlay frames`);
      }
    }

    page.close();
  } finally {
    chrome.kill('SIGTERM');
    await wait(500);
    if (chrome.exitCode === null) {
      chrome.kill('SIGKILL');
    }
  }
};

const main = async () => {
  const ffmpeg = findFfmpeg();

  await rm(workRoot, { recursive: true, force: true });
  await mkdir(sourceFramesDir, { recursive: true });
  await mkdir(overlayFramesDir, { recursive: true });
  await mkdir(dirname(outputPath), { recursive: true });

  await run(ffmpeg, [
    '-hide_banner',
    '-y',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-fps_mode',
    'passthrough',
    resolve(sourceFramesDir, 'source_%04d.png'),
  ]);

  await renderOverlayFrames();

  await run(ffmpeg, [
    '-hide_banner',
    '-y',
    '-framerate',
    String(fps),
    '-i',
    resolve(sourceFramesDir, 'source_%04d.png'),
    '-framerate',
    String(fps),
    '-i',
    resolve(overlayFramesDir, 'overlay_%04d.png'),
    '-i',
    inputPath,
    '-filter_complex',
    '[0:v][1:v]overlay=format=auto,format=yuv422p10le[v]',
    '-map',
    '[v]',
    '-map',
    '2:a:0?',
    '-c:v',
    'libvpx-vp9',
    '-pix_fmt',
    'yuv422p10le',
    '-colorspace',
    'bt709',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-color_range',
    'tv',
    '-r',
    String(fps),
    '-frames:v',
    String(frameCount),
    '-deadline',
    'good',
    '-cpu-used',
    '2',
    '-row-mt',
    '1',
    '-crf',
    '30',
    '-b:v',
    '0',
    '-c:a',
    'copy',
    '-metadata:s:v:0',
    'HANDLER_NAME=VideoHandler',
    '-metadata:s:v:0',
    'VENDOR_ID=[0][0][0][0]',
    '-metadata:s:v:0',
    'TIMECODE=01:00:00:00',
    encodedPath,
  ]);

  await run(ffmpeg, [
    '-hide_banner',
    '-y',
    '-i',
    encodedPath,
    '-map',
    '0',
    '-c',
    'copy',
    '-disposition:v:0',
    'default',
    '-disposition:a:0',
    'default',
    outputPath,
  ]);

  await rm(workRoot, { recursive: true, force: true });
  console.log(`wrote ${outputPath}`);
};

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
