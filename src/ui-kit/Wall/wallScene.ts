// The wall. A low sun comes through a window behind you; everything that casts
// a shadow (frame, sill, curtain, the object on the sill) is out of view. You
// only ever see their shadows on the wall.
import * as THREE from 'three';
import type { TabId } from '@/types/content';

// Cost: the wall only redraws while something moves. The curtain is the one
// thing always moving and it's slow and soft, so it redraws at IDLE_FPS; a tab
// change runs at full rate until the new object is down. The shadow map is
// half the mockup's 4096 with the blur radius halved to match, so the
// penumbra keeps its width in wall units at a quarter of the texels.
const IDLE_FPS = 20;
const SHADOW_MAP = 2048;
const SHADOW_RADIUS = 4.5;
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
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(N, N);
  const hash = (x: number, y: number) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x: number, y: number, P: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi % P, yi % P);
    const b = hash((xi + 1) % P, yi % P);
    const c = hash(xi % P, (yi + 1) % P);
    const d = hash((xi + 1) % P, (yi + 1) % P);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      const n =
        noise(u * 6, v * 6, 6) * 0.5 +
        noise(u * 24, v * 24, 24) * 0.3 +
        noise(u * 128, v * 128, 128) * 0.2;
      const k = 236 + (n - 0.5) * 16;
      const i = (y * N + x) * 4;
      img.data[i] = k;
      img.data[i + 1] = k * 0.975;
      img.data[i + 2] = k * 0.94;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// lace: a sheer weave with open stripes and a scatter of open motifs, coarse
// enough to survive the penumbra
function laceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 128, 512);
  g.fillStyle = '#000';
  for (let x = 0; x < 128; x += 32) g.fillRect(x + 4, 0, 9, 512);
  for (let y = 16; y < 512; y += 40) {
    for (let x = 20; x < 128; x += 32) {
      g.beginPath();
      g.arc(x + ((y / 40) % 2) * 6, y, 6, 0, Math.PI * 2);
      g.fill();
    }
  }
  for (let y = 0; y < 512; y += 64) g.fillRect(0, y, 128, 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1.3);
  return texture;
}

// ---------- the object on the sill, one per tab (stand-ins with legible silhouettes) ----------
const solid = new THREE.MeshBasicMaterial({ color: 0x000000 });
const cyl = (rt: number, rb: number, h: number, seg = 20) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), solid);
const cube = (w: number, h: number, d: number) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), solid);

function telescope() {
  // About: into the unknown
  const g = new THREE.Group();
  const mount = new THREE.Vector3(0, 1.3, 0);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    const foot = new THREE.Vector3(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55);
    const leg = cyl(0.025, 0.03, foot.distanceTo(mount), 8);
    leg.position.copy(foot.clone().add(mount).multiplyScalar(0.5));
    leg.lookAt(mount);
    leg.rotateX(Math.PI / 2);
    g.add(leg);
  }
  const head = new THREE.Group();
  head.position.copy(mount);
  head.rotation.z = 0.62;
  head.rotation.y = -0.5;
  g.add(head);
  const tube = cyl(0.11, 0.13, 1.9, 24);
  tube.rotation.z = Math.PI / 2;
  tube.position.x = 0.25;
  head.add(tube);
  const dew = cyl(0.15, 0.15, 0.35, 24);
  dew.rotation.z = Math.PI / 2;
  dew.position.x = 1.2;
  head.add(dew);
  const eye = cyl(0.04, 0.04, 0.3, 10);
  eye.position.set(-0.62, 0.12, 0);
  eye.rotation.z = -0.5;
  head.add(eye);
  const finder = cyl(0.035, 0.035, 0.5, 10);
  finder.rotation.z = Math.PI / 2;
  finder.position.set(0.2, 0.17, 0);
  head.add(finder);
  return g;
}

