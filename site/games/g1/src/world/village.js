import * as THREE from '../../lib/three.module.js';
import {
  BOARD_POS,
  BRIDGE_POS,
  HOME_CHALET_POS,
  LAKE_POS,
  LAKE_WATER_Y,
  LOOKOUT_POS,
  MAILBOX_POS,
  SIDETRACK_POS,
  VILLAGE_POS,
} from '../core/env.js';
import { rng } from '../core/math.js';
import { distToSeg, heightAt } from './terrain.js';
import { TRACK_DEFS } from './trackData.js';

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

const ALL_RAIL_SPANS = [];
for (const def of Object.values(TRACK_DEFS)) {
  for (let i = 0; i < def.pts.length - 1; i++) {
    ALL_RAIL_SPANS.push([def.pts[i], def.pts[i + 1]]);
  }
}

function minRailDist(x, z) {
  let best = Infinity;
  for (let i = 0; i < ALL_RAIL_SPANS.length; i++) {
    const [a, b] = ALL_RAIL_SPANS[i];
    const d = distToSeg(x, z, a[0], a[2], b[0], b[2]);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Sculpted irregular pine bough tier geometry so pines read as organic conifer layers rather than toy cones.
 */
function makeOrganicBoughGeo(radius, height, radialSegs = 11, seed = 1) {
  const geo = new THREE.ConeGeometry(radius, height, radialSegs, 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.05) {
      const ang = Math.atan2(z, x);
      const notch = 1 + 0.16 * Math.sin(ang * 5 + seed) + 0.09 * Math.cos(ang * 3 - seed * 1.7);
      const droop = -0.11 * (r / radius) * (0.5 + 0.5 * Math.sin(ang * 4 + seed));
      pos.setXYZ(i, x * notch, y + droop, z * notch);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Multi-blade crossed grass tuft geometry (no single flat cones).
 */
function makeGrassTuftGeo() {
  const positions = [];
  const normals = [];
  const blades = [
    { ang: 0.0, tilt: 0.14, h: 0.44, w: 0.055, ox: 0.0, oz: 0.0 },
    { ang: 1.05, tilt: 0.2, h: 0.36, w: 0.048, ox: 0.04, oz: 0.03 },
    { ang: 2.25, tilt: 0.18, h: 0.4, w: 0.05, ox: -0.04, oz: 0.02 },
  ];
  for (const b of blades) {
    const ca = Math.cos(b.ang);
    const sa = Math.sin(b.ang);
    const dx = ca * b.w;
    const dz = sa * b.w;
    const tipX = b.ox + (-sa) * b.tilt;
    const tipZ = b.oz + ca * b.tilt;
    positions.push(
      b.ox - dx, 0, b.oz - dz,
      b.ox + dx, 0, b.oz + dz,
      tipX, b.h, tipZ
    );
    for (let k = 0; k < 3; k++) normals.push(-sa * 0.3, 0.95, ca * 0.3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

/**
 * Builds a realistic 1960s Swiss Alpine Chalet with bumped masonry plinth, lime-plaster base,
 * planked timber upper story, corner beams, shingled/plank overhanging gable roof with eave rafters,
 * cross-mullioned windows, cobalt/mustard shutters, flower boxes, balcony brackets, and stone chimney.
 */
export function buildChalet(mats, {
  w = 5.6,
  d = 4.6,
  hBase = 1.55,
  hUpper = 1.95,
  roofPitch = 1.85,
  hasBalcony = true,
  shutterColor = 'cobalt',
  slateRoof = false,
} = {}) {
  const g = new THREE.Group();

  const stoneBase = new THREE.Mesh(new THREE.BoxGeometry(w, hBase, d), mats.plaster);
  stoneBase.position.y = hBase * 0.5;
  stoneBase.castShadow = true;
  stoneBase.receiveShadow = true;
  g.add(stoneBase);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, 0.95, d + 0.22), mats.stoneMid);
  plinth.position.y = -0.06;
  plinth.receiveShadow = true;
  g.add(plinth);

  const upper = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, hUpper, d + 0.18), mats.timberMid);
  upper.position.y = hBase + hUpper * 0.5;
  upper.castShadow = true;
  upper.receiveShadow = true;
  g.add(upper);

  for (const cx of [-1, 1]) {
    for (const cz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, hUpper + 0.08, 0.18), mats.timberDark);
      post.position.set(cx * (w * 0.5 + 0.05), hBase + hUpper * 0.5, cz * (d * 0.5 + 0.05));
      g.add(post);
    }
  }

  const roofH = hBase + hUpper;
  const halfW = w * 0.5 + 0.78;
  const slopeLen = Math.hypot(halfW, roofPitch);
  const angle = Math.atan2(roofPitch, halfW);
  const roofMat = slateRoof ? mats.slateRoof : mats.timberDark;
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.16, d + 1.48), roofMat);
    slab.position.set(side * halfW * 0.48, roofH + roofPitch * 0.5, 0);
    slab.rotation.z = side * -angle;
    slab.castShadow = true;
    slab.receiveShadow = true;
    g.add(slab);

    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, d + 1.24, 8), mats.timberLight);
    log.rotation.x = Math.PI / 2;
    log.position.set(side * (halfW - 0.18), roofH + 0.12, 0);
    g.add(log);
  }

  // Exposed roof rafter tails along front & back eaves
  for (const rz of [-d * 0.5 - 0.45, d * 0.5 + 0.45]) {
    for (const rx of [-w * 0.34, 0, w * 0.34]) {
      const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.52), mats.timberLight);
      rafter.position.set(rx, roofH + 0.15, rz);
      g.add(rafter);
    }
  }

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, d + 1.52), mats.slateRoof);
  ridge.position.y = roofH + roofPitch + 0.04;
  g.add(ridge);

  const gableGeo = new THREE.ConeGeometry(w * 0.57, roofPitch, 4);
  gableGeo.rotateY(Math.PI / 4);
  const gable = new THREE.Mesh(gableGeo, mats.timberLight);
  gable.scale.set(1.22, 1.0, d / (w * 0.8));
  gable.position.y = roofH + roofPitch * 0.48;
  g.add(gable);

  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 1.6, 0.52), mats.stoneMid);
  chim.position.set(w * 0.22, roofH + roofPitch * 0.85, -d * 0.18);
  chim.castShadow = true;
  g.add(chim);
  const chimCap = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.66), mats.stoneLight);
  chimCap.position.set(w * 0.22, roofH + roofPitch * 0.85 + 0.82, -d * 0.18);
  g.add(chimCap);

  const accentMat = shutterColor === 'mustard' ? mats.mustard : mats.cobalt;
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.48, 0.14), mats.timberDark);
  doorFrame.position.set(0, 0.74, d * 0.5 + 0.02);
  g.add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.36, 0.16), mats.cobalt);
  door.position.set(0, 0.72, d * 0.5 + 0.04);
  g.add(door);
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.16, 0.42), mats.stoneLight);
  step.position.set(0, 0.08, d * 0.5 + 0.22);
  g.add(step);

  for (const wx of [-w * 0.28, w * 0.28]) {
    for (const wy of [hBase * 0.58, hBase + hUpper * 0.52]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.68, 0.09), mats.timberDark);
      frame.position.set(wx, wy, d * 0.5 + 0.07);
      g.add(frame);

      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.54, 0.11), mats.lanternGlow);
      pane.position.set(wx, wy, d * 0.5 + 0.08);
      g.add(pane);

      const mV = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.56, 0.13), mats.timberLight);
      mV.position.set(wx, wy, d * 0.5 + 0.09);
      const mH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.045, 0.13), mats.timberLight);
      mH.position.set(wx, wy, d * 0.5 + 0.09);
      g.add(mV, mH);

      for (const s of [-1, 1]) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.64, 0.07), accentMat);
        sh.position.set(wx + s * 0.48, wy, d * 0.5 + 0.08);
        g.add(sh);
      }
    }

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.18, 0.24), mats.timberDark);
    box.position.set(wx, hBase + 0.46, d * 0.5 + 0.21);
    g.add(box);
    const foliage = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.2), mats.pineMid);
    foliage.position.set(wx, hBase + 0.56, d * 0.5 + 0.21);
    g.add(foliage);
    const flw = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.16), mats.mustard);
    flw.position.set(wx, hBase + 0.63, d * 0.5 + 0.21);
    g.add(flw);
  }

  if (hasBalcony) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.12, 0.88), mats.timberLight);
    deck.position.set(0, hBase + 0.08, d * 0.5 + 0.38);
    g.add(deck);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.1, 0.1), mats.timberDark);
    rail.position.set(0, hBase + 0.62, d * 0.5 + 0.78);
    g.add(rail);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.42, 0.44, 0.07), mats.timberMid);
    panel.position.set(0, hBase + 0.36, d * 0.5 + 0.78);
    g.add(panel);

    for (const bx of [-w * 0.36, 0, w * 0.36]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.62), mats.timberDark);
      brace.position.set(bx, hBase - 0.14, d * 0.5 + 0.28);
      brace.rotation.x = 0.6;
      g.add(brace);
    }
  }

  return g;
}

