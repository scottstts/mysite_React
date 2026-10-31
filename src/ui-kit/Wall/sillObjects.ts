// The object on the sill, one per page. Units: 1 = the shelf unit, origin on
// the sill top, x along the wall, y up, z toward the wall. Each is a real
// object modelled for its shadow under a low sun: it reads from its outline
// and the daylight between its parts, and anything the slanted light would
// smear (depth, a sphere's stretch) is proportioned so the outline survives.
import * as THREE from 'three';
import { V3, ball, box, lathe, mesh, rbox, rod, spring, tube } from './wallKit';

// About: a refractor on a tripod, aimed up into the unknown
export function telescope() {
  const g = new THREE.Group();
  const head = V3(0, 1.32, 0);
  // tripod: two-stage legs with a spreader tray
  const feet = [-2.2, 0.15, 2.0].map((a) =>
    V3(Math.sin(a) * 0.62, 0, Math.cos(a) * 0.45)
  );
  for (const foot of feet) {
    const knee = head.clone().lerp(foot, 0.58);
    g.add(rod(head, knee, 0.03, 0.03));
    g.add(rod(knee, foot, 0.022, 0.016));
    // the clamp where the legs telescope
    g.add(
      rod(knee.clone().lerp(head, 0.04), knee.clone().lerp(foot, 0.04), 0.04)
    );
    g.add(ball(0.022, foot.x, 0.012, foot.z));
  }
  const tray = head.clone().lerp(V3(0, 0, 0), 0.6);
  for (const foot of feet) {
    const at = head.clone().lerp(foot, 0.6);
    g.add(rod(tray, at, 0.009));
  }
  g.add(
    lathe(
      [
        [0, 0],
        [0.13, 0],
        [0.13, 0.02],
        [0, 0.02],
      ],
      3
    ).translateY(tray.y)
  );
  // mount: head plate, alt-az fork, slow-motion cable
  g.add(
    lathe([
      [0, 0],
      [0.11, 0],
      [0.11, 0.06],
      [0.06, 0.06],
      [0.05, 0.14],
      [0, 0.14],
    ]).translateY(head.y - 0.03)
  );
  g.add(box(0.05, 0.22, 0.2, 0.0, head.y + 0.2, 0));

  // optical tube, aimed up and to the right
  const tubeGroup = new THREE.Group();
  tubeGroup.position.set(0, head.y + 0.3, 0);
  tubeGroup.rotation.z = -1.0; // lathe axis is y; tilt it toward upper right
  tubeGroup.rotation.y = -0.25;
  // profile along the axis: focuser drawtube, rear cell, main tube, objective
  // cell, dew shield
  tubeGroup.add(
    lathe(
      [
        [0, -0.78],
        [0.035, -0.78],
        [0.035, -0.62],
        [0.055, -0.6],
        [0.075, -0.56],
        [0.075, -0.5],
        [0.07, -0.48],
        [0.07, 0.6],
        [0.085, 0.62],
        [0.085, 0.68],
        [0.095, 0.7],
        [0.095, 1.02],
        [0.09, 1.02],
        [0, 1.0],
      ],
      24
    )
  );
  // tube rings and the saddle on the fork
  for (const y of [-0.2, 0.22]) {
    tubeGroup.add(
      lathe(
        [
          [0.08, y - 0.025],
          [0.09, y - 0.02],
          [0.09, y + 0.02],
          [0.08, y + 0.025],
        ],
        20
      )
    );
  }
  tubeGroup.add(box(0.05, 0.62, 0.05, -0.1, 0.01, 0));
  // finder scope on two brackets
  tubeGroup.add(rod(V3(0.13, -0.1, 0), V3(0.13, 0.3, 0), 0.022, 0.026));
  tubeGroup.add(rod(V3(0.075, -0.02, 0), V3(0.13, -0.02, 0), 0.008));
  tubeGroup.add(rod(V3(0.075, 0.2, 0), V3(0.13, 0.2, 0), 0.008));
  // focus knobs
  tubeGroup.add(rod(V3(-0.07, -0.58, 0), V3(-0.12, -0.6, 0), 0.016));
  // star diagonal and eyepiece, turned to look down into it
  const diag = V3(0, -0.78, 0);
  const bend = V3(0, -0.88, 0);
  tubeGroup.add(rod(diag, bend, 0.03));
  tubeGroup.add(ball(0.035, bend.x, bend.y, bend.z));
  tubeGroup.add(rod(bend, V3(0.15, -0.95, 0), 0.028, 0.034));
  g.add(tubeGroup);
  // the hand control cable, hanging in a loop
  g.add(
    tube(
      [
        V3(0.03, head.y + 0.12, 0),
        V3(0.12, head.y - 0.2, 0.02),
        V3(0.08, head.y - 0.55, 0),
        V3(0.02, head.y - 0.62, 0),
      ],
      0.008,
      30
    )
  );
  return g;
}

