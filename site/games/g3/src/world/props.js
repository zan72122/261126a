import * as THREE from '../../lib/three.module.js';
import { PALETTE, shared } from '../core/env.js';
import { mulberry32 } from '../core/math.js';
import { isSpotClear } from './colliders.js';

export function createMaterials(textures = null, { lowQuality = false } = {}) {
  const nm = (t, sx = 0.6, sy = 0.6) =>
    t && !lowQuality ? { normalMap: t, normalScale: new THREE.Vector2(sx, sy) } : {};
  const mp = (t) => (t ? { map: t } : {});

  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xd9e3c6, // Multiplied by per-instance natural olive/sage/gold colors
    roughness: 0.88,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });
  // Gentle sea-breeze grass sway in vertex shader
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         vec4 instOrigin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
         float hFactor = clamp(position.y / 0.45, 0.0, 1.0);
         float sway = sin(uTime * 2.1 + instOrigin.x * 0.45 + instOrigin.z * 0.35) * 0.075 * hFactor * hFactor;
         transformed.x += sway;
         transformed.z += sway * 0.45;
       #endif`
    );
  };

  return {
    plaster: new THREE.MeshStandardMaterial({
      color: PALETTE.plaster,
      roughness: 0.86,
      metalness: 0.02,
      ...mp(textures?.plasterMap),
      ...nm(textures?.plasterNorm, 0.42, 0.42),
    }),
    plasterWarm: new THREE.MeshStandardMaterial({
      color: PALETTE.plasterWarm,
      roughness: 0.88,
      metalness: 0.02,
      ...mp(textures?.plasterMap),
      ...nm(textures?.plasterNorm, 0.45, 0.45),
    }),
    terracotta: new THREE.MeshStandardMaterial({
      color: 0xdfb29e, // Tinted with tileMap kiln terracotta hues
      roughness: 0.76,
      metalness: 0.04,
      ...mp(textures?.tileMap),
      ...nm(textures?.tileNorm, 0.85, 0.85),
    }),
    terracottaDark: new THREE.MeshStandardMaterial({
      color: 0xc1836c,
      roughness: 0.80,
      metalness: 0.04,
      ...mp(textures?.tileMap),
      ...nm(textures?.tileNorm, 0.8, 0.8),
    }),
    cobble: new THREE.MeshStandardMaterial({
      color: 0xdad2c4,
      roughness: 0.88,
      metalness: 0.03,
      ...mp(textures?.cobbleMap),
      ...nm(textures?.cobbleNorm, 0.95, 0.95),
    }),
    cobblePlaza: new THREE.MeshStandardMaterial({
      color: 0xdcd4c6,
      roughness: 0.88,
      metalness: 0.03,
      ...mp(textures?.cobblePlazaMap),
      ...nm(textures?.cobblePlazaNorm, 0.95, 0.95),
    }),
    stoneWall: new THREE.MeshStandardMaterial({
      color: 0xc2bbb0,
      roughness: 0.9,
      metalness: 0.03,
      ...mp(textures?.stoneWallMap),
      ...nm(textures?.stoneWallNorm, 0.85, 0.85),
    }),
    stone: new THREE.MeshStandardMaterial({
      color: 0xb6afa3,
      roughness: 0.9,
      metalness: 0.03,
      ...mp(textures?.cobbleMap),
      ...nm(textures?.stoneNorm, 0.8, 0.8),
    }),
    stoneLight: new THREE.MeshStandardMaterial({
      color: 0xd0c9bc,
      roughness: 0.86,
      metalness: 0.02,
      ...mp(textures?.plasterMap),
      ...nm(textures?.stoneNorm, 0.55, 0.55),
    }),
    wood: new THREE.MeshStandardMaterial({
      color: 0xb08462,
      roughness: 0.8,
      metalness: 0.04,
      ...mp(textures?.woodMap),
      ...nm(textures?.woodNorm, 0.7, 0.7),
    }),
    woodLight: new THREE.MeshStandardMaterial({
      color: 0xd2ab84,
      roughness: 0.78,
      metalness: 0.04,
      ...mp(textures?.woodMap),
      ...nm(textures?.woodNorm, 0.65, 0.65),
    }),
    olive: new THREE.MeshStandardMaterial({
      color: PALETTE.olive,
      roughness: 0.88,
      metalness: 0.02,
      ...nm(textures?.plasterNorm, 0.35, 0.35),
    }),
    oliveLight: new THREE.MeshStandardMaterial({
      color: PALETTE.oliveLight,
      roughness: 0.88,
      metalness: 0.02,
      ...nm(textures?.plasterNorm, 0.35, 0.35),
    }),
    oliveSage: new THREE.MeshStandardMaterial({
      color: 0x7b8f64,
      roughness: 0.88,
      metalness: 0.02,
    }),
    cypress: new THREE.MeshStandardMaterial({
      color: PALETTE.cypress,
      roughness: 0.88,
      metalness: 0.02,
      ...nm(textures?.plasterNorm, 0.3, 0.3),
    }),
    grass: grassMat,
    shutter: new THREE.MeshStandardMaterial({
      color: PALETTE.shutterOlive,
      roughness: 0.76,
      metalness: 0.04,
      ...nm(textures?.woodNorm, 0.4, 0.4),
    }),
    coralDoor: new THREE.MeshStandardMaterial({
      color: PALETTE.coral,
      roughness: 0.72,
      metalness: 0.05,
      ...nm(textures?.woodNorm, 0.35, 0.35),
    }),
    bluePaint: new THREE.MeshStandardMaterial({
      color: PALETTE.mailboxBlue,
      roughness: 0.65,
      metalness: 0.08,
      ...nm(textures?.woodNorm, 0.3, 0.3),
    }),
    bougainvillea: new THREE.MeshStandardMaterial({ color: PALETTE.bougainvillea, roughness: 0.78, metalness: 0.02 }),
    flowerInstance: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.74, metalness: 0.02 }),
    lemon: new THREE.MeshStandardMaterial({ color: PALETTE.lemon, roughness: 0.55, metalness: 0.04 }),
    citrus: new THREE.MeshStandardMaterial({ color: PALETTE.citrus, roughness: 0.58, metalness: 0.04 }),
    canvas: new THREE.MeshStandardMaterial({
      color: 0xf7f1e3,
      roughness: 0.84,
      metalness: 0.01,
      side: THREE.DoubleSide,
      ...mp(textures?.sailMap),
      ...nm(textures?.sailNorm, 0.4, 0.4),
    }),
    rope: new THREE.MeshStandardMaterial({ color: 0xb89f78, roughness: 0.92 }),
    windowGlow: new THREE.MeshStandardMaterial({
      color: 0xffe4b2,
      emissive: 0xffb85c,
      emissiveIntensity: 0.55,
      roughness: 0.35,
    }),
    lanternGlow: new THREE.MeshStandardMaterial({
      color: 0xfff0c8,
      emissive: 0xffc060,
      emissiveIntensity: 1.35,
      roughness: 0.2,
    }),
    brass: new THREE.MeshStandardMaterial({ color: 0x8f6b3a, roughness: 0.40, metalness: 0.68 }),
    waterPool: new THREE.MeshStandardMaterial({ color: 0x1d4375, roughness: 0.14, metalness: 0.35 }),
  };
}

