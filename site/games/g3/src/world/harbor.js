import * as THREE from '../../lib/three.module.js';
import { PALETTE, SHELL_MAP_POS } from '../core/env.js';
import { mulberry32 } from '../core/math.js';
import { addBoxObstacle, addCircleObstacle, addObjectObstacle, resetObstacles } from './colliders.js';
import { getGroundY, getLandInfo, HARBOR_DECKS } from './terrain.js';
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
    resetObstacles();
    this.group = new THREE.Group();
    this.group.name = 'harbor';
    this.lanternMats = [];
    this.fishingBoats = [];

    const castShadow = !lowQuality;

    // 1. Non-overlapping stone quay, wing, jetty & breakwater top deck slabs (resting on terrain foundations)
    for (const dk of HARBOR_DECKS) {
      const mat = dk.name === 'promenade' ? mats.cobblePlaza : dk.name.startsWith('bw') ? mats.stoneWall : mats.cobble;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(dk.w, dk.deckThick, dk.d), mat);
      const topY = dk.topY - 0.005;
      slab.position.set(dk.x, topY - dk.deckThick * 0.5, dk.z);
      slab.receiveShadow = castShadow;
      this.group.add(slab);
      addBoxObstacle(dk.x, dk.z, dk.w, dk.d, 0, dk.baseBottom, dk.topY, 'deck', true);
    }

    // Breakwater beacon lantern seated cleanly at getGroundY(-10.8, -88.2) = 0.90
    const bwBeacon = makeLanternPost(mats, 3.0, this.lanternMats);
    bwBeacon.position.set(-10.8, getGroundY(-10.8, -88.2), -88.2);
    this.group.add(bwBeacon);
    addObjectObstacle(bwBeacon, 'lantern', 0.04, true);

    // Raised stone sea-edge coping curbs (non-overlapping, clear of houses, bollards & jetty mouth)
    for (const [cx, cz, cw, cd] of [
      [-9.5, -114.55, 11.6, 0.50], // x in [-15.3, -3.7]
      [-0.4, -114.55, 3.8, 0.50],  // x in [-2.3, 1.5]
      [10.2, -114.55, 7.2, 0.50],  // x in [6.6, 13.8]
      [-13.3, -106.8, 0.50, 14.0],
      [14.8, -106.8, 0.50, 14.0],
    ]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.24, cd), mats.stoneLight);
      curb.position.set(cx, 1.04 + 0.12, cz);
      curb.receiveShadow = castShadow;
      this.group.add(curb);
      addBoxObstacle(cx, cz, cw, cd, 0, 1.04, 1.28, 'curb', false);
    }

    // Mooring bollards (strictly clear of curbs, lanterns, clusters & jetty walkway)
    const bollardGeo = new THREE.CylinderGeometry(0.14, 0.20, 0.54, 8);
    for (const [bx, bz] of [
      [-13.9, -112.0], [-13.9, -104.5], [-7.8, -115.2], [-2.2, -115.2],
      [2.45, -110.5], [5.15, -108.5], [10.6, -115.2], [15.4, -111.5], [15.4, -102.0],
    ]) {
      const b = new THREE.Mesh(bollardGeo, mats.stone);
      b.position.set(bx, 1.04 + 0.27, bz);
      this.group.add(b);
      addCircleObstacle(bx, bz, 0.22, 1.04, 1.58, 'bollard');
    }

    // 2. Harbor plaza focal details (clear of girl, shell pedestal & stepping path)
    const basin = makeHarborBasin(mats);
    basin.position.set(-4.2, 1.04, -120.8);
    this.group.add(basin);
    addCircleObstacle(-4.2, -120.8, 1.56, 1.04, 2.0, 'prop');

    // Wooden pergola arbor on the left quay café terrace
    const arbor = new THREE.Group();
    arbor.position.set(-9.6, 1.04, -120.8);
    arbor.rotation.y = 0.20;
    for (const ax of [-1.5, 1.5]) {
      for (const az of [-1.0, 1.0]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.3, 7), mats.wood);
        post.position.set(ax, 1.15, az);
        arbor.add(post);
      }
    }
    for (let i = 0; i < 5; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 0.12), mats.woodLight);
      beam.position.set(0, 2.32, -1.0 + i * 0.5);
      arbor.add(beam);
    }
    for (const [vx, vz, vm] of [[-0.9, -0.3, mats.olive], [0.2, 0.2, mats.bougainvillea], [1.0, -0.1, mats.bougainvillea]]) {
      const vine = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 1), vm);
      vine.scale.set(1.35, 0.44, 1.05);
      vine.position.set(vx, 2.46, vz);
      arbor.add(vine);
    }
    this.group.add(arbor);
    addObjectObstacle(arbor, 'prop', 0.05);

    // 3. Wrap-around Mediterranean whitewashed houses (well-spaced, seated on flat terraces/plaza)
    const houseConfigs = [
      // Left wing
      { x: -21.8, z: -104.5, ry: Math.PI * 0.48, w: 3.8, d: 3.0, h: 3.2, balcony: true, door: mats.coralDoor },
      { x: -22.2, z: -116.5, ry: Math.PI * 0.32, w: 4.0, d: 3.2, h: 3.9, stairs: true, door: mats.bluePaint },
      // Right wing
      { x: 22.8, z: -105.0, ry: -Math.PI * 0.48, w: 3.8, d: 3.0, h: 3.3, balcony: true, door: mats.bluePaint },
      { x: 23.5, z: -116.8, ry: -Math.PI * 0.32, w: 4.0, d: 3.3, h: 4.0, stairs: true, door: mats.coralDoor },
      // Plaza back row
      { x: -7.2, z: -131.0, ry: 0.10, w: 4.4, d: 3.5, h: 3.4, balcony: true, pergola: true, door: mats.coralDoor },
      { x: -17.8, z: -128.5, ry: 0.22, w: 4.0, d: 3.2, h: 4.1, balcony: true, door: mats.bluePaint },
      { x: -28.0, z: -133.5, ry: 0.08, w: 4.2, d: 3.5, h: 3.7, stairs: true, door: mats.shutter },
      { x: 9.5, z: -131.0, ry: -0.14, w: 4.4, d: 3.5, h: 3.5, pergola: true, door: mats.bluePaint },
      { x: 20.2, z: -127.8, ry: -0.26, w: 4.0, d: 3.2, h: 4.3, balcony: true, door: mats.coralDoor },
      { x: 31.2, z: -133.5, ry: -0.12, w: 4.2, d: 3.5, h: 3.3, stairs: true, door: mats.wood },
      // Upper hillside tier
      { x: -22.2, z: -143.5, ry: 0.14, w: 4.4, d: 3.4, h: 3.8, balcony: true, door: mats.bluePaint },
      { x: -10.0, z: -142.8, ry: 0.06, w: 4.6, d: 3.6, h: 4.0, balcony: true, door: mats.coralDoor },
      { x: 3.0, z: -143.5, ry: -0.04, w: 4.2, d: 3.4, h: 4.4, stairs: true, door: mats.shutter },
      { x: 15.2, z: -142.5, ry: -0.14, w: 4.2, d: 3.4, h: 3.7, door: mats.bluePaint, annex: true },
      { x: 26.8, z: -144.2, ry: -0.20, w: 4.2, d: 3.4, h: 4.1, balcony: true, door: mats.coralDoor },
    ];
    for (const hc of houseConfigs) {
      const h = makeMediterraneanHouse(mats, {
        w: hc.w, d: hc.d, h: hc.h,
        balcony: !!hc.balcony, stairs: !!hc.stairs, pergola: !!hc.pergola, annex: !!hc.annex,
        doorMat: hc.door, castShadow,
      });
      const gy = getGroundY(hc.x, hc.z);
      h.position.set(hc.x, gy, hc.z);
      h.rotation.y = hc.ry;
      this.group.add(h);
      addObjectObstacle(h, 'building', 0.05);
    }

    // 4. Stone arches & hillside stairways (spaced clear of houses & arbor)
    const arch1 = makeStoneArch(mats, { span: 3.0, height: 3.2, depth: 1.0, castShadow });
    arch1.position.set(2.0, getGroundY(2.0, -130.0), -130.0);
    this.group.add(arch1);
    addBoxObstacle(0.14, -130.0, 0.72, 1.0, 0, 1.04, 4.3, 'arch');
    addBoxObstacle(3.86, -130.0, 0.72, 1.0, 0, 1.04, 4.3, 'arch');

    const arch2 = makeStoneArch(mats, { span: 2.4, height: 2.9, depth: 0.9, castShadow });
    arch2.position.set(-14.6, getGroundY(-14.6, -121.8), -121.8);
    arch2.rotation.y = 0.65;
    this.group.add(arch2);
    addObjectObstacle(arch2, 'arch', 0.04);

    const arch3 = makeStoneArch(mats, { span: 2.4, height: 2.9, depth: 0.9, castShadow });
    arch3.position.set(16.2, getGroundY(16.2, -120.2), -120.2);
    arch3.rotation.y = -0.58;
    this.group.add(arch3);
    addObjectObstacle(arch3, 'arch', 0.04);

    // Non-overlapping stone steps along hillside ramp (x = 2.0, z = -131.5 .. -136.4)
    for (let s = 0; s < 8; s++) {
      const sz = -131.5 - s * 0.70;
      const sy = getGroundY(2.0, sz);
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.24, 0.64), mats.stoneLight);
      step.position.set(2.0, sy + 0.06, sz);
      step.receiveShadow = castShadow;
      this.group.add(step);
      addBoxObstacle(2.0, sz, 2.6, 0.64, 0, sy - 0.06, sy + 0.18, 'stair');
    }

    // Dry-stone garden walls (clear of houses, trees & arches)
    for (const [wx, wz, ry, len] of [
      [-11.4, -124.0, 0.06, 3.2],
      [-14.6, -112.2, Math.PI * 0.48, 3.2],
      [16.8, -112.5, Math.PI * 0.52, 3.2],
      [12.2, -124.2, -0.08, 3.2],
    ]) {
      const wseg = makeStoneWallSegment(mats, len, 0.72);
      wseg.position.set(wx, getGroundY(wx, wz), wz);
      wseg.rotation.y = ry;
      this.group.add(wseg);
      addObjectObstacle(wseg, 'wall', 0.04);
    }

    // 5. Wordless blue mailbox
    const mailbox = new THREE.Group();
    const mbPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.05, 8), mats.wood);
    mbPost.position.y = 0.525;
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
    mailbox.position.set(-1.6, 1.04, -122.4);
    this.group.add(mailbox);
    addCircleObstacle(-1.6, -122.4, 0.34, 1.04, 2.45, 'prop');

    // 6. Open-air harbor fruit market stall (placed clear of curbs, lanterns & clusters)
    const market = new THREE.Group();
    market.position.set(10.2, 1.04, -120.6);
    market.rotation.y = -0.58;
    for (let s = 0; s < 2; s++) {
      const stall = new THREE.Group();
      stall.position.x = s * 2.75;
      const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.78, 1.05), mats.woodLight);
      table.position.y = 0.39;
      stall.add(table);
      for (const px of [-1.0, 1.0]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), mats.wood);
        p.position.set(px, 1.1, -0.45);
        stall.add(p);
      }
      for (let i = 0; i < 5; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, 0.05, 1.40),
          i % 2 === 0 ? mats.terracotta : mats.canvas
        );
        stripe.position.set(-0.92 + i * 0.46, 2.08, 0.05);
        stripe.rotation.x = 0.22;
        stall.add(stripe);
      }
      for (let c = 0; c < 3; c++) {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.44), mats.wood);
        crate.position.set(-0.65 + c * 0.65, 0.87, 0.05);
        stall.add(crate);
        const fMat = c === 0 ? mats.lemon : c === 1 ? mats.citrus : mats.olive;
        for (let k = 0; k < 4; k++) {
          const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 6), fMat);
          fruit.position.set(-0.73 + c * 0.65 + (k % 2) * 0.16, 0.98, -0.02 + Math.floor(k / 2) * 0.16);
          stall.add(fruit);
        }
      }
      market.add(stall);
    }
    this.group.add(market);
    addObjectObstacle(market, 'prop', 0.05);

    // 7. Olive trees, lemon trees & cypresses (verified clear of all houses, arches, walls & props)
    const oliveSpots = [
      [-15.8, -100.5, 0.90], [17.0, -100.5, 0.90],
      [-24.2, -122.2, 1.0], [6.8, -123.0, 0.88], [28.2, -122.0, 1.0],
      [-28.8, -142.0, 1.12], [22.4, -137.0, 1.05],
    ];
    oliveSpots.forEach(([tx, tz, ts], idx) => {
      const tree = makeOliveTree(mats, ts, castShadow, 100 + idx * 13);
      tree.position.set(tx, getGroundY(tx, tz), tz);
      this.group.add(tree);
      addObjectObstacle(tree, 'tree', 0.02);
    });

    const lemonSpots = [
      [-7.2, -118.2, 0.84], [15.4, -115.6, 0.86], [-0.4, -126.2, 0.84], [19.0, -109.6, 0.84],
    ];
    lemonSpots.forEach(([tx, tz, ts], idx) => {
      const tree = makeLemonTree(mats, ts, castShadow, 200 + idx * 17);
      tree.position.set(tx, getGroundY(tx, tz), tz);
      this.group.add(tree);
      addObjectObstacle(tree, 'tree', 0.02);
    });

    [
      [-23.2, -110.2, 5.0], [25.6, -110.5, 5.2], [-27.8, -126.2, 5.2],
      [-4.2, -146.5, 6.0], [9.5, -146.0, 5.8], [30.8, -127.0, 5.0],
    ].forEach(([cx, cz, ch], idx) => {
      const cyp = makeCypress(mats, ch, castShadow, 300 + idx * 19);
      cyp.position.set(cx, getGroundY(cx, cz), cz);
      this.group.add(cyp);
      addObjectObstacle(cyp, 'tree', 0.02);
    });

    // Terracotta flower planters & amphorae along quay & jetty (leaving wide center aisle on jetty)
    for (const [px, pz, sc] of [
      [-5.1, -115.6, 0.90], [-0.8, -115.8, 0.90], [6.2, -116.0, 0.92],
      [-14.8, -108.0, 0.92], [16.0, -109.5, 0.92], [-10.4, -117.6, 0.92],
      [2.55, -113.4, 0.72], [5.05, -113.4, 0.72],
    ]) {
      const pot = makeTerracottaPlanter(mats, true, sc);
      pot.position.set(px, getGroundY(px, pz), pz);
      this.group.add(pot);
      addObjectObstacle(pot, 'prop', 0.04);
    }

    for (const [ax, az, sc] of [
      [-5.6, -123.6, 0.92], [4.5, -121.2, 0.90], [13.2, -115.8, 0.92], [-14.2, -115.8, 0.92],
    ]) {
      const amp = makeAmphora(mats, sc);
      amp.position.set(ax, getGroundY(ax, az), az);
      this.group.add(amp);
      addObjectObstacle(amp, 'prop', 0.04);
    }

    // Stone benches on quay
    for (const [bx, bz, ry] of [[-6.8, -123.0, 0.22], [5.8, -118.8, -0.45]]) {
      const bench = makeStoneBench(mats);
      bench.position.set(bx, getGroundY(bx, bz), bz);
      bench.rotation.y = ry;
      this.group.add(bench);
      addObjectObstacle(bench, 'prop', 0.04);
    }

    // Drying net racks on left & right quay arms
    for (const [nx, nz, ry] of [[-16.2, -109.6, 1.35], [17.0, -106.4, -1.25]]) {
      const rack = makeDryingNetRack(mats);
      rack.position.set(nx, getGroundY(nx, nz), nz);
      rack.rotation.y = ry;
      this.group.add(rack);
      addObjectObstacle(rack, 'prop', 0.04);
    }

    // Bougainvillea shrubs grounded cleanly on plaza/wings (clear of houses & trees)
    for (const [bx, bz] of [[-4.2, -124.2], [-18.2, -122.8], [5.4, -124.6], [14.8, -123.2], [-16.0, -106.2], [18.2, -112.5]]) {
      const gy = getGroundY(bx, bz);
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.54, 1), mats.bougainvillea);
      b.scale.set(1.15, 0.8, 0.9);
      b.position.set(bx, gy + 0.42, bz);
      this.group.add(b);
      addObjectObstacle(b, 'prop', 0.04);
    }

    // 8. Harbor lanterns (clear of curbs, bollards, trees & props)
    for (const [lx, lz] of [
      [-14.2, -102.0], [-9.2, -115.6], [-1.5, -115.6], [7.2, -115.6], [15.4, -114.0], [15.8, -102.2],
    ]) {
      const post = makeLanternPost(mats, 2.5, this.lanternMats);
      post.position.set(lx, getGroundY(lx, lz), lz);
      this.group.add(post);
      addObjectObstacle(post, 'lantern', 0.04);
    }

    // 9. Nets, barrels, crates & citrus baskets along quay & jetty (clear of curbs, bollards & path)
    for (const [px, pz, ry] of [
      [-7.2, -116.8, 0.4], [-3.5, -116.6, -0.3], [0.8, -115.8, -0.5],
      [8.8, -116.6, 1.1], [-15.8, -104.2, 0.7], [16.8, -104.0, -0.8],
      [12.0, -114.2, 0.25],
    ]) {
      const cl = makeHarborPropsCluster(mats);
      cl.position.set(px, getGroundY(px, pz), pz);
      cl.rotation.y = ry;
      this.group.add(cl);
      addObjectObstacle(cl, 'prop', 0.04);
    }

    // Stepping flagstones along walking path (placed clear of props, pedestal & girl start)
    const rand = mulberry32(42);
    const flagstones = [];
    for (let s = 0; s < 6; s++) {
      const t = s / 5;
      const px = -0.3 + t * 3.8 + (rand() - 0.5) * 0.12;
      const pz = -124.2 + t * 8.0;
      if (Math.hypot(px - SHELL_MAP_POS.x, pz - SHELL_MAP_POS.z) < 1.75) continue;
      if (Math.hypot(px - 0.6, pz - (-120.8)) < 1.35) continue;
      flagstones.push([px, 1.06, pz, (rand() - 0.5) * 0.2, 0.85, 0.78]);
    }
    scatterFlagstones(this.group, flagstones, mats.stoneLight);

    // 10. Moored small wooden fishing boats gently bobbing in harbor (clear of sailboat berth & wings)
    const boatSpecs = [
      { x: -9.8, z: -102.5, ry: 0.35, color: mats.bluePaint },
      { x: -7.2, z: -108.5, ry: -0.18, color: mats.terracotta },
      { x: -3.2, z: -111.0, ry: 0.12, color: mats.shutter },
      { x: 12.6, z: -103.5, ry: -0.45, color: mats.shutter },
      { x: 12.2, z: -98.0, ry: -0.22, color: mats.bluePaint },
    ];
    for (const bs of boatSpecs) {
      const fb = makeFishingBoat(mats, bs.color);
      fb.position.set(bs.x, 0, bs.z);
      fb.rotation.y = bs.ry;
      fb.userData = { baseY: 0, phase: bs.x * 0.4, baseRz: 0 };
      this.group.add(fb);
      this.fishingBoats.push(fb);
      addCircleObstacle(bs.x, bs.z, 1.65, -0.5, 1.5, 'fishingBoat', true);
    }

    // 11. Glowing Seashell Map on carved stone pedestal at harbor edge
    this.shellPedestal = new THREE.Group();
    this.shellPedestal.position.set(SHELL_MAP_POS.x, getGroundY(SHELL_MAP_POS.x, SHELL_MAP_POS.z), SHELL_MAP_POS.z);
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

    // Wordless floating sparkle motes above the shell pedestal to draw a child's gaze gently
    this.shellMotes = [];
    const moteGeo = new THREE.SphereGeometry(0.045, 6, 5);
    this.shellMoteMat = new THREE.MeshBasicMaterial({
      color: 0xffdf9a,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(moteGeo, this.shellMoteMat);
      this.shellPedestal.add(m);
      this.shellMotes.push(m);
    }

    // Wordless warm stepping-light dots along the stone jetty leading to the sailboat
    this.jettyGuideDots = [];
    this.jettyGuideMat = new THREE.MeshBasicMaterial({
      color: 0xffd584,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dotGeo = new THREE.CircleGeometry(0.18, 16).rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const dot = new THREE.Mesh(dotGeo, this.jettyGuideMat);
      dot.position.set(3.8, 1.06, -114.2 + i * 1.9);
      this.group.add(dot);
      this.jettyGuideDots.push(dot);
    }

    this.group.add(this.shellPedestal);
    addCircleObstacle(SHELL_MAP_POS.x, SHELL_MAP_POS.z, 0.85, 1.04, 2.2, 'pedestal');

    // 12. Dense coastal grass tufts, wildflowers, scrub shrubs & pebbles on hillside (avoiding obstacles!)
    scatterCoastalFoliage(this.group, {
      centerX: 0,
      centerZ: -138,
      radiusX: 48,
      radiusZ: 22,
      getLand: getLandInfo,
      mats,
      seed: 103,
      countGrass: 520,
      countShrub: 76,
      countRock: 52,
      minY: 1.08,
      lowQuality,
    });
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
    for (const m of this.shellMotes) m.visible = false;
  }

  update(t, lanternLevel, showJettyGuide = false) {
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
      for (let i = 0; i < this.shellMotes.length; i++) {
        const u = (t * 0.45 + i / this.shellMotes.length) % 1;
        const a = t * 1.4 + i * 1.05;
        const rad = 0.28 + Math.sin(u * Math.PI) * 0.18;
        this.shellMotes[i].position.set(Math.cos(a) * rad, 0.95 + u * 0.95, Math.sin(a) * rad);
        this.shellMotes[i].scale.setScalar(Math.sin(u * Math.PI) * 1.1);
      }
    }
    if (this.jettyGuideMat) {
      const targetOp = showJettyGuide ? 0.52 : 0.16;
      this.jettyGuideMat.opacity += (targetOp - this.jettyGuideMat.opacity) * 0.08;
      for (let i = 0; i < this.jettyGuideDots.length; i++) {
        const wave = 0.82 + 0.28 * Math.sin(t * 2.8 - i * 0.85);
        this.jettyGuideDots[i].scale.setScalar(wave);
      }
    }
  }
}
