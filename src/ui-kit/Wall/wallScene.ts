// The wall. A low sun comes through a window behind you; everything that casts
// a shadow (frame, sill, curtain, the object on the sill) is out of view. You
// only ever see their shadows on the wall.
import * as THREE from 'three';
import type { TabId } from '@/types/content';
import { createCurtain } from './curtain';
import { createPlant } from './plant';
import { deskSet, robot, satellite, telescope } from './sillObjects';
import { SUN, V3, box, merge, rod } from './wallKit';
import { createWindow } from './windowFrame';

// Cost: the wall only redraws while something moves. The curtain and plant
// are always moving, slowly, so they redraw at IDLE_FPS; a page change runs at
// full rate until the new object is up. Each caster is one merged mesh, the
// wall itself stays out of the shadow pass, and the 2048 map's blur is kept
// close to the sun's real penumbra at this distance so outlines stay crisp.
const IDLE_FPS = 20;
const SHADOW_MAP = 2048;
const SHADOW_RADIUS = 3;
const SHADOW_SAMPLES = 12;
const VH = 10; // world units across the viewport height
const ZW = 7; // distance from the wall to the window

export interface WallState {
  tab: TabId;
  // false stops drawing entirely (page hidden, wall covered)
  active: boolean;
  // reduced motion: one still frame per change, no wind, no lifting
  still: boolean;
}

export interface Wall {
  update: (_state: WallState) => void;
  dispose: () => void;
}

