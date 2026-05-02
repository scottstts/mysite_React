import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  CSS3DObject,
  CSS3DRenderer,
} from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { createInstagramEmbedHtml } from './artInLife.data';
import styles from './ArtInLifeTab.module.css';
import walnutFrameTextureUrl from '@/assets/textures/aged-walnut-frame.webp';
import goldFrameTextureUrl from '@/assets/textures/antique-gold-frame.webp';
import ebonyFrameTextureUrl from '@/assets/textures/dark-ebony-frame.webp';
import floorTextureUrl from '@/assets/textures/gallery-floor.webp';
import matBoardTextureUrl from '@/assets/textures/gallery-mat-board.webp';
import plasterBumpTextureUrl from '@/assets/textures/gallery-plaster-bump.webp';
import plasterTextureUrl from '@/assets/textures/gallery-plaster.webp';
import neonSignGlbUrl from '@/assets/art_in_life_neon.glb';

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
  paintingSpotlight: THREE.SpotLight;
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
type FrameRailOrientation = 'top' | 'bottom' | 'left' | 'right';

type FrameRailGeometries = Record<FrameRailOrientation, THREE.BufferGeometry>;

interface FrameGroupResult {
  group: THREE.Group;
  paintingSpotlight: THREE.SpotLight;
}

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

type CameraTransitionMode = 'step' | 'cruise';

interface CameraTransition {
  fromGroupIndex: number;
  toGroupIndex: number;
  startedAt: number;
  duration: number;
  settled: boolean;
  direction: 1 | -1;
  mode: CameraTransitionMode;
  turnDuration: number;
  turnTravelDistance: number;
}

interface NeonLightRig {
  blue: THREE.RectAreaLight[];
  pink: THREE.RectAreaLight[];
}

type EffectComposerInstance =
  import('three/examples/jsm/postprocessing/EffectComposer.js').EffectComposer;
type UnrealBloomPassInstance =
  import('three/examples/jsm/postprocessing/UnrealBloomPass.js').UnrealBloomPass;
type ShaderPassInstance =
  import('three/examples/jsm/postprocessing/ShaderPass.js').ShaderPass;

interface NeonMaterialBuckets {
  frontBlue: THREE.MeshStandardMaterial[];
  frontPink: THREE.MeshStandardMaterial[];
  sideBlue: THREE.MeshStandardMaterial[];
  sidePink: THREE.MeshStandardMaterial[];
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
const LONG_JUMP_CRUISE_SPEED_UNITS_PER_SECOND = 34;
const LONG_JUMP_TURN_DURATION_RATIO = 0.46;
const LONG_JUMP_TURN_TRAVEL_MAX_RATIO = 0.24;
const NEON_SIGN_WALL_OFFSET = 0.08;
const NEON_BLOOM_SCENE_LAYER = 1;
const CHANDELIER_BLOOM_SCENE_LAYER = 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const NEON_BLOOM_SETTINGS = {
  strengthBase: 0.31,
  strengthGlow: 0.04,
  radiusBase: 0.26,
  radiusGlow: 0.02,
  threshold: 0.3,
};
const CHANDELIER_BLOOM_SETTINGS = {
  strength: 0.78,
  radius: 0.48,
  threshold: 0.16,
  glowOpacity: 0.82,
  glowScale: 1.6,
};
const CHANDELIER_LOD_LOWER_ARM_COUNT = 10;
const CHANDELIER_LOD_UPPER_ARM_COUNT = 5;
const CHANDELIER_LOD_CRYSTAL_COUNT = 16;
const CHANDELIER_LOD_BEAD_COUNT = 24;

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
    intensity: 70.0,
    distance: 18,
    decay: 1.75,
    yOffset: 1.05,
  },
  neon: {
    blueColor: 0x27c8ff,
    pinkColor: 0xff1788,
    // These RectAreaLights are intentionally much larger, weaker, and placed
    // almost directly behind the neon mesh. Matching the sign bounds made the
    // wall reveal two hard glowing rectangles; oversized overlapping emitters
    // turn that into a broad color wash instead.
    blueIntensity: 0.18,
    pinkIntensity: 0.22,
    areaLightZ: NEON_SIGN_WALL_OFFSET * 0.92,
    blueAreaWidth: 23.5,
    blueAreaHeight: 5.1,
    pinkAreaWidth: 23.5,
    pinkAreaHeight: 5.1,
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
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

const easeInQuad = (value: number): number => value * value;

const easeOutQuad = (value: number): number => 1 - (1 - value) * (1 - value);

interface BakedNeonMaterialProfile {
  bucket: keyof NeonMaterialBuckets;
  color: number;
  emissive: number;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
}

const BAKED_NEON_MATERIAL_PROFILES = {
  neon_blue_front: {
    bucket: 'frontBlue',
    color: 0xf4fdff,
    emissive: 0x27c8ff,
    emissiveIntensity: 2.25,
    roughness: 0.35,
    metalness: 0,
  },
  neon_blue_side: {
    bucket: 'sideBlue',
    color: 0x79dbff,
    emissive: 0x27c8ff,
    emissiveIntensity: 0.5,
    roughness: 0.45,
    metalness: 0,
  },
  neon_pink_front: {
    bucket: 'frontPink',
    color: 0xfff5fb,
    emissive: 0xff1788,
    emissiveIntensity: 2.7,
    roughness: 0.35,
    metalness: 0,
  },
  neon_pink_side: {
    bucket: 'sidePink',
    color: 0xff71ba,
    emissive: 0xff1788,
    emissiveIntensity: 0.64,
    roughness: 0.45,
    metalness: 0,
  },
} as const satisfies Record<string, BakedNeonMaterialProfile>;

type BakedNeonMaterialName = keyof typeof BAKED_NEON_MATERIAL_PROFILES;

const getBakedNeonMaterialName = (
  mesh: THREE.Mesh,
  material: THREE.Material
): BakedNeonMaterialName | null => {
  const label = `${mesh.name} ${material.name}`.toLowerCase();

  if (label.includes('blue') && label.includes('front')) {
    return 'neon_blue_front';
  }

  if (label.includes('blue') && label.includes('side')) {
    return 'neon_blue_side';
  }

  if (label.includes('pink') && label.includes('front')) {
    return 'neon_pink_front';
  }

  if (label.includes('pink') && label.includes('side')) {
    return 'neon_pink_side';
  }

  return null;
};

const createBakedNeonMaterial = (
  materialName: BakedNeonMaterialName
): THREE.MeshStandardMaterial => {
  const profile = BAKED_NEON_MATERIAL_PROFILES[materialName];
  const material = new THREE.MeshStandardMaterial({
    color: profile.color,
    emissive: profile.emissive,
    emissiveIntensity: profile.emissiveIntensity,
    roughness: profile.roughness,
    metalness: profile.metalness,
  });

  material.name = materialName;
  return material;
};

const registerNeonGeometry = (
  geometry: THREE.BufferGeometry,
  geometries: THREE.BufferGeometry[]
) => {
  if (!geometries.includes(geometry)) {
    geometries.push(geometry);
  }
};

const createBakedNeonSign = (
  source: THREE.Object3D,
  materialBuckets: NeonMaterialBuckets,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[]
): THREE.Group => {
  const sign = source.clone(true) as THREE.Group;

  sign.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    object.castShadow = false;
    object.receiveShadow = false;
    object.layers.enable(NEON_BLOOM_SCENE_LAYER);
    registerNeonGeometry(object.geometry, geometries);

    const applyMaterial = (sourceMaterial: THREE.Material) => {
      const materialName = getBakedNeonMaterialName(object, sourceMaterial);

      if (!materialName) {
        const fallback = sourceMaterial.clone();
        materials.push(fallback);
        return fallback;
      }

      const material = createBakedNeonMaterial(materialName);
      const profile = BAKED_NEON_MATERIAL_PROFILES[materialName];
      materialBuckets[profile.bucket].push(material);
      materials.push(material);
      return material;
    };

    object.material = Array.isArray(object.material)
      ? object.material.map(applyMaterial)
      : applyMaterial(object.material);
  });

  return sign;
};

const neonCycle = (timeSeconds: number): number => {
  const cycle = ((timeSeconds + 0.6) % 6.4) / 6.4;
  let multiplier = 1;

  const down = smoothstep(0.55, 0.6, cycle);
  const recover = smoothstep(0.72, 0.84, cycle);
  multiplier *= 1 - 0.4 * down * (1 - recover);

  const window =
    smoothstep(0.61, 0.64, cycle) * (1 - smoothstep(0.77, 0.81, cycle));
  const sputter =
    Math.sin(timeSeconds * 38) * Math.sin(timeSeconds * 71) * 0.5 + 0.5;
  multiplier -= window * 0.16 * Math.pow(sputter, 3);

  multiplier +=
    0.018 * Math.sin(timeSeconds * 13) + 0.01 * Math.sin(timeSeconds * 29.5);

  return clamp(multiplier, 0.5, 1.03);
};

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

const isDesktopSafari = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent;
  const isSafari =
    /^((?!chrome|android|crios|fxios|edg|opr).)*safari/i.test(userAgent);
  const isMacDesktop = /Mac/i.test(navigator.platform);
  const isTouchMac = navigator.maxTouchPoints > 1;

  return isSafari && isMacDesktop && !isTouchMac;
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
        finish(
          Boolean(container.querySelector('iframe[src*="instagram.com"]'))
        ),
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
    iframe.style.pointerEvents = 'auto';
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
        const band = Math.sin(x * 0.06 + Math.sin(y * 0.022) * 3.1) * 0.5 + 0.5;
        const speck = Math.sin(x * 12.9898 + y * 78.233 + 17) * 43758.5453;
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

const profileZAt = (t: number, railWidth: number): number => {
  const scale = railWidth / 0.75;
  const crown =
    0.355 * scale * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.56);
  const innerBead = 0.105 * scale * Math.exp(-Math.pow((t - 0.085) / 0.033, 2));
  const outerBead = 0.092 * scale * Math.exp(-Math.pow((t - 0.905) / 0.038, 2));
  const innerGroove =
    -0.115 * scale * Math.exp(-Math.pow((t - 0.205) / 0.043, 2));
  const outerGroove =
    -0.102 * scale * Math.exp(-Math.pow((t - 0.735) / 0.052, 2));
  const shoulder = 0.045 * scale * Math.exp(-Math.pow((t - 0.42) / 0.15, 2));
  const cove = -0.035 * scale * Math.exp(-Math.pow((t - 0.61) / 0.095, 2));

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
  orientation: FrameRailOrientation,
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
  orientation: FrameRailOrientation,
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

  for (
    let profileIndex = 0;
    profileIndex < profile.length - 1;
    profileIndex++
  ) {
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

  for (
    let profileIndex = 0;
    profileIndex < profile.length - 1;
    profileIndex++
  ) {
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
    : (window.__ART_IN_LIFE_CARD_SIZE_SCALE__ ?? FRAME_CARD_SIZE_SCALE);

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
      FRAME_RAIL_Z_OFFSET + profileZAt(FRAME_INNER_RIM_T, referenceRailWidth),
  };
};

