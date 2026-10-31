// A monstera in a lipped pot, built as a small growth hierarchy: stalks rise
// from the soil at staggered heights and angles, arch out, and each carries a
// split, heart-based leaf on a short hinge. Leaves face roughly toward the sun
// so their cuts and holes read in the shadow; each one sways on its stalk.
import * as THREE from 'three';
import { SUN, V2, V3, group, ink, lathe, merge, tube } from './wallKit';

// The leaf outline, base at the origin and tip at (0, 1), with the pinnate
// splits that make a monstera unmistakable. Splits are cut wide enough to
// survive the soft edge of a sun shadow.
function leafShape(splits: number, seed: number) {
  // right half outline, base sinus → lobe → widest → tip
  const edge = new THREE.SplineCurve([
    V2(0, 0.06),
    V2(0.14, -0.08),
    V2(0.36, -0.07),
    V2(0.52, 0.14),
    V2(0.55, 0.42),
    V2(0.45, 0.7),
    V2(0.24, 0.9),
    V2(0, 1),
  ]);
  const samples = 120;
  const pts = edge.getSpacedPoints(samples);
  const GAP = 5; // samples across a split at the edge, about 0.07 of the leaf
  const half = (side: 1 | -1) => {
    const out: THREE.Vector2[] = [];
    const starts = Array.from({ length: splits }, (_, k) =>
      Math.round(
        (0.2 +
          (k / splits) * 0.6 +
          Math.sin(seed * 7.1 + k * 3.3 + side) * 0.025) *
          samples
      )
    );
    const towardRib = (p: THREE.Vector2, depth: number) =>
      p.clone().lerp(V2(0, Math.min(0.95, p.y + 0.2)), depth);
    for (let i = 0; i <= samples; i++) {
      const p = pts[i];
      out.push(V2(p.x * side, p.y));
      if (starts.includes(i) && i + GAP <= samples) {
        const q = pts[i + GAP];
        const depth = 0.6 + Math.sin(seed + i) * 0.07;
        const a = towardRib(p, depth);
        const b = towardRib(q, depth * 0.96);
        // round the inner end of the split
        const mid = a
          .clone()
          .lerp(b, 0.5)
          .lerp(V2(0, a.y + 0.1), 0.06);
        out.push(
          V2(a.x * side, a.y),
          V2(mid.x * side, mid.y),
          V2(b.x * side, b.y)
        );
        out.push(V2(q.x * side, q.y));
        i += GAP;
      }
    }
    return out;
  };
  const right = half(1);
  const left = half(-1).reverse();
  const shape = new THREE.Shape([...right, ...left.slice(1)]);
  // windows either side of the midrib, between the splits
  const holes: [number, number, number][] = [
    [0.14, 0.33, 0.045],
    [-0.15, 0.4, 0.042],
    [0.13, 0.55, 0.036],
    [-0.12, 0.63, 0.032],
  ];
  for (const [x, y, r] of holes) {
    const hole = new THREE.Path();
    hole.absellipse(x, y, r, r * 1.7, 0, Math.PI * 2, true, 0.4);
    shape.holes.push(hole);
  }
  return shape;
}

interface Stalk {
  pivot: THREE.Group;
  phase: number;
  reach: number;
}

export function createPlant() {
  const plant = new THREE.Group();

  // the pot: rolled lip, tapered body, foot, on a saucer
  const pot = new THREE.Group();
  pot.add(
    lathe([
      [0, 0],
      [0.33, 0],
      [0.35, 0.02],
      [0.3, 0.05],
    ])
  );
  pot.add(
    lathe([
      [0, 0.04],
      [0.21, 0.04],
      [0.23, 0.08],
      [0.29, 0.5],
      [0.31, 0.5],
      [0.34, 0.52],
      [0.35, 0.6],
      [0.33, 0.63],
      [0.28, 0.63],
      [0, 0.6],
    ])
  );

  plant.add(merge(pot));

  const soil = 0.6;
  const stalks: Stalk[] = [];
  const leaves: [number, number, number, number, number][] = [
    // azimuth (around the pot; 0 points right along the wall, π left), tilt
    // out from vertical, stalk length, leaf size, splits per side
    [1.5, 0.42, 1.9, 1.1, 5],
    [5.5, 0.5, 1.6, 1.0, 4],
    [2.5, 0.62, 1.35, 0.95, 4],
    [0.35, 0.72, 1.3, 0.9, 4],
    [3.9, 0.9, 1.0, 0.75, 3],
    [0.9, 1.05, 0.95, 0.7, 3],
  ];
  leaves.forEach(([azimuth, tilt, length, size, splits], k) => {
    const pivot = new THREE.Group();
    pivot.position.set(
      Math.cos(azimuth) * 0.06,
      soil,
      Math.sin(azimuth) * 0.06
    );
    plant.add(pivot);
    // the stalk rises, then arches over under the leaf's weight
    const out = V3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const up = V3(0, 1, 0);
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const lean = tilt * (0.45 + t * 0.9);
      points.push(
        out
          .clone()
          .multiplyScalar(Math.sin(lean) * length * t)
          .addScaledVector(
            up,
            Math.cos(lean) * length * t - t * t * 0.18 * tilt
          )
      );
    }
    pivot.add(tube(points, 0.032 - k * 0.002, 24));
    const tip = points[points.length - 1];
    const along = tip
      .clone()
      .sub(points[points.length - 2])
      .normalize();

    // the leaf: midrib carries on from the stalk and droops; the blade turns
    // toward the sun so its outline lands whole on the wall
    const midrib = along
      .clone()
      .lerp(out.clone().setY(-0.35), 0.55)
      .normalize();
    const facing = SUN.clone()
      .lerp(out.clone().setY(0.2), 0.3)
      .addScaledVector(midrib, -SUN.dot(midrib))
      .normalize();
    const side = midrib.clone().cross(facing).normalize();
    const blade = new THREE.Mesh(
      new THREE.ShapeGeometry(leafShape(splits, k + 1), 6),
      ink
    );
    blade.castShadow = true;
    blade.scale.setScalar(size);
    blade.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(side, midrib, facing)
    );
    blade.rotateZ(Math.sin(k * 2.3) * 0.25);
    const hinge = group(blade);
    hinge.position.copy(tip);
    pivot.add(hinge);
    // the stalk and its leaf sway as one piece
    const piece = merge(pivot);
    pivot.clear();
    pivot.add(piece);
    stalks.push({ pivot, phase: k * 1.7, reach: length });
  });

  plant.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) node.castShadow = true;
  });

  return {
    group: plant,
    // a breeze through the window: each stalk sways from the soil, longer
    // ones further and slower
    sway(time: number, strength: number) {
      for (const { pivot, phase, reach } of stalks) {
        const slow = Math.sin(time * (1.1 / reach) + phase);
        const quick = Math.sin(time * 2.7 + phase * 2.1) * 0.25;
        pivot.rotation.z = (slow + quick) * 0.035 * strength;
        pivot.rotation.x = Math.sin(time * 0.8 + phase) * 0.025 * strength;
      }
    },
  };
}