export function makeMediterraneanHouse(mats, {
  w = 4.2,
  d = 3.6,
  h = 3.1,
  roofH = 1.15,
  doorMat = mats.coralDoor,
  shutterMat = mats.shutter,
  balcony = false,
  stairs = false,
  pergola = false,
  annex = false,
  castShadow = true,
} = {}) {
  const g = new THREE.Group();

  // Stone foundation plinth (bottom flush at local y = 0.0)
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.32, 0.50, d + 0.32), mats.stone);
  plinth.position.y = 0.25;
  plinth.receiveShadow = castShadow;
  g.add(plinth);

  // Main whitewash plaster body
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.plaster);
  body.position.y = 0.50 + h * 0.5;
  body.castShadow = castShadow;
  body.receiveShadow = castShadow;
  g.add(body);

  // Subtle corner stone quoins on front corners
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const quoin = new THREE.Mesh(new THREE.BoxGeometry(0.18, h * 0.96, 0.18), mats.stoneLight);
      quoin.position.set(sx * (w * 0.5 - 0.05), 0.48 + h * 0.5, sz * (d * 0.5 - 0.05));
      g.add(quoin);
    }
  }

  // Timber eaves cornice under roof
  const eave = new THREE.Mesh(new THREE.BoxGeometry(w + 0.28, 0.13, d + 0.28), mats.wood);
  eave.position.y = 0.48 + h;
  g.add(eave);

  // Terracotta tiled hipped roof + clay ridge cap
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * 0.57, roofH, 4), mats.terracotta);
  roof.rotation.y = Math.PI * 0.25;
  roof.scale.set((w / Math.hypot(w, d)) * 1.56, 1, (d / Math.hypot(w, d)) * 1.56);
  roof.position.y = 0.48 + h + roofH * 0.48;
  roof.castShadow = castShadow;
  g.add(roof);

  // Chimney with clay pot crown
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.92, 0.42), mats.plasterWarm);
  chim.position.set(w * 0.28, 0.48 + h + roofH * 0.65, -d * 0.22);
  g.add(chim);
  const chimCap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.54), mats.terracottaDark);
  chimCap.position.set(w * 0.28, 0.48 + h + roofH * 0.65 + 0.48, -d * 0.22);
  g.add(chimCap);

  // Front doorway (+Z face) with stone architrave & threshold step
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.06, 1.80, 0.14), mats.stoneLight);
  doorFrame.position.set(0, 0.48 + 0.9, d * 0.5 + 0.01);
  g.add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.68, 0.16), doorMat);
  door.position.set(0, 0.48 + 0.84, d * 0.5 + 0.03);
  g.add(door);
  const doorArch = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.16, 12, 1, false, 0, Math.PI), doorMat);
  doorArch.rotation.x = Math.PI * 0.5;
  doorArch.rotation.z = Math.PI * 0.5;
  doorArch.position.set(0, 0.48 + 1.68, d * 0.5 + 0.03);
  g.add(doorArch);

  // Glowing windows with wooden shutters, mullions, and flower sill boxes
  const addWindow = (wx, wy, wz, ry, withFlowers = false) => {
    const wg = new THREE.Group();
    wg.position.set(wx, wy, wz);
    wg.rotation.y = ry;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.86, 0.08), mats.windowGlow);
    wg.add(pane);
    const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.86, 0.1), mats.wood);
    wg.add(mullionV);
    const mullionH = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.1), mats.wood);
    wg.add(mullionH);
    for (const side of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.88, 0.07), shutterMat);
      sh.position.set(side * 0.49, 0, 0.03);
      wg.add(sh);
    }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.1, 0.2), mats.stoneLight);
    sill.position.set(0, -0.46, 0.06);
    wg.add(sill);
    if (withFlowers) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 0.2), mats.terracotta);
      box.position.set(0, -0.35, 0.14);
      wg.add(box);
      for (let b = -1; b <= 1; b++) {
        const bloom = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.12, 0),
          b === 0 ? mats.bougainvillea : mats.oliveLight
        );
        bloom.position.set(b * 0.18, -0.22 + (b === 0 ? 0.03 : 0), 0.16);
        wg.add(bloom);
      }
    }
    g.add(wg);
  };

  if (w >= 3.4) {
    addWindow(-w * 0.28, 0.48 + h * 0.63, d * 0.5 + 0.02, 0, true);
    addWindow(w * 0.28, 0.48 + h * 0.63, d * 0.5 + 0.02, 0, false);
  } else {
    addWindow(0, 0.48 + h * 0.68, d * 0.5 + 0.02, 0, true);
  }
  addWindow(w * 0.5 + 0.02, 0.48 + h * 0.58, 0, Math.PI * 0.5, false);
  addWindow(-w * 0.5 - 0.02, 0.48 + h * 0.58, 0, -Math.PI * 0.5, false);

  if (balcony) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w * 0.66, 0.14, 0.95), mats.stoneLight);
    deck.position.set(0, 0.48 + h * 0.48, d * 0.5 + 0.44);
    g.add(deck);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.66, 0.08, 0.08), mats.wood);
    rail.position.set(0, 0.48 + h * 0.48 + 0.52, d * 0.5 + 0.86);
    g.add(rail);
    for (let i = -2; i <= 2; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.06), mats.wood);
      post.position.set(i * (w * 0.14), 0.48 + h * 0.48 + 0.26, d * 0.5 + 0.86);
      g.add(post);
    }
  }

  if (stairs) {
    for (let s = 0; s < 5; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.26, 0.46), mats.stoneLight);
      step.position.set(w * 0.5 + 0.48, 0.13 + s * 0.26, -d * 0.35 + s * 0.38);
      g.add(step);
    }
  }

  if (pergola) {
    const pg = new THREE.Group();
    pg.position.set(0, 0.48, d * 0.5 + 1.0);
    for (const sx of [-w * 0.38, w * 0.38]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8), mats.wood);
      col.position.set(sx, 1.1, 0.85);
      pg.add(col);
    }
    for (let i = 0; i < 4; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.09, 0.12), mats.woodLight);
      beam.position.set(0, 2.22, -0.5 + i * 0.48);
      pg.add(beam);
    }
    const vineClusters = [
      [-w * 0.22, 2.34, 0.2, 0.52, mats.olive],
      [0.05, 2.38, 0.42, 0.48, mats.bougainvillea],
      [w * 0.22, 2.32, 0.12, 0.42, mats.bougainvillea],
    ];
    for (const [vx, vy, vz, vr, vm] of vineClusters) {
      const vine = new THREE.Mesh(new THREE.IcosahedronGeometry(vr, 1), vm);
      vine.scale.set(1.4, 0.52, 1.1);
      vine.position.set(vx, vy, vz);
      pg.add(vine);
    }
    g.add(pg);
  }

  if (annex) {
    const aw = w * 0.52;
    const ad = d * 0.58;
    const ah = h * 0.68;
    const abody = new THREE.Mesh(new THREE.BoxGeometry(aw, ah, ad), mats.plasterWarm);
    abody.position.set(-w * 0.5 - aw * 0.45, 0.48 + ah * 0.5, -d * 0.12);
    abody.castShadow = castShadow;
    abody.receiveShadow = castShadow;
    g.add(abody);
    const aroof = new THREE.Mesh(new THREE.BoxGeometry(aw + 0.25, 0.18, ad + 0.25), mats.terracotta);
    aroof.position.set(-w * 0.5 - aw * 0.45, 0.48 + ah + 0.09, -d * 0.12);
    aroof.rotation.z = 0.14;
    g.add(aroof);
  }

  return g;
}

