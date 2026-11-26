import * as THREE from '../../lib/three.module.js';
import { PALETTE, SHELL_MAP_POS } from '../core/env.js';
import { mulberry32 } from '../core/math.js';
import { getGroundY, getLandInfo } from './terrain.js';
import {
  makeAmphora,
  makeCypress,
  makeDryingNetRack,
  makeFishingBoat,
  makeHarborBasin,
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
  scatterFlagstones,
} from './props.js';

export class HarborTown {
  constructor(mats, { lowQuality = false } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'harbor';
    this.lanternMats = [];
    this.fishingBoats = [];

    const castShadow = !lowQuality;

    // 1. Stone quay seawall, cobble promenade & side quay wings embracing the harbor cove
    const quayWall = new THREE.Mesh(new THREE.BoxGeometry(62, 2.02, 4.5), mats.stoneWall);
    quayWall.position.set(0, -0.05, -116.5);
    quayWall.receiveShadow = castShadow;
    this.group.add(quayWall);

    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(11, 2.02, 18), mats.stoneWall);
    leftWing.position.set(-18.5, -0.02, -108.5);
    leftWing.receiveShadow = castShadow;
    this.group.add(leftWing);

    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(12, 2.02, 18), mats.stoneWall);
    rightWing.position.set(20.5, -0.02, -108.5);
    rightWing.receiveShadow = castShadow;
    this.group.add(rightWing);

    // Textured cobblestone quay promenade surface (top at y = 1.04, cleanly above quayWall & terrain)
    const promenade = new THREE.Mesh(new THREE.BoxGeometry(60, 0.28, 17.8), mats.cobblePlaza);
    promenade.position.set(0, 0.90, -124.1);
    promenade.receiveShadow = castShadow;
    this.group.add(promenade);

    // Cobble tops on side wings
    const leftWingTop = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.14, 17.8), mats.cobble);
    leftWingTop.position.set(-18.5, 1.02, -108.5);
    leftWingTop.receiveShadow = castShadow;
    this.group.add(leftWingTop);

    const rightWingTop = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.14, 17.8), mats.cobble);
    rightWingTop.position.set(20.5, 1.02, -108.5);
    rightWingTop.receiveShadow = castShadow;
    this.group.add(rightWingTop);

    // Raised stone sea-edge coping stones along quay
    for (const [cx, cz, cw, cd] of [
      [-12.5, -114.6, 11.5, 0.58],
      [0.1, -114.6, 5.2, 0.58],
      [12.5, -114.6, 11.5, 0.58],
      [-13.4, -106.5, 0.58, 14.0],
      [14.8, -106.5, 0.58, 14.0],
    ]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.26, cd), mats.stoneLight);
      curb.position.set(cx, 1.12, cz);
      curb.receiveShadow = castShadow;
      this.group.add(curb);
    }

    // Subtle organic stepping stones leading to seashell map & jetty
    const rand = mulberry32(42);
    const flagstones = [];
    for (let s = 0; s < 10; s++) {
      const t = s / 9;
      const px = -1.2 + t * 4.4 + (rand() - 0.5) * 0.22;
      const pz = -124.5 + t * 9.5;
      flagstones.push([px, 1.045, pz, (rand() - 0.5) * 0.25, 0.92 + rand() * 0.22, 0.85 + rand() * 0.2]);
    }
    for (const [fx, fz] of [
      [-6.5, -119.0], [-5.2, -121.0], [-3.2, -122.4], [5.8, -119.5], [7.8, -118.2],
    ]) {
      flagstones.push([fx, 1.045, fz, (rand() - 0.5) * 0.2, 1.05, 0.92]);
    }
    scatterFlagstones(this.group, flagstones, mats.stoneLight);

    // Stone jetty extending out to the waiting sailboat
    const jetty = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.45, 9.4), mats.stoneWall);
    jetty.position.set(3.8, 0.24, -112.0);
    jetty.receiveShadow = castShadow;
    this.group.add(jetty);

    const jettyTop = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.16, 9.2), mats.cobble);
    jettyTop.position.set(3.8, 0.98, -112.0);
    jettyTop.receiveShadow = castShadow;
    this.group.add(jettyTop);

    // 2. Outer stone breakwater on left side of harbor
    const bw1 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.5, 19), mats.stoneWall);
    bw1.position.set(-22, 0.15, -96);
    bw1.receiveShadow = castShadow;
    this.group.add(bw1);
    const bw2 = new THREE.Mesh(new THREE.BoxGeometry(12, 1.5, 3.4), mats.stoneWall);
    bw2.position.set(-16, 0.15, -88);
    bw2.receiveShadow = castShadow;
    this.group.add(bw2);
    const bwBeacon = makeLanternPost(mats, 3.0, this.lanternMats);
    bwBeacon.position.set(-10.8, 0.85, -88);
    this.group.add(bwBeacon);

    // Mooring bollards along quay, wings, and jetty
    const bollardGeo = new THREE.CylinderGeometry(0.14, 0.20, 0.54, 8);
    for (const [bx, bz] of [
      [-13.0, -112.0], [-13.0, -104.5], [-7.5, -114.6], [-2.0, -114.6],
      [2.5, -110.5], [5.1, -108.5], [9.5, -114.6], [15.2, -111.5], [15.2, -103.5],
    ]) {
      const b = new THREE.Mesh(bollardGeo, mats.stone);
      b.position.set(bx, 1.24, bz);
      this.group.add(b);
    }

    // 3. Harbor plaza focal details filling foreground & center cleanly (never blocking girl or shell map!)
    const basin = makeHarborBasin(mats);
    basin.position.set(-3.2, 1.04, -120.2);
    this.group.add(basin);

    // Wooden pergola arbor framing the left quay café terrace
    const arbor = new THREE.Group();
    arbor.position.set(-9.2, 1.0, -121.2);
    arbor.rotation.y = 0.24;
    for (const ax of [-1.6, 1.6]) {
      for (const az of [-1.1, 1.1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.3, 7), mats.wood);
        post.position.set(ax, 1.15, az);
        arbor.add(post);
      }
    }
    for (let i = 0; i < 5; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 0.12), mats.woodLight);
      beam.position.set(0, 2.32, -1.1 + i * 0.55);
      arbor.add(beam);
    }
    for (const [vx, vz, vm] of [[-0.9, -0.3, mats.olive], [0.2, 0.2, mats.bougainvillea], [1.1, -0.1, mats.bougainvillea]]) {
      const vine = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), vm);
      vine.scale.set(1.4, 0.45, 1.1);
      vine.position.set(vx, 2.46, vz);
      arbor.add(vine);
    }
    this.group.add(arbor);

    // 4. Wrap-around Mediterranean whitewashed houses (left wing, right wing, and tiered hillside)
    const houseConfigs = [
      { x: -19.2, z: -108.5, ry: Math.PI * 0.48, w: 4.8, d: 3.8, h: 3.3, balcony: true, pergola: true, door: mats.coralDoor, annex: true },
      { x: -19.6, z: -116.0, ry: Math.PI * 0.35, w: 4.6, d: 3.8, h: 4.0, stairs: true, door: mats.bluePaint },
      { x: 20.6, z: -109.2, ry: -Math.PI * 0.48, w: 4.6, d: 3.8, h: 3.4, balcony: true, pergola: true, door: mats.bluePaint, annex: true },
      { x: 21.4, z: -116.8, ry: -Math.PI * 0.34, w: 4.8, d: 4.0, h: 4.1, stairs: true, door: mats.coralDoor },
      { x: -7.0, z: -127.8, ry: 0.15, w: 5.0, d: 4.2, h: 3.4, balcony: true, stairs: true, pergola: true, door: mats.coralDoor },
      { x: -15.5, z: -126.5, ry: 0.28, w: 4.4, d: 3.8, h: 4.2, balcony: true, door: mats.bluePaint },
      { x: -24.0, z: -133.0, ry: 0.12, w: 5.4, d: 4.4, h: 3.8, stairs: true, door: mats.shutter, annex: true },
      { x: 10.5, z: -128.5, ry: -0.2, w: 4.8, d: 4.0, h: 3.5, pergola: true, door: mats.bluePaint },
      { x: 18.2, z: -126.0, ry: -0.35, w: 4.2, d: 3.6, h: 4.4, balcony: true, door: mats.coralDoor },
      { x: 26.0, z: -133.5, ry: -0.15, w: 5.2, d: 4.2, h: 3.3, stairs: true, door: mats.wood },
      // Upper hillside tier
      { x: -18.5, z: -138.0, ry: 0.18, w: 5.2, d: 4.2, h: 3.8, balcony: true, door: mats.bluePaint },
      { x: -11.0, z: -139.5, ry: 0.08, w: 5.6, d: 4.4, h: 4.0, balcony: true, door: mats.coralDoor },
      { x: 2.5, z: -141.0, ry: -0.05, w: 4.8, d: 4.0, h: 4.5, stairs: true, door: mats.shutter },
      { x: 15.5, z: -140.0, ry: -0.18, w: 5.0, d: 4.2, h: 3.7, door: mats.bluePaint, annex: true },
      { x: 25.0, z: -142.0, ry: -0.22, w: 4.6, d: 3.8, h: 4.1, balcony: true, door: mats.coralDoor },
    ];
    for (const hc of houseConfigs) {
      const h = makeMediterraneanHouse(mats, {
        w: hc.w, d: hc.d, h: hc.h,
        balcony: !!hc.balcony, stairs: !!hc.stairs, pergola: !!hc.pergola, annex: !!hc.annex,
        doorMat: hc.door, castShadow,
      });
      const gy = Math.max(0.95, getGroundY(hc.x, hc.z));
      h.position.set(hc.x, gy - 0.15, hc.z);
      h.rotation.y = hc.ry;
      this.group.add(h);
    }

    // 5. Stone arches & hillside stairways
    const arch1 = makeStoneArch(mats, { span: 3.0, height: 3.2, depth: 1.0, castShadow });
    arch1.position.set(2.0, 0.9, -129.5);
    this.group.add(arch1);

    const arch2 = makeStoneArch(mats, { span: 2.6, height: 2.9, depth: 0.95, castShadow });
    arch2.position.set(-14.0, 0.9, -120.5);
    arch2.rotation.y = 0.65;
    this.group.add(arch2);

    const arch3 = makeStoneArch(mats, { span: 2.6, height: 2.9, depth: 0.95, castShadow });
    arch3.position.set(16.0, 0.9, -119.0);
    arch3.rotation.y = -0.58;
    this.group.add(arch3);

    for (let s = 0; s < 8; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.34, 0.68), mats.stoneLight);
      step.position.set(2.0, 0.98 + s * 0.28, -131.5 - s * 0.62);
      this.group.add(step);
    }

    // Dry-stone garden walls framing the harbor edge
    for (const [wx, wz, ry, len] of [
      [-10.2, -120.8, 0.08, 4.4],
      [-15.0, -112.5, Math.PI * 0.48, 3.6],
      [15.8, -113.0, Math.PI * 0.52, 3.6],
      [10.2, -121.0, -0.1, 4.0],
    ]) {
      const wseg = makeStoneWallSegment(mats, len, 0.72);
      wseg.position.set(wx, 0.96, wz);
      wseg.rotation.y = ry;
      this.group.add(wseg);
    }

    // 6. Wordless blue mailbox (zero text or numbers)
    const mailbox = new THREE.Group();
    const mbPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.05, 8), mats.wood);
    mbPost.position.y = 0.52;
    mailbox.add(mbPost);
    const mbBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.3), mats.bluePaint);
    mbBox.position.y = 1.08;
    mbBox.castShadow = castShadow;
    mailbox.add(mbBox);
    const mbTop = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 10, 1, false, 0, Math.PI), mats.bluePaint);
    mbTop.rotation.z = Math.PI * 0.5;
    mbTop.rotation.y = Math.PI * 0.5;
    mbTop.position.y = 1.25;
    mailbox.add(mbTop);
    const mbSlot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.32), mats.plaster);
    mbSlot.position.y = 1.13;
    mailbox.add(mbSlot);
    mailbox.position.set(-2.2, 1.04, -121.6);
    this.group.add(mailbox);

    // 7. Open-air harbor fruit market stall (framing right side of initial harbor view)
    const market = new THREE.Group();
    market.position.set(9.4, 1.04, -117.0);
    market.rotation.y = -0.68;
    for (let s = 0; s < 2; s++) {
      const stall = new THREE.Group();
      stall.position.x = s * 2.9;
      const table = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.78, 1.1), mats.woodLight);
      table.position.y = 0.39;
      stall.add(table);
      for (const px of [-1.05, 1.05]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), mats.wood);
        p.position.set(px, 1.1, -0.48);
        stall.add(p);
      }
      for (let i = 0; i < 5; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.48, 0.05, 1.45),
          i % 2 === 0 ? mats.terracotta : mats.canvas
        );
        stripe.position.set(-0.96 + i * 0.48, 2.08, 0.05);
        stripe.rotation.x = 0.22;
        stall.add(stripe);
      }
      for (let c = 0; c < 3; c++) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.46), mats.wood);
        crate.position.set(-0.68 + c * 0.68, 0.87, 0.05);
        stall.add(crate);
        const fMat = c === 0 ? mats.lemon : c === 1 ? mats.citrus : mats.olive;
        for (let k = 0; k < 4; k++) {
          const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.085, 7, 6), fMat);
          fruit.position.set(-0.76 + c * 0.68 + (k % 2) * 0.16, 0.98, -0.02 + Math.floor(k / 2) * 0.16);
          stall.add(fruit);
        }
      }
      market.add(stall);
    }
    this.group.add(market);

    // 8. Olive trees, lemon trees, cypresses, terracotta planters, amphorae, benches & drying nets
    const oliveSpots = [
      [-15.2, -115.2, 1.05], [-16.2, -104.2, 0.95], [16.5, -105.0, 1.0],
      [-20.5, -123.5, 1.15], [7.2, -121.6, 0.95], [22.5, -121.0, 1.1],
      [-18.0, -138.0, 1.25], [21.0, -138.0, 1.2],
    ];
    oliveSpots.forEach(([tx, tz, ts], idx) => {
      const tree = makeOliveTree(mats, ts, castShadow, 100 + idx * 13);
      tree.position.set(tx, Math.max(0.95, getGroundY(tx, tz)) - 0.1, tz);
      this.group.add(tree);
    });

    const lemonSpots = [
      [-6.2, -118.2, 0.88], [14.8, -114.2, 0.9], [-2.8, -124.4, 0.9], [16.5, -123.5, 0.92],
    ];
    lemonSpots.forEach(([tx, tz, ts], idx) => {
      const tree = makeLemonTree(mats, ts, castShadow, 200 + idx * 17);
      tree.position.set(tx, Math.max(0.95, getGroundY(tx, tz)) - 0.1, tz);
      this.group.add(tree);
    });

    [
      [-25, -112, 5.2], [25, -110, 5.4], [-26, -126, 5.4], [-5, -145, 6.2], [9, -144, 5.8], [28, -128, 5.2],
    ].forEach(([cx, cz, ch], idx) => {
      const cyp = makeCypress(mats, ch, castShadow, 300 + idx * 19);
      cyp.position.set(cx, Math.max(0.95, getGroundY(cx, cz)) - 0.1, cz);
      this.group.add(cyp);
    });

    // Terracotta flower planters & amphorae along quay, basin & jetty
    for (const [px, pz, sc] of [
      [-5.8, -116.2, 1.0], [-1.0, -116.0, 0.95], [5.8, -116.0, 1.0],
      [-14.2, -110.2, 1.05], [15.5, -109.5, 1.0], [-10.5, -118.5, 1.0],
      [2.8, -115.6, 0.88], [4.9, -115.6, 0.88],
    ]) {
      const pot = makeTerracottaPlanter(mats, true, sc);
      pot.position.set(px, 1.04, pz);
      this.group.add(pot);
    }

    for (const [ax, az, sc] of [
      [-5.2, -120.2, 1.0], [5.5, -120.6, 0.92], [11.8, -115.8, 1.05], [-13.6, -114.6, 0.95],
    ]) {
      const amp = makeAmphora(mats, sc);
      amp.position.set(ax, 1.04, az);
      this.group.add(amp);
    }

    // Stone benches on quay
    for (const [bx, bz, ry] of [[-7.2, -117.4, 0.22], [5.8, -119.2, -0.45]]) {
      const bench = makeStoneBench(mats);
      bench.position.set(bx, 1.04, bz);
      bench.rotation.y = ry;
      this.group.add(bench);
    }

    // Drying net racks on left & right quay arms
    for (const [nx, nz, ry] of [[-15.2, -108.0, 1.35], [16.8, -107.2, -1.25]]) {
      const rack = makeDryingNetRack(mats);
      rack.position.set(nx, 1.02, nz);
      rack.rotation.y = ry;
      this.group.add(rack);
    }

    // Bougainvillea clusters
    for (const [bx, bz] of [[-5.0, -124.8], [-13.2, -124.8], [8.8, -125.8], [16.2, -124.2], [-15.8, -109.8], [16.8, -111.5]]) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.68, 1), mats.bougainvillea);
      b.scale.set(1.25, 0.85, 0.95);
      b.position.set(bx, 1.5, bz);
      this.group.add(b);
    }

    // 9. Harbor lanterns
    for (const [lx, lz] of [
      [-13.2, -102.0], [-9.2, -115.6], [-1.8, -115.6], [7.2, -115.6], [15.0, -114.6], [15.0, -102.5],
    ]) {
      const post = makeLanternPost(mats, 2.5, this.lanternMats);
      post.position.set(lx, 1.04, lz);
      this.group.add(post);
    }

    // 10. Nets, barrels, crates & citrus baskets along quay & jetty
    for (const [px, pz, ry] of [
      [-6.8, -115.8, 0.4], [-3.0, -115.6, -0.3], [1.6, -114.6, -0.5],
      [9.4, -115.8, 1.1], [-14.2, -105.5, 0.7], [15.8, -104.8, -0.8],
      [3.8, -113.4, 0.25],
    ]) {
      const cl = makeHarborPropsCluster(mats);
      cl.position.set(px, 1.04, pz);
      cl.rotation.y = ry;
      this.group.add(cl);
    }

    // 11. Moored small wooden fishing boats gently bobbing in harbor (clear of sailboat berth)
    const boatSpecs = [
      { x: -9.8, z: -102.5, ry: 0.35, color: mats.bluePaint },
      { x: -7.2, z: -108.5, ry: -0.18, color: mats.terracotta },
      { x: -4.2, z: -111.4, ry: 0.12, color: mats.shutter },
      { x: 11.4, z: -106.5, ry: -0.45, color: mats.shutter },
      { x: 12.2, z: -100.5, ry: -0.22, color: mats.bluePaint },
    ];
    for (const bs of boatSpecs) {
      const fb = makeFishingBoat(mats, bs.color);
      fb.position.set(bs.x, 0, bs.z);
      fb.rotation.y = bs.ry;
      fb.userData = { baseY: 0, phase: bs.x * 0.4, baseRz: 0 };
      this.group.add(fb);
      this.fishingBoats.push(fb);
    }

    // 12. Dense coastal grass tufts, wildflowers, scrub shrubs & pebbles on hillside & wings
    scatterCoastalFoliage(this.group, {
      centerX: 0,
      centerZ: -136,
      radiusX: 48,
      radiusZ: 24,
      getLand: getLandInfo,
      mats,
      seed: 103,
      countGrass: 520,
      countShrub: 76,
      countRock: 52,
      minY: 1.05,
      lowQuality,
    });

    // 13. Glowing Seashell Map on carved stone pedestal at harbor edge
    this.shellPedestal = new THREE.Group();
    this.shellPedestal.position.set(SHELL_MAP_POS.x, 1.04, SHELL_MAP_POS.z);
    const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.16, 10), mats.stone);
    pedBase.position.y = 0.08;
    this.shellPedestal.add(pedBase);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.56, 10), mats.stoneLight);
    ped.position.y = 0.40;
    this.shellPedestal.add(ped);

    this.shellMap = this._buildSeashellMap(mats);
    this.shellMap.position.y = 0.84;
    this.shellPedestal.add(this.shellMap);

    this.shellRing = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.78, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffcf7a, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
    );
    this.shellRing.position.y = 0.04;
    this.shellPedestal.add(this.shellRing);
    this.group.add(this.shellPedestal);
  }

  _buildSeashellMap(mats) {
    const g = new THREE.Group();
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xf6ebd8,
      emissive: 0xe69d38,
      emissiveIntensity: 0.58,
      roughness: 0.32,
    });
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.14, 0.08, 9, 1, false, -Math.PI * 0.4, Math.PI * 0.8), shellMat);
    lower.scale.set(1.15, 1, 1.0);
    g.add(lower);

    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.14, 0.06, 9, 1, false, -Math.PI * 0.4, Math.PI * 0.8), shellMat);
    upper.position.set(0, 0.16, -0.16);
    upper.rotation.x = -0.82;
    g.add(upper);

    const dotMat = new THREE.MeshBasicMaterial({ color: PALETTE.lantern });
    for (const [ix, iz, r] of [[-0.1, 0.03, 0.038], [0.1, -0.01, 0.042], [-0.05, -0.08, 0.036], [0.02, -0.16, 0.048]]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, 0.025, 7), dotMat);
      m.position.set(ix, 0.055, iz);
      g.add(m);
    }
    return g;
  }

  hideShellMapOnPedestal() {
    this.shellMap.visible = false;
    this.shellRing.visible = false;
  }

  update(t, lanternLevel) {
    for (const lm of this.lanternMats) {
      lm.emissiveIntensity = 0.5 + lanternLevel * 1.65;
    }
    for (const fb of this.fishingBoats) {
      const p = fb.userData.phase;
      fb.position.y = Math.sin(t * 1.35 + p) * 0.07;
      fb.rotation.z = Math.sin(t * 1.1 + p) * 0.035;
      fb.rotation.x = Math.cos(t * 0.9 + p) * 0.025;
    }
    if (this.shellMap.visible) {
      this.shellMap.position.y = 0.84 + Math.sin(t * 2.2) * 0.05;
      this.shellMap.rotation.y = Math.sin(t * 0.9) * 0.22;
      const pulse = 1.0 + 0.12 * Math.sin(t * 3.0);
      this.shellRing.scale.set(pulse, 1, pulse);
    }
  }
}
