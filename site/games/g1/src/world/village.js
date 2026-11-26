import * as THREE from '../../lib/three.module.js';
import {
  BOARD_POS,
  HOME_CHALET_POS,
  LAKE_POS,
  LAKE_WATER_Y,
  LOOKOUT_POS,
  MAILBOX_POS,
  SIDETRACK_POS,
  VILLAGE_POS,
} from '../core/env.js';
import { rng } from '../core/math.js';
import {
  BARN_SITES,
  CHALET_SITES,
  CHURCH_SITE,
  FENCE_RUNS,
  HAY_SITES,
  LANDMARK_CLEARANCE,
  SHED_SITE,
  minTrackSplineDist,
} from './layout.js';
import { heightAt } from './terrain.js';

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

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
 * Builds a 1960s Swiss Alpine Chalet with stone plinth flush at y = 0 (never buried underground).
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

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, 0.42, d + 0.22), mats.stoneMid);
  plinth.position.y = 0.21;
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

/**
 * Builds slope-conforming fence spans as individual tight objects and registers each span in physics.
 */
function addFenceRun(parent, mats, pts, physics) {
  for (let i = 0; i < pts.length; i++) {
    const [fx, fz] = pts[i];
    const fy = heightAt(fx, fz);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.85, 0.11), mats.timberLight);
    post.position.set(fx, fy + 0.425, fz);
    post.castShadow = true;
    parent.add(post);

    if (i < pts.length - 1) {
      const [nx, nz] = pts[i + 1];
      const ny = heightAt(nx, nz);
      const horizLen = Math.hypot(nx - fx, nz - fz);
      const fullLen = Math.hypot(horizLen, ny - fy);
      const yaw = Math.atan2(nx - fx, nz - fz);
      const pitch = -Math.atan2(ny - fy, Math.max(0.01, horizLen));

      const span = new THREE.Group();
      span.position.set((fx + nx) * 0.5, (fy + ny) * 0.5, (fz + nz) * 0.5);
      span.rotation.set(pitch, yaw, 0, 'YXZ');
      for (const h of [0.34, 0.62]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, fullLen), mats.timberLight);
        rail.position.y = h;
        span.add(rail);
      }
      parent.add(span);

      if (physics) {
        physics.addSegmentCollider(fx, fz, nx, nz, 0.14, Math.min(fy, ny), Math.max(fy, ny) + 0.92, 'fence');
      }
    }
  }
}

export class VillageWorld {
  constructor(mats, { low = false, physics = null } = {}) {
    this.group = new THREE.Group();
    this.mats = mats;
    this.physics = physics;
    this.interactables = [];
    this.laundryItems = [];

    this._buildHomeGarden();
    this._buildVillageAndBridge();
    this._buildTracksideLife();
    this._buildForestsAndMeadow(low);
  }

  _placeAtGround(obj, x, z, yOff = 0) {
    const gy = heightAt(x, z);
    obj.position.set(x, gy + yOff, z);
    this.group.add(obj);
    return gy;
  }