export function makeStoneArch(mats, { span = 3.2, height = 3.4, depth = 1.1, castShadow = true } = {}) {
  const g = new THREE.Group();
  const pillarW = 0.72;
  const half = span * 0.5 + pillarW * 0.5;
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(pillarW, height * 0.72, depth), mats.plasterWarm);
    p.position.set(s * half, height * 0.36, 0);
    p.castShadow = castShadow;
    p.receiveShadow = castShadow;
    g.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(pillarW + 0.14, 0.16, depth + 0.14), mats.stoneLight);
    cap.position.set(s * half, height * 0.72, 0);
    g.add(cap);
  }
  const segs = 7;
  const r = span * 0.5 + pillarW * 0.35;
  for (let i = 0; i < segs; i++) {
    const a = (i / (segs - 1)) * Math.PI;
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, depth * 1.02), mats.plaster);
    block.position.set(Math.cos(a) * r, height * 0.72 + Math.sin(a) * (r * 0.62), 0);
    block.rotation.z = a - Math.PI * 0.5;
    block.castShadow = castShadow;
    g.add(block);
  }
  return g;
}

export function makeOliveTree(mats, scale = 1, castShadow = true, seed = 17) {
  const g = new THREE.Group();
  const rand = mulberry32(seed);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.25, 1.45, 7), mats.wood);
  trunk.position.y = 0.76;
  trunk.rotation.z = 0.09;
  trunk.castShadow = castShadow;
  g.add(trunk);

  for (const [bx, by, bz, rz, rx] of [
    [0.28, 1.42, 0.08, -0.52, 0.14],
    [-0.26, 1.38, -0.1, 0.48, -0.18],
  ]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.88, 6), mats.wood);
    b.position.set(bx, by, bz);
    b.rotation.set(rx, 0, rz);
    g.add(b);
  }

  // Organic multi-cluster Mediterranean olive foliage (varied scale, tilt & silver-green hue)
  const clusters = [
    [0.0, 2.08, 0.0, 0.92, 0.52, 0.88],
    [-0.68, 1.88, 0.32, 0.72, 0.45, 0.66],
    [0.70, 1.94, -0.24, 0.74, 0.46, 0.70],
    [0.14, 2.42, 0.22, 0.64, 0.42, 0.60],
    [-0.32, 2.28, -0.45, 0.62, 0.40, 0.58],
    [0.44, 1.72, 0.48, 0.58, 0.38, 0.56],
    [-0.48, 1.76, -0.28, 0.56, 0.38, 0.54],
  ];
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  clusters.forEach(([px, py, pz, sx, sy, sz], i) => {
    const mat = i % 3 === 0 ? mats.olive : i % 3 === 1 ? mats.oliveLight : mats.oliveSage;
    const c = new THREE.Mesh(crownGeo, mat);
    c.position.set(px + (rand() - 0.5) * 0.12, py + (rand() - 0.5) * 0.08, pz + (rand() - 0.5) * 0.12);
    c.rotation.set(rand() * 0.5, rand() * Math.PI, rand() * 0.5);
    c.scale.set(sx, sy, sz);
    c.castShadow = castShadow;
    c.receiveShadow = castShadow;
    g.add(c);
  });
  g.scale.setScalar(scale);
  return g;
}

