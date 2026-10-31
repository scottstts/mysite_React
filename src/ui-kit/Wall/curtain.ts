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
const STEP = 1 / 60;
const ITERATIONS = 7;
const GRAVITY = -7.5;
const DAMPING = 0.985;

// fabric density across the panel (0..1 of light stopped)
function fabricTexture() {
  const W = 512;
  const H = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(W, H);
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let y = 0; y < H; y++) {
    const v = y / H; // 0 at the hem, 1 at the heading
    for (let x = 0; x < W; x++) {
      const u = x / W;
      let density = 0.48;
      // woven satin stripes in the voile
      const stripe = (u * 11) % 1;
      if (stripe < 0.12) density = 0.72;
      if (stripe > 0.5 && stripe < 0.53) density = 0.55;
      // the doubled hem and the heading tape
      if (v < 0.045) density = 0.86;
      else if (v < 0.052) density = 0.5;
      if (v > 0.965) density = 0.95;
      const i = (y * W + x) * 4;
      const k = random() < density ? 255 : 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
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
  const linkData = new Float32Array(links);

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

  const normal = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  let time = 0;
  let accumulator = 0;

  const step = (calm: boolean) => {
    time += STEP;
    const w = calm ? wind.set(0, 0, 0) : windAt(time);
    const gust = calm ? 0 : 1;
    for (let r = 1; r < ROWS; r++) {
      const hemWeight = r === ROWS - 1 ? 2.4 : r > ROWS - 4 ? 1.4 : 1;
      for (let c = 0; c < COLS; c++) {
        const n = index(c, r);
        const i = n * 3;
        // the cloth's facing decides how much the wind can push it
        const cl = Math.max(0, c - 1);
        const cr = Math.min(COLS - 1, c + 1);
        const ru = r - 1;
        const rd = Math.min(ROWS - 1, r + 1);
        a.set(
          pos[index(cr, r) * 3] - pos[index(cl, r) * 3],
          pos[index(cr, r) * 3 + 1] - pos[index(cl, r) * 3 + 1],
          pos[index(cr, r) * 3 + 2] - pos[index(cl, r) * 3 + 2]
        );
        b.set(
          pos[index(c, rd) * 3] - pos[index(c, ru) * 3],
          pos[index(c, rd) * 3 + 1] - pos[index(c, ru) * 3 + 1],
          pos[index(c, rd) * 3 + 2] - pos[index(c, ru) * 3 + 2]
        );
        normal.crossVectors(a, b).normalize();
        const vx = (pos[i] - prev[i]) / STEP;
        const vy = (pos[i + 1] - prev[i + 1]) / STEP;
        const vz = (pos[i + 2] - prev[i + 2]) / STEP;
        const push =
          normal.x * (w.x - vx) + normal.y * (w.y - vy) + normal.z * (w.z - vz);
        // a little turbulence so neighbouring folds don't move in lockstep
        const flutter =
          gust *
          0.6 *
          Math.sin(time * 3.1 + c * 0.9 + r * 0.37) *
          Math.sin(time * 1.7 + r * 0.21);
        const ax = (normal.x * push * 1.6 + flutter * 0.4) / hemWeight;
        const ay = GRAVITY + (normal.y * push * 1.6) / hemWeight;
        const az = (normal.z * push * 1.6 + flutter) / hemWeight;
        const x = pos[i];
        const y = pos[i + 1];
        const z = pos[i + 2];
        pos[i] += (x - prev[i]) * DAMPING + ax * STEP * STEP;
        pos[i + 1] += (y - prev[i + 1]) * DAMPING + ay * STEP * STEP;
        pos[i + 2] += (z - prev[i + 2]) * DAMPING + az * STEP * STEP;
        prev[i] = x;
        prev[i + 1] = y;
        prev[i + 2] = z;
      }
    }
    for (let k = 0; k < ITERATIONS; k++) {
      for (let l = 0; l < linkData.length; l += 4) {
        const p = linkData[l] * 3;
        const q = linkData[l + 1] * 3;
        const ex = pos[q] - pos[p];
        const ey = pos[q + 1] - pos[p + 1];
        const ez = pos[q + 2] - pos[p + 2];
        const d = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1e-6;
        // fabric resists stretching, not crumpling
        if (d < linkData[l + 2] && linkData[l + 3] < 1) continue;
        const f = ((d - linkData[l + 2]) / d) * 0.5 * linkData[l + 3];
        const pp = pinned[linkData[l]] ? 0 : pinned[linkData[l + 1]] ? 2 : 1;
        const qq = pinned[linkData[l + 1]] ? 0 : pinned[linkData[l]] ? 2 : 1;
        pos[p] += ex * f * pp;
        pos[p + 1] += ey * f * pp;
        pos[p + 2] += ez * f * pp;
        pos[q] -= ex * f * qq;
        pos[q + 1] -= ey * f * qq;
        pos[q + 2] -= ez * f * qq;
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