function buildBarn(mats, w = 4.2, d = 3.6) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.42, d), mats.stoneMid);
  base.position.y = 0.21;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 2.1, d - 0.1), mats.timberMid);
  walls.position.y = 1.45;
  walls.castShadow = true;
  walls.receiveShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 1.45, 4), mats.slateRoof);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.05, 1, d / w);
  roof.position.y = 3.2;
  roof.castShadow = true;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.45, 0.12), mats.timberDark);
  door.position.set(0, 1.12, d * 0.5 - 0.02);
  g.add(base, walls, roof, door);
  return g;
}

function buildWoodRack(mats) {
  const g = new THREE.Group();
  const rackFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.96, 0.58), mats.timberDark);
  rackFrame.position.y = 0.48;
  rackFrame.castShadow = true;
  g.add(rackFrame);
  for (let r = 0; r < 3; r++) {
    for (let c = -0.52; c <= 0.52; c += 0.26) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.64, 7), mats.timberLight);
      log.rotation.x = Math.PI / 2;
      log.position.set(c, 0.22 + r * 0.22, 0);
      g.add(log);
    }
  }
  return g;
}

function buildHaystack(mats, scale = 1) {
  const g = new THREE.Group();
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.78 * scale, 1.05 * scale, 1.15 * scale, 10), mats.mustardSoft);
  mound.position.y = 0.58 * scale;
  mound.castShadow = true;
  mound.receiveShadow = true;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.84 * scale, 0.58 * scale, 10), mats.mustard);
  cap.position.y = 1.44 * scale;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.95 * scale, 6), mats.timberDark);
  pole.position.y = 0.98 * scale;
  g.add(mound, cap, pole);
  return g;
}