export function makeLemonTree(mats, scale = 1, castShadow = true, seed = 29) {
  const g = new THREE.Group();
  const rand = mulberry32(seed);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 1.15, 7), mats.wood);
  trunk.position.y = 0.585;
  trunk.castShadow = castShadow;
  g.add(trunk);

  const crownGeo = new THREE.IcosahedronGeometry(0.68, 1);
  const crownSpecs = [
    [0, 1.68, 0, 1.05, 0.86, 1.02],
    [-0.45, 1.56, 0.28, 0.72, 0.62, 0.7],
    [0.48, 1.62, -0.22, 0.74, 0.64, 0.72],
    [0.12, 1.98, 0.18, 0.65, 0.58, 0.65],
  ];
  crownSpecs.forEach(([cx, cy, cz, sx, sy, sz], i) => {
    const c = new THREE.Mesh(crownGeo, i % 2 === 0 ? mats.olive : mats.oliveLight);
    c.position.set(cx, cy, cz);
    c.rotation.set(rand() * 0.4, rand() * Math.PI, rand() * 0.4);
    c.scale.set(sx, sy, sz);
    c.castShadow = castShadow;
    g.add(c);
  });

  const fGeo = new THREE.SphereGeometry(0.105, 7, 6);
  const fruitPts = [
    [0.64, 1.62, 0.46], [-0.58, 1.72, 0.50], [0.22, 2.08, -0.54],
    [-0.42, 1.42, -0.52], [0.74, 1.84, -0.20], [0.06, 1.52, 0.76], [-0.15, 1.92, 0.56],
  ];
  for (const [fx, fy, fz] of fruitPts) {
    const f = new THREE.Mesh(fGeo, mats.lemon);
    f.position.set(fx, fy, fz);
    f.scale.set(1.0, 1.18, 1.0);
    g.add(f);
  }
  g.scale.setScalar(scale);
  return g;
}

