import * as THREE from '../../lib/three.module.js';
import {
  BOARD_POS,
  LAKE_PIER_POS,
  LAKE_POS,
  LAKE_WATER_Y,
  LOOKOUT_POS,
  SIDETRACK_POS,
  SUMMIT_POS,
} from '../core/env.js';
import { rng } from '../core/math.js';
import { heightAt } from './terrain.js';
import { MountainDog } from '../chars/puppy.js';

/**
 * Stations, Sidings, Alpine Lake Pier & Rowboats, High Lookout, and Cloud Summit Station
 * perched above the layered backlit sea of clouds with the Puppy's Family.
 */
export class StationsAndSummit {
  constructor(mats) {
    this.group = new THREE.Group();
    this.mats = mats;
    this.boats = [];
    this.flags = [];
    this.familyDogs = [];

    this._buildBoardHalt();
    this._buildFlowerSiding();
    this._buildLakeStationAndBoats();
    this._buildLookoutHut();
    this._buildCloudSummitStation();
  }

  _makeLantern(x, y, z) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), this.mats.ironDark);
    post.position.y = 1.2;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.34, 6), this.mats.lanternGlow);
    head.position.y = 2.45;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.18, 6), this.mats.mustard);
    cap.position.y = 2.7;
    g.add(post, head, cap);
    g.position.set(x, y, z);
    this.group.add(g);
    return g;
  }

  _makeFlag(x, y, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 3.2, 8), this.mats.timberLight);
    pole.position.y = 1.6;
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.54, 0.03), this.mats.cobalt);
    flag.position.set(0.48, 2.85, 0);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.16, 0.035), this.mats.mustard);
    band.position.set(0.48, 2.85, 0);
    g.add(pole, flag, band);
    g.position.set(x, y, z);
    this.group.add(g);
    this.flags.push(flag);
  }

  _makeBench(x, y, z, ry = 0) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.46), this.mats.timberLight);
    seat.position.y = 0.44;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.36, 0.07), this.mats.timberLight);
    back.position.set(0, 0.72, -0.19);
    g.add(seat, back);
    for (const bx of [-0.58, 0.58]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.44, 0.42), this.mats.timberDark);
      leg.position.set(bx, 0.22, 0);
      g.add(leg);
    }
    g.position.set(x, y, z);
    g.rotation.y = ry;
    this.group.add(g);
    return g;
  }

  _makeStationShelter(w, d, roofMat, shutterMat) {
    const g = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.36, d + 0.16), this.mats.stoneMid);
    plinth.position.y = 0.18;
    const lower = new THREE.Mesh(new THREE.BoxGeometry(w, 1.35, d), this.mats.plaster);
    lower.position.y = 0.88;
    lower.castShadow = true;
    lower.receiveShadow = true;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.95, d + 0.1), this.mats.timberMid);
    upper.position.y = 1.98;
    upper.castShadow = true;

    const halfW = w * 0.5 + 0.55;
    const pitch = 1.25;
    const slopeLen = Math.hypot(halfW, pitch);
    const ang = Math.atan2(pitch, halfW);
    for (const side of [-1, 1]) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.14, d + 1.0), roofMat);
      roof.position.set(side * halfW * 0.48, 2.45 + pitch * 0.5, 0);
      roof.rotation.z = side * -ang;
      roof.castShadow = true;
      g.add(roof);
    }
    const gable = new THREE.Mesh(new THREE.ConeGeometry(w * 0.56, pitch, 4), this.mats.timberLight);
    gable.rotation.y = Math.PI / 4;
    gable.scale.set(1.2, 1.0, d / (w * 0.8));
    gable.position.y = 2.45 + pitch * 0.48;

    for (const zSide of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.1), this.mats.lanternGlow);
      win.position.set(0, 1.18, zSide * (d * 0.5 + 0.03));
      g.add(win);
      for (const s of [-1, 1]) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.08), shutterMat);
        sh.position.set(s * 0.52, 1.18, zSide * (d * 0.5 + 0.04));
        g.add(sh);
      }
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.16, 0.2), this.mats.timberDark);
      box.position.set(0, 0.78, zSide * (d * 0.5 + 0.14));
      const flw = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.12, 0.16), this.mats.mustard);
      flw.position.set(0, 0.88, zSide * (d * 0.5 + 0.14));
      g.add(box, flw);
    }

    g.add(plinth, lower, upper, gable);
    return g;
  }

  _buildBoardHalt() {
    const m = this.mats;
    const plat = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.38, 2.5), m.timberMid);
    plat.position.set(BOARD_POS.x, BOARD_POS.y + 0.05, BOARD_POS.z + 2.1);
    plat.receiveShadow = true;
    this.group.add(plat);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 2.3), m.slateRoof);
    roof.position.set(BOARD_POS.x - 1.5, 2.65, BOARD_POS.z + 2.4);
    roof.rotation.x = 0.12;
    roof.castShadow = true;
    this.group.add(roof);

    for (const px of [BOARD_POS.x - 3.2, BOARD_POS.x + 0.2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.4, 8), m.timberDark);
      post.position.set(px, 1.4, BOARD_POS.z + 2.4);
      this.group.add(post);
    }

    this._makeBench(BOARD_POS.x - 1.5, BOARD_POS.y + 0.24, BOARD_POS.z + 2.55, 0);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 0.44), m.cobalt);
    trunk.position.set(BOARD_POS.x + 1.4, BOARD_POS.y + 0.45, BOARD_POS.z + 2.2);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.46), m.mustard);
    band.position.copy(trunk.position);
    this.group.add(trunk, band);

    this._makeLantern(BOARD_POS.x + 3.6, 0, BOARD_POS.z + 2.2);
    this._makeFlag(BOARD_POS.x - 4.4, 0, BOARD_POS.z + 2.2);
  }

  _buildFlowerSiding() {
    const m = this.mats;
    const baseY = SIDETRACK_POS.y - 0.25;

    const plat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.36, 9.2), m.timberMid);
    plat.position.set(SIDETRACK_POS.x + 2.2, baseY + 0.15, SIDETRACK_POS.z);
    plat.receiveShadow = true;
    this.group.add(plat);

    const hut = this._makeStationShelter(3.6, 4.2, m.timberDark, m.mustard);
    hut.position.set(SIDETRACK_POS.x + 5.2, baseY, SIDETRACK_POS.z);
    hut.rotation.y = -Math.PI * 0.5;
    this.group.add(hut);

    this._makeBench(SIDETRACK_POS.x + 2.4, baseY + 0.34, SIDETRACK_POS.z + 1.5, -Math.PI * 0.5);

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4 - row; col++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 4.4, 9), m.timberLight);
        log.rotation.x = Math.PI / 2;
        log.position.set(SIDETRACK_POS.x + 4.0 + col * 0.52 + row * 0.26, baseY + 0.26 + row * 0.42, SIDETRACK_POS.z - 5.2);
        log.castShadow = true;
        this.group.add(log);
      }
    }

    const retWall = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 14.0), m.stoneMid);
    retWall.position.set(SIDETRACK_POS.x + 8.5, baseY + 0.45, SIDETRACK_POS.z - 1.5);
    retWall.receiveShadow = true;
    this.group.add(retWall);

    const cranePost = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3.2, 10), m.ironDark);
    cranePost.position.set(SIDETRACK_POS.x + 2.4, baseY + 1.6, SIDETRACK_POS.z + 4.0);
    const craneArm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.14), m.cobalt);
    craneArm.position.set(SIDETRACK_POS.x + 1.6, baseY + 3.0, SIDETRACK_POS.z + 4.0);
    this.group.add(cranePost, craneArm);

    // Organic, naturally varied wildflower clumps (NO grid spacing!)
    const fRand = rng(707);
    for (let c = 0; c < 18; c++) {
      const ang = fRand() * Math.PI * 2;
      const dist = 2.8 + fRand() * 11.5;
      const cx = SIDETRACK_POS.x - 1.5 + Math.cos(ang) * dist * 0.85;
      const cz = SIDETRACK_POS.z + Math.sin(ang) * dist;
      if (Math.abs(cx - SIDETRACK_POS.x) < 1.9) continue;
      const cy = heightAt(cx, cz);
      const cluster = new THREE.Group();
      const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32 + fRand() * 0.2, 0), m.pineMid);
      leaf.scale.set(1.1, 0.42, 1.0);
      leaf.position.y = 0.09;
      cluster.add(leaf);
      const blossoms = 3 + Math.floor(fRand() * 4);
      for (let b = 0; b < blossoms; b++) {
        const ba = fRand() * Math.PI * 2;
        const br = 0.08 + fRand() * 0.28;
        const flw = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.08 + fRand() * 0.07, 0),
          (c + b) % 2 === 0 ? m.mustard : m.cobaltLight
        );
        flw.scale.y = 0.6;
        flw.position.set(Math.cos(ba) * br, 0.18 + fRand() * 0.12, Math.sin(ba) * br);
        cluster.add(flw);
      }
      cluster.position.set(cx, cy, cz);
      cluster.rotation.y = fRand() * Math.PI * 2;
      this.group.add(cluster);
    }

    this._makeLantern(SIDETRACK_POS.x + 2.2, baseY, SIDETRACK_POS.z - 2.6);
    this._makeFlag(SIDETRACK_POS.x + 2.4, baseY, SIDETRACK_POS.z + 4.6);
  }

  _buildLakeStationAndBoats() {
    const m = this.mats;
    const baseY = LAKE_POS.y - 0.2;

    const plat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.42, 9.6), m.timberMid);
    plat.position.set(LAKE_POS.x - 2.3, baseY + 0.15, LAKE_POS.z);
    plat.rotation.y = 0.2;
    plat.receiveShadow = true;
    this.group.add(plat);

    const lakeHouse = this._makeStationShelter(3.6, 4.4, m.slateRoof, m.cobalt);
    lakeHouse.position.set(LAKE_POS.x + 3.6, baseY, LAKE_POS.z + 0.5);
    lakeHouse.rotation.y = -Math.PI * 0.45;
    this.group.add(lakeHouse);

    this._makeBench(LAKE_POS.x - 2.2, baseY + 0.36, LAKE_POS.z - 1.4, Math.PI * 0.5);
    this._makeLantern(LAKE_POS.x - 1.8, baseY + 0.2, LAKE_POS.z + 3.8);
    this._makeFlag(LAKE_POS.x - 2.4, baseY + 0.2, LAKE_POS.z - 4.0);

    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const sx = LAKE_POS.x - 3.6 - t * 4.5;
      const sz = LAKE_POS.z - 1.5 - t * 0.4;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.1, 7), m.stoneLight);
      st.position.set(sx, heightAt(sx, sz) + 0.04, sz);
      this.group.add(st);
    }

    const pier = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.18, 2.5), m.timberLight);
    deck.position.set(-5.0, 0, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    pier.add(deck);
    for (let px = -9.5; px <= -1.0; px += 2.8) {
      for (const pz of [-0.98, 0.98]) {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.3, 8), m.timberDark);
        pile.position.set(px, -0.75, pz);
        pier.add(pile);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 8), m.timberDark);
        cap.position.set(px, 0.2, pz);
        pier.add(cap);
      }
    }
    pier.position.set(LAKE_PIER_POS.x, LAKE_WATER_Y + 0.65, LAKE_PIER_POS.z);
    this.group.add(pier);

    const rRand = rng(303);
    for (let i = 0; i < 18; i++) {
      const rx = LAKE_PIER_POS.x + 1.5 - rRand() * 3.8;
      const rz = LAKE_PIER_POS.z - 14 + rRand() * 28;
      const ry = Math.max(LAKE_WATER_Y - 0.1, heightAt(rx, rz));
      if (Math.abs(rz - LAKE_PIER_POS.z) < 2.4) continue;
      const reed = new THREE.Mesh(new THREE.ConeGeometry(0.11 + rRand() * 0.06, 0.75 + rRand() * 0.55, 5), m.pineMid);
      reed.position.set(rx, ry + 0.36, rz);
      reed.rotation.set((rRand() - 0.5) * 0.25, rRand() * 3, (rRand() - 0.5) * 0.25);
      this.group.add(reed);
    }

    const boatOffsets = [
      [-11.5, -2.5, 0.3],
      [-7.5, 2.8, -0.45],
      [-15.5, 4.2, 0.8],
    ];
    for (const [ox, oz, ry] of boatOffsets) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), m.timberMid);
      hull.scale.set(0.78, 0.62, 1.9);
      hull.position.y = 0.28;
      hull.castShadow = true;
      const gunwale = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.055, 6, 16), m.cobalt);
      gunwale.rotation.x = Math.PI / 2;
      gunwale.scale.set(0.78, 1.88, 1);
      gunwale.position.y = 0.28;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.34), m.mustard);
      bench.position.y = 0.22;
      const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 6), m.timberLight);
      oar.rotation.x = Math.PI / 2;
      oar.position.set(0.28, 0.31, 0.15);
      boat.add(hull, gunwale, bench, oar);
      boat.position.set(LAKE_PIER_POS.x + ox, LAKE_WATER_Y + 0.04, LAKE_PIER_POS.z + oz);
      boat.rotation.y = ry;
      this.group.add(boat);
      this.boats.push({ mesh: boat, baseY: LAKE_WATER_Y + 0.04, phase: ox * 0.4 });
    }
  }

  _buildLookoutHut() {
    const m = this.mats;
    const baseY = LOOKOUT_POS.y - 0.25;
    const stoneBase = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 4.0, 0.65, 8), m.stoneMid);
    stoneBase.position.set(LOOKOUT_POS.x + 4.4, baseY - 0.1, LOOKOUT_POS.z);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.28, 8), m.timberMid);
    deck.position.set(LOOKOUT_POS.x + 4.4, baseY + 0.26, LOOKOUT_POS.z);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.07, 6, 8), m.timberLight);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(LOOKOUT_POS.x + 4.4, baseY + 1.05, LOOKOUT_POS.z);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.7, 1.9, 8), m.timberDark);
    roof.position.set(LOOKOUT_POS.x + 4.4, baseY + 3.5, LOOKOUT_POS.z);
    this.group.add(stoneBase, deck, rail, roof);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.5, 8), m.timberDark);
      post.position.set(
        LOOKOUT_POS.x + 4.4 + Math.cos(a) * 2.5,
        baseY + 1.45,
        LOOKOUT_POS.z + Math.sin(a) * 2.5
      );
      this.group.add(post);
    }
    this._makeBench(LOOKOUT_POS.x + 4.4, baseY + 0.38, LOOKOUT_POS.z + 1.2, 0);
    this._makeLantern(LOOKOUT_POS.x + 1.8, baseY + 0.2, LOOKOUT_POS.z + 2.5);
    this._makeFlag(LOOKOUT_POS.x + 4.4, baseY, LOOKOUT_POS.z - 3.2);
  }

  _buildCloudSummitStation() {
    const m = this.mats;
    const sy = SUMMIT_POS.y - 0.25;

    // 1. Stone Terrace & Retaining Foundation perched above the layered cloud sea
    const terraceStoneMat = m.stoneMid.clone();
    terraceStoneMat.map = m.stoneMid.map.clone();
    terraceStoneMat.map.repeat.set(8, 2);
    terraceStoneMat.map.needsUpdate = true;
    terraceStoneMat.bumpMap = m.stoneMid.bumpMap.clone();
    terraceStoneMat.bumpMap.repeat.set(8, 2);
    terraceStoneMat.bumpMap.needsUpdate = true;

    const terraceBase = new THREE.Mesh(new THREE.BoxGeometry(24.0, 2.6, 14.0), terraceStoneMat);
    terraceBase.position.set(SUMMIT_POS.x + 2.0, sy - 1.0, SUMMIT_POS.z - 5.2);
    terraceBase.receiveShadow = true;
    this.group.add(terraceBase);

    const platMat = m.stoneLight.clone();
    platMat.map = m.stoneLight.map.clone();
    platMat.map.repeat.set(8, 3);
    platMat.map.needsUpdate = true;
    platMat.bumpMap = m.stoneLight.bumpMap.clone();
    platMat.bumpMap.repeat.set(8, 3);
    platMat.bumpMap.needsUpdate = true;

    const plat = new THREE.Mesh(new THREE.BoxGeometry(22.0, 0.55, 8.2), platMat);
    plat.position.set(SUMMIT_POS.x + 2.5, sy + 0.12, SUMMIT_POS.z - 3.8);
    plat.receiveShadow = true;
    this.group.add(plat);

    // Low stone & timber edge balustrade along the northern overlook toward the cloud sea
    for (let bx = -7.5; bx <= 12.5; bx += 2.5) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.24), m.stoneMid);
      post.position.set(SUMMIT_POS.x + bx, sy + 0.72, SUMMIT_POS.z - 7.75);
      this.group.add(post);
    }
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.1, 0.14), m.timberLight);
    topRail.position.set(SUMMIT_POS.x + 2.5, sy + 1.08, SUMMIT_POS.z - 7.75);
    this.group.add(topRail);

    // 2. White Snow-Trimmed Alpine Cloud Station House (placed left-of-center so the backlit cloud sea opens wide!)
    const station = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.55, 5.2), m.stoneMid);
    plinth.position.y = 0.28;
    const body = new THREE.Mesh(new THREE.BoxGeometry(8.8, 3.6, 4.8), m.plaster);
    body.position.y = 1.9;
    body.castShadow = true;
    body.receiveShadow = true;
    station.add(plinth, body);

    const timberBand = new THREE.Mesh(new THREE.BoxGeometry(9.0, 1.45, 5.0), m.timberMid);
    timberBand.position.y = 3.0;
    station.add(timberBand);

    for (const side of [-1, 1]) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.28, 3.6), m.snowRoof);
      roof.position.set(0, 4.5, side * 1.38);
      roof.rotation.x = side * 0.42;
      roof.castShadow = true;
      station.add(roof);
    }

    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.4, 0.9), m.stoneMid);
    chim.position.set(-2.9, 6.0, -0.7);
    chim.castShadow = true;
    station.add(chim);
    this.summitChimneyTip = new THREE.Vector3(SUMMIT_POS.x - 1.5 - 2.9, sy + 8.1, SUMMIT_POS.z - 9.2 - 0.7);

    const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.68, 1.35, 8), m.lanternGlow);
    cupola.position.set(0, 5.7, 0);
    const cupolaRoof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.1, 8), m.cobalt);
    cupolaRoof.position.set(0, 6.85, 0);
    station.add(cupola, cupolaRoof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.9, 0.16), m.cobalt);
    door.position.set(0, 1.2, 2.46);
    station.add(door);

    for (const wx of [-2.9, -1.45, 1.45, 2.9]) {
      const winFrame = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.04, 0.14), m.timberDark);
      winFrame.position.set(wx, 1.92, 2.44);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.88, 0.16), m.lanternGlow);
      win.position.set(wx, 1.92, 2.46);
      const mV = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.9, 0.18), m.timberLight);
      mV.position.set(wx, 1.92, 2.47);
      const mH = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.055, 0.18), m.timberLight);
      mH.position.set(wx, 1.92, 2.47);
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.24), m.mustard);
      box.position.set(wx, 1.32, 2.54);
      station.add(winFrame, win, mV, mH, box);
    }

    station.position.set(SUMMIT_POS.x - 1.5, sy + 0.3, SUMMIT_POS.z - 9.2);
    this.group.add(station);

    // Platform Warm Lanterns, Wooden Benches & Cobalt-Mustard Flags
    this._makeLantern(SUMMIT_POS.x - 6.8, sy + 0.35, SUMMIT_POS.z - 2.8);
    this._makeLantern(SUMMIT_POS.x + 6.5, sy + 0.35, SUMMIT_POS.z - 2.8);
    this._makeLantern(SUMMIT_POS.x + 11.5, sy + 0.35, SUMMIT_POS.z - 2.8);
    this._makeBench(SUMMIT_POS.x + 5.8, sy + 0.38, SUMMIT_POS.z - 5.2, 0);
    this._makeBench(SUMMIT_POS.x - 1.8, sy + 0.38, SUMMIT_POS.z - 5.2, 0);
    this._makeFlag(SUMMIT_POS.x - 7.5, sy + 0.35, SUMMIT_POS.z - 6.2);
    this._makeFlag(SUMMIT_POS.x + 11.8, sy + 0.35, SUMMIT_POS.z - 6.2);

    const buf = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.95, 0.6), m.mustard);
    buf.position.set(33.2, SUMMIT_POS.y + 0.45, -393.0);
    this.group.add(buf);

    // 3. Greeting Puppy's Family on the Summit Arrival Platform
    const mother = new MountainDog(m, { scale: 1.55, hasBell: true });
    mother.pos.set(SUMMIT_POS.x + 3.8, sy + 0.4, SUMMIT_POS.z - 3.6);
    mother.yaw = -0.85;
    this.group.add(mother.group);
    this.familyDogs.push({ dog: mother, phase: 0 });

    const sib1 = new MountainDog(m, { scale: 0.92, hasBell: true });
    sib1.pos.set(SUMMIT_POS.x + 2.5, sy + 0.4, SUMMIT_POS.z - 4.3);
    sib1.yaw = -0.55;
    this.group.add(sib1.group);
    this.familyDogs.push({ dog: sib1, phase: 1.7 });

    const sib2 = new MountainDog(m, { scale: 0.88, hasBell: false });
    sib2.pos.set(SUMMIT_POS.x + 4.7, sy + 0.4, SUMMIT_POS.z - 4.4);
    sib2.yaw = -1.1;
    this.group.add(sib2.group);
    this.familyDogs.push({ dog: sib2, phase: 3.1 });
  }

  update(dt, time, arrivedAtSummit) {
    for (const b of this.boats) {
      b.mesh.position.y = b.baseY + Math.sin(time * 1.6 + b.phase) * 0.06;
      b.mesh.rotation.z = Math.sin(time * 1.2 + b.phase) * 0.04;
    }
    for (let i = 0; i < this.flags.length; i++) {
      this.flags[i].rotation.y = Math.sin(time * 3.1 + i) * 0.14;
    }
    for (const fd of this.familyDogs) {
      fd.dog.update(dt, time + fd.phase, { moving: false, excited: arrivedAtSummit });
    }
  }
}
