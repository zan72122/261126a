import * as THREE from '../../lib/three.module.js';
import { ISLANDS, PALETTE, PAVILION_POS } from '../core/env.js';
import { addBoxObstacle, addCircleObstacle, addObjectObstacle } from './colliders.js';
import { getGroundY, getLandInfo, getPierDeckSegment, PAVILION_JETTY, PAVILION_TERRACE } from './terrain.js';
import {
  makeAmphora,
  makeCypress,
  makeDryingNetRack,
  makeFishingBoat,
  makeHarborPropsCluster,
  makeLanternPost,
  makeLemonTree,
  makeMediterraneanHouse,
  makeOliveTree,
  makeStoneArch,
  makeStoneBench,
  makeStoneWallSegment,
  makeTerracottaPlanter,
  scatterCoastalFoliage,
} from './props.js';

export class Archipelago {
  constructor(mats, { lowQuality = false } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'archipelago';
    this.lanternMats = [];
    this.dockRings = [];
    this.windmillBlades = null;
    this.lighthouseBeam = null;

    const castShadow = !lowQuality;

    this._buildLighthouseIsland(mats, ISLANDS[0], castShadow, lowQuality);
    this._buildWindmillIsland(mats, ISLANDS[1], castShadow, lowQuality);
    this._buildCoveVillageIsland(mats, ISLANDS[2], castShadow, lowQuality);
    this._buildStarlitPavilion(mats, castShadow, lowQuality);
  }