export function makeCypress(mats, h = 5.2, castShadow = true, seed = 41) {
  const g = new THREE.Group();
  const rand = mulberry32(seed);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.19, 1.0, 6), mats.wood);
  trunk.position.y = 0.5;
  g.add(trunk);

  // Slender tapered Mediterranean cypress spires with subtle asymmetric foliage tufts
  const mainSpire = new THREE.Mesh(new THREE.ConeGeometry(0.68, h, 9), mats.cypress);
  mainSpire.position.y = 0.8 + h * 0.5;
  mainSpire.castShadow = castShadow;
  mainSpire.receiveShadow = castShadow;
  g.add(mainSpire);

  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    const subH = h * (0.48 - t * 0.12);
    const subR = (0.56 - t * 0.14) * (0.9 + rand() * 0.16);
    const ang = rand() * Math.PI * 2;
    const sub = new THREE.Mesh(new THREE.ConeGeometry(subR, subH, 7), i % 2 === 0 ? mats.cypress : mats.olive);
    sub.position.set(Math.cos(ang) * 0.16, 1.1 + t * h * 0.52 + subH * 0.35, Math.sin(ang) * 0.16);
    sub.rotation.z = (rand() - 0.5) * 0.08;
    sub.castShadow = castShadow;
    g.add(sub);
  }
  return g;
}

export function makeLanternPost(mats, height = 2.6, registerGlow = null) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.28, 7), mats.brass);
  base.position.y = 0.14;
  g.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.075, height, 7), mats.brass);
  post.position.y = height * 0.5;
  g.add(post);
  const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.1, 6), mats.brass);
  bracket.position.y = height - 0.08;
  g.add(bracket);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.17, 6), mats.brass);
  cap.position.y = height + 0.24;
  g.add(cap);

  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.28, 6), mats.lanternGlow.clone());
  glass.position.y = height + 0.06;
  g.add(glass);
  if (registerGlow) registerGlow.push(glass.material);
  return g;
}

export function makeTerracottaPlanter(mats, withFlowers = true, scale = 1.0) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.21, 0.48, 10), mats.terracotta);
  pot.position.y = 0.24;
  g.add(pot);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.04, 6, 12).rotateX(Math.PI * 0.5), mats.terracottaDark);
  rim.position.y = 0.48;
  g.add(rim);
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.33, 1), mats.oliveLight);
  bush.position.y = 0.64;
  bush.scale.set(1.12, 0.78, 1.05);
  g.add(bush);
  if (withFlowers) {
    for (let i = 0; i < 5; i++) {
      const a = i * 1.25 + 0.3;
      const fl = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.095, 0),
        i % 3 === 0 ? mats.bougainvillea : i % 3 === 1 ? mats.citrus : mats.coralDoor
      );
      fl.position.set(Math.cos(a) * 0.23, 0.72 + (i % 2) * 0.08, Math.sin(a) * 0.23);
      g.add(fl);
    }
  }
  g.scale.setScalar(scale);
  return g;
}

// Tall terracotta amphora vase for Mediterranean quay corners
export function makeAmphora(mats, scale = 1.0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), mats.terracotta);
  body.scale.set(1, 1.45, 1);
  body.position.y = 0.36;
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.26, 9), mats.terracottaDark);
  neck.position.y = 0.72;
  g.add(neck);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 10).rotateX(Math.PI * 0.5), mats.terracotta);
  lip.position.y = 0.85;
  g.add(lip);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 5, 8, Math.PI), mats.terracottaDark);
    h.rotation.z = s * Math.PI * 0.5;
    h.position.set(s * 0.21, 0.58, 0);
    g.add(h);
  }
  g.scale.setScalar(scale);
  return g;
}

// Low octagonal limestone harbor basin / fountain for quay plaza focal detail (no obstruction)
export function makeHarborBasin(mats) {
  const g = new THREE.Group();
  const curb = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.54, 0.44, 8), mats.stoneLight);
  curb.position.y = 0.22;
  g.add(curb);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 0.46, 8), mats.waterPool);
  inner.position.y = 0.23;
  g.add(inner);
  const centerPed = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.68, 8), mats.stone);
  centerPed.position.y = 0.34;
  g.add(centerPed);
  const urn = makeTerracottaPlanter(mats, true, 0.72);
  urn.position.y = 0.64;
  g.add(urn);
  return g;
}

export function makeStoneBench(mats) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.14, 0.55), mats.stoneLight);
  slab.position.y = 0.44;
  g.add(slab);
  for (const sx of [-0.62, 0.62]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.46), mats.stone);
    leg.position.set(sx, 0.19, 0);
    g.add(leg);
  }
  return g;
}

