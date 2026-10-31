// A sheer curtain, simulated as cloth: a panel half again as wide as its rod,
// pinned in pleats along the top, hanging under gravity, stirred by gusts
// through the open window. Only its shadow is seen, so the fabric is a fine
// stochastic cut-out: the shadow pass keeps a share of fragments equal to the
// cloth's density, and the shadow blur turns that into a translucent grey that
// darkens where the fabric folds back on itself and at the doubled hem.
import * as THREE from 'three';

interface CurtainOptions {
  // rod ends and height, in the window frame's units
  left: number;
  right: number;
  rodY: number;
  // the sill top: the hem rests just above it
  sillY: number;
  // depth into the room (negative z) the rod hangs at
  rodZ: number;
}

const COLS = 30;
const ROWS = 46;
const FULLNESS = 1.6; // fabric width / rod width
// 30 steps a second: the wall draws at 20 fps between page changes, and a
// sheer curtain's slow motion needs no more
const STEP = 1 / 30;
const ITERATIONS = 8;
const GRAVITY = -7.5;
const DAMPING = 0.97; // per step: 0.985 per 1/60 s

// fabric density across the panel (0..1 of light stopped)
// One stripe's width, tiled STRIPES times across the panel; the hem and
// heading bands run the full height.
const STRIPES = 11;
function fabricTexture() {
  const W = 48;
  const H = 2048;
  // whole RGBA texels written at once; row 0 is the hem (bottom, unflipped)
  const pixels = new Uint32Array(W * H);
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let y = 0; y < H; y++) {
    const v = y / H; // 0 at the hem, 1 at the heading
    for (let x = 0; x < W; x++) {
      const stripe = x / W;
      let density = 0.48;
      // woven satin stripes in the voile
      if (stripe < 0.12) density = 0.72;
      if (stripe > 0.5 && stripe < 0.53) density = 0.55;
      // the doubled hem and the heading tape
      if (v < 0.045) density = 0.86;
      else if (v < 0.052) density = 0.5;
      if (v > 0.965) density = 0.95;
      pixels[y * W + x] = random() < density ? 0xffffffff : 0xff000000;
    }
  }
  const texture = new THREE.DataTexture(new Uint8Array(pixels.buffer), W, H);
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(STRIPES, 1);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function createCurtain({
  left,
  right,
  rodY,
  sillY,
  rodZ,
}: CurtainOptions) {
  const rodWidth = right - left;
  const fabricWidth = rodWidth * FULLNESS;
  const length = rodY - sillY - 0.08;
  const dx = fabricWidth / (COLS - 1);
  const dy = length / (ROWS - 1);
  const count = COLS * ROWS;

  const pos = new Float32Array(count * 3);
  const prev = new Float32Array(count * 3);
  const pinned = new Uint8Array(count);
  const pin = new Float32Array(COLS * 3);
  const index = (c: number, r: number) => r * COLS + c;

  // the heading: gathered into pinch pleats along the rod
  for (let c = 0; c < COLS; c++) {
    const t = c / (COLS - 1);
    const pleat = Math.sin(t * Math.PI * 9) * 0.11;
    pin[c * 3] = left + t * rodWidth;
    pin[c * 3 + 1] = rodY;
    pin[c * 3 + 2] = rodZ + pleat;
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = index(c, r) * 3;
      // start hanging straight down from the rod, slightly fanned so it
      // settles into folds instead of a flat sheet
      const t = c / (COLS - 1);
      const spread = 1 + (r / ROWS) * 0.25;
      pos[i] = left + rodWidth / 2 + (t - 0.5) * rodWidth * spread;
      pos[i + 1] = rodY - r * dy;
      pos[i + 2] = pin[c * 3 + 2] * (1 - r / ROWS) + rodZ * (r / ROWS);
      prev[i] = pos[i];
      prev[i + 1] = pos[i + 1];
      prev[i + 2] = pos[i + 2];
    }
  }
  for (let c = 0; c < COLS; c++) pinned[index(c, 0)] = 1;

  // distance constraints: structure, shear, and a softer bend
  const links: number[] = []; // a, b, rest, stiffness
  const link = (a: number, b: number, rest: number, k: number) =>
    links.push(a, b, rest, k);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = index(c, r);
      if (c + 1 < COLS) link(a, index(c + 1, r), dx, 1);
      if (r + 1 < ROWS) link(a, index(c, r + 1), dy, 1);
      if (c + 1 < COLS && r + 1 < ROWS) {
        const d = Math.hypot(dx, dy);
        link(a, index(c + 1, r + 1), d, 0.6);
        link(index(c + 1, r), index(c, r + 1), d, 0.6);
      }
      if (c + 2 < COLS) link(a, index(c + 2, r), dx * 2, 0.12);
      if (r + 2 < ROWS) link(a, index(c, r + 2), dy * 2, 0.25);
    }
  }
  // flattened for the solver: endpoints (as position offsets), rest length,
  // stiffness, and how much of the correction each end takes (a pinned end
  // takes none, its partner all of it)
  const linkCount = links.length / 4;
  const linkA = new Int32Array(linkCount);
  const linkB = new Int32Array(linkCount);
  const linkRest = new Float32Array(linkCount);
  const linkK = new Float32Array(linkCount);
  const shareA = new Float32Array(linkCount);
  const shareB = new Float32Array(linkCount);
  for (let l = 0; l < linkCount; l++) {
    const a = links[l * 4];
    const b = links[l * 4 + 1];
    linkA[l] = a * 3;
    linkB[l] = b * 3;
    linkRest[l] = links[l * 4 + 2];
    linkK[l] = links[l * 4 + 3];
    shareA[l] = pinned[a] ? 0 : pinned[b] ? 2 : 1;
    shareB[l] = pinned[b] ? 0 : pinned[a] ? 2 : 1;
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(pos, 3);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttr);
  const uv = new Float32Array(count * 2);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = index(c, r) * 2;
      uv[i] = c / (COLS - 1);
      uv[i + 1] = 1 - r / (ROWS - 1);
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const triangles: number[] = [];
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const a = index(c, r);
      const b = index(c + 1, r);
      const d = index(c, r + 1);
      const e = index(c + 1, r + 1);
      triangles.push(a, d, b, b, d, e);
    }
  }
  geometry.setIndex(triangles);
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(left + rodWidth / 2, (rodY + sillY) / 2, rodZ),
    length + fabricWidth
  );

  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    alphaMap: fabricTexture(),
    alphaTest: 0.5,
  });
  const curtain = new THREE.Mesh(geometry, material);
  curtain.castShadow = true;
  curtain.frustumCulled = false;

  // ---------- wind ----------
  // Gusts come in from the window (+z toward the room is -z here) and drift
  // toward the curtain's free edge; each has its own swell and lull.
  const wind = new THREE.Vector3();
  const windAt = (t: number) => {
    const swell =
      0.55 +
      0.45 * Math.sin(t * 0.23) +
      0.35 * Math.sin(t * 0.61 + 1.3) +
      0.2 * Math.sin(t * 1.37 + 0.4);
    const strength = Math.max(0, swell) * 2.4;
    wind
      .set(0.35 + 0.25 * Math.sin(t * 0.17), 0.1, -1)
      .multiplyScalar(strength);
    return wind;
  };

  let time = 0;
  let accumulator = 0;

  const step = (calm: boolean) => {
    time += STEP;
    const w = calm ? wind.set(0, 0, 0) : windAt(time);
    const gust = calm ? 0 : 1;
    const S2 = STEP * STEP;
    for (let r = 1; r < ROWS; r++) {
      const hemWeight = r === ROWS - 1 ? 2.4 : r > ROWS - 4 ? 1.4 : 1;
      const rowFlutter = gust * 0.6 * Math.sin(time * 1.7 + r * 0.21);
      const up = (r - 1) * COLS * 3;
      const down = Math.min(ROWS - 1, r + 1) * COLS * 3;
      const row = r * COLS * 3;
      for (let c = 0; c < COLS; c++) {
        const i = row + c * 3;
        // the cloth's facing decides how much the wind can push it
        const cl = row + Math.max(0, c - 1) * 3;
        const cr = row + Math.min(COLS - 1, c + 1) * 3;
        const ax0 = pos[cr] - pos[cl];
        const ay0 = pos[cr + 1] - pos[cl + 1];
        const az0 = pos[cr + 2] - pos[cl + 2];
        const bx0 = pos[down + c * 3] - pos[up + c * 3];
        const by0 = pos[down + c * 3 + 1] - pos[up + c * 3 + 1];
        const bz0 = pos[down + c * 3 + 2] - pos[up + c * 3 + 2];
        let nx = ay0 * bz0 - az0 * by0;
        let ny = az0 * bx0 - ax0 * bz0;
        let nz = ax0 * by0 - ay0 * bx0;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        const x = pos[i];
        const y = pos[i + 1];
        const z = pos[i + 2];
        const vx = (x - prev[i]) / STEP;
        const vy = (y - prev[i + 1]) / STEP;
        const vz = (z - prev[i + 2]) / STEP;
        const push =
          (nx * (w.x - vx) + ny * (w.y - vy) + nz * (w.z - vz)) * 1.6;
        // a little turbulence so neighbouring folds don't move in lockstep
        const flutter = rowFlutter * Math.sin(time * 3.1 + c * 0.9 + r * 0.37);
        pos[i] +=
          (x - prev[i]) * DAMPING +
          ((nx * push + flutter * 0.4) / hemWeight) * S2;
        pos[i + 1] +=
          (y - prev[i + 1]) * DAMPING +
          (GRAVITY + (ny * push) / hemWeight) * S2;
        pos[i + 2] +=
          (z - prev[i + 2]) * DAMPING +
          ((nz * push + flutter) / hemWeight) * S2;
        prev[i] = x;
        prev[i + 1] = y;
        prev[i + 2] = z;
      }
    }
    for (let k = 0; k < ITERATIONS; k++) {
      for (let l = 0; l < linkCount; l++) {
        const p = linkA[l];
        const q = linkB[l];
        const ex = pos[q] - pos[p];
        const ey = pos[q + 1] - pos[p + 1];
        const ez = pos[q + 2] - pos[p + 2];
        const d = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-6;
        const rest = linkRest[l];
        // fabric resists stretching, not crumpling
        if (d < rest && linkK[l] < 1) continue;
        const f = ((d - rest) / d) * 0.5 * linkK[l];
        const fp = f * shareA[l];
        const fq = f * shareB[l];
        pos[p] += ex * fp;
        pos[p + 1] += ey * fp;
        pos[p + 2] += ez * fp;
        pos[q] -= ex * fq;
        pos[q + 1] -= ey * fq;
        pos[q + 2] -= ez * fq;
      }
      for (let c = 0; c < COLS; c++) {
        const i = index(c, 0) * 3;
        pos[i] = pin[c * 3];
        pos[i + 1] = pin[c * 3 + 1];
        pos[i + 2] = pin[c * 3 + 2];
      }
      // the window glass behind it, and the sill under the hem
      for (let i = 0; i < pos.length; i += 3) {
        if (pos[i + 2] > -0.04) pos[i + 2] = -0.04;
        if (pos[i + 1] < sillY + 0.02 && pos[i + 2] > -1.8) {
          pos[i + 1] = sillY + 0.02;
        }
      }
    }
  };

  return {
    mesh: curtain,
    // advance the cloth by dt seconds of real time
    update(dt: number, calm = false) {
      accumulator = Math.min(accumulator + dt, STEP * 6);
      while (accumulator >= STEP) {
        step(calm);
        accumulator -= STEP;
      }
      positionAttr.needsUpdate = true;
    },
    // let it hang and settle before it's first seen
    settle(seconds: number, calm = false) {
      for (let s = 0; s < seconds / STEP; s++) step(calm);
      positionAttr.needsUpdate = true;
    },
  };
}
