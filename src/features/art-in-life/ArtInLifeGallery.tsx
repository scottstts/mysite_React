import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import {
  CSS3DObject,
  CSS3DRenderer,
} from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { createInstagramEmbedHtml } from './artInLife.data';
import styles from './ArtInLifeTab.module.css';
import walnutFrameTextureUrl from '@/assets/textures/aged-walnut-frame.webp';
import goldFrameTextureUrl from '@/assets/textures/antique-gold-frame.webp';
import ebonyFrameTextureUrl from '@/assets/textures/dark-ebony-frame.webp';
import floorTextureUrl from '@/assets/textures/gallery-floor.webp';
import matBoardTextureUrl from '@/assets/textures/gallery-mat-board.webp';
import plasterBumpTextureUrl from '@/assets/textures/gallery-plaster-bump.webp';
import plasterTextureUrl from '@/assets/textures/gallery-plaster.webp';

interface ArtInLifeGalleryProps {
  urls: string[];
}

interface GalleryLayout {
  spacing: number;
  frameOuterWidth: number;
  frameOuterHeight: number;
  frameDepth: number;
  postWidth: number;
  postHeight: number;
  frameY: number;
  cameraY: number;
  cameraFov: number;
  groupSize: number;
  frameWindowGroups: number;
  hallwayWidth: number;
  groupDepth: number;
  floorY: number;
  ceilingY: number;
  wallHeight: number;
  transitionDuration: number;
  transitionLift: number;
  transitionLookDistance: number;
}

interface FrameRecord {
  index: number;
  group: THREE.Group;
  cssObject: CSS3DObject;
  element: HTMLElement;
  embedMounted: boolean;
  embedRequested: boolean;
  lastTouched: number;
  schedule?: ScheduledWork;
  iframeObserver?: MutationObserver;
}

interface SceneClassNames {
  webglLayer: string;
  cssLayer: string;
  embedCrop: string;
  embedContent: string;
  embedPlane: string;
  embedSkeleton: string;
  skeletonHeader: string;
  skeletonAvatar: string;
  skeletonLines: string;
  skeletonLine: string;
  skeletonLineShort: string;
  skeletonImage: string;
  skeletonFooter: string;
  skeletonActions: string;
  skeletonDot: string;
  skeletonCaptionLine: string;
  skeletonCaptionShort: string;
}

interface ScheduledWork {
  type: 'idle' | 'timeout';
  id: number;
}

type GalleryWallSide = 'left' | 'right';

interface FramePlacement {
  groupIndex: number;
  side: GalleryWallSide;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  normalX: number;
}

interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

interface CameraTransition {
  fromGroupIndex: number;
  toGroupIndex: number;
  startedAt: number;
  duration: number;
  settled: boolean;
  direction: 1 | -1;
}

declare global {
  interface Window {
    __ART_IN_LIFE_CARD_SIZE_SCALE__?: number;
  }
}

const EMBED_WIDTH_PX = 326;
const EMBED_HEIGHT_PX = 492;
const EMBED_ASPECT_RATIO = EMBED_WIDTH_PX / EMBED_HEIGHT_PX;
const FRAME_RAIL_Z_OFFSET = 0.055;
const FRAME_INNER_RIM_T = 0;
const FRAME_CARD_SIZE_SCALE = 1;
const INSTAGRAM_IFRAME_ALLOW =
  'clipboard-write; encrypted-media; picture-in-picture; web-share';
const PLACEHOLDER_ART_VARIANTS = 8;
const PLACEHOLDER_ZERO_SCALE = new THREE.Vector3(0.0001, 0.0001, 0.0001);
const CHANDELIER_LOD_NAME = 'gallery-chandelier';
const CEILING_SPOTLIGHT_NAME = 'gallery-group-ceiling-spotlight';
const PAINTING_SPOTLIGHT_NAME = 'painting-overhead-spotlight';
const PAINTING_LIGHT_OFF_MS = 320;
const PAINTING_LIGHT_ON_MS = 520;

if (typeof window !== 'undefined') {
  window.__ART_IN_LIFE_CARD_SIZE_SCALE__ = FRAME_CARD_SIZE_SCALE;
  window.dispatchEvent(new Event('art-in-life-card-scale-change'));
}
const GALLERY_LIGHTING = {
  exposure: 4.0,
  paintingSpot: {
    color: 0xffc58c,
    intensity: 5.65,
    distance: 9.4,
    angle: 0.4,
    penumbra: 0.88,
    decay: 1.8,
    heightOffset: 3.6,
    depth: 1.42,
    targetY: -0.22,
    targetZ: -0.06,
  },
  ceilingSpot: {
    color: 0xfff8e7,
    intensity: 2.5,
    distance: 19,
    angle: 1.4,
    penumbra: 0.72,
    decay: 1.8,
  },
  chandelier: {
    color: 0xffc06d,
    intensity: 50.0,
    distance: 18,
    decay: 1.75,
    yOffset: 1.05,
  },
  plaqueGlint: {
    color: 0xffd391,
    intensity: 0.16,
    distance: 0.92,
    decay: 2,
    yOffset: 0.2,
    z: 0.32,
  },
};
const MOBILE_QUERY = '(max-width: 767px)';
const TABLET_QUERY = '(max-width: 1180px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

let instagramScriptPromise: Promise<void> | null = null;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const lerp = (start: number, end: number, amount: number): number =>
  start + (end - start) * amount;

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const easeInOutCubic = (value: number): number =>
  value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;

const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};

const getLayout = (isMobile: boolean, isTablet: boolean): GalleryLayout => {
  if (isMobile) {
    return {
      spacing: 3,
      frameOuterWidth: 2.26,
      frameOuterHeight: 3.42,
      frameDepth: 0.28,
      postWidth: 1.86,
      postHeight: 2.8,
      frameY: 0.32,
      cameraY: 0.2,
      cameraFov: 47,
      groupSize: 1,
      frameWindowGroups: 1,
      hallwayWidth: 14.3,
      groupDepth: 4.7,
      floorY: -2.72,
      ceilingY: 4.55,
      wallHeight: 8.25,
      transitionDuration: 1700,
      transitionLift: 0.22,
      transitionLookDistance: 8.8,
    };
  }

  if (isTablet) {
    return {
      spacing: 3.34,
      frameOuterWidth: 2.48,
      frameOuterHeight: 3.62,
      frameDepth: 0.3,
      postWidth: 2.02,
      postHeight: 3.05,
      frameY: 0.34,
      cameraY: 0.28,
      cameraFov: 41,
      groupSize: 2,
      frameWindowGroups: 1,
      hallwayWidth: 16.9,
      groupDepth: 7.45,
      floorY: -2.72,
      ceilingY: 4.65,
      wallHeight: 8.35,
      transitionDuration: 1850,
      transitionLift: 0.24,
      transitionLookDistance: 11.5,
    };
  }

  return {
    spacing: 3.62,
    frameOuterWidth: 2.58,
    frameOuterHeight: 3.66,
    frameDepth: 0.32,
    postWidth: 2.08,
    postHeight: 3.14,
    frameY: 0.42,
    cameraY: 0.3,
    cameraFov: 40,
    groupSize: 3,
    frameWindowGroups: 1,
    hallwayWidth: 18.5,
    groupDepth: 9.45,
    floorY: -2.72,
    ceilingY: 4.72,
    wallHeight: 8.45,
    transitionDuration: 1950,
    transitionLift: 0.26,
    transitionLookDistance: 13.2,
  };
};

const supportsWebGL = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
};

const ensureInstagramPreconnect = () => {
  ['https://www.instagram.com', 'https://static.cdninstagram.com'].forEach(
    (href) => {
      const selector = `link[data-instagram-preconnect="${href}"]`;
      if (document.querySelector(selector)) return;

      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = href;
      link.crossOrigin = 'anonymous';
      link.dataset.instagramPreconnect = href;
      document.head.appendChild(link);
    }
  );
};

const loadInstagramEmbedScript = (): Promise<void> => {
  if (window.instgrm?.Embeds) {
    return Promise.resolve();
  }

  if (instagramScriptPromise) {
    return instagramScriptPromise;
  }

  instagramScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-instagram-embed-sdk]'
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    ensureInstagramPreconnect();

    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://www.instagram.com/embed.js';
    script.dataset.instagramEmbedSdk = 'true';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', reject, { once: true });
    document.body.appendChild(script);
  });

  return instagramScriptPromise;
};

const requestInstagramEmbedProcess = (element: Element): Promise<void> =>
  new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      try {
        window.instgrm?.Embeds.process(element);
      } catch {
        // Instagram's embed script throws minified invariants for duplicate or
        // transiently measured embeds. Keep the gallery surface stable.
      } finally {
        window.setTimeout(() => {
          resolve();
        }, 0);
      }
    });
  });

const waitForInstagramIframe = (
  container: HTMLElement,
  timeout = 2600
): Promise<boolean> => {
  if (container.querySelector('iframe[src*="instagram.com"]')) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (hasIframe: boolean) => {
      if (settled) return;

      settled = true;
      window.clearTimeout(timeoutId);
      observer.disconnect();
      resolve(hasIframe);
    };

    const observer = new MutationObserver(() => {
      if (container.querySelector('iframe[src*="instagram.com"]')) {
        finish(true);
      }
    });
    const timeoutId = window.setTimeout(
      () =>
        finish(Boolean(container.querySelector('iframe[src*="instagram.com"]'))),
      timeout
    );

    observer.observe(container, { childList: true, subtree: true });
  });
};

const enhanceInstagramIframes = (container: HTMLElement, index: number) => {
  const iframes = container.querySelectorAll<HTMLIFrameElement>(
    'iframe[src*="instagram.com"]'
  );

  iframes.forEach((iframe) => {
    iframe.setAttribute(
      'title',
      `Instagram post in Art in Life gallery ${index + 1}`
    );
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('allow', INSTAGRAM_IFRAME_ALLOW);
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  });
};

const watchInstagramIframes = (
  container: HTMLElement,
  index: number
): MutationObserver => {
  enhanceInstagramIframes(container, index);

  const observer = new MutationObserver(() => {
    enhanceInstagramIframes(container, index);
  });
  observer.observe(container, { childList: true, subtree: true });

  return observer;
};

const scheduleWhenIdle = (callback: () => void): ScheduledWork => {
  const idleWindow = window as Window & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions
    ) => number;
  };

  if (idleWindow.requestIdleCallback) {
    return {
      type: 'idle',
      id: idleWindow.requestIdleCallback(callback, { timeout: 1500 }),
    };
  }

  return {
    type: 'timeout',
    id: window.setTimeout(callback, 520),
  };
};

const cancelScheduledWork = (work?: ScheduledWork) => {
  if (!work) return;

  const idleWindow = window as Window & {
    cancelIdleCallback?: (id: number) => void;
  };

  if (work.type === 'idle' && idleWindow.cancelIdleCallback) {
    idleWindow.cancelIdleCallback(work.id);
    return;
  }

  window.clearTimeout(work.id);
};

const createSkeletonHtml = (classNames: SceneClassNames): string => `
  <div class="${classNames.embedSkeleton}" aria-hidden="true">
    <div class="${classNames.skeletonHeader}">
      <span class="${classNames.skeletonAvatar}"></span>
      <span class="${classNames.skeletonLines}">
        <span class="${classNames.skeletonLine}"></span>
        <span class="${classNames.skeletonLineShort}"></span>
      </span>
    </div>
    <div class="${classNames.skeletonImage}"></div>
    <div class="${classNames.skeletonFooter}">
      <span class="${classNames.skeletonActions}">
        <span class="${classNames.skeletonDot}"></span>
        <span class="${classNames.skeletonDot}"></span>
        <span class="${classNames.skeletonDot}"></span>
      </span>
      <span class="${classNames.skeletonCaptionLine}"></span>
      <span class="${classNames.skeletonCaptionShort}"></span>
    </div>
  </div>
`;

const createFallbackEmbedHtml = (url: string): string =>
  `<a href="${url}" target="_blank" rel="noopener noreferrer">Open Instagram post</a>`;

const configureTexture = (
  texture: THREE.Texture,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
  colorTexture = true
) => {
  if (colorTexture) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = anisotropy;
};

const configureSingleSurfaceTexture = (
  texture: THREE.Texture,
  anisotropy: number
) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  texture.anisotropy = anisotropy;
};

const createPlaqueTextTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(55, 31, 8, 0.78)';
    context.font = '600 70px Georgia, Times New Roman, serif';
    context.letterSpacing = '2px';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgba(255, 238, 188, 0.42)';
    context.shadowBlur = 1.2;
    context.shadowOffsetY = 1;
    context.fillText('Scott Sun', canvas.width / 2, canvas.height / 2 + 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
};

