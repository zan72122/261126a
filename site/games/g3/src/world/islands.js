import * as THREE from '../../lib/three.module.js';
import { ISLANDS, PALETTE, PAVILION_DOCK_POS, PAVILION_POS } from '../core/env.js';
import { getGroundY, getLandInfo } from './terrain.js';
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
    const dir = new THREE.Vector3().subVectors(walkPos, pos);
    const fullLen = dir.length();
    const berthGap = 2.4;
    const len = Math.max(4.0, fullLen - berthGap);
    const ang = Math.atan2(dir.x, dir.z);
    const startPos = pos.clone().addScaledVector(dir.clone().normalize(), berthGap);

    const pier = new THREE.Group();
    pier.position.copy(startPos);
    pier.rotation.y = ang;

    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, len + 1.2), mats.woodLight);
    deck.position.set(0, 0.56, len * 0.5);
    deck.receiveShadow = castShadow;
    pier.add(deck);

    for (let z = 0.6; z <= len; z += 2.2) {
      for (const sx of [-1.05, 1.05]) {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.6, 7), mats.wood);
        pile.position.set(sx, -0.1, z);
        pier.add(pile);
      }
    }
    const post = makeLanternPost(mats, 2.2, this.lanternMats);
    post.position.set(-1.05, 0.72, 0.7);
    pier.add(post);

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
  }

  _addEmbeddedSlopeSteps(mats, startPos, endPos, count = 18, width = 2.2) {
    const dx = endPos.x - startPos.x;
    const dz = endPos.z - startPos.z;
    const ang = Math.atan2(dx, dz);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const sx = startPos.x + dx * t;
      const sz = startPos.z + dz * t;
      const sy = getGroundY(sx, sz);
      const step = new THREE.Mesh(new THREE.BoxGeometry(width, 1.25, 0.95), mats.stoneLight);
      step.position.set(sx, sy - 0.55, sz);
      step.rotation.y = ang;
      step.receiveShadow = true;
      this.group.add(step);

      if (i % 2 === 0) {
        const nx = Math.cos(ang);
        const nz = -Math.sin(ang);
        for (const side of [-1, 1]) {
          const curb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.72), mats.stone);
          curb.position.set(sx + side * nx * (width * 0.5 + 0.16), sy + 0.04, sz + side * nz * (width * 0.5 + 0.16));
          curb.rotation.y = ang;
          this.group.add(curb);
        }
      }
    }
  }

  // 1. 灯台の島 (Lighthouse Island)
  _buildLighthouseIsland(mats, isl, castShadow, lowQuality) {
    const cx = isl.center.x;
    const cz = isl.center.z;
    this._addDockPier(mats, isl.dockPos, isl.walkLanding, isl.id, castShadow);
    this._addEmbeddedSlopeSteps(mats, isl.walkLanding, { x: cx - 1, z: cz + 1 }, 14, 2.2);

    for (const [wx, wz, ry, len] of [
      [cx + 12, cz + 4, -0.5, 4.4],
      [cx + 8, cz - 10, 0.4, 4.8],
      [cx - 10, cz + 9, 0.35, 4.2],
      [cx - 11, cz - 11, -0.45, 4.2],
    ]) {
      const wseg = makeStoneWallSegment(mats, len, 1.1);
      wseg.position.set(wx, getGroundY(wx, wz) - 0.42, wz);
      wseg.rotation.y = ry;
      this.group.add(wseg);
    }

    const lh = new THREE.Group();
    const lx = cx - 2.0;
    const lz = cz + 1.0;
    const ly = getGroundY(lx, lz);
    lh.position.set(lx, ly - 0.3, lz);

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

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffdea0,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beamGroup = new THREE.Group();
    beamGroup.position.y = 13.65;
    for (const dir of [-1, 1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.8, 26, 12, 1, true), beamMat);
      cone.rotation.z = dir * Math.PI * 0.5;
      cone.position.x = dir * 13;
      beamGroup.add(cone);
    }
    lh.add(beamGroup);
    this.lighthouseBeam = beamGroup;
    this.group.add(lh);

    for (const hc of [
      { x: cx + 5.2, z: cz - 5.2, ry: 0.55, w: 4.4, d: 3.6, h: 2.9, pergola: true, door: mats.bluePaint },
      { x: cx + 10.5, z: cz + 6.2, ry: -0.75, w: 3.6, d: 3.1, h: 2.5, stairs: true, door: mats.coralDoor },
      { x: cx - 8.5, z: cz + 11.0, ry: 0.25, w: 3.8, d: 3.2, h: 2.6, door: mats.shutter },
    ]) {
      const cot = makeMediterraneanHouse(mats, {
        w: hc.w, d: hc.d, h: hc.h, balcony: false, pergola: !!hc.pergola, stairs: !!hc.stairs,
        doorMat: hc.door, castShadow,
      });
      cot.position.set(hc.x, getGroundY(hc.x, hc.z) - 0.25, hc.z);
      cot.rotation.y = hc.ry;
      this.group.add(cot);
    }

    const props = makeHarborPropsCluster(mats);
    props.position.set(isl.walkLanding.x + 0.8, getGroundY(isl.walkLanding.x + 0.8, isl.walkLanding.z - 1.2) - 0.05, isl.walkLanding.z - 1.2);
    this.group.add(props);

    const netRack = makeDryingNetRack(mats);
    netRack.position.set(isl.walkLanding.x + 2.8, getGroundY(isl.walkLanding.x + 2.8, isl.walkLanding.z + 3.2) - 0.08, isl.walkLanding.z + 3.2);
    netRack.rotation.y = 0.65;
    this.group.add(netRack);

    for (const [px, pz] of [
      [isl.walkLanding.x - 1.2, isl.walkLanding.z + 1.8],
      [cx + 3.2, cz - 2.4],
      [cx - 4.5, cz + 4.5],
      [cx + 6.5, cz + 2.2],
    ]) {
      const pot = makeTerracottaPlanter(mats, true);
      pot.position.set(px, getGroundY(px, pz) - 0.06, pz);
      this.group.add(pot);
    }

    for (const [lx, lz] of [[cx + 7.2, cz + 0.8], [cx - 6.2, cz - 4.5]]) {
      const lp = makeLanternPost(mats, 2.3, this.lanternMats);
      lp.position.set(lx, getGroundY(lx, lz) - 0.08, lz);
      this.group.add(lp);
    }

    [
      [cx + 9, cz + 2, 1.05, false], [cx + 14, cz - 2, 0.95, true],
      [cx - 8, cz - 8, 1.1, false], [cx + 2, cz + 12, 0.95, true],
      [cx - 12, cz + 3, 1.0, false], [cx + 4, cz - 14, 1.05, false],
      [cx + 13, cz + 10, 0.9, true], [cx - 4, cz - 15, 1.0, false],
    ].forEach(([ox, oz, s, isLem], idx) => {
      const ot = isLem ? makeLemonTree(mats, s, castShadow, 50 + idx * 7) : makeOliveTree(mats, s, castShadow, 70 + idx * 7);
      ot.position.set(ox, getGroundY(ox, oz) - 0.12, oz);
      this.group.add(ot);
    });

    [[cx + 10, cz - 7, 5.2], [cx - 10, cz + 6, 4.8], [cx + 1, cz - 11, 5.5]].forEach(([cxo, czo, ch], idx) => {
      const cyp = makeCypress(mats, ch, castShadow, 88 + idx * 11);
      cyp.position.set(cxo, getGroundY(cxo, czo) - 0.12, czo);
      this.group.add(cyp);
    });

    const det = isl.detourPos;
    const detY = getGroundY(det.x, det.z);
    const detPost = makeLanternPost(mats, 2.2, this.lanternMats);
    detPost.position.set(det.x, detY - 0.1, det.z);
    this.group.add(detPost);
    const bench = makeStoneBench(mats);
    bench.position.set(det.x + 1.4, detY - 0.05, det.z + 0.8);
    bench.rotation.y = 0.4;
    this.group.add(bench);

    scatterCoastalFoliage(this.group, {
      centerX: cx,
      centerZ: cz,
      radiusX: isl.radius - 1.5,
      radiusZ: isl.radius - 1.5,
      getLand: getLandInfo,
      mats,
      seed: 211,
      countGrass: 560,
      countShrub: 94,
      countRock: 50,
      minY: 0.78,
      lowQuality,
    });
  }

  // 2. 風車の島 (Windmill Island)
  _buildWindmillIsland(mats, isl, castShadow, lowQuality) {
    const cx = isl.center.x;
    const cz = isl.center.z;
    this._addDockPier(mats, isl.dockPos, isl.walkLanding, isl.id, castShadow);
    this._addEmbeddedSlopeSteps(mats, isl.walkLanding, { x: cx + 1, z: cz - 1 }, 14, 2.2);

    // Solid terrain-embedded dry-stone terrace retaining walls (段々畑)
    for (let tier = 0; tier < 3; tier++) {
      const r = 16.5 - tier * 4.2;
      const segs = 6;
      const startA = -0.3 + tier * 0.45;
      for (let s = 0; s < segs; s++) {
        const a = startA + s * 0.46;
        const wx = cx + Math.cos(a) * r;
        const wz = cz + Math.sin(a) * r;
        const wy = getGroundY(wx, wz);
        const wseg = makeStoneWallSegment(mats, 4.4, 1.35);
        wseg.position.set(wx, wy - 0.58, wz);
        wseg.rotation.y = -a + Math.PI * 0.5;
        this.group.add(wseg);
      }
    }

    // Classic Mediterranean whitewashed windmill
    const wm = new THREE.Group();
    const wx = cx + 1.0;
    const wz = cz - 2.0;
    const wy = getGroundY(wx, wz);
    wm.position.set(wx, wy - 0.3, wz);

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

    for (const hc of [
      { x: cx - 7.5, z: cz + 4.5, ry: -0.5, w: 3.8, d: 3.2, h: 2.7, pergola: true, door: mats.shutter },
      { x: cx + 9.2, z: cz - 6.5, ry: 0.6, w: 4.0, d: 3.4, h: 3.0, balcony: true, door: mats.bluePaint },
      { x: cx - 11.0, z: cz - 6.5, ry: -0.9, w: 3.6, d: 3.0, h: 2.6, door: mats.coralDoor },
    ]) {
      const store = makeMediterraneanHouse(mats, {
        w: hc.w, d: hc.d, h: hc.h, pergola: !!hc.pergola, balcony: !!hc.balcony, doorMat: hc.door, castShadow,
      });
      store.position.set(hc.x, getGroundY(hc.x, hc.z) - 0.22, hc.z);
      store.rotation.y = hc.ry;
      this.group.add(store);
    }

    const arch = makeStoneArch(mats, { span: 2.6, height: 2.8, depth: 0.9, castShadow });
    arch.position.set(cx - 5.2, getGroundY(cx - 5.2, cz - 1.2) - 0.12, cz - 1.2);
    arch.rotation.y = 1.1;
    this.group.add(arch);

    const props = makeHarborPropsCluster(mats);
    props.position.set(isl.walkLanding.x - 1.0, getGroundY(isl.walkLanding.x - 1.0, isl.walkLanding.z - 1.4) - 0.05, isl.walkLanding.z - 1.4);
    this.group.add(props);

    for (const [px, pz] of [
      [isl.walkLanding.x + 1.2, isl.walkLanding.z + 1.8],
      [cx - 3.5, cz + 2.8],
      [cx + 5.2, cz + 3.0],
    ]) {
      const pot = makeTerracottaPlanter(mats, true);
      pot.position.set(px, getGroundY(px, pz) - 0.06, pz);
      this.group.add(pot);
    }

    [
      [cx - 8, cz - 7, true], [cx + 9, cz - 12, false], [cx + 12, cz + 5, true],
      [cx - 11, cz + 9, false], [cx + 4, cz + 12, false], [cx - 14, cz + 1, true],
      [cx + 14, cz - 1, false], [cx - 2, cz - 14, true],
    ].forEach(([tx, tz, isLemon], idx) => {
      const t = isLemon ? makeLemonTree(mats, 1.05, castShadow, 120 + idx * 9) : makeOliveTree(mats, 1.1, castShadow, 140 + idx * 9);
      t.position.set(tx, getGroundY(tx, tz) - 0.1, tz);
      this.group.add(t);
    });

    [[cx - 5, cz - 11, 5.4], [cx + 10, cz + 9, 5.2]].forEach(([cxo, czo, ch], idx) => {
      const cyp = makeCypress(mats, ch, castShadow, 160 + idx * 11);
      cyp.position.set(cxo, getGroundY(cxo, czo) - 0.12, czo);
      this.group.add(cyp);
    });

    const cove = isl.detourPos;
    const rowboat = makeFishingBoat(mats, mats.coralDoor);
    rowboat.position.set(cove.x, getGroundY(cove.x, cove.z) + 0.05, cove.z);
    rowboat.rotation.y = 0.6;
    rowboat.rotation.z = 0.08;
    this.group.add(rowboat);
    const covePost = makeLanternPost(mats, 2.1, this.lanternMats);
    covePost.position.set(cove.x - 2.6, getGroundY(cove.x - 2.6, cove.z - 1.5), cove.z - 1.5);
    this.group.add(covePost);

    scatterCoastalFoliage(this.group, {
      centerX: cx,
      centerZ: cz,
      radiusX: isl.radius - 1.5,
      radiusZ: isl.radius - 1.5,
      getLand: getLandInfo,
      mats,
      seed: 317,
      countGrass: 560,
      countShrub: 94,
      countRock: 50,
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
    this._addEmbeddedSlopeSteps(mats, isl.walkLanding, { x: cx - 3, z: cz + 1 }, 12, 2.1);

    const villageHouses = [
      { x: cx + 2, z: cz + 4, ry: -1.1, w: 4.3, d: 3.5, h: 3.2, balcony: true, pergola: true, door: mats.coralDoor },
      { x: cx - 5, z: cz - 5, ry: -0.6, w: 4.0, d: 3.6, h: 3.7, stairs: true, door: mats.bluePaint },
      { x: cx - 9, z: cz + 5, ry: 0.4, w: 4.6, d: 3.8, h: 3.5, balcony: true, door: mats.shutter, annex: true },
      { x: cx + 5, z: cz - 7, ry: -1.4, w: 3.8, d: 3.2, h: 2.9, door: mats.coralDoor },
      { x: cx + 9, z: cz + 2, ry: -0.8, w: 3.6, d: 3.0, h: 2.8, pergola: true, door: mats.bluePaint },
    ];
    for (const vh of villageHouses) {
      const h = makeMediterraneanHouse(mats, {
        w: vh.w, d: vh.d, h: vh.h,
        balcony: !!vh.balcony, stairs: !!vh.stairs, pergola: !!vh.pergola, annex: !!vh.annex,
        doorMat: vh.door, castShadow,
      });
      h.position.set(vh.x, getGroundY(vh.x, vh.z) - 0.22, vh.z);
      h.rotation.y = vh.ry;
      this.group.add(h);
    }

    const arch = makeStoneArch(mats, { span: 2.8, height: 3.0, depth: 1.0, castShadow });
    arch.position.set(cx - 2.5, getGroundY(cx - 2.5, cz + 0.5) - 0.1, cz + 0.5);
    arch.rotation.y = 0.85;
    this.group.add(arch);

    const det = isl.detourPos;
    const detY = getGroundY(det.x, det.z);
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.78, 12), mats.stoneLight);
    well.position.set(det.x, detY + 0.35, det.z);
    this.group.add(well);
    const post = makeLanternPost(mats, 2.3, this.lanternMats);
    post.position.set(det.x + 1.8, detY - 0.05, det.z - 1.2);
    this.group.add(post);

    const bench = makeStoneBench(mats);
    bench.position.set(det.x - 1.7, detY - 0.05, det.z + 1.0);
    bench.rotation.y = 0.7;
    this.group.add(bench);

    [
      [cx + 8, cz + 8, true], [cx - 12, cz - 1, false], [cx - 4, cz + 12, true],
      [cx + 10, cz - 3, false], [cx - 14, cz + 8, true], [cx + 2, cz - 13, false],
    ].forEach(([tx, tz, isLemon], idx) => {
      const t = isLemon ? makeLemonTree(mats, 0.95, castShadow, 210 + idx * 9) : makeOliveTree(mats, 1.05, castShadow, 240 + idx * 9);
      t.position.set(tx, getGroundY(tx, tz) - 0.1, tz);
      this.group.add(t);
    });

    const cl = makeHarborPropsCluster(mats);
    cl.position.set(isl.walkLanding.x - 1.2, getGroundY(isl.walkLanding.x - 1.2, isl.walkLanding.z + 1.4) - 0.05, isl.walkLanding.z + 1.4);
    this.group.add(cl);

    const netRack = makeDryingNetRack(mats);
    netRack.position.set(isl.walkLanding.x + 1.5, getGroundY(isl.walkLanding.x + 1.5, isl.walkLanding.z - 2.6) - 0.08, isl.walkLanding.z - 2.6);
    netRack.rotation.y = -0.4;
    this.group.add(netRack);

    scatterCoastalFoliage(this.group, {
      centerX: cx,
      centerZ: cz,
      radiusX: isl.radius - 1.5,
      radiusZ: isl.radius - 1.5,
      getLand: getLandInfo,
      mats,
      seed: 421,
      countGrass: 520,
      countShrub: 88,
      countRock: 46,
      minY: 0.78,
      lowQuality,
    });
  }

  // 4. ゴール：星を映す入江の東屋 (Starlit Cove Pavilion & Open-Front Colonnade)
  // Terrace sits cleanly behind z = 180.7 so moored sailboat at (-5.2, 177.2) floats completely on water!
  _buildStarlitPavilion(mats, castShadow, lowQuality) {
    const g = new THREE.Group();
    const px = PAVILION_POS.x;
    const pz = PAVILION_POS.z;

    const terraceZ = pz - 1.5; // 188.5, front edge at z = 180.7
    const terrace = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 8.3, 1.35, 32), mats.stoneWall);
    terrace.position.set(px, 0.37, terraceZ);
    terrace.receiveShadow = castShadow;
    g.add(terrace);

    const terraceFloor = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6, 0.14, 32), mats.cobble);
    terraceFloor.position.set(px, 1.0, terraceZ);
    terraceFloor.receiveShadow = castShadow;
    g.add(terraceFloor);

    // Front-left stone landing jetty & steps beside moored sailboat (-5.2, 0, 177.2)
    const jetty = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.15, 3.6), mats.stoneWall);
    jetty.position.set(-1.6, 0.25, 180.3);
    jetty.receiveShadow = castShadow;
    g.add(jetty);
    const jettyTop = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.14, 3.4), mats.cobble);
    jettyTop.position.set(-1.6, 0.85, 180.3);
    jettyTop.receiveShadow = castShadow;
    g.add(jettyTop);

    // Mooring bollard on the landing jetty
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.5, 8), mats.stoneLight);
    bollard.position.set(-2.55, 1.12, 179.0);
    g.add(bollard);

    // Colonnade ring of white limestone columns (front -Z arc wide open for clear reunion shot)
    const colCount = 8;
    const colR = 5.4;
    for (let i = 0; i < colCount; i++) {
      const a = (i / colCount) * Math.PI * 2 + Math.PI / 8;
      if (Math.sin(a) < -0.35) continue;
      const colX = px + Math.cos(a) * colR;
      const colZ = terraceZ + Math.sin(a) * colR;

      const base = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.26, 0.78), mats.stoneLight);
      base.position.set(colX, 1.18, colZ);
      g.add(base);

      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.33, 4.2, 12), mats.plaster);
      col.position.set(colX, 3.35, colZ);
      col.castShadow = castShadow;
      g.add(col);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.26, 0.84), mats.stoneLight);
      cap.position.set(colX, 5.5, colZ);
      g.add(cap);

      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.34, 6), mats.lanternGlow.clone());
      lantern.position.set(colX * 0.92, 4.25, colZ - (colZ - terraceZ) * 0.08);
      g.add(lantern);
      this.lanternMats.push(lantern.material);
    }

    // Open ring beam & terracotta pavilion crown
    const ringBeam = new THREE.Mesh(new THREE.TorusGeometry(colR, 0.32, 8, 28), mats.plaster);
    ringBeam.rotation.x = Math.PI * 0.5;
    ringBeam.position.set(px, 5.75, terraceZ);
    g.add(ringBeam);

    const roofRing = new THREE.Mesh(new THREE.TorusGeometry(colR + 0.14, 0.42, 6, 28), mats.terracotta);
    roofRing.rotation.x = Math.PI * 0.5;
    roofRing.position.set(px, 6.12, terraceZ);
    roofRing.castShadow = castShadow;
    g.add(roofRing);

    // Hanging central brass beacon lantern visible across the sea from Harbor
    const mainLanternGroup = new THREE.Group();
    mainLanternGroup.position.set(px, 5.2, terraceZ - 1.2);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), mats.brass);
    chain.position.y = 0.45;
    mainLanternGroup.add(chain);
    const lCap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.2, 8), mats.brass);
    lCap.position.y = 0.15;
    mainLanternGroup.add(lCap);
    const mainLantern = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.44, 8), mats.lanternGlow.clone());
    mainLantern.position.y = -0.1;
    mainLanternGroup.add(mainLantern);
    g.add(mainLanternGroup);
    this.lanternMats.push(mainLantern.material);

    // Terracotta flower planters, amphorae & stone bench around terrace rear/sides
    for (const [tx, tz] of [[-4.2, terraceZ - 1.6], [4.3, terraceZ - 1.4], [4.0, terraceZ + 2.8]]) {
      const pot = makeTerracottaPlanter(mats, true);
      pot.position.set(tx, 1.04, tz);
      g.add(pot);
    }
    for (const [ax, az] of [[-3.4, terraceZ + 3.2], [3.2, terraceZ - 3.6]]) {
      const amp = makeAmphora(mats, 0.95);
      amp.position.set(ax, 1.04, az);
      g.add(amp);
    }
    const bench = makeStoneBench(mats);
    bench.position.set(-3.4, 1.04, terraceZ + 2.2);
    bench.rotation.y = 0.65;
    g.add(bench);

    // Cypress & olive trees framing the crescent cove behind the terrace
    [
      [-14, pz + 4, 6.8], [14, pz + 4, 6.6], [-21, pz - 3, 5.8], [21, pz - 3, 6.0],
      [-9, pz + 11, 7.2], [9, pz + 11, 7.0],
    ].forEach(([cx, cz, ch], idx) => {
      const cyp = makeCypress(mats, ch, castShadow, 500 + idx * 13);
      cyp.position.set(cx, Math.max(0.8, getGroundY(cx, cz)) - 0.1, cz);
      g.add(cyp);
    });
    [[-15, pz - 8], [15, pz - 8], [-19, pz + 5], [19, pz + 5]].forEach(([ox, oz], idx) => {
      const ot = makeOliveTree(mats, 1.15, castShadow, 560 + idx * 11);
      ot.position.set(ox, Math.max(0.8, getGroundY(ox, oz)) - 0.1, oz);
      g.add(ot);
    });

    // Warm lantern post at far-right edge of terrace so it lights the reunion without blocking camera
    const lp = makeLanternPost(mats, 2.35, this.lanternMats);
    lp.position.set(4.8, 1.04, terraceZ - 3.2);
    g.add(lp);

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