// Learning Journey: a desk globe under a reading lamp
export function deskSet() {
  const g = new THREE.Group();

  // the globe: a sphere on a tilted axis, held in a half meridian ring that
  // stands clear of it, on a turned stem and foot
  const globe = new THREE.Group();
  globe.position.x = 0.62;
  const R = 0.31;
  const centre = V3(0, 0.88, 0);
  globe.add(
    lathe([
      [0, 0],
      [0.25, 0],
      [0.26, 0.025],
      [0.22, 0.06],
      [0.1, 0.09],
      [0.06, 0.14],
      [0.07, 0.22],
      [0.045, 0.3],
      [0.035, 0.36],
      [0, 0.36],
    ])
  );
  const tilted = new THREE.Group();
  tilted.position.copy(centre);
  tilted.rotation.z = -0.41; // the earth's 23.4°
  tilted.add(ball(R));
  // the meridian: a half ring, a hand's breadth off the sphere
  // the sun stretches a sphere's shadow ~1.3× along the light; the ring stands
  // far enough off that the stretched disc still clears it
  const ring = new THREE.TorusGeometry(R * 1.55, 0.032, 8, 64, Math.PI * 1.1);
  ring.rotateZ(-Math.PI / 2 - 0.16); // the arc runs down the sunward side
  tilted.add(mesh(ring));
  // axis pins through the poles to the ring, with finials
  const pin = R * 1.55 + 0.03;
  tilted.add(rod(V3(0, -pin, 0), V3(0, pin, 0), 0.014));
  tilted.add(ball(0.03, 0, pin, 0));
  tilted.add(ball(0.03, 0, -pin, 0));
  globe.add(tilted);
  // the ring's foot meets the stem
  globe.add(rod(V3(0, 0.34, 0), V3(0.05, 0.43, 0), 0.03, 0.022));
  g.add(globe);

  // the lamp: weighted base, sprung arms, a deep shade bent over the globe
  const lamp = new THREE.Group();
  lamp.position.set(-0.78, 0, -0.04);
  lamp.add(
    lathe([
      [0, 0],
      [0.21, 0],
      [0.22, 0.025],
      [0.18, 0.07],
      [0.06, 0.09],
      [0.05, 0.15],
      [0, 0.15],
    ])
  );
  const base = V3(0, 0.15, 0);
  const elbow = V3(0.06, 1.3, 0);
  const wrist = V3(0.56, 1.8, 0);
  for (const dz of [-0.03, 0.03]) {
    lamp.add(rod(base.clone().setZ(dz), elbow.clone().setZ(dz), 0.014));
    lamp.add(rod(elbow.clone().setZ(dz), wrist.clone().setZ(dz), 0.012));
  }
  lamp.add(spring(V3(0.03, 0.3, 0.07), V3(0.055, 1.0, 0.07), 0.022, 9, 0.006));
  lamp.add(spring(V3(0.16, 1.39, 0.07), V3(0.44, 1.68, 0.07), 0.02, 7, 0.006));
  lamp.add(rod(V3(0.06, 1.3, -0.06), V3(0.06, 1.3, 0.06), 0.042)); // elbow knuckle
  lamp.add(rod(V3(0, 0.15, -0.06), V3(0, 0.15, 0.06), 0.038)); // base knuckle
  lamp.add(rod(wrist, wrist.clone().add(V3(0.06, 0.02, 0)), 0.028)); // wrist knuckle
  // the shade, built mouth-down and tipped toward the books
  const shade = lathe(
    [
      [0.0, 0.03],
      [0.05, 0.03],
      [0.06, 0.0],
      [0.075, -0.06],
      [0.1, -0.13],
      [0.17, -0.25],
      [0.25, -0.36],
      [0.275, -0.4],
    ],
    32
  );
  shade.position.copy(wrist).add(V3(0.08, 0, 0));
  shade.rotation.z = 0.62;
  lamp.add(shade);
  // the cord, looping from the shade down to the base
  lamp.add(
    tube(
      [
        wrist.clone().add(V3(0.0, 0.05, 0.03)),
        V3(0.4, 1.4, 0.08),
        V3(0.3, 0.6, 0.12),
        V3(0.1, 0.12, 0.14),
        V3(-0.28, 0.01, 0.16),
      ],
      0.008,
      40
    )
  );
  g.add(lamp);

  return g;
}