export function makeDryingNetRack(mats) {
  const g = new THREE.Group();
  for (const sx of [-1.15, 1.15]) {
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.66, 6), mats.wood);
    p1.position.set(sx, 0.85, -0.2);
    p1.rotation.x = 0.22;
    g.add(p1);
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.66, 6), mats.wood);
    p2.position.set(sx, 0.85, 0.2);
    p2.rotation.x = -0.22;
    g.add(p2);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.6, 6), mats.woodLight);
  bar.rotation.z = Math.PI * 0.5;
  bar.position.y = 1.48;
  g.add(bar);
  const net = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.05, 0.18), mats.rope);
  net.position.set(0, 0.94, 0.05);
  net.rotation.x = 0.08;
  g.add(net);
  for (let i = -3; i <= 3; i++) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 5), mats.citrus);
    fl.position.set(i * 0.3, 1.48, 0.08);
    g.add(fl);
  }
  return g;
}

export function makeStoneWallSegment(mats, length = 3.2, height = 0.75) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(length, height, 0.55), mats.stone);
  wall.position.y = height * 0.5;
  g.add(wall);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(length + 0.08, 0.12, 0.64), mats.stoneLight);
  cap.position.y = height + 0.04;
  g.add(cap);
  return g;
}

export function makeBoatHullShape(halfBeam = 0.85, halfLen = 2.4) {
  const s = new THREE.Shape();
  s.moveTo(0, halfLen);
  s.quadraticCurveTo(halfBeam * 0.95, halfLen * 0.45, halfBeam, 0);
  s.quadraticCurveTo(halfBeam * 0.82, -halfLen * 0.72, 0.36, -halfLen);
  s.lineTo(-0.36, -halfLen);
  s.quadraticCurveTo(-halfBeam * 0.82, -halfLen * 0.72, -halfBeam, 0);
  s.quadraticCurveTo(-halfBeam * 0.95, halfLen * 0.45, 0, halfLen);
  return s;
}

export function makeFishingBoat(mats, colorMat = mats.bluePaint) {
  const g = new THREE.Group();
  const shape = makeBoatHullShape(0.68, 1.95);
  const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.48, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
  hullGeo.rotateX(-Math.PI * 0.5);
  hullGeo.rotateY(Math.PI);
  const hull = new THREE.Mesh(hullGeo, mats.plaster);
  hull.position.y = -0.08;
  g.add(hull);

  const stripeGeo = new THREE.ExtrudeGeometry(makeBoatHullShape(0.7, 1.97), { depth: 0.12, bevelEnabled: false });
  stripeGeo.rotateX(-Math.PI * 0.5);
  stripeGeo.rotateY(Math.PI);
  const stripe = new THREE.Mesh(stripeGeo, colorMat);
  stripe.position.y = 0.24;
  g.add(stripe);

  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.07, 0.38), mats.woodLight);
  bench.position.set(0, 0.42, 0.25);
  g.add(bench);
  const bench2 = bench.clone();
  bench2.position.z = -0.75;
  g.add(bench2);
  return g;
}

export function makeHarborPropsCluster(mats) {
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.68, 10), mats.wood);
  barrel.position.set(0, 0.34, 0);
  g.add(barrel);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.018, 5, 12).rotateX(Math.PI * 0.5), mats.brass);
  hoop.position.set(0, 0.52, 0);
  g.add(hoop);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.38, 0.44), mats.woodLight);
  crate.position.set(-0.55, 0.19, -0.32);
  crate.rotation.y = 0.25;
  g.add(crate);
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.34, 9), mats.woodLight);
  basket.position.set(0.68, 0.17, 0.25);
  g.add(basket);
  for (let i = 0; i < 4; i++) {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), i % 2 === 0 ? mats.citrus : mats.lemon);
    orb.position.set(0.6 + (i % 2) * 0.15, 0.36, 0.18 + Math.floor(i / 2) * 0.14);
    g.add(orb);
  }
  const net = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.11, 7, 14), mats.rope);
  net.rotation.x = Math.PI * 0.5;
  net.position.set(-0.58, 0.11, 0.32);
  g.add(net);
  return g;
}