// plaster: a fine procedural tooth, lit by the scene, so shadows sit in the surface
function plasterTexture() {
  const N = 512;
  // value noise from small precomputed lattices, three octaves, tiling
  const lattice = (P: number) =>
    Float32Array.from({ length: P * P }, (_, i) => {
      const s =
        Math.sin((i % P) * 127.1 + Math.floor(i / P) * 311.7) * 43758.5453;
      return s - Math.floor(s);
    });
  const octaves = [
    [6, 0.5],
    [24, 0.3],
    [128, 0.2],
  ].map(([P, weight]) => ({ P, weight, values: lattice(P) }));
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let n = 0;
      for (const { P, weight, values } of octaves) {
        const fx = (x / N) * P;
        const fy = (y / N) * P;
        const xi = Math.floor(fx);
        const yi = Math.floor(fy);
        const u = smooth(fx - xi);
        const v = smooth(fy - yi);
        const x1 = (xi + 1) % P;
        const y1 = (yi + 1) % P;
        const a = values[yi * P + xi];
        const b = values[yi * P + x1];
        const c = values[y1 * P + xi];
        const d = values[y1 * P + x1];
        n += (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * weight;
      }
      const k = 236 + (n - 0.5) * 16;
      const i = (y * N + x) * 4;
      data[i] = k;
      data[i + 1] = k * 0.975;
      data[i + 2] = k * 0.94;
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, N, N);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createWall(
  canvas: HTMLCanvasElement,
  onFirstFrame: () => void
): Wall {
  // Soft by nature: no MSAA, and never more than one pixel per CSS pixel.
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();

  // The wall is the plane z = 0; the camera looks straight at it from just in
  // front, so nothing between the wall and the window is ever in view.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 1);
  camera.position.set(0, 0, 0.5);

  const plaster = plasterTexture();
  plaster.repeat.set(8, 8);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshLambertMaterial({ color: 0xffffff, map: plaster })
  );
  wall.receiveShadow = true;
  // receivers are drawn into a VSM shadow map too; keeping the wall out of it
  // avoids the wall shadowing its own grain, and saves the pass
  wall.layers.set(1);
  camera.layers.enable(1);
  scene.add(wall);

  // light: a warm low sun from behind-left, and the cool light of the room itself
  const L = SUN;
  const sun = new THREE.DirectionalLight(0xffd7a6, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  sun.shadow.radius = SHADOW_RADIUS;
  sun.shadow.blurSamples = SHADOW_SAMPLES;
  // every caster is metres from the wall, so a firm bias costs no contact
  // and keeps the lit plaster free of shadow-map grain
  sun.shadow.bias = -0.003;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xf1efea, 0xdccdb2, 2.65));

  // window: the window plane is parallel to the wall, so its light lands as an
  // exact copy of the opening, sheared the way low sun through a side window
  // falls. All casters stay well behind the camera.
  const top = 5.6;
  const bot = -2.3;
  const w = 6.4;
  const x0 = 1.4;
  const shear = 0.36;
  const frame = new THREE.Group();
  frame.position.set((ZW * L.x) / L.z, (ZW * L.y) / L.z, ZW);
  scene.add(frame);
  // a point across the opening (u: 0 left .. 1 right) at height y
  const X = (u: number, y: number) => x0 - w / 2 + u * w + (top - y) * shear;
  frame.add(
    createWindow({ left: X(0, top), right: X(1, top), top, bot, shear }).group
  );
  // the sill: a deep board into the room with a rounded nosing
  const sx0 = X(0, bot) - 0.3;
  const sx1 = X(1, bot) + 0.3;
  const sill = box(sx1 - sx0, 0.1, 1.75, (sx0 + sx1) / 2, bot - 0.05, -0.875);
  const nosing = rod(
    V3(sx0, bot - 0.05, -1.75),
    V3(sx1, bot - 0.05, -1.75),
    0.06
  );
  frame.add(sill, nosing);

  // a sheer curtain on a rod above the left of the window
  const curtain = createCurtain({
    left: X(0.07, top),
    right: X(0.5, top),
    rodY: top + 0.35,
    sillY: bot,
    rodZ: -0.3,
  });
  frame.add(curtain.mesh);
  // hang for a moment before it's seen; it finishes settling as the wall
  // fades in
  curtain.settle(1);

  // a monstera at the right end of the sill: always there
  const plant = createPlant();
  plant.group.position.set(X(0.88, bot), bot, -0.85);
  plant.group.scale.setScalar(0.85);
  frame.add(plant.group);

  // ---------- the object on the sill, one per page ----------
  // Switching pages, the old object sinks below the sill until it's gone, then
  // the new one rises from below into its place.
  const SINK_S = 0.65;
  const RISE_S = 1.05;
  const easeIn = (t: number) => t * t * t;
  const easeOut = (t: number) => 1 - (1 - t) ** 3;
  interface Piece {
    group: THREE.Group;
    hidden: number;
    from: number;
    to: number;
    t: number;
    duration: number;
  }
  const shelf = new THREE.Group();
  shelf.position.set(X(0.36, bot), bot, -1.15);
  shelf.scale.setScalar(1.6);
  frame.add(shelf);
  const pieces: Partial<Record<TabId, Piece>> = {};
  const builders: Partial<Record<TabId, () => THREE.Group>> = {
    about: telescope,
    journey: deskSet,
    portfolio: robot,
    inspirations: satellite,
  };
  for (const [key, build] of Object.entries(builders)) {
    const group = new THREE.Group();
    group.add(merge(build()));
    // fully below the sill top, with a margin for the penumbra
    const height = new THREE.Box3().setFromObject(group).max.y;
    const hidden = -(height + 0.12);
    group.position.y = hidden;
    group.visible = false;
    shelf.add(group);
    pieces[key as TabId] = {
      group,
      hidden,
      from: hidden,
      to: hidden,
      t: 0,
      duration: 0,
    };
  }

  // returns true while anything is still on its way
  const settle = (active: TabId, dt: number, still: boolean) => {
    const entries = Object.entries(pieces) as [TabId, Piece][];
    const othersDown = entries.every(
      ([key, piece]) => key === active || piece.group.position.y <= piece.hidden
    );
    let moving = false;
    for (const [key, piece] of entries) {
      const y = piece.group.position.y;
      const dest = key === active && (othersDown || still) ? 0 : piece.hidden;
      if (still) {
        piece.group.position.y = dest;
      } else {
        if (dest !== piece.to) {
          const rising = dest > y;
          piece.from = y;
          piece.to = dest;
          piece.t = 0;
          piece.duration =
            (rising ? RISE_S : SINK_S) * (Math.abs(dest - y) / -piece.hidden);
        }
        if (piece.group.position.y !== piece.to) {
          piece.t += dt;
          const p =
            piece.duration > 0 ? Math.min(1, piece.t / piece.duration) : 1;
          const curve = piece.to > piece.from ? easeOut(p) : easeIn(p);
          piece.group.position.y = piece.from + (piece.to - piece.from) * curve;
          if (p >= 1) piece.group.position.y = piece.to;
          moving = true;
        }
      }
      piece.group.visible = piece.group.position.y > piece.hidden;
    }
    return moving;
  };

  // ---------- sizing ----------
  // Framed from the canvas's own size, which is the large viewport: a phone's
  // toolbar sliding in and out while scrolling never re-frames the wall.
  let framed = '';
  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height || framed === `${width}x${height}`) return false;
    framed = `${width}x${height}`;
    const a = width / height;
    if (a >= 1) {
      const vh = Math.max(VH, 14 / a);
      camera.left = (-vh * a) / 2;
      camera.right = (vh * a) / 2;
      camera.top = vh / 2;
      camera.bottom = -vh / 2;
    } else {
      // portrait: the window's light fills the width, its upper edge (under
      // the frame's head) right at the top of the screen
      const x0 = X(0, top) - 0.15;
      const x1 = X(1, bot) + 0.15;
      camera.left = x0;
      camera.right = x1;
      const lightTop = top - 0.12;
      camera.top = lightTop;
      camera.bottom = lightTop - (x1 - x0) / a;
    }
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    // the shadow map covers what's in view, centred on it, at the same
    // resolution on every screen so shadows are equally crisp everywhere
    const cx = (camera.left + camera.right) / 2;
    const cy = (camera.top + camera.bottom) / 2;
    const span = Math.max(
      camera.right - camera.left,
      camera.top - camera.bottom
    );
    const half = Math.max(13.6, (span / 2) * 1.15);
    Object.assign(sun.shadow.camera, {
      left: -half,
      right: half,
      top: half,
      bottom: -half,
      near: 0.1,
      far: 40,
    });
    sun.shadow.camera.updateProjectionMatrix();
    sun.target.position.set(cx, cy, 0);
    sun.position.copy(L).multiplyScalar(20).add(sun.target.position);
    return true;
  };
  resize();

  // ---------- frames ----------
  let state: WallState = { tab: 'about', active: false, still: false };
  let raf = 0;
  let idle = 0;
  let last = 0;
  let time = 0;
  let painted = false;

  const draw = (now: number) => {
    raf = 0;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    if (!state.still) {
      time += dt;
      curtain.update(dt);
      plant.sway(time, 1);
    }
    const moving = settle(state.tab, dt, state.still);
    renderer.render(scene, camera);
    if (!painted) {
      painted = true;
      onFirstFrame();
    }
    schedule(moving);
  };

  const schedule = (moving: boolean) => {
    if (!state.active || raf || idle) return;
    if (moving) {
      raf = requestAnimationFrame(draw);
    } else if (!state.still) {
      idle = window.setTimeout(() => {
        idle = 0;
        raf = requestAnimationFrame(draw);
      }, 1000 / IDLE_FPS);
    }
  };

  const stop = () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(idle);
    raf = idle = 0;
    last = 0;
  };

  // one fresh frame now, then whatever pace the state calls for
  const kick = () => {
    stop();
    if (state.active) raf = requestAnimationFrame(draw);
  };

  const onResize = () => {
    if (resize()) kick();
  };
  window.addEventListener('resize', onResize);

  return {
    update(next) {
      state = next;
      kick();
    },
    dispose() {
      stop();
      window.removeEventListener('resize', onResize);
      scene.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.alphaMap?.dispose();
        material.map?.dispose();
        material.dispose();
      });
      renderer.dispose();
    },
  };
}