// Portfolio: a tin toy robot, turned a little toward the sun. It's solid
// all through and reads from its outline alone: a boxy head held up on a neck
// with daylight around it, ear discs and an antenna, square shoulders, ribbed
// arms held clear of the body ending in claws, and a stride between the legs.
// Built shallow front to back so the low sun doesn't smear it.
export function robot() {
  const g = new THREE.Group();
  // feet and legs
  for (const s of [-1, 1]) {
    const x = s * 0.16;
    g.add(rbox(0.21, 0.1, 0.28, 0.035, x, 0.05, 0.03));
    g.add(rod(V3(x, 0.1, 0), V3(x, 0.3, 0), 0.06, 0.055, 16));
    g.add(rod(V3(x, 0.3, 0), V3(x, 0.35, 0), 0.075, 0.075, 16)); // knee band
    g.add(rod(V3(x, 0.35, 0), V3(x, 0.56, 0), 0.055, 0.06, 16));
  }
  g.add(rbox(0.46, 0.12, 0.28, 0.04, 0, 0.6, 0)); // hips
  // torso: a pressed-tin box with a raised chest panel and a shoulder yoke
  g.add(rbox(0.56, 0.5, 0.34, 0.06, 0, 0.92, 0));
  g.add(rbox(0.66, 0.1, 0.34, 0.04, 0, 1.17, 0));
  g.add(rbox(0.3, 0.22, 0.06, 0.03, 0, 0.95, 0.18));
  // a tall neck, so daylight shows between head and shoulders
  g.add(rod(V3(0, 1.22, 0), V3(0, 1.36, 0), 0.06, 0.06, 16));
  g.add(rod(V3(0, 1.27, 0), V3(0, 1.3, 0), 0.085, 0.085, 16));
  // head: a block with a visor brow, big ear discs, an angled antenna
  g.add(rbox(0.48, 0.36, 0.32, 0.07, 0, 1.54, 0));
  g.add(rbox(0.4, 0.07, 0.06, 0.025, 0, 1.6, 0.17));
  for (const s of [-1, 1]) {
    g.add(rod(V3(s * 0.23, 1.54, 0), V3(s * 0.3, 1.54, 0), 0.1, 0.1, 24));
    g.add(rod(V3(s * 0.3, 1.54, 0), V3(s * 0.34, 1.54, 0), 0.04, 0.04, 12));
  }
  g.add(rod(V3(-0.08, 1.71, 0), V3(-0.22, 1.98, 0), 0.022, 0.016));
  g.add(ball(0.055, -0.225, 2.0, 0));
  g.add(rod(V3(0.1, 1.71, 0), V3(0.13, 1.8, 0), 0.02, 0.014));

  // arms: shoulder ball, ribbed upper arm, elbow, forearm, open claw
  const arm = (side: number, elbow: THREE.Vector3, hand: THREE.Vector3) => {
    const shoulder = V3(side * 0.38, 1.12, 0);
    g.add(ball(0.085, shoulder.x, shoulder.y, shoulder.z));
    for (let i = 0; i < 4; i++) {
      const a = shoulder.clone().lerp(elbow, 0.14 + i * 0.21);
      const b = shoulder.clone().lerp(elbow, 0.14 + i * 0.21 + 0.15);
      g.add(rod(a, b, 0.052, 0.052, 14));
    }
    g.add(ball(0.065, elbow.x, elbow.y, elbow.z));
    g.add(rod(elbow, hand, 0.046, 0.04, 14));
    const d = hand.clone().sub(elbow).normalize();
    const n = V3(0, 0, 1).cross(d).normalize();
    g.add(ball(0.05, hand.x, hand.y, hand.z));
    for (const s of [-1, 1]) {
      const base = hand.clone().addScaledVector(n, s * 0.03);
      g.add(
        tube(
          [
            base,
            base
              .clone()
              .addScaledVector(d, 0.08)
              .addScaledVector(n, s * 0.05),
            base
              .clone()
              .addScaledVector(d, 0.15)
              .addScaledVector(n, s * 0.012),
          ],
          0.017,
          10
        )
      );
    }
  };
  arm(-1, V3(-0.52, 0.86, 0), V3(-0.5, 0.6, 0.04)); // hanging, held off the side
  arm(1, V3(0.56, 0.9, 0), V3(0.76, 1.08, 0.06)); // forearm raised, reaching
  g.rotation.y = -0.28;
  g.scale.set(1.12, 1.12, 0.75);
  return g;
}