const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
  const materials = Array.isArray(material) ? material : [material];

  materials.forEach((entry) => entry.dispose());
};

const configureGallerySpotlightShadow = (
  spotlight: THREE.SpotLight,
  isMobile: boolean
) => {
  spotlight.castShadow = true;
  spotlight.shadow.mapSize.set(isMobile ? 2048 : 4096, isMobile ? 2048 : 4096);
  spotlight.shadow.camera.near = 1.6;
  spotlight.shadow.camera.far = 18;
  spotlight.shadow.bias = -0.00004;
  spotlight.shadow.normalBias = 0.035;
  spotlight.shadow.radius = isMobile ? 3 : 4;
  spotlight.shadow.blurSamples = isMobile ? 8 : 12;
};

const createFrameGroup = ({
  index,
  x,
  isMobile,
  layout,
  materials,
  railGeometries,
  unitBox,
  unitPlane,
}: {
  index: number;
  x: number;
  isMobile: boolean;
  layout: GalleryLayout;
  materials: {
    frame: THREE.Material[];
    backing: THREE.Material;
    placeholderArt: THREE.Material;
    plaque: THREE.Material;
    plaqueText: THREE.Material;
  };
  railGeometries: FrameRailGeometries;
  unitBox: THREE.BoxGeometry;
  unitPlane: THREE.PlaneGeometry;
}): FrameGroupResult => {
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

  (['top', 'bottom', 'left', 'right'] as const).forEach((orientation) => {
    const frameRail = new THREE.Mesh(
      railGeometries[orientation],
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
  configureGallerySpotlightShadow(spotlight, isMobile);
  group.add(spotlight, spotlight.target);

  return { group, paintingSpotlight: spotlight };
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

const DesktopSafariNotice = () => (
  <div className={styles.sceneFallback} role="status">
    For a better experience, visit on a Chromium browser.
  </div>
);

const ArtInLifeGallery = ({ urls }: ArtInLifeGalleryProps) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousButtonRef = useRef<HTMLButtonElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [navGroupIndex, setNavGroupIndex] = useState(0);
  const [isNavThrottled, setIsNavThrottled] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isTablet = useMediaQuery(TABLET_QUERY);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const shouldShowDesktopSafariNotice = isDesktopSafari();
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
    if (shouldShowDesktopSafariNotice) {
      setUseFallback(false);
      setIsReady(true);
      return;
    }

    if (reducedMotion || !supportsWebGL()) {
      setUseFallback(true);
      setIsReady(true);
      return;
    }

    const viewport = viewportRef.current;
    const stage = stageRef.current;

    if (!viewport || !stage || urls.length === 0) return;

    let isMounted = true;
    setIsNavThrottled(false);
    let animationFrame = 0;
    let targetGroupIndex = 0;
    let currentGroupIndex = -1;
    let cameraTransition: CameraTransition | null = null;
    let activeFrameStart = 0;
    let activeFrameEnd = -1;
    let requestRenderLoop = () => {};
    let isDocumentVisible = document.visibilityState === 'visible';
    let isViewportVisible = true;
    const shouldRunRenderLoop = () => isDocumentVisible && isViewportVisible;
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
    const wallCeilingOverlap = 0.35;
    const ceilingWallOverlap = 0.45;
    const roomHeight = layout.ceilingY - layout.floorY;
    const wallDrawHeight = roomHeight + wallCeilingOverlap * 2;
    const wallCenterY = layout.floorY + roomHeight / 2;
    const textureLoader = new THREE.TextureLoader();
    const loadedTextures: THREE.Texture[] = [];
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const unitPlane = new THREE.PlaneGeometry(1, 1);
    const sharedFrameMetrics = getFrameMetrics(layout);
    const sharedFrameDimensions = {
      outerWidth: layout.frameOuterWidth,
      outerHeight: layout.frameOuterHeight,
      innerWidth: sharedFrameMetrics.innerWidth,
      innerHeight: sharedFrameMetrics.innerHeight,
      railWidthX: sharedFrameMetrics.railWidthX,
      railWidthY: sharedFrameMetrics.railWidthY,
      profileRailWidth: sharedFrameMetrics.profileRailWidth,
      frameDepth: layout.frameDepth,
    };
    const sharedFrameRailGeometries: FrameRailGeometries = {
      top: createSculptedRailGeometry('top', sharedFrameDimensions),
      bottom: createSculptedRailGeometry('bottom', sharedFrameDimensions),
      left: createSculptedRailGeometry('left', sharedFrameDimensions),
      right: createSculptedRailGeometry('right', sharedFrameDimensions),
    };
    const sharedFrameRailGeometrySet = new Set(
      Object.values(sharedFrameRailGeometries)
    );
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
      alpha: false,
      powerPreference: 'high-performance',
    });
    const initialPixelRatio = Math.min(
      window.devicePixelRatio,
      isMobile ? 1.5 : 2
    );
    renderer.setPixelRatio(initialPixelRatio);
    renderer.setSize(initialRenderSize.width, initialRenderSize.height, true);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = GALLERY_LIGHTING.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = `${initialRenderSize.width}px`;
    renderer.domElement.style.height = `${initialRenderSize.height}px`;
    renderer.domElement.style.pointerEvents = 'none';
    webglHost.appendChild(renderer.domElement);
    RectAreaLightUniformsLib.init();

    let composer: EffectComposerInstance | null = null;
    let bloomComposer: EffectComposerInstance | null = null;
    let chandelierBloomComposer: EffectComposerInstance | null = null;
    let bloomPass: UnrealBloomPassInstance | null = null;
    let chandelierBloomPass: UnrealBloomPassInstance | null = null;
    let finalBloomPass: ShaderPassInstance | null = null;
    let finalBloomMaterial: THREE.ShaderMaterial | null = null;
    const bloomLayer = new THREE.Layers();
    bloomLayer.set(NEON_BLOOM_SCENE_LAYER);
    const chandelierBloomLayer = new THREE.Layers();
    chandelierBloomLayer.set(CHANDELIER_BLOOM_SCENE_LAYER);
    let activeBloomLayer = bloomLayer;
    const darkBloomMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const darkenedBloomMeshes: Array<{
      mesh: THREE.Mesh;
      material: THREE.Material | THREE.Material[];
    }> = [];

    const loadBloomComposer = async () => {
      const [
        { EffectComposer },
        { RenderPass },
        { UnrealBloomPass },
        { ShaderPass },
        { OutputPass },
      ] = await Promise.all([
        import('three/examples/jsm/postprocessing/EffectComposer.js'),
        import('three/examples/jsm/postprocessing/RenderPass.js'),
        import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
        import('three/examples/jsm/postprocessing/ShaderPass.js'),
        import('three/examples/jsm/postprocessing/OutputPass.js'),
      ]);

      if (!isMounted) return;

      const { width, height } = getRenderSize();
      const pixelRatio = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
      const nextBloomComposer = new EffectComposer(renderer);
      nextBloomComposer.renderToScreen = false;
      nextBloomComposer.setPixelRatio(pixelRatio);
      nextBloomComposer.setSize(width, height);
      nextBloomComposer.addPass(new RenderPass(scene, camera));
      const nextBloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        NEON_BLOOM_SETTINGS.strengthBase + NEON_BLOOM_SETTINGS.strengthGlow,
        NEON_BLOOM_SETTINGS.radiusBase + NEON_BLOOM_SETTINGS.radiusGlow,
        NEON_BLOOM_SETTINGS.threshold
      );
      nextBloomComposer.addPass(nextBloomPass);

      const nextChandelierBloomComposer = new EffectComposer(renderer);
      nextChandelierBloomComposer.renderToScreen = false;
      nextChandelierBloomComposer.setPixelRatio(pixelRatio);
      nextChandelierBloomComposer.setSize(width, height);
      nextChandelierBloomComposer.addPass(new RenderPass(scene, camera));
      const nextChandelierBloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        CHANDELIER_BLOOM_SETTINGS.strength,
        CHANDELIER_BLOOM_SETTINGS.radius,
        CHANDELIER_BLOOM_SETTINGS.threshold
      );
      nextChandelierBloomComposer.addPass(nextChandelierBloomPass);

      const nextComposer = new EffectComposer(renderer);
      nextComposer.setPixelRatio(pixelRatio);
      nextComposer.setSize(width, height);
      nextComposer.addPass(new RenderPass(scene, camera));
      finalBloomMaterial = new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: nextBloomComposer.renderTarget2.texture },
          chandelierBloomTexture: {
            value: nextChandelierBloomComposer.renderTarget2.texture,
          },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D baseTexture;
          uniform sampler2D bloomTexture;
          uniform sampler2D chandelierBloomTexture;
          varying vec2 vUv;
          void main() {
            gl_FragColor =
              texture2D(baseTexture, vUv) +
              texture2D(bloomTexture, vUv) +
              texture2D(chandelierBloomTexture, vUv);
          }
        `,
      });
      const nextFinalBloomPass = new ShaderPass(
        finalBloomMaterial,
        'baseTexture'
      );
      nextComposer.addPass(nextFinalBloomPass);
      nextComposer.addPass(new OutputPass());

      composer = nextComposer;
      bloomComposer = nextBloomComposer;
      chandelierBloomComposer = nextChandelierBloomComposer;
      bloomPass = nextBloomPass;
      chandelierBloomPass = nextChandelierBloomPass;
      finalBloomPass = nextFinalBloomPass;
      requestRenderLoop();
    };

    void loadBloomComposer().catch(() => {
      // The gallery can render without bloom if the postprocessing chunk fails.
    });

    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(initialRenderSize.width, initialRenderSize.height);
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.inset = '0';
    cssRenderer.domElement.style.width = `${initialRenderSize.width}px`;
    cssRenderer.domElement.style.height = `${initialRenderSize.height}px`;
    cssRenderer.domElement.style.pointerEvents = 'none';
    cssHost.appendChild(cssRenderer.domElement);

    let cssNeedsRender = true;
    let cameraNeedsCssRender = true;
    const invalidateShadows = () => {
      renderer.shadowMap.needsUpdate = true;
    };
    const invalidateCssRender = () => {
      cssNeedsRender = true;
    };

    const textureAnisotropy = Math.min(
      renderer.capabilities.getMaxAnisotropy(),
      8
    );
    const loadTexture = (url: string, repeatX: number, repeatY: number) => {
      const texture = textureLoader.load(url, () => {
        if (isMounted) requestRenderLoop();
      });
      configureTexture(texture, repeatX, repeatY, textureAnisotropy);
      loadedTextures.push(texture);
      return texture;
    };

    const loadSingleSurfaceTexture = (url: string) => {
      const texture = textureLoader.load(url, () => {
        if (isMounted) requestRenderLoop();
      });
      configureSingleSurfaceTexture(texture, textureAnisotropy);
      loadedTextures.push(texture);
      return texture;
    };

    const loadBumpTexture = (url: string, repeatX: number, repeatY: number) => {
      const texture = textureLoader.load(url, () => {
        if (isMounted) requestRenderLoop();
      });
      configureTexture(texture, repeatX, repeatY, textureAnisotropy, false);
      loadedTextures.push(texture);
      return texture;
    };

    const sideWallTextureRepeat = {
      x: Math.max(1, hallLength / 12),
      y: wallDrawHeight / 6.4,
    };
    const endWallTextureRepeat = {
      x: Math.max(1, (layout.hallwayWidth + ceilingWallOverlap * 2) / 8),
      y: wallDrawHeight / 6.4,
    };
    const ceilingTextureRepeat = {
      x: Math.max(1, (layout.hallwayWidth + ceilingWallOverlap * 2) / 6.5),
      y: Math.max(1, hallLength / 11),
    };
    const estimatedHallwayMeters = isMobile ? 3.6 : isTablet ? 4.2 : 4.6;
    const sceneUnitsPerMeter = layout.hallwayWidth / estimatedHallwayMeters;
    const floorDrawWidth = layout.hallwayWidth + ceilingWallOverlap * 2;
    const carpetTextureSizeMeters = 0.5;
    const floorTextureRepeat = {
      x: Math.max(
        1,
        floorDrawWidth / sceneUnitsPerMeter / carpetTextureSizeMeters
      ),
      y: Math.max(
        1,
        hallLength / sceneUnitsPerMeter / carpetTextureSizeMeters
      ),
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
    const chandelierMetalNoise =
      createChandelierMetalNoiseTexture(textureAnisotropy);
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
      bumpScale: 0.003,
      color: 0xffffff,
      roughness: 0.92,
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
    const chandelierAgedGoldMaterial = new THREE.MeshBasicMaterial({
      color: 0xc89a45,
      map: chandelierMetalNoise,
    });
    const chandelierDarkGoldMaterial = new THREE.MeshBasicMaterial({
      color: 0x8f642b,
      map: chandelierMetalNoise,
    });
    const chandelierCableMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a3528,
    });
    const chandelierWarmGlassMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff0c5,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const chandelierCrystalMaterial = new THREE.MeshBasicMaterial({
      color: 0xf7fbff,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
    });
    const chandelierCrystalLiteMaterial = new THREE.MeshBasicMaterial({
      color: 0xf2f8ff,
      transparent: true,
      opacity: 0.48,
    });
    const chandelierCandleSleeveMaterial = new THREE.MeshBasicMaterial({
      color: 0xf6ecd2,
    });
    const chandelierBulbLitMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff7e2,
      toneMapped: false,
    });
    const chandelierFilamentMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd07a,
      toneMapped: false,
    });
    const chandelierFlameGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb759,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const chandelierSimpleFlameGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb759,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const chandelierBloomGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffc36f,
      transparent: true,
      opacity: CHANDELIER_BLOOM_SETTINGS.glowOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const plaqueMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb9822d,
      roughness: 0.34,
      metalness: 0.82,
      clearcoat: 0.22,
      clearcoatRoughness: 0.18,
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
      chandelierCrystalLiteMaterial,
      chandelierCandleSleeveMaterial,
      chandelierBulbLitMaterial,
      chandelierFilamentMaterial,
      chandelierFlameGlowMaterial,
      chandelierSimpleFlameGlowMaterial,
      chandelierBloomGlowMaterial,
      plaqueMaterial,
      plaqueTextMaterial,
    ];

    const environmentGeometries: THREE.BufferGeometry[] = [];
    const neonGeometries: THREE.BufferGeometry[] = [];
    const neonMaterials: THREE.Material[] = [];
    const neonLightRigs: NeonLightRig[] = [];
    const neonAnchors: THREE.Group[] = [];
    const neonMaterialBuckets: NeonMaterialBuckets = {
      frontBlue: [],
      frontPink: [],
      sideBlue: [],
      sidePink: [],
    };
    const wallSegments = Math.max(96, Math.min(420, groupCount * 10));
    const floorSegments = Math.max(96, Math.min(480, groupCount * 12));

    const leftWallGeometry = new THREE.PlaneGeometry(
      hallLength,
      wallDrawHeight,
      wallSegments,
      42
    );
    roughenPlane(leftWallGeometry, 0.009);
    environmentGeometries.push(leftWallGeometry);
    const leftWall = new THREE.Mesh(leftWallGeometry, sideWallMaterial);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-halfHallWidth, wallCenterY, hallCenterZ);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWallGeometry = new THREE.PlaneGeometry(
      hallLength,
      wallDrawHeight,
      wallSegments,
      42
    );
    roughenPlane(rightWallGeometry, 0.009);
    environmentGeometries.push(rightWallGeometry);
    const rightWall = new THREE.Mesh(rightWallGeometry, sideWallMaterial);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(halfHallWidth, wallCenterY, hallCenterZ);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    const endWallGeometry = new THREE.PlaneGeometry(
      layout.hallwayWidth + ceilingWallOverlap * 2,
      wallDrawHeight,
      48,
      42
    );
    roughenPlane(endWallGeometry, 0.008);
    environmentGeometries.push(endWallGeometry);
    const endWall = new THREE.Mesh(endWallGeometry, endWallMaterial);
    endWall.position.set(0, wallCenterY, hallEndZ);
    endWall.receiveShadow = true;
    scene.add(endWall);

    const startWallGeometry = new THREE.PlaneGeometry(
      layout.hallwayWidth + ceilingWallOverlap * 2,
      wallDrawHeight,
      48,
      42
    );
    roughenPlane(startWallGeometry, 0.008);
    environmentGeometries.push(startWallGeometry);
    const startWall = new THREE.Mesh(startWallGeometry, endWallMaterial);
    startWall.rotation.y = Math.PI;
    startWall.position.set(0, wallCenterY, hallStartZ);
    startWall.receiveShadow = true;
    scene.add(startWall);

    const floorGeometry = new THREE.PlaneGeometry(
      floorDrawWidth,
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
      layout.hallwayWidth + ceilingWallOverlap * 2,
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

    const startBaseboard = new THREE.Mesh(unitBox, baseboardMaterial);
    startBaseboard.scale.set(layout.hallwayWidth, 0.13, 0.18);
    startBaseboard.position.set(0, layout.floorY + 0.2, hallStartZ - 0.09);
    startBaseboard.castShadow = true;
    startBaseboard.receiveShadow = true;
    scene.add(startBaseboard);

    const startBaseboardCap = new THREE.Mesh(unitBox, baseboardMaterial);
    startBaseboardCap.scale.set(layout.hallwayWidth, 0.025, 0.055);
    startBaseboardCap.position.set(0, layout.floorY + 0.29, hallStartZ - 0.03);
    startBaseboardCap.castShadow = true;
    startBaseboardCap.receiveShadow = true;
    scene.add(startBaseboardCap);

    const createNeonAreaLight = (
      color: number,
      intensity: number,
      width: number,
      height: number,
      position: [number, number, number],
      roomFacing: boolean
    ) => {
      const light = new THREE.RectAreaLight(color, intensity, width, height);
      light.position.set(...position);
      if (roomFacing) {
        light.rotation.y = Math.PI;
      }
      light.userData.baseIntensity = intensity;
      light.castShadow = false;
      return light;
    };

    const createDoubleSidedNeonAreaLights = (
      color: number,
      intensity: number,
      width: number,
      height: number,
      position: [number, number, number]
    ) => [
      createNeonAreaLight(color, intensity, width, height, position, false),
      createNeonAreaLight(color, intensity, width, height, position, true),
    ];

    const createWallNeonSign = (
      neonSignTemplate: THREE.Object3D,
      wallZ: number,
      rotationY: number
    ) => {
      const anchor = new THREE.Group();
      anchor.rotation.y = rotationY;
      anchor.position.set(0, wallCenterY, wallZ);

      const sign = createBakedNeonSign(
        neonSignTemplate,
        neonMaterialBuckets,
        neonGeometries,
        neonMaterials
      );
      sign.position.z += NEON_SIGN_WALL_OFFSET;
      anchor.add(sign);

      const areaLightZ = GALLERY_LIGHTING.neon.areaLightZ;
      const blueLights = createDoubleSidedNeonAreaLights(
        GALLERY_LIGHTING.neon.blueColor,
        GALLERY_LIGHTING.neon.blueIntensity,
        GALLERY_LIGHTING.neon.blueAreaWidth,
        GALLERY_LIGHTING.neon.blueAreaHeight,
        [0, 1.28, areaLightZ]
      );
      const pinkLights = createDoubleSidedNeonAreaLights(
        GALLERY_LIGHTING.neon.pinkColor,
        GALLERY_LIGHTING.neon.pinkIntensity,
        GALLERY_LIGHTING.neon.pinkAreaWidth,
        GALLERY_LIGHTING.neon.pinkAreaHeight,
        [0.25, -0.62, areaLightZ]
      );
      anchor.add(...blueLights, ...pinkLights);
      neonLightRigs.push({ blue: blueLights, pink: pinkLights });
      scene.add(anchor);
      neonAnchors.push(anchor);
    };

    const loadNeonSigns = async () => {
      try {
        const { GLTFLoader } = await import(
          'three/examples/jsm/loaders/GLTFLoader.js'
        );
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(neonSignGlbUrl);

        if (!isMounted) {
          return;
        }

        createWallNeonSign(gltf.scene, hallEndZ, 0);
        createWallNeonSign(gltf.scene, hallStartZ, Math.PI);

        const sourceMaterials = new Set<THREE.Material>();
        gltf.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) {
            return;
          }

          const objectMaterials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          objectMaterials.forEach((material) => sourceMaterials.add(material));
        });
        sourceMaterials.forEach((material) => material.dispose());

        requestRenderLoop();
      } catch {
        // The gallery remains usable if the decorative sign asset fails to load.
      }
    };

    void loadNeonSigns();

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

    const addCable = (parent: THREE.Object3D, topY = 3.28, bottomY = 1.66) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, topY, 0),
        new THREE.Vector3(
          0.01,
          THREE.MathUtils.lerp(topY, bottomY, 0.32),
          -0.008
        ),
        new THREE.Vector3(
          -0.012,
          THREE.MathUtils.lerp(topY, bottomY, 0.68),
          0.006
        ),
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
        new THREE.SphereGeometry(
          0.72,
          96,
          24,
          0,
          Math.PI * 2,
          0,
          Math.PI * 0.42
        ),
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
        strand.position.set(
          Math.cos(angle) * radius,
          0.73,
          Math.sin(angle) * radius
        );
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
    const createFullChandelierInstance = (
      source: THREE.Group,
      index: number
    ) => {
      const chandelier =
        index === 0 ? source : (source.clone(true) as THREE.Group);
      chandelier.name = `${CHANDELIER_LOD_NAME}-detail-${index}`;
      chandelier.visible = false;
      chandelier.scale.setScalar(chandelierScale);
      chandelierRoot.add(chandelier);
      return chandelier;
    };
    const fullChandeliers = [
      createFullChandelierInstance(fullChandelier, 0),
      createFullChandelierInstance(fullChandelier, 1),
    ];
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
    const simpleChandelierCanopyGeometry = new THREE.CylinderGeometry(
      0.42,
      0.52,
      0.1,
      24
    );
    const simpleChandelierCanopyRingGeometry = new THREE.TorusGeometry(
      0.79,
      0.032,
      8,
      42
    );
    const simpleChandelierStemGeometry = new THREE.CylinderGeometry(
      0.035,
      0.035,
      1.7,
      12
    );
    const simpleChandelierCenterGeometry = new THREE.SphereGeometry(
      0.22,
      20,
      12
    );
    const simpleChandelierBowlGeometry = new THREE.SphereGeometry(
      0.72,
      32,
      10,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.42
    );
    const simpleChandelierRingGeometry = new THREE.TorusGeometry(
      0.74,
      0.044,
      10,
      56
    );
    const simpleChandelierOuterRingGeometry = new THREE.TorusGeometry(
      0.92,
      0.03,
      8,
      56
    );
    const simpleChandelierInnerRingGeometry = new THREE.TorusGeometry(
      0.42,
      0.017,
      8,
      42
    );
    const simpleChandelierBulbGeometry = new THREE.SphereGeometry(
      0.105,
      14,
      10
    );
    const simpleChandelierGlowGeometry = new THREE.SphereGeometry(0.16, 12, 8);
    const simpleChandelierCrystalGeometry = new THREE.OctahedronGeometry(
      0.13,
      0
    );
    const simpleChandelierPrismGeometry = new THREE.CylinderGeometry(
      0.05,
      0.062,
      0.54,
      6,
      1,
      false
    );
    const simpleChandelierBeadGeometry = new THREE.SphereGeometry(0.043, 8, 6);
    const simpleChandelierArmGeometry = new THREE.CylinderGeometry(
      0.018,
      0.018,
      1.62,
      8
    );
    const simpleChandelierUpperArmGeometry = new THREE.CylinderGeometry(
      0.014,
      0.014,
      0.92,
      8
    );
    [
      simpleChandelierCanopyGeometry,
      simpleChandelierCanopyRingGeometry,
      simpleChandelierStemGeometry,
      simpleChandelierCenterGeometry,
      simpleChandelierBowlGeometry,
      simpleChandelierRingGeometry,
      simpleChandelierOuterRingGeometry,
      simpleChandelierInnerRingGeometry,
      simpleChandelierBulbGeometry,
      simpleChandelierGlowGeometry,
      simpleChandelierCrystalGeometry,
      simpleChandelierPrismGeometry,
      simpleChandelierBeadGeometry,
      simpleChandelierArmGeometry,
      simpleChandelierUpperArmGeometry,
    ].forEach((geometry) => chandelierGeometries.add(geometry));

    const createSimpleChandelierMesh = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      count: number,
      bloomOnly = false
    ) => {
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.frustumCulled = true;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      if (bloomOnly) {
        mesh.layers.enable(CHANDELIER_BLOOM_SCENE_LAYER);
        mesh.visible = false;
      }
      chandelierRoot.add(mesh);
      return mesh;
    };

    const simpleChandeliers = {
      canopy: createSimpleChandelierMesh(
        simpleChandelierCanopyGeometry,
        chandelierDarkGoldMaterial,
        chandelierCount
      ),
      canopyRing: createSimpleChandelierMesh(
        simpleChandelierCanopyRingGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount
      ),
      stem: createSimpleChandelierMesh(
        simpleChandelierStemGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount
      ),
      center: createSimpleChandelierMesh(
        simpleChandelierCenterGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount
      ),
      bowl: createSimpleChandelierMesh(
        simpleChandelierBowlGeometry,
        chandelierWarmGlassMaterial,
        chandelierCount
      ),
      ring: createSimpleChandelierMesh(
        simpleChandelierRingGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount
      ),
      outerRing: createSimpleChandelierMesh(
        simpleChandelierOuterRingGeometry,
        chandelierDarkGoldMaterial,
        chandelierCount
      ),
      innerRing: createSimpleChandelierMesh(
        simpleChandelierInnerRingGeometry,
        chandelierDarkGoldMaterial,
        chandelierCount
      ),
      bulbs: createSimpleChandelierMesh(
        simpleChandelierBulbGeometry,
        chandelierBulbLitMaterial,
        chandelierCount * CHANDELIER_LOD_LOWER_ARM_COUNT
      ),
      glow: createSimpleChandelierMesh(
        simpleChandelierGlowGeometry,
        chandelierSimpleFlameGlowMaterial,
        chandelierCount * CHANDELIER_LOD_LOWER_ARM_COUNT
      ),
      upperBulbs: createSimpleChandelierMesh(
        simpleChandelierBulbGeometry,
        chandelierBulbLitMaterial,
        chandelierCount * CHANDELIER_LOD_UPPER_ARM_COUNT
      ),
      upperGlow: createSimpleChandelierMesh(
        simpleChandelierGlowGeometry,
        chandelierSimpleFlameGlowMaterial,
        chandelierCount * CHANDELIER_LOD_UPPER_ARM_COUNT
      ),
      crystals: createSimpleChandelierMesh(
        simpleChandelierCrystalGeometry,
        chandelierCrystalLiteMaterial,
        chandelierCount * CHANDELIER_LOD_CRYSTAL_COUNT
      ),
      prisms: createSimpleChandelierMesh(
        simpleChandelierPrismGeometry,
        chandelierCrystalLiteMaterial,
        chandelierCount * CHANDELIER_LOD_CRYSTAL_COUNT
      ),
      beads: createSimpleChandelierMesh(
        simpleChandelierBeadGeometry,
        chandelierCrystalLiteMaterial,
        chandelierCount * CHANDELIER_LOD_BEAD_COUNT
      ),
      arms: createSimpleChandelierMesh(
        simpleChandelierArmGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount * CHANDELIER_LOD_LOWER_ARM_COUNT
      ),
      upperArms: createSimpleChandelierMesh(
        simpleChandelierUpperArmGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount * CHANDELIER_LOD_UPPER_ARM_COUNT
      ),
    };
    const bloomSimpleChandeliers = {
      canopy: createSimpleChandelierMesh(
        simpleChandelierCanopyGeometry,
        chandelierDarkGoldMaterial,
        chandelierCount,
        true
      ),
      canopyRing: createSimpleChandelierMesh(
        simpleChandelierCanopyRingGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount,
        true
      ),
      stem: createSimpleChandelierMesh(
        simpleChandelierStemGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount,
        true
      ),
      center: createSimpleChandelierMesh(
        simpleChandelierCenterGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount,
        true
      ),
      bowl: createSimpleChandelierMesh(
        simpleChandelierBowlGeometry,
        chandelierWarmGlassMaterial,
        chandelierCount,
        true
      ),
      ring: createSimpleChandelierMesh(
        simpleChandelierRingGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount,
        true
      ),
      outerRing: createSimpleChandelierMesh(
        simpleChandelierOuterRingGeometry,
        chandelierDarkGoldMaterial,
        chandelierCount,
        true
      ),
      innerRing: createSimpleChandelierMesh(
        simpleChandelierInnerRingGeometry,
        chandelierDarkGoldMaterial,
        chandelierCount,
        true
      ),
      bulbs: createSimpleChandelierMesh(
        simpleChandelierBulbGeometry,
        chandelierBulbLitMaterial,
        chandelierCount * CHANDELIER_LOD_LOWER_ARM_COUNT,
        true
      ),
      glow: createSimpleChandelierMesh(
        simpleChandelierGlowGeometry,
        chandelierBloomGlowMaterial,
        chandelierCount * CHANDELIER_LOD_LOWER_ARM_COUNT,
        true
      ),
      upperBulbs: createSimpleChandelierMesh(
        simpleChandelierBulbGeometry,
        chandelierBulbLitMaterial,
        chandelierCount * CHANDELIER_LOD_UPPER_ARM_COUNT,
        true
      ),
      upperGlow: createSimpleChandelierMesh(
        simpleChandelierGlowGeometry,
        chandelierBloomGlowMaterial,
        chandelierCount * CHANDELIER_LOD_UPPER_ARM_COUNT,
        true
      ),
      crystals: createSimpleChandelierMesh(
        simpleChandelierCrystalGeometry,
        chandelierCrystalLiteMaterial,
        chandelierCount * CHANDELIER_LOD_CRYSTAL_COUNT,
        true
      ),
      prisms: createSimpleChandelierMesh(
        simpleChandelierPrismGeometry,
        chandelierCrystalLiteMaterial,
        chandelierCount * CHANDELIER_LOD_CRYSTAL_COUNT,
        true
      ),
      beads: createSimpleChandelierMesh(
        simpleChandelierBeadGeometry,
        chandelierCrystalLiteMaterial,
        chandelierCount * CHANDELIER_LOD_BEAD_COUNT,
        true
      ),
      arms: createSimpleChandelierMesh(
        simpleChandelierArmGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount * CHANDELIER_LOD_LOWER_ARM_COUNT,
        true
      ),
      upperArms: createSimpleChandelierMesh(
        simpleChandelierUpperArmGeometry,
        chandelierAgedGoldMaterial,
        chandelierCount * CHANDELIER_LOD_UPPER_ARM_COUNT,
        true
      ),
    };
    const simpleChandelierMeshes = Object.values(simpleChandeliers);
    const bloomSimpleChandelierMeshes = [
      bloomSimpleChandeliers.glow,
      bloomSimpleChandeliers.upperGlow,
    ];
    const allSimpleChandelierMeshes = [
      ...simpleChandelierMeshes,
      ...bloomSimpleChandelierMeshes,
    ];
    let simpleChandelierDetailKey = '';

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

    const setSimpleChandelierInstance = (
      mesh: THREE.InstancedMesh,
      instanceIndex: number,
      position: THREE.Vector3,
      rotation: THREE.Euler,
      scale: THREE.Vector3,
      visible: boolean
    ) => {
      setSimpleChandelierMatrix(
        mesh,
        instanceIndex,
        position,
        rotation,
        visible ? scale : PLACEHOLDER_ZERO_SCALE
      );
    };

    const setBloomChandelierMeshesVisible = (visible: boolean) => {
      bloomSimpleChandelierMeshes.forEach((mesh) => {
        mesh.visible = visible;
      });
    };
    const setBaseSimpleChandelierMeshesVisible = (visible: boolean) => {
      simpleChandelierMeshes.forEach((mesh) => {
        mesh.visible = visible;
      });
    };

    const hideFullChandeliers = () => {
      fullChandeliers.forEach((chandelier) => {
        chandelier.visible = false;
      });
    };

    const populateSimpleChandeliers = () => {
      chandelierAnchors.forEach((anchor) => {
        const rootY = anchor.position.y;
        const rootRotation = anchor.rotationY;
        const rootScale = chandelierScale;
        const rootPosition = anchor.position;
        const showLodInstance = true;
        const rootEuler = new THREE.Euler(0, rootRotation, 0);
        const ringEuler = new THREE.Euler(Math.PI / 2, rootRotation, 0);

        const setLodPair = (
          baseMesh: THREE.InstancedMesh,
          bloomMesh: THREE.InstancedMesh,
          instanceIndex: number,
          position: THREE.Vector3,
          rotation: THREE.Euler,
          scale: THREE.Vector3,
          bloomScale = scale
        ) => {
          setSimpleChandelierInstance(
            baseMesh,
            instanceIndex,
            position,
            rotation,
            scale,
            showLodInstance
          );
          setSimpleChandelierInstance(
            bloomMesh,
            instanceIndex,
            position,
            rotation,
            bloomScale,
            true
          );
        };

        setLodPair(
          simpleChandeliers.canopy,
          bloomSimpleChandeliers.canopy,
          anchor.index,
          new THREE.Vector3(
            rootPosition.x,
            rootY + 3.6 * rootScale,
            rootPosition.z
          ),
          rootEuler,
          new THREE.Vector3(rootScale, rootScale, rootScale)
        );
        setLodPair(
          simpleChandeliers.canopyRing,
          bloomSimpleChandeliers.canopyRing,
          anchor.index,
          new THREE.Vector3(
            rootPosition.x,
            rootY + 3.55 * rootScale,
            rootPosition.z
          ),
          ringEuler,
          new THREE.Vector3(rootScale, rootScale, rootScale)
        );
        setLodPair(
          simpleChandeliers.stem,
          bloomSimpleChandeliers.stem,
          anchor.index,
          new THREE.Vector3(
            rootPosition.x,
            rootY + 2.42 * rootScale,
            rootPosition.z
          ),
          rootEuler,
          new THREE.Vector3(rootScale, rootScale, rootScale)
        );
        setLodPair(
          simpleChandeliers.center,
          bloomSimpleChandeliers.center,
          anchor.index,
          new THREE.Vector3(
            rootPosition.x,
            rootY + 1.22 * rootScale,
            rootPosition.z
          ),
          rootEuler,
          new THREE.Vector3(rootScale, rootScale * 0.72, rootScale)
        );
        setLodPair(
          simpleChandeliers.bowl,
          bloomSimpleChandeliers.bowl,
          anchor.index,
          new THREE.Vector3(
            rootPosition.x,
            rootY + 0.98 * rootScale,
            rootPosition.z
          ),
          new THREE.Euler(Math.PI, rootRotation, 0),
          new THREE.Vector3(rootScale, rootScale * 0.28, rootScale)
        );
        setLodPair(
          simpleChandeliers.ring,
          bloomSimpleChandeliers.ring,
          anchor.index,
          new THREE.Vector3(
            rootPosition.x,
            rootY + 0.83 * rootScale,
            rootPosition.z
          ),
          ringEuler,
          new THREE.Vector3(rootScale, rootScale, rootScale)
        );
        setLodPair(
          simpleChandeliers.outerRing,
          bloomSimpleChandeliers.outerRing,
          anchor.index,
          new THREE.Vector3(
            rootPosition.x,
            rootY + 0.66 * rootScale,
            rootPosition.z
          ),
          ringEuler,
          new THREE.Vector3(rootScale, rootScale, rootScale)
        );
        setLodPair(
          simpleChandeliers.innerRing,
          bloomSimpleChandeliers.innerRing,
          anchor.index,
          new THREE.Vector3(
            rootPosition.x,
            rootY + 0.95 * rootScale,
            rootPosition.z
          ),
          ringEuler,
          new THREE.Vector3(rootScale, rootScale, rootScale)
        );

        for (
          let bulbIndex = 0;
          bulbIndex < CHANDELIER_LOD_LOWER_ARM_COUNT;
          bulbIndex++
        ) {
          const angle =
            rootRotation +
            (bulbIndex / CHANDELIER_LOD_LOWER_ARM_COUNT) * Math.PI * 2;
          const localRadius = bulbIndex % 2 === 0 ? 2.14 : 1.88;
          const localY = bulbIndex % 2 === 0 ? 1.13 : 1.02;
          const radius = localRadius * rootScale;
          const armMidRadius = localRadius * 0.55 * rootScale;
          const instanceIndex =
            anchor.index * CHANDELIER_LOD_LOWER_ARM_COUNT + bulbIndex;
          const bulbPosition = new THREE.Vector3(
            rootPosition.x + Math.cos(angle) * radius,
            rootY + (localY + 0.89) * rootScale,
            rootPosition.z + Math.sin(angle) * radius
          );

          setLodPair(
            simpleChandeliers.arms,
            bloomSimpleChandeliers.arms,
            instanceIndex,
            new THREE.Vector3(
              rootPosition.x + Math.cos(angle) * armMidRadius,
              rootY + (localY + 0.18) * rootScale,
              rootPosition.z + Math.sin(angle) * armMidRadius
            ),
            new THREE.Euler(Math.PI / 2, 0, Math.PI / 2 - angle),
            new THREE.Vector3(rootScale, rootScale, rootScale)
          );
          setLodPair(
            simpleChandeliers.bulbs,
            bloomSimpleChandeliers.bulbs,
            instanceIndex,
            bulbPosition,
            rootEuler,
            new THREE.Vector3(rootScale, rootScale * 1.3, rootScale)
          );
          setLodPair(
            simpleChandeliers.glow,
            bloomSimpleChandeliers.glow,
            instanceIndex,
            bulbPosition,
            rootEuler,
            new THREE.Vector3(rootScale, rootScale * 1.45, rootScale),
            new THREE.Vector3(
              rootScale * CHANDELIER_BLOOM_SETTINGS.glowScale,
              rootScale * 1.45 * CHANDELIER_BLOOM_SETTINGS.glowScale,
              rootScale * CHANDELIER_BLOOM_SETTINGS.glowScale
            )
          );
        }

        for (
          let bulbIndex = 0;
          bulbIndex < CHANDELIER_LOD_UPPER_ARM_COUNT;
          bulbIndex++
        ) {
          const angle =
            rootRotation +
            (bulbIndex / CHANDELIER_LOD_UPPER_ARM_COUNT) * Math.PI * 2 +
            Math.PI / CHANDELIER_LOD_UPPER_ARM_COUNT;
          const radius = 1.18 * rootScale;
          const armMidRadius = 0.74 * rootScale;
          const instanceIndex =
            anchor.index * CHANDELIER_LOD_UPPER_ARM_COUNT + bulbIndex;
          const bulbPosition = new THREE.Vector3(
            rootPosition.x + Math.cos(angle) * radius,
            rootY + 2.6 * rootScale,
            rootPosition.z + Math.sin(angle) * radius
          );

          setLodPair(
            simpleChandeliers.upperArms,
            bloomSimpleChandeliers.upperArms,
            instanceIndex,
            new THREE.Vector3(
              rootPosition.x + Math.cos(angle) * armMidRadius,
              rootY + 2.24 * rootScale,
              rootPosition.z + Math.sin(angle) * armMidRadius
            ),
            new THREE.Euler(Math.PI / 2, 0, Math.PI / 2 - angle),
            new THREE.Vector3(rootScale, rootScale, rootScale)
          );
          setLodPair(
            simpleChandeliers.upperBulbs,
            bloomSimpleChandeliers.upperBulbs,
            instanceIndex,
            bulbPosition,
            rootEuler,
            new THREE.Vector3(rootScale * 0.82, rootScale, rootScale * 0.82)
          );
          setLodPair(
            simpleChandeliers.upperGlow,
            bloomSimpleChandeliers.upperGlow,
            instanceIndex,
            bulbPosition,
            rootEuler,
            new THREE.Vector3(
              rootScale * 0.78,
              rootScale * 1.22,
              rootScale * 0.78
            ),
            new THREE.Vector3(
              rootScale * CHANDELIER_BLOOM_SETTINGS.glowScale * 0.78,
              rootScale * CHANDELIER_BLOOM_SETTINGS.glowScale * 1.22,
              rootScale * CHANDELIER_BLOOM_SETTINGS.glowScale * 0.78
            )
          );
        }

        for (
          let beadIndex = 0;
          beadIndex < CHANDELIER_LOD_BEAD_COUNT;
          beadIndex++
        ) {
          const angle =
            rootRotation +
            (beadIndex / CHANDELIER_LOD_BEAD_COUNT) * Math.PI * 2;
          const radius = 0.94 * rootScale;
          const instanceIndex =
            anchor.index * CHANDELIER_LOD_BEAD_COUNT + beadIndex;

          setLodPair(
            simpleChandeliers.beads,
            bloomSimpleChandeliers.beads,
            instanceIndex,
            new THREE.Vector3(
              rootPosition.x + Math.cos(angle) * radius,
              rootY + (0.61 + Math.sin(beadIndex * 0.5) * 0.012) * rootScale,
              rootPosition.z + Math.sin(angle) * radius
            ),
            rootEuler,
            new THREE.Vector3(rootScale, rootScale, rootScale)
          );
        }

        for (
          let crystalIndex = 0;
          crystalIndex < CHANDELIER_LOD_CRYSTAL_COUNT;
          crystalIndex++
        ) {
          const angle =
            rootRotation +
            (crystalIndex / CHANDELIER_LOD_CRYSTAL_COUNT) * Math.PI * 2;
          const radius = (crystalIndex % 2 === 0 ? 0.83 : 0.68) * rootScale;
          const instanceIndex =
            anchor.index * CHANDELIER_LOD_CRYSTAL_COUNT + crystalIndex;
          const crystalPosition = new THREE.Vector3(
            rootPosition.x + Math.cos(angle) * radius,
            rootY + (0.08 - (crystalIndex % 3) * 0.1) * rootScale,
            rootPosition.z + Math.sin(angle) * radius
          );
          const crystalRotation = new THREE.Euler(0.25, -angle, 0.08);
          const crystalScale = new THREE.Vector3(
            rootScale,
            rootScale * 1.45,
            rootScale
          );
          const showPearCrystal = crystalIndex % 3 !== 0;

          setSimpleChandelierInstance(
            simpleChandeliers.crystals,
            instanceIndex,
            crystalPosition,
            crystalRotation,
            crystalScale,
            showLodInstance && showPearCrystal
          );
          setSimpleChandelierInstance(
            bloomSimpleChandeliers.crystals,
            instanceIndex,
            crystalPosition,
            crystalRotation,
            crystalScale,
            showPearCrystal
          );
          setSimpleChandelierInstance(
            simpleChandeliers.prisms,
            instanceIndex,
            crystalPosition,
            crystalRotation,
            crystalScale,
            showLodInstance && !showPearCrystal
          );
          setSimpleChandelierInstance(
            bloomSimpleChandeliers.prisms,
            instanceIndex,
            crystalPosition,
            crystalRotation,
            crystalScale,
            !showPearCrystal
          );
        }
      });

      allSimpleChandelierMeshes.forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      });
    };

    const updateChandelierLod = () => {
      if (simpleChandelierDetailKey === 'single-silhouette') return;

      simpleChandelierDetailKey = 'single-silhouette';
      hideFullChandeliers();
      populateSimpleChandeliers();
      invalidateShadows();
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

    const createCameraPose = (): CameraPose => ({
      position: new THREE.Vector3(),
      target: new THREE.Vector3(),
    });

    const getCameraPose = (
      groupIndex: number,
      horizontalLookOffset = 0,
      verticalLookOffset = 0,
      targetPose = createCameraPose()
    ): CameraPose => {
      const side = getGroupSide(groupIndex);
      const groupZ = getGroupZ(groupIndex);
      const wallInset = 0.16;

      targetPose.position.set(0, layout.cameraY, groupZ);
      targetPose.target.set(
        side === 'left'
          ? -halfHallWidth + wallInset
          : halfHallWidth - wallInset,
        layout.frameY - 0.02 + verticalLookOffset,
        groupZ + horizontalLookOffset
      );

      return targetPose;
    };

    const applyCameraPose = (pose: CameraPose) => {
      camera.position.copy(pose.position);
      camera.lookAt(pose.target);
    };

    const transformPointScratch = new THREE.Vector3();
    const transformLocalPoint = (
      placement: FramePlacement,
      x: number,
      y: number,
      z: number,
      target = transformPointScratch
    ) => {
      target.set(x, y, z);
      target.applyAxisAngle(Y_AXIS, placement.rotationY);
      return target.set(
        placement.x + target.x,
        placement.y + target.y,
        placement.z + target.z
      );
    };
    const renderPose = createCameraPose();
    const transitionFromPose = createCameraPose();
    const transitionToPose = createCameraPose();
    const transitionResultPose = createCameraPose();
    const transitionFromDirection = new THREE.Vector3();
    const transitionToDirection = new THREE.Vector3();
    const transitionHallwayDirection = new THREE.Vector3();
    const transitionDirection = new THREE.Vector3();
    const transitionPoseResult = {
      pose: transitionResultPose,
      cameraProgress: 0,
      elapsed: 0,
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
      configureGallerySpotlightShadow(light, isMobile);
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
      let didChange = false;

      neededGroups.forEach((groupIndex) => {
        if (activeCeilingSpotlights.has(groupIndex)) return;

        activeCeilingSpotlights.set(
          groupIndex,
          createGroupCeilingSpotlight(groupIndex)
        );
        didChange = true;
      });

      activeCeilingSpotlights.forEach((light, groupIndex) => {
        if (neededGroups.has(groupIndex)) return;

        removeGroupCeilingSpotlight(light);
        activeCeilingSpotlights.delete(groupIndex);
        didChange = true;
      });

      if (didChange) {
        invalidateShadows();
      }
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
      top: new THREE.InstancedMesh(
        unitBox,
        placeholderFrameMaterial,
        urls.length
      ),
      bottom: new THREE.InstancedMesh(
        unitBox,
        placeholderFrameMaterial,
        urls.length
      ),
      left: new THREE.InstancedMesh(
        unitBox,
        placeholderFrameMaterial,
        urls.length
      ),
      right: new THREE.InstancedMesh(
        unitBox,
        placeholderFrameMaterial,
        urls.length
      ),
    };
    const placeholderPlaques = {
      body: new THREE.InstancedMesh(unitBox, plaqueMaterial, urls.length),
      text: new THREE.InstancedMesh(unitPlane, plaqueTextMaterial, urls.length),
    };

    Object.values(placeholderRails).forEach((mesh) => {
      mesh.frustumCulled = true;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      scene.add(mesh);
    });
    placeholderPlaques.body.frustumCulled = true;
    placeholderPlaques.body.castShadow = false;
    placeholderPlaques.body.receiveShadow = true;
    scene.add(placeholderPlaques.body);
    placeholderPlaques.text.frustumCulled = true;
    placeholderPlaques.text.castShadow = false;
    placeholderPlaques.text.receiveShadow = false;
    scene.add(placeholderPlaques.text);

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
      const plaqueWidth = Math.min(0.86, layout.frameOuterWidth * 0.34);
      const plaqueHeight = 0.18;
      const plaqueY = halfOuterHeight + 0.34;

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
          placeholderPlaques.body.setMatrixAt(index, placeholderZeroMatrix);
          placeholderPlaques.text.setMatrixAt(index, placeholderZeroMatrix);
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
        setPlaceholderBoxMatrix(
          placeholderPlaques.body,
          index,
          placement,
          0,
          plaqueY,
          0.02,
          plaqueWidth,
          plaqueHeight,
          0.035
        );
        setPlaceholderBoxMatrix(
          placeholderPlaques.text,
          index,
          placement,
          0,
          plaqueY,
          0.041,
          plaqueWidth * 0.76,
          plaqueHeight * 0.54,
          1
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
      Object.values(placeholderPlaques).forEach((mesh) => {
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
      element.style.pointerEvents = 'none';
      return element;
    };

    const createMountedEmbedHtml = (url: string) => `
      <div class="${sceneClassNames.embedCrop}">
        <div class="${sceneClassNames.embedContent}">
          ${createInstagramEmbedHtml(url)}
        </div>
      </div>
    `;

    const isCruiseDestinationHidden = (
      record: FrameRecord,
      now: number | null
    ) => {
      if (!cameraTransition || cameraTransition.mode !== 'cruise') {
        return false;
      }

      const groupIndex = getFramePlacement(record.index).groupIndex;
      if (groupIndex !== cameraTransition.toGroupIndex) return false;

      const motionElapsed =
        now === null
          ? 0
          : clamp(
              now - cameraTransition.startedAt - PAINTING_LIGHT_OFF_MS,
              0,
              cameraTransition.duration
            );
      const finalTurnStart = Math.max(
        0,
        cameraTransition.duration - cameraTransition.turnDuration
      );

      return motionElapsed < finalTurnStart;
    };

    const updateEmbedRecordVisibility = (
      record: FrameRecord,
      now: number | null
    ) => {
      const isVisible =
        record.embedMounted && !isCruiseDestinationHidden(record, now);
      record.element.style.opacity = isVisible ? '1' : '0';
      record.element.style.pointerEvents = isVisible ? 'auto' : 'none';
    };

    const updateEmbedVisibility = (now: number | null) => {
      activeFrames.forEach((record) => updateEmbedRecordVisibility(record, now));
    };

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
              updateEmbedRecordVisibility(record, null);
              return;
            }

            record.element.replaceChildren(...stagedElement.childNodes);
            stagedElement.remove();
            record.iframeObserver?.disconnect();
            record.iframeObserver = watchInstagramIframes(
              record.element,
              record.index
            );
            record.embedMounted = true;
            updateEmbedRecordVisibility(
              record,
              cameraTransition ? performance.now() : null
            );
            invalidateCssRender();
            requestRenderLoop();
          })
          .catch(() => {
            record.embedRequested = false;
            record.element.innerHTML = '';
            updateEmbedRecordVisibility(record, null);
            invalidateCssRender();
            requestRenderLoop();
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
      updateEmbedRecordVisibility(record, null);
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
      invalidateCssRender();
    };

    const handleCardScaleChange = () => {
      activeFrames.forEach(updateCardTransform);
      requestRenderLoop();
    };

    const createFrameRecord = (index: number): FrameRecord => {
      const placement = getFramePlacement(index);
      const { group, paintingSpotlight } = createFrameGroup({
        index,
        x: 0,
        isMobile,
        layout,
        materials: {
          frame: [walnutMaterial, goldMaterial, ebonyMaterial],
          backing: backingMaterial,
          placeholderArt:
            placeholderArtMaterials[index % placeholderArtMaterials.length],
          plaque: plaqueMaterial,
          plaqueText: plaqueTextMaterial,
        },
        railGeometries: sharedFrameRailGeometries,
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
        paintingSpotlight,
        embedMounted: false,
        embedRequested: false,
        lastTouched: performance.now(),
      };

      updateCardTransform(record);

      return record;
    };

    const disposeFrameRecord = (record: FrameRecord) => {
      record.group.traverse((object) => {
        if (object instanceof THREE.SpotLight) {
          object.shadow.dispose();
          return;
        }

        if (!(object instanceof THREE.Mesh)) return;
        if (object.geometry === unitBox) return;
        if (object.geometry === unitPlane) return;
        if (sharedFrameRailGeometrySet.has(object.geometry)) return;
        object.geometry.dispose();
      });
      record.element.remove();
    };

    const destroyFrameRecord = (record: FrameRecord) => {
      unmountEmbed(record);
      scene.remove(record.group);
      cssScene.remove(record.cssObject);
      invalidateCssRender();
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
      let didFrameSetChange = false;

      activeFrames.forEach((record, index) => {
        if (index < activeStart || index > activeEnd) {
          destroyFrameRecord(record);
          activeFrames.delete(index);
          didFrameSetChange = true;
        }
      });

      for (let index = activeStart; index <= activeEnd; index++) {
        if (!activeFrames.has(index)) {
          activeFrames.set(index, createFrameRecord(index));
          didFrameSetChange = true;
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

      if (didFrameSetChange) {
        invalidateShadows();
        invalidateCssRender();
      }
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
      let didFrameSetChange = false;

      activeFrames.forEach((record, index) => {
        if (index < activeStart || index > activeEnd) {
          destroyFrameRecord(record);
          activeFrames.delete(index);
          didFrameSetChange = true;
        }
      });

      for (let index = activeStart; index <= activeEnd; index++) {
        if (!activeFrames.has(index)) {
          activeFrames.set(index, createFrameRecord(index));
          didFrameSetChange = true;
        }
      }

      activeFrames.forEach((record, index) => {
        if (index >= embedStart && index <= embedEnd) {
          mountEmbed(record, true);
        }
      });

      if (didFrameSetChange) {
        invalidateShadows();
        invalidateCssRender();
      }
    };

    let lastRenderWidth = initialRenderSize.width;
    let lastRenderHeight = initialRenderSize.height;
    let lastRenderPixelRatio = initialPixelRatio;
    let resizeRaf = 0;

    const applyResize = (force = false) => {
      const { width, height } = getRenderSize();
      const pixelRatio = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);

      if (
        !force &&
        width === lastRenderWidth &&
        height === lastRenderHeight &&
        pixelRatio === lastRenderPixelRatio
      ) {
        return;
      }

      lastRenderWidth = width;
      lastRenderHeight = height;
      lastRenderPixelRatio = pixelRatio;
      camera.aspect = width / height;
      camera.fov = layout.cameraFov;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, true);
      if (composer) {
        composer.setPixelRatio(pixelRatio);
        composer.setSize(width, height);
      }
      if (bloomComposer) {
        bloomComposer.setPixelRatio(pixelRatio);
        bloomComposer.setSize(width, height);
      }
      if (chandelierBloomComposer) {
        chandelierBloomComposer.setPixelRatio(pixelRatio);
        chandelierBloomComposer.setSize(width, height);
      }
      bloomPass?.resolution.set(width, height);
      chandelierBloomPass?.resolution.set(width, height);
      cssRenderer.setSize(width, height);
      renderer.domElement.style.width = `${width}px`;
      renderer.domElement.style.height = `${height}px`;
      cssRenderer.domElement.style.width = `${width}px`;
      cssRenderer.domElement.style.height = `${height}px`;
      invalidateShadows();
      invalidateCssRender();
      cameraNeedsCssRender = true;
      requestRenderLoop();
    };

    const resize = () => {
      if (resizeRaf) return;

      resizeRaf = window.requestAnimationFrame(() => {
        resizeRaf = 0;
        applyResize();
      });
    };

    const firstButton = firstButtonRef.current;
    const previousButton = previousButtonRef.current;
    const nextButton = nextButtonRef.current;
    const lastButton = lastButtonRef.current;

    const goToGroup = (
      groupIndex: number,
      requestedMode: CameraTransitionMode = 'step'
    ) => {
      if (cameraTransition) return;

      const nextGroupIndex = clamp(groupIndex, 0, maxGroupIndex);
      if (nextGroupIndex === targetGroupIndex) return;

      const fromGroupIndex = targetGroupIndex;
      const direction = nextGroupIndex > targetGroupIndex ? 1 : -1;
      const groupDistance = Math.abs(nextGroupIndex - fromGroupIndex);
      const mode =
        requestedMode === 'cruise' && groupDistance > 1 ? 'cruise' : 'step';
      const travelDistance = Math.abs(
        getGroupZ(nextGroupIndex) - getGroupZ(fromGroupIndex)
      );
      const baseTurnDuration =
        layout.transitionDuration * LONG_JUMP_TURN_DURATION_RATIO;
      const maxTurnTravelDistance =
        travelDistance * LONG_JUMP_TURN_TRAVEL_MAX_RATIO;
      const idealTurnTravelDistance =
        (LONG_JUMP_CRUISE_SPEED_UNITS_PER_SECOND *
          (baseTurnDuration / 1000)) /
        2;
      const turnTravelDistance =
        mode === 'cruise'
          ? Math.min(maxTurnTravelDistance, idealTurnTravelDistance)
          : 0;
      const turnDuration = mode === 'cruise' ? baseTurnDuration : 0;
      const cruiseDistance = Math.max(
        0,
        travelDistance - turnTravelDistance * 2
      );
      const cruiseDuration =
        mode === 'cruise'
          ? (cruiseDistance / LONG_JUMP_CRUISE_SPEED_UNITS_PER_SECOND) * 1000
          : 0;
      const duration =
        mode === 'cruise'
          ? turnDuration * 2 + cruiseDuration
          : layout.transitionDuration;
      cameraTransition = {
        fromGroupIndex,
        toGroupIndex: nextGroupIndex,
        startedAt: performance.now(),
        duration,
        settled: false,
        direction,
        mode,
        turnDuration,
        turnTravelDistance,
      };
      targetGroupIndex = nextGroupIndex;
      setNavGroupIndex(nextGroupIndex);
      setIsNavThrottled(true);
      updateTransitionFrames(fromGroupIndex, nextGroupIndex);
      updateEmbedVisibility(performance.now());
      requestRenderLoop();
    };

    const goFirst = () => goToGroup(0, 'cruise');
    const goPrevious = () => goToGroup(targetGroupIndex - 1);
    const goNext = () => goToGroup(targetGroupIndex + 1);
    const goLast = () => goToGroup(maxGroupIndex, 'cruise');

    let pointerX = 0;
    let pointerY = 0;

    const handlePointerMove = (event: PointerEvent) => {
      if (isMobile) return;

      const nextPointerX = (event.clientX / window.innerWidth - 0.5) * 0.18;
      const nextPointerY = (event.clientY / window.innerHeight - 0.5) * 0.12;

      if (nextPointerX === pointerX && nextPointerY === pointerY) {
        return;
      }

      pointerX = nextPointerX;
      pointerY = nextPointerY;
      cameraNeedsCssRender = true;
      requestRenderLoop();
    };

    const neonStartedAt = performance.now();
    const shouldAnimateSettledNeon = () =>
      targetGroupIndex === 0 || targetGroupIndex === maxGroupIndex;

    const updateNeonSign = () => {
      const timeSeconds = (performance.now() - neonStartedAt) / 1000;
      const glow = neonCycle(timeSeconds);

      neonMaterialBuckets.frontBlue.forEach((material, index) => {
        const value =
          glow * (0.985 + 0.02 * Math.sin(timeSeconds * 7.5 + index * 0.7));
        material.emissiveIntensity = 2.25 * value;
      });
      neonMaterialBuckets.sideBlue.forEach((material, index) => {
        const value =
          glow * (0.985 + 0.02 * Math.sin(timeSeconds * 7.5 + index * 0.7));
        material.emissiveIntensity = 0.5 * value;
      });

      neonMaterialBuckets.frontPink.forEach((material, index) => {
        const value =
          glow * (1 + 0.025 * Math.sin(timeSeconds * 9 + index * 0.55));
        material.emissiveIntensity = 2.7 * value;
      });
      neonMaterialBuckets.sidePink.forEach((material, index) => {
        const value =
          glow * (1 + 0.025 * Math.sin(timeSeconds * 9 + index * 0.55));
        material.emissiveIntensity = 0.64 * value;
      });

      neonLightRigs.forEach((rig, rigIndex) => {
        rig.blue.forEach((light, lightIndex) => {
          const shimmer =
            0.94 +
            0.06 * Math.sin(timeSeconds * 5.2 + rigIndex + lightIndex * 0.15);
          const baseIntensity =
            typeof light.userData.baseIntensity === 'number'
              ? light.userData.baseIntensity
              : GALLERY_LIGHTING.neon.blueIntensity;
          light.intensity = baseIntensity * glow * shimmer;
        });
        rig.pink.forEach((light, lightIndex) => {
          const shimmer =
            0.94 +
            0.06 * Math.sin(timeSeconds * 5.8 + rigIndex + lightIndex * 0.15);
          const baseIntensity =
            typeof light.userData.baseIntensity === 'number'
              ? light.userData.baseIntensity
              : GALLERY_LIGHTING.neon.pinkIntensity;
          light.intensity = baseIntensity * glow * shimmer;
        });
      });

      if (bloomPass) {
        bloomPass.strength =
          NEON_BLOOM_SETTINGS.strengthBase +
          glow * NEON_BLOOM_SETTINGS.strengthGlow;
        bloomPass.radius =
          NEON_BLOOM_SETTINGS.radiusBase +
          glow * NEON_BLOOM_SETTINGS.radiusGlow;
        bloomPass.threshold = NEON_BLOOM_SETTINGS.threshold;
      }

      if (chandelierBloomPass) {
        chandelierBloomPass.strength = CHANDELIER_BLOOM_SETTINGS.strength;
        chandelierBloomPass.radius = CHANDELIER_BLOOM_SETTINGS.radius;
        chandelierBloomPass.threshold = CHANDELIER_BLOOM_SETTINGS.threshold;
      }
    };

    const darkenVisibleNonBloomed = (object: THREE.Object3D) => {
      if (
        object instanceof THREE.Mesh &&
        !activeBloomLayer.test(object.layers) &&
        object.material !== darkBloomMaterial
      ) {
        darkenedBloomMeshes.push({
          mesh: object,
          material: object.material,
        });
        object.material = darkBloomMaterial;
      }
    };

    const restoreDarkenedBloomMeshes = () => {
      for (let index = 0; index < darkenedBloomMeshes.length; index++) {
        const { mesh, material } = darkenedBloomMeshes[index];
        mesh.material = material;
      }

      darkenedBloomMeshes.length = 0;
    };

    const renderScene = (renderCss = false) => {
      if (composer && bloomComposer && chandelierBloomComposer) {
        setBloomChandelierMeshesVisible(false);
        activeBloomLayer = bloomLayer;
        scene.traverseVisible(darkenVisibleNonBloomed);
        try {
          bloomComposer.render();
        } finally {
          restoreDarkenedBloomMeshes();
        }

        setBloomChandelierMeshesVisible(true);
        setBaseSimpleChandelierMeshesVisible(false);
        activeBloomLayer = chandelierBloomLayer;
        scene.traverseVisible(darkenVisibleNonBloomed);
        try {
          chandelierBloomComposer.render();
        } finally {
          restoreDarkenedBloomMeshes();
          setBloomChandelierMeshesVisible(false);
          setBaseSimpleChandelierMeshesVisible(true);
          activeBloomLayer = bloomLayer;
        }

        composer.render();
      } else {
        renderer.render(scene, camera);
      }
      if (renderCss) {
        cssRenderer.render(cssScene, camera);
        cssNeedsRender = false;
        cameraNeedsCssRender = false;
      }
    };

    const setPaintingSpotlightFactor = (
      record: FrameRecord,
      factor: number
    ) => {
      const spotlight = record.paintingSpotlight;
      const baseIntensity =
        typeof spotlight.userData.baseIntensity === 'number'
          ? spotlight.userData.baseIntensity
          : GALLERY_LIGHTING.paintingSpot.intensity;
      const isVisible = factor > 0.001;

      spotlight.intensity = baseIntensity * factor;
      if (spotlight.visible !== isVisible) {
        spotlight.visible = isVisible;
        if (isVisible) {
          invalidateShadows();
        }
      }
    };

    const getGroupLightFactor = (groupIndex: number, now: number | null) => {
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
      const isVisible = factor > 0.001;

      spotlight.intensity = baseIntensity * factor;
      if (spotlight.visible !== isVisible) {
        spotlight.visible = isVisible;
        if (isVisible) {
          invalidateShadows();
        }
      }
    };

    const updatePaintingSpotlights = (now: number | null) => {
      activeFrames.forEach((record) => {
        const groupIndex = getFramePlacement(record.index).groupIndex;
        setPaintingSpotlightFactor(
          record,
          getGroupLightFactor(groupIndex, now)
        );
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
      const fromPose = getCameraPose(
        transition.fromGroupIndex,
        pointerX,
        -pointerY,
        transitionFromPose
      );
      const toPose = getCameraPose(
        transition.toGroupIndex,
        pointerX,
        -pointerY,
        transitionToPose
      );
      const position = transitionResultPose.position;

      transitionFromDirection
        .copy(fromPose.target)
        .sub(fromPose.position)
        .normalize();
      transitionToDirection
        .copy(toPose.target)
        .sub(toPose.position)
        .normalize();
      transitionHallwayDirection
        .set(
          0,
          (layout.frameY - layout.cameraY) / layout.transitionLookDistance,
          transition.direction > 0 ? -1 : 1
        )
        .normalize();

      if (transition.mode === 'cruise') {
        const motionElapsed = clamp(
          elapsed - PAINTING_LIGHT_OFF_MS,
          0,
          transition.duration
        );
        const turnDuration = transition.turnDuration;
        const cruiseDuration = Math.max(
          0,
          transition.duration - turnDuration * 2
        );
        const totalTravelDistance = Math.abs(
          toPose.position.z - fromPose.position.z
        );
        const cruiseDistance = Math.max(
          0,
          totalTravelDistance - transition.turnTravelDistance * 2
        );
        const zDirection = transition.direction > 0 ? -1 : 1;

        if (motionElapsed < turnDuration) {
          const turnProgress =
            turnDuration > 0 ? motionElapsed / turnDuration : 1;
          position.set(
            fromPose.position.x,
            fromPose.position.y,
            fromPose.position.z +
              zDirection *
                transition.turnTravelDistance *
                easeInQuad(turnProgress)
          );
          transitionDirection
            .copy(transitionFromDirection)
            .lerp(transitionHallwayDirection, easeInOutCubic(turnProgress));
        } else if (motionElapsed < turnDuration + cruiseDuration) {
          const cruiseProgress =
            cruiseDuration > 0
              ? (motionElapsed - turnDuration) / cruiseDuration
              : 1;
          position.set(
            fromPose.position.x,
            fromPose.position.y,
            fromPose.position.z +
              zDirection *
                (transition.turnTravelDistance +
                  cruiseDistance * cruiseProgress)
          );
          transitionDirection.copy(transitionHallwayDirection);
        } else {
          const turnProgress =
            turnDuration > 0
              ? clamp(
                  (motionElapsed - turnDuration - cruiseDuration) /
                    turnDuration,
                  0,
                  1
                )
              : 1;
          position.set(
            fromPose.position.x,
            fromPose.position.y,
            fromPose.position.z +
              zDirection *
                (transition.turnTravelDistance +
                  cruiseDistance +
                  transition.turnTravelDistance * easeOutQuad(turnProgress))
          );
          transitionDirection
            .copy(transitionHallwayDirection)
            .lerp(transitionToDirection, easeInOutCubic(turnProgress));
        }
      } else {
        const easedProgress = easeInOutCubic(cameraProgress);
        position.copy(fromPose.position).lerp(toPose.position, easedProgress);

        if (cameraProgress < 0.5) {
          transitionDirection
            .copy(transitionFromDirection)
            .lerp(
              transitionHallwayDirection,
              easeInOutCubic(cameraProgress * 2)
            );
        } else {
          transitionDirection
            .copy(transitionHallwayDirection)
            .lerp(
              transitionToDirection,
              easeInOutCubic((cameraProgress - 0.5) * 2)
            );
        }
      }

      if (cameraProgress >= 1) {
        position.copy(toPose.position);
        transitionDirection
          .copy(toPose.target)
          .sub(toPose.position);
      }
      transitionDirection.normalize();
      transitionResultPose.target
        .copy(position)
        .addScaledVector(transitionDirection, layout.transitionLookDistance);

      transitionPoseResult.cameraProgress = cameraProgress;
      transitionPoseResult.elapsed = elapsed;

      return transitionPoseResult;
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

        if (!cameraTransition.settled && transitionPose.cameraProgress >= 1) {
          cameraTransition.settled = true;
          cameraNeedsCssRender = true;
          currentGroupIndex = targetGroupIndex;
          updateVirtualFrames(targetGroupIndex);
        }

        if (!isSettling) {
          cameraTransition = null;
          setIsNavThrottled(false);
          cameraNeedsCssRender = true;
          pose = getCameraPose(
            targetGroupIndex,
            pointerX,
            -pointerY,
            renderPose
          );
        }
      } else {
        pose = getCameraPose(targetGroupIndex, pointerX, -pointerY, renderPose);
      }

      applyCameraPose(pose);
      updateChandelierLod();

      if (!cameraTransition && targetGroupIndex !== currentGroupIndex) {
        currentGroupIndex = targetGroupIndex;
        updateVirtualFrames(targetGroupIndex);
      }
      updatePaintingSpotlights(cameraTransition ? now : null);
      updateCeilingSpotlights(cameraTransition ? now : null);
      updateNeonSign();
      updateEmbedVisibility(cameraTransition ? now : null);

      renderScene(
        cssNeedsRender ||
          cameraNeedsCssRender ||
          Boolean(cameraTransition && !cameraTransition.settled)
      );

      if (cameraTransition || shouldAnimateSettledNeon()) {
        requestRenderLoop();
      }
    };

    requestRenderLoop = () => {
      if (!isMounted || animationFrame || !shouldRunRenderLoop()) return;

      animationFrame = window.requestAnimationFrame(renderFrame);
    };

    const cancelPendingRender = () => {
      if (!animationFrame) return;

      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    const resumeRenderLoop = () => {
      if (!shouldRunRenderLoop()) {
        cancelPendingRender();
        return;
      }

      requestRenderLoop();
    };

    const handleVisibilityChange = () => {
      isDocumentVisible = document.visibilityState === 'visible';
      resumeRenderLoop();
    };

    let viewportVisibilityObserver: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      viewportVisibilityObserver = new IntersectionObserver(([entry]) => {
        isViewportVisible = entry.isIntersecting;
        resumeRenderLoop();
      });
      viewportVisibilityObserver.observe(viewport);
    }

    targetGroupIndex = 0;
    setNavGroupIndex(0);
    const initialPose = getCameraPose(targetGroupIndex, 0, 0, renderPose);
    applyCameraPose(initialPose);
    applyResize(true);
    updateVirtualFrames(targetGroupIndex);
    currentGroupIndex = targetGroupIndex;
    updateChandelierLod();
    updatePaintingSpotlights(null);
    updateCeilingSpotlights(null);
    updateEmbedVisibility(null);
    renderScene(true);
    setIsReady(true);

    document.addEventListener('visibilitychange', handleVisibilityChange);
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
    firstButton?.addEventListener('click', goFirst);
    previousButton?.addEventListener('click', goPrevious);
    nextButton?.addEventListener('click', goNext);
    lastButton?.addEventListener('click', goLast);

    return () => {
      isMounted = false;
      window.cancelAnimationFrame(animationFrame);
      if (resizeRaf) {
        window.cancelAnimationFrame(resizeRaf);
      }
      viewportVisibilityObserver?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener(
        'art-in-life-card-scale-change',
        handleCardScaleChange
      );
      firstButton?.removeEventListener('click', goFirst);
      previousButton?.removeEventListener('click', goPrevious);
      nextButton?.removeEventListener('click', goNext);
      lastButton?.removeEventListener('click', goLast);

      activeFrames.forEach(destroyFrameRecord);
      activeFrames.clear();
      activeCeilingSpotlights.forEach(removeGroupCeilingSpotlight);
      activeCeilingSpotlights.clear();
      neonAnchors.forEach((anchor) => scene.remove(anchor));
      neonAnchors.length = 0;

      chandelierGeometries.forEach((geometry) => geometry.dispose());
      neonGeometries.forEach((geometry) => geometry.dispose());
      sharedFrameRailGeometrySet.forEach((geometry) => geometry.dispose());
      unitBox.dispose();
      unitPlane.dispose();
      environmentGeometries.forEach((geometry) => geometry.dispose());
      loadedTextures.forEach((texture) => texture.dispose());
      materials.forEach(disposeMaterial);
      neonMaterials.forEach(disposeMaterial);
      bloomPass?.dispose();
      chandelierBloomPass?.dispose();
      finalBloomPass?.dispose();
      finalBloomMaterial?.dispose();
      darkBloomMaterial.dispose();
      chandelierBloomComposer?.dispose();
      bloomComposer?.dispose();
      composer?.dispose();
      renderer.dispose();
      webglHost.remove();
      cssHost.remove();
      stagingHost.remove();
    };
  }, [
    groupCount,
    isMobile,
    layout,
    reducedMotion,
    sceneClassNames,
    shouldShowDesktopSafariNotice,
    urls,
  ]);

  if (shouldShowDesktopSafariNotice) {
    return <DesktopSafariNotice />;
  }

  if (useFallback) {
    return <FallbackGallery urls={urls} />;
  }

  const controlButtonClassName = `${styles.galleryControlButton} ${
    isNavThrottled ? styles.galleryControlButtonThrottled : ''
  }`;
  const firstButtonClassName = `${controlButtonClassName} ${styles.galleryControlButtonBackward}`;
  const previousButtonClassName = `${controlButtonClassName} ${styles.galleryControlButtonBackward}`;
  const nextButtonClassName = `${controlButtonClassName} ${styles.galleryControlButtonForward}`;
  const lastButtonClassName = `${controlButtonClassName} ${styles.galleryControlButtonForward}`;
  const doubleIconClassName = `${styles.galleryControlIcon} ${styles.galleryControlIconDouble}`;

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
      <div
        className={styles.galleryControls}
        aria-label="Gallery navigation"
        aria-busy={isNavThrottled}
      >
        <button
          ref={firstButtonRef}
          type="button"
          className={firstButtonClassName}
          aria-label="First paintings"
          disabled={isNavThrottled || navGroupIndex <= 0}
        >
          <span className={doubleIconClassName} aria-hidden="true">
            ‹‹
          </span>
        </button>
        <button
          ref={previousButtonRef}
          type="button"
          className={previousButtonClassName}
          aria-label="Previous paintings"
          disabled={isNavThrottled || navGroupIndex <= 0}
        >
          <span className={styles.galleryControlIcon} aria-hidden="true">
            ‹
          </span>
        </button>
        <button
          ref={nextButtonRef}
          type="button"
          className={nextButtonClassName}
          aria-label="Next paintings"
          disabled={isNavThrottled || navGroupIndex >= groupCount - 1}
        >
          <span className={styles.galleryControlIcon} aria-hidden="true">
            ›
          </span>
        </button>
        <button
          ref={lastButtonRef}
          type="button"
          className={lastButtonClassName}
          aria-label="Last paintings"
          disabled={isNavThrottled || navGroupIndex >= groupCount - 1}
        >
          <span className={doubleIconClassName} aria-hidden="true">
            ››
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