  _addDockPier(mats, pos, walkPos, islandId, castShadow) {
    const seg = getPierDeckSegment(pos, walkPos);
    const pier = new THREE.Group();
    pier.position.set(seg.startX, 0, seg.startZ);
    pier.rotation.y = seg.ang;

    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, seg.len), mats.woodLight);
    deck.position.set(0, 0.59, seg.len * 0.5);
    deck.receiveShadow = castShadow;
    pier.add(deck);

    const lx = seg.startX + Math.sin(seg.ang) * 0.7 - Math.cos(seg.ang) * 1.05;
    const lz = seg.startZ + Math.cos(seg.ang) * 0.7 + Math.sin(seg.ang) * 1.05;
    const post = makeLanternPost(mats, 2.2, this.lanternMats);
    post.position.set(lx, 0.735, lz);
    this.group.add(post);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 2.75, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: PALETTE.lantern,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring.position.set(pos.x, 0.16, pos.z);
    ring.userData = { islandId };
    this.group.add(pier);
    this.group.add(ring);
    this.dockRings.push(ring);

    const midX = (seg.startX + seg.endX) * 0.5;
    const midZ = (seg.startZ + seg.endZ) * 0.5;
    addBoxObstacle(midX, midZ, 2.6, seg.len, seg.ang, 0.0, 0.735, 'deck', true);
    addCircleObstacle(lx, lz, 0.25, 0.735, 3.2, 'lantern');
  }

  _addEmbeddedSlopeSteps(mats, startPos, endPos, count = 9, width = 1.9) {
    const dx = endPos.x - startPos.x;
    const dz = endPos.z - startPos.z;
    const fullDist = Math.hypot(dx, dz);
    const ux = fullDist > 1e-4 ? dx / fullDist : 1;
    const uz = fullDist > 1e-4 ? dz / fullDist : 0;
    const ang = Math.atan2(dx, dz);
    // Start 1.1m inland from walkLanding so steps never clip pier deck
    const offsetStart = 1.1;
    const span = Math.max(2.0, fullDist - offsetStart);
    const spacing = span / Math.max(1, count - 1);
    const depth = Math.min(0.16, spacing * 0.18);

    for (let i = 0; i < count; i++) {
      const dist = offsetStart + i * spacing;
      const sx = startPos.x + ux * dist;
      const sz = startPos.z + uz * dist;
      const sy = getGroundY(sx, sz);
      const step = new THREE.Mesh(new THREE.BoxGeometry(width, 0.28, depth), mats.stoneLight);
      step.position.set(sx, sy - 0.145, sz);
      step.rotation.y = ang;
      step.receiveShadow = true;
      this.group.add(step);
      addBoxObstacle(sx, sz, width, depth, ang, sy - 0.285, sy - 0.005, 'stair');
    }
  }

  // 1. 灯台の島 (Lighthouse Island)
  _buildLighthouseIsland(mats, isl, castShadow, lowQuality) {
    const cx = isl.center.x;
    const cz = isl.center.z;
    this._addDockPier(mats, isl.dockPos, isl.walkLanding, isl.id, castShadow);
    this._addEmbeddedSlopeSteps(mats, isl.walkLanding, { x: cx + 2.8, z: cz + 0.5 }, 9, 1.9);

    for (const [wx, wz, ry, len] of [
      [cx + 11.0, cz - 14.5, -0.5, 3.6],
      [cx + 13.0, cz - 10.5, 0.4, 3.6],
      [cx - 14.0, cz + 7.5, 0.35, 3.6],
      [cx - 12.5, cz - 12.2, -0.45, 3.6],
    ]) {
      const wseg = makeStoneWallSegment(mats, len, 0.92);
      const wy = getGroundY(wx, wz);
      wseg.position.set(wx, wy - 0.10, wz);
      wseg.rotation.y = ry;
      this.group.add(wseg);
      addObjectObstacle(wseg, 'wall', 0.04);
    }

    const lh = new THREE.Group();
    const lx = cx - 2.0;
    const lz = cz + 1.0;
    const ly = getGroundY(lx, lz);
    lh.position.set(lx, ly, lz);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 2.2, 14), mats.stone);
    base.position.y = 1.1;
    base.castShadow = castShadow;
    lh.add(base);

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 2.1, 10.5, 14), mats.plaster);
    tower.position.y = 7.4;
    tower.castShadow = castShadow;
    lh.add(tower);

    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.76, 1.2, 14), mats.terracotta);
    band.position.y = 9.2;
    lh.add(band);

    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 1.8, 0.45, 14), mats.terracottaDark);
    gallery.position.y = 12.7;
    lh.add(gallery);

    const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.45, 12), mats.lanternGlow.clone());
    lanternGlass.position.y = 13.65;
    lh.add(lanternGlass);
    this.lanternMats.push(lanternGlass.material);

    const dome = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.2, 12), mats.terracotta);
    dome.position.y = 14.9;
    lh.add(dome);
    this.group.add(lh);
    addCircleObstacle(lx, lz, 2.85, ly, ly + 15.5, 'building');

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffdea0,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beamGroup = new THREE.Group();
    beamGroup.name = 'lighthouseBeam';
    beamGroup.position.set(lx, ly + 13.65, lz);
    for (const dir of [-1, 1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.8, 26, 12, 1, true), beamMat);
      cone.rotation.z = dir * Math.PI * 0.5;
      cone.position.x = dir * 13;
      beamGroup.add(cone);
    }
    this.lighthouseBeam = beamGroup;

    for (const hc of [
      { x: cx + 6.5, z: cz - 7.5, ry: 0.55, w: 4.0, d: 3.2, h: 2.9, pergola: true, door: mats.bluePaint },
      { x: cx + 11.5, z: cz + 6.8, ry: -0.75, w: 3.6, d: 3.0, h: 2.5, stairs: true, door: mats.coralDoor },
      { x: cx - 9.5, z: cz + 11.5, ry: 0.25, w: 3.8, d: 3.2, h: 2.6, door: mats.shutter },
    ]) {
      const cot = makeMediterraneanHouse(mats, {
        w: hc.w, d: hc.d, h: hc.h, balcony: false, pergola: !!hc.pergola, stairs: !!hc.stairs,
        doorMat: hc.door, castShadow,
      });
      cot.position.set(hc.x, getGroundY(hc.x, hc.z), hc.z);
      cot.rotation.y = hc.ry;
      this.group.add(cot);
      addObjectObstacle(cot, 'building', 0.05);
    }

    const props = makeHarborPropsCluster(mats);
    const px0 = isl.walkLanding.x + 1.0;
    const pz0 = isl.walkLanding.z - 2.6;
    props.position.set(px0, getGroundY(px0, pz0), pz0);
    this.group.add(props);
    addObjectObstacle(props, 'prop', 0.04);

    const netRack = makeDryingNetRack(mats);
    const nx0 = isl.walkLanding.x + 2.4;
    const nz0 = isl.walkLanding.z + 3.2;
    netRack.position.set(nx0, getGroundY(nx0, nz0), nz0);
    netRack.rotation.y = 0.65;
    this.group.add(netRack);
    addObjectObstacle(netRack, 'prop', 0.04);

    for (const [px, pz] of [
      [isl.walkLanding.x - 0.8, isl.walkLanding.z + 2.4],
      [cx + 3.0, cz - 2.5],
      [cx - 4.8, cz + 5.2],
      [cx + 6.5, cz + 4.2],
    ]) {
      const pot = makeTerracottaPlanter(mats, true);
      pot.position.set(px, getGroundY(px, pz), pz);
      this.group.add(pot);
      addObjectObstacle(pot, 'prop', 0.04);
    }

    for (const [lx0, lz0] of [[cx + 7.5, cz + 1.2], [cx - 6.8, cz - 4.5]]) {
      const lp = makeLanternPost(mats, 2.3, this.lanternMats);
      lp.position.set(lx0, getGroundY(lx0, lz0), lz0);
      this.group.add(lp);
      addObjectObstacle(lp, 'lantern', 0.04);
    }

    [
      [cx + 11.8, cz - 1.5, 0.98, false], [cx + 15.2, cz - 4.5, 0.90, true],
      [cx - 8.5, cz - 8.5, 1.02, false], [cx + 2.0, cz + 11.8, 0.92, true],
      [cx - 12.5, cz + 2.0, 0.96, false], [cx + 2.5, cz - 15.2, 1.0, false],
      [cx + 14.5, cz + 12.2, 0.88, true], [cx - 4.5, cz - 15.0, 0.96, false],
    ].forEach(([ox, oz, s, isLem], idx) => {
      const ot = isLem ? makeLemonTree(mats, s, castShadow, 50 + idx * 7) : makeOliveTree(mats, s, castShadow, 70 + idx * 7);
      ot.position.set(ox, getGroundY(ox, oz), oz);
      this.group.add(ot);
      addObjectObstacle(ot, 'tree', 0.02);
    });

    [[cx + 10.6, cz - 12.6, 5.2], [cx - 10.5, cz + 6.0, 4.8], [cx - 0.5, cz - 11.5, 5.5]].forEach(([cxo, czo, ch], idx) => {
      const cyp = makeCypress(mats, ch, castShadow, 88 + idx * 11);
      cyp.position.set(cxo, getGroundY(cxo, czo), czo);
      this.group.add(cyp);
      addObjectObstacle(cyp, 'tree', 0.02);
    });

    const det = isl.detourPos;
    const detY = getGroundY(det.x, det.z);
    const detPost = makeLanternPost(mats, 2.2, this.lanternMats);
    detPost.position.set(det.x, detY, det.z);
    this.group.add(detPost);
    addObjectObstacle(detPost, 'lantern', 0.04);

    const bench = makeStoneBench(mats);
    bench.position.set(det.x + 1.8, getGroundY(det.x + 1.8, det.z + 1.0), det.z + 1.0);
    bench.rotation.y = 0.4;
    this.group.add(bench);
    addObjectObstacle(bench, 'prop', 0.04);

    scatterCoastalFoliage(this.group, {
      centerX: cx,
      centerZ: cz,
      radiusX: isl.radius - 1.5,
      radiusZ: isl.radius - 1.5,
      getLand: getLandInfo,
      mats,
      seed: 211,
      countGrass: 540,
      countShrub: 88,
      countRock: 48,
      minY: 0.78,
      lowQuality,
    });
  }

  // 2. 風車の島 (Windmill Island)
  _buildWindmillIsland(mats, isl, castShadow, lowQuality) {
    const cx = isl.center.x;
    const cz = isl.center.z;
    this._addDockPier(mats, isl.dockPos, isl.walkLanding, isl.id, castShadow);
    this._addEmbeddedSlopeSteps(mats, isl.walkLanding, { x: cx - 5.2, z: cz - 1.5 }, 9, 1.9);

    for (const [wx, wz, ry, len] of [
      [cx + 3.5, cz + 15.2, 0.20, 3.6],
      [cx - 3.5, cz + 14.8, -0.25, 3.6],
      [cx + 10.8, cz + 12.2, 0.75, 3.6],
      [cx + 4.8, cz + 9.2, 0.25, 3.4],
      [cx - 2.0, cz + 11.2, -0.35, 3.4],
      [cx + 15.2, cz + 4.5, 1.35, 3.6],
    ]) {
      const wy = getGroundY(wx, wz);
      const wseg = makeStoneWallSegment(mats, len, 0.92);
      wseg.position.set(wx, wy - 0.10, wz);
      wseg.rotation.y = ry;
      this.group.add(wseg);
      addObjectObstacle(wseg, 'wall', 0.04);
    }

    const wm = new THREE.Group();
    const wx = cx + 1.5;
    const wz = cz - 2.0;
    const wy = getGroundY(wx, wz);
    wm.position.set(wx, wy, wz);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.0, 7.6, 14), mats.plaster);
    body.position.y = 3.8;
    body.castShadow = castShadow;
    body.receiveShadow = castShadow;
    wm.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.65, 2.2, 14), mats.terracotta);
    roof.position.y = 8.6;
    roof.castShadow = castShadow;
    wm.add(roof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.85, 0.2), mats.coralDoor);
    door.position.set(0, 0.92, 2.9);
    wm.add(door);

    const hub = new THREE.Group();
    hub.position.set(0, 6.4, -2.55);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.1, 8), mats.wood);
    axle.rotation.x = Math.PI * 0.5;
    hub.add(axle);

    for (let i = 0; i < 6; i++) {
      const armGroup = new THREE.Group();
      armGroup.rotation.z = (i / 6) * Math.PI * 2;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.9, 0.12), mats.wood);
      spar.position.y = 2.45;
      armGroup.add(spar);
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 3.8), mats.canvas);
      sail.position.set(0.52, 2.75, 0.04);
      sail.rotation.y = 0.18;
      armGroup.add(sail);
      hub.add(armGroup);
    }
    wm.add(hub);
    wm.rotation.y = Math.PI * 0.68;
    this.windmillBlades = hub;
    this.group.add(wm);
    addCircleObstacle(wx, wz, 3.15, wy, wy + 10.0, 'building');

    for (const hc of [
      { x: cx - 8.5, z: cz + 6.2, ry: -0.5, w: 3.8, d: 3.2, h: 2.7, pergola: true, door: mats.shutter },
      { x: cx + 10.5, z: cz - 7.5, ry: 0.6, w: 4.0, d: 3.4, h: 3.0, balcony: true, door: mats.bluePaint },
      { x: cx - 11.8, z: cz - 7.2, ry: -0.9, w: 3.6, d: 3.0, h: 2.6, door: mats.coralDoor },
    ]) {
      const store = makeMediterraneanHouse(mats, {
        w: hc.w, d: hc.d, h: hc.h, pergola: !!hc.pergola, balcony: !!hc.balcony, doorMat: hc.door, castShadow,
      });
      store.position.set(hc.x, getGroundY(hc.x, hc.z), hc.z);
      store.rotation.y = hc.ry;
      this.group.add(store);
      addObjectObstacle(store, 'building', 0.05);
    }

    const arch = makeStoneArch(mats, { span: 2.4, height: 2.8, depth: 0.9, castShadow });
    arch.position.set(cx - 5.5, getGroundY(cx - 5.5, cz - 4.8), cz - 4.8);
    arch.rotation.y = 1.1;
    this.group.add(arch);
    addObjectObstacle(arch, 'arch', 0.04);

    const props = makeHarborPropsCluster(mats);
    const px1 = isl.walkLanding.x - 1.0;
    const pz1 = isl.walkLanding.z - 2.8;
    props.position.set(px1, getGroundY(px1, pz1), pz1);
    this.group.add(props);
    addObjectObstacle(props, 'prop', 0.04);

    for (const [px, pz] of [
      [isl.walkLanding.x + 1.0, isl.walkLanding.z + 2.4],
      [cx - 3.6, cz + 4.4],
      [cx + 6.2, cz + 2.8],
    ]) {
      const pot = makeTerracottaPlanter(mats, true);
      pot.position.set(px, getGroundY(px, pz), pz);
      this.group.add(pot);
      addObjectObstacle(pot, 'prop', 0.04);
    }

    [
      [cx - 6.2, cz - 9.8, true], [cx + 8.0, cz - 14.0, false], [cx + 12.8, cz + 8.2, true],
      [cx - 13.8, cz + 11.2, false], [cx + 7.5, cz + 15.2, false], [cx - 16.0, cz + 1.5, true],
      [cx + 16.0, cz - 1.8, false], [cx - 1.5, cz - 14.8, true],
    ].forEach(([tx, tz, isLemon], idx) => {
      const t = isLemon ? makeLemonTree(mats, 1.0, castShadow, 120 + idx * 9) : makeOliveTree(mats, 1.02, castShadow, 140 + idx * 9);
      t.position.set(tx, getGroundY(tx, tz), tz);
      this.group.add(t);
      addObjectObstacle(t, 'tree', 0.02);
    });

    [[cx - 4.8, cz - 13.2, 5.4], [cx + 9.5, cz + 1.5, 5.2]].forEach(([cxo, czo, ch], idx) => {
      const cyp = makeCypress(mats, ch, castShadow, 160 + idx * 11);
      cyp.position.set(cxo, getGroundY(cxo, czo), czo);
      this.group.add(cyp);
      addObjectObstacle(cyp, 'tree', 0.02);
    });

    const cove = isl.detourPos;
    const rowboat = makeFishingBoat(mats, mats.coralDoor);
    rowboat.position.set(cove.x, getGroundY(cove.x, cove.z) + 0.08, cove.z);
    rowboat.rotation.y = 0.6;
    rowboat.rotation.z = 0.06;
    this.group.add(rowboat);
    addObjectObstacle(rowboat, 'prop', 0.05);

    const covePost = makeLanternPost(mats, 2.1, this.lanternMats);
    covePost.position.set(cove.x - 3.0, getGroundY(cove.x - 3.0, cove.z - 2.0), cove.z - 2.0);
    this.group.add(covePost);
    addObjectObstacle(covePost, 'lantern', 0.04);

    scatterCoastalFoliage(this.group, {
      centerX: cx,
      centerZ: cz,
      radiusX: isl.radius - 1.5,
      radiusZ: isl.radius - 1.5,
      getLand: getLandInfo,
      mats,
      seed: 317,
      countGrass: 540,
      countShrub: 88,
      countRock: 48,
      minY: 0.78,
      lowQuality,
    });
  }

  // 3. 入江の村の島 (Cove Village Island)
  _buildCoveVillageIsland(mats, isl, castShadow, lowQuality) {
    const cx = isl.center.x;
    const cz = isl.center.z;
    this._addDockPier(mats, isl.dockPos, isl.walkLanding, isl.id, castShadow);
    this._addDockPier(mats, isl.altDockPos, new THREE.Vector3(cx + 2, 0.85, cz - 16), isl.id, castShadow);
    this._addEmbeddedSlopeSteps(mats, isl.walkLanding, { x: cx + 2.0, z: cz + 0.5 }, 9, 1.9);

    const villageHouses = [
      { x: cx + 3.5, z: cz + 6.5, ry: -1.1, w: 3.8, d: 3.1, h: 3.2, balcony: true, pergola: true, door: mats.coralDoor },
      { x: cx - 6.5, z: cz - 6.5, ry: -0.6, w: 3.8, d: 3.3, h: 3.7, stairs: true, door: mats.bluePaint },
      { x: cx - 14.5, z: cz + 2.5, ry: 0.4, w: 4.0, d: 3.3, h: 3.5, balcony: true, door: mats.shutter, annex: true },
      { x: cx + 6.5, z: cz - 8.5, ry: -1.4, w: 3.6, d: 3.0, h: 2.9, door: mats.coralDoor },
      { x: cx + 12.0, z: cz + 4.8, ry: -0.8, w: 3.6, d: 3.0, h: 2.8, pergola: true, door: mats.bluePaint },
    ];
    for (const vh of villageHouses) {
      const h = makeMediterraneanHouse(mats, {
        w: vh.w, d: vh.d, h: vh.h,
        balcony: !!vh.balcony, stairs: !!vh.stairs, pergola: !!vh.pergola, annex: !!vh.annex,
        doorMat: vh.door, castShadow,
      });
      h.position.set(vh.x, getGroundY(vh.x, vh.z), vh.z);
      h.rotation.y = vh.ry;
      this.group.add(h);
      addObjectObstacle(h, 'building', 0.05);
    }

    const arch = makeStoneArch(mats, { span: 2.4, height: 3.0, depth: 0.9, castShadow });
    arch.position.set(cx - 3.5, getGroundY(cx - 3.5, cz + 0.2), cz + 0.2);
    arch.rotation.y = 0.85;
    this.group.add(arch);
    addObjectObstacle(arch, 'arch', 0.04);

    const det = isl.detourPos;
    const detY = getGroundY(det.x, det.z);
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.78, 12), mats.stoneLight);
    well.position.set(det.x, detY + 0.39, det.z);
    this.group.add(well);
    addObjectObstacle(well, 'prop', 0.04);

    const post = makeLanternPost(mats, 2.3, this.lanternMats);
    post.position.set(det.x + 2.5, getGroundY(det.x + 2.5, det.z - 2.0), det.z - 2.0);
    this.group.add(post);
    addObjectObstacle(post, 'lantern', 0.04);

    const bench = makeStoneBench(mats);
    bench.position.set(det.x - 2.4, getGroundY(det.x - 2.4, det.z + 2.2), det.z + 2.2);
    bench.rotation.y = 0.7;
    this.group.add(bench);
    addObjectObstacle(bench, 'prop', 0.04);

    [
      [cx + 8.5, cz + 11.2, true], [cx - 17.5, cz - 4.5, false], [cx - 3.5, cz + 13.0, true],
      [cx + 12.8, cz - 5.2, false], [cx - 17.5, cz + 11.5, true], [cx - 0.5, cz - 12.8, false],
    ].forEach(([tx, tz, isLemon], idx) => {
      const t = isLemon ? makeLemonTree(mats, 0.92, castShadow, 210 + idx * 9) : makeOliveTree(mats, 0.98, castShadow, 240 + idx * 9);
      t.position.set(tx, getGroundY(tx, tz), tz);
      this.group.add(t);
      addObjectObstacle(t, 'tree', 0.02);
    });

    const cl = makeHarborPropsCluster(mats);
    const cx1 = isl.walkLanding.x - 1.2;
    const cz1 = isl.walkLanding.z + 2.6;
    cl.position.set(cx1, getGroundY(cx1, cz1), cz1);
    this.group.add(cl);
    addObjectObstacle(cl, 'prop', 0.04);

    const netRack = makeDryingNetRack(mats);
    const nx1 = isl.walkLanding.x + 1.4;
    const nz1 = isl.walkLanding.z - 2.8;
    netRack.position.set(nx1, getGroundY(nx1, nz1), nz1);
    netRack.rotation.y = -0.4;
    this.group.add(netRack);
    addObjectObstacle(netRack, 'prop', 0.04);

    scatterCoastalFoliage(this.group, {
      centerX: cx,
      centerZ: cz,
      radiusX: isl.radius - 1.5,
      radiusZ: isl.radius - 1.5,
      getLand: getLandInfo,
      mats,
      seed: 421,
      countGrass: 500,
      countShrub: 82,
      countRock: 44,
      minY: 0.78,
      lowQuality,
    });
  }

  // 4. ゴール：星を映す入江の東屋 (Starlit Cove Pavilion & Open-Front Colonnade)
  _buildStarlitPavilion(mats, castShadow, lowQuality) {
    const g = new THREE.Group();
    const px = PAVILION_TERRACE.x;
    const pz = PAVILION_POS.z;
    const terraceZ = PAVILION_TERRACE.z; // 188.5

    // Top cobblestone surface slab resting cleanly on terrain stone terrace base
    const terraceFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(PAVILION_TERRACE.r - 0.15, PAVILION_TERRACE.r - 0.10, 0.14, 32),
      mats.cobble
    );
    terraceFloor.position.set(px, PAVILION_TERRACE.topY - 0.075, terraceZ);
    terraceFloor.receiveShadow = castShadow;
    g.add(terraceFloor);

    // Front-left landing jetty top slab resting on terrain jetty base
    const jettyTop = new THREE.Mesh(
      new THREE.BoxGeometry(PAVILION_JETTY.w - 0.15, 0.14, PAVILION_JETTY.d - 0.15),
      mats.cobble
    );
    jettyTop.position.set(PAVILION_JETTY.x, PAVILION_JETTY.topY - 0.075, PAVILION_JETTY.z);
    jettyTop.receiveShadow = castShadow;
    g.add(jettyTop);

    // Mooring bollard on the landing jetty
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.5, 8), mats.stoneLight);
    bollard.position.set(-2.55, PAVILION_JETTY.topY + 0.25, 179.0);
    g.add(bollard);
    addCircleObstacle(-2.55, 179.0, 0.20, PAVILION_JETTY.topY, PAVILION_JETTY.topY + 0.55, 'bollard');

    // Perimeter colonnade built in 3 grounded wing groups (origin at terrace level)
    const colR = 5.4;
    const addPillar = (parent, ox, oz, a) => {
      const colX = px + Math.cos(a) * colR - ox;
      const colZ = terraceZ + Math.sin(a) * colR - oz;
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.26, 0.76), mats.stoneLight);
      base.position.set(colX, 0.13, colZ);
      parent.add(base);

      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.33, 4.2, 12), mats.plaster);
      col.position.set(colX, 2.36, colZ);
      col.castShadow = castShadow;
      parent.add(col);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.26, 0.82), mats.stoneLight);
      cap.position.set(colX, 4.59, colZ);
      parent.add(cap);

      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.34, 6), mats.lanternGlow.clone());
      lantern.position.set(colX * 0.92, 3.25, colZ - (colZ + oz - terraceZ) * 0.08);
      parent.add(lantern);
      this.lanternMats.push(lantern.material);
    };

    const addCurvedLintel = (parent, ox, oz, a0, a1) => {
      const arcLen = Math.abs(a1 - a0);
      const beamGeo = new THREE.TorusGeometry(colR, 0.24, 6, 14, arcLen);
      beamGeo.rotateX(Math.PI * 0.5);
      const beam = new THREE.Mesh(beamGeo, mats.plaster);
      beam.position.set(px - ox, 4.90, terraceZ - oz);
      beam.rotation.y = -a0;
      parent.add(beam);

      const roofGeo = new THREE.TorusGeometry(colR + 0.08, 0.30, 5, 14, arcLen);
      roofGeo.rotateX(Math.PI * 0.5);
      const roof = new THREE.Mesh(roofGeo, mats.terracotta);
      roof.position.set(px - ox, 5.26, terraceZ - oz);
      roof.rotation.y = -a0;
      roof.castShadow = castShadow;
      parent.add(roof);
    };

    const wingLeft = new THREE.Group();
    wingLeft.position.set(-5.0, PAVILION_TERRACE.topY, terraceZ);
    addPillar(wingLeft, -5.0, terraceZ, (7 * Math.PI) / 8);
    addPillar(wingLeft, -5.0, terraceZ, (9 * Math.PI) / 8);
    addCurvedLintel(wingLeft, -5.0, terraceZ, (7 * Math.PI) / 8, (9 * Math.PI) / 8);
    g.add(wingLeft);
    addObjectObstacle(wingLeft, 'building', 0.04);

    const wingRight = new THREE.Group();
    wingRight.position.set(5.0, PAVILION_TERRACE.topY, terraceZ);
    addPillar(wingRight, 5.0, terraceZ, -Math.PI / 8);
    addPillar(wingRight, 5.0, terraceZ, Math.PI / 8);
    addCurvedLintel(wingRight, 5.0, terraceZ, -Math.PI / 8, Math.PI / 8);
    g.add(wingRight);
    addObjectObstacle(wingRight, 'building', 0.04);

    const wingBack = new THREE.Group();
    wingBack.position.set(0, PAVILION_TERRACE.topY, terraceZ + 5.0);
    addPillar(wingBack, 0, terraceZ + 5.0, (3 * Math.PI) / 8);
    addPillar(wingBack, 0, terraceZ + 5.0, (5 * Math.PI) / 8);
    addCurvedLintel(wingBack, 0, terraceZ + 5.0, (3 * Math.PI) / 8, (5 * Math.PI) / 8);

    const mainLanternGroup = new THREE.Group();
    mainLanternGroup.position.set(0, 4.35, -0.5);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.65, 6), mats.brass);
    chain.position.y = 0.42;
    mainLanternGroup.add(chain);
    const lCap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.2, 8), mats.brass);
    lCap.position.y = 0.14;
    mainLanternGroup.add(lCap);
    const mainLantern = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.44, 8), mats.lanternGlow.clone());
    mainLantern.position.y = -0.1;
    mainLanternGroup.add(mainLantern);
    wingBack.add(mainLanternGroup);
    this.lanternMats.push(mainLantern.material);

    g.add(wingBack);
    addObjectObstacle(wingBack, 'building', 0.04);

    // Terracotta flower planters, amphorae & stone bench around terrace perimeter (clear of colonnade & reunion)
    for (const [tx, tz] of [[-2.7, terraceZ - 2.6], [2.7, terraceZ - 2.6], [2.7, terraceZ + 1.4]]) {
      const pot = makeTerracottaPlanter(mats, true);
      pot.position.set(tx, PAVILION_TERRACE.topY, tz);
      g.add(pot);
      addObjectObstacle(pot, 'prop', 0.04);
    }
    for (const [ax, az] of [[-3.1, terraceZ + 1.2], [3.0, terraceZ - 3.9]]) {
      const amp = makeAmphora(mats, 0.95);
      amp.position.set(ax, PAVILION_TERRACE.topY, az);
      g.add(amp);
      addObjectObstacle(amp, 'prop', 0.04);
    }
    const bench = makeStoneBench(mats);
    bench.position.set(-2.2, PAVILION_TERRACE.topY, terraceZ + 2.5);
    bench.rotation.y = 0.45;
    g.add(bench);
    addObjectObstacle(bench, 'prop', 0.04);

    // Warm lantern post at far-right edge of terrace
    const lp = makeLanternPost(mats, 2.35, this.lanternMats);
    lp.position.set(4.5, PAVILION_TERRACE.topY, terraceZ - 4.0);
    g.add(lp);
    addObjectObstacle(lp, 'lantern', 0.04);

    // Cypress & olive trees framing the crescent cove ONLY where dry land exists (getGroundY >= 0.85)
    [
      [-15, pz + 4, 6.8], [15, pz + 4, 6.6], [-21, pz + 3, 5.8], [21, pz + 3, 6.0],
      [-9, pz + 11, 7.2], [9, pz + 11, 7.0],
    ].forEach(([cx, cz, ch], idx) => {
      const gy = getGroundY(cx, cz);
      if (gy < 0.85) return;
      const cyp = makeCypress(mats, ch, castShadow, 500 + idx * 13);
      cyp.position.set(cx, gy, cz);
      g.add(cyp);
      addObjectObstacle(cyp, 'tree', 0.02);
    });
    [[-17, pz + 8], [17, pz + 8], [-23, pz + 9], [23, pz + 9]].forEach(([ox, oz], idx) => {
      const gy = getGroundY(ox, oz);
      if (gy < 0.85) return;
      const ot = makeOliveTree(mats, 1.15, castShadow, 560 + idx * 11);
      ot.position.set(ox, gy, oz);
      g.add(ot);
      addObjectObstacle(ot, 'tree', 0.02);
    });

    scatterCoastalFoliage(g, {
      centerX: px,
      centerZ: pz + 5,
      radiusX: 36,
      radiusZ: 22,
      getLand: getLandInfo,
      mats,
      seed: 557,
      countGrass: 320,
      countShrub: 54,
      countRock: 34,
      minY: 1.15,
      lowQuality,
    });

    this.group.add(g);
  }

  update(t, dt, lanternLevel) {
    if (this.windmillBlades) {
      this.windmillBlades.rotation.z -= dt * 0.62;
    }
    if (this.lighthouseBeam) {
      this.lighthouseBeam.rotation.y += dt * 0.52;
    }
    for (const lm of this.lanternMats) {
      lm.emissiveIntensity = 0.65 + lanternLevel * 1.85;
    }
    for (const ring of this.dockRings) {
      const s = 1.0 + 0.1 * Math.sin(t * 2.1 + ring.position.x);
      ring.scale.set(s, 1, s);
    }
  }
}