// Inspirations: a model satellite on a display rod: a body with its engine
// bell, long slim solar wings on booms with daylight between the panels, a
// dish side-on so its bowl and feed read, and a whip antenna
export function satellite() {
  const g = new THREE.Group();
  // stand
  g.add(
    lathe([
      [0, 0],
      [0.22, 0],
      [0.23, 0.02],
      [0.19, 0.05],
      [0.05, 0.06],
      [0, 0.06],
    ])
  );
  g.add(rod(V3(0, 0.06, 0), V3(0.0, 0.8, 0), 0.018));
  g.add(ball(0.03, 0, 0.8, 0));

  const sat = new THREE.Group();
  sat.position.set(0, 1.02, 0);
  sat.rotation.z = 0.12;
  sat.rotation.y = 0.12;
  // the body: a foil-wrapped box with banding, engine bell beneath
  sat.add(rbox(0.28, 0.34, 0.24, 0.02, 0, 0, 0));
  for (const y of [-0.1, 0.1]) sat.add(box(0.3, 0.025, 0.26, 0, y, 0));
  sat.add(
    lathe(
      [
        [0.03, -0.17],
        [0.04, -0.2],
        [0.075, -0.28],
        [0.07, -0.285],
      ],
      20
    )
  );
  // solar wings: a boom, then two slim panels with a wide gap and a hinge
  // bar across it; panels turned a little toward the sun
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.rotation.x = -0.35;
    wing.add(rod(V3(s * 0.14, 0, 0), V3(s * 0.32, 0, 0), 0.014));
    wing.add(box(0.04, 0.06, 0.03, s * 0.32, 0, 0)); // the drive at the wing root
    for (let p = 0; p < 2; p++) {
      const x0 = s * (0.35 + p * 0.33);
      const x1 = x0 + s * 0.25;
      wing.add(box(0.25, 0.26, 0.012, (x0 + x1) / 2, 0, 0));
      // frame edges stand slightly proud
      for (const y of [-0.13, 0.13]) {
        wing.add(box(0.25, 0.012, 0.024, (x0 + x1) / 2, y, 0));
      }
      if (p === 0) {
        wing.add(rod(V3(x1, 0.07, 0), V3(x1 + s * 0.08, 0.07, 0), 0.009));
        wing.add(rod(V3(x1, -0.07, 0), V3(x1 + s * 0.08, -0.07, 0), 0.009));
      }
    }
    sat.add(wing);
  }
  // high-gain dish on a mast, side-on to the wall: a bowl with its feed
  // standing out in front on three struts
  sat.add(rod(V3(0, 0.17, 0), V3(-0.03, 0.34, 0), 0.022));
  const dish = new THREE.Group();
  dish.position.set(-0.04, 0.35, 0);
  // facing up and to the right, across the sun's line, so it's seen side-on
  dish.rotation.z = -0.9;
  dish.add(
    lathe(
      [
        [0, 0],
        [0.08, 0.01],
        [0.15, 0.035],
        [0.2, 0.065],
        [0.215, 0.08],
        [0.205, 0.083],
      ],
      36
    )
  );
  const feed = V3(0, 0.22, 0);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    dish.add(
      rod(V3(Math.cos(a) * 0.19, 0.07, Math.sin(a) * 0.19), feed, 0.008)
    );
  }
  dish.add(rod(feed, feed.clone().add(V3(0, 0.06, 0)), 0.026, 0.016));
  sat.add(dish);
  // whip antenna up the other side
  sat.add(rod(V3(-0.1, 0.17, 0.04), V3(-0.22, 0.6, 0.04), 0.012, 0.008));
  sat.add(ball(0.024, -0.22, 0.61, 0.04));
  g.add(sat);
  return g;
}