function buildFenceRun(mats, pts) {
  const g = new THREE.Group();
  for (let i = 0; i < pts.length; i++) {
    const [fx, fz] = pts[i];
    const fy = heightAt(fx, fz);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.85, 0.11), mats.timberLight);
    post.position.set(fx, fy + 0.42, fz);
    post.castShadow = true;
    g.add(post);
    if (i < pts.length - 1) {
      const [nx, nz] = pts[i + 1];
      const ny = heightAt(nx, nz);
      const len = Math.hypot(nx - fx, nz - fz);
      const ry = -Math.atan2(nz - fz, nx - fx);
      for (const h of [0.34, 0.62]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.06), mats.timberLight);
        rail.position.set((fx + nx) * 0.5, (fy + ny) * 0.5 + h, (fz + nz) * 0.5);
        rail.rotation.y = ry;
        g.add(rail);
      }
    }
  }
  return g;
}

/**
 * Dense Home Garden, Alpine Village, Stone Arch Bridge, Village Church,
 * Trackside & Climbing-Slope Chalets/Barns/Fences/Haystacks/Rock Outcrops,
 * and Non-Uniform Organic Pines, Autumn Larches, Grass Tufts & Wildflower Clusters.
 */
export class VillageWorld {
  constructor(mats, { low = false } = {}) {
    this.group = new THREE.Group();
    this.mats = mats;
    this.interactables = [];
    this.laundryItems = [];

    this._buildHomeGarden();
    this._buildVillageAndBridge();
    this._buildTracksideLife();
    this._buildForestsAndMeadow(low);
  }

  _placeAtGround(obj, x, z, yOff = 0) {
    obj.position.set(x, heightAt(x, z) + yOff, z);
    this.group.add(obj);
    return obj;
  }

