// Building blocks for things that are only ever seen as shadows. Nothing here
// is lit or textured; what matters is the outline the sun throws on the wall.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// direction toward the sun, shared by every caster
export const SUN = new THREE.Vector3(-0.5, 0.42, 0.76).normalize();

export const ink = new THREE.MeshBasicMaterial({
  color: 0x000000,
  side: THREE.DoubleSide,
});

const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export { V2, V3 };

export const mesh = (geometry: THREE.BufferGeometry) => {
  const m = new THREE.Mesh(geometry, ink);
  m.castShadow = true;
  return m;
};

// A turned part, from a profile of [radius, height] pairs.
export const lathe = (profile: [number, number][], segments = 28) =>
  mesh(
    new THREE.LatheGeometry(
      profile.map(([r, y]) => V2(Math.max(r, 0.0001), y)),
      segments
    )
  );

// A round bar from a to b.
export const rod = (
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  radiusB = radius,
  segments = 10
) => {
  const length = a.distanceTo(b);
  const geometry = new THREE.CylinderGeometry(
    radiusB,
    radius,
    length,
    segments
  );
  geometry.translate(0, length / 2, 0);
  geometry.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      V3(0, 1, 0),
      b.clone().sub(a).normalize()
    )
  );
  geometry.translate(a.x, a.y, a.z);
  return mesh(geometry);
};

// A bent bar through points (a stem, a cable, a spring).
export const tube = (
  points: THREE.Vector3[],
  radius: number,
  segments = 48,
  closed = false
) =>
  mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points, closed, 'centripetal'),
      segments,
      radius,
      8,
      closed
    )
  );

export const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return mesh(geometry);
};

// A box with softened edges, as anything moulded or pressed has.
export const rbox = (
  w: number,
  h: number,
  d: number,
  r: number,
  x = 0,
  y = 0,
  z = 0
) => {
  const geometry = new RoundedBoxGeometry(w, h, d, 3, r);
  geometry.translate(x, y, z);
  return mesh(geometry);
};

export const ball = (r: number, x = 0, y = 0, z = 0) => {
  const geometry = new THREE.SphereGeometry(r, 18, 12);
  geometry.translate(x, y, z);
  return mesh(geometry);
};

// A flat outline given thickness along the sun's direction, so holes in it
// stay open in the shadow (a hole cut straight through a slab closes up when
// the light comes in at an angle).
export const plate = (
  shape: THREE.Shape,
  depth: number,
  curveSegments = 24
) => {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments,
  });
  geometry.translate(0, 0, -depth / 2);
  // prettier-ignore
  const s = new THREE.Matrix4().set(
    1, 0, SUN.x / SUN.z, 0,
    0, 1, SUN.y / SUN.z, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  );
  geometry.applyMatrix4(s);
  return mesh(geometry);
};

export const roundedRect = (
  w: number,
  h: number,
  r: number,
  cx = 0,
  cy = 0
) => {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

export const circlePath = (r: number, cx = 0, cy = 0) => {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
};

// A coil: springs read beautifully in shadow.
export const spring = (
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  turns: number,
  wire: number
) => {
  const axis = b.clone().sub(a);
  const length = axis.length();
  const q = new THREE.Quaternion().setFromUnitVectors(
    V3(0, 1, 0),
    axis.normalize()
  );
  const points: THREE.Vector3[] = [];
  const steps = Math.round(turns * 12);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2;
    points.push(
      V3(Math.cos(angle) * radius, t * length, Math.sin(angle) * radius)
        .applyQuaternion(q)
        .add(a)
    );
  }
  return tube(points, wire, steps * 2);
};

export const group = (...children: THREE.Object3D[]) => {
  const g = new THREE.Group();
  children.forEach((c) => g.add(c));
  return g;
};

// Collapse everything under root into one mesh (one draw per shadow pass).
// Only outlines matter here, so positions are all that's kept.
export const merge = (root: THREE.Object3D) => {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const parts: THREE.BufferGeometry[] = [];
  root.traverse((node) => {
    const m = node as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position') g.deleteAttribute(name);
    }
    g.applyMatrix4(inverse.clone().multiply(m.matrixWorld));
    parts.push(g);
    m.geometry.dispose();
  });
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return mesh(merged);
};