function books() {
  // Learning Journey: a stack of books, a mug and a lamp
  const g = new THREE.Group();
  let y = 0;
  for (const [w, h, d, r] of [
    [1.2, 0.16, 0.85, 0.04],
    [1.05, 0.22, 0.8, -0.06],
    [1.25, 0.12, 0.9, 0.1],
    [0.95, 0.2, 0.7, -0.03],
    [1.1, 0.14, 0.8, 0.07],
  ]) {
    const book = cube(w, h, d);
    book.position.y = y + h / 2;
    book.rotation.y = r;
    g.add(book);
    y += h;
  }
  const lean = cube(0.16, 1.05, 0.78);
  lean.position.set(-0.72, 0.5, 0);
  lean.rotation.z = 0.3;
  g.add(lean);
  const mug = new THREE.Group();
  mug.position.set(-1.15, 0, 0.1);
  g.add(mug);
  const body = cyl(0.17, 0.15, 0.38);
  body.position.y = 0.19;
  mug.add(body);
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.1, 0.025, 8, 20),
    solid
  );
  handle.position.set(-0.18, 0.2, 0);
  mug.add(handle);
  const lamp = new THREE.Group();
  lamp.position.set(0.55, 0, -0.1);
  g.add(lamp);
  const base = cyl(0.22, 0.26, 0.07, 20);
  base.position.y = 0.035;
  lamp.add(base);
  const arm1 = cube(0.08, 1.05, 0.08);
  arm1.position.set(0.18, 0.52, 0);
  arm1.rotation.z = -0.38;
  lamp.add(arm1);
  const arm2 = cube(0.08, 0.9, 0.08);
  arm2.position.set(-0.05, 1.22, 0);
  arm2.rotation.z = 1.1;
  lamp.add(arm2);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.5, 20, 1, false),
    solid
  );
  shade.position.set(-0.48, 1.18, 0);
  shade.rotation.z = -2.3;
  lamp.add(shade);
  const glasses = new THREE.Group();
  glasses.position.set(0.05, y + 0.06, 0);
  g.add(glasses);
  for (const s of [-1, 1]) {
    const lens = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.016, 8, 24),
      solid
    );
    lens.position.x = s * 0.12;
    glasses.add(lens);
  }
  return g;
}

function robot() {
  // Portfolio: the machines and worlds you build
  const g = new THREE.Group();
  g.scale.setScalar(1.35);
  for (const s of [-1, 1]) {
    const leg = cube(0.15, 0.55, 0.15);
    leg.position.set(s * 0.2, 0.3, 0);
    leg.rotation.z = s * -0.08;
    g.add(leg);
    const foot = cube(0.22, 0.08, 0.3);
    foot.position.set(s * 0.15, 0.04, 0.05);
    g.add(foot);
  }
  const torso = cube(0.6, 0.62, 0.38);
  torso.position.y = 0.9;
  g.add(torso);
  const neck = cube(0.08, 0.14, 0.08);
  neck.position.y = 1.27;
  g.add(neck);
  const head = cube(0.56, 0.4, 0.34);
  head.position.y = 1.52;
  g.add(head);
  const antenna = cyl(0.025, 0.025, 0.3, 6);
  antenna.position.set(0.1, 1.86, 0);
  g.add(antenna);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), solid);
  tip.position.set(0.1, 2.04, 0);
  g.add(tip);
  for (const s of [-1, 1]) {
    const ear = cyl(0.09, 0.09, 0.08, 14);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(s * 0.32, 1.52, 0);
    g.add(ear);
  }
  const armL = cube(0.11, 0.55, 0.11);
  armL.position.set(-0.42, 0.85, 0);
  armL.rotation.z = 0.25;
  g.add(armL);
  const armR = cube(0.12, 0.6, 0.12); // a wave
  armR.position.set(0.56, 1.22, 0);
  armR.rotation.z = 2.5;
  g.add(armR);
  const hand = cube(0.16, 0.18, 0.1);
  hand.position.set(0.72, 1.55, 0);
  g.add(hand);
  return g;
}

