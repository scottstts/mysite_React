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
  cameraZ: number;
  cameraFov: number;
  groupSize: number;
  frameWindowGroups: number;
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

const EMBED_WIDTH_PX = 326;
const EMBED_HEIGHT_PX = 492;
const INSTAGRAM_IFRAME_ALLOW =
  'clipboard-write; encrypted-media; picture-in-picture; web-share';
const GALLERY_LIGHTING = {
  exposure: 8.82,
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
  ceilingArea: {
    color: 0xffffff,
    intensity: 0.1,
    width: 8.4,
    height: 5.8,
    y: 4.35,
    z: 4.85,
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
let instagramProcessPromise: Promise<void> | null = null;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const lerp = (start: number, end: number, amount: number): number =>
  start + (end - start) * amount;

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
      cameraZ: 7.15,
      cameraFov: 47,
      groupSize: 1,
      frameWindowGroups: 1,
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
      cameraZ: 8.45,
      cameraFov: 41,
      groupSize: 2,
      frameWindowGroups: 1,
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
    cameraZ: 9.25,
    cameraFov: 40,
    groupSize: 3,
    frameWindowGroups: 1,
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

const requestInstagramEmbedProcess = (): Promise<void> => {
  if (instagramProcessPromise) {
    return instagramProcessPromise;
  }

  instagramProcessPromise = new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      try {
        window.instgrm?.Embeds.process();
      } catch {
        // Instagram's embed script throws minified invariants for duplicate or
        // transiently measured embeds. Keep the gallery surface stable.
      } finally {
        window.setTimeout(() => {
          instagramProcessPromise = null;
          resolve();
        }, 0);
      }
    });
  });

  return instagramProcessPromise;
};

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