const createSeededRandom = (seed: number) => {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

const createPlaceholderArtTexture = (
  seed: number,
  anisotropy: number
): THREE.CanvasTexture => {
  const random = createSeededRandom(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 580;
  const context = canvas.getContext('2d');

  if (context) {
    const palette = [
      '#6fd7d2',
      '#4f7dff',
      '#ca42c9',
      '#f26c54',
      '#f4df68',
      '#68c75f',
      '#9d78ff',
      '#f1a968',
    ];
    const background = context.createLinearGradient(0, 0, 0, canvas.height);
    background.addColorStop(0, '#203345');
    background.addColorStop(1, '#142334');
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.globalAlpha = 0.13;
    context.fillStyle = '#ffffff';
    for (let y = 8; y < canvas.height; y += 9) {
      for (let x = 8; x < canvas.width; x += 9) {
        context.beginPath();
        context.arc(x, y, 1.1, 0, Math.PI * 2);
        context.fill();
      }
    }

    context.globalCompositeOperation = 'screen';
    for (let index = 0; index < 28; index++) {
      const radius = 18 + random() * 74;
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      const color = palette[Math.floor(random() * palette.length)];

      context.globalAlpha = 0.24 + random() * 0.28;
      context.fillStyle = color;
      context.beginPath();
      context.ellipse(
        x,
        y,
        radius * (0.78 + random() * 0.72),
        radius,
        random() * Math.PI,
        0,
        Math.PI * 2
      );
      context.fill();
    }

    for (let index = 0; index < 44; index++) {
      const width = 5 + random() * 8;
      const height = 28 + random() * 86;
      const x = random() * canvas.width;
      const y = random() * canvas.height;

      context.save();
      context.translate(x, y);
      context.rotate(-0.9 + random() * 1.8);
      context.globalAlpha = 0.34 + random() * 0.3;
      context.fillStyle = palette[Math.floor(random() * palette.length)];
      context.fillRect(-width / 2, -height / 2, width, height);
      context.restore();
    }

    context.globalCompositeOperation = 'multiply';
    context.globalAlpha = 0.18;
    const shadow = context.createLinearGradient(
      canvas.width * 0.12,
      canvas.height,
      canvas.width,
      0
    );
    shadow.addColorStop(0, 'rgba(0, 0, 0, 0.02)');
    shadow.addColorStop(0.64, 'rgba(0, 0, 0, 0.7)');
    shadow.addColorStop(1, 'rgba(0, 0, 0, 0.08)');
    context.fillStyle = shadow;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 0.16;
    context.strokeStyle = '#f3d49d';
    context.lineWidth = 4;
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = Math.min(anisotropy, 4);
  texture.needsUpdate = true;
  return texture;
};

const createChandelierMetalNoiseTexture = (
  anisotropy: number
): THREE.CanvasTexture => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (context) {
    const image = context.createImageData(size, size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const offset = (y * size + x) * 4;
        const band =
          Math.sin(x * 0.06 + Math.sin(y * 0.022) * 3.1) * 0.5 + 0.5;
        const speck =
          Math.sin(x * 12.9898 + y * 78.233 + 17) * 43758.5453;
        const speckValue = speck - Math.floor(speck);
        const value = Math.floor(118 + band * 44 + speckValue * 42);

        image.data[offset] = value;
        image.data[offset + 1] = Math.floor(value * 0.92);
        image.data[offset + 2] = Math.floor(value * 0.78);
        image.data[offset + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(anisotropy, 8);
  texture.needsUpdate = true;
  return texture;
};

const roughenPlane = (geometry: THREE.BufferGeometry, amplitude: number) => {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;

  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const ripple =
      Math.sin(x * 3.1 + y * 1.7) * 0.45 +
      Math.sin(x * 8.2 - y * 5.4) * 0.18 +
      Math.sin((x + y) * 14.3) * 0.08;

    position.setZ(index, ripple * amplitude);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
};

const addQuadFace = (
  indices: number[],
  a: number,
  b: number,
  c: number,
  d: number
) => {
  indices.push(a, b, c, b, d, c);
};

const profileZAt = (
  t: number,
  railWidth: number
): number => {
  const scale = railWidth / 0.75;
  const crown =
    0.355 * scale * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.56);
  const innerBead =
    0.105 * scale * Math.exp(-Math.pow((t - 0.085) / 0.033, 2));
  const outerBead =
    0.092 * scale * Math.exp(-Math.pow((t - 0.905) / 0.038, 2));
  const innerGroove =
    -0.115 * scale * Math.exp(-Math.pow((t - 0.205) / 0.043, 2));
  const outerGroove =
    -0.102 * scale * Math.exp(-Math.pow((t - 0.735) / 0.052, 2));
  const shoulder =
    0.045 * scale * Math.exp(-Math.pow((t - 0.42) / 0.15, 2));
  const cove =
    -0.035 * scale * Math.exp(-Math.pow((t - 0.61) / 0.095, 2));

  let z =
    0.07 * scale +
    crown +
    innerBead +
    outerBead +
    innerGroove +
    outerGroove +
    shoulder +
    cove;

  z = lerp(0.105 * scale, z, smoothstep(0, 0.052, t));
  z = lerp(z, 0.095 * scale, smoothstep(0.952, 1, t));

  return z;
};

const buildFrameProfile = (railWidth: number, samples = 92) =>
  Array.from({ length: samples }, (_, index) => {
    const t = index / (samples - 1);
    return { t, z: profileZAt(t, railWidth) };
  });

const getRailPoint = (
  orientation: 'top' | 'bottom' | 'left' | 'right',
  dimensions: {
    outerWidth: number;
    outerHeight: number;
    innerWidth: number;
    innerHeight: number;
    railWidthX: number;
    railWidthY: number;
  },
  t: number,
  s: number,
  z: number
) => {
  const outerHalfWidth = dimensions.outerWidth / 2;
  const outerHalfHeight = dimensions.outerHeight / 2;
  const innerHalfWidth = dimensions.innerWidth / 2;
  const innerHalfHeight = dimensions.innerHeight / 2;
  const railWidth =
    orientation === 'top' || orientation === 'bottom'
      ? dimensions.railWidthY
      : dimensions.railWidthX;
  const a = t * railWidth;
  let x = 0;
  let y = 0;

  if (orientation === 'top') {
    y = innerHalfHeight + a;
    x = lerp(
      -outerHalfWidth + dimensions.railWidthX - t * dimensions.railWidthX,
      outerHalfWidth - dimensions.railWidthX + t * dimensions.railWidthX,
      s
    );
  } else if (orientation === 'bottom') {
    y = -innerHalfHeight - a;
    x = lerp(
      -outerHalfWidth + dimensions.railWidthX - t * dimensions.railWidthX,
      outerHalfWidth - dimensions.railWidthX + t * dimensions.railWidthX,
      s
    );
  } else if (orientation === 'right') {
    x = innerHalfWidth + a;
    y = lerp(
      -outerHalfHeight + dimensions.railWidthY - t * dimensions.railWidthY,
      outerHalfHeight - dimensions.railWidthY + t * dimensions.railWidthY,
      s
    );
  } else {
    x = -innerHalfWidth - a;
    y = lerp(
      -outerHalfHeight + dimensions.railWidthY - t * dimensions.railWidthY,
      outerHalfHeight - dimensions.railWidthY + t * dimensions.railWidthY,
      s
    );
  }

  return new THREE.Vector3(x, y, z);
};

const createSculptedRailGeometry = (
  orientation: 'top' | 'bottom' | 'left' | 'right',
  dimensions: {
    outerWidth: number;
    outerHeight: number;
    innerWidth: number;
    innerHeight: number;
    railWidthX: number;
    railWidthY: number;
    profileRailWidth: number;
    frameDepth: number;
  }
) => {
  const railWidth =
    orientation === 'top' || orientation === 'bottom'
      ? dimensions.railWidthY
      : dimensions.railWidthX;
  const profile = buildFrameProfile(dimensions.profileRailWidth);
  const lengthSegments =
    orientation === 'top' || orientation === 'bottom' ? 132 : 156;
  const bottomZ = -0.18 * (dimensions.profileRailWidth / 0.75);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const topIndices: number[][] = [];
  const bottomIndices: number[][] = [];

  const pushVertex = (vertex: THREE.Vector3, u: number, v: number) => {
    const id = positions.length / 3;
    positions.push(vertex.x, vertex.y, vertex.z);
    uvs.push(u, v);
    return id;
  };

  profile.forEach(({ t, z }, profileIndex) => {
    topIndices[profileIndex] = [];
    bottomIndices[profileIndex] = [];

    for (let segment = 0; segment <= lengthSegments; segment++) {
      const s = segment / lengthSegments;
      const u = s;
      const v = t;
      const top = getRailPoint(orientation, dimensions, t, s, z);
      const bottom = getRailPoint(orientation, dimensions, t, s, bottomZ);

      topIndices[profileIndex][segment] = pushVertex(top, u, v);
      bottomIndices[profileIndex][segment] = pushVertex(bottom, u, v + 0.08);
    }
  });

  for (let profileIndex = 0; profileIndex < profile.length - 1; profileIndex++) {
    for (let segment = 0; segment < lengthSegments; segment++) {
      addQuadFace(
        indices,
        topIndices[profileIndex][segment],
        topIndices[profileIndex][segment + 1],
        topIndices[profileIndex + 1][segment],
        topIndices[profileIndex + 1][segment + 1]
      );
      addQuadFace(
        indices,
        bottomIndices[profileIndex + 1][segment],
        bottomIndices[profileIndex + 1][segment + 1],
        bottomIndices[profileIndex][segment],
        bottomIndices[profileIndex][segment + 1]
      );
    }
  }

  for (let segment = 0; segment < lengthSegments; segment++) {
    addQuadFace(
      indices,
      bottomIndices[0][segment],
      bottomIndices[0][segment + 1],
      topIndices[0][segment],
      topIndices[0][segment + 1]
    );
    addQuadFace(
      indices,
      topIndices[profile.length - 1][segment],
      topIndices[profile.length - 1][segment + 1],
      bottomIndices[profile.length - 1][segment],
      bottomIndices[profile.length - 1][segment + 1]
    );
  }

  for (let profileIndex = 0; profileIndex < profile.length - 1; profileIndex++) {
    addQuadFace(
      indices,
      bottomIndices[profileIndex][0],
      topIndices[profileIndex][0],
      bottomIndices[profileIndex + 1][0],
      topIndices[profileIndex + 1][0]
    );
    addQuadFace(
      indices,
      topIndices[profileIndex][lengthSegments],
      bottomIndices[profileIndex][lengthSegments],
      topIndices[profileIndex + 1][lengthSegments],
      bottomIndices[profileIndex + 1][lengthSegments]
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
};

const getFrameCardSizeScale = () =>
  typeof window === 'undefined'
    ? FRAME_CARD_SIZE_SCALE
    : window.__ART_IN_LIFE_CARD_SIZE_SCALE__ ?? FRAME_CARD_SIZE_SCALE;

const getFrameMetrics = (layout: GalleryLayout) => {
  const innerWidth = layout.postWidth;
  const innerHeight = innerWidth / EMBED_ASPECT_RATIO;
  const railWidthX = (layout.frameOuterWidth - innerWidth) / 2;
  const railWidthY = (layout.frameOuterHeight - innerHeight) / 2;
  const referenceRailWidth = Math.min(railWidthX, railWidthY);
  const cardSizeScale = getFrameCardSizeScale();

  return {
    innerWidth,
    innerHeight,
    railWidthX,
    railWidthY,
    profileRailWidth: referenceRailWidth,
    cardWidth: innerWidth * cardSizeScale,
    cardHeight: innerHeight * cardSizeScale,
    cardZ:
      FRAME_RAIL_Z_OFFSET +
      profileZAt(FRAME_INNER_RIM_T, referenceRailWidth),
  };
};

const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
  const materials = Array.isArray(material) ? material : [material];

  materials.forEach((entry) => entry.dispose());
};

const createFrameGroup = ({
  index,
  x,
  layout,
  materials,
  unitBox,
  unitPlane,
}: {
  index: number;
  x: number;
  layout: GalleryLayout;
  materials: {
    frame: THREE.Material[];
    backing: THREE.Material;
    placeholderArt: THREE.Material;
    plaque: THREE.Material;
    plaqueText: THREE.Material;
  };
  unitBox: THREE.BoxGeometry;
  unitPlane: THREE.PlaneGeometry;
}): THREE.Group => {
  const group = new THREE.Group();
  const frameMaterial = materials.frame[index % materials.frame.length];
  const halfOuterHeight = layout.frameOuterHeight / 2;
  const paintingLightY =
    halfOuterHeight + GALLERY_LIGHTING.paintingSpot.heightOffset;
  const frameMetrics = getFrameMetrics(layout);
  const plaqueWidth = Math.min(0.86, layout.frameOuterWidth * 0.34);
  const plaqueHeight = 0.18;
  const plaqueY = halfOuterHeight + 0.34;

  group.position.set(x, layout.frameY, 0);

  const addBox = (
    name: string,
    scale: [number, number, number],
    position: [number, number, number],
    material: THREE.Material,
    castShadow = true
  ) => {
    const mesh = new THREE.Mesh(unitBox, material);
    mesh.name = name;
    mesh.scale.set(...scale);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  addBox(
    'backing',
    [frameMetrics.innerWidth + 0.08, frameMetrics.innerHeight + 0.08, 0.045],
    [0, 0, 0.018],
    materials.backing,
    false
  );

  const placeholderArt = new THREE.Mesh(unitPlane, materials.placeholderArt);
  placeholderArt.name = 'procedural-placeholder-art';
  placeholderArt.scale.set(frameMetrics.cardWidth, frameMetrics.cardHeight, 1);
  placeholderArt.position.set(0, 0, frameMetrics.cardZ - 0.006);
  placeholderArt.castShadow = false;
  placeholderArt.receiveShadow = true;
  group.add(placeholderArt);

  addBox(
    'artist-plaque',
    [plaqueWidth, plaqueHeight, 0.035],
    [0, plaqueY, 0.02],
    materials.plaque
  );

  const plaqueText = new THREE.Mesh(unitPlane, materials.plaqueText);
  plaqueText.name = 'artist-plaque-engraving';
  plaqueText.scale.set(plaqueWidth * 0.76, plaqueHeight * 0.54, 1);
  plaqueText.position.set(0, plaqueY, 0.041);
  plaqueText.castShadow = false;
  plaqueText.receiveShadow = false;
  group.add(plaqueText);

  const frameDimensions = {
    outerWidth: layout.frameOuterWidth,
    outerHeight: layout.frameOuterHeight,
    innerWidth: frameMetrics.innerWidth,
    innerHeight: frameMetrics.innerHeight,
    railWidthX: frameMetrics.railWidthX,
    railWidthY: frameMetrics.railWidthY,
    profileRailWidth: frameMetrics.profileRailWidth,
    frameDepth: layout.frameDepth,
  };

  (['top', 'bottom', 'left', 'right'] as const).forEach((orientation) => {
    const frameRail = new THREE.Mesh(
      createSculptedRailGeometry(orientation, frameDimensions),
      frameMaterial
    );
    frameRail.name = `sculpted-${orientation}-frame-rail`;
    frameRail.position.z = FRAME_RAIL_Z_OFFSET;
    frameRail.castShadow = true;
    frameRail.receiveShadow = true;
    group.add(frameRail);
  });

  addBox(
    'picture-light-bar',
    [layout.frameOuterWidth * 0.42, 0.07, 0.12],
    [0, paintingLightY, GALLERY_LIGHTING.paintingSpot.depth],
    materials.plaque,
    false
  );

  const spotlight = new THREE.SpotLight(
    GALLERY_LIGHTING.paintingSpot.color,
    0,
    GALLERY_LIGHTING.paintingSpot.distance,
    GALLERY_LIGHTING.paintingSpot.angle,
    GALLERY_LIGHTING.paintingSpot.penumbra,
    GALLERY_LIGHTING.paintingSpot.decay
  );
  spotlight.name = PAINTING_SPOTLIGHT_NAME;
  spotlight.userData.baseIntensity = GALLERY_LIGHTING.paintingSpot.intensity;
  spotlight.position.set(
    0,
    paintingLightY,
    GALLERY_LIGHTING.paintingSpot.depth
  );
  spotlight.target.position.set(
    0,
    GALLERY_LIGHTING.paintingSpot.targetY,
    GALLERY_LIGHTING.paintingSpot.targetZ
  );
  spotlight.castShadow = false;
  group.add(spotlight, spotlight.target);

  return group;
};

const LazyFallbackEmbed = ({ url, index }: { url: string; index: number }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isVisible || !ref.current) return;

    const element = ref.current;
    const iframeObserver = watchInstagramIframes(element, index);
    element.innerHTML = createInstagramEmbedHtml(url);

    loadInstagramEmbedScript()
      .then(() => {
        try {
          window.instgrm?.Embeds.process(element);
        } catch {
          element.innerHTML = createFallbackEmbedHtml(url);
          return;
        }
        window.setTimeout(() => enhanceInstagramIframes(element, index), 900);
      })
      .catch(() => {
        element.innerHTML = createFallbackEmbedHtml(url);
      });

    return () => {
      iframeObserver.disconnect();
    };
  }, [index, isVisible, url]);

  return (
    <div ref={ref} className={styles.fallbackEmbed}>
      {!isVisible && (
        <div
          className={styles.embedSkeleton}
          aria-label={`Instagram post placeholder ${index + 1}`}
        />
      )}
    </div>
  );
};

const FallbackGallery = ({ urls }: ArtInLifeGalleryProps) => (
  <div className={styles.fallbackGallery}>
    {urls.map((url, index) => (
      <div className={styles.fallbackFrame} key={`${url}-${index}`}>
        <LazyFallbackEmbed url={url} index={index} />
      </div>
    ))}
  </div>
);

const ArtInLifeGallery = ({ urls }: ArtInLifeGalleryProps) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const previousButtonRef = useRef<HTMLButtonElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [navGroupIndex, setNavGroupIndex] = useState(0);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isTablet = useMediaQuery(TABLET_QUERY);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const layout = useMemo(
    () => getLayout(isMobile, isTablet),
    [isMobile, isTablet]
  );
  const groupCount = Math.max(1, Math.ceil(urls.length / layout.groupSize));
  const sceneClassNames = useMemo<SceneClassNames>(
    () => ({
      webglLayer: styles.webglLayer,
      cssLayer: styles.cssLayer,
      embedCrop: styles.embedCrop,
      embedContent: styles.embedContent,
      embedPlane: styles.embedPlane,
      embedSkeleton: styles.embedSkeleton,
      skeletonHeader: styles.skeletonHeader,
      skeletonAvatar: styles.skeletonAvatar,
      skeletonLines: styles.skeletonLines,
      skeletonLine: styles.skeletonLine,
      skeletonLineShort: styles.skeletonLineShort,
      skeletonImage: styles.skeletonImage,
      skeletonFooter: styles.skeletonFooter,
      skeletonActions: styles.skeletonActions,
      skeletonDot: styles.skeletonDot,
      skeletonCaptionLine: styles.skeletonCaptionLine,
      skeletonCaptionShort: styles.skeletonCaptionShort,
    }),
    []
  );

  useEffect(() => {
    if (reducedMotion || !supportsWebGL()) {
      setUseFallback(true);
      setIsReady(true);
      return;
    }

    const viewport = viewportRef.current;
    const stage = stageRef.current;

    if (!viewport || !stage || urls.length === 0) return;

    let isMounted = true;
    let animationFrame = 0;
    let targetGroupIndex = 0;
    let currentGroupIndex = -1;
    let cameraTransition: CameraTransition | null = null;
    let activeFrameStart = 0;
    let activeFrameEnd = -1;
    let requestRenderLoop = () => {};
    const activeFrames = new Map<number, FrameRecord>();
    const activeCeilingSpotlights = new Map<number, THREE.SpotLight>();
    const maxGroupIndex = Math.max(0, groupCount - 1);
    const groupSpan = Math.max(0, (layout.groupSize - 1) * layout.spacing);
    const hallStartZ = groupSpan / 2 + layout.groupDepth * 0.82;
    const lastGroupZ = -maxGroupIndex * layout.groupDepth;
    const hallEndZ = lastGroupZ - groupSpan / 2 - layout.groupDepth * 0.9;
    const hallLength = hallStartZ - hallEndZ;
    const hallCenterZ = (hallStartZ + hallEndZ) / 2;
    const halfHallWidth = layout.hallwayWidth / 2;
    const textureLoader = new THREE.TextureLoader();
    const loadedTextures: THREE.Texture[] = [];
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const unitPlane = new THREE.PlaneGeometry(1, 1);
    const webglHost = document.createElement('div');
    webglHost.className = sceneClassNames.webglLayer;
    const cssHost = document.createElement('div');
    cssHost.className = sceneClassNames.cssLayer;
    const stagingHost = document.createElement('div');
    stagingHost.setAttribute('aria-hidden', 'true');
    stagingHost.style.cssText = `position:fixed;left:-10000px;top:0;width:${EMBED_WIDTH_PX}px;min-height:${EMBED_HEIGHT_PX}px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;contain:layout paint style;`;
    viewport.append(webglHost, cssHost);
    document.body.appendChild(stagingHost);

    const getRenderSize = () => {
      const rect = viewport.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      let height = Math.max(1, Math.round(rect.height));

      if (isMobile && height % 2 === 1) {
        height -= 1;
      }

      return { width, height };
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeee6d9);

    const cssScene = new THREE.Scene();
    const initialRenderSize = getRenderSize();
    const camera = new THREE.PerspectiveCamera(
      layout.cameraFov,
      initialRenderSize.width / initialRenderSize.height,
      0.1,
      Math.max(120, hallLength + 90)
    );
    camera.position.set(0, layout.cameraY, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2)
    );
    renderer.setSize(initialRenderSize.width, initialRenderSize.height, true);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = GALLERY_LIGHTING.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = `${initialRenderSize.width}px`;
    renderer.domElement.style.height = `${initialRenderSize.height}px`;
    renderer.domElement.style.pointerEvents = 'none';
    webglHost.appendChild(renderer.domElement);

    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(initialRenderSize.width, initialRenderSize.height);
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.inset = '0';
    cssRenderer.domElement.style.width = `${initialRenderSize.width}px`;
    cssRenderer.domElement.style.height = `${initialRenderSize.height}px`;
    cssRenderer.domElement.style.pointerEvents = 'none';
    cssHost.appendChild(cssRenderer.domElement);

    const textureAnisotropy = Math.min(
      renderer.capabilities.getMaxAnisotropy(),
      8
    );
    const loadTexture = (url: string, repeatX: number, repeatY: number) => {
      const texture = textureLoader.load(url, () => {
        if (isMounted) renderer.render(scene, camera);
      });
      configureTexture(texture, repeatX, repeatY, textureAnisotropy);
      loadedTextures.push(texture);
      return texture;
    };

    const loadSingleSurfaceTexture = (url: string) => {
      const texture = textureLoader.load(url, () => {
        if (isMounted) renderer.render(scene, camera);
      });
      configureSingleSurfaceTexture(texture, textureAnisotropy);
      loadedTextures.push(texture);
      return texture;
    };

    const loadBumpTexture = (url: string, repeatX: number, repeatY: number) => {
      const texture = textureLoader.load(url, () => {
        if (isMounted) renderer.render(scene, camera);
      });
      configureTexture(texture, repeatX, repeatY, textureAnisotropy, false);
      loadedTextures.push(texture);
      return texture;
    };

    const sideWallTextureRepeat = {
      x: Math.max(1, hallLength / 12),
      y: layout.wallHeight / 6.4,
    };
    const endWallTextureRepeat = {
      x: Math.max(1, layout.hallwayWidth / 8),
      y: layout.wallHeight / 6.4,
    };
    const ceilingTextureRepeat = {
      x: Math.max(1, layout.hallwayWidth / 6.5),
      y: Math.max(1, hallLength / 11),
    };
    const estimatedHallwayMeters = isMobile ? 3.6 : isTablet ? 4.2 : 4.6;
    const floorTileWorldSize = layout.hallwayWidth / estimatedHallwayMeters;
    const floorTextureRepeat = {
      x: estimatedHallwayMeters,
      y: Math.max(1, hallLength / floorTileWorldSize),
    };
    const sideWallTexture = loadTexture(
      plasterTextureUrl,
      sideWallTextureRepeat.x,
      sideWallTextureRepeat.y
    );
    const sideWallBump = loadBumpTexture(
      plasterBumpTextureUrl,
      sideWallTextureRepeat.x,
      sideWallTextureRepeat.y
    );
    const endWallTexture = loadTexture(
      plasterTextureUrl,
      endWallTextureRepeat.x,
      endWallTextureRepeat.y
    );
    const endWallBump = loadBumpTexture(
      plasterBumpTextureUrl,
      endWallTextureRepeat.x,
      endWallTextureRepeat.y
    );
    const ceilingTexture = loadTexture(
      plasterTextureUrl,
      ceilingTextureRepeat.x,
      ceilingTextureRepeat.y
    );
    const ceilingBump = loadBumpTexture(
      plasterBumpTextureUrl,
      ceilingTextureRepeat.x,
      ceilingTextureRepeat.y
    );
    const floorTexture = loadTexture(
      floorTextureUrl,
      floorTextureRepeat.x,
      floorTextureRepeat.y
    );
    const matTexture = loadTexture(matBoardTextureUrl, 1, 1);
    const walnutTexture = loadSingleSurfaceTexture(walnutFrameTextureUrl);
    const goldTexture = loadSingleSurfaceTexture(goldFrameTextureUrl);
    const ebonyTexture = loadSingleSurfaceTexture(ebonyFrameTextureUrl);
    const plaqueTextTexture = createPlaqueTextTexture();
    loadedTextures.push(plaqueTextTexture);
    const chandelierMetalNoise = createChandelierMetalNoiseTexture(
      textureAnisotropy
    );
    loadedTextures.push(chandelierMetalNoise);

    const placeholderTextures = Array.from(
      { length: PLACEHOLDER_ART_VARIANTS },
      (_, index) =>
        createPlaceholderArtTexture(
          0x51a7c0 + index * 0x9e3779b1,
          textureAnisotropy
        )
    );
    loadedTextures.push(...placeholderTextures);

    const sideWallMaterial = new THREE.MeshStandardMaterial({
      map: sideWallTexture,
      bumpMap: sideWallBump,
      bumpScale: 0.024,
      color: 0xf2e8d9,
      roughness: 0.94,
      metalness: 0,
    });
    const endWallMaterial = new THREE.MeshStandardMaterial({
      map: endWallTexture,
      bumpMap: endWallBump,
      bumpScale: 0.023,
      color: 0xf2e8d9,
      roughness: 0.94,
      metalness: 0,
    });
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      map: ceilingTexture,
      bumpMap: ceilingBump,
      bumpScale: 0.018,
      color: 0xf4eadc,
      roughness: 0.96,
      metalness: 0,
      side: THREE.FrontSide,
    });
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      bumpMap: floorTexture,
      bumpScale: 0.005,
      color: 0xf3ddbf,
      roughness: 0.68,
      metalness: 0,
    });
    const walnutMaterial = new THREE.MeshPhysicalMaterial({
      map: walnutTexture,
      bumpMap: walnutTexture,
      bumpScale: 0.022,
      color: 0xffffff,
      roughness: 0.42,
      metalness: 0.04,
      clearcoat: 0.62,
      clearcoatRoughness: 0.28,
      side: THREE.DoubleSide,
    });
    const goldMaterial = new THREE.MeshPhysicalMaterial({
      map: goldTexture,
      bumpMap: goldTexture,
      bumpScale: 0.012,
      color: 0xffd891,
      roughness: 0.24,
      metalness: 0.78,
      clearcoat: 0.24,
      clearcoatRoughness: 0.2,
      side: THREE.DoubleSide,
    });
    const ebonyMaterial = new THREE.MeshPhysicalMaterial({
      map: ebonyTexture,
      bumpMap: ebonyTexture,
      bumpScale: 0.018,
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.03,
      clearcoat: 0.7,
      clearcoatRoughness: 0.24,
      side: THREE.DoubleSide,
    });
    const backingMaterial = new THREE.MeshStandardMaterial({
      map: matTexture,
      color: 0xf3eadc,
      roughness: 0.92,
    });
    const placeholderArtMaterials = placeholderTextures.map(
      (texture) =>
        new THREE.MeshStandardMaterial({
          map: texture,
          color: 0xffffff,
          roughness: 0.74,
          metalness: 0.01,
          side: THREE.FrontSide,
        })
    );
    const placeholderFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a281d,
      roughness: 0.58,
      metalness: 0.03,
    });
    const baseboardMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8ded0,
      roughness: 0.78,
      metalness: 0,
    });
    const chandelierAgedGoldMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xc89a45,
      metalness: 1,
      roughness: 0.27,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
      sheen: 0.15,
      envMapIntensity: 1.15,
      map: chandelierMetalNoise,
    });
    const chandelierDarkGoldMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x8f642b,
      metalness: 1,
      roughness: 0.36,
      clearcoat: 0.38,
      clearcoatRoughness: 0.28,
      envMapIntensity: 0.92,
      map: chandelierMetalNoise,
    });
    const chandelierCableMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x4a3528,
      metalness: 0.08,
      roughness: 0.84,
      clearcoat: 0.08,
      clearcoatRoughness: 0.72,
      envMapIntensity: 0.35,
    });
    const chandelierWarmGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xfff0c5,
      roughness: 0.05,
      metalness: 0,
      transmission: 0.55,
      thickness: 0.38,
      ior: 1.48,
      transparent: true,
      opacity: 0.55,
      clearcoat: 1,
      clearcoatRoughness: 0.025,
      envMapIntensity: 1.35,
    });
    const chandelierCrystalMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf7fbff,
      roughness: 0.015,
      metalness: 0,
      transmission: 0.82,
      thickness: 0.8,
      ior: 1.74,
      transparent: true,
      opacity: 0.58,
      clearcoat: 1,
      clearcoatRoughness: 0.01,
      attenuationColor: new THREE.Color(0xfff4dc),
      attenuationDistance: 4.5,
      envMapIntensity: 1.9,
    });
    const chandelierCandleSleeveMaterial = new THREE.MeshStandardMaterial({
      color: 0xf6ecd2,
      roughness: 0.48,
      metalness: 0,
    });
    const chandelierBulbLitMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff7e2,
      roughness: 0.22,
      metalness: 0,
    });
    const chandelierFilamentMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd07a,
      roughness: 0.32,
      metalness: 0,
    });
    const chandelierFlameGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffb759,
      roughness: 0.38,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const plaqueMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb9822d,
      roughness: 0.16,
      metalness: 0.96,
      clearcoat: 0.42,
      clearcoatRoughness: 0.1,
    });
    const plaqueTextMaterial = new THREE.MeshStandardMaterial({
      map: plaqueTextTexture,
      color: 0x3d2308,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      roughness: 0.82,
      metalness: 0.04,
    });
    const materials = [
      sideWallMaterial,
      endWallMaterial,
      ceilingMaterial,
      floorMaterial,
      walnutMaterial,
      goldMaterial,
      ebonyMaterial,
      backingMaterial,
      ...placeholderArtMaterials,
      placeholderFrameMaterial,
      baseboardMaterial,
      chandelierAgedGoldMaterial,
      chandelierDarkGoldMaterial,
      chandelierCableMaterial,
      chandelierWarmGlassMaterial,
      chandelierCrystalMaterial,
      chandelierCandleSleeveMaterial,
      chandelierBulbLitMaterial,
      chandelierFilamentMaterial,
      chandelierFlameGlowMaterial,
      plaqueMaterial,
      plaqueTextMaterial,
    ];

    const environmentGeometries: THREE.BufferGeometry[] = [];
    const wallSegments = Math.max(96, Math.min(420, groupCount * 10));
    const floorSegments = Math.max(96, Math.min(480, groupCount * 12));

    const leftWallGeometry = new THREE.PlaneGeometry(
      hallLength,
      layout.wallHeight,
      wallSegments,
      42
    );
    roughenPlane(leftWallGeometry, 0.009);
    environmentGeometries.push(leftWallGeometry);
    const leftWall = new THREE.Mesh(leftWallGeometry, sideWallMaterial);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-halfHallWidth, 0.42, hallCenterZ);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWallGeometry = new THREE.PlaneGeometry(
      hallLength,
      layout.wallHeight,
      wallSegments,
      42
    );
    roughenPlane(rightWallGeometry, 0.009);
    environmentGeometries.push(rightWallGeometry);
    const rightWall = new THREE.Mesh(rightWallGeometry, sideWallMaterial);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(halfHallWidth, 0.42, hallCenterZ);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    const endWallGeometry = new THREE.PlaneGeometry(
      layout.hallwayWidth,
      layout.wallHeight,
      48,
      42
    );
    roughenPlane(endWallGeometry, 0.008);
    environmentGeometries.push(endWallGeometry);
    const endWall = new THREE.Mesh(endWallGeometry, endWallMaterial);
    endWall.position.set(0, 0.42, hallEndZ);
    endWall.receiveShadow = true;
    scene.add(endWall);

    const floorGeometry = new THREE.PlaneGeometry(
      layout.hallwayWidth,
      hallLength,
      28,
      floorSegments
    );
    roughenPlane(floorGeometry, 0.006);
    environmentGeometries.push(floorGeometry);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, layout.floorY, hallCenterZ);
    floor.receiveShadow = true;
    scene.add(floor);

    const ceilingGeometry = new THREE.PlaneGeometry(
      layout.hallwayWidth,
      hallLength,
      24,
      floorSegments
    );
    roughenPlane(ceilingGeometry, 0.004);
    environmentGeometries.push(ceilingGeometry);
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, layout.ceilingY, hallCenterZ);
    ceiling.receiveShadow = false;
    scene.add(ceiling);

    const addBaseboard = (
      side: GalleryWallSide,
      y: number,
      scaleY: number,
      scaleZ: number
    ) => {
      const normalX = side === 'left' ? 1 : -1;
      const baseboard = new THREE.Mesh(unitBox, baseboardMaterial);
      baseboard.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
      baseboard.scale.set(hallLength, scaleY, scaleZ);
      baseboard.position.set(
        (side === 'left' ? -halfHallWidth : halfHallWidth) +
          normalX * scaleZ * 0.5,
        y,
        hallCenterZ
      );
      baseboard.castShadow = true;
      baseboard.receiveShadow = true;
      scene.add(baseboard);
    };

    addBaseboard('left', layout.floorY + 0.2, 0.13, 0.18);
    addBaseboard('right', layout.floorY + 0.2, 0.13, 0.18);
    addBaseboard('left', layout.floorY + 0.29, 0.025, 0.055);
    addBaseboard('right', layout.floorY + 0.29, 0.025, 0.055);

    const endBaseboard = new THREE.Mesh(unitBox, baseboardMaterial);
    endBaseboard.scale.set(layout.hallwayWidth, 0.13, 0.18);
    endBaseboard.position.set(0, layout.floorY + 0.2, hallEndZ + 0.09);
    endBaseboard.castShadow = true;
    endBaseboard.receiveShadow = true;
    scene.add(endBaseboard);

    const endBaseboardCap = new THREE.Mesh(unitBox, baseboardMaterial);
    endBaseboardCap.scale.set(layout.hallwayWidth, 0.025, 0.055);
    endBaseboardCap.position.set(0, layout.floorY + 0.29, hallEndZ + 0.03);
    endBaseboardCap.castShadow = true;
    endBaseboardCap.receiveShadow = true;
    scene.add(endBaseboardCap);

    const chandelierRoot = new THREE.Group();
    scene.add(chandelierRoot);
    const chandelierGeometries = new Set<THREE.BufferGeometry>();

    const addChandelierMesh = (
      parent: THREE.Object3D,
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      position: [number, number, number] = [0, 0, 0],
      rotation: [number, number, number] = [0, 0, 0],
      scale: [number, number, number] = [1, 1, 1],
      castShadow = true,
      receiveShadow = false
    ) => {
      chandelierGeometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      mesh.scale.set(...scale);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.frustumCulled = true;
      mesh.userData.detailCull =
        material === chandelierCrystalMaterial ||
        material === chandelierWarmGlassMaterial ||
        material === chandelierFlameGlowMaterial;
      parent.add(mesh);
      return mesh;
    };

    const addChandelierCylinderBetween = (
      parent: THREE.Object3D,
      from: [number, number, number],
      to: [number, number, number],
      radius: number,
      material: THREE.Material,
      radialSegments = 18
    ) => {
      const start = new THREE.Vector3(...from);
      const end = new THREE.Vector3(...to);
      const geometry = new THREE.CylinderGeometry(
        radius,
        radius,
        start.distanceTo(end),
        radialSegments,
        1,
        false
      );
      const mesh = addChandelierMesh(parent, geometry, material);
      mesh.position.copy(start.clone().add(end).multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        end.clone().sub(start).normalize()
      );
      return mesh;
    };

    const makePearCrystal = (scale = 1) => {
      const group = new THREE.Group();
      addChandelierMesh(
        group,
        new THREE.OctahedronGeometry(0.17 * scale, 0),
        chandelierCrystalMaterial,
        [0, 0.16 * scale, 0],
        [0, 0.22, 0],
        [0.78, 1.25, 0.78]
      );
      addChandelierMesh(
        group,
        new THREE.SphereGeometry(0.18 * scale, 14, 18),
        chandelierCrystalMaterial,
        [0, -0.09 * scale, 0],
        [0, 0, 0],
        [0.82, 1.42, 0.82]
      );
      addChandelierMesh(
        group,
        new THREE.ConeGeometry(0.15 * scale, 0.22 * scale, 7, 1),
        chandelierCrystalMaterial,
        [0, -0.33 * scale, 0],
        [Math.PI, 0.15, 0]
      );
      addChandelierMesh(
        group,
        new THREE.TorusGeometry(0.055 * scale, 0.008 * scale, 8, 16),
        chandelierAgedGoldMaterial,
        [0, 0.35 * scale, 0],
        [Math.PI / 2, 0, 0]
      );
      return group;
    };

    const makeLongPrism = (scale = 1) => {
      const group = new THREE.Group();
      addChandelierMesh(
        group,
        new THREE.CylinderGeometry(
          0.055 * scale,
          0.065 * scale,
          0.52 * scale,
          6,
          1,
          false
        ),
        chandelierCrystalMaterial,
        [0, 0, 0],
        [0, Math.PI / 6, 0]
      );
      addChandelierMesh(
        group,
        new THREE.ConeGeometry(0.064 * scale, 0.12 * scale, 6),
        chandelierCrystalMaterial,
        [0, -0.32 * scale, 0],
        [Math.PI, Math.PI / 6, 0]
      );
      addChandelierMesh(
        group,
        new THREE.ConeGeometry(0.054 * scale, 0.11 * scale, 6),
        chandelierCrystalMaterial,
        [0, 0.32 * scale, 0],
        [0, Math.PI / 6, 0]
      );
      return group;
    };

    const addCable = (
      parent: THREE.Object3D,
      topY = 3.28,
      bottomY = 1.66
    ) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, topY, 0),
        new THREE.Vector3(0.01, THREE.MathUtils.lerp(topY, bottomY, 0.32), -0.008),
        new THREE.Vector3(-0.012, THREE.MathUtils.lerp(topY, bottomY, 0.68), 0.006),
        new THREE.Vector3(0, bottomY, 0),
      ]);

      addChandelierMesh(
        parent,
        new THREE.TubeGeometry(curve, 64, 0.026, 18, false),
        chandelierCableMaterial
      );
      addChandelierMesh(
        parent,
        new THREE.CylinderGeometry(0.05, 0.06, 0.1, 24),
        chandelierAgedGoldMaterial,
        [0, topY + 0.015, 0]
      );
      addChandelierMesh(
        parent,
        new THREE.CylinderGeometry(0.044, 0.052, 0.09, 24),
        chandelierAgedGoldMaterial,
        [0, bottomY - 0.015, 0]
      );
    };

    const createReferenceChandelier = () => {
      const chandelier = new THREE.Group();
      const beadGeometry = new THREE.SphereGeometry(0.043, 18, 12);
      chandelierGeometries.add(beadGeometry);

      addChandelierMesh(
        chandelier,
        new THREE.CylinderGeometry(0.74, 0.84, 0.12, 96),
        chandelierDarkGoldMaterial,
        [0, 3.62, 0]
      );
      addChandelierMesh(
        chandelier,
        new THREE.TorusGeometry(0.79, 0.035, 14, 128),
        chandelierAgedGoldMaterial,
        [0, 3.55, 0],
        [Math.PI / 2, 0, 0]
      );
      addChandelierMesh(
        chandelier,
        new THREE.CylinderGeometry(0.34, 0.45, 0.2, 96),
        chandelierAgedGoldMaterial,
        [0, 3.42, 0]
      );
      addChandelierMesh(
        chandelier,
        new THREE.TorusGeometry(0.39, 0.035, 14, 96),
        chandelierDarkGoldMaterial,
        [0, 3.31, 0],
        [Math.PI / 2, 0, 0]
      );
      addCable(chandelier);

      addChandelierMesh(
        chandelier,
        new THREE.CylinderGeometry(0.09, 0.09, 1.75, 48),
        chandelierAgedGoldMaterial,
        [0, 1.55, 0]
      );
      addChandelierMesh(
        chandelier,
        new THREE.SphereGeometry(0.18, 48, 24),
        chandelierAgedGoldMaterial,
        [0, 2.34, 0],
        [0, 0, 0],
        [1, 0.8, 1]
      );
      addChandelierMesh(
        chandelier,
        new THREE.SphereGeometry(0.25, 64, 28),
        chandelierAgedGoldMaterial,
        [0, 1.22, 0],
        [0, 0, 0],
        [1, 0.72, 1]
      );
      addChandelierMesh(
        chandelier,
        new THREE.SphereGeometry(0.16, 48, 24),
        chandelierDarkGoldMaterial,
        [0, 0.38, 0],
        [0, 0, 0],
        [1, 1.4, 1]
      );

      [
        [0.52, 0.045, 18, 128, 1.83, chandelierAgedGoldMaterial],
        [0.34, 0.035, 14, 128, 1.98, chandelierDarkGoldMaterial],
        [0.74, 0.05, 18, 160, 0.83, chandelierAgedGoldMaterial],
        [0.92, 0.036, 18, 160, 0.66, chandelierDarkGoldMaterial],
      ].forEach(([radius, tube, radial, tubular, y, material]) => {
        addChandelierMesh(
          chandelier,
          new THREE.TorusGeometry(
            radius as number,
            tube as number,
            radial as number,
            tubular as number
          ),
          material as THREE.Material,
          [0, y as number, 0],
          [Math.PI / 2, 0, 0]
        );
      });

      addChandelierMesh(
        chandelier,
        new THREE.SphereGeometry(0.72, 96, 24, 0, Math.PI * 2, 0, Math.PI * 0.42),
        chandelierWarmGlassMaterial,
        [0, 0.98, 0],
        [Math.PI, 0, 0],
        [1, 0.28, 1]
      );
      addChandelierMesh(
        chandelier,
        new THREE.TorusGeometry(0.71, 0.028, 14, 128),
        chandelierAgedGoldMaterial,
        [0, 0.78, 0],
        [Math.PI / 2, 0, 0]
      );
      addChandelierMesh(
        chandelier,
        new THREE.TorusGeometry(0.42, 0.018, 10, 96),
        chandelierDarkGoldMaterial,
        [0, 0.95, 0],
        [Math.PI / 2, 0, 0]
      );

      for (let index = 0; index < 72; index++) {
        const angle = (index / 72) * Math.PI * 2;
        addChandelierMesh(
          chandelier,
          beadGeometry,
          chandelierCrystalMaterial,
          [
            Math.cos(angle) * 0.94,
            0.61 + Math.sin(index * 0.5) * 0.012,
            Math.sin(angle) * 0.94,
          ],
          [0, 0, 0],
          [1, 1, 1]
        );
      }

      const createArm = (
        index: number,
        total: number,
        radius: number,
        y: number
      ) => {
        const angle = (index / total) * Math.PI * 2;
        const arm = new THREE.Group();
        arm.rotation.y = -angle;
        chandelier.add(arm);
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.46, y - 0.03, 0),
          new THREE.Vector3(0.83, y - 0.24, 0),
          new THREE.Vector3(1.25, y - 0.28, 0),
          new THREE.Vector3(1.7, y - 0.05, 0),
          new THREE.Vector3(radius, y + 0.24, 0),
        ]);

        addChandelierMesh(
          arm,
          new THREE.TubeGeometry(curve, 72, 0.035, 16, false),
          chandelierAgedGoldMaterial
        );
        addChandelierMesh(
          arm,
          new THREE.TorusGeometry(0.25, 0.018, 10, 52, Math.PI * 1.42),
          chandelierDarkGoldMaterial,
          [1.05, y - 0.15, 0],
          [0, Math.PI / 2, 0.2],
          [1, 0.7, 1]
        );
        addChandelierMesh(
          arm,
          new THREE.TorusGeometry(0.17, 0.014, 10, 44, Math.PI * 1.55),
          chandelierAgedGoldMaterial,
          [1.48, y - 0.05, 0],
          [0, -Math.PI / 2, -0.45],
          [1, 0.7, 1]
        );
        addChandelierMesh(
          arm,
          new THREE.CylinderGeometry(0.19, 0.29, 0.18, 64),
          chandelierAgedGoldMaterial,
          [radius, y + 0.21, 0]
        );
        addChandelierMesh(
          arm,
          new THREE.TorusGeometry(0.29, 0.035, 14, 90),
          chandelierAgedGoldMaterial,
          [radius, y + 0.32, 0],
          [Math.PI / 2, 0, 0]
        );
        addChandelierMesh(
          arm,
          new THREE.TorusGeometry(0.19, 0.022, 10, 70),
          chandelierDarkGoldMaterial,
          [radius, y + 0.39, 0],
          [Math.PI / 2, 0, 0]
        );
        addChandelierMesh(
          arm,
          new THREE.CylinderGeometry(0.13, 0.13, 0.42, 48),
          chandelierCandleSleeveMaterial,
          [radius, y + 0.62, 0]
        );
        addChandelierMesh(
          arm,
          new THREE.CylinderGeometry(0.105, 0.13, 0.09, 48),
          chandelierAgedGoldMaterial,
          [radius, y + 0.39, 0]
        );
        addChandelierMesh(
          arm,
          new THREE.SphereGeometry(0.135, 36, 24),
          chandelierBulbLitMaterial,
          [radius, y + 0.89, 0],
          [0, 0, 0],
          [0.82, 1.28, 0.82]
        );
        addChandelierMesh(
          arm,
          new THREE.SphereGeometry(0.09, 24, 16),
          chandelierFlameGlowMaterial,
          [radius, y + 0.91, 0],
          [0, 0, 0],
          [0.9, 1.65, 0.9],
          false
        );
        const filamentCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(radius - 0.035, y + 0.83, 0),
          new THREE.Vector3(radius - 0.015, y + 0.875, 0.022),
          new THREE.Vector3(radius + 0.018, y + 0.875, -0.022),
          new THREE.Vector3(radius + 0.038, y + 0.83, 0),
        ]);
        addChandelierMesh(
          arm,
          new THREE.TubeGeometry(filamentCurve, 24, 0.006, 6, false),
          chandelierFilamentMaterial,
          [0, 0, 0],
          [0, 0, 0],
          [1, 1, 1],
          false
        );

        for (let crystalIndex = -1; crystalIndex <= 1; crystalIndex++) {
          const crystal = makePearCrystal(0.62 - Math.abs(crystalIndex) * 0.08);
          crystal.position.set(
            radius + crystalIndex * 0.13,
            y - 0.08 - Math.abs(crystalIndex) * 0.035,
            0.03 * Math.abs(crystalIndex)
          );
          crystal.rotation.set(0, crystalIndex * 0.28, crystalIndex * 0.06);
          arm.add(crystal);
          addChandelierCylinderBetween(
            arm,
            [radius + crystalIndex * 0.13, y + 0.22, 0],
            [
              radius + crystalIndex * 0.13,
              y + 0.09 - Math.abs(crystalIndex) * 0.035,
              0.03 * Math.abs(crystalIndex),
            ],
            0.004,
            chandelierAgedGoldMaterial,
            8
          );
        }
      };

      for (let index = 0; index < 10; index++) {
        createArm(
          index,
          10,
          index % 2 === 0 ? 2.14 : 1.88,
          index % 2 === 0 ? 1.13 : 1.02
        );
      }

      for (let index = 0; index < 5; index++) {
        const angle = (index / 5) * Math.PI * 2 + Math.PI / 5;
        const arm = new THREE.Group();
        arm.rotation.y = -angle;
        chandelier.add(arm);
        const y = 1.96;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.28, y, 0),
          new THREE.Vector3(0.62, y + 0.1, 0),
          new THREE.Vector3(0.92, y + 0.22, 0),
          new THREE.Vector3(1.18, y + 0.44, 0),
        ]);

        addChandelierMesh(
          arm,
          new THREE.TubeGeometry(curve, 52, 0.025, 14, false),
          chandelierAgedGoldMaterial
        );
        addChandelierMesh(
          arm,
          new THREE.CylinderGeometry(0.1, 0.16, 0.12, 48),
          chandelierAgedGoldMaterial,
          [1.18, y + 0.47, 0]
        );
        addChandelierMesh(
          arm,
          new THREE.SphereGeometry(0.08, 24, 18),
          chandelierFlameGlowMaterial,
          [1.18, y + 0.66, 0],
          [0, 0, 0],
          [0.9, 1.55, 0.9],
          false
        );
        addChandelierMesh(
          arm,
          new THREE.SphereGeometry(0.105, 24, 18),
          chandelierBulbLitMaterial,
          [1.18, y + 0.64, 0],
          [0, 0, 0],
          [0.75, 1.22, 0.75]
        );
      }

      for (let index = 0; index < 40; index++) {
        const angle = (index / 40) * Math.PI * 2;
        const radius = index % 2 === 0 ? 0.83 : 0.68;
        const dropLength = index % 3 === 0 ? 0.58 : 0.43;
        const strand = new THREE.Group();
        strand.position.set(Math.cos(angle) * radius, 0.73, Math.sin(angle) * radius);
        strand.rotation.y = -angle;
        chandelier.add(strand);

        const beadCount = index % 3 === 0 ? 4 : 3;
        for (let beadIndex = 0; beadIndex < beadCount; beadIndex++) {
          const y = -beadIndex * (dropLength / beadCount);
          addChandelierMesh(
            strand,
            beadGeometry,
            chandelierCrystalMaterial,
            [0, y, 0],
            [0, 0, 0],
            [0.72, 0.72, 0.72]
          );
          if (beadIndex > 0) {
            addChandelierCylinderBetween(
              strand,
              [0, y + (dropLength / beadCount) * 0.78, 0],
              [0, y + 0.04, 0],
              0.0035,
              chandelierAgedGoldMaterial,
              6
            );
          }
        }

        const terminal =
          index % 4 === 0 ? makePearCrystal(0.72) : makeLongPrism(0.74);
        terminal.position.set(0, -dropLength - 0.08, 0);
        terminal.rotation.set(
          0.04 * Math.sin(index),
          angle * 0.37,
          0.08 * Math.cos(index)
        );
        strand.add(terminal);
      }

      addChandelierCylinderBetween(
        chandelier,
        [0, 0.42, 0],
        [0, -0.27, 0],
        0.007,
        chandelierAgedGoldMaterial,
        8
      );
      const centerCrystal = makePearCrystal(1.25);
      centerCrystal.position.set(0, -0.38, 0);
      chandelier.add(centerCrystal);

      for (let index = 0; index < 8; index++) {
        const angle = (index / 8) * Math.PI * 2;
        const prism = makeLongPrism(0.78);
        prism.position.set(
          Math.cos(angle) * 0.33,
          0.12 + Math.sin(index * 0.7) * 0.03,
          Math.sin(angle) * 0.33
        );
        prism.rotation.set(0.25, -angle, 0.05 * Math.sin(index));
        chandelier.add(prism);
        addChandelierCylinderBetween(
          chandelier,
          [Math.cos(angle) * 0.27, 0.55, Math.sin(angle) * 0.27],
          [Math.cos(angle) * 0.33, 0.28, Math.sin(angle) * 0.33],
          0.004,
          chandelierAgedGoldMaterial,
          8
        );
      }

      return chandelier;
    };

    const chandelierCount = Math.max(
      1,
      Math.min(isMobile ? 8 : 9, Math.ceil(groupCount / 6))
    );
    const chandelierStep = hallLength / chandelierCount;
    const chandelierScale = isMobile ? 0.46 : 0.5;
    const chandelierAnchors = Array.from(
      { length: chandelierCount },
      (_, index) => ({
        index,
        rotationY: index % 2 === 0 ? 0 : Math.PI / 10,
        position: new THREE.Vector3(
          0,
          layout.ceilingY - 3.62 * chandelierScale,
          hallStartZ - chandelierStep * (index + 0.5)
        ),
      })
    );
    const fullChandelier = createReferenceChandelier();
    fullChandelier.name = CHANDELIER_LOD_NAME;
    fullChandelier.visible = false;
    fullChandelier.scale.setScalar(chandelierScale);
    chandelierRoot.add(fullChandelier);
    chandelierAnchors.forEach((anchor) => {
      const light = new THREE.PointLight(
        GALLERY_LIGHTING.chandelier.color,
        GALLERY_LIGHTING.chandelier.intensity * (isMobile ? 0.78 : 1),
        GALLERY_LIGHTING.chandelier.distance,
        GALLERY_LIGHTING.chandelier.decay
      );
      light.position.set(
        anchor.position.x,
        anchor.position.y +
          GALLERY_LIGHTING.chandelier.yOffset * chandelierScale,
        anchor.position.z
      );
      light.castShadow = false;
      chandelierRoot.add(light);
    });

    const simpleChandelierDummy = new THREE.Object3D();
    const simpleChandelierZeroMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0, 0),
      new THREE.Quaternion(),
      PLACEHOLDER_ZERO_SCALE
    );
    const simpleChandelierCanopyGeometry = new THREE.CylinderGeometry(
      0.42,
      0.52,
      0.1,
      24
    );
    const simpleChandelierStemGeometry = new THREE.CylinderGeometry(
      0.035,
      0.035,
      1.25,
      12
    );
    const simpleChandelierRingGeometry = new THREE.TorusGeometry(
      0.72,
      0.028,
      8,
      42
    );
    const simpleChandelierBulbGeometry = new THREE.SphereGeometry(
      0.095,
      14,
      10
    );
    const simpleChandelierGlowGeometry = new THREE.SphereGeometry(
      0.15,
      12,
      8
    );
    const simpleChandelierCrystalGeometry = new THREE.OctahedronGeometry(
      0.115,
      0
    );
    const simpleChandelierArmGeometry = new THREE.CylinderGeometry(
      0.018,
      0.018,
      1.25,
      8
    );
    [
      simpleChandelierCanopyGeometry,
      simpleChandelierStemGeometry,
      simpleChandelierRingGeometry,
      simpleChandelierBulbGeometry,
      simpleChandelierGlowGeometry,
      simpleChandelierCrystalGeometry,
      simpleChandelierArmGeometry,
    ].forEach((geometry) => chandelierGeometries.add(geometry));

    const createSimpleChandelierMesh = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      count: number
    ) => {
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.frustumCulled = true;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      chandelierRoot.add(mesh);
      return mesh;
    };

    const simpleChandeliers = {
      canopy: createSimpleChandelierMesh(
        simpleChandelierCanopyGeometry,
        chandelierDarkGoldMaterial,
        chandelierCount
      ),
      stem: createSimpleChandelierMesh(
        simpleChandelierStemGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount
      ),
      ring: createSimpleChandelierMesh(
        simpleChandelierRingGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount
      ),
      bulbs: createSimpleChandelierMesh(
        simpleChandelierBulbGeometry,
        chandelierBulbLitMaterial,
        chandelierCount * 6
      ),
      glow: createSimpleChandelierMesh(
        simpleChandelierGlowGeometry,
        chandelierFlameGlowMaterial,
        chandelierCount * 6
      ),
      crystals: createSimpleChandelierMesh(
        simpleChandelierCrystalGeometry,
        chandelierCrystalMaterial,
        chandelierCount * 8
      ),
      arms: createSimpleChandelierMesh(
        simpleChandelierArmGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount * 6
      ),
    };
    const simpleChandelierMeshes = Object.values(simpleChandeliers);
    let lastChandelierLodKey = '';

    const setSimpleChandelierMatrix = (
      mesh: THREE.InstancedMesh,
      instanceIndex: number,
      position: THREE.Vector3,
      rotation: THREE.Euler,
      scale: THREE.Vector3
    ) => {
      simpleChandelierDummy.position.copy(position);
      simpleChandelierDummy.rotation.copy(rotation);
      simpleChandelierDummy.scale.copy(scale);
      simpleChandelierDummy.updateMatrix();
      mesh.setMatrixAt(instanceIndex, simpleChandelierDummy.matrix);
    };

    const hideSimpleChandelier = (
      anchorIndex: number,
      hideBulbDetails: boolean
    ) => {
      simpleChandeliers.canopy.setMatrixAt(
        anchorIndex,
        simpleChandelierZeroMatrix
      );
      simpleChandeliers.stem.setMatrixAt(
        anchorIndex,
        simpleChandelierZeroMatrix
      );
      simpleChandeliers.ring.setMatrixAt(
        anchorIndex,
        simpleChandelierZeroMatrix
      );

      for (let index = 0; index < 6; index++) {
        const bulbIndex = anchorIndex * 6 + index;
        simpleChandeliers.arms.setMatrixAt(
          bulbIndex,
          simpleChandelierZeroMatrix
        );
        simpleChandeliers.bulbs.setMatrixAt(
          bulbIndex,
          simpleChandelierZeroMatrix
        );
        simpleChandeliers.glow.setMatrixAt(
          bulbIndex,
          simpleChandelierZeroMatrix
        );
      }

      if (hideBulbDetails) {
        for (let index = 0; index < 8; index++) {
          simpleChandeliers.crystals.setMatrixAt(
            anchorIndex * 8 + index,
            simpleChandelierZeroMatrix
          );
        }
      }
    };

    const updateChandelierLod = (pose: CameraPose) => {
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      chandelierAnchors.forEach((anchor) => {
        const distance = Math.abs(anchor.position.z - pose.position.z);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = anchor.index;
        }
      });

      const fullDistance = chandelierStep * 0.58;
      const fullVisible = nearestDistance <= fullDistance;
      const fullDetailVisible = nearestDistance < fullDistance * 0.72;
      const nearestAnchor = chandelierAnchors[nearestIndex];
      const detailMask = chandelierAnchors
        .map((anchor) =>
          Math.abs(anchor.position.z - pose.position.z) <=
          chandelierStep * (isMobile ? 2 : 2.8)
            ? '1'
            : '0'
        )
        .join('');
      const lodKey = `${nearestIndex}:${fullVisible ? '1' : '0'}:${
        fullDetailVisible ? '1' : '0'
      }:${detailMask}`;

      if (lodKey === lastChandelierLodKey) return;
      lastChandelierLodKey = lodKey;

      fullChandelier.visible = fullVisible;
      if (fullVisible) {
        fullChandelier.position.copy(nearestAnchor.position);
        fullChandelier.rotation.y = nearestAnchor.rotationY;
        fullChandelier.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;

          object.visible =
            !object.userData.detailCull || fullDetailVisible;
        });
      }

      chandelierAnchors.forEach((anchor) => {
        const distance = Math.abs(anchor.position.z - pose.position.z);
        const useSimple = !fullVisible || anchor.index !== nearestIndex;
        const showDetail = distance <= chandelierStep * (isMobile ? 2 : 2.8);

        hideSimpleChandelier(anchor.index, true);
        if (!useSimple) return;

        const rootY = anchor.position.y;
        const rootRotation = anchor.rotationY;
        const rootScale = chandelierScale;
        const rootPosition = anchor.position;

        setSimpleChandelierMatrix(
          simpleChandeliers.canopy,
          anchor.index,
          new THREE.Vector3(rootPosition.x, rootY + 3.6 * rootScale, rootPosition.z),
          new THREE.Euler(0, rootRotation, 0),
          new THREE.Vector3(rootScale, rootScale, rootScale)
        );
        setSimpleChandelierMatrix(
          simpleChandeliers.stem,
          anchor.index,
          new THREE.Vector3(rootPosition.x, rootY + 2.28 * rootScale, rootPosition.z),
          new THREE.Euler(0, rootRotation, 0),
          new THREE.Vector3(rootScale, rootScale, rootScale)
        );
        setSimpleChandelierMatrix(
          simpleChandeliers.ring,
          anchor.index,
          new THREE.Vector3(rootPosition.x, rootY + 0.86 * rootScale, rootPosition.z),
          new THREE.Euler(Math.PI / 2, rootRotation, 0),
          new THREE.Vector3(rootScale, rootScale, rootScale)
        );

        for (let bulbIndex = 0; bulbIndex < 6; bulbIndex++) {
          const angle = rootRotation + (bulbIndex / 6) * Math.PI * 2;
          const radius = 1.75 * rootScale;
          const armMidRadius = 0.95 * rootScale;
          const instanceIndex = anchor.index * 6 + bulbIndex;
          const bulbPosition = new THREE.Vector3(
            rootPosition.x + Math.cos(angle) * radius,
            rootY + 1.88 * rootScale,
            rootPosition.z + Math.sin(angle) * radius
          );

          setSimpleChandelierMatrix(
            simpleChandeliers.arms,
            instanceIndex,
            new THREE.Vector3(
              rootPosition.x + Math.cos(angle) * armMidRadius,
              rootY + 1.32 * rootScale,
              rootPosition.z + Math.sin(angle) * armMidRadius
            ),
            new THREE.Euler(Math.PI / 2, 0, Math.PI / 2 - angle),
            new THREE.Vector3(rootScale, rootScale, rootScale)
          );
          setSimpleChandelierMatrix(
            simpleChandeliers.bulbs,
            instanceIndex,
            bulbPosition,
            new THREE.Euler(0, rootRotation, 0),
            new THREE.Vector3(rootScale, rootScale * 1.3, rootScale)
          );
          setSimpleChandelierMatrix(
            simpleChandeliers.glow,
            instanceIndex,
            bulbPosition,
            new THREE.Euler(0, rootRotation, 0),
            new THREE.Vector3(rootScale, rootScale * 1.45, rootScale)
          );
        }

        if (showDetail) {
          for (let crystalIndex = 0; crystalIndex < 8; crystalIndex++) {
            const angle = rootRotation + (crystalIndex / 8) * Math.PI * 2;
            const radius = (crystalIndex % 2 === 0 ? 0.72 : 0.52) * rootScale;
            setSimpleChandelierMatrix(
              simpleChandeliers.crystals,
              anchor.index * 8 + crystalIndex,
              new THREE.Vector3(
                rootPosition.x + Math.cos(angle) * radius,
                rootY + (0.26 - (crystalIndex % 3) * 0.08) * rootScale,
                rootPosition.z + Math.sin(angle) * radius
              ),
              new THREE.Euler(0.25, -angle, 0.1),
              new THREE.Vector3(rootScale, rootScale * 1.35, rootScale)
            );
          }
        }
      });

      simpleChandelierMeshes.forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      });
    };

    const getGroupSide = (groupIndex: number): GalleryWallSide =>
      groupIndex % 2 === 0 ? 'left' : 'right';

    const getGroupZ = (groupIndex: number) => -groupIndex * layout.groupDepth;

    const getGroupStart = (groupIndex: number) =>
      clamp(groupIndex, 0, maxGroupIndex) * layout.groupSize;

    const getGroupEnd = (groupIndex: number) => {
      const start = getGroupStart(groupIndex);
      return Math.min(urls.length - 1, start + layout.groupSize - 1);
    };

    const getFramePlacement = (index: number): FramePlacement => {
      const groupIndex = clamp(
        Math.floor(index / layout.groupSize),
        0,
        maxGroupIndex
      );
      const start = getGroupStart(groupIndex);
      const end = getGroupEnd(groupIndex);
      const frameCount = Math.max(1, end - start + 1);
      const slot = index - start;
      const side = getGroupSide(groupIndex);
      const normalX = side === 'left' ? 1 : -1;
      const zOffset = (slot - (frameCount - 1) / 2) * layout.spacing;

      return {
        groupIndex,
        side,
        x: side === 'left' ? -halfHallWidth : halfHallWidth,
        y: layout.frameY,
        z: getGroupZ(groupIndex) + zOffset,
        rotationY: side === 'left' ? Math.PI / 2 : -Math.PI / 2,
        normalX,
      };
    };

    const getCameraPose = (
      groupIndex: number,
      horizontalLookOffset = 0,
      verticalLookOffset = 0
    ): CameraPose => {
      const side = getGroupSide(groupIndex);
      const groupZ = getGroupZ(groupIndex);
      const wallInset = 0.16;

      return {
        position: new THREE.Vector3(0, layout.cameraY, groupZ),
        target: new THREE.Vector3(
          side === 'left' ? -halfHallWidth + wallInset : halfHallWidth - wallInset,
          layout.frameY - 0.02 + verticalLookOffset,
          groupZ + horizontalLookOffset
        ),
      };
    };

    const applyCameraPose = (pose: CameraPose) => {
      camera.position.copy(pose.position);
      camera.lookAt(pose.target);
    };

    const transformLocalPoint = (
      placement: FramePlacement,
      x: number,
      y: number,
      z: number
    ) => {
      const localPoint = new THREE.Vector3(x, y, z);
      localPoint.applyAxisAngle(new THREE.Vector3(0, 1, 0), placement.rotationY);
      return localPoint.set(
        placement.x + localPoint.x,
        placement.y + localPoint.y,
        placement.z + localPoint.z
      );
    };

    const createGroupCeilingSpotlight = (groupIndex: number) => {
      const side = getGroupSide(groupIndex);
      const normalX = side === 'left' ? 1 : -1;
      const wallX = side === 'left' ? -halfHallWidth : halfHallWidth;
      const groupZ = getGroupZ(groupIndex);
      const light = new THREE.SpotLight(
        GALLERY_LIGHTING.ceilingSpot.color,
        0,
        GALLERY_LIGHTING.ceilingSpot.distance,
        GALLERY_LIGHTING.ceilingSpot.angle,
        GALLERY_LIGHTING.ceilingSpot.penumbra,
        GALLERY_LIGHTING.ceilingSpot.decay
      );

      light.name = CEILING_SPOTLIGHT_NAME;
      light.userData.baseIntensity = GALLERY_LIGHTING.ceilingSpot.intensity;
      light.position.set(
        wallX + normalX * Math.min(4.2, halfHallWidth * 0.46),
        layout.ceilingY - 0.24,
        groupZ
      );
      light.target.position.set(
        wallX + normalX * 0.42,
        layout.frameY - 0.1,
        groupZ
      );
      light.castShadow = false;
      light.visible = false;
      scene.add(light, light.target);
      light.target.updateMatrixWorld();

      return light;
    };

    const removeGroupCeilingSpotlight = (light: THREE.SpotLight) => {
      scene.remove(light, light.target);
      light.shadow.dispose();
    };

    const updateActiveCeilingSpotlights = (groupIndexes: number[]) => {
      const neededGroups = new Set(
        groupIndexes.map((groupIndex) => clamp(groupIndex, 0, maxGroupIndex))
      );

      neededGroups.forEach((groupIndex) => {
        if (activeCeilingSpotlights.has(groupIndex)) return;

        activeCeilingSpotlights.set(
          groupIndex,
          createGroupCeilingSpotlight(groupIndex)
        );
      });

      activeCeilingSpotlights.forEach((light, groupIndex) => {
        if (neededGroups.has(groupIndex)) return;

        removeGroupCeilingSpotlight(light);
        activeCeilingSpotlights.delete(groupIndex);
      });
    };

    const placeholderRailThickness = Math.min(
      0.16,
      layout.frameOuterWidth * 0.07
    );
    const placeholderFrameDepth = 0.055;
    const placeholderDummy = new THREE.Object3D();
    const placeholderZeroMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0, 0),
      new THREE.Quaternion(),
      PLACEHOLDER_ZERO_SCALE
    );
    const placeholderArtMeshes = placeholderArtMaterials.map((material) => {
      const mesh = new THREE.InstancedMesh(unitPlane, material, urls.length);
      mesh.frustumCulled = true;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    });
    const placeholderRails = {
      top: new THREE.InstancedMesh(unitBox, placeholderFrameMaterial, urls.length),
      bottom: new THREE.InstancedMesh(
        unitBox,
        placeholderFrameMaterial,
        urls.length
      ),
      left: new THREE.InstancedMesh(unitBox, placeholderFrameMaterial, urls.length),
      right: new THREE.InstancedMesh(unitBox, placeholderFrameMaterial, urls.length),
    };

    Object.values(placeholderRails).forEach((mesh) => {
      mesh.frustumCulled = true;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      scene.add(mesh);
    });

    const setPlaceholderBoxMatrix = (
      mesh: THREE.InstancedMesh,
      index: number,
      placement: FramePlacement,
      localX: number,
      localY: number,
      localZ: number,
      scaleX: number,
      scaleY: number,
      scaleZ: number
    ) => {
      const worldPosition = transformLocalPoint(
        placement,
        localX,
        localY,
        localZ
      );
      placeholderDummy.position.copy(worldPosition);
      placeholderDummy.quaternion.setFromEuler(
        new THREE.Euler(0, placement.rotationY, 0)
      );
      placeholderDummy.scale.set(scaleX, scaleY, scaleZ);
      placeholderDummy.updateMatrix();
      mesh.setMatrixAt(index, placeholderDummy.matrix);
    };

    const setPlaceholderArtMatrix = (
      mesh: THREE.InstancedMesh,
      index: number,
      placement: FramePlacement
    ) => {
      const frameMetrics = getFrameMetrics(layout);
      const worldPosition = transformLocalPoint(
        placement,
        0,
        0,
        frameMetrics.cardZ - 0.012
      );
      placeholderDummy.position.copy(worldPosition);
      placeholderDummy.quaternion.setFromEuler(
        new THREE.Euler(0, placement.rotationY, 0)
      );
      placeholderDummy.scale.set(
        frameMetrics.cardWidth,
        frameMetrics.cardHeight,
        1
      );
      placeholderDummy.updateMatrix();
      mesh.setMatrixAt(index, placeholderDummy.matrix);
    };

    const updatePlaceholderVisibility = (
      activeStart: number,
      activeEnd: number
    ) => {
      const halfOuterWidth = layout.frameOuterWidth / 2;
      const halfOuterHeight = layout.frameOuterHeight / 2;

      for (let index = 0; index < urls.length; index++) {
        const isHighDetail = index >= activeStart && index <= activeEnd;
        const placement = getFramePlacement(index);
        const artVariant = index % placeholderArtMeshes.length;

        placeholderArtMeshes.forEach((mesh, materialIndex) => {
          if (isHighDetail || materialIndex !== artVariant) {
            mesh.setMatrixAt(index, placeholderZeroMatrix);
            return;
          }

          setPlaceholderArtMatrix(mesh, index, placement);
        });

        if (isHighDetail) {
          Object.values(placeholderRails).forEach((mesh) => {
            mesh.setMatrixAt(index, placeholderZeroMatrix);
          });
          continue;
        }

        setPlaceholderBoxMatrix(
          placeholderRails.top,
          index,
          placement,
          0,
          halfOuterHeight - placeholderRailThickness / 2,
          FRAME_RAIL_Z_OFFSET,
          layout.frameOuterWidth,
          placeholderRailThickness,
          placeholderFrameDepth
        );
        setPlaceholderBoxMatrix(
          placeholderRails.bottom,
          index,
          placement,
          0,
          -halfOuterHeight + placeholderRailThickness / 2,
          FRAME_RAIL_Z_OFFSET,
          layout.frameOuterWidth,
          placeholderRailThickness,
          placeholderFrameDepth
        );
        setPlaceholderBoxMatrix(
          placeholderRails.left,
          index,
          placement,
          -halfOuterWidth + placeholderRailThickness / 2,
          0,
          FRAME_RAIL_Z_OFFSET,
          placeholderRailThickness,
          layout.frameOuterHeight,
          placeholderFrameDepth
        );
        setPlaceholderBoxMatrix(
          placeholderRails.right,
          index,
          placement,
          halfOuterWidth - placeholderRailThickness / 2,
          0,
          FRAME_RAIL_Z_OFFSET,
          placeholderRailThickness,
          layout.frameOuterHeight,
          placeholderFrameDepth
        );
      }

      placeholderArtMeshes.forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      });
      Object.values(placeholderRails).forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      });
    };

    const createEmbedElement = (index: number) => {
      const element = document.createElement('article');
      element.className = sceneClassNames.embedPlane;
      element.setAttribute(
        'aria-label',
        `Art in Life Instagram post ${index + 1}`
      );
      element.style.width = `${EMBED_WIDTH_PX}px`;
      element.style.height = `${EMBED_HEIGHT_PX}px`;
      element.style.opacity = '0';
      return element;
    };

    const createMountedEmbedHtml = (url: string) => `
      <div class="${sceneClassNames.embedCrop}">
        <div class="${sceneClassNames.embedContent}">
          ${createInstagramEmbedHtml(url)}
        </div>
      </div>
    `;

    const mountEmbed = (record: FrameRecord, urgent = false) => {
      if (record.embedMounted) return;

      if (record.embedRequested) {
        if (!urgent || !record.schedule) return;

        cancelScheduledWork(record.schedule);
        record.schedule = undefined;
        record.embedRequested = false;
      }

      record.embedRequested = true;
      const loadEmbed = () => {
        record.schedule = undefined;

        if (!activeFrames.has(record.index)) {
          record.embedRequested = false;
          return;
        }

        loadInstagramEmbedScript()
          .then(async () => {
            if (!activeFrames.has(record.index)) {
              record.embedRequested = false;
              return;
            }

            const stagedElement = createEmbedElement(record.index);
            stagedElement.innerHTML = createMountedEmbedHtml(
              urls[record.index]
            );
            stagingHost.appendChild(stagedElement);

            await requestInstagramEmbedProcess(stagedElement);
            const hasIframe = await waitForInstagramIframe(stagedElement);

            if (!activeFrames.has(record.index)) {
              stagedElement.remove();
              record.embedRequested = false;
              return;
            }

            if (!hasIframe) {
              stagedElement.remove();
              record.embedRequested = false;
              record.element.innerHTML = '';
              record.element.style.opacity = '0';
              return;
            }

            record.element.replaceChildren(...stagedElement.childNodes);
            record.element.style.opacity = '1';
            stagedElement.remove();
            record.iframeObserver?.disconnect();
            record.iframeObserver = watchInstagramIframes(
              record.element,
              record.index
            );
            record.embedMounted = true;
          })
          .catch(() => {
            record.embedRequested = false;
            record.element.innerHTML = '';
            record.element.style.opacity = '0';
          });
      };

      if (urgent) {
        loadEmbed();
      } else {
        record.schedule = scheduleWhenIdle(loadEmbed);
      }
    };

    const unmountEmbed = (record: FrameRecord) => {
      cancelScheduledWork(record.schedule);
      record.schedule = undefined;
      record.iframeObserver?.disconnect();
      record.iframeObserver = undefined;
      record.embedMounted = false;
      record.embedRequested = false;
      record.element.style.opacity = '0';
      record.element.innerHTML = '';
    };

    const updateCardTransform = (record: FrameRecord) => {
      const frameMetrics = getFrameMetrics(layout);
      const cssScale = Math.min(
        frameMetrics.cardWidth / EMBED_WIDTH_PX,
        frameMetrics.cardHeight / EMBED_HEIGHT_PX
      );
      const placement = getFramePlacement(record.index);
      const worldPosition = transformLocalPoint(
        placement,
        0,
        0,
        frameMetrics.cardZ
      );

      record.cssObject.position.copy(worldPosition);
      record.cssObject.rotation.set(0, placement.rotationY, 0);
      record.cssObject.scale.set(cssScale, cssScale, cssScale);
    };

    const handleCardScaleChange = () => {
      activeFrames.forEach(updateCardTransform);
      requestRenderLoop();
    };

    const createFrameRecord = (index: number): FrameRecord => {
      const placement = getFramePlacement(index);
      const group = createFrameGroup({
        index,
        x: 0,
        layout,
        materials: {
          frame: [walnutMaterial, goldMaterial, ebonyMaterial],
          backing: backingMaterial,
          placeholderArt:
            placeholderArtMaterials[index % placeholderArtMaterials.length],
          plaque: plaqueMaterial,
          plaqueText: plaqueTextMaterial,
        },
        unitBox,
        unitPlane,
      });
      group.position.set(placement.x, placement.y, placement.z);
      group.rotation.y = placement.rotationY;
      scene.add(group);

      const element = createEmbedElement(index);
      const cssObject = new CSS3DObject(element);
      cssScene.add(cssObject);

      const record: FrameRecord = {
        index,
        group,
        cssObject,
        element,
        embedMounted: false,
        embedRequested: false,
        lastTouched: performance.now(),
      };

      updateCardTransform(record);

      return record;
    };

    const disposeFrameRecord = (record: FrameRecord) => {
      record.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object.geometry === unitBox) return;
        if (object.geometry === unitPlane) return;
        object.geometry.dispose();
      });
      record.element.remove();
    };

    const destroyFrameRecord = (record: FrameRecord) => {
      unmountEmbed(record);
      scene.remove(record.group);
      cssScene.remove(record.cssObject);
      disposeFrameRecord(record);
    };

    const updateVirtualFrames = (groupIndex: number) => {
      const activeStart = Math.max(
        0,
        getGroupStart(groupIndex - layout.frameWindowGroups)
      );
      const activeEnd = Math.min(
        urls.length - 1,
        getGroupEnd(groupIndex + layout.frameWindowGroups)
      );
      const embedStart = getGroupStart(groupIndex);
      const embedEnd = getGroupEnd(groupIndex);

      activeFrameStart = activeStart;
      activeFrameEnd = activeEnd;
      updatePlaceholderVisibility(activeStart, activeEnd);
      updateActiveCeilingSpotlights([groupIndex]);

      activeFrames.forEach((record, index) => {
        if (index < activeStart || index > activeEnd) {
          destroyFrameRecord(record);
          activeFrames.delete(index);
        }
      });

      for (let index = activeStart; index <= activeEnd; index++) {
        if (!activeFrames.has(index)) {
          activeFrames.set(index, createFrameRecord(index));
        }
      }

      activeFrames.forEach((record, index) => {
        if (index >= embedStart && index <= embedEnd) {
          mountEmbed(record, true);
        }
      });

      activeFrames.forEach((record, index) => {
        if (index < embedStart || index > embedEnd) {
          mountEmbed(record, false);
        }
      });
    };

    const updateTransitionFrames = (
      fromGroupIndex: number,
      toGroupIndex: number
    ) => {
      const activeStart = Math.min(
        getGroupStart(fromGroupIndex),
        getGroupStart(toGroupIndex)
      );
      const activeEnd = Math.max(
        getGroupEnd(fromGroupIndex),
        getGroupEnd(toGroupIndex)
      );
      const embedStart = getGroupStart(toGroupIndex);
      const embedEnd = getGroupEnd(toGroupIndex);

      activeFrameStart = activeStart;
      activeFrameEnd = activeEnd;
      updatePlaceholderVisibility(activeStart, activeEnd);
      updateActiveCeilingSpotlights([fromGroupIndex, toGroupIndex]);

      activeFrames.forEach((record, index) => {
        if (index < activeStart || index > activeEnd) {
          destroyFrameRecord(record);
          activeFrames.delete(index);
        }
      });

      for (let index = activeStart; index <= activeEnd; index++) {
        if (!activeFrames.has(index)) {
          activeFrames.set(index, createFrameRecord(index));
        }
      }

      activeFrames.forEach((record, index) => {
        if (index >= embedStart && index <= embedEnd) {
          mountEmbed(record, true);
        }
      });
    };

    const resize = () => {
      const { width, height } = getRenderSize();
      camera.aspect = width / height;
      camera.fov = layout.cameraFov;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2)
      );
      renderer.setSize(width, height, true);
      cssRenderer.setSize(width, height);
      renderer.domElement.style.width = `${width}px`;
      renderer.domElement.style.height = `${height}px`;
      cssRenderer.domElement.style.width = `${width}px`;
      cssRenderer.domElement.style.height = `${height}px`;
      requestRenderLoop();
    };

    const previousButton = previousButtonRef.current;
    const nextButton = nextButtonRef.current;

    const goToGroup = (groupIndex: number) => {
      if (cameraTransition) return;

      const nextGroupIndex = clamp(groupIndex, 0, maxGroupIndex);
      if (nextGroupIndex === targetGroupIndex) return;

      const fromGroupIndex = targetGroupIndex;
      const direction = nextGroupIndex > targetGroupIndex ? 1 : -1;
      cameraTransition = {
        fromGroupIndex,
        toGroupIndex: nextGroupIndex,
        startedAt: performance.now(),
        duration: layout.transitionDuration,
        settled: false,
        direction,
      };
      targetGroupIndex = nextGroupIndex;
      setNavGroupIndex(nextGroupIndex);
      updateTransitionFrames(fromGroupIndex, nextGroupIndex);
      requestRenderLoop();
    };

    const goPrevious = () => goToGroup(targetGroupIndex - 1);
    const goNext = () => goToGroup(targetGroupIndex + 1);

    let pointerX = 0;
    let pointerY = 0;

    const handlePointerMove = (event: PointerEvent) => {
      if (isMobile) return;

      pointerX = (event.clientX / window.innerWidth - 0.5) * 0.18;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 0.12;
      requestRenderLoop();
    };

    const renderScene = () => {
      renderer.render(scene, camera);
      cssRenderer.render(cssScene, camera);
    };

    const setPaintingSpotlightFactor = (
      record: FrameRecord,
      factor: number
    ) => {
      record.group.traverse((object) => {
        if (
          !(object instanceof THREE.SpotLight) ||
          object.name !== PAINTING_SPOTLIGHT_NAME
        ) {
          return;
        }

        const baseIntensity =
          typeof object.userData.baseIntensity === 'number'
            ? object.userData.baseIntensity
            : GALLERY_LIGHTING.paintingSpot.intensity;
        object.intensity = baseIntensity * factor;
        object.visible = factor > 0.001;
      });
    };

    const getGroupLightFactor = (
      groupIndex: number,
      now: number | null
    ) => {
      let factor = groupIndex === targetGroupIndex ? 1 : 0;

      if (cameraTransition && now !== null) {
        const elapsed = now - cameraTransition.startedAt;
        const lightOnElapsed =
          elapsed - PAINTING_LIGHT_OFF_MS - cameraTransition.duration;

        if (
          groupIndex === cameraTransition.fromGroupIndex &&
          elapsed < PAINTING_LIGHT_OFF_MS
        ) {
          factor = 1 - smoothstep(0, PAINTING_LIGHT_OFF_MS, elapsed);
        } else if (
          groupIndex === cameraTransition.toGroupIndex &&
          lightOnElapsed > 0
        ) {
          factor = smoothstep(0, PAINTING_LIGHT_ON_MS, lightOnElapsed);
        } else {
          factor = 0;
        }
      }

      return factor;
    };

    const setCeilingSpotlightFactor = (
      spotlight: THREE.SpotLight,
      factor: number
    ) => {
      const baseIntensity =
        typeof spotlight.userData.baseIntensity === 'number'
          ? spotlight.userData.baseIntensity
          : GALLERY_LIGHTING.ceilingSpot.intensity;
      spotlight.intensity = baseIntensity * factor;
      spotlight.visible = factor > 0.001;
    };

    const updatePaintingSpotlights = (now: number | null) => {
      activeFrames.forEach((record) => {
        const groupIndex = getFramePlacement(record.index).groupIndex;
        setPaintingSpotlightFactor(record, getGroupLightFactor(groupIndex, now));
      });
    };

    const updateCeilingSpotlights = (now: number | null) => {
      activeCeilingSpotlights.forEach((spotlight, groupIndex) => {
        setCeilingSpotlightFactor(
          spotlight,
          getGroupLightFactor(groupIndex, now)
        );
      });
    };

    const getTransitionPose = (
      transition: CameraTransition,
      now: number
    ): { pose: CameraPose; cameraProgress: number; elapsed: number } => {
      const elapsed = now - transition.startedAt;
      const cameraProgress = clamp(
        (elapsed - PAINTING_LIGHT_OFF_MS) / transition.duration,
        0,
        1
      );
      const easedProgress = easeInOutCubic(cameraProgress);
      const fromPose = getCameraPose(transition.fromGroupIndex);
      const toPose = getCameraPose(transition.toGroupIndex);
      const position = fromPose.position.clone().lerp(
        toPose.position,
        easedProgress
      );
      position.y += Math.sin(cameraProgress * Math.PI) * layout.transitionLift;

      const fromDirection = fromPose.target
        .clone()
        .sub(fromPose.position)
        .normalize();
      const toDirection = toPose.target
        .clone()
        .sub(toPose.position)
        .normalize();
      const hallwayDirection = new THREE.Vector3(
        0,
        (layout.frameY - layout.cameraY) / layout.transitionLookDistance,
        -1
      ).normalize();
      const direction =
        cameraProgress < 0.5
          ? fromDirection.lerp(
              hallwayDirection,
              easeInOutCubic(cameraProgress * 2)
            )
          : hallwayDirection.lerp(
              toDirection,
              easeInOutCubic((cameraProgress - 0.5) * 2)
            );
      direction.normalize();

      return {
        cameraProgress,
        elapsed,
        pose: {
          position,
          target: position
            .clone()
            .add(direction.multiplyScalar(layout.transitionLookDistance)),
        },
      };
    };

    const renderFrame = (now: number) => {
      animationFrame = 0;
      let pose: CameraPose;
      let isSettling = false;

      if (cameraTransition) {
        const transitionPose = getTransitionPose(cameraTransition, now);
        pose = transitionPose.pose;
        isSettling =
          transitionPose.elapsed <
          PAINTING_LIGHT_OFF_MS +
            cameraTransition.duration +
            PAINTING_LIGHT_ON_MS;

        if (
          !cameraTransition.settled &&
          transitionPose.cameraProgress >= 1
        ) {
          cameraTransition.settled = true;
          currentGroupIndex = targetGroupIndex;
          updateVirtualFrames(targetGroupIndex);
        }

        if (!isSettling) {
          cameraTransition = null;
          pose = getCameraPose(targetGroupIndex);
        }
      } else {
        pose = getCameraPose(targetGroupIndex, pointerX, -pointerY);
      }

      applyCameraPose(pose);
      updateChandelierLod(pose);

      if (!cameraTransition && targetGroupIndex !== currentGroupIndex) {
        currentGroupIndex = targetGroupIndex;
        updateVirtualFrames(targetGroupIndex);
      }
      updatePaintingSpotlights(cameraTransition ? now : null);
      updateCeilingSpotlights(cameraTransition ? now : null);

      renderScene();

      if (isSettling) {
        requestRenderLoop();
      }
    };

    requestRenderLoop = () => {
      if (!isMounted || animationFrame) return;

      animationFrame = window.requestAnimationFrame(renderFrame);
    };

    targetGroupIndex = 0;
    setNavGroupIndex(0);
    const initialPose = getCameraPose(targetGroupIndex);
    applyCameraPose(initialPose);
    resize();
    updateVirtualFrames(targetGroupIndex);
    currentGroupIndex = targetGroupIndex;
    updateChandelierLod(initialPose);
    updatePaintingSpotlights(null);
    updateCeilingSpotlights(null);
    renderScene();
    setIsReady(true);

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('orientationchange', resize, { passive: true });
    window.visualViewport?.addEventListener('resize', resize, {
      passive: true,
    });
    window.visualViewport?.addEventListener('scroll', resize, {
      passive: true,
    });
    window.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });
    window.addEventListener(
      'art-in-life-card-scale-change',
      handleCardScaleChange
    );
    previousButton?.addEventListener('click', goPrevious);
    nextButton?.addEventListener('click', goNext);

    return () => {
      isMounted = false;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener(
        'art-in-life-card-scale-change',
        handleCardScaleChange
      );
      previousButton?.removeEventListener('click', goPrevious);
      nextButton?.removeEventListener('click', goNext);

      activeFrames.forEach(destroyFrameRecord);
      activeFrames.clear();
      activeCeilingSpotlights.forEach(removeGroupCeilingSpotlight);
      activeCeilingSpotlights.clear();

      chandelierGeometries.forEach((geometry) => geometry.dispose());
      unitBox.dispose();
      unitPlane.dispose();
      environmentGeometries.forEach((geometry) => geometry.dispose());
      loadedTextures.forEach((texture) => texture.dispose());
      materials.forEach(disposeMaterial);
      renderer.dispose();
      webglHost.remove();
      cssHost.remove();
      stagingHost.remove();
    };
  }, [groupCount, isMobile, layout, reducedMotion, sceneClassNames, urls]);

  if (useFallback) {
    return <FallbackGallery urls={urls} />;
  }

  return (
    <div ref={stageRef} className={styles.galleryStage}>
      <div ref={viewportRef} className={styles.sceneViewport}>
        <div className={styles.sceneOverlay} aria-hidden="true" />
        <div
          className={`${styles.loadingCurtain} ${
            isReady ? styles.loadingCurtainHidden : ''
          }`}
          role="status"
        >
          <span className={styles.loadingMark} aria-hidden="true" />
          <span>Preparing gallery</span>
        </div>
      </div>
      <div className={styles.galleryControls} aria-label="Gallery navigation">
        <button
          ref={previousButtonRef}
          type="button"
          className={styles.galleryControlButton}
          aria-label="Previous paintings"
          disabled={navGroupIndex <= 0}
        >
          <span className={styles.galleryControlIcon} aria-hidden="true">
            ‹
          </span>
        </button>
        <button
          ref={nextButtonRef}
          type="button"
          className={styles.galleryControlButton}
          aria-label="Next paintings"
          disabled={navGroupIndex >= groupCount - 1}
        >
          <span className={styles.galleryControlIcon} aria-hidden="true">
            ›
          </span>
        </button>
      </div>

      <ul className={styles.srOnly}>
        {urls.map((url, index) => (
          <li key={`${url}-sr-${index}`}>
            <a href={url}>Instagram post {index + 1}</a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ArtInLifeGallery;
