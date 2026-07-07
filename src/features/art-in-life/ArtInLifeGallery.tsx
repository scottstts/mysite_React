import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  CSS3DObject,
  CSS3DRenderer,
} from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createInstagramEmbedHtml } from './artInLife.data';
import styles from './ArtInLifeTab.module.css';
import walnutFrameTextureUrl from '@/assets/textures/aged-walnut-frame.webp';
import goldFrameTextureUrl from '@/assets/textures/antique-gold-frame.webp';
import ebonyFrameTextureUrl from '@/assets/textures/dark-ebony-frame.webp';
import floorBaseTextureUrl from '@/assets/textures/gallery-floor-base.jpg';
import floorNormalTextureUrl from '@/assets/textures/gallery-floor-normal.webp';
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
  // Per-record clones of the frame + plaque materials whose environment
  // glints follow this frame's light factor (dark stretch -> no glints).
  envGlintMaterials: THREE.MeshPhysicalMaterial[];
  embedMounted: boolean;
  embedRequested: boolean;
  embedRequestId: number;
  cacheKey?: string;
  lastTouched: number;
}

interface CachedInstagramEmbed {
  key: string;
  index: number;
  url: string;
  element: HTMLElement;
  observer: MutationObserver;
  attachedRecordIndex: number | null;
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

type IntroPhase = 'pending' | 'hold' | 'travel' | 'reveal' | 'done';

interface IntroSequenceState {
  phase: IntroPhase;
  startedAt: number;
  travelStartedAt: number;
  revealStartedAt: number;
  signReadyAt: number;
  hasSignMoment: boolean;
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
const MAX_CACHED_INSTAGRAM_IFRAMES = 30;
const INSTAGRAM_EMBED_LOAD_TIMEOUT_MS = 8000;
const INSTAGRAM_EMBED_SETTLE_MS = 900;
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
// Full chandeliers are merged into a handful of draw calls, so the curve
// tessellation of the hand-built reference model can drop well below its
// authoring density without a visible difference at gallery scale.
const CHANDELIER_SEGMENT_FACTOR = 0.5;
const FOG_SETTINGS = {
  // Clear indoor air: distance should only darken and soften, never read as
  // a visible medium. The color sits just above black (a hint of the hall's
  // warmth) and the density is low enough that even a long hall keeps its
  // contrast instead of dissolving into haze.
  color: 0x2b251f,
  density: 0.003,
  // Beyond this transmittance the fog has swallowed geometry enough that the
  // far plane can be pulled in without visible pop-in.
  cullTransmittance: 0.03,
};
const FLOOR_REFLECTION_SETTINGS = {
  textureScale: 0.35,
  minSize: 192,
  maxSize: 1024,
  strength: 0.5,
  baseStrength: 0.05,
  fresnelPower: 3.4,
  normalDistort: 0.06,
  // While the camera is settled and only the neon flicker animates, the
  // mirror pass re-renders on this throttle instead of every frame.
  idleIntervalMs: 140,
};
const FINAL_GRADE_SETTINGS = {
  vignetteStrength: 0.17,
  vignetteInner: 0.52,
  vignetteOuter: 1.36,
  grainAmount: 0.0045,
  warmTint: [1.024, 1.0, 0.968] as const,
};
const INTRO_SETTINGS = {
  holdMs: 1450,
  travelMs: 2900,
  pushDistance: 0.5,
  signLookHeightOffset: 0.35,
  maxSignWaitMs: 2200,
  signSettleMs: 750,
  lightStaggerMs: 240,
  ceilingLeadMs: 220,
  pointerBlendMs: 420,
  // Once shaders are warmed, group 0's lights idle at this imperceptible
  // factor instead of visible=false, so the reveal never changes the light
  // count (which would force synchronous shader recompiles mid-animation).
  warmLightFactor: 0.002,
  // How long after issuing the warmup compiles to flip the lights on and
  // bake shadows -- enough for parallel driver compilation to finish, still
  // comfortably inside the intro's hold phase.
  warmupSettleMs: 1100,
};
const WALK_BOB_SETTINGS = {
  frequencyHz: 1.7,
  rollFrequencyHz: 0.85,
  amplitude: 0.022,
  rollAmplitude: 0.0032,
  targetFollow: 0.35,
};
const STEP_ARRIVAL_OVERSHOOT = 0.014;
// The marble tile texture covers a real-world 2.5m x 2.5m area per repeat.
const FLOOR_TEXTURE_SIZE_METERS = 2.5;
// Hall dressing: a rope stanchion line guards each painting group and a
// bench faces the art from the bare wall opposite. Everything is procedural
// (lathe profiles, swag curves, canvas textures) and instanced, so the
// entire dressing costs four draw calls regardless of hall length. The
// scene reads at roughly 0.53m per unit -- the camera's standing eye sits
// 3.0 units above the floor.
const GALLERY_PROPS_SETTINGS = {
  stanchion: {
    // One post per frame-slot boundary, a walkway's gap out from the art
    // wall. At 1.7 units (~0.9m) tall the finials stay below the settled
    // camera's sight line to the embeds' bottom edge on every layout, so
    // these WebGL posts can never cross the CSS3D embeds composited above
    // the canvas.
    wallOffset: 1.6,
    radialSegments: 40,
  },
  rope: {
    radius: 0.042,
    // Swag depth as a fraction of the span -- velvet hangs heavy.
    sagRatio: 0.145,
    tubularSegments: 44,
    radialSegments: 12,
    sheenColor: 0xff5f79,
  },
  bench: {
    // Cushion half-depth plus baseboard clearance keeps the bench just off
    // the wall; the z jitter stops the run reading as a stamped pattern.
    wallOffset: 0.78,
    zJitter: 0.3,
  },
  // Props sink a hair into the floor so its ripple never pokes through a
  // flat base -- the same grounding trick the baseboards use.
  floorSink: 0.012,
};

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
const MOBILE_RENDER_PIXEL_BUDGET = 1_000_000;
const DESKTOP_RENDER_PIXEL_BUDGET = 1_650_000;
const MOBILE_MAX_DPR = 1.25;
const DESKTOP_MAX_DPR = 1.5;
const MIN_RENDER_DPR = 1;

let instagramScriptPromise: Promise<void> | null = null;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const isMobileDprTarget = (usesMobileLayout: boolean): boolean => {
  if (usesMobileLayout || typeof navigator === 'undefined') {
    return usesMobileLayout;
  }

  const userAgent = navigator.userAgent;
  const isMobileUserAgent = /iPhone|iPad|iPod|Android/i.test(userAgent);
  const isTouchMac =
    /Mac/i.test(navigator.platform) && navigator.maxTouchPoints > 1;

  return isMobileUserAgent || isTouchMac;
};

const getCappedDpr = (
  width: number,
  height: number,
  usesMobileDpr: boolean
): number => {
  const maxPixels = usesMobileDpr
    ? MOBILE_RENDER_PIXEL_BUDGET
    : DESKTOP_RENDER_PIXEL_BUDGET;
  const maxDpr = usesMobileDpr ? MOBILE_MAX_DPR : DESKTOP_MAX_DPR;
  const cssPixelCount = Math.max(1, width * height);
  const budgetDpr = Math.sqrt(maxPixels / cssPixelCount);
  const deviceDpr =
    typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

  return Math.max(MIN_RENDER_DPR, Math.min(deviceDpr, maxDpr, budgetDpr));
};

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

const chSeg = (count: number, min: number): number =>
  Math.max(min, Math.round(count * CHANDELIER_SEGMENT_FACTOR));

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
      existingScript.addEventListener(
        'error',
        (event) => {
          instagramScriptPromise = null;
          existingScript.remove();
          reject(event);
        },
        { once: true }
      );
      return;
    }