  _buildHomeGarden() {
    const m = this.mats;

    // 1. Chalet Sites (Home + Neighbors + Village + Trackside + Climbing Slopes)
    for (const c of CHALET_SITES) {
      const ch = buildChalet(m, {
        w: c.w,
        d: c.d,
        hBase: c.hBase || 1.55,
        hUpper: c.hUpper || 1.95,
        roofPitch: c.pitch || 1.75,
        hasBalcony: c.bal,
        shutterColor: c.sh,
        slateRoof: c.slate,
      });
      ch.rotation.y = c.ry;
      const gy = this._placeAtGround(ch, c.x, c.z);
      if (this.physics) {
        this.physics.addOBB(c.x, c.z, c.ry, c.w + 0.4, c.d + (c.bal ? 1.1 : 0.4), gy, gy + 5.8, 'chalet');
      }
    }

    // 2. Home Shed (well clear of seg0 track at z = -9)
    const shed = buildBarn(m, SHED_SITE.w, SHED_SITE.d);
    shed.rotation.y = SHED_SITE.ry;
    const shedY = this._placeAtGround(shed, SHED_SITE.x, SHED_SITE.z);
    if (this.physics) {
      this.physics.addOBB(SHED_SITE.x, SHED_SITE.z, SHED_SITE.ry, SHED_SITE.w + 0.2, SHED_SITE.d + 0.2, shedY, shedY + 3.8, 'barn');
    }

    // 3. Wordless Mustard-Yellow Mailbox
    const mb = new THREE.Group();
    const mbPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.05, 8), m.timberDark);
    mbPost.position.y = 0.525;
    mbPost.castShadow = true;
    const mbBox = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.3), m.mustard);
    mbBox.position.y = 1.12;
    mbBox.castShadow = true;
    const mbRoof = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.16, 4), m.cobalt);
    mbRoof.rotation.y = Math.PI / 4;
    mbRoof.position.y = 1.34;
    mb.add(mbPost, mbBox, mbRoof);
    const mbY = this._placeAtGround(mb, MAILBOX_POS.x, MAILBOX_POS.z);
    if (this.physics) {
      this.physics.addCylinder(MAILBOX_POS.x, MAILBOX_POS.z, 0.32, mbY, mbY + 1.45, 'prop');
    }

    // 4. Stone Stepping Path from garden toward Boarding Halt (walkable floor flush at ground)
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      const sx = -3.2 + t * 5.2 + Math.sin(t * 3) * 0.3;
      const sz = 2.6 - t * 8.0;
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 7), m.stoneLight);
      stone.rotation.y = i * 0.9;
      stone.receiveShadow = true;
      this._placeAtGround(stone, sx, sz, 0.03);
    }

    // 5. Vegetable Patch
    const vegPatch = new THREE.Group();
    const soil = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 2.0), new THREE.MeshStandardMaterial({ color: '#5b4432', roughness: 0.95 }));
    soil.position.y = 0.06;
    soil.receiveShadow = true;
    vegPatch.add(soil);
    const leafMat = new THREE.MeshStandardMaterial({ color: '#4c7b48', roughness: 0.82 });
    const vRand = rng(88);
    for (let i = 0; i < 14; i++) {
      const cab = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + vRand() * 0.06, 1), leafMat);
      cab.scale.y = 0.72;
      cab.position.set((vRand() - 0.5) * 2.4, 0.22, (vRand() - 0.5) * 1.4);
      vegPatch.add(cab);
    }
    const vegY = this._placeAtGround(vegPatch, -6.5, -0.8);
    if (this.physics) {
      this.physics.addOBB(-6.5, -0.8, 0, 3.2, 2.0, vegY, vegY + 0.45, 'garden');
    }

    // 6. Garden Flower Beds (all clear of Home Chalet eaves, fences, and stepping path)
    const flowerPositions = [
      [-4.8, 5.4], [-5.5, 3.6], [-1.2, 4.6], [1.8, -2.0], [-3.8, -2.2], [5.8, -1.8],
    ];
    for (let i = 0; i < flowerPositions.length; i++) {
      const [fx, fz] = flowerPositions[i];
      const cluster = new THREE.Group();
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 1), m.pineMid);
      bush.scale.set(1.15, 0.65, 1.05);
      bush.position.y = 0.22;
      cluster.add(bush);
      for (let b = 0; b < 6; b++) {
        const ang = b * 1.12 + i * 0.7;
        const rad = 0.12 + (b % 3) * 0.08;
        const bl = new THREE.Mesh(
          new THREE.SphereGeometry(0.065 + (b % 2) * 0.025, 6, 6),
          (b + i) % 2 === 0 ? m.mustard : m.cobaltLight
        );
        bl.position.set(Math.cos(ang) * rad, 0.32 + (b % 3) * 0.05, Math.sin(ang) * rad);
        cluster.add(bl);
      }
      this._placeAtGround(cluster, fx, fz);
    }

    // 7. Stacked Firewood Rack (placed cleanly outside Home Chalet eaves) + Bench + Well
    const wrY = this._placeAtGround(buildWoodRack(m), -14.8, 1.4);
    if (this.physics) {
      this.physics.addOBB(-14.8, 1.4, 0, 1.65, 0.65, wrY, wrY + 1.05, 'prop');
    }

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
    const benchY = this._placeAtGround(bench, 3.2, 2.2);
    if (this.physics) {
      this.physics.addOBB(3.2, 2.2, -0.45, 1.5, 0.55, benchY, benchY + 0.95, 'bench');
    }

    const well = new THREE.Group();
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.58, 12), m.stoneMid);
    basin.position.y = 0.29;
    basin.castShadow = true;
    const pumpPost = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.05, 8), m.ironDark);
    pumpPost.position.set(0.32, 0.525, 0);
    const spout = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), m.ironDark);
    spout.position.set(0.18, 0.85, 0);
    well.add(basin, pumpPost, spout);
    const wellY = this._placeAtGround(well, 0.6, 5.2);
    if (this.physics) {
      this.physics.addCylinder(0.6, 5.2, 0.68, wellY, wellY + 1.15, 'prop');
    }

    // 8. Patterned Laundry on Clothesline (clear of fences and chalet)
    const lPost1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 8), m.timberDark);
    const lPost2 = lPost1.clone();
    const lp1Y = this._placeAtGround(lPost1, -11.8, -1.2, 0.95);
    const lp2Y = this._placeAtGround(lPost2, -8.4, -2.4, 0.95);
    const lineLen = Math.hypot(3.4, 1.2);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, lineLen, 6), m.plaster);
    line.rotation.z = Math.PI / 2;
    line.rotation.y = Math.atan2(1.2, 3.4);
    this._placeAtGround(line, -10.1, -1.8, 1.78);
    if (this.physics) {
      this.physics.addCylinder(-11.8, -1.2, 0.16, lp1Y, lp1Y + 1.9, 'post');
      this.physics.addCylinder(-8.4, -2.4, 0.16, lp2Y, lp2Y + 1.9, 'post');
    }

    const clothColors = [m.plaster, m.cobaltLight, m.mustardSoft];
    for (let i = 0; i < 3; i++) {
      const f = 0.25 + i * 0.25;
      const cx = -11.8 + 3.4 * f;
      const cz = -1.2 - 1.2 * f;
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.03), clothColors[i]);
      cloth.position.set(cx, heightAt(cx, cz) + 1.48, cz);
      cloth.rotation.y = -0.35;
      this.group.add(cloth);
      this.laundryItems.push({ mesh: cloth, phase: i * 1.4 });
    }
  }

  _buildVillageAndBridge() {
    const m = this.mats;

    // 1. Alpine Village Station Platform (grounded flush on terrain) & Shelter
    const platX = VILLAGE_POS.x - 2.3;
    const platZ = VILLAGE_POS.z;
    const platGround = heightAt(platX, platZ);
    const plat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.42, 10.0), m.timberMid);
    plat.position.set(platX, platGround + 0.21, platZ);
    plat.rotation.y = 0.22;
    plat.receiveShadow = true;
    this.group.add(plat);
    if (this.physics) {
      this.physics.addDeckOBB(platX, platZ, 0.22, 2.8, 10.0, platGround + 0.42, 0.7);
    }

    const shX = VILLAGE_POS.x + 3.4;
    const shZ = VILLAGE_POS.z;
    const shY = heightAt(shX, shZ);
    const shelter = new THREE.Group();
    const shWall = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.25, 4.8), m.timberLight);
    shWall.position.y = 1.125;
    shWall.castShadow = true;
    const shRoof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 5.6), m.slateRoof);
    shRoof.position.y = 2.38;
    shRoof.rotation.z = -0.15;
    const shLamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), m.lanternGlow);
    shLamp.position.set(1.15, 2.0, 1.8);
    const vBench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 1.8), m.timberDark);
    vBench.position.set(1.25, 0.5, 0);
    shelter.add(shWall, shRoof, shLamp, vBench);
    for (const bz of [-0.7, 0.7]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.1), m.timberDark);
      leg.position.set(1.25, 0.225, bz);
      shelter.add(leg);
    }
    shelter.position.set(shX, shY, shZ);
    shelter.rotation.y = -Math.PI + 0.22;
    this.group.add(shelter);
    if (this.physics) {
      this.physics.addOBB(shX, shZ, -Math.PI + 0.22, 2.5, 5.0, shY, shY + 2.6, 'shelter');
    }

    // 2. Modest Alpine Village Church
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

    church.rotation.y = CHURCH_SITE.ry;
    const chY = this._placeAtGround(church, CHURCH_SITE.x, CHURCH_SITE.z);
    if (this.physics) {
      this.physics.addOBB(CHURCH_SITE.x, CHURCH_SITE.z, CHURCH_SITE.ry, CHURCH_SITE.w, CHURCH_SITE.d, chY, chY + 10.0, 'church');
    }
  }

  _buildTracksideLife() {
    const m = this.mats;

    // Timber barns & firewood racks (offset along barn pad so they never touch each other)
    for (const b of BARN_SITES) {
      const barn = buildBarn(m, 3.8, 3.2);
      barn.rotation.y = b.ry;
      const by = this._placeAtGround(barn, b.x, b.z);
      if (this.physics) {
        this.physics.addOBB(b.x, b.z, b.ry, 4.0, 3.4, by, by + 3.9, 'barn');
      }

      const wx = b.x + Math.cos(b.ry) * 3.1;
      const wz = b.z - Math.sin(b.ry) * 3.1;
      const wr = buildWoodRack(m);
      wr.rotation.y = b.ry;
      const wry = this._placeAtGround(wr, wx, wz);
      if (this.physics) {
        this.physics.addOBB(wx, wz, b.ry, 1.65, 0.65, wry, wry + 1.05, 'prop');
      }
    }

    // Haystacks across valley & climbing slopes
    for (const [hx, hz, hs] of HAY_SITES) {
      const hy = this._placeAtGround(buildHaystack(m, hs), hx, hz);
      if (this.physics) {
        this.physics.addCylinder(hx, hz, 1.08 * hs, hy, hy + 1.85 * hs, 'haystack');
      }
    }

    // Slope-conforming paddock fences
    for (const run of FENCE_RUNS) {
      addFenceRun(this.group, m, run, this.physics);
    }

    // Timber-and-Stone Footbridge over the Mountain Brook (clear walkable deck + side rails)
    const fbX = 57;
    const fbY = LAKE_WATER_Y + 0.1;
    const fbZ = -106;
    const fbYaw = 0.18;
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
      const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 0.9), m.stoneMid);
      pier.position.set(0, -0.1, endZ);
      footbridge.add(pier);
    }
    footbridge.position.set(fbX, fbY, fbZ);
    footbridge.rotation.y = fbYaw;
    this.group.add(footbridge);
    if (this.physics) {
      this.physics.addDeckOBB(fbX, fbZ, fbYaw, 1.8, 7.2, fbY + 0.80, 0.9);
      const cos = Math.cos(fbYaw);
      const sin = Math.sin(fbYaw);
      for (const side of [-0.96, 0.96]) {
        this.physics.addOBB(fbX + side * cos, fbZ - side * sin, fbYaw, 0.14, 7.2, fbY + 0.75, fbY + 1.4, 'fence');
      }
    }
  }

  _buildForestsAndMeadow(low) {
    const m = this.mats;
    const rand = rng(404);
    const treeCount = low ? 220 : 480;

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

    const isClearLandmark = (x, z, r) => {
      if (Math.hypot(x + 2, z) < 15.5 + r) return false;
      if (z > -2 && z < 24 && Math.abs(x - 0.5) < 11.5) return false;
      if (z < -10 && z > -75 && Math.abs(x - 12) < 14) return false;
      for (const lm of LANDMARK_CLEARANCE) {
        if (Math.hypot(x - lm.x, z - lm.z) < lm.r + r) return false;
      }
      return true;
    };

    let placed = 0;
    let larchPlaced = 0;
    let tries = 0;
    while (placed < treeCount && tries < treeCount * 24) {
      tries++;
      const inClimbZone = tries % 3 === 0;
      const x = inClimbZone ? (rand() - 0.35) * 180 : (rand() - 0.5) * 320 + 10;
      const z = inClimbZone ? -205 - rand() * 165 : 35 - rand() * 440;

      const sc = 0.72 + rand() * 0.85;
      const crownR = 1.66 * sc;
      if (!isClearLandmark(x, z, crownR)) continue;

      const y = heightAt(x, z);
      if (y < LAKE_WATER_Y + 0.55 || y > 50) continue;
      // Avoid very steep cliffs where tree base would hang off edge
      const slope = Math.hypot(heightAt(x + 1.2, z) - y, heightAt(x, z + 1.2) - y) / 1.2;
      if (slope > 0.72) continue;

      if (this.physics && !this.physics.canPlaceCircle(x, z, crownR, { minRail: 4.8, checkWater: true, minGap: 0.55 })) {
        continue;
      }

      _q.setFromEuler(new THREE.Euler(0, rand() * Math.PI * 2, 0));
      _p.set(x, y + 1.05 * sc, z);
      _s.set(sc * (0.9 + rand() * 0.18), sc, sc * (0.9 + rand() * 0.18));
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

      if (this.physics) {
        this.physics.addCylinder(x, z, 0.36 * sc, y, y + 1.5 * sc, 'tree_trunk');
        this.physics.addCylinder(x, z, crownR, y + 1.5 * sc, y + 6.4 * sc, 'tree_crown');
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

    // Broadleaf Golden-Autumn Birch / Rowan Trees
    const broadCount = low ? 50 : 115;
    const bTrunkGeo = new THREE.CylinderGeometry(0.11, 0.18, 2.4, 7);
    const bLobeGeo = new THREE.IcosahedronGeometry(1.05, 1);
    const bTrunkMat = new THREE.MeshStandardMaterial({ color: '#c8c0b4', roughness: 0.88 });
    const bCrownMat = new THREE.MeshStandardMaterial({ bumpMap: m.pineMid.bumpMap, bumpScale: 0.04, color: '#ffffff', roughness: 0.84 });

    const bTrunks = new THREE.InstancedMesh(bTrunkGeo, bTrunkMat, broadCount);
    const bCrowns = new THREE.InstancedMesh(bLobeGeo, bCrownMat, broadCount * 3);
    bCrowns.castShadow = !low;

    let bPlaced = 0;
    let bTries = 0;
    while (bPlaced < broadCount && bTries < broadCount * 24) {
      bTries++;
      const x = (rand() - 0.5) * 240 + 14;
      const z = 25 - rand() * 365;
      const sc = 0.78 + rand() * 0.6;
      const crownR = 1.65 * sc;
      if (!isClearLandmark(x, z, crownR)) continue;

      const y = heightAt(x, z);
      if (y < LAKE_WATER_Y + 0.55 || y > 40) continue;
      const slope = Math.hypot(heightAt(x + 1.2, z) - y, heightAt(x, z + 1.2) - y) / 1.2;
      if (slope > 0.68) continue;

      if (this.physics && !this.physics.canPlaceCircle(x, z, crownR, { minRail: 5.0, checkWater: true, minGap: 0.55 })) {
        continue;
      }

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

      if (this.physics) {
        this.physics.addCylinder(x, z, 0.3 * sc, y, y + 1.5 * sc, 'tree_trunk');
        this.physics.addCylinder(x, z, crownR, y + 1.5 * sc, y + 3.6 * sc, 'tree_crown');
      }
      bPlaced++;
    }
    bTrunks.count = bPlaced;
    bCrowns.count = bPlaced * 3;
    bTrunks.instanceMatrix.needsUpdate = true;
    bCrowns.instanceMatrix.needsUpdate = true;
    if (bCrowns.instanceColor) bCrowns.instanceColor.needsUpdate = true;
    this.group.add(bTrunks, bCrowns);

    // Multi-blade Grass Tufts & Organic Wildflower Clusters
    const tuftCount = low ? 800 : 2500;
    const bladeGeo = makeGrassTuftGeo();
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.88, side: THREE.DoubleSide });
    const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, tuftCount);

    const flowerCount = low ? 240 : 760;
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
      { cx: -8, cz: -230, r: 36 },
      { cx: 24, cz: -255, r: 46 },
      { cx: 56, cz: -282, r: 44 },
      { cx: 42, cz: -318, r: 40 },
      { cx: 18, cz: -355, r: 42 },
    ];

    let bIdx = 0;
    let fgIdx = 0;
    let fbIdx = 0;
    let gTries = 0;
    while (bIdx < tuftCount && gTries < tuftCount * 8) {
      gTries++;
      const a = anchors[gTries % anchors.length];
      const ang = rand() * Math.PI * 2;
      const dist = 1.6 + Math.sqrt(rand()) * a.r;
      const gx = a.cx + Math.cos(ang) * dist;
      const gz = a.cz + Math.sin(ang) * dist;
      if (minTrackSplineDist(gx, gz) < 2.2) continue;
      if (Math.hypot(gx - BOARD_POS.x, gz - (BOARD_POS.z + 2)) < 5.5) continue;
      const gy = heightAt(gx, gz);
      if (gy < LAKE_WATER_Y + 0.35 || gy > 44) continue;

      _q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.2, rand() * Math.PI * 2, (rand() - 0.5) * 0.2));
      const hScale = 0.65 + rand() * 1.05;
      const wScale = 0.8 + rand() * 0.75;
      _p.set(gx, gy, gz);
      _s.set(wScale, hScale, wScale);
      _m.compose(_p, _q, _s);
      blades.setMatrixAt(bIdx, _m);
      _c.set('#6b8a4b').offsetHSL((rand() - 0.5) * 0.05, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.12);
      blades.setColorAt(bIdx, _c);
      bIdx++;

      if (bIdx % 3 === 0 && (fgIdx < flowerCount || fbIdx < flowerCount)) {
        const fScale = 0.55 + rand() * 0.85;
        _p.set(gx + (rand() - 0.5) * 0.5, gy + 0.08 * fScale, gz + (rand() - 0.5) * 0.5);
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

    // Alpine Granite Boulders & Outcrops (spaced apart from each other, trees, buildings, tracks, and water)
    const rockCount = low ? 65 : 140;
    const rockGeo = new THREE.DodecahedronGeometry(0.9, 1);
    const rocks = new THREE.InstancedMesh(rockGeo, m.stoneMid, rockCount);
    rocks.receiveShadow = true;
    rocks.castShadow = !low;
    let rPlaced = 0;
    let rTries = 0;
    while (rPlaced < rockCount && rTries < rockCount * 22) {
      rTries++;
      const inClimb = rTries % 2 === 0;
      const rx = inClimb ? (rand() - 0.35) * 140 : (rand() - 0.5) * 260;
      const rz = inClimb ? -205 - rand() * 155 : 20 - rand() * 420;
      const sx = 0.55 + rand() * 1.15;
      const sy = 0.38 + rand() * 0.72;
      const sz = 0.55 + rand() * 1.15;
      const rockR = 0.9 * Math.max(sx, sz);

      if (!isClearLandmark(rx, rz, rockR + 0.5)) continue;
      const ry = heightAt(rx, rz);
      if (ry < LAKE_WATER_Y + 0.45 || ry > 52) continue;
      const slope = Math.hypot(heightAt(rx + 1.0, rz) - ry, heightAt(rx, rz + 1.0) - ry) / 1.0;
      if (slope > 0.55) continue;

      if (this.physics && !this.physics.canPlaceCircle(rx, rz, rockR, { minRail: 4.0, checkWater: true, minGap: 0.45 })) {
        continue;
      }

      // Seat bottom cleanly on terrain with minor base embedding so boulders never float or sink deeply
      _p.set(rx, ry + 0.55 * sy, rz);
      _q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3));
      _s.set(sx, sy, sz);
      _m.compose(_p, _q, _s);
      rocks.setMatrixAt(rPlaced++, _m);

      if (this.physics) {
        this.physics.addCylinder(rx, rz, rockR, ry, ry + 1.45 * sy, 'rock');
      }
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