  _buildHomeGarden() {
    const m = this.mats;

    // 1. Protagonist Girl's Timber Chalet
    const home = buildChalet(m, { w: 6.2, d: 5.0, hBase: 1.65, hUpper: 2.0, roofPitch: 1.9, hasBalcony: true });
    home.rotation.y = 0.65;
    this._placeAtGround(home, HOME_CHALET_POS.x, HOME_CHALET_POS.z);

    // 2. Neighboring varied chalets & barn (clear of home camera sightline)
    const neighbors = [
      { x: -16.5, z: -17, ry: 0.25, w: 5.2, d: 4.2, pitch: 1.6, sh: 'mustard', bal: true, slate: true },
      { x: -19, z: 14, ry: 1.15, w: 4.8, d: 4.0, pitch: 1.5, sh: 'cobalt', bal: false, slate: false },
      { x: 17.5, z: 10.5, ry: -0.95, w: 5.4, d: 4.4, pitch: 1.75, sh: 'cobalt', bal: true, slate: true },
    ];
    for (const n of neighbors) {
      const ch = buildChalet(m, { w: n.w, d: n.d, roofPitch: n.pitch, shutterColor: n.sh, hasBalcony: n.bal, slateRoof: n.slate });
      ch.rotation.y = n.ry;
      this._placeAtGround(ch, n.x, n.z);
    }

    const shed = buildBarn(m, 3.6, 3.0);
    shed.rotation.y = 0.4;
    this._placeAtGround(shed, -14.5, -6.5);

    // 3. Wordless Mustard-Yellow Mailbox (no text/numbers)
    const mb = new THREE.Group();
    const mbPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.05, 8), m.timberDark);
    mbPost.position.y = 0.52;
    mbPost.castShadow = true;
    const mbBox = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.3), m.mustard);
    mbBox.position.y = 1.12;
    mbBox.castShadow = true;
    const mbRoof = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.16, 4), m.cobalt);
    mbRoof.rotation.y = Math.PI / 4;
    mbRoof.position.y = 1.34;
    mb.add(mbPost, mbBox, mbRoof);
    this._placeAtGround(mb, MAILBOX_POS.x, MAILBOX_POS.z);

    // 4. Stone Stepping Path from garden toward Boarding Halt
    for (let i = 0; i < 11; i++) {
      const t = i / 10;
      const sx = -4.2 + t * 5.8 + Math.sin(t * 3) * 0.4;
      const sz = 3.8 - t * 10.6;
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 7), m.stoneLight);
      stone.rotation.y = i * 0.9;
      stone.receiveShadow = true;
      this._placeAtGround(stone, sx, sz, 0.03);
    }

    // 5. Timber Garden Fence with open gate toward the station
    this.group.add(buildFenceRun(m, [[-8, -3.5], [-6, -3.5], [-4, -3.5]]));
    this.group.add(buildFenceRun(m, [[2.5, -3.5], [4.5, -3.5], [6.5, -3.5], [8.5, -3.5], [10.5, -2.5]]));

    // 6. Vegetable Patch
    const vegPatch = new THREE.Group();
    const soil = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 2.2), new THREE.MeshStandardMaterial({ color: '#5b4432', roughness: 0.95 }));
    soil.receiveShadow = true;
    vegPatch.add(soil);
    const leafMat = new THREE.MeshStandardMaterial({ color: '#4c7b48', roughness: 0.82 });
    const vRand = rng(88);
    for (let i = 0; i < 14; i++) {
      const cab = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + vRand() * 0.06, 1), leafMat);
      cab.scale.y = 0.72;
      cab.position.set((vRand() - 0.5) * 2.6, 0.16, (vRand() - 0.5) * 1.5);
      vegPatch.add(cab);
    }
    this._placeAtGround(vegPatch, -6.5, -0.8);

    // 7. Garden Flower Beds (varied mustard marigolds & cobalt gentians)
    const flowerPositions = [
      [-7.2, 2.5], [-6.8, 3.8], [-1.2, 4.0], [1.4, -2.2], [-3.8, -2.5], [5.8, -1.8],
    ];
    for (let i = 0; i < flowerPositions.length; i++) {
      const [fx, fz] = flowerPositions[i];
      const cluster = new THREE.Group();
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 1), m.pineMid);
      bush.scale.set(1.2, 0.65, 1.1);
      bush.position.y = 0.18;
      cluster.add(bush);
      for (let b = 0; b < 6; b++) {
        const ang = b * 1.12 + i * 0.7;
        const rad = 0.12 + (b % 3) * 0.08;
        const bl = new THREE.Mesh(
          new THREE.SphereGeometry(0.065 + (b % 2) * 0.025, 6, 6),
          (b + i) % 2 === 0 ? m.mustard : m.cobaltLight
        );
        bl.position.set(Math.cos(ang) * rad, 0.28 + (b % 3) * 0.05, Math.sin(ang) * rad);
        cluster.add(bl);
      }
      this._placeAtGround(cluster, fx, fz);
    }

    // 8. Stacked Firewood Rack + Wooden Bench + Stone Water Pump Well
    this._placeAtGround(buildWoodRack(m), -8.2, 1.5);

    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 0.48), m.timberLight);
    seat.position.y = 0.44;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.36, 0.07), m.timberLight);
    back.position.set(0, 0.72, -0.2);
    bench.add(seat, back);
    for (const bx of [-0.58, 0.58]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.44, 0.42), m.timberDark);
      leg.position.set(bx, 0.22, 0);
      bench.add(leg);
    }
    bench.rotation.y = -0.45;
    this._placeAtGround(bench, 3.2, 2.2);

    const well = new THREE.Group();
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.58, 12), m.stoneMid);
    basin.position.y = 0.29;
    basin.castShadow = true;
    const pumpPost = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.05, 8), m.ironDark);
    pumpPost.position.set(0.32, 0.52, 0);
    const spout = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), m.ironDark);
    spout.position.set(0.18, 0.85, 0);
    well.add(basin, pumpPost, spout);
    this._placeAtGround(well, 0.6, 5.2);

    // 9. Patterned Laundry on Clothesline (NO text)
    const lPost1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 8), m.timberDark);
    const lPost2 = lPost1.clone();
    this._placeAtGround(lPost1, -11.5, -1.8, 0.95);
    this._placeAtGround(lPost2, -7.8, -3.2, 0.95);
    const lineLen = Math.hypot(3.7, 1.4);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, lineLen, 6), m.plaster);
    line.rotation.z = Math.PI / 2;
    line.rotation.y = Math.atan2(1.4, 3.7);
    this._placeAtGround(line, -9.65, -2.5, 1.78);

    const clothColors = [m.plaster, m.cobaltLight, m.mustardSoft];
    for (let i = 0; i < 3; i++) {
      const f = 0.25 + i * 0.25;
      const cx = -11.5 + 3.7 * f;
      const cz = -1.8 - 1.4 * f;
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.03), clothColors[i]);
      cloth.position.set(cx, heightAt(cx, cz) + 1.48, cz);
      cloth.rotation.y = -0.35;
      this.group.add(cloth);
      this.laundryItems.push({ mesh: cloth, phase: i * 1.4 });
    }
  }

  _buildVillageAndBridge() {
    const m = this.mats;

    // 1. Alpine Village Station Platform, Bench, Lantern & Chalets (bridge masonry comes from TrackNetwork spline)
    const plat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.42, 10.0), m.timberMid);
    plat.position.set(VILLAGE_POS.x - 2.3, VILLAGE_POS.y + 0.1, VILLAGE_POS.z);
    plat.rotation.y = 0.22;
    plat.receiveShadow = true;
    this.group.add(plat);

    const shelter = new THREE.Group();
    const shWall = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.25, 4.8), m.timberLight);
    shWall.position.y = 1.12;
    shWall.castShadow = true;
    const shRoof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 5.6), m.slateRoof);
    shRoof.position.y = 2.38;
    shRoof.rotation.z = -0.15;
    const shLamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), m.lanternGlow);
    shLamp.position.set(1.15, 2.0, 1.8);
    const vBench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 1.8), m.timberDark);
    vBench.position.set(1.22, 0.55, 0);
    shelter.add(shWall, shRoof, shLamp, vBench);
    // Put shelter on the east/right side of the village track so the camera on the west side NEVER hits its roof!
    shelter.position.set(VILLAGE_POS.x + 3.4, VILLAGE_POS.y + 0.3, VILLAGE_POS.z);
    shelter.rotation.y = -Math.PI + 0.22;
    this.group.add(shelter);

    // Village chalets clustered along the valley keeping >= 15m clear of the west camera sweep
    const vChalets = [
      { x: 43, z: -52, ry: -1.2, w: 5.8, d: 4.8, sh: 'cobalt', slate: true },
      { x: 46, z: -66, ry: -1.7, w: 5.0, d: 4.2, sh: 'mustard', slate: false },
      { x: 11, z: -54, ry: 0.9, w: 5.4, d: 4.4, sh: 'cobalt', slate: true },
      { x: 9, z: -69, ry: 0.5, w: 4.8, d: 4.0, sh: 'mustard', slate: false },
      { x: 42, z: -84, ry: -2.1, w: 5.2, d: 4.2, sh: 'cobalt', slate: true },
    ];
    for (const vc of vChalets) {
      const ch = buildChalet(m, { w: vc.w, d: vc.d, shutterColor: vc.sh, slateRoof: vc.slate });
      ch.rotation.y = vc.ry;
      this._placeAtGround(ch, vc.x, vc.z);
    }

    // 3. Modest Alpine Village Church
    const church = new THREE.Group();
    const nave = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.6, 8.2), m.plaster);
    nave.position.y = 1.8;
    nave.castShadow = true;
    nave.receiveShadow = true;
    church.add(nave);

    const naveRoof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.5, 4), m.slateRoof);
    naveRoof.rotation.y = Math.PI / 4;
    naveRoof.scale.set(0.92, 1, 1.48);
    naveRoof.position.y = 4.8;
    church.add(naveRoof);

    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6.8, 2.2), m.plaster);
    tower.position.set(0, 3.4, 3.8);
    tower.castShadow = true;
    church.add(tower);

    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.75, 4.6, 4), m.slateRoof);
    spire.rotation.y = Math.PI / 4;
    spire.position.set(0, 9.1, 3.8);
    spire.castShadow = true;
    church.add(spire);

    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.08), m.brass);
    crossV.position.set(0, 11.65, 3.8);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.08), m.brass);
    crossH.position.set(0, 11.78, 3.8);
    church.add(crossV, crossH);

    church.rotation.y = -0.35;
    this._placeAtGround(church, 46, -80);
  }

  _buildTracksideLife() {
    const m = this.mats;

    // Populate both valley sides AND the climbing mountain slopes densely with chalets, barns & fences!
    const roadsideChalets = [
      // Home -> bridge (seg0) - kept well outside camera sweep & off steep river bank!
      { x: 6, z: -26, ry: 0.45, w: 4.8, d: 4.0, sh: 'mustard', bal: true, slate: true },
      { x: 54, z: -20, ry: -1.1, w: 5.2, d: 4.2, sh: 'cobalt', bal: true, slate: false },
      // Mainline & sidetrack approach (seg1)
      { x: 1, z: -96, ry: 0.7, w: 5.0, d: 4.2, sh: 'cobalt', bal: true, slate: true },
      { x: 57, z: -98, ry: -1.5, w: 5.2, d: 4.2, sh: 'mustard', bal: true, slate: false },
      { x: -24, z: -138, ry: 0.85, w: 5.0, d: 4.0, sh: 'mustard', bal: false, slate: true },
      { x: 35, z: -160, ry: -1.2, w: 4.8, d: 3.8, sh: 'cobalt', bal: true, slate: false },
      // Lake approach & return loop (seg2)
      { x: -16, z: -195, ry: -0.9, w: 4.8, d: 4.0, sh: 'mustard', bal: true, slate: true },
      { x: 24, z: -128, ry: 0.35, w: 5.0, d: 4.2, sh: 'cobalt', bal: false, slate: false },
      // Dense climbing slopes (seg3_climb, seg4_main, seg4_lookout) - terraced alpine farms!
      { x: -16, z: -226, ry: 0.4, w: 4.8, d: 4.0, sh: 'mustard', bal: true, slate: true },
      { x: -3, z: -252, ry: 0.5, w: 5.0, d: 4.0, sh: 'cobalt', bal: true, slate: false },
      { x: 16, z: -266, ry: 0.85, w: 4.6, d: 3.8, sh: 'mustard', bal: false, slate: true },
      { x: 42, z: -265, ry: -0.8, w: 5.0, d: 4.0, sh: 'mustard', bal: true, slate: true },
      { x: 64, z: -266, ry: -1.2, w: 4.8, d: 4.0, sh: 'cobalt', bal: true, slate: false },
      { x: 29, z: -292, ry: 0.65, w: 5.0, d: 4.0, sh: 'cobalt', bal: true, slate: true },
      { x: 62, z: -302, ry: -0.9, w: 4.6, d: 3.8, sh: 'mustard', bal: true, slate: false },
      { x: 24, z: -322, ry: 0.55, w: 4.8, d: 4.0, sh: 'mustard', bal: true, slate: true },
    ];
    for (const c of roadsideChalets) {
      const ch = buildChalet(m, { w: c.w, d: c.d, shutterColor: c.sh, hasBalcony: c.bal, slateRoof: c.slate });
      ch.rotation.y = c.ry;
      this._placeAtGround(ch, c.x, c.z);
    }

    // Timber barns & firewood racks across valley and climbing slopes
    const barns = [
      [8, -38, 0.2], [54, -48, -0.9], [16, -96, 0.6], [62, -130, -0.5],
      [-10, -152, 0.3], [-12, -178, -0.7], [15, -230, 0.8], [-4, -242, 0.45],
      [33, -246, -0.6], [68, -280, -0.4], [34, -306, 0.35], [70, -320, -0.8],
    ];
    for (const [bx, bz, ry] of barns) {
      const barn = buildBarn(m, 3.8, 3.2);
      barn.rotation.y = ry;
      this._placeAtGround(barn, bx, bz);

      const wr = buildWoodRack(m);
      wr.rotation.y = ry;
      this._placeAtGround(wr, bx + 2.8, bz + 1.4);
    }

    // Haystacks across valley & climbing slopes
    const haySpots = [
      [12, -32, 1.0], [16, -37, 0.85], [50, -39, 1.1], [2, -78, 0.95],
      [6, -84, 1.05], [32, -110, 0.9], [-18, -120, 1.0], [-22, -126, 0.85],
      [22, -158, 1.1], [-18, -206, 0.9], [16, -246, 0.95], [-10, -232, 0.9],
      [22, -260, 1.0], [38, -284, 0.95], [56, -296, 0.9], [28, -314, 1.0],
    ];
    for (const [hx, hz, hs] of haySpots) {
      this._placeAtGround(buildHaystack(m, hs), hx, hz);
    }

    // Timber paddock fences across valley and climbing slopes
    this.group.add(buildFenceRun(m, [[8, -21], [13, -22], [18, -24], [22, -27]]));
    this.group.add(buildFenceRun(m, [[16, -48], [18, -55], [18, -62], [16, -68]]));
    this.group.add(buildFenceRun(m, [[34, -84], [39, -91], [43, -98]]));
    this.group.add(buildFenceRun(m, [[-23, -172], [-27, -180], [-29, -188]]));
    this.group.add(buildFenceRun(m, [[38, -118], [40, -125], [38, -132]]));
    // Climbing slope terraced fences
    this.group.add(buildFenceRun(m, [[-14, -222], [-8, -225], [-2, -229], [4, -233]]));
    this.group.add(buildFenceRun(m, [[10, -248], [16, -251], [22, -254], [28, -258]]));
    this.group.add(buildFenceRun(m, [[36, -274], [42, -279], [46, -285]]));
    this.group.add(buildFenceRun(m, [[58, -292], [64, -296], [70, -301]]));
    this.group.add(buildFenceRun(m, [[32, -316], [36, -322], [38, -328]]));

    // Timber-and-Stone Footbridge over the Mountain Brook
    const footbridge = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 7.2), m.timberMid);
    deck.position.y = 0.72;
    deck.castShadow = true;
    footbridge.add(deck);
    for (const side of [-0.96, 0.96]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.56, 7.2), m.timberLight);
      rail.position.set(side, 1.08, 0);
      footbridge.add(rail);
    }
    for (const endZ of [-3.2, 3.2]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.9), m.stoneMid);
      pier.position.set(0, 0.1, endZ);
      footbridge.add(pier);
    }
    footbridge.position.set(57, LAKE_WATER_Y + 0.1, -106);
    footbridge.rotation.y = 0.18;
    this.group.add(footbridge);
  }

  _buildForestsAndMeadow(low) {
    const m = this.mats;
    const rand = rng(404);
    const treeCount = low ? 260 : 620;

    // Organic sculpted 4-tier Alpine Pines & Autumn Larches with per-instance color variation
    const trunkGeo = new THREE.CylinderGeometry(0.13, 0.25, 2.3, 7);
    const cone1Geo = makeOrganicBoughGeo(1.66, 2.85, 11, 1.1);
    const cone2Geo = makeOrganicBoughGeo(1.32, 2.55, 10, 2.7);
    const cone3Geo = makeOrganicBoughGeo(0.96, 2.2, 9, 4.3);
    const cone4Geo = makeOrganicBoughGeo(0.62, 1.75, 8, 5.9);

    const pineMat1 = m.pineDeep.clone();
    pineMat1.color = new THREE.Color('#ffffff');
    const pineMat2 = m.pineMid.clone();
    pineMat2.color = new THREE.Color('#ffffff');

    const trunks = new THREE.InstancedMesh(trunkGeo, m.timberDark, treeCount);
    const crowns1 = new THREE.InstancedMesh(cone1Geo, pineMat1, treeCount);
    const crowns2 = new THREE.InstancedMesh(cone2Geo, pineMat2, treeCount);
    const crowns3 = new THREE.InstancedMesh(cone3Geo, pineMat1, treeCount);
    const crowns4 = new THREE.InstancedMesh(cone4Geo, m.larchGold, Math.floor(treeCount * 0.4));
    crowns1.castShadow = !low;
    crowns2.castShadow = !low;

    let placed = 0;
    let larchPlaced = 0;
    let tries = 0;
    while (placed < treeCount && tries < treeCount * 10) {
      tries++;
      // Bias extra trees onto the climbing slopes (-210..-360) so slopes are lushly wooded!
      const inClimbZone = tries % 3 === 0;
      const x = inClimbZone ? (rand() - 0.35) * 180 : (rand() - 0.5) * 320 + 10;
      const z = inClimbZone ? -205 - rand() * 165 : 35 - rand() * 440;

      // Clear immediate home garden AND home camera sightline wedge so girl & puppy are 100% unobstructed!
      if (Math.hypot(x + 2, z) < 15.5) continue;
      if (z > -2 && z < 24 && Math.abs(x - 0.5) < 11.5) continue;
      if (Math.hypot(x - BOARD_POS.x, z - BOARD_POS.z) < 10.5) continue;
      if (Math.hypot(x - VILLAGE_POS.x, z - VILLAGE_POS.z) < 14) continue;
      if (Math.hypot(x - SIDETRACK_POS.x, z - SIDETRACK_POS.z) < 9.0) continue;
      if (Math.hypot(x - LAKE_POS.x, z - LAKE_POS.z) < 10.5) continue;
      if (Math.hypot(x - LOOKOUT_POS.x, z - LOOKOUT_POS.z) < 9.0) continue;
      if (Math.hypot(x - 18, z + 395) < 25) continue;
      if (z < -10 && z > -75 && Math.abs(x - 12) < 14) continue;
      if (minRailDist(x, z) < 4.5) continue;

      const y = heightAt(x, z);
      if (y < LAKE_WATER_Y + 0.45 || y > 52) continue;

      const sc = 0.72 + rand() * 0.92;
      _q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.05, rand() * Math.PI * 2, (rand() - 0.5) * 0.05));

      _p.set(x, y + 1.05 * sc, z);
      _s.set(sc * (0.9 + rand() * 0.2), sc, sc * (0.9 + rand() * 0.2));
      _m.compose(_p, _q, _s);
      trunks.setMatrixAt(placed, _m);

      _p.set(x, y + 2.52 * sc, z);
      _m.compose(_p, _q, _s);
      crowns1.setMatrixAt(placed, _m);

      _p.set(x, y + 3.8 * sc, z);
      _m.compose(_p, _q, _s);
      crowns2.setMatrixAt(placed, _m);

      _p.set(x, y + 5.0 * sc, z);
      _m.compose(_p, _q, _s);
      crowns3.setMatrixAt(placed, _m);

      // Natural conifer hue variation (deep spruce, pine green, olive-larch)
      const isAutumn = rand() < 0.24;
      if (isAutumn) {
        _c.set('#6d8544').offsetHSL((rand() - 0.5) * 0.04, 0.04, (rand() - 0.5) * 0.08);
      } else {
        _c.set('#264c36').offsetHSL((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.08);
      }
      crowns1.setColorAt(placed, _c);
      crowns3.setColorAt(placed, _c);

      _c.offsetHSL(0.01, 0.02, 0.05);
      crowns2.setColorAt(placed, _c);

      if (placed % 3 === 0 && larchPlaced < crowns4.count) {
        _p.set(x, y + 5.95 * sc, z);
        _m.compose(_p, _q, _s);
        crowns4.setMatrixAt(larchPlaced++, _m);
      }
      placed++;
    }
    trunks.count = crowns1.count = crowns2.count = crowns3.count = placed;
    crowns4.count = larchPlaced;
    trunks.instanceMatrix.needsUpdate = true;
    crowns1.instanceMatrix.needsUpdate = true;
    crowns2.instanceMatrix.needsUpdate = true;
    crowns3.instanceMatrix.needsUpdate = true;
    crowns4.instanceMatrix.needsUpdate = true;
    if (crowns1.instanceColor) crowns1.instanceColor.needsUpdate = true;
    if (crowns2.instanceColor) crowns2.instanceColor.needsUpdate = true;
    if (crowns3.instanceColor) crowns3.instanceColor.needsUpdate = true;
    this.group.add(trunks, crowns1, crowns2, crowns3, crowns4);

    // Broadleaf Golden-Autumn Birch / Rowan Trees (organic multi-lobe crowns along valley & climbing slopes)
    const broadCount = low ? 55 : 130;
    const bTrunkGeo = new THREE.CylinderGeometry(0.11, 0.18, 2.4, 7);
    const bLobeGeo = new THREE.IcosahedronGeometry(1.05, 1);
    const bTrunkMat = new THREE.MeshStandardMaterial({ color: '#c8c0b4', roughness: 0.88 });
    const bCrownMat = new THREE.MeshStandardMaterial({ bumpMap: m.pineMid.bumpMap, bumpScale: 0.04, color: '#ffffff', roughness: 0.84 });

    const bTrunks = new THREE.InstancedMesh(bTrunkGeo, bTrunkMat, broadCount);
    const bCrowns = new THREE.InstancedMesh(bLobeGeo, bCrownMat, broadCount * 3);
    bCrowns.castShadow = !low;

    let bPlaced = 0;
    let bTries = 0;
    while (bPlaced < broadCount && bTries < broadCount * 10) {
      bTries++;
      const x = (rand() - 0.5) * 240 + 14;
      const z = 25 - rand() * 365;
      if (Math.hypot(x + 2, z) < 16) continue;
      if (z > -2 && z < 24 && Math.abs(x - 0.5) < 12) continue;
      if (minRailDist(x, z) < 5.0) continue;
      const y = heightAt(x, z);
      if (y < LAKE_WATER_Y + 0.5 || y > 40) continue;

      const sc = 0.78 + rand() * 0.65;
      _q.setFromAxisAngle(_up, rand() * Math.PI * 2);
      _p.set(x, y + 1.15 * sc, z);
      _s.setScalar(sc);
      _m.compose(_p, _q, _s);
      bTrunks.setMatrixAt(bPlaced, _m);

      const baseHue = rand() < 0.55 ? '#8f9b4a' : '#587c4a';
      for (let lobe = 0; lobe < 3; lobe++) {
        const ang = lobe * 2.1 + rand() * 0.5;
        const rad = lobe === 0 ? 0.15 : 0.62 * sc;
        _p.set(x + Math.cos(ang) * rad, y + (2.45 + (lobe === 0 ? 0.45 : 0)) * sc, z + Math.sin(ang) * rad);
        _s.set((0.85 + rand() * 0.35) * sc, (0.72 + rand() * 0.25) * sc, (0.85 + rand() * 0.35) * sc);
        _m.compose(_p, _q, _s);
        const idx = bPlaced * 3 + lobe;
        bCrowns.setMatrixAt(idx, _m);
        _c.set(baseHue).offsetHSL((rand() - 0.5) * 0.04, 0, (rand() - 0.5) * 0.1);
        bCrowns.setColorAt(idx, _c);
      }
      bPlaced++;
    }
    bTrunks.count = bPlaced;
    bCrowns.count = bPlaced * 3;
    bTrunks.instanceMatrix.needsUpdate = true;
    bCrowns.instanceMatrix.needsUpdate = true;
    if (bCrowns.instanceColor) bCrowns.instanceColor.needsUpdate = true;
    this.group.add(bTrunks, bCrowns);

    // Multi-blade Grass Tufts & Organic Wildflower Clusters (never uniform grids!)
    const tuftCount = low ? 850 : 2800;
    const bladeGeo = makeGrassTuftGeo();
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.88, side: THREE.DoubleSide });
    const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, tuftCount);

    const flowerCount = low ? 260 : 820;
    const flwGeo = new THREE.DodecahedronGeometry(0.14, 0);
    const flwGoldMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.68 });
    const flwBlueMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.64 });
    const flwGold = new THREE.InstancedMesh(flwGeo, flwGoldMat, flowerCount);
    const flwBlue = new THREE.InstancedMesh(flwGeo, flwBlueMat, flowerCount);

    const anchors = [
      { cx: -2, cz: 0, r: 28 },
      { cx: VILLAGE_POS.x, cz: VILLAGE_POS.z, r: 36 },
      { cx: SIDETRACK_POS.x, cz: SIDETRACK_POS.z, r: 36 },
      { cx: LAKE_POS.x, cz: LAKE_POS.z, r: 34 },
      { cx: 14, cz: -135, r: 44 },
      { cx: -8, cz: -230, r: 36 },           // Climb start slope
      { cx: 24, cz: -255, r: 46 },           // Mid climb slope
      { cx: 56, cz: -282, r: 44 },           // Switch 3 & Lookout slope
      { cx: 42, cz: -318, r: 40 },           // Gallery & pre-viaduct slope
      { cx: 18, cz: -355, r: 42 },           // Post-float valley
    ];

    let bIdx = 0;
    let fgIdx = 0;
    let fbIdx = 0;
    let gTries = 0;
    while (bIdx < tuftCount && gTries < tuftCount * 6) {
      gTries++;
      const a = anchors[gTries % anchors.length];
      const ang = rand() * Math.PI * 2;
      const dist = 1.6 + Math.sqrt(rand()) * a.r;
      const gx = a.cx + Math.cos(ang) * dist;
      const gz = a.cz + Math.sin(ang) * dist;
      if (minRailDist(gx, gz) < 1.8) continue;
      const gy = heightAt(gx, gz);
      if (gy < LAKE_WATER_Y + 0.35 || gy > 44) continue;

      _q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.25, rand() * Math.PI * 2, (rand() - 0.5) * 0.25));
      const hScale = 0.65 + rand() * 1.1;
      const wScale = 0.8 + rand() * 0.8;
      _p.set(gx, gy, gz);
      _s.set(wScale, hScale, wScale);
      _m.compose(_p, _q, _s);
      blades.setMatrixAt(bIdx, _m);
      _c.set('#6b8a4b').offsetHSL((rand() - 0.5) * 0.05, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.12);
      blades.setColorAt(bIdx, _c);
      bIdx++;

      // Organic scattered wildflower patches (varied cluster offsets, sizes & hues)
      if (bIdx % 3 === 0 && (fgIdx < flowerCount || fbIdx < flowerCount)) {
        const fScale = 0.55 + rand() * 0.95;
        _p.set(gx + (rand() - 0.5) * 0.6, gy + 0.11 * fScale, gz + (rand() - 0.5) * 0.6);
        _s.set(fScale, 0.5 * fScale, fScale);
        _m.compose(_p, _q, _s);
        if ((fgIdx + fbIdx) % 2 === 0 && fgIdx < flowerCount) {
          flwGold.setMatrixAt(fgIdx, _m);
          _c.set('#e5bc4f').offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.1);
          flwGold.setColorAt(fgIdx, _c);
          fgIdx++;
        } else if (fbIdx < flowerCount) {
          flwBlue.setMatrixAt(fbIdx, _m);
          _c.set('#3d75c2').offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.1);
          flwBlue.setColorAt(fbIdx, _c);
          fbIdx++;
        }
      }
    }
    blades.count = bIdx;
    flwGold.count = fgIdx;
    flwBlue.count = fbIdx;
    blades.instanceMatrix.needsUpdate = true;
    flwGold.instanceMatrix.needsUpdate = true;
    flwBlue.instanceMatrix.needsUpdate = true;
    if (blades.instanceColor) blades.instanceColor.needsUpdate = true;
    if (flwGold.instanceColor) flwGold.instanceColor.needsUpdate = true;
    if (flwBlue.instanceColor) flwBlue.instanceColor.needsUpdate = true;
    this.group.add(blades, flwGold, flwBlue);

    // Alpine Granite Boulders & Outcrops scattered along climbing slopes & riverbanks
    const rockCount = low ? 75 : 170;
    const rockGeo = new THREE.DodecahedronGeometry(0.9, 1);
    const rocks = new THREE.InstancedMesh(rockGeo, m.stoneMid, rockCount);
    rocks.receiveShadow = true;
    rocks.castShadow = !low;
    let rPlaced = 0;
    let rTries = 0;
    while (rPlaced < rockCount && rTries < rockCount * 8) {
      rTries++;
      const inClimb = rTries % 2 === 0;
      const rx = inClimb ? (rand() - 0.35) * 140 : (rand() - 0.5) * 260;
      const rz = inClimb ? -205 - rand() * 155 : 20 - rand() * 420;
      if (Math.hypot(rx, rz) < 22 || Math.hypot(rx - 18, rz + 395) < 26) continue;
      if (minRailDist(rx, rz) < 3.6) continue;
      const ry = heightAt(rx, rz);
      _p.set(rx, ry + 0.12, rz);
      _q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
      _s.set(0.55 + rand() * 1.4, 0.38 + rand() * 0.85, 0.55 + rand() * 1.4);
      _m.compose(_p, _q, _s);
      rocks.setMatrixAt(rPlaced++, _m);
    }
    rocks.count = rPlaced;
    rocks.instanceMatrix.needsUpdate = true;
    this.group.add(rocks);
  }

  update(time) {
    for (const item of this.laundryItems) {
      item.mesh.rotation.x = Math.sin(time * 2.4 + item.phase) * 0.16;
    }
  }
}