// Multi-blade curved Mediterranean coastal grass tuft (5 blades, tapered & tilted)
function makeGrassTuftGeometry() {
  const pos = [];
  const blades = [
    { angle: 0.1, tilt: 0.18, h: 0.44, w: 0.052 },
    { angle: 1.35, tilt: 0.22, h: 0.36, w: 0.048 },
    { angle: 2.55, tilt: 0.19, h: 0.48, w: 0.054 },
    { angle: 3.85, tilt: 0.24, h: 0.38, w: 0.046 },
    { angle: 5.10, tilt: 0.16, h: 0.41, w: 0.050 },
  ];
  for (const b of blades) {
    const ca = Math.cos(b.angle);
    const sa = Math.sin(b.angle);
    const lx = -sa * b.w;
    const lz = ca * b.w;
    const midX = ca * b.tilt * 0.35;
    const midZ = sa * b.tilt * 0.35;
    const tipX = ca * b.tilt;
    const tipZ = sa * b.tilt;
    // Lower quad (2 tris) + upper tip tri for natural curve
    pos.push(
      -lx, 0, -lz,
      lx, 0, lz,
      midX + lx * 0.48, b.h * 0.54, midZ + lz * 0.48,

      -lx, 0, -lz,
      midX + lx * 0.48, b.h * 0.54, midZ + lz * 0.48,
      midX - lx * 0.48, b.h * 0.54, midZ - lz * 0.48,

      midX - lx * 0.48, b.h * 0.54, midZ - lz * 0.48,
      midX + lx * 0.48, b.h * 0.54, midZ + lz * 0.48,
      tipX, b.h, tipZ
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

export function scatterCoastalFoliage(group, {
  centerX,
  centerZ,
  radiusX,
  radiusZ,
  getLand,
  mats,
  seed = 101,
  countGrass = 380,
  countShrub = 56,
  countRock = 44,
  minY = 0.80,
  lowQuality = false,
} = {}) {
  const rand = mulberry32(seed);
  const dummy = new THREE.Object3D();
  const tmpCol = new THREE.Color();

  // 1. Multi-blade grass tufts with organic clumping & per-instance color variation (never a uniform grid!)
  const nGrass = lowQuality ? Math.floor(countGrass * 0.42) : countGrass;
  const bladeGeo = makeGrassTuftGeometry();
  const grassIM = new THREE.InstancedMesh(bladeGeo, mats.grass, nGrass);
  const grassTones = [
    new THREE.Color(0x5c7249),
    new THREE.Color(0x748c58),
    new THREE.Color(0x8c8f56), // Sun-warmed dry coastal grass
    new THREE.Color(0x4b633c),
  ];

  let gi = 0;
  let clumpX = centerX;
  let clumpZ = centerZ;
  for (let attempt = 0; attempt < nGrass * 6 && gi < nGrass; attempt++) {
    // Cluster 65% of tufts in natural irregular patches
    if (attempt % 4 === 0 || rand() < 0.35) {
      clumpX = centerX + (rand() * 2 - 1) * radiusX;
      clumpZ = centerZ + (rand() * 2 - 1) * radiusZ;
    }
    const x = clumpX + (rand() - 0.5) * 3.4;
    const z = clumpZ + (rand() - 0.5) * 3.4;
    const info = getLand(x, z);
    if (info.y < minY || !isSpotClear(x, z, 0.42)) continue;
    dummy.position.set(x, info.y - 0.02, z);
    dummy.rotation.set((rand() - 0.5) * 0.16, rand() * Math.PI * 2, (rand() - 0.5) * 0.16);
    const s = 0.68 + rand() * 1.05;
    dummy.scale.set(s * (0.85 + rand() * 0.35), s * (0.75 + rand() * 0.65), s * (0.85 + rand() * 0.35));
    dummy.updateMatrix();
    grassIM.setMatrixAt(gi, dummy.matrix);
    const tA = grassTones[Math.floor(rand() * grassTones.length)];
    tmpCol.copy(tA).offsetHSL((rand() - 0.5) * 0.04, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.08);
    grassIM.setColorAt(gi, tmpCol);
    gi++;
  }
  grassIM.count = gi;
  grassIM.instanceMatrix.needsUpdate = true;
  if (grassIM.instanceColor) grassIM.instanceColor.needsUpdate = true;
  group.add(grassIM);

  // 2. Irregular Mediterranean scrub bushes (maquis/rosemary) + multi-hue wildflowers
  const nShrub = lowQuality ? Math.floor(countShrub * 0.5) : countShrub;
  const shrubGeo = new THREE.IcosahedronGeometry(0.42, 1);
  const shrubMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.02 });
  const shrubIM = new THREE.InstancedMesh(shrubGeo, shrubMat, nShrub);
  const flowerPts = [];
  let si = 0;
  for (let attempt = 0; attempt < nShrub * 8 && si < nShrub; attempt++) {
    const x = centerX + (rand() * 2 - 1) * radiusX * 0.94;
    const z = centerZ + (rand() * 2 - 1) * radiusZ * 0.94;
    const info = getLand(x, z);
    if (info.y < minY + 0.05 || !isSpotClear(x, z, 0.85)) continue;
    dummy.position.set(x, info.y + 0.06, z);
    dummy.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
    const sx = 0.72 + rand() * 1.05;
    const sy = 0.44 + rand() * 0.46;
    const sz = sx * (0.72 + rand() * 0.5);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    shrubIM.setMatrixAt(si, dummy.matrix);
    tmpCol.setHex(si % 2 === 0 ? PALETTE.olive : PALETTE.oliveLight).offsetHSL(
      (rand() - 0.5) * 0.05,
      (rand() - 0.5) * 0.08,
      (rand() - 0.5) * 0.08
    );
    shrubIM.setColorAt(si, tmpCol);
    si++;
    if (rand() < 0.75) {
      const countFl = 2 + Math.floor(rand() * 3);
      for (let f = 0; f < countFl; f++) {
        flowerPts.push([
          x + (rand() - 0.5) * 0.55 * sx,
          info.y + 0.16 * sy + 0.05,
          z + (rand() - 0.5) * 0.55 * sz,
        ]);
      }
    }
  }
  shrubIM.count = si;
  shrubIM.instanceMatrix.needsUpdate = true;
  if (shrubIM.instanceColor) shrubIM.instanceColor.needsUpdate = true;
  group.add(shrubIM);

  // Additional scattered wildflowers across grass slopes
  const extraFl = lowQuality ? 18 : 48;
  for (let attempt = 0; attempt < extraFl * 5 && flowerPts.length < 180; attempt++) {
    const x = centerX + (rand() * 2 - 1) * radiusX * 0.9;
    const z = centerZ + (rand() * 2 - 1) * radiusZ * 0.9;
    const info = getLand(x, z);
    if (info.y < minY + 0.05 || !isSpotClear(x, z, 0.35)) continue;
    flowerPts.push([x, info.y + 0.10 + rand() * 0.05, z]);
  }

  if (flowerPts.length > 0) {
    const flGeo = new THREE.IcosahedronGeometry(0.085, 0);
    const flIM = new THREE.InstancedMesh(flGeo, mats.flowerInstance, flowerPts.length);
    const flColors = [
      new THREE.Color(PALETTE.bougainvillea),
      new THREE.Color(PALETTE.coral),
      new THREE.Color(PALETTE.citrus),
      new THREE.Color(0xf2ece0), // Wild white chamomile
    ];
    flowerPts.forEach(([fx, fy, fz], idx) => {
      dummy.position.set(fx, fy, fz);
      dummy.rotation.set(rand() * 1.2, rand() * 3.1, rand() * 1.2);
      dummy.scale.set(0.75 + rand() * 0.65, 0.55 + rand() * 0.45, 0.75 + rand() * 0.65);
      dummy.updateMatrix();
      flIM.setMatrixAt(idx, dummy.matrix);
      tmpCol.copy(flColors[Math.floor(rand() * flColors.length)]).offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.08);
      flIM.setColorAt(idx, tmpCol);
    });
    flIM.instanceMatrix.needsUpdate = true;
    if (flIM.instanceColor) flIM.instanceColor.needsUpdate = true;
    group.add(flIM);
  }

  // 3. Limestone rocks & beach pebbles with color variation
  const nRock = lowQuality ? Math.floor(countRock * 0.55) : countRock;
  const rockGeo = new THREE.DodecahedronGeometry(0.36, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.03,
  });
  const rockIM = new THREE.InstancedMesh(rockGeo, rockMat, nRock);
  let ri = 0;
  for (let attempt = 0; attempt < nRock * 7 && ri < nRock; attempt++) {
    const x = centerX + (rand() * 2 - 1) * radiusX * 0.95;
    const z = centerZ + (rand() * 2 - 1) * radiusZ * 0.95;
    const info = getLand(x, z);
    if (info.y < 0.28 || !isSpotClear(x, z, 0.75)) continue;
    dummy.position.set(x, info.y + 0.02, z);
    dummy.rotation.set(rand() * 2, rand() * 3, rand() * 2);
    const sx = 0.55 + rand() * 1.15;
    const sy = 0.34 + rand() * 0.52;
    dummy.scale.set(sx, sy, sx * (0.68 + rand() * 0.46));
    dummy.updateMatrix();
    rockIM.setMatrixAt(ri, dummy.matrix);
    tmpCol.setHex(ri % 2 === 0 ? PALETTE.stone : PALETTE.stoneLight).offsetHSL(0, 0, (rand() - 0.5) * 0.1);
    rockIM.setColorAt(ri, tmpCol);
    ri++;
  }
  rockIM.count = ri;
  rockIM.instanceMatrix.needsUpdate = true;
  if (rockIM.instanceColor) rockIM.instanceColor.needsUpdate = true;
  group.add(rockIM);
}

// Instanced limestone flagstones with subtle height/tint variation
export function scatterFlagstones(group, spots, mat) {
  if (!spots.length) return;
  const geo = new THREE.BoxGeometry(1.25, 0.05, 1.05);
  const im = new THREE.InstancedMesh(geo, mat, spots.length);
  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  const rand = mulberry32(773);
  spots.forEach(([x, y, z, ry, sx, sz], i) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(sx, 1, sz);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    c.setHex(0xffffff).offsetHSL(0, 0, (rand() - 0.5) * 0.12);
    im.setColorAt(i, c);
  });
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.receiveShadow = true;
  group.add(im);
}