const createFrameRingGeometry = (
  outerWidth: number,
  outerHeight: number,
  innerWidth: number,
  innerHeight: number,
  depth: number,
  bevelSize: number
) => {
  const outerHalfWidth = outerWidth / 2;
  const outerHalfHeight = outerHeight / 2;
  const innerHalfWidth = innerWidth / 2;
  const innerHalfHeight = innerHeight / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-outerHalfWidth, -outerHalfHeight);
  shape.lineTo(outerHalfWidth, -outerHalfHeight);
  shape.lineTo(outerHalfWidth, outerHalfHeight);
  shape.lineTo(-outerHalfWidth, outerHalfHeight);
  shape.lineTo(-outerHalfWidth, -outerHalfHeight);

  const hole = new THREE.Path();
  hole.moveTo(-innerHalfWidth, -innerHalfHeight);
  hole.lineTo(-innerHalfWidth, innerHalfHeight);
  hole.lineTo(innerHalfWidth, innerHalfHeight);
  hole.lineTo(innerHalfWidth, -innerHalfHeight);
  hole.lineTo(-innerHalfWidth, -innerHalfHeight);
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize,
    bevelThickness: bevelSize * 0.9,
    curveSegments: 1,
  });
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;

  if (uv) {
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;

    for (let index = 0; index < uv.count; index++) {
      const u = uv.getX(index);
      const v = uv.getY(index);
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }

    const rangeU = maxU - minU || 1;
    const rangeV = maxV - minV || 1;

    for (let index = 0; index < uv.count; index++) {
      uv.setXY(
        index,
        (uv.getX(index) - minU) / rangeU,
        (uv.getY(index) - minV) / rangeV
      );
    }

    uv.needsUpdate = true;
  }

  return geometry;
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
    [layout.postWidth + 0.08, layout.postHeight + 0.08, 0.045],
    [0, 0, 0.018],
    materials.backing,
    false
  );

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

  const plaqueGlint = new THREE.PointLight(
    GALLERY_LIGHTING.plaqueGlint.color,
    GALLERY_LIGHTING.plaqueGlint.intensity,
    GALLERY_LIGHTING.plaqueGlint.distance,
    GALLERY_LIGHTING.plaqueGlint.decay
  );
  plaqueGlint.name = 'artist-plaque-specular-light';
  plaqueGlint.position.set(
    0,
    plaqueY + GALLERY_LIGHTING.plaqueGlint.yOffset,
    GALLERY_LIGHTING.plaqueGlint.z
  );
  plaqueGlint.castShadow = false;
  group.add(plaqueGlint);

  const frameGeometry = createFrameRingGeometry(
    layout.frameOuterWidth,
    layout.frameOuterHeight,
    layout.postWidth + 0.1,
    layout.postHeight + 0.1,
    layout.frameDepth,
    0.07
  );
  const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
  frameMesh.name = 'beveled-frame';
  frameMesh.position.z = 0.055;
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;
  group.add(frameMesh);

  const spotlight = new THREE.SpotLight(
    GALLERY_LIGHTING.paintingSpot.color,
    GALLERY_LIGHTING.paintingSpot.intensity,
    GALLERY_LIGHTING.paintingSpot.distance,
    GALLERY_LIGHTING.paintingSpot.angle,
    GALLERY_LIGHTING.paintingSpot.penumbra,
    GALLERY_LIGHTING.paintingSpot.decay
  );
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
          window.instgrm?.Embeds.process();
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
    let targetCameraX = 0;
    let currentGroupIndex = -1;
    let ceilingAreaLight: THREE.RectAreaLight | null = null;
    let ceilingAreaSchedule: ScheduledWork | undefined;
    const activeFrames = new Map<number, FrameRecord>();
    const cachedFrames = new Map<number, FrameRecord>();
    const lastFrameIndex = urls.length - 1;
    const lastFrameX = Math.max(0, lastFrameIndex * layout.spacing);
    const maxGroupIndex = Math.max(0, groupCount - 1);
    const maxCachedFrames = isMobile ? 8 : 24;
    const textureLoader = new THREE.TextureLoader();
    const loadedTextures: THREE.Texture[] = [];
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const unitPlane = new THREE.PlaneGeometry(1, 1);
    const webglHost = document.createElement('div');
    webglHost.className = sceneClassNames.webglLayer;
    const cssHost = document.createElement('div');
    cssHost.className = sceneClassNames.cssLayer;
    const cacheHost = document.createElement('div');
    cacheHost.setAttribute('aria-hidden', 'true');
    cacheHost.style.cssText =
      'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;';
    const stagingHost = document.createElement('div');
    stagingHost.setAttribute('aria-hidden', 'true');
    stagingHost.style.cssText = `position:fixed;left:-10000px;top:0;width:${EMBED_WIDTH_PX}px;min-height:${EMBED_HEIGHT_PX}px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;contain:layout paint style;`;
    viewport.append(webglHost, cssHost, cacheHost);
    document.body.appendChild(stagingHost);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeee6d9);

    const cssScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      layout.cameraFov,
      viewport.clientWidth / Math.max(1, viewport.clientHeight),
      0.1,
      80
    );
    camera.position.set(0, layout.cameraY, layout.cameraZ);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2)
    );
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = GALLERY_LIGHTING.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';
    webglHost.appendChild(renderer.domElement);

    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(viewport.clientWidth, viewport.clientHeight);
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.inset = '0';
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

    const wallWidth = lastFrameX + 18;
    const wallHeight = 8.2;
    const floorDepth = 9.8;
    const wallTextureRepeat = {
      x: Math.max(1, wallWidth / 12),
      y: wallHeight / 6.4,
    };
    const floorTextureRepeat = {
      x: Math.max(1, wallWidth / 7.5),
      y: floorDepth / 3.1,
    };
    const wallTexture = loadTexture(
      plasterTextureUrl,
      wallTextureRepeat.x,
      wallTextureRepeat.y
    );
    const wallBump = loadBumpTexture(
      plasterBumpTextureUrl,
      wallTextureRepeat.x,
      wallTextureRepeat.y
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

    const wallMaterial = new THREE.MeshStandardMaterial({
      map: wallTexture,
      bumpMap: wallBump,
      bumpScale: 0.024,
      color: 0xf2e8d9,
      roughness: 0.94,
      metalness: 0,
    });
    const floorMaterial = new THREE.MeshPhysicalMaterial({
      map: floorTexture,
      bumpMap: floorTexture,
      bumpScale: 0.012,
      color: 0x7a563d,
      roughness: 0.5,
      metalness: 0.02,
      clearcoat: 0.28,
      clearcoatRoughness: 0.26,
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
    const baseboardMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8ded0,
      roughness: 0.78,
      metalness: 0,
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
      wallMaterial,
      floorMaterial,
      walnutMaterial,
      goldMaterial,
      ebonyMaterial,
      backingMaterial,
      baseboardMaterial,
      plaqueMaterial,
      plaqueTextMaterial,
    ];

    const wallGeometry = new THREE.PlaneGeometry(
      wallWidth,
      wallHeight,
      Math.max(96, urls.length * 2),
      42
    );
    roughenPlane(wallGeometry, 0.009);
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(lastFrameX / 2, 0.42, -0.07);
    wall.receiveShadow = true;
    scene.add(wall);

    const floorGeometry = new THREE.PlaneGeometry(wallWidth, floorDepth, 96, 18);
    roughenPlane(floorGeometry, 0.006);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(lastFrameX / 2, -2.72, 3.58);
    floor.receiveShadow = true;
    scene.add(floor);

    const baseboard = new THREE.Mesh(unitBox, baseboardMaterial);
    baseboard.scale.set(wallWidth, 0.13, 0.18);
    baseboard.position.set(lastFrameX / 2, -2.52, 0.08);
    baseboard.castShadow = true;
    baseboard.receiveShadow = true;
    scene.add(baseboard);

    const baseboardCap = new THREE.Mesh(unitBox, baseboardMaterial);
    baseboardCap.scale.set(wallWidth, 0.025, 0.055);
    baseboardCap.position.set(lastFrameX / 2, -2.43, 0.14);
    baseboardCap.castShadow = true;
    baseboardCap.receiveShadow = true;
    scene.add(baseboardCap);

    const mountCeilingAreaLight = () => {
      import('three/examples/jsm/lights/RectAreaLightUniformsLib.js').then(
        ({ RectAreaLightUniformsLib }) => {
          if (!isMounted) return;

          RectAreaLightUniformsLib.init();
          ceilingAreaLight = new THREE.RectAreaLight(
            GALLERY_LIGHTING.ceilingArea.color,
            GALLERY_LIGHTING.ceilingArea.intensity,
            GALLERY_LIGHTING.ceilingArea.width,
            GALLERY_LIGHTING.ceilingArea.height
          );
          ceilingAreaLight.position.set(
            targetCameraX,
            GALLERY_LIGHTING.ceilingArea.y,
            GALLERY_LIGHTING.ceilingArea.z
          );
          ceilingAreaLight.lookAt(targetCameraX, layout.frameY - 0.1, -0.08);
          scene.add(ceilingAreaLight);
        }
      );
    };

    const ceilingLight = new THREE.SpotLight(
      GALLERY_LIGHTING.ceilingSpot.color,
      GALLERY_LIGHTING.ceilingSpot.intensity,
      GALLERY_LIGHTING.ceilingSpot.distance,
      GALLERY_LIGHTING.ceilingSpot.angle,
      GALLERY_LIGHTING.ceilingSpot.penumbra,
      GALLERY_LIGHTING.ceilingSpot.decay
    );
    ceilingLight.position.set(lastFrameX / 2, 5.25, 3.35);
    ceilingLight.target.position.set(lastFrameX / 2, -0.1, -0.08);
    ceilingLight.castShadow = true;
    ceilingLight.shadow.mapSize.set(
      isMobile ? 2048 : 4096,
      isMobile ? 2048 : 4096
    );
    ceilingLight.shadow.camera.near = 1.6;
    ceilingLight.shadow.camera.far = 18;
    ceilingLight.shadow.bias = -0.00004;
    ceilingLight.shadow.normalBias = 0.035;
    ceilingLight.shadow.radius = isMobile ? 3 : 4;
    ceilingLight.shadow.blurSamples = isMobile ? 8 : 12;
    scene.add(ceilingLight, ceilingLight.target);

    const createEmbedElement = (index: number) => {
      const element = document.createElement('article');
      element.className = sceneClassNames.embedPlane;
      element.setAttribute(
        'aria-label',
        `Art in Life Instagram post ${index + 1}`
      );
      element.style.width = `${EMBED_WIDTH_PX}px`;
      element.style.height = `${EMBED_HEIGHT_PX}px`;
      element.innerHTML = createSkeletonHtml(sceneClassNames);
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
      if (record.embedMounted || record.embedRequested) return;

      record.embedRequested = true;
      const loadEmbed = () => {
        if (!activeFrames.has(record.index)) return;

        loadInstagramEmbedScript()
          .then(async () => {
            if (!activeFrames.has(record.index)) return;

            const stagedElement = createEmbedElement(record.index);
            stagedElement.innerHTML = createMountedEmbedHtml(
              urls[record.index]
            );
            stagingHost.appendChild(stagedElement);

            await requestInstagramEmbedProcess();
            const hasIframe = await waitForInstagramIframe(stagedElement);

            if (!activeFrames.has(record.index)) {
              stagedElement.remove();
              return;
            }

            if (!hasIframe) {
              stagedElement.remove();
              record.element.innerHTML = createFallbackEmbedHtml(
                urls[record.index]
              );
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
          })
          .catch(() => {
            record.element.innerHTML = createFallbackEmbedHtml(
              urls[record.index]
            );
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
      record.element.innerHTML = createSkeletonHtml(sceneClassNames);
    };

    const createFrameRecord = (index: number): FrameRecord => {
      const cachedRecord = cachedFrames.get(index);

      if (cachedRecord) {
        cachedFrames.delete(index);
        cachedRecord.lastTouched = performance.now();
        scene.add(cachedRecord.group);
        cssScene.add(cachedRecord.cssObject);
        return cachedRecord;
      }

      const x = index * layout.spacing;
      const group = createFrameGroup({
        index,
        x,
        layout,
        materials: {
          frame: [walnutMaterial, goldMaterial, ebonyMaterial],
          backing: backingMaterial,
          plaque: plaqueMaterial,
          plaqueText: plaqueTextMaterial,
        },
        unitBox,
        unitPlane,
      });
      scene.add(group);

      const element = createEmbedElement(index);
      const cssObject = new CSS3DObject(element);
      const cssScale = layout.postWidth / EMBED_WIDTH_PX;
      cssObject.position.set(x, layout.frameY, 0.29);
      cssObject.scale.set(cssScale, cssScale, cssScale);
      cssScene.add(cssObject);

      return {
        index,
        group,
        cssObject,
        element,
        embedMounted: false,
        embedRequested: false,
        lastTouched: performance.now(),
      };
    };

    const getGroupStart = (groupIndex: number) => {
      if (urls.length <= layout.groupSize) return 0;

      return clamp(
        groupIndex * layout.groupSize,
        0,
        Math.max(0, urls.length - layout.groupSize)
      );
    };

    const getGroupEnd = (groupIndex: number) => {
      const start = getGroupStart(groupIndex);
      return Math.min(urls.length - 1, start + layout.groupSize - 1);
    };

    const getGroupCenter = (groupIndex: number) => {
      const start = getGroupStart(groupIndex);
      const end = getGroupEnd(groupIndex);
      return ((start + end) / 2) * layout.spacing;
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

    const trimFrameCache = (groupIndex: number) => {
      while (cachedFrames.size > maxCachedFrames) {
        const groupCenter =
          (getGroupStart(groupIndex) + getGroupEnd(groupIndex)) / 2;
        let candidateIndex = -1;
        let candidateDistance = -1;

        cachedFrames.forEach((record, index) => {
          const distance = Math.abs(index - groupCenter);

          if (
            distance > candidateDistance ||
            (distance === candidateDistance &&
              record.lastTouched <
                (cachedFrames.get(candidateIndex)?.lastTouched ?? Infinity))
          ) {
            candidateIndex = index;
            candidateDistance = distance;
          }
        });

        const candidate = cachedFrames.get(candidateIndex);
        if (!candidate) return;

        cachedFrames.delete(candidateIndex);
        destroyFrameRecord(candidate);
      }
    };

    const removeFrameRecord = (record: FrameRecord, groupIndex: number) => {
      cancelScheduledWork(record.schedule);
      record.schedule = undefined;
      scene.remove(record.group);
      cssScene.remove(record.cssObject);

      if (record.embedMounted) {
        record.iframeObserver?.disconnect();
        record.iframeObserver = undefined;
        record.lastTouched = performance.now();
        cacheHost.appendChild(record.element);
        cachedFrames.set(record.index, record);
        trimFrameCache(groupIndex);
        return;
      }

      destroyFrameRecord(record);
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

      activeFrames.forEach((record, index) => {
        if (index < activeStart || index > activeEnd) {
          removeFrameRecord(record, groupIndex);
          activeFrames.delete(index);
        }
      });

      for (let index = activeStart; index <= activeEnd; index++) {
        if (!activeFrames.has(index)) {
          activeFrames.set(index, createFrameRecord(index));
        }
      }

      activeFrames.forEach((record, index) => {
        const shouldMountEmbed = index >= embedStart && index <= embedEnd;

        if (shouldMountEmbed) {
          mountEmbed(record, true);
        } else if (!record.embedMounted && record.embedRequested) {
          unmountEmbed(record);
        }
      });
    };

    const resize = () => {
      const width = viewport.clientWidth;
      const height = Math.max(1, viewport.clientHeight);
      camera.aspect = width / height;
      camera.fov = layout.cameraFov;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2)
      );
      renderer.setSize(width, height);
      cssRenderer.setSize(width, height);
    };

    const previousButton = previousButtonRef.current;
    const nextButton = nextButtonRef.current;

    const goToGroup = (groupIndex: number) => {
      const nextGroupIndex = clamp(groupIndex, 0, maxGroupIndex);
      targetGroupIndex = nextGroupIndex;
      setNavGroupIndex(nextGroupIndex);
    };

    const goPrevious = () => goToGroup(targetGroupIndex - 1);
    const goNext = () => goToGroup(targetGroupIndex + 1);

    let pointerX = 0;
    let pointerY = 0;

    const handlePointerMove = (event: PointerEvent) => {
      if (isMobile) return;

      pointerX = (event.clientX / window.innerWidth - 0.5) * 0.18;
      pointerY = (event.clientY / window.innerHeight - 0.5) * 0.12;
    };

    const animate = () => {
      targetCameraX = getGroupCenter(targetGroupIndex);
      camera.position.x = lerp(
        camera.position.x,
        targetCameraX,
        isMobile ? 0.16 : 0.09
      );
      camera.position.y = lerp(
        camera.position.y,
        layout.cameraY - pointerY,
        0.06
      );
      camera.position.z = lerp(camera.position.z, layout.cameraZ, 0.08);
      camera.lookAt(camera.position.x + pointerX, layout.frameY - 0.02, 0);
      ceilingLight.position.x = targetCameraX;
      ceilingLight.target.position.x = targetCameraX;
      ceilingLight.target.updateMatrixWorld();
      if (ceilingAreaLight) {
        ceilingAreaLight.position.x = targetCameraX;
        ceilingAreaLight.lookAt(targetCameraX, layout.frameY - 0.1, -0.08);
      }

      if (targetGroupIndex !== currentGroupIndex) {
        currentGroupIndex = targetGroupIndex;
        updateVirtualFrames(targetGroupIndex);
      }

      renderer.render(scene, camera);
      cssRenderer.render(cssScene, camera);
      animationFrame = window.requestAnimationFrame(animate);
    };

    targetGroupIndex = 0;
    setNavGroupIndex(0);
    targetCameraX = getGroupCenter(targetGroupIndex);
    ceilingLight.position.x = targetCameraX;
    ceilingLight.target.position.x = targetCameraX;
    ceilingLight.target.updateMatrixWorld();
    if (ceilingAreaLight) {
      ceilingAreaLight.position.x = targetCameraX;
      ceilingAreaLight.lookAt(targetCameraX, layout.frameY - 0.1, -0.08);
    }
    camera.position.x = getGroupCenter(targetGroupIndex);
    camera.lookAt(camera.position.x, layout.frameY - 0.02, 0);
    resize();
    updateVirtualFrames(targetGroupIndex);
    renderer.render(scene, camera);
    cssRenderer.render(cssScene, camera);
    setIsReady(true);
    ceilingAreaSchedule = scheduleWhenIdle(mountCeilingAreaLight);
    animationFrame = window.requestAnimationFrame(animate);

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });
    previousButton?.addEventListener('click', goPrevious);
    nextButton?.addEventListener('click', goNext);

    return () => {
      isMounted = false;
      window.cancelAnimationFrame(animationFrame);
      cancelScheduledWork(ceilingAreaSchedule);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      previousButton?.removeEventListener('click', goPrevious);
      nextButton?.removeEventListener('click', goNext);

      activeFrames.forEach(destroyFrameRecord);
      activeFrames.clear();
      cachedFrames.forEach(destroyFrameRecord);
      cachedFrames.clear();

      unitBox.dispose();
      unitPlane.dispose();
      wall.geometry.dispose();
      floor.geometry.dispose();
      loadedTextures.forEach((texture) => texture.dispose());
      materials.forEach(disposeMaterial);
      renderer.dispose();
      webglHost.remove();
      cssHost.remove();
      cacheHost.remove();
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