function rocket() {
  // Inspirations: the frontier
  const g = new THREE.Group();
  const stand = cyl(0.32, 0.38, 0.08, 24);
  stand.position.y = 0.04;
  g.add(stand);
  const post = cyl(0.03, 0.03, 0.3, 8);
  post.position.y = 0.2;
  g.add(post);
  const body = cyl(0.16, 0.16, 1.75, 28);
  body.position.y = 1.2;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 28), solid);
  nose.position.y = 2.32;
  g.add(nose);
  for (const s of [-1, 1]) {
    const fin = cube(0.3, 0.45, 0.03);
    fin.position.set(s * 0.26, 0.55, 0);
    fin.rotation.z = s * -0.25;
    g.add(fin);
    const flap = cube(0.18, 0.26, 0.03);
    flap.position.set(s * 0.2, 2.0, 0);
    flap.rotation.z = s * -0.2;
    g.add(flap);
  }
  return g;
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
  scene.add(wall);

  // light: a warm low sun from behind-left, and the cool light of the room itself
  const L = new THREE.Vector3(-0.5, 0.42, 0.76).normalize(); // toward the sun
  const sun = new THREE.DirectionalLight(0xffd7a6, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  sun.shadow.radius = SHADOW_RADIUS;
  sun.shadow.blurSamples = SHADOW_SAMPLES;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xf1efea, 0xdccdb2, 2.65));

  // window: authored directly as the shape of light it throws. The window plane
  // is parallel to the wall, so its light lands as an exact copy of the
  // opening, sheared the way low sun through a side window falls. All casters
  // stay well behind the camera.
  const top = 5.6;
  const bot = -2.3;
  const w = 6.4;
  const x0 = 1.4;
  const shear = 0.36;
  const frame = new THREE.Group();
  frame.position.set((ZW * L.x) / L.z, (ZW * L.y) / L.z, ZW);
  scene.add(frame);
  const X = (u: number, y: number) => x0 - w / 2 + u * w + (top - y) * shear;
  const V = (x: number, y: number) => new THREE.Vector2(x, y);
  const quad = (u0: number, u1: number, y0: number, y1: number) => [
    V(X(u0, y1), y1),
    V(X(u1, y1), y1),
    V(X(u1, y0), y0),
    V(X(u0, y0), y0),
  ];
  const flat = (points: THREE.Vector2[], holes: THREE.Vector2[][] = []) => {
    const shape = new THREE.Shape(points);
    holes.forEach((hole) => shape.holes.push(new THREE.Path(hole)));
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color: 0, side: THREE.DoubleSide })
    );
    mesh.castShadow = true;
    frame.add(mesh);
  };
  // the wall the window is set in
  flat(
    [V(-80, -80), V(80, -80), V(80, 80), V(-80, 80)],
    [quad(0, 1, bot, top).reverse()]
  );
  const H = top - bot;
  const du = (t: number) => t / w;
  flat(quad(0.5 - du(0.05), 0.5 + du(0.05), bot, top)); // centre mullion
  const transom = top - H * 0.3;
  flat(quad(0, 1, transom - 0.05, transom + 0.05));
  for (const f of [0.62, 0.83]) {
    const y = bot + H * (1 - f) * 0.99; // glazing bars
    flat(quad(0, 1, y - 0.025, y + 0.025));
  }
  for (const u of [0.25, 0.75]) {
    flat(quad(u - du(0.025), u + du(0.025), transom, top));
  }
  // the sill, deep into the room along the bottom of the opening
  const sx0 = X(0, bot) - 0.3;
  const sx1 = X(1, bot) + 0.3;
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(sx1 - sx0, 0.2, 1.8),
    solid
  );
  sill.position.set((sx0 + sx1) / 2, bot - 0.1, -0.9);
  sill.castShadow = true;
  frame.add(sill);

  // a sheer curtain gathered at the left of the window, moving in the wind;
  // the shadow pass takes alphaMap/alphaTest from the mesh's own material
  const CW = 2.1;
  const CH = top - bot + 1.2;
  const curtainGeo = new THREE.PlaneGeometry(CW, CH, 36, 60);
  const rest = curtainGeo.attributes.position.array.slice();
  const curtain = new THREE.Mesh(
    curtainGeo,
    new THREE.MeshBasicMaterial({
      color: 0,
      side: THREE.DoubleSide,
      alphaMap: laceTexture(),
      alphaTest: 0.5,
    })
  );
  curtain.castShadow = true;
  curtain.position.set(X(0.13, (top + bot) / 2), (top + bot) / 2 + 0.5, -0.5);
  frame.add(curtain);
  const wind = (t: number) => {
    const p = curtainGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < p.length; i += 3) {
      const x = rest[i];
      const y = rest[i + 1];
      const hang = (CH / 2 - y) / CH;
      const pleat = Math.sin(x * 9) * 0.07;
      const gust =
        (Math.sin(t * 0.9 + y * 0.7) * 0.5 +
          Math.sin(t * 1.7 + x * 2 + y * 1.3) * 0.3 +
          Math.sin(t * 0.37) * 0.6) *
        hang *
        hang;
      p[i] = x + gust * 1.5 + Math.sin(t * 2.3 + y * 2.1) * 0.12 * hang;
      p[i + 1] = y + Math.abs(gust) * 0.12;
      p[i + 2] = pleat - gust * 0.5;
    }
    curtainGeo.attributes.position.needsUpdate = true;
  };

  // a plant at the right end of the sill: always there
  {
    const plant = new THREE.Group();
    plant.position.set(X(0.9, bot), bot, -0.8);
    plant.scale.setScalar(1.1);
    frame.add(plant);
    const pot = cyl(0.28, 0.2, 0.5);
    pot.position.y = 0.25;
    plant.add(pot);
    for (let k = 0; k < 9; k++) {
      const leaf = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 1.1 + (k % 3) * 0.25),
        new THREE.MeshBasicMaterial({ color: 0, side: THREE.DoubleSide })
      );
      leaf.geometry.translate(0, 0.55, 0);
      leaf.position.y = 0.48;
      leaf.rotation.z = (k - 4) * 0.2 + Math.sin(k * 7.3) * 0.1;
      leaf.rotation.y = k * 0.7;
      plant.add(leaf);
    }
    plant.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) m.castShadow = true;
    });
  }

  // switching tabs: the old object is lifted off the sill, the new one set down
  const PARKED = -4;
  const LIFTED = 3.5;
  const objects: Partial<Record<TabId, THREE.Group>> = {
    about: telescope(),
    projects: books(),
    portfolio: robot(),
    inspirations: rocket(),
  };
  const shelf = new THREE.Group();
  shelf.position.set(X(0.46, bot), bot, -1.15);
  shelf.scale.setScalar(1.6);
  frame.add(shelf);
  for (const object of Object.values(objects)) {
    object.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) m.castShadow = true;
    });
    object.position.y = PARKED;
    shelf.add(object);
  }
  // returns true while anything is still on its way
  const settle = (active: TabId, dt: number, still: boolean) => {
    let moving = false;
    for (const [key, object] of Object.entries(objects)) {
      const on = key === active;
      // leaving objects lift up and away, then park below, ready to be set down
      const target = on ? 0 : object.position.y < -0.5 ? PARKED : LIFTED;
      if (still) {
        object.position.y = on ? 0 : PARKED;
        continue;
      }
      const y =
        object.position.y +
        (target - object.position.y) * Math.min(1, dt * 3.4);
      object.position.y = Math.abs(target - y) < 0.002 ? target : y;
      if (!on && object.position.y >= LIFTED - 0.1) object.position.y = PARKED;
      if (object.position.y !== target) moving = true;
    }
    return moving;
  };

  // ---------- sizing ----------
  const resize = () => {
    const a = window.innerWidth / window.innerHeight;
    const vh = Math.max(VH, 14 / a); // narrow screens keep the whole window in frame
    const dx = a < 1 ? 2.2 : 0;
    const dy = a < 1 ? vh * 0.18 : 0;
    camera.left = (-vh * a) / 2 + dx;
    camera.right = (vh * a) / 2 + dx;
    camera.top = vh / 2 - dy;
    camera.bottom = -vh / 2 - dy;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    // generous: the light meets the wall at an angle, so its footprint is skewed
    const half = Math.max(VH * a, 14, vh) * 0.85;
    Object.assign(sun.shadow.camera, {
      left: -half,
      right: half,
      top: half,
      bottom: -half,
      near: 0.1,
      far: 40,
    });
    sun.shadow.camera.updateProjectionMatrix();
    sun.position.copy(L).multiplyScalar(20);
    sun.target.position.set(0, 0, 0);
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
      wind(time);
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
    resize();
    kick();
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