    ensureInstagramPreconnect();

    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://www.instagram.com/embed.js';
    script.dataset.instagramEmbedSdk = 'true';
    script.addEventListener(
      'load',
      () => {
        script.dataset.instagramEmbedSdkLoaded = 'true';
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      'error',
      (event) => {
        instagramScriptPromise = null;
        script.remove();
        reject(event);
      },
      { once: true }
    );
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

const normalizeInstagramUrl = (url: string): string =>
  url.replace(/&amp;/g, '&');

const getInstagramEmbedCacheKey = (url: string): string => {
  try {
    const parsedUrl = new URL(normalizeInstagramUrl(url));
    const pathname = parsedUrl.pathname.endsWith('/')
      ? parsedUrl.pathname
      : `${parsedUrl.pathname}/`;

    return `${parsedUrl.origin}${pathname}`;
  } catch {
    return url;
  }
};

const getInstagramPostPath = (url: string): string | null => {
  try {
    const parsedUrl = new URL(normalizeInstagramUrl(url));
    const postMatch = parsedUrl.pathname.match(/^\/(p|reel|tv)\/([^/]+)/);

    return postMatch ? `/${postMatch[1]}/${postMatch[2]}` : null;
  } catch {
    return null;
  }
};

const isInstagramEmbedIframeHealthy = (
  iframe: HTMLIFrameElement,
  sourceUrl: string
): boolean => {
  if (!iframe.isConnected || iframe.src.startsWith('chrome-error://')) {
    return false;
  }

  let iframeUrl: URL;
  try {
    iframeUrl = new URL(iframe.src);
  } catch {
    return false;
  }

  const hostname = iframeUrl.hostname.toLowerCase();
  if (hostname !== 'instagram.com' && hostname !== 'www.instagram.com') {
    return false;
  }

  if (
    iframeUrl.pathname === '/' ||
    iframeUrl.pathname.startsWith('/accounts/login')
  ) {
    return false;
  }

  const sourcePostPath = getInstagramPostPath(sourceUrl);
  if (sourcePostPath && !iframeUrl.pathname.includes(sourcePostPath)) {
    return false;
  }

  if (!iframeUrl.pathname.includes('/embed')) {
    return false;
  }

  const rect = iframe.getBoundingClientRect();
  return rect.width >= 100 && rect.height >= 100;
};

const isInstagramMessageOrigin = (origin: string): boolean =>
  origin === 'https://www.instagram.com' || origin === 'https://instagram.com';

const waitForHealthyInstagramEmbed = (
  container: HTMLElement,
  sourceUrl: string,
  timeout = INSTAGRAM_EMBED_LOAD_TIMEOUT_MS
): Promise<HTMLElement | null> => {
  return new Promise((resolve) => {
    let settled = false;
    let receivedEmbedMessage = false;
    let settleTimeoutId = 0;
    let pollIntervalId = 0;
    let timeoutId = 0;

    const findInstagramIframe = (): HTMLIFrameElement | null =>
      container.querySelector<HTMLIFrameElement>(
        'iframe[src*="instagram.com"]'
      );

    const findHealthyRoot = (): HTMLElement | null => {
      const iframe = findInstagramIframe();
      if (!iframe || !isInstagramEmbedIframeHealthy(iframe, sourceUrl)) {
        return null;
      }

      if (!receivedEmbedMessage) {
        return null;
      }

      const root = container.firstElementChild;
      return root instanceof HTMLElement ? root : container;
    };

    const finish = (root: HTMLElement | null) => {
      if (settled) return;

      settled = true;
      window.clearTimeout(settleTimeoutId);
      window.clearTimeout(timeoutId);
      window.clearInterval(pollIntervalId);
      window.removeEventListener('message', handleMessage);
      observer.disconnect();
      resolve(root);
    };

    const scheduleSettleCheck = () => {
      if (settled || settleTimeoutId) return;

      settleTimeoutId = window.setTimeout(() => {
        settleTimeoutId = 0;
        finish(findHealthyRoot());
      }, INSTAGRAM_EMBED_SETTLE_MS);
    };

    const handleMessage = (event: MessageEvent) => {
      if (!isInstagramMessageOrigin(event.origin)) return;

      const iframe = findInstagramIframe();
      if (!iframe || event.source !== iframe.contentWindow) return;

      receivedEmbedMessage = true;
      if (findHealthyRoot()) {
        scheduleSettleCheck();
      }
    };

    const observer = new MutationObserver(() => {
      if (findHealthyRoot()) {
        scheduleSettleCheck();
      }
    });
    window.addEventListener('message', handleMessage);
    timeoutId = window.setTimeout(() => finish(findHealthyRoot()), timeout);
    pollIntervalId = window.setInterval(() => {
      if (findHealthyRoot()) {
        scheduleSettleCheck();
      }
    }, 250);

    observer.observe(container, {
      attributes: true,
      attributeFilter: ['src', 'style', 'class'],
      childList: true,
      subtree: true,
    });

    if (findHealthyRoot()) {
      scheduleSettleCheck();
    }
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

// Shared skeleton for the procedural prop canvases: an ImageData walk where
// every sine frequency is a whole number of cycles per tile, so the noise
// wraps seamlessly under RepeatWrapping.
const createProceduralSurfaceTexture = (
  anisotropy: number,
  repeatX: number,
  repeatY: number,
  shadePixel: (
    _u: number,
    _v: number,
    _speckle: number
  ) => [number, number, number]
): THREE.CanvasTexture => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (context) {
    const image = context.createImageData(size, size);
    const tau = Math.PI * 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const offset = (y * size + x) * 4;
        const hash = Math.sin(x * 12.9898 + y * 78.233 + 53) * 43758.5453;
        const [r, g, b] = shadePixel(
          (x / size) * tau,
          (y / size) * tau,
          hash - Math.floor(hash)
        );

        image.data[offset] = Math.round(clamp(r, 0, 255));
        image.data[offset + 1] = Math.round(clamp(g, 0, 255));
        image.data[offset + 2] = Math.round(clamp(b, 0, 255));
        image.data[offset + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(anisotropy, 4);
  texture.needsUpdate = true;
  return texture;
};

// Deep crimson velvet: broad crushed-pile mottling, fine thread runs around
// the rope, and per-pixel fuzz. Doubles as its own bump map.
const createVelvetTexture = (anisotropy: number): THREE.CanvasTexture =>
  createProceduralSurfaceTexture(anisotropy, 6, 2, (u, v, speckle) => {
    const mottle =
      Math.sin(u * 3 + Math.sin(v * 2) * 2.1) *
      Math.sin(v * 4 + Math.sin(u * 5) * 1.7);
    const thread = Math.sin(v * 38 + Math.sin(u * 7) * 2.4);
    const shade = 0.88 + mottle * 0.07 + thread * 0.045 + speckle * 0.09;

    return [116 * shade, 20 * shade, 34 * shade];
  });

// Cognac leather: two warped sine fields multiply into an irregular pore
// cell pattern, darkened where cells crease.
const createLeatherTexture = (anisotropy: number): THREE.CanvasTexture =>
  createProceduralSurfaceTexture(anisotropy, 3, 1.4, (u, v, speckle) => {
    const cells =
      Math.sin(u * 9 + Math.sin(v * 7) * 2.3) *
      Math.sin(v * 11 + Math.sin(u * 6) * 2.1);
    const pore = Math.pow(Math.max(0, cells), 2.2);
    const patina = Math.sin(u * 2 + Math.sin(v * 3) * 1.4) * 0.5 + 0.5;
    const shade = 0.92 - pore * 0.16 + speckle * 0.1 + patina * 0.06;

    return [118 * shade, 68 * shade, 37 * shade * (1 - pore * 0.12)];
  });

// Espresso bench wood: tight horizontal grain bands with slow wobble, a
// darker streak where bands crest, and fine pore speckle.
const createBenchWoodTexture = (anisotropy: number): THREE.CanvasTexture =>
  createProceduralSurfaceTexture(anisotropy, 1.6, 1, (u, v, speckle) => {
    const rings = Math.sin(
      v * 14 + Math.sin(u * 2) * 2.6 + Math.sin(u * 5) * 0.8
    );
    const streak = smoothstep(0.62, 0.98, rings) * 0.14;
    const shade = 0.9 + rings * 0.09 + speckle * 0.07 - streak;

    return [64 * shade, 40 * shade, 24 * shade];
  });

// Museum stanchion profile, lathed about Y: domed base plate, slim barrel
// with a turned ring, collar bead, then the crown drum the rope clips into
// and a ball finial. Near-duplicate profile points pinch the normals into
// tight fillets so edges read as softly rounded metal rather than CG-sharp.
const STANCHION_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.315, 0.0],
  [0.315, 0.028],
  [0.298, 0.06],
  [0.262, 0.09],
  [0.205, 0.112],
  [0.148, 0.124],
  [0.102, 0.134],
  [0.085, 0.155],
  [0.064, 0.19],
  [0.053, 0.23],
  [0.049, 0.275],
  [0.049, 0.498],
  [0.057, 0.52],
  [0.057, 0.546],
  [0.049, 0.568],
  [0.049, 1.252],
  [0.055, 1.29],
  [0.071, 1.317],
  [0.055, 1.344],
  [0.049, 1.372],
  [0.051, 1.406],
  [0.111, 1.434],
  [0.119, 1.458],
  [0.119, 1.492],
  [0.111, 1.512],
  [0.063, 1.527],
  [0.051, 1.542],
  [0.069, 1.558],
  [0.078, 1.592],
  [0.069, 1.628],
  [0.047, 1.658],
  [0.02, 1.684],
  [0.0001, 1.7],
];
// Rope ends anchor at the crown drum's mid-height; the drum radius swallows
// the open tube ends so no cap geometry is needed.
const STANCHION_ROPE_ATTACH_Y = 1.476;

const createStanchionGeometry = (
  radialSegments: number
): THREE.BufferGeometry => {
  const points = STANCHION_PROFILE.map(
    ([radius, y]) => new THREE.Vector2(radius, y)
  );
  const geometry = new THREE.LatheGeometry(points, radialSegments);
  geometry.computeBoundingSphere();
  return geometry;
};

// One rope swag spanning exactly the gap between adjacent stanchions. Posts
// sit at uniform frame-boundary spacing, so a single geometry instances
// across every gap in the hall; its endpoints land on the post axes, hidden
// inside the crown drums.
const createVelvetRopeGeometry = (
  span: number,
  attachHeight: number,
  sagRatio: number,
  radius: number,
  tubularSegments: number,
  radialSegments: number
): THREE.BufferGeometry => {
  const sag = span * sagRatio;
  const sampleCount = 13;
  const samples: THREE.Vector3[] = [];

  for (let index = 0; index < sampleCount; index++) {
    const t = index / (sampleCount - 1);
    samples.push(
      new THREE.Vector3(
        (t - 0.5) * span,
        attachHeight - sag * 4 * t * (1 - t),
        0
      )
    );
  }

  const curve = new THREE.CatmullRomCurve3(samples, false, 'catmullrom', 0.5);
  const geometry = new THREE.TubeGeometry(
    curve,
    tubularSegments,
    radius,
    radialSegments,
    false
  );
  geometry.computeBoundingSphere();
  return geometry;
};

// Gallery bench: a piped leather cushion (rounded box, pillowed on top)
// over an espresso apron with four tapered square legs. The wood parts
// merge into one geometry so the bench costs two instanced draws total.
const createBenchGeometries = (
  length: number
): { cushion: THREE.BufferGeometry; base: THREE.BufferGeometry } => {
  const cushionHeight = 0.3;
  const cushionDepth = 1.02;
  const halfLength = length / 2;
  const halfDepth = cushionDepth / 2;
  const halfHeight = cushionHeight / 2;
  const cushion = new RoundedBoxGeometry(
    length,
    cushionHeight,
    cushionDepth,
    4,
    0.1
  );
  const cushionPosition = cushion.getAttribute(
    'position'
  ) as THREE.BufferAttribute;

  for (let index = 0; index < cushionPosition.count; index++) {
    const x = cushionPosition.getX(index);
    const y = cushionPosition.getY(index);
    const z = cushionPosition.getZ(index);
    // Pillow the top: a gentle dome fading toward the piped edges, leaving
    // the sides and underside straight.
    const lift = smoothstep(-0.02, halfHeight, y);
    const domeX = Math.cos(clamp(x / halfLength, -1, 1) * Math.PI * 0.5);
    const domeZ = Math.cos(clamp(z / halfDepth, -1, 1) * Math.PI * 0.5);

    cushionPosition.setY(index, y + 0.05 * lift * Math.pow(domeX * domeZ, 0.7));
  }

  cushion.computeVertexNormals();
  cushion.translate(0, 0.775, 0);
  cushion.computeBoundingSphere();

  const apron = new THREE.BoxGeometry(length - 0.3, 0.15, 0.84);
  apron.translate(0, 0.555, 0);
  const parts: THREE.BufferGeometry[] = [apron];
  const legTemplate = new THREE.CylinderGeometry(0.088, 0.062, 0.5, 4, 1);
  legTemplate.rotateY(Math.PI / 4);
  const legX = halfLength - 0.36;

  [-legX, legX].forEach((x) => {
    [-0.3, 0.3].forEach((z) => {
      const leg = legTemplate.clone();
      leg.translate(x, 0.25, z);
      parts.push(leg);
    });
  });
  legTemplate.dispose();

  const base = mergeGeometries(parts) ?? apron;
  parts.forEach((part) => {
    if (part !== base) part.dispose();
  });
  base.computeBoundingSphere();

  return { cushion, base };
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
  // 2048 with a wider VSM blur is visually close to the old 4096 desktop map
  // at a quarter of the blur/update cost.
  spotlight.shadow.mapSize.set(2048, 2048);
  spotlight.shadow.camera.near = 1.6;
  spotlight.shadow.camera.far = 18;
  spotlight.shadow.bias = -0.00004;
  spotlight.shadow.normalBias = 0.035;
  spotlight.shadow.radius = isMobile ? 3 : 5;
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

const ArtInLifeGallery = ({ urls }: ArtInLifeGalleryProps) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousButtonRef = useRef<HTMLButtonElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasPlayedIntroRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [navGroupIndex, setNavGroupIndex] = useState(0);
  const [isNavThrottled, setIsNavThrottled] = useState(false);
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
    setIsNavThrottled(false);
    let animationFrame = 0;
    let targetGroupIndex = 0;
    let currentGroupIndex = -1;
    let cameraTransition: CameraTransition | null = null;
    let requestRenderLoop = () => {};
    let isDocumentVisible = document.visibilityState === 'visible';
    let isViewportVisible = true;
    const shouldRunRenderLoop = () => isDocumentVisible && isViewportVisible;
    const activeFrames = new Map<number, FrameRecord>();
    const embedCache = new Map<string, CachedInstagramEmbed>();
    const embedCacheOrder: string[] = [];
    const queuedEmbedLoads: Array<() => Promise<void>> = [];
    const maxConcurrentEmbedLoads = isMobile ? 1 : 2;
    let activeEmbedLoadCount = 0;
    let embedRequestSequence = 0;
    const activeCeilingSpotlights = new Map<number, THREE.SpotLight>();
    const maxGroupIndex = Math.max(0, groupCount - 1);
    const groupSpan = Math.max(0, (layout.groupSize - 1) * layout.spacing);
    const hallStartZ = groupSpan / 2 + layout.groupDepth * 0.82;
    const lastGroupZ = -maxGroupIndex * layout.groupDepth;
    const hallEndZ = lastGroupZ - groupSpan / 2 - layout.groupDepth * 0.9;
    const hallLength = hallStartZ - hallEndZ;
    const hallCenterZ = (hallStartZ + hallEndZ) / 2;
    const halfHallWidth = layout.hallwayWidth / 2;
    // One-time entrance dolly. When the entrance wall is far enough away the
    // camera opens on the neon sign and turns into the hall; in tighter
    // layouts it opens already facing down the hall and just walks in.
    const introSignDistance = Math.min(
      9.5,
      Math.max(7.5, layout.hallwayWidth * 0.5)
    );
    const introHasSignMoment = hallStartZ - introSignDistance >= 0.8;
    const introStartZ = introHasSignMoment
      ? hallStartZ - introSignDistance
      : Math.min(4.2, Math.max(1.6, hallStartZ - 0.8));
    const intro: IntroSequenceState = {
      phase: hasPlayedIntroRef.current ? 'done' : 'pending',
      startedAt: 0,
      travelStartedAt: 0,
      revealStartedAt: 0,
      signReadyAt: -1,
      hasSignMoment: introHasSignMoment,
    };
    let introLightsWarmed = false;
    let warmupTimeoutId = 0;
    let cameraRoll = 0;
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
    const embedCacheHost = document.createElement('div');
    embedCacheHost.setAttribute('aria-hidden', 'true');
    embedCacheHost.style.cssText = `position:fixed;left:-10000px;top:0;width:${EMBED_WIDTH_PX}px;min-height:${EMBED_HEIGHT_PX}px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;`;
    viewport.append(webglHost, cssHost);
    document.body.appendChild(embedCacheHost);

    const getRenderSize = () => {
      const rect = viewport.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      let height = Math.max(1, Math.round(rect.height));

      if (isMobile && height % 2 === 1) {
        height -= 1;
      }

      return { width, height };
    };
    const usesMobileDpr = isMobileDprTarget(isMobile);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeee6d9);
    // Gentle aerial perspective: adjacent groups stay crisp while the far end
    // of the hall softens tonally instead of reading as smoke.
    scene.fog = new THREE.FogExp2(FOG_SETTINGS.color, FOG_SETTINGS.density);
    // Past this distance fog transmittance is low enough that clipping is
    // invisible, so extremely long halls stop paying for far geometry.
    const fogCullDistance =
      Math.log(1 / FOG_SETTINGS.cullTransmittance) / FOG_SETTINGS.density;

    const cssScene = new THREE.Scene();
    const initialRenderSize = getRenderSize();
    const camera = new THREE.PerspectiveCamera(
      layout.cameraFov,
      initialRenderSize.width / initialRenderSize.height,
      0.1,
      Math.min(Math.max(120, hallLength + 90), fogCullDistance)
    );
    camera.position.set(0, layout.cameraY, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    const initialPixelRatio = getCappedDpr(
      initialRenderSize.width,
      initialRenderSize.height,
      usesMobileDpr
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

    // Environment map for specular reflections ONLY. The content is a rough
    // proxy of the hall itself -- dim warm plaster, a run of warm chandelier
    // points overhead, a hint of neon at the far ends -- so glossy surfaces
    // mirror something plausible. It is applied per-material (never as
    // scene.environment) and its diffuse irradiance is stripped in the
    // shader, so it adds zero ambient light: the scene stays lit purely by
    // its own fixtures.
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const environmentScene = new THREE.Scene();
    const environmentResources = new Set<{ dispose(): void }>();
    const addEnvironmentMesh = (
      geometry: THREE.BufferGeometry,
      material: THREE.MeshBasicMaterial,
      position: [number, number, number],
      rotationY = 0
    ) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.rotation.y = rotationY;
      environmentScene.add(mesh);
      environmentResources.add(geometry);
      environmentResources.add(material);
    };

    addEnvironmentMesh(
      new THREE.BoxGeometry(18, 9, 40),
      new THREE.MeshBasicMaterial({ color: 0x3a322a, side: THREE.BackSide }),
      [0, 1.2, 0]
    );
    const environmentGlowGeometry = new THREE.SphereGeometry(0.8, 16, 12);
    const environmentGlowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(8.0, 4.8, 2.0),
    });
    for (let index = 0; index < 5; index++) {
      addEnvironmentMesh(environmentGlowGeometry, environmentGlowMaterial, [
        index % 2 === 0 ? -1.5 : 1.5,
        3.5,
        -14 + index * 7,
      ]);
    }
    // Faint neon hints only -- the real signs reflect via the floor's actual
    // mirror pass; these just tint glints on the gold and clearcoat.
    const environmentNeonGeometry = new THREE.PlaneGeometry(11, 3.2);
    addEnvironmentMesh(
      environmentNeonGeometry,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.5, 0.85) }),
      [0, 0.8, -19.7]
    );
    addEnvironmentMesh(
      environmentNeonGeometry,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.1, 0.42) }),
      [0, 0.4, 19.7],
      Math.PI
    );

    const environmentRenderTarget = pmremGenerator.fromScene(
      environmentScene,
      0.04
    );
    const environmentTexture = environmentRenderTarget.texture;
    environmentResources.forEach((resource) => resource.dispose());
    pmremGenerator.dispose();

    // Strips the environment's diffuse irradiance from a material's shader,
    // leaving only the specular (and clearcoat) reflection lobes.
    const specularOnlyLightsFragmentMaps =
      THREE.ShaderChunk.lights_fragment_maps.replace(
        'iblIrradiance += getIBLIrradiance( geometryNormal );',
        ''
      );
    const injectSpecularOnlyEnvironment = (shader: {
      fragmentShader: string;
    }) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_maps>',
        specularOnlyLightsFragmentMaps
      );
    };

    // Cached planar floor reflection. The scene is static between camera
    // moves, so the mirror pass renders on invalidation (pose change, frame
    // swap, texture load) instead of every frame, at reduced resolution.
    const getReflectionSize = (width: number, height: number) => ({
      width: clamp(
        Math.round(width * FLOOR_REFLECTION_SETTINGS.textureScale),
        FLOOR_REFLECTION_SETTINGS.minSize,
        FLOOR_REFLECTION_SETTINGS.maxSize
      ),
      height: clamp(
        Math.round(height * FLOOR_REFLECTION_SETTINGS.textureScale),
        FLOOR_REFLECTION_SETTINGS.minSize,
        FLOOR_REFLECTION_SETTINGS.maxSize
      ),
    });
    const initialReflectionSize = getReflectionSize(
      initialRenderSize.width,
      initialRenderSize.height
    );
    // samples: the mirror renders at a fraction of screen resolution, so a
    // sub-texel specular glint on the metal frames covers or misses whole
    // texels frame to frame while the camera cruises. Without MSAA that
    // quantization reads as amplified flicker in the floor reflection.
    const reflectionRenderTarget = new THREE.WebGLRenderTarget(
      initialReflectionSize.width,
      initialReflectionSize.height,
      { type: THREE.HalfFloatType, samples: 4 }
    );
    reflectionRenderTarget.texture.minFilter = THREE.LinearFilter;
    reflectionRenderTarget.texture.magFilter = THREE.LinearFilter;
    reflectionRenderTarget.texture.generateMipmaps = false;
    const reflectionCamera = new THREE.PerspectiveCamera();
    reflectionCamera.layers.mask = camera.layers.mask;
    const reflectionTextureMatrix = new THREE.Matrix4();
    const reflectionBiasMatrix = new THREE.Matrix4().set(
      0.5,
      0,
      0,
      0.5,
      0,
      0.5,
      0,
      0.5,
      0,
      0,
      0.5,
      0.5,
      0,
      0,
      0,
      1
    );
    const reflectionUniforms = {
      uReflectionMap: { value: reflectionRenderTarget.texture },
      uReflectionMatrix: { value: reflectionTextureMatrix },
      uReflectionStrength: { value: FLOOR_REFLECTION_SETTINGS.strength },
      uReflectionBase: { value: FLOOR_REFLECTION_SETTINGS.baseStrength },
      uReflectionFresnelPower: {
        value: FLOOR_REFLECTION_SETTINGS.fresnelPower,
      },
      uReflectionDistort: { value: FLOOR_REFLECTION_SETTINGS.normalDistort },
    };
    let reflectionFloorMesh: THREE.Mesh | null = null;
    let reflectionDirty = true;
    let lastReflectionRenderedAt = Number.NEGATIVE_INFINITY;
    // The mirror camera sits below the floor plane, so rays at grazing
    // angles can slip under the wall bottoms and out of the closed hall. If
    // they cleared to the bright page background they would smear as glowing
    // bands along the wall bases -- clear the mirror pass to darkness so an
    // escaped ray simply reflects nothing.
    const reflectionClearColor = new THREE.Color(0x0b0908);
    const lastReflectionCameraMatrix = new THREE.Matrix4();
    const reflectionCameraPosition = new THREE.Vector3();
    const reflectionCameraDirection = new THREE.Vector3();
    const reflectionCameraUp = new THREE.Vector3();
    const reflectionLookTarget = new THREE.Vector3();
    const invalidateReflection = () => {
      reflectionDirty = true;
    };

    const renderFloorReflection = (now: number) => {
      camera.updateMatrixWorld();
      const cameraElements = camera.matrixWorld.elements;

      // Mirror the camera's world position and basis across y = floorY. The
      // mirrored up vector keeps triangle winding consistent, so no cull-face
      // juggling is needed.
      reflectionCameraPosition.set(
        cameraElements[12],
        2 * layout.floorY - cameraElements[13],
        cameraElements[14]
      );
      reflectionCameraDirection
        .set(-cameraElements[8], cameraElements[9], -cameraElements[10])
        .normalize();
      reflectionCameraUp
        .set(cameraElements[4], -cameraElements[5], cameraElements[6])
        .normalize();

      reflectionCamera.fov = camera.fov;
      reflectionCamera.aspect = camera.aspect;
      reflectionCamera.near = camera.near;
      reflectionCamera.far = camera.far;
      reflectionCamera.position.copy(reflectionCameraPosition);
      reflectionCamera.up.copy(reflectionCameraUp);
      reflectionLookTarget
        .copy(reflectionCameraPosition)
        .add(reflectionCameraDirection);
      reflectionCamera.lookAt(reflectionLookTarget);
      reflectionCamera.updateProjectionMatrix();
      reflectionCamera.updateMatrixWorld();

      reflectionTextureMatrix
        .copy(reflectionBiasMatrix)
        .multiply(reflectionCamera.projectionMatrix)
        .multiply(reflectionCamera.matrixWorldInverse);

      if (reflectionFloorMesh) {
        reflectionFloorMesh.visible = false;
      }
      const previousBackground = scene.background;
      scene.background = reflectionClearColor;
      const previousRenderTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(reflectionRenderTarget);
      renderer.render(scene, reflectionCamera);
      renderer.setRenderTarget(previousRenderTarget);
      scene.background = previousBackground;
      if (reflectionFloorMesh) {
        reflectionFloorMesh.visible = true;
      }

      reflectionDirty = false;
      lastReflectionRenderedAt = now;
      lastReflectionCameraMatrix.copy(camera.matrixWorld);
    };

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
    // fog: false — otherwise the darkened stand-ins would fade toward the
    // bright fog color at distance and the bloom passes would bloom the haze.
    const darkBloomMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      fog: false,
    });
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
      ] = await Promise.all([
        import('three/examples/jsm/postprocessing/EffectComposer.js'),
        import('three/examples/jsm/postprocessing/RenderPass.js'),
        import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
        import('three/examples/jsm/postprocessing/ShaderPass.js'),
      ]);

      if (!isMounted) return;

      const { width, height } = getRenderSize();
      const pixelRatio = getCappedDpr(width, height, usesMobileDpr);
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
      // Once this composer takes over, the canvas' own MSAA framebuffer no
      // longer rasterizes the scene -- these targets do. Without samples the
      // base render loses antialiasing and the frames' sub-pixel specular
      // glints shimmer during camera moves. Only the read buffer needs MSAA:
      // the scene RenderPass rasterizes into it, and because the grade pass
      // below never swaps buffers, the read buffer is renderTarget2 on every
      // frame while renderTarget1 receives no draws at all. (The bloom
      // composers stay unsampled: their scene passes are black except the
      // emissive sources, and the blur pyramid low-passes any aliasing.)
      nextComposer.renderTarget2.samples = 2;
      nextComposer.setPixelRatio(pixelRatio);
      nextComposer.setSize(width, height);
      nextComposer.addPass(new RenderPass(scene, camera));
      // The combine pass doubles as the color grade: warm tint, vignette,
      // and fine grain ride along in the shader that already runs, so the
      // grade costs zero extra passes. It also renders straight to the
      // canvas and ends with three's tonemapping/colorspace chunks -- for a
      // to-screen ShaderMaterial the renderer injects the active tone
      // mapping (ACES + exposure) and sRGB output transform, which is
      // exactly what a trailing OutputPass would do, minus one
      // full-resolution pass.
      finalBloomMaterial = new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: nextBloomComposer.renderTarget2.texture },
          chandelierBloomTexture: {
            value: nextChandelierBloomComposer.renderTarget2.texture,
          },
          uAspect: { value: width / Math.max(1, height) },
          uVignetteStrength: {
            value: FINAL_GRADE_SETTINGS.vignetteStrength,
          },
          uVignetteInner: { value: FINAL_GRADE_SETTINGS.vignetteInner },
          uVignetteOuter: { value: FINAL_GRADE_SETTINGS.vignetteOuter },
          uGrainAmount: { value: FINAL_GRADE_SETTINGS.grainAmount },
          uWarmTint: {
            value: new THREE.Vector3(...FINAL_GRADE_SETTINGS.warmTint),
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
          uniform float uAspect;
          uniform float uVignetteStrength;
          uniform float uVignetteInner;
          uniform float uVignetteOuter;
          uniform float uGrainAmount;
          uniform vec3 uWarmTint;
          varying vec2 vUv;
          void main() {
            vec4 base = texture2D(baseTexture, vUv);
            vec3 color =
              base.rgb +
              texture2D(bloomTexture, vUv).rgb +
              texture2D(chandelierBloomTexture, vUv).rgb;

            color *= uWarmTint;

            vec2 centered = vUv - 0.5;
            centered.x *= uAspect;
            float vignette = smoothstep(
              uVignetteInner,
              uVignetteOuter,
              length(centered) * 2.0
            );
            color *= 1.0 - uVignetteStrength * vignette;

            float grain =
              fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
            color += (grain - 0.5) * uGrainAmount;

            gl_FragColor = vec4(color, base.a);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      });
      const nextFinalBloomPass = new ShaderPass(
        finalBloomMaterial,
        'baseTexture'
      );
      // This pass draws to the screen, so the composer's read/write swap
      // after it would only alternate which buffer the RenderPass draws
      // into next frame -- off of the MSAA buffer on odd frames. Pin it.
      nextFinalBloomPass.needsSwap = false;
      nextComposer.addPass(nextFinalBloomPass);

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
      invalidateReflection();
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
        if (!isMounted) return;
        invalidateReflection();
        requestRenderLoop();
      });
      configureTexture(texture, repeatX, repeatY, textureAnisotropy);
      loadedTextures.push(texture);
      return texture;
    };

    const loadSingleSurfaceTexture = (url: string) => {
      const texture = textureLoader.load(url, () => {
        if (!isMounted) return;
        invalidateReflection();
        requestRenderLoop();
      });
      configureSingleSurfaceTexture(texture, textureAnisotropy);
      loadedTextures.push(texture);
      return texture;
    };

    const loadBumpTexture = (url: string, repeatX: number, repeatY: number) => {
      const texture = textureLoader.load(url, () => {
        if (!isMounted) return;
        invalidateReflection();
        requestRenderLoop();
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
    const floorTextureRepeat = {
      x: Math.max(
        1,
        floorDrawWidth / sceneUnitsPerMeter / FLOOR_TEXTURE_SIZE_METERS
      ),
      y: Math.max(
        1,
        hallLength / sceneUnitsPerMeter / FLOOR_TEXTURE_SIZE_METERS
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
    const floorBaseTexture = loadTexture(
      floorBaseTextureUrl,
      floorTextureRepeat.x,
      floorTextureRepeat.y
    );
    const floorNormalTexture = loadBumpTexture(
      floorNormalTextureUrl,
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
      map: floorBaseTexture,
      normalMap: floorNormalTexture,
      normalScale: new THREE.Vector2(0.8, 0.8),
      color: 0xffffff,
      roughness: 0.34,
      metalness: 0,
    });
    // The oversized neon RectAreaLights are diffuse wall-wash fakes (see
    // GALLERY_LIGHTING.neon); on glossy marble their specular lobe reads as
    // a giant false sheen across the distant floor. The floor's shader keeps
    // their diffuse wash and discards their specular. Declared outside the
    // unrolled loop body -- three duplicates the body per light.
    const floorLightsFragmentBegin = THREE.ShaderChunk.lights_fragment_begin
      .replace(
        'RectAreaLight rectAreaLight;',
        `RectAreaLight rectAreaLight;
	vec3 rectAreaSpecularBefore = vec3( 0.0 );`
      )
      .replace(
        'RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
        `rectAreaSpecularBefore = reflectedLight.directSpecular;
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
		reflectedLight.directSpecular = rectAreaSpecularBefore;`
      );
    // Inject the cached planar reflection into the marble shader: projective
    // sample of the mirror target, faded by fresnel and rippled by the
    // normal map so the polish reads as stone rather than a perfect mirror.
    // The floor gets NO environment map -- its only mirrored content is the
    // real scene from the planar reflection pass.
    floorMaterial.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, reflectionUniforms);
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_begin>',
        floorLightsFragmentBegin
      );
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform mat4 uReflectionMatrix;
          varying vec4 vReflectionCoord;`
        )
        .replace(
          '#include <fog_vertex>',
          `#include <fog_vertex>
          vReflectionCoord = uReflectionMatrix * modelMatrix * vec4( transformed, 1.0 );`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D uReflectionMap;
          uniform float uReflectionStrength;
          uniform float uReflectionBase;
          uniform float uReflectionFresnelPower;
          uniform float uReflectionDistort;
          varying vec4 vReflectionCoord;`
        )
        .replace(
          '#include <opaque_fragment>',
          `{
            vec3 reflectionViewDir = normalize( vViewPosition );
            float reflectionFresnel = pow(
              clamp( 1.0 - dot( normalize( normal ), reflectionViewDir ), 0.0, 1.0 ),
              uReflectionFresnelPower
            );
            vec2 reflectionUv = vReflectionCoord.xy / max( vReflectionCoord.w, 1e-4 );
            // Perturb only by the normal-map deviation; using the full
            // view-space normal would shift the whole reflection at grazing
            // angles instead of rippling it.
            reflectionUv += ( normal.xy - nonPerturbedNormal.xy ) * uReflectionDistort;
            vec3 reflectionSample = texture2D( uReflectionMap, clamp( reflectionUv, 0.0, 1.0 ) ).rgb;
            outgoingLight += reflectionSample * ( uReflectionBase + uReflectionStrength * reflectionFresnel );
          }
          #include <opaque_fragment>`
        );
    };
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

    // Specular-only environment on the glossy materials; the matte plaster,
    // mats, and props receive no environment at all -- their light comes
    // exclusively from the in-scene fixtures.
    const specularEnvironmentMaterials: Array<
      [THREE.MeshPhysicalMaterial, number]
    > = [
      [walnutMaterial, 0.5],
      [goldMaterial, 0.65],
      [ebonyMaterial, 0.5],
      [plaqueMaterial, 0.7],
    ];
    specularEnvironmentMaterials.forEach(([material, intensity]) => {
      material.envMap = environmentTexture;
      material.envMapIntensity = intensity;
      material.onBeforeCompile = injectSpecularOnlyEnvironment;
    });

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
    // Marble lies much flatter than the old carpet; a whisper of ripple keeps
    // reflections from being laser-perfect.
    roughenPlane(floorGeometry, 0.0015);
    environmentGeometries.push(floorGeometry);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, layout.floorY, hallCenterZ);
    floor.receiveShadow = true;
    scene.add(floor);
    reflectionFloorMesh = floor;

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

    // Baseboards are grounded: the board sinks slightly into the floor and
    // the cap sits flush on the board. Floating skirting used to expose its
    // unlit underside and a dark slot to the floor mirror, which read as
    // dashed black lines along the walls in the reflection.
    addBaseboard('left', layout.floorY + 0.1175, 0.295, 0.18);
    addBaseboard('right', layout.floorY + 0.1175, 0.295, 0.18);
    addBaseboard('left', layout.floorY + 0.2775, 0.025, 0.055);
    addBaseboard('right', layout.floorY + 0.2775, 0.025, 0.055);

    const endBaseboard = new THREE.Mesh(unitBox, baseboardMaterial);
    endBaseboard.scale.set(layout.hallwayWidth, 0.295, 0.18);
    endBaseboard.position.set(0, layout.floorY + 0.1175, hallEndZ + 0.09);
    endBaseboard.castShadow = true;
    endBaseboard.receiveShadow = true;
    scene.add(endBaseboard);

    const endBaseboardCap = new THREE.Mesh(unitBox, baseboardMaterial);
    endBaseboardCap.scale.set(layout.hallwayWidth, 0.025, 0.055);
    endBaseboardCap.position.set(0, layout.floorY + 0.2775, hallEndZ + 0.03);
    endBaseboardCap.castShadow = true;
    endBaseboardCap.receiveShadow = true;
    scene.add(endBaseboardCap);

    const startBaseboard = new THREE.Mesh(unitBox, baseboardMaterial);
    startBaseboard.scale.set(layout.hallwayWidth, 0.295, 0.18);
    startBaseboard.position.set(0, layout.floorY + 0.1175, hallStartZ - 0.09);
    startBaseboard.castShadow = true;
    startBaseboard.receiveShadow = true;
    scene.add(startBaseboard);

    const startBaseboardCap = new THREE.Mesh(unitBox, baseboardMaterial);
    startBaseboardCap.scale.set(layout.hallwayWidth, 0.025, 0.055);
    startBaseboardCap.position.set(
      0,
      layout.floorY + 0.2775,
      hallStartZ - 0.03
    );
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

        if (intro.signReadyAt < 0) {
          intro.signReadyAt = performance.now();
        }
        invalidateReflection();

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
        new THREE.SphereGeometry(0.18 * scale, chSeg(14, 8), chSeg(18, 8)),
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
        new THREE.TubeGeometry(
          curve,
          chSeg(64, 24),
          0.026,
          chSeg(18, 8),
          false
        ),
        chandelierCableMaterial
      );
      addChandelierMesh(
        parent,
        new THREE.CylinderGeometry(0.05, 0.06, 0.1, chSeg(24, 12)),
        chandelierAgedGoldMaterial,
        [0, topY + 0.015, 0]
      );
      addChandelierMesh(
        parent,
        new THREE.CylinderGeometry(0.044, 0.052, 0.09, chSeg(24, 12)),
        chandelierAgedGoldMaterial,
        [0, bottomY - 0.015, 0]
      );
    };

    const createReferenceChandelier = () => {
      const chandelier = new THREE.Group();
      const beadGeometry = new THREE.SphereGeometry(
        0.043,
        chSeg(18, 8),
        chSeg(12, 6)
      );
      chandelierGeometries.add(beadGeometry);

      addChandelierMesh(
        chandelier,
        new THREE.CylinderGeometry(0.74, 0.84, 0.12, chSeg(96, 24)),
        chandelierDarkGoldMaterial,
        [0, 3.62, 0]
      );
      addChandelierMesh(
        chandelier,
        new THREE.TorusGeometry(0.79, 0.035, chSeg(14, 8), chSeg(128, 48)),
        chandelierAgedGoldMaterial,
        [0, 3.55, 0],
        [Math.PI / 2, 0, 0]
      );
      addChandelierMesh(
        chandelier,
        new THREE.CylinderGeometry(0.34, 0.45, 0.2, chSeg(96, 24)),
        chandelierAgedGoldMaterial,
        [0, 3.42, 0]
      );
      addChandelierMesh(
        chandelier,
        new THREE.TorusGeometry(0.39, 0.035, chSeg(14, 8), chSeg(96, 36)),
        chandelierDarkGoldMaterial,
        [0, 3.31, 0],
        [Math.PI / 2, 0, 0]
      );
      addCable(chandelier);

      addChandelierMesh(
        chandelier,
        new THREE.CylinderGeometry(0.09, 0.09, 1.75, chSeg(48, 16)),
        chandelierAgedGoldMaterial,
        [0, 1.55, 0]
      );
      addChandelierMesh(
        chandelier,
        new THREE.SphereGeometry(0.18, chSeg(48, 16), chSeg(24, 10)),
        chandelierAgedGoldMaterial,
        [0, 2.34, 0],
        [0, 0, 0],
        [1, 0.8, 1]
      );
      addChandelierMesh(
        chandelier,
        new THREE.SphereGeometry(0.25, chSeg(64, 20), chSeg(28, 12)),
        chandelierAgedGoldMaterial,
        [0, 1.22, 0],
        [0, 0, 0],
        [1, 0.72, 1]
      );
      addChandelierMesh(
        chandelier,
        new THREE.SphereGeometry(0.16, chSeg(48, 16), chSeg(24, 10)),
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
            chSeg(radial as number, 8),
            chSeg(tubular as number, 48)
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
          chSeg(96, 28),
          chSeg(24, 10),
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
        new THREE.TorusGeometry(0.71, 0.028, chSeg(14, 8), chSeg(128, 48)),
        chandelierAgedGoldMaterial,
        [0, 0.78, 0],
        [Math.PI / 2, 0, 0]
      );
      addChandelierMesh(
        chandelier,
        new THREE.TorusGeometry(0.42, 0.018, chSeg(10, 6), chSeg(96, 36)),
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
          new THREE.TubeGeometry(
            curve,
            chSeg(72, 28),
            0.035,
            chSeg(16, 8),
            false
          ),
          chandelierAgedGoldMaterial
        );
        addChandelierMesh(
          arm,
          new THREE.TorusGeometry(
            0.25,
            0.018,
            chSeg(10, 6),
            chSeg(52, 24),
            Math.PI * 1.42
          ),
          chandelierDarkGoldMaterial,
          [1.05, y - 0.15, 0],
          [0, Math.PI / 2, 0.2],
          [1, 0.7, 1]
        );
        addChandelierMesh(
          arm,
          new THREE.TorusGeometry(
            0.17,
            0.014,
            chSeg(10, 6),
            chSeg(44, 20),
            Math.PI * 1.55
          ),
          chandelierAgedGoldMaterial,
          [1.48, y - 0.05, 0],
          [0, -Math.PI / 2, -0.45],
          [1, 0.7, 1]
        );
        addChandelierMesh(
          arm,
          new THREE.CylinderGeometry(0.19, 0.29, 0.18, chSeg(64, 20)),
          chandelierAgedGoldMaterial,
          [radius, y + 0.21, 0]
        );
        addChandelierMesh(
          arm,
          new THREE.TorusGeometry(0.29, 0.035, chSeg(14, 8), chSeg(90, 36)),
          chandelierAgedGoldMaterial,
          [radius, y + 0.32, 0],
          [Math.PI / 2, 0, 0]
        );
        addChandelierMesh(
          arm,
          new THREE.TorusGeometry(0.19, 0.022, chSeg(10, 6), chSeg(70, 28)),
          chandelierDarkGoldMaterial,
          [radius, y + 0.39, 0],
          [Math.PI / 2, 0, 0]
        );
        addChandelierMesh(
          arm,
          new THREE.CylinderGeometry(0.13, 0.13, 0.42, chSeg(48, 16)),
          chandelierCandleSleeveMaterial,
          [radius, y + 0.62, 0]
        );
        addChandelierMesh(
          arm,
          new THREE.CylinderGeometry(0.105, 0.13, 0.09, chSeg(48, 16)),
          chandelierAgedGoldMaterial,
          [radius, y + 0.39, 0]
        );
        addChandelierMesh(
          arm,
          new THREE.SphereGeometry(0.135, chSeg(36, 14), chSeg(24, 10)),
          chandelierBulbLitMaterial,
          [radius, y + 0.89, 0],
          [0, 0, 0],
          [0.82, 1.28, 0.82]
        );
        addChandelierMesh(
          arm,
          new THREE.SphereGeometry(0.09, chSeg(24, 10), chSeg(16, 8)),
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
          new THREE.TubeGeometry(
            curve,
            chSeg(52, 20),
            0.025,
            chSeg(14, 7),
            false
          ),
          chandelierAgedGoldMaterial
        );
        addChandelierMesh(
          arm,
          new THREE.CylinderGeometry(0.1, 0.16, 0.12, chSeg(48, 16)),
          chandelierAgedGoldMaterial,
          [1.18, y + 0.47, 0]
        );
        addChandelierMesh(
          arm,
          new THREE.SphereGeometry(0.08, chSeg(24, 10), chSeg(18, 8)),
          chandelierFlameGlowMaterial,
          [1.18, y + 0.66, 0],
          [0, 0, 0],
          [0.9, 1.55, 0.9],
          false
        );
        addChandelierMesh(
          arm,
          new THREE.SphereGeometry(0.105, chSeg(24, 10), chSeg(18, 8)),
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
    // Full-detail chandeliers at every anchor. The hand-built reference
    // model is merged into one geometry per material -- shared across all
    // anchors -- so each fixture costs ~10 draw calls instead of hundreds of
    // meshes. Materials stay unlit MeshBasic: under the glow and bloom the
    // frame reads as silhouette and sparkle, not surface detail.
    const referenceChandelier = createReferenceChandelier();
    referenceChandelier.updateMatrixWorld(true);

    const chandelierMergeBuckets = new Map<
      THREE.Material,
      THREE.BufferGeometry[]
    >();
    const chandelierBloomGlowParts: THREE.BufferGeometry[] = [];
    const chandelierBloomGlowScaleMatrix = new THREE.Matrix4().makeScale(
      CHANDELIER_BLOOM_SETTINGS.glowScale,
      CHANDELIER_BLOOM_SETTINGS.glowScale,
      CHANDELIER_BLOOM_SETTINGS.glowScale
    );

    referenceChandelier.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      const material = object.material as THREE.Material;
      const transformed = object.geometry.clone();
      transformed.applyMatrix4(object.matrixWorld);
      const bucket = chandelierMergeBuckets.get(material);

      if (bucket) {
        bucket.push(transformed);
      } else {
        chandelierMergeBuckets.set(material, [transformed]);
      }

      if (material === chandelierFlameGlowMaterial) {
        // The chandelier bloom pass draws enlarged copies of the flame glows
        // only, mirroring the old imposter bloom rig.
        const glow = object.geometry.clone();
        glow.applyMatrix4(chandelierBloomGlowScaleMatrix);
        glow.applyMatrix4(object.matrixWorld);
        chandelierBloomGlowParts.push(glow);
      }
    });

    // The builder geometries were folded into the merged buffers above.
    referenceChandelier.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
      }
    });
    chandelierGeometries.clear();

    const chandelierBaseMeshes: THREE.Mesh[] = [];
    const chandelierBloomGlowMeshes: THREE.Mesh[] = [];

    const addMergedChandelierMeshes = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      bloomOnly: boolean
    ) => {
      geometry.computeBoundingSphere();
      chandelierGeometries.add(geometry);
      chandelierAnchors.forEach((anchor) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `${CHANDELIER_LOD_NAME}-${bloomOnly ? 'bloom' : 'base'}-${
          anchor.index
        }`;
        mesh.position.copy(anchor.position);
        mesh.rotation.y = anchor.rotationY;
        mesh.scale.setScalar(chandelierScale);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        if (bloomOnly) {
          mesh.visible = false;
          mesh.layers.enable(CHANDELIER_BLOOM_SCENE_LAYER);
          chandelierBloomGlowMeshes.push(mesh);
        } else {
          chandelierBaseMeshes.push(mesh);
        }
        chandelierRoot.add(mesh);
      });
    };

    // The octahedron crystal tops are PolyhedronGeometry, which three builds
    // non-indexed, while every other primitive is indexed -- and
    // mergeGeometries refuses mixed buckets. Normalize such a bucket to
    // non-indexed before merging so no bucket is silently dropped.
    const mergeChandelierParts = (
      parts: THREE.BufferGeometry[]
    ): THREE.BufferGeometry | null => {
      const hasIndexed = parts.some((part) => part.index !== null);
      const hasNonIndexed = parts.some((part) => part.index === null);
      const normalizedParts =
        hasIndexed && hasNonIndexed
          ? parts.map((part) => {
              if (part.index === null) return part;
              const nonIndexed = part.toNonIndexed();
              part.dispose();
              return nonIndexed;
            })
          : parts;
      const merged = mergeGeometries(normalizedParts, false);
      normalizedParts.forEach((part) => part.dispose());
      return merged;
    };

    chandelierMergeBuckets.forEach((parts, material) => {
      const merged = mergeChandelierParts(parts);
      if (!merged) return;
      addMergedChandelierMeshes(merged, material, false);
    });

    if (chandelierBloomGlowParts.length > 0) {
      const mergedGlow = mergeChandelierParts(chandelierBloomGlowParts);
      if (mergedGlow) {
        addMergedChandelierMeshes(
          mergedGlow,
          chandelierBloomGlowMaterial,
          true
        );
      }
    }

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

    const setChandelierBloomGlowVisible = (visible: boolean) => {
      chandelierBloomGlowMeshes.forEach((mesh) => {
        mesh.visible = visible;
      });
    };
    const setChandelierBaseVisible = (visible: boolean) => {
      chandelierBaseMeshes.forEach((mesh) => {
        mesh.visible = visible;
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

    // Hall dressing: stanchion lines in front of every painting group and a
    // bench against the bare wall opposite. All static -- matrices are
    // written once and the meshes ride through the shadow, mirror, and bloom
    // passes like the rest of the furniture.
    const velvetTexture = createVelvetTexture(textureAnisotropy);
    const leatherTexture = createLeatherTexture(textureAnisotropy);
    const benchWoodTexture = createBenchWoodTexture(textureAnisotropy);
    loadedTextures.push(velvetTexture, leatherTexture, benchWoodTexture);

    // No environment map on any prop material: like the placeholder plaques,
    // these live mostly in unlit stretches of the hall where canned glints
    // at constant strength would read as wrong. The chandeliers, neon wash,
    // and painting spotlights provide their real highlights.
    const stanchionBrassMaterial = new THREE.MeshPhysicalMaterial({
      map: chandelierMetalNoise,
      color: 0xffc87c,
      metalness: 0.92,
      roughness: 0.3,
      clearcoat: 0.3,
      clearcoatRoughness: 0.26,
    });
    const velvetRopeMaterial = new THREE.MeshPhysicalMaterial({
      map: velvetTexture,
      bumpMap: velvetTexture,
      bumpScale: 0.02,
      roughness: 0.92,
      metalness: 0,
      // Asperity scattering is what sells velvet: a strong sheen lobe gives
      // the grazing-angle glow that flat diffuse red never has.
      sheen: 1,
      sheenRoughness: 0.38,
      sheenColor: GALLERY_PROPS_SETTINGS.rope.sheenColor,
    });
    const benchLeatherMaterial = new THREE.MeshPhysicalMaterial({
      map: leatherTexture,
      bumpMap: leatherTexture,
      bumpScale: 0.018,
      roughness: 0.52,
      metalness: 0,
      clearcoat: 0.16,
      clearcoatRoughness: 0.44,
      sheen: 0.28,
      sheenRoughness: 0.55,
      sheenColor: 0xffd9a8,
    });
    const benchWoodMaterial = new THREE.MeshPhysicalMaterial({
      map: benchWoodTexture,
      bumpMap: benchWoodTexture,
      bumpScale: 0.012,
      roughness: 0.4,
      metalness: 0.02,
      clearcoat: 0.5,
      clearcoatRoughness: 0.28,
    });
    materials.push(
      stanchionBrassMaterial,
      velvetRopeMaterial,
      benchLeatherMaterial,
      benchWoodMaterial
    );

    const stanchionGeometry = createStanchionGeometry(
      GALLERY_PROPS_SETTINGS.stanchion.radialSegments
    );
    const ropeGeometry = createVelvetRopeGeometry(
      layout.spacing,
      STANCHION_ROPE_ATTACH_Y,
      GALLERY_PROPS_SETTINGS.rope.sagRatio,
      GALLERY_PROPS_SETTINGS.rope.radius,
      GALLERY_PROPS_SETTINGS.rope.tubularSegments,
      GALLERY_PROPS_SETTINGS.rope.radialSegments
    );
    const benchLength = isMobile ? 2.5 : isTablet ? 3 : 3.4;
    const benchGeometries = createBenchGeometries(benchLength);
    environmentGeometries.push(
      stanchionGeometry,
      ropeGeometry,
      benchGeometries.cushion,
      benchGeometries.base
    );

    const groupFrameCount = (groupIndex: number) =>
      Math.max(1, getGroupEnd(groupIndex) - getGroupStart(groupIndex) + 1);
    let stanchionTotal = 0;
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
      stanchionTotal += groupFrameCount(groupIndex) + 1;
    }
    const ropeTotal = stanchionTotal - groupCount;

    const createPropMesh = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      count: number
    ) => {
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      scene.add(mesh);
      return mesh;
    };
    const stanchionMesh = createPropMesh(
      stanchionGeometry,
      stanchionBrassMaterial,
      stanchionTotal
    );
    const ropeMesh = createPropMesh(
      ropeGeometry,
      velvetRopeMaterial,
      ropeTotal
    );
    const benchCushionMesh = createPropMesh(
      benchGeometries.cushion,
      benchLeatherMaterial,
      groupCount
    );
    const benchBaseMesh = createPropMesh(
      benchGeometries.base,
      benchWoodMaterial,
      groupCount
    );

    const propDummy = new THREE.Object3D();
    const propFloorY = layout.floorY - GALLERY_PROPS_SETTINGS.floorSink;
    const benchRandom = createSeededRandom(0x5ea7cafe);
    let stanchionIndex = 0;
    let ropeIndex = 0;
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
      const side = getGroupSide(groupIndex);
      const normalX = side === 'left' ? 1 : -1;
      const wallX = side === 'left' ? -halfHallWidth : halfHallWidth;
      const groupZ = getGroupZ(groupIndex);
      const frameCount = groupFrameCount(groupIndex);
      const lineX =
        wallX + normalX * GALLERY_PROPS_SETTINGS.stanchion.wallOffset;

      // Posts stand at the frame-slot boundaries (one beyond each end), so
      // every rope span equals the frame spacing exactly and one swag
      // geometry fits every gap.
      for (let boundary = 0; boundary <= frameCount; boundary++) {
        const boundaryZ =
          groupZ + (boundary - 0.5 - (frameCount - 1) / 2) * layout.spacing;

        propDummy.position.set(lineX, propFloorY, boundaryZ);
        propDummy.rotation.set(0, 0, 0);
        propDummy.updateMatrix();
        stanchionMesh.setMatrixAt(stanchionIndex, propDummy.matrix);
        stanchionIndex += 1;

        if (boundary < frameCount) {
          propDummy.position.set(
            lineX,
            propFloorY,
            boundaryZ + layout.spacing / 2
          );
          propDummy.rotation.set(0, Math.PI / 2, 0);
          propDummy.updateMatrix();
          ropeMesh.setMatrixAt(ropeIndex, propDummy.matrix);
          ropeIndex += 1;
        }
      }

      // The bench faces the art from across the hall.
      const benchZ =
        groupZ +
        (benchRandom() - 0.5) * 2 * GALLERY_PROPS_SETTINGS.bench.zJitter;
      propDummy.position.set(
        -wallX - normalX * GALLERY_PROPS_SETTINGS.bench.wallOffset,
        propFloorY,
        benchZ
      );
      propDummy.rotation.set(0, Math.PI / 2, 0);
      propDummy.updateMatrix();
      benchCushionMesh.setMatrixAt(groupIndex, propDummy.matrix);
      benchBaseMesh.setMatrixAt(groupIndex, propDummy.matrix);
    }
    [stanchionMesh, ropeMesh, benchCushionMesh, benchBaseMesh].forEach(
      (mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    );

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
    // Placeholder plaques sit in unlit stretches of the hall, so they get a
    // variant without the environment map -- otherwise they'd glint in the
    // dark at constant strength.
    const placeholderPlaqueMaterial = plaqueMaterial.clone();
    placeholderPlaqueMaterial.envMap = null;
    materials.push(placeholderPlaqueMaterial);
    const placeholderPlaques = {
      body: new THREE.InstancedMesh(
        unitBox,
        placeholderPlaqueMaterial,
        urls.length
      ),
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

    const updateEmbedRecordVisibility = (
      record: FrameRecord,
      now: number | null
    ) => {
      // The embed fades with its painting light instead of popping — during
      // group transitions and during the intro reveal alike.
      const needsAnimatedFactor =
        cameraTransition !== null || intro.phase !== 'done';
      const effectiveNow =
        now ?? (needsAnimatedFactor ? performance.now() : null);
      const factor = !record.embedMounted
        ? 0
        : effectiveNow === null
          ? 1
          : clamp(getRecordLightFactor(record, effectiveNow), 0, 1);

      record.element.style.opacity = factor.toFixed(3);
      record.element.style.pointerEvents =
        record.embedMounted && factor > 0.55 ? 'auto' : 'none';
    };

    const updateEmbedVisibility = (now: number | null) => {
      activeFrames.forEach((record) =>
        updateEmbedRecordVisibility(record, now)
      );
    };

    const runQueuedEmbedLoads = () => {
      if (!isMounted) return;

      while (
        activeEmbedLoadCount < maxConcurrentEmbedLoads &&
        queuedEmbedLoads.length > 0
      ) {
        const loadEmbed = queuedEmbedLoads.shift();
        if (!loadEmbed) return;

        activeEmbedLoadCount += 1;
        loadEmbed()
          .catch(() => {
            // Individual card failures are handled in the task itself.
          })
          .finally(() => {
            activeEmbedLoadCount = Math.max(0, activeEmbedLoadCount - 1);
            runQueuedEmbedLoads();
          });
      }
    };

    const enqueueEmbedLoad = (loadEmbed: () => Promise<void>) => {
      queuedEmbedLoads.push(loadEmbed);
      runQueuedEmbedLoads();
    };

    const removeEmbedCacheOrderKey = (cacheKey: string) => {
      const orderIndex = embedCacheOrder.indexOf(cacheKey);
      if (orderIndex >= 0) {
        embedCacheOrder.splice(orderIndex, 1);
      }
    };

    const evictCachedEmbed = (cacheKey: string) => {
      const entry = embedCache.get(cacheKey);
      if (!entry) return;

      if (entry.attachedRecordIndex !== null) {
        const attachedRecord = activeFrames.get(entry.attachedRecordIndex);
        if (attachedRecord?.cacheKey === cacheKey) {
          attachedRecord.embedMounted = false;
          attachedRecord.embedRequested = false;
          attachedRecord.embedRequestId = 0;
          attachedRecord.cacheKey = undefined;
          attachedRecord.element.innerHTML = '';
          updateEmbedRecordVisibility(attachedRecord, null);
        }
      }

      entry.observer.disconnect();
      entry.element.remove();
      embedCache.delete(cacheKey);
      removeEmbedCacheOrderKey(cacheKey);
    };

    const enforceEmbedCacheLimit = () => {
      while (embedCacheOrder.length > MAX_CACHED_INSTAGRAM_IFRAMES) {
        const evictableKey =
          embedCacheOrder.find((cacheKey) => {
            const entry = embedCache.get(cacheKey);
            return entry?.attachedRecordIndex === null;
          }) ?? embedCacheOrder[0];

        evictCachedEmbed(evictableKey);
      }
    };

    const isRecordEmbedRequestCurrent = (
      record: FrameRecord,
      requestId: number
    ) =>
      isMounted &&
      activeFrames.get(record.index) === record &&
      record.embedRequestId === requestId;

    const detachEmbedFromRecord = (record: FrameRecord) => {
      record.embedRequested = false;
      record.embedRequestId = 0;

      if (record.cacheKey) {
        const entry = embedCache.get(record.cacheKey);
        if (
          entry &&
          entry.attachedRecordIndex === record.index &&
          entry.element.parentElement === record.element
        ) {
          embedCacheHost.appendChild(entry.element);
          entry.attachedRecordIndex = null;
        }
      } else {
        record.element.innerHTML = '';
      }

      record.embedMounted = false;
      record.cacheKey = undefined;
      updateEmbedRecordVisibility(record, null);
    };

    const attachCachedEmbedToRecord = (
      record: FrameRecord,
      entry: CachedInstagramEmbed
    ) => {
      if (record.cacheKey === entry.key && record.embedMounted) {
        updateEmbedRecordVisibility(
          record,
          cameraTransition ? performance.now() : null
        );
        return;
      }

      if (record.cacheKey && record.cacheKey !== entry.key) {
        detachEmbedFromRecord(record);
      }

      if (
        entry.attachedRecordIndex !== null &&
        entry.attachedRecordIndex !== record.index
      ) {
        const previousRecord = activeFrames.get(entry.attachedRecordIndex);
        if (previousRecord?.cacheKey === entry.key) {
          previousRecord.embedMounted = false;
          previousRecord.cacheKey = undefined;
          updateEmbedRecordVisibility(previousRecord, null);
        }
      }

      record.element.replaceChildren(entry.element);
      entry.attachedRecordIndex = record.index;
      record.cacheKey = entry.key;
      record.embedMounted = true;
      record.embedRequested = false;
      record.embedRequestId = 0;
      enhanceInstagramIframes(record.element, record.index);
      updateEmbedRecordVisibility(
        record,
        cameraTransition ? performance.now() : null
      );
      invalidateCssRender();
      requestRenderLoop();
    };

    const requestEmbedForRecord = (record: FrameRecord) => {
      if (record.embedMounted || record.embedRequested) return;

      const url = urls[record.index];
      const cacheKey = getInstagramEmbedCacheKey(url);
      const cachedEmbed = embedCache.get(cacheKey);
      if (cachedEmbed) {
        attachCachedEmbedToRecord(record, cachedEmbed);
        return;
      }

      record.embedRequested = true;
      record.embedRequestId = ++embedRequestSequence;
      const requestId = record.embedRequestId;

      enqueueEmbedLoad(async () => {
        if (!isRecordEmbedRequestCurrent(record, requestId)) return;

        try {
          await loadInstagramEmbedScript();
          if (!isRecordEmbedRequestCurrent(record, requestId)) return;

          record.element.innerHTML = createMountedEmbedHtml(url);
          updateEmbedRecordVisibility(record, null);
          invalidateCssRender();
          requestRenderLoop();

          await requestInstagramEmbedProcess(record.element);
          const loadedEmbedRoot = await waitForHealthyInstagramEmbed(
            record.element,
            url
          );

          if (!isRecordEmbedRequestCurrent(record, requestId)) return;

          if (!loadedEmbedRoot) {
            throw new Error('Instagram embed failed health check.');
          }

          const existingCachedEmbed = embedCache.get(cacheKey);
          if (existingCachedEmbed) {
            loadedEmbedRoot.remove();
            attachCachedEmbedToRecord(record, existingCachedEmbed);
            return;
          }

          const observer = watchInstagramIframes(loadedEmbedRoot, record.index);
          const cacheEntry: CachedInstagramEmbed = {
            key: cacheKey,
            index: record.index,
            url,
            element: loadedEmbedRoot,
            observer,
            attachedRecordIndex: record.index,
          };

          embedCache.set(cacheKey, cacheEntry);
          embedCacheOrder.push(cacheKey);
          record.cacheKey = cacheKey;
          record.embedMounted = true;
          record.embedRequested = false;
          record.embedRequestId = 0;
          updateEmbedRecordVisibility(
            record,
            cameraTransition ? performance.now() : null
          );
          enforceEmbedCacheLimit();
          invalidateCssRender();
          requestRenderLoop();
        } catch {
          if (!isRecordEmbedRequestCurrent(record, requestId)) return;

          record.embedMounted = false;
          record.embedRequested = false;
          record.embedRequestId = 0;
          record.cacheKey = undefined;
          record.element.innerHTML = '';
          updateEmbedRecordVisibility(record, null);
          invalidateCssRender();
          requestRenderLoop();
        }
      });
    };

    const unmountEmbed = (record: FrameRecord) => {
      detachEmbedFromRecord(record);
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

    const frameMaterialVariants = [walnutMaterial, goldMaterial, ebonyMaterial];

    // A frame's environment glints must obey its local lighting: the shared
    // materials get a cheap per-record clone (same shader program -- only the
    // envMapIntensity uniform differs) so each frame's glints can fade with
    // its own light factor.
    const createEnvGlintMaterial = (
      source: THREE.MeshPhysicalMaterial
    ): THREE.MeshPhysicalMaterial => {
      const material = source.clone();
      // clone() does not carry onBeforeCompile; re-attach the specular-only
      // environment patch so the clone shares the source's program.
      material.onBeforeCompile = injectSpecularOnlyEnvironment;
      material.userData.baseEnvMapIntensity = source.envMapIntensity;
      material.envMapIntensity = 0;
      return material;
    };

    const createFrameRecord = (index: number): FrameRecord => {
      const placement = getFramePlacement(index);
      const frameMaterial = createEnvGlintMaterial(
        frameMaterialVariants[index % frameMaterialVariants.length]
      );
      const framePlaqueMaterial = createEnvGlintMaterial(plaqueMaterial);
      const { group, paintingSpotlight } = createFrameGroup({
        index,
        x: 0,
        isMobile,
        layout,
        materials: {
          frame: [frameMaterial],
          backing: backingMaterial,
          placeholderArt:
            placeholderArtMaterials[index % placeholderArtMaterials.length],
          plaque: framePlaqueMaterial,
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
        envGlintMaterials: [frameMaterial, framePlaqueMaterial],
        embedMounted: false,
        embedRequested: false,
        embedRequestId: 0,
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
      record.envGlintMaterials.forEach((material) => material.dispose());
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
          requestEmbedForRecord(record);
          return;
        }

        detachEmbedFromRecord(record);
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
        const recordGroupIndex = getFramePlacement(index).groupIndex;
        if (
          recordGroupIndex !== fromGroupIndex &&
          recordGroupIndex !== toGroupIndex
        ) {
          detachEmbedFromRecord(record);
          return;
        }

        if (index >= embedStart && index <= embedEnd) {
          requestEmbedForRecord(record);
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
      const pixelRatio = getCappedDpr(width, height, usesMobileDpr);

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
      if (finalBloomMaterial) {
        finalBloomMaterial.uniforms.uAspect.value = width / Math.max(1, height);
      }
      const reflectionSize = getReflectionSize(width, height);
      reflectionRenderTarget.setSize(
        reflectionSize.width,
        reflectionSize.height
      );
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
      if (cameraTransition || intro.phase !== 'done') return;

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
        (LONG_JUMP_CRUISE_SPEED_UNITS_PER_SECOND * (baseTurnDuration / 1000)) /
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
        setChandelierBloomGlowVisible(false);
        activeBloomLayer = bloomLayer;
        scene.traverseVisible(darkenVisibleNonBloomed);
        try {
          bloomComposer.render();
        } finally {
          restoreDarkenedBloomMeshes();
        }

        setChandelierBloomGlowVisible(true);
        setChandelierBaseVisible(false);
        activeBloomLayer = chandelierBloomLayer;
        scene.traverseVisible(darkenVisibleNonBloomed);
        try {
          chandelierBloomComposer.render();
        } finally {
          restoreDarkenedBloomMeshes();
          setChandelierBloomGlowVisible(false);
          setChandelierBaseVisible(true);
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

    // During the intro reveal, group 0's lights warm up in sequence: the
    // ceiling wash first, then each painting light (and its embed) with a
    // short stagger.
    const getIntroWarmLightFloor = (groupIndex: number): number =>
      introLightsWarmed && groupIndex === 0
        ? INTRO_SETTINGS.warmLightFactor
        : 0;

    const getRecordLightFactor = (
      record: FrameRecord,
      now: number | null
    ): number => {
      const groupIndex = getFramePlacement(record.index).groupIndex;

      if (intro.phase !== 'done') {
        const warmFloor = getIntroWarmLightFloor(groupIndex);
        if (groupIndex !== 0 || intro.phase !== 'reveal' || now === null) {
          return warmFloor;
        }

        const slot = record.index - getGroupStart(groupIndex);
        return Math.max(
          warmFloor,
          smoothstep(
            0,
            PAINTING_LIGHT_ON_MS,
            now -
              intro.revealStartedAt -
              INTRO_SETTINGS.ceilingLeadMs -
              slot * INTRO_SETTINGS.lightStaggerMs
          )
        );
      }

      return getGroupLightFactor(groupIndex, now);
    };

    const getCeilingLightFactor = (
      groupIndex: number,
      now: number | null
    ): number => {
      if (intro.phase !== 'done') {
        const warmFloor = getIntroWarmLightFloor(groupIndex);
        if (groupIndex !== 0 || intro.phase !== 'reveal' || now === null) {
          return warmFloor;
        }

        return Math.max(
          warmFloor,
          smoothstep(0, PAINTING_LIGHT_ON_MS, now - intro.revealStartedAt)
        );
      }

      return getGroupLightFactor(groupIndex, now);
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
        const factor = getRecordLightFactor(record, now);
        setPaintingSpotlightFactor(record, factor);
        record.envGlintMaterials.forEach((material) => {
          const baseIntensity =
            typeof material.userData.baseEnvMapIntensity === 'number'
              ? material.userData.baseEnvMapIntensity
              : 0;
          material.envMapIntensity = baseIntensity * factor;
        });
      });
    };

    const updateCeilingSpotlights = (now: number | null) => {
      activeCeilingSpotlights.forEach((spotlight, groupIndex) => {
        setCeilingSpotlightFactor(
          spotlight,
          getCeilingLightFactor(groupIndex, now)
        );
      });
    };

    // Subtle head bob + sway while the camera "walks". Time-based so the
    // fast cruise glide doesn't shake; weight fades it in and out around
    // turns and arrivals.
    const walkBobState = { offset: 0, roll: 0 };
    const computeWalkBob = (elapsedMs: number, weight: number) => {
      const seconds = elapsedMs / 1000;
      walkBobState.offset =
        Math.sin(seconds * Math.PI * 2 * WALK_BOB_SETTINGS.frequencyHz) *
        WALK_BOB_SETTINGS.amplitude *
        weight;
      walkBobState.roll =
        Math.sin(
          seconds * Math.PI * 2 * WALK_BOB_SETTINGS.rollFrequencyHz +
            Math.PI / 3
        ) *
        WALK_BOB_SETTINGS.rollAmplitude *
        weight;
      return walkBobState;
    };

    const introPose = createCameraPose();
    const introFinalPose = createCameraPose();
    const introDirection = new THREE.Vector3();
    const introArriveDirection = new THREE.Vector3();
    const introSignTarget = new THREE.Vector3(
      0,
      wallCenterY + INTRO_SETTINGS.signLookHeightOffset,
      hallStartZ
    );

    const getIntroHoldPose = (pushProgress: number): CameraPose => {
      introPose.position.set(
        0,
        layout.cameraY,
        introStartZ +
          INTRO_SETTINGS.pushDistance *
            easeInOutCubic(clamp(pushProgress, 0, 1))
      );
      introPose.target.copy(introSignTarget);
      return introPose;
    };

    const getIntroTravelPose = (t: number): CameraPose => {
      const clampedT = clamp(t, 0, 1);
      const eased = easeInOutCubic(clampedT);
      // Yaw path: face the entrance sign (0), swing across the left wall to
      // face down the hall (-PI), then blend onto the group-0 look.
      const startYaw = intro.hasSignMoment ? 0 : -Math.PI;
      const turnProgress = easeInOutCubic(clamp(clampedT / 0.42, 0, 1));
      const arriveProgress = easeInOutCubic(
        clamp((clampedT - 0.66) / 0.34, 0, 1)
      );
      const yaw = lerp(startYaw, -Math.PI, turnProgress);
      const hallwayPitch =
        (layout.frameY - layout.cameraY) / layout.transitionLookDistance;
      const signPitch = intro.hasSignMoment
        ? (introSignTarget.y - layout.cameraY) / Math.max(1, introSignDistance)
        : hallwayPitch;
      const pitch = lerp(signPitch, hallwayPitch, turnProgress);

      introDirection.set(Math.sin(yaw), pitch, Math.cos(yaw)).normalize();

      const finalPose = getCameraPose(0, 0, 0, introFinalPose);
      const travelStartZ = intro.hasSignMoment
        ? introStartZ + INTRO_SETTINGS.pushDistance
        : introStartZ;
      introPose.position.set(
        0,
        layout.cameraY,
        lerp(travelStartZ, finalPose.position.z, eased)
      );

      if (arriveProgress > 0) {
        introArriveDirection
          .copy(finalPose.target)
          .sub(finalPose.position)
          .normalize();
        introDirection.lerp(introArriveDirection, arriveProgress).normalize();
      }

      introPose.target
        .copy(introPose.position)
        .addScaledVector(introDirection, layout.transitionLookDistance);
      return introPose;
    };

    const getIntroPose = (now: number): CameraPose => {
      if (intro.phase === 'pending') {
        intro.phase = intro.hasSignMoment ? 'hold' : 'travel';
        intro.startedAt = now;
        intro.travelStartedAt = now;
        hasPlayedIntroRef.current = true;
      }

      if (intro.phase === 'hold') {
        const heldFor = now - intro.startedAt;
        // Hold on the flickering sign; if the GLB is still streaming in,
        // wait for it briefly so the moment isn't spent on a bare wall.
        const signSettled =
          intro.signReadyAt >= 0 &&
          now - intro.signReadyAt >= INTRO_SETTINGS.signSettleMs;
        const holdComplete =
          heldFor >= INTRO_SETTINGS.holdMs &&
          (signSettled ||
            heldFor >= INTRO_SETTINGS.holdMs + INTRO_SETTINGS.maxSignWaitMs);

        if (!holdComplete) {
          cameraRoll = 0;
          return getIntroHoldPose(heldFor / INTRO_SETTINGS.holdMs);
        }

        intro.phase = 'travel';
        intro.travelStartedAt = now;
      }

      if (intro.phase === 'travel') {
        const travelElapsed = now - intro.travelStartedAt;
        const t = travelElapsed / INTRO_SETTINGS.travelMs;

        if (t < 1) {
          const bobWeight =
            smoothstep(0.18, 0.36, t) * (1 - smoothstep(0.72, 0.9, t));
          const pose = getIntroTravelPose(t);
          const bob = computeWalkBob(travelElapsed, bobWeight);
          pose.position.y += bob.offset;
          pose.target.y += bob.offset * WALK_BOB_SETTINGS.targetFollow;
          cameraRoll = bob.roll;
          return pose;
        }

        intro.phase = 'reveal';
        intro.revealStartedAt = now;
        cameraNeedsCssRender = true;
      }

      // Reveal: camera has settled on group 0 while its lights stagger on;
      // pointer parallax blends in instead of snapping.
      const pointerBlend = smoothstep(
        0,
        INTRO_SETTINGS.pointerBlendMs,
        now - intro.revealStartedAt
      );
      const pose = getCameraPose(
        0,
        pointerX * pointerBlend,
        -pointerY * pointerBlend,
        renderPose
      );

      const revealSlots = Math.max(0, getGroupEnd(0) - getGroupStart(0));
      const revealDuration =
        INTRO_SETTINGS.ceilingLeadMs +
        PAINTING_LIGHT_ON_MS +
        INTRO_SETTINGS.lightStaggerMs * revealSlots +
        200;
      if (now - intro.revealStartedAt >= revealDuration) {
        intro.phase = 'done';
        setIsNavThrottled(false);
      }

      cameraRoll = 0;
      return pose;
    };

    // The reveal used to pay a one-off freeze: lights turning visible for
    // the first time changed the scene's light count, forcing synchronous
    // shader recompiles of every material plus first shadow-map builds,
    // right as the camera settled. Instead, compile the fully-lit program
    // variants in the background during the hold/travel phases, bake the
    // shadow maps into a throwaway target, and keep the lights visible at an
    // imperceptible intensity -- the reveal becomes a pure intensity ramp.
    const warmupIntroLighting = () => {
      if (intro.phase === 'done') return;

      const ceilingSpotlight = activeCeilingSpotlights.get(0) ?? null;
      const groupZeroRecords: FrameRecord[] = [];
      activeFrames.forEach((record) => {
        if (getFramePlacement(record.index).groupIndex === 0) {
          groupZeroRecords.push(record);
        }
      });

      const setWarmupLightsVisible = (visible: boolean) => {
        groupZeroRecords.forEach((record) => {
          record.paintingSpotlight.visible = visible;
        });
        if (ceilingSpotlight) {
          ceilingSpotlight.visible = visible;
        }
      };

      // Capture the fully-lit light state and issue every program compile
      // WITHOUT waiting -- drivers with parallel shader compilation finish
      // them in the background while the intro holds on the sign.
      // (renderer.compileAsync is deliberately avoided: its readiness
      // polling crashes if any compiled material is disposed mid-poll, e.g.
      // on a React remount.)
      setWarmupLightsVisible(true);
      try {
        renderer.compile(scene, camera);
      } catch {
        // Warmup is an optimization only; without it the reveal simply pays
        // the old one-off compile cost.
      } finally {
        setWarmupLightsVisible(false);
      }

      warmupTimeoutId = window.setTimeout(() => {
        warmupTimeoutId = 0;
        if (!isMounted) return;

        introLightsWarmed = true;
        if (intro.phase === 'reveal' || intro.phase === 'done') return;

        groupZeroRecords.forEach((record) => {
          setPaintingSpotlightFactor(record, INTRO_SETTINGS.warmLightFactor);
        });
        if (ceilingSpotlight) {
          setCeilingSpotlightFactor(
            ceilingSpotlight,
            INTRO_SETTINGS.warmLightFactor
          );
        }

        // This off-screen render force-finishes any still-pending program
        // links and bakes the shadow maps, so the reveal itself has nothing
        // left to pay.
        const warmupTarget = new THREE.WebGLRenderTarget(8, 8);
        const previousTarget = renderer.getRenderTarget();
        renderer.shadowMap.needsUpdate = true;
        renderer.setRenderTarget(warmupTarget);
        renderer.render(scene, camera);
        renderer.setRenderTarget(previousTarget);
        warmupTarget.dispose();
      }, INTRO_SETTINGS.warmupSettleMs);
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
        // A hair of overshoot at the end reads as a person stopping rather
        // than a dolly hitting its mark; the pulse returns to exactly 1.
        const easedProgress =
          easeInOutCubic(cameraProgress) +
          Math.sin(Math.PI * clamp((cameraProgress - 0.7) / 0.3, 0, 1)) *
            STEP_ARRIVAL_OVERSHOOT;
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
        transitionDirection.copy(toPose.target).sub(toPose.position);
      }
      transitionDirection.normalize();
      transitionResultPose.target
        .copy(position)
        .addScaledVector(transitionDirection, layout.transitionLookDistance);

      const walkElapsed = Math.max(0, elapsed - PAINTING_LIGHT_OFF_MS);
      const bobWeight =
        transition.mode === 'cruise'
          ? smoothstep(
              transition.turnDuration * 0.55,
              transition.turnDuration * 1.2,
              walkElapsed
            ) *
            (1 -
              smoothstep(
                transition.duration - transition.turnDuration * 1.2,
                transition.duration - transition.turnDuration * 0.55,
                walkElapsed
              ))
          : Math.sin(Math.PI * cameraProgress) * 0.55;
      const bob = computeWalkBob(walkElapsed, bobWeight);
      position.y += bob.offset;
      transitionResultPose.target.y +=
        bob.offset * WALK_BOB_SETTINGS.targetFollow;
      cameraRoll = bob.roll;

      transitionPoseResult.cameraProgress = cameraProgress;
      transitionPoseResult.elapsed = elapsed;

      return transitionPoseResult;
    };

    const renderFrame = (now: number) => {
      animationFrame = 0;
      cameraRoll = 0;
      let pose: CameraPose;
      let isSettling = false;

      if (intro.phase !== 'done') {
        pose = getIntroPose(now);
      } else if (cameraTransition) {
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
      if (cameraRoll !== 0) {
        camera.rotateZ(cameraRoll);
      }

      if (
        intro.phase === 'done' &&
        !cameraTransition &&
        targetGroupIndex !== currentGroupIndex
      ) {
        currentGroupIndex = targetGroupIndex;
        updateVirtualFrames(targetGroupIndex);
      }
      const animatedLightsNow =
        cameraTransition || intro.phase !== 'done' ? now : null;
      updatePaintingSpotlights(animatedLightsNow);
      updateCeilingSpotlights(animatedLightsNow);
      updateNeonSign();
      updateEmbedVisibility(animatedLightsNow);

      // Refresh the cached floor reflection when the camera moved or the
      // scene content changed; while parked with only the neon flickering,
      // throttle the mirror pass instead of paying it every frame.
      camera.updateMatrixWorld();
      const reflectionCameraMoved = !lastReflectionCameraMatrix.equals(
        camera.matrixWorld
      );
      if (
        reflectionDirty ||
        reflectionCameraMoved ||
        (shouldAnimateSettledNeon() &&
          now - lastReflectionRenderedAt >
            FLOOR_REFLECTION_SETTINGS.idleIntervalMs)
      ) {
        renderFloorReflection(now);
      }

      renderScene(
        cssNeedsRender ||
          cameraNeedsCssRender ||
          intro.phase !== 'done' ||
          Boolean(cameraTransition && !cameraTransition.settled)
      );

      if (
        cameraTransition ||
        intro.phase !== 'done' ||
        shouldAnimateSettledNeon()
      ) {
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
    setIsNavThrottled(intro.phase !== 'done');
    const initialPose =
      intro.phase !== 'done'
        ? intro.hasSignMoment
          ? getIntroHoldPose(0)
          : getIntroTravelPose(0)
        : getCameraPose(targetGroupIndex, 0, 0, renderPose);
    applyCameraPose(initialPose);
    applyResize(true);
    updateVirtualFrames(targetGroupIndex);
    currentGroupIndex = targetGroupIndex;
    updatePaintingSpotlights(null);
    updateCeilingSpotlights(null);
    updateEmbedVisibility(null);
    renderFloorReflection(performance.now());
    renderScene(true);
    setIsReady(true);
    if (intro.phase !== 'done') {
      requestRenderLoop();
      warmupIntroLighting();
    }

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
      window.clearTimeout(warmupTimeoutId);
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

      queuedEmbedLoads.length = 0;
      activeFrames.forEach(destroyFrameRecord);
      activeFrames.clear();
      [...embedCache.keys()].forEach(evictCachedEmbed);
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
      reflectionRenderTarget.dispose();
      environmentRenderTarget.dispose();
      renderer.dispose();
      webglHost.remove();
      cssHost.remove();
      embedCacheHost.remove();
    };
  }, [
    groupCount,
    isMobile,
    isTablet,
    layout,
    reducedMotion,
    sceneClassNames,
    urls,
  ]);

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
