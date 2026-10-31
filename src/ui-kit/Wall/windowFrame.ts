// The window the sun comes through. It's built square, as joinery: an outer
// frame, a transom with three top lights (the right one tipped open on a
// stay), and two casement sashes below with their meeting stiles, divided
// panes, lever handle and hinges. Members have real depth, so with the sun
// coming in at an angle their shadows thicken on one side the way real
// frames' do. The whole window is then sheared, which is what lays its light
// on the wall as the long slanted patch of a low sun.
import * as THREE from 'three';
import { V3, ball, box, ink, merge, rod } from './wallKit';

interface WindowOptions {
  left: number;
  right: number;
  top: number;
  bot: number;
  // sideways lean of the light per unit of height, x += (top - y) * shear
  shear: number;
}

const FRAME = 0.09; // outer frame members
const STILE = 0.065; // sash sides and top rails
const BOTTOM_RAIL = 0.1;
const BAR = 0.03; // glazing bars

export function createWindow({ left, right, top, bot, shear }: WindowOptions) {
  const win = new THREE.Group();
  win.matrixAutoUpdate = false;
  // prettier-ignore
  win.matrix.set(
    1, -shear, 0, shear * top,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  );
  const add = (...parts: THREE.Object3D[]) => parts.forEach((p) => win.add(p));

  // the wall the window is set in
  const wall = new THREE.Shape([
    new THREE.Vector2(-80, -80),
    new THREE.Vector2(80, -80),
    new THREE.Vector2(80, 80),
    new THREE.Vector2(-80, 80),
  ]);
  const hole = new THREE.Path();
  hole.moveTo(left, bot);
  hole.lineTo(left, top);
  hole.lineTo(right, top);
  hole.lineTo(right, bot);
  hole.lineTo(left, bot);
  wall.holes.push(hole);
  const wallMesh = new THREE.Mesh(new THREE.ShapeGeometry(wall), ink);
  wallMesh.castShadow = true;
  add(wallMesh);

  // a horizontal or vertical member between two points in the window plane
  const member = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    depth: number,
    z: number
  ) =>
    box(
      Math.abs(x1 - x0),
      Math.abs(y1 - y0),
      depth,
      (x0 + x1) / 2,
      (y0 + y1) / 2,
      z
    );

  // outer frame
  const L = left + FRAME;
  const R = right - FRAME;
  const T = top - FRAME;
  const B = bot + FRAME * 1.2;
  add(
    member(left, T, right, top, 0.12, -0.06),
    member(left, bot, right, B, 0.12, -0.06),
    member(left, bot, L, top, 0.12, -0.06),
    member(R, bot, right, top, 0.12, -0.06)
  );

  // transom, and the mullions between the three top lights
  const H = top - bot;
  const transom = top - H * 0.3;
  const tHalf = 0.055;
  add(member(L, transom - tHalf, R, transom + tHalf, 0.14, -0.07));
  const lightW = (R - L) / 3;
  const mullions = [L + lightW, L + lightW * 2];
  for (const m of mullions) {
    add(member(m - 0.04, transom + tHalf, m + 0.04, T, 0.12, -0.06));
  }

  // a sash: its frame, and glazing bars dividing it into cols × rows panes
  const sash = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    cols: number,
    rows: number,
    z = -0.1
  ) => {
    const g = new THREE.Group();
    const d = 0.06;
    g.add(
      member(x0, y1 - STILE, x1, y1, d, z),
      member(x0, y0, x1, y0 + BOTTOM_RAIL, d, z),
      member(x0, y0, x0 + STILE, y1, d, z),
      member(x1 - STILE, y0, x1, y1, d, z)
    );
    const ix0 = x0 + STILE;
    const ix1 = x1 - STILE;
    const iy0 = y0 + BOTTOM_RAIL;
    const iy1 = y1 - STILE;
    for (let c = 1; c < cols; c++) {
      const x = ix0 + ((ix1 - ix0) * c) / cols;
      g.add(member(x - BAR / 2, iy0, x + BAR / 2, iy1, 0.035, z));
    }
    for (let r = 1; r < rows; r++) {
      const y = iy0 + ((iy1 - iy0) * r) / rows;
      g.add(member(ix0, y - BAR / 2, ix1, y + BAR / 2, 0.035, z));
    }
    return g;
  };

  // the two casements, meeting in the middle
  const mid = (L + R) / 2;
  const cTop = transom - tHalf;
  add(sash(L, B, mid - 0.003, cTop, 2, 3), sash(mid + 0.003, B, R, cTop, 2, 3));
  // lever handle on the right sash's meeting stile, pointing down
  const handleY = (B + cTop) / 2;
  const hx = mid + STILE / 2;
  add(
    box(0.04, 0.17, 0.02, hx, handleY, -0.14),
    rod(V3(hx, handleY + 0.04, -0.15), V3(hx, handleY + 0.04, -0.2), 0.018),
    rod(
      V3(hx, handleY + 0.04, -0.2),
      V3(hx + 0.035, handleY - 0.2, -0.2),
      0.016,
      0.013
    ),
    ball(0.022, hx + 0.035, handleY - 0.2, -0.2)
  );
  // hinge knuckles on the outer stiles
  for (const x of [L + 0.012, R - 0.012]) {
    for (const y of [B + 0.35, cTop - 0.35]) {
      add(rod(V3(x, y - 0.07, -0.13), V3(x, y + 0.07, -0.13), 0.02));
    }
  }
  // casement stays along each bottom rail
  for (const [x0, x1] of [
    [L + 0.25, mid - 0.35],
    [mid + 0.35, R - 0.25],
  ]) {
    const y = B + BOTTOM_RAIL + 0.02;
    add(rod(V3(x0, y, -0.15), V3(x1, y, -0.15), 0.011));
    add(rod(V3(x1 - 0.06, y, -0.1), V3(x1 - 0.06, y, -0.17), 0.016));
  }

  // top lights: the left and middle fixed, the right tipped in on a stay,
  // which is where the breeze comes from (the curtain hides the left one)
  const lTop = T;
  const lBot = transom + tHalf;
  const TILT = 0.34;
  add(sash(L, lBot, mullions[0] - 0.04, lTop, 2, 1));
  add(sash(mullions[0] + 0.04, lBot, mullions[1] - 0.04, lTop, 2, 1));
  const hopper = new THREE.Group();
  hopper.position.set(0, lBot, -0.07);
  hopper.rotation.x = -TILT;
  hopper.add(sash(mullions[1] + 0.04, 0, R, lTop - lBot, 2, 1, 0));
  add(hopper);
  // the friction stay from the frame to the open sash
  const stayAt = lTop - lBot - 0.25;
  const sashPoint = V3(
    R - 0.04,
    lBot + stayAt * Math.cos(TILT),
    -0.07 - stayAt * Math.sin(TILT)
  );
  add(rod(V3(R - 0.02, lBot + 0.12, -0.08), sashPoint, 0.012));

  // one mesh for the whole window
  const merged = merge(win);
  win.clear();
  win.add(merged);

  return { group: win, transom, frameBottom: B };
}
