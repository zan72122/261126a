// Provençal village architecture, tactile stone/tile/wood/linen materials,
// sky/glint/lantern-reflective river & fountain water, enriched landing meadow
// (stone walls, handcart, baskets, villager), and cohesive Clock Tower Square.
import * as THREE from '../../lib/three.module.js';
import { PALETTE } from '../core/palette.js';
import {
  makeLimestoneTextures,
  makeRoofTileTextures,
  makePlazaCobbleTextures,
  makeWoodTextures,
  makeWickerTextures,
  makeLinenBumpTexture,
  makeAwningTexture,
} from '../core/textures.js';
import { SUN_DIR } from './sky.js';
import { LANDMARKS, terrainHeight, riverCenterZ, WATER_Y } from './terrain.js';
import { makeVillager } from '../chars/recipient.js';

export function buildVillage(lowQuality = false) {
  const root = new THREE.Group();
  root.name = 'village';

  const limestoneTex = makeLimestoneTextures();
  const roofTex = makeRoofTileTextures();
  const cobbleTex = makePlazaCobbleTextures();
  const woodTex = makeWoodTextures();
  const wickerTex = makeWickerTextures();
  const linenBump = makeLinenBumpTexture(4, 4);
  const awningApricotTex = makeAwningTexture('#e89e6c');
  const awningTurqTex = makeAwningTexture('#4aa8a6');

  const matStone = new THREE.MeshStandardMaterial({
    color: PALETTE.cream,
    map: limestoneTex.map,
    bumpMap: limestoneTex.bumpMap,
    bumpScale: lowQuality ? 0 : 0.035,
    roughness: 0.88,
  });
  const matStoneWarm = new THREE.MeshStandardMaterial({
    color: PALETTE.limestone,
    map: limestoneTex.map,
    bumpMap: limestoneTex.bumpMap,
    bumpScale: lowQuality ? 0 : 0.04,
    roughness: 0.90,
  });
  const matStoneTrim = new THREE.MeshStandardMaterial({
    color: PALETTE.limestoneShadow,
    bumpMap: limestoneTex.bumpMap,
    bumpScale: lowQuality ? 0 : 0.025,
    roughness: 0.92,
  });
  const matCobble = new THREE.MeshStandardMaterial({
    color: PALETTE.creamWarm,
    map: cobbleTex.map,
    bumpMap: cobbleTex.bumpMap,
    bumpScale: lowQuality ? 0 : 0.035,
    roughness: 0.91,
  });
  const matRoof = new THREE.MeshStandardMaterial({
    color: PALETTE.roofTile,
    map: roofTex.map,
    bumpMap: roofTex.bumpMap,
    bumpScale: lowQuality ? 0 : 0.045,
    roughness: 0.82,
  });
  const matRoofWarm = new THREE.MeshStandardMaterial({
    color: PALETTE.roofTileWarm,
    map: roofTex.map,
    bumpMap: roofTex.bumpMap,
    bumpScale: lowQuality ? 0 : 0.045,
    roughness: 0.82,
  });
  const matTurquoise = new THREE.MeshStandardMaterial({
    color: PALETTE.turquoise,
    bumpMap: woodTex.bumpMap,
    bumpScale: lowQuality ? 0 : 0.015,
    roughness: 0.62,
    metalness: 0.04,
  });
  const matApricot = new THREE.MeshStandardMaterial({
    color: PALETTE.apricot,
    bumpMap: woodTex.bumpMap,
    bumpScale: lowQuality ? 0 : 0.015,
    roughness: 0.65,
    metalness: 0.04,
  });
  const matWood = new THREE.MeshStandardMaterial({
    color: PALETTE.woodWarm,
    map: woodTex.map,
    bumpMap: woodTex.bumpMap,
    bumpScale: lowQuality ? 0 : 0.028,
    roughness: 0.84,
  });
  const matWicker = new THREE.MeshStandardMaterial({
    color: 0xdcb98a,
    map: wickerTex.map,
    bumpMap: wickerTex.bumpMap,
    bumpScale: lowQuality ? 0 : 0.032,
    roughness: 0.86,
  });
  const matIron = new THREE.MeshStandardMaterial({ color: 0x4b5358, roughness: 0.50, metalness: 0.56 });
  const matGlassWarm = new THREE.MeshStandardMaterial({
    color: 0xf6e6c4,
    emissive: 0xf0c98d,
    emissiveIntensity: 0.36,
    roughness: 0.28,
  });
  const matLavender = new THREE.MeshStandardMaterial({ color: PALETTE.lavender, roughness: 0.85 });
  const matOlive = new THREE.MeshStandardMaterial({ color: PALETTE.oliveLeaf, roughness: 0.86 });
  const matTerracotta = new THREE.MeshStandardMaterial({ color: 0xc98b66, roughness: 0.82 });

  // Reflective water shader (Fresnel sky reflection + sun glints + warm lantern/dawn-starlight shimmer)
  const waterUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: SUN_DIR.clone() },
    uZenith: { value: new THREE.Color(0x6da9d4) },
    uHorizon: { value: new THREE.Color(0xd7e9f2) },
    uDeep: { value: new THREE.Color(0x5f95ac) },
    uFoam: { value: new THREE.Color(PALETTE.cream) },
    uLamp: { value: new THREE.Color(PALETTE.apricotSoft) },
  };
  const riverMat = new THREE.ShaderMaterial({
    toneMapped: true,
    uniforms: waterUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorldPos = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uDeep;
      uniform vec3 uFoam;
      uniform vec3 uLamp;
      varying vec3 vWorldPos;

      void main() {
        vec2 p = vWorldPos.xz;
        float w1 = sin(p.x * 0.55 + uTime * 1.35 + sin(p.y * 0.72) * 1.4);
        float w2 = cos(p.y * 0.92 - uTime * 1.05 + p.x * 0.31);
        float w3 = sin((p.x + p.y) * 1.65 + uTime * 1.9);
        vec3 N = normalize(vec3((w1 + w3 * 0.45) * 0.075, 1.0, (w2 - w3 * 0.45) * 0.075));

        vec3 V = normalize(cameraPosition - vWorldPos);
        float ndv = max(dot(N, V), 0.0);
        float fresnel = 0.08 + 0.92 * pow(1.0 - ndv, 3.6);

        vec3 R = reflect(-V, N);
        vec3 skyRefl = mix(uHorizon, uZenith, pow(max(R.y, 0.0), 0.55));

        // Morning sun specular sparkle & soft warm horizon halo
        vec3 H = normalize(uSunDir + V);
        float sunCore = pow(max(dot(N, H), 0.0), 320.0) * 1.5;
        float sunSheen = pow(max(dot(R, uSunDir), 0.0), 22.0) * 0.35;

        // Subtle warm village lantern & dawn-starlight shimmer on water crests
        float twinkle = pow(max(0.5 + 0.5 * w1 * w2 + 0.3 * w3, 0.0), 6.0);
        float starGlint = smoothstep(0.76, 0.98, sin(p.x * 3.1 + uTime * 2.2) * cos(p.y * 2.9 - uTime * 1.7));

        vec3 col = mix(uDeep, skyRefl, clamp(fresnel + 0.25, 0.0, 1.0));
        col += uFoam * (sunCore + sunSheen * 0.6);
        col += uLamp * (twinkle * 0.14 + starGlint * 0.22);

        gl_FragColor = vec4(col, 0.89);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
  });

  function enableCast(obj) {
    if (lowQuality) return;
    obj.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });
  }

  function makeBench() {
    const b = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.08, 0.48), matWood);
    seat.position.y = 0.46;
    b.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.42, 0.07), matWood);
    back.position.set(0, 0.78, -0.21);
    back.rotation.x = -0.14;
    b.add(back);
    for (const sx of [-0.74, 0.74]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.48), matIron);
      leg.position.set(sx, 0.23, 0);
      b.add(leg);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.42), matIron);
      arm.position.set(sx, 0.57, -0.02);
      b.add(arm);
    }
    enableCast(b);
    return b;
  }

  // Woven wicker basket prop (with lavender bundles or apricots)
  function makeWickerBasket(fillType = 0, scale = 1.0) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.23, 0.32, 10), matWicker);
    body.position.y = 0.16;
    g.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.032, 6, 12), matWood);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.32;
    g.add(rim);

    if (fillType === 0) {
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const sprig = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 5), matLavender);
        sprig.position.set(Math.cos(ang) * 0.11, 0.36, Math.sin(ang) * 0.11);
        sprig.rotation.z = Math.cos(ang) * 0.25;
        g.add(sprig);
      }
    } else {
      const fruitMat = fillType === 1 ? matApricot : new THREE.MeshStandardMaterial({ color: PALETTE.apricotSoft, roughness: 0.7 });
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const fr = new THREE.Mesh(new THREE.SphereGeometry(0.085, 7, 6), fruitMat);
        fr.position.set(Math.cos(ang) * 0.11, 0.32, Math.sin(ang) * 0.11);
        g.add(fr);
      }
    }
    g.scale.setScalar(scale);
    enableCast(g);
    return g;
  }

  // Rustic 1970s Provençal wooden two-wheeled handcart loaded with harvest baskets
  function makeWoodenHandcart() {
    const c = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.10, 0.96), matWood);
    bed.position.y = 0.48;
    c.add(bed);
    // Slatted side rails
    for (const sz of [-0.46, 0.46]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.28, 0.06), matWood);
      rail.position.set(0, 0.66, sz);
      c.add(rail);
    }
    const backBoard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.96), matWood);
    backBoard.position.set(-0.70, 0.66, 0);
    c.add(backBoard);
    // Two pull handles extending forward (+X)
    for (const sz of [-0.34, 0.34]) {
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.06), matWood);
      shaft.position.set(1.05, 0.42, sz);
      shaft.rotation.z = -0.14;
      c.add(shaft);
    }
    // Rest leg at front
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.56), matWood);
    prop.position.set(0.65, 0.22, 0);
    c.add(prop);

    // Two spoked wooden wheels with iron rims
    for (const wz of [-0.54, 0.54]) {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 6, 16), matIron);
      wheel.add(tire);
      const felloe = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.032, 6, 16), matWood);
      wheel.add(felloe);
      for (let s = 0; s < 4; s++) {
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.66, 5), matWood);
        spoke.rotation.z = (s * Math.PI) / 4;
        wheel.add(spoke);
      }
      wheel.position.set(-0.08, 0.39, wz);
      c.add(wheel);
    }

    // Harvest baskets resting inside the cart
    const b1 = makeWickerBasket(0, 0.92);
    b1.position.set(-0.34, 0.52, -0.15);
    c.add(b1);
    const b2 = makeWickerBasket(1, 0.85);
    b2.position.set(0.24, 0.52, 0.16);
    c.add(b2);
    const b3 = makeWickerBasket(0, 0.78);
    b3.position.set(-0.22, 0.52, 0.24);
    c.add(b3);

    enableCast(c);
    return c;
  }

  function makePlanter(variant = 0) {
    const p = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.30, 0.48, 10), matTerracotta);
    pot.position.y = 0.24;
    p.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 6, 12), matTerracotta);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.48;
    p.add(rim);

    if (variant % 2 === 0) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.55, 6), matWood);
      stem.position.y = 0.72;
      p.add(stem);
      for (const [ox, oy, oz, sc] of [[0, 1.08, 0, 0.38], [0.22, 0.96, 0.1, 0.26], [-0.20, 1.0, -0.1, 0.28]]) {
        const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(sc, 1), matOlive);
        leaf.position.set(ox, oy, oz);
        p.add(leaf);
      }
    } else {
      const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 1), matOlive);
      base.scale.set(1.1, 0.7, 1.1);
      base.position.y = 0.62;
      p.add(base);
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        const fl = new THREE.Mesh(
          new THREE.ConeGeometry(0.11, 0.34, 5),
          i % 2 === 0 ? matLavender : matApricot
        );
        fl.position.set(Math.cos(ang) * 0.18, 0.85, Math.sin(ang) * 0.18);
        p.add(fl);
      }
    }
    enableCast(p);
    return p;
  }

  function makeMarketStall(stripeTex, stockType = 0) {
    const s = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.86, 1.15), matWood);
    counter.position.y = 0.43;
    s.add(counter);

    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(2.45, 0.05, 1.08),
      new THREE.MeshStandardMaterial({
        color: PALETTE.cream,
        bumpMap: linenBump,
        bumpScale: lowQuality ? 0 : 0.015,
        roughness: 0.86,
      })
    );
    cloth.position.y = 0.88;
    s.add(cloth);

    for (const px of [-1.22, 1.22]) {
      for (const pz of [-0.52, 0.52]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, pz < 0 ? 2.45 : 2.18, 6), matWood);
        post.position.set(px, pz < 0 ? 1.22 : 1.09, pz);
        s.add(post);
      }
    }

    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(2.85, 0.08, 1.65),
      new THREE.MeshStandardMaterial({
        map: stripeTex,
        bumpMap: linenBump,
        bumpScale: lowQuality ? 0 : 0.02,
        roughness: 0.82,
      })
    );
    awning.position.set(0, 2.34, 0.06);
    awning.rotation.x = 0.24;
    s.add(awning);

    const itemColors = stockType === 0
      ? [PALETTE.lavender, PALETTE.lavenderLight, PALETTE.apricotSoft]
      : stockType === 1
        ? [PALETTE.apricot, PALETTE.apricotSoft, PALETTE.roofTileWarm]
        : [PALETTE.creamWarm, PALETTE.apricotSoft, PALETTE.turquoiseSoft];

    for (let i = -1; i <= 1; i++) {
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.16, 8), matWicker);
      tray.position.set(i * 0.72, 0.98, 0.05);
      s.add(tray);

      const goodMat = new THREE.MeshStandardMaterial({ color: itemColors[(i + 1) % itemColors.length], roughness: 0.78 });
      for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * Math.PI * 2;
        const item = new THREE.Mesh(new THREE.SphereGeometry(0.10, 7, 6), goodMat);
        item.position.set(i * 0.72 + Math.cos(ang) * 0.11, 1.09, 0.05 + Math.sin(ang) * 0.11);
        s.add(item);
      }
    }

    enableCast(s);
    return s;
  }

  function makeCottage({ w = 6.2, h = 4.2, d = 5.0, wallMat = matStone, roofMat = matRoof, shutterMat = matTurquoise, chimney = true, pergola = false }) {
    const g = new THREE.Group();

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.22, 0.45, d + 0.22), matStoneTrim);
    plinth.position.y = 0.225;
    g.add(plinth);

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = h / 2;
    g.add(body);

    const roofH = 1.72;
    const roofGeo = new THREE.ConeGeometry(Math.hypot(w, d) * 0.59, roofH, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.scale.set(w / Math.hypot(w, d) * 1.56, 1, d / Math.hypot(w, d) * 1.56);
    roof.position.y = h + roofH / 2 - 0.12;
    g.add(roof);

    const eave = new THREE.Mesh(new THREE.BoxGeometry(w + 0.48, 0.12, d + 0.48), matWood);
    eave.position.y = h - 0.04;
    g.add(eave);

    if (chimney) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.35, 0.65), matStoneWarm);
      ch.position.set(w * 0.28, h + 0.9, -d * 0.22);
      g.add(ch);
      const chPot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.35, 8), matTerracotta);
      chPot.position.set(w * 0.28, h + 1.72, -d * 0.22);
      g.add(chPot);
    }

    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.26, 2.22, 0.18), matStoneTrim);
    doorFrame.position.set(0, 1.11, d / 2 + 0.02);
    g.add(doorFrame);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.02, 2.02, 0.14), shutterMat);
    door.position.set(0, 1.04, d / 2 + 0.07);
    g.add(door);

    const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.72), matStoneWarm);
    step.position.set(0, 0.11, d / 2 + 0.36);
    g.add(step);

    for (const sx of [-w * 0.29, w * 0.29]) {
      const sill = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.12, 0.26), matStoneTrim);
      sill.position.set(sx, 1.76, d / 2 + 0.08);
      g.add(sill);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.0, 0.12), matGlassWarm);
      win.position.set(sx, 2.3, d / 2 + 0.05);
      g.add(win);
      for (const side of [-1, 1]) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.02, 0.1), shutterMat);
        sh.position.set(sx + side * 0.6, 2.3, d / 2 + 0.06);
        g.add(sh);
      }
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.28), matTerracotta);
      box.position.set(sx, 1.62, d / 2 + 0.18);
      g.add(box);
      const blooms = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), matLavender);
      blooms.scale.set(2.3, 0.78, 0.9);
      blooms.position.set(sx, 1.80, d / 2 + 0.20);
      g.add(blooms);
    }

    if (pergola) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, 0.12, 2.0), matWood);
      frame.position.set(0, 2.55, d / 2 + 1.0);
      g.add(frame);
      const vine = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), matOlive);
      vine.scale.set(3.2, 0.35, 1.5);
      vine.position.set(0, 2.72, d / 2 + 1.0);
      g.add(vine);
      for (const px of [-w * 0.34, w * 0.34]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.55, 7), matWood);
        post.position.set(px, 1.28, d / 2 + 1.9);
        g.add(post);
      }
    }

    enableCast(g);
    return g;
  }

  // 1. Home Cottage
  const home = makeCottage({ w: 6.8, h: 4.4, d: 5.4, wallMat: matStone, roofMat: matRoof, shutterMat: matTurquoise, pergola: true });
  home.position.set(LANDMARKS.homeHouse.x, terrainHeight(LANDMARKS.homeHouse.x, LANDMARKS.homeHouse.z), LANDMARKS.homeHouse.z);
  home.rotation.y = 0.72;
  root.add(home);

  // 2. Neighboring houses & Bakery (varied shapes, orientations & bakery bracket)
  const neighbors = [
    { x: -19, z: -6, rot: 0.45, w: 5.8, h: 4.0, d: 4.8, wall: matStoneWarm, roof: matRoofWarm, shut: matApricot, pergola: false },
    { x: 18, z: -6, rot: -0.75, w: 6.2, h: 4.4, d: 5.0, wall: matStone, roof: matRoof, shut: matTurquoise, pergola: false },
    { x: -16, z: -22, rot: 1.25, w: 5.4, h: 5.2, d: 4.6, wall: matStoneWarm, roof: matRoof, shut: matTurquoise, pergola: false },
  ];
  neighbors.forEach((n, idx) => {
    const c = makeCottage({
      w: n.w, h: n.h, d: n.d,
      wallMat: n.wall, roofMat: n.roof, shutterMat: n.shut, pergola: n.pergola,
    });
    c.position.set(n.x, terrainHeight(n.x, n.z), n.z);
    c.rotation.y = n.rot;
    root.add(c);

    if (idx === 2) {
      const signGroup = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), matIron);
      arm.position.set(0.45, 0, 0);
      signGroup.add(arm);
      const croissant = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.09, 7, 14, Math.PI * 1.25), matApricot);
      croissant.rotation.z = -Math.PI * 0.12;
      croissant.position.set(0.62, -0.32, 0);
      signGroup.add(croissant);
      signGroup.position.set(n.x + 2.8, terrainHeight(n.x, n.z) + 3.0, n.z + 1.2);
      signGroup.rotation.y = 0.25;
      root.add(signGroup);
    }
  });

  // 3. Home Garden Details: stone table, wordless mailbox, well, bicycle, bench, planters, wall & gate
  const yHome = terrainHeight(0, 0);

  const tableGroup = new THREE.Group();
  const tBase = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.36, 0.68, 10), matStoneWarm);
  tBase.position.y = 0.34;
  tableGroup.add(tBase);
  const tTop = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.64, 0.12, 12), matStone);
  tTop.position.y = 0.72;
  tableGroup.add(tTop);
  tableGroup.position.set(LANDMARKS.letterPedestal.x, terrainHeight(LANDMARKS.letterPedestal.x, LANDMARKS.letterPedestal.z), LANDMARKS.letterPedestal.z);
  enableCast(tableGroup);
  root.add(tableGroup);

  const gardenBench = makeBench();
  gardenBench.position.set(-4.6, terrainHeight(-4.6, 1.4), 1.4);
  gardenBench.rotation.y = 0.85;
  root.add(gardenBench);

  for (const [px, pz, v] of [[-5.6, -5.8, 0], [4.2, -5.4, 1], [-2.5, 2.2, 1]]) {
    const pl = makePlanter(v);
    pl.position.set(px, terrainHeight(px, pz), pz);
    root.add(pl);
  }

  const mailbox = new THREE.Group();
  const mbPost = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.05, 0.38), matStoneWarm);
  mbPost.position.y = 0.52;
  mailbox.add(mbPost);
  const mbBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.52), matTurquoise);
  mbBox.position.y = 1.18;
  mailbox.add(mbBox);
  const mbCap = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.52, 10, 1, false, 0, Math.PI), matTurquoise);
  mbCap.rotation.z = Math.PI / 2;
  mbCap.rotation.y = Math.PI / 2;
  mbCap.position.y = 1.34;
  mailbox.add(mbCap);
  mailbox.position.set(-4.2, yHome, -5.8);
  mailbox.rotation.y = 0.25;
  enableCast(mailbox);
  root.add(mailbox);

  const well = new THREE.Group();
  const wRim = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.78, 12), matStoneWarm);
  wRim.position.y = 0.39;
  well.add(wRim);
  const wWater = new THREE.Mesh(new THREE.CircleGeometry(0.68, 12).rotateX(-Math.PI / 2), riverMat);
  wWater.position.y = 0.62;
  well.add(wWater);
  for (const sx of [-0.72, 0.72]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.35, 0.12), matWood);
    post.position.set(sx, 1.4, 0);
    well.add(post);
  }
  const wRoof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.68, 4), matRoof);
  wRoof.rotation.y = Math.PI / 4;
  wRoof.position.y = 2.32;
  well.add(wRoof);
  well.position.set(8.2, yHome, -1.6);
  enableCast(well);
  root.add(well);

  const bike = new THREE.Group();
  for (const wx of [-0.48, 0.48]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 7, 16), matIron);
    wheel.position.set(wx, 0.34, 0);
    bike.add(wheel);
  }
  const frameBar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.045, 0.045), matTurquoise);
  frameBar.position.set(0, 0.56, 0);
  frameBar.rotation.z = 0.18;
  bike.add(frameBar);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.42), matIron);
  handle.position.set(0.38, 0.78, 0);
  bike.add(handle);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.28), matWicker);
  basket.position.set(0.52, 0.72, 0);
  bike.add(basket);
  bike.position.set(-4.6, yHome, -1.8);
  bike.rotation.y = -0.35;
  bike.rotation.x = 0.14;
  enableCast(bike);
  root.add(bike);

  for (const seg of [
    { x: -7.2, z: -7.2, w: 6.4, rot: 0.08 },
    { x: 7.4, z: -6.8, w: 6.8, rot: -0.06 },
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(seg.w, 0.82, 0.55), matStoneWarm);
    wall.position.set(seg.x, terrainHeight(seg.x, seg.z) + 0.41, seg.z);
    wall.rotation.y = seg.rot;
    enableCast(wall);
    root.add(wall);
  }
  for (const gx of [-1.4, 1.8]) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.25, 0.45), matStone);
    pil.position.set(gx, yHome + 0.62, -7.1);
    enableCast(pil);
    root.add(pil);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.92, 0.06), matIron);
    wing.position.set(gx + (gx < 0 ? -0.45 : 0.45), yHome + 0.55, -7.85);
    wing.rotation.y = gx < 0 ? 1.15 : -1.15;
    root.add(wing);
  }

  const stoneGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.07, 7);
  const steps = [
    [-4.2, 2.2], [-3.0, 0.9], [-1.9, -0.2], [-0.4, -2.5], [0.5, -5.0], [1.4, -7.8], [2.4, -10.3],
  ];
  for (const [sx, sz] of steps) {
    const st = new THREE.Mesh(stoneGeo, matStoneWarm);
    st.position.set(sx, terrainHeight(sx, sz) + 0.035, sz);
    st.rotation.y = sx * 0.7;
    st.receiveShadow = !lowQuality;
    root.add(st);
  }

  // 4. Reflective Valley River, Arched Wooden Bridge, Timber Pier & Moored Wooden Rowboats
  const riverGeo = new THREE.PlaneGeometry(520, 17, 76, 2);
  riverGeo.rotateX(-Math.PI / 2);
  const rPos = riverGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const rx = rPos.getX(i);
    const rzOffset = rPos.getZ(i);
    rPos.setY(i, WATER_Y);
    rPos.setZ(i, riverCenterZ(rx) + rzOffset);
  }
  riverGeo.computeVertexNormals();
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  riverMesh.name = 'river';
  root.add(riverMesh);

  const bridgeGroup = new THREE.Group();
  const bx = LANDMARKS.bridge.x;
  const bz = riverCenterZ(bx);
  const deckCount = 11;
  for (let i = 0; i < deckCount; i++) {
    const t = i / (deckCount - 1) - 0.5;
    const archY = Math.cos(t * Math.PI) * 1.65;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 1.45), matWood);
    plank.position.set(0, archY + WATER_Y + 0.65, t * 17.0);
    plank.rotation.x = Math.sin(t * Math.PI) * 0.28;
    bridgeGroup.add(plank);
    if (i % 2 === 0) {
      for (const side of [-1.45, 1.45]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 0.14), matWood);
        post.position.set(side, archY + WATER_Y + 1.15, t * 17.0);
        bridgeGroup.add(post);
      }
    }
  }
  for (const side of [-1.55, 1.55]) {
    const ab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.5, 2.2), matStoneWarm);
    ab.position.set(0, WATER_Y + 0.2, side * 5.8);
    bridgeGroup.add(ab);
  }
  bridgeGroup.position.set(bx, 0, bz);
  enableCast(bridgeGroup);
  root.add(bridgeGroup);

  const px = LANDMARKS.pier.x;
  const pz = riverCenterZ(px) + 7.2;
  const pier = new THREE.Group();
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 4.4), matWood);
  pierDeck.position.set(0, WATER_Y + 0.42, -1.2);
  pier.add(pierDeck);
  for (const lx of [-1.05, 1.05]) {
    for (const lz of [-2.8, -0.4]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.8, 6), matWood);
      leg.position.set(lx, WATER_Y - 0.2, lz);
      pier.add(leg);
    }
  }
  pier.position.set(px, 0, pz);
  enableCast(pier);
  root.add(pier);

  const boats = [];
  function makeRowboat(trimMat) {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.45, 3.1, 8, 1, false, 0, Math.PI), matWood);
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = Math.PI / 2;
    hull.scale.set(1, 0.65, 1);
    hull.position.y = 0.26;
    b.add(hull);
    const gunwale = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 6, 14), trimMat);
    gunwale.rotation.x = Math.PI / 2;
    gunwale.scale.set(0.72, 1.55, 1);
    gunwale.position.y = 0.28;
    b.add(gunwale);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.07, 0.28), matStone);
    seat.position.y = 0.22;
    b.add(seat);
    enableCast(b);
    return b;
  }
  const boatConfigs = [
    { x: px - 2.6, z: riverCenterZ(px - 2.6) + 4.2, rot: 0.35, mat: matTurquoise },
    { x: px + 2.8, z: riverCenterZ(px + 2.8) + 3.6, rot: -0.2, mat: matApricot },
    { x: px + 9.0, z: riverCenterZ(px + 9.0) + 1.8, rot: 0.55, mat: matTurquoise },
  ];
  boatConfigs.forEach((bc, i) => {
    const bm = makeRowboat(bc.mat);
    bm.position.set(bc.x, WATER_Y - 0.04, bc.z);
    bm.rotation.y = bc.rot;
    root.add(bm);
    boats.push({ mesh: bm, baseY: WATER_Y - 0.04, phase: i * 2.1, baseRot: bc.rot });
  });

  // 5. Enriched Riverside Landing Meadow (LANDMARKS.meadowLanding: -22, -182)
  // Stone cottage, dry-stone low gate walls, wooden handcart, woven baskets, flower stall,
  // stone spring trough, benches, planters, stepping stones & friendly meadow villager.
  const mlX = LANDMARKS.meadowLanding.x;
  const mlZ = LANDMARKS.meadowLanding.z;
  const meadowProps = new THREE.Group();

  const meadowCottage = makeCottage({
    w: 5.4, h: 3.8, d: 4.5,
    wallMat: matStoneWarm, roofMat: matRoofWarm, shutterMat: matTurquoise, pergola: true,
  });
  meadowCottage.position.set(mlX - 9.8, terrainHeight(mlX - 9.8, mlZ - 7.8), mlZ - 7.8);
  meadowCottage.rotation.y = 0.62;
  root.add(meadowCottage);

  const meadowStall = makeMarketStall(awningApricotTex, 0);
  meadowStall.position.set(mlX + 6.4, terrainHeight(mlX + 6.4, mlZ - 5.2), mlZ - 5.2);
  meadowStall.rotation.y = -0.52;
  meadowProps.add(meadowStall);

  // Friendly villager beside the meadow flower stall (clearly visible in land shot)
  const meadowVillager = makeVillager({
    coatColor: PALETTE.turquoise,
    hatColor: PALETTE.creamWarm,
    hairColor: PALETTE.hairBrown,
    lowQuality,
  });
  meadowVillager.group.position.set(mlX + 4.9, terrainHeight(mlX + 4.9, mlZ - 4.1), mlZ - 4.1);
  meadowVillager.group.rotation.y = -0.45;
  meadowProps.add(meadowVillager.group);

  // Wooden two-wheeled handcart + extra woven wicker baskets filled with lavender & apricots
  const handcart = makeWoodenHandcart();
  handcart.position.set(mlX + 4.6, terrainHeight(mlX + 4.6, mlZ - 1.2), mlZ - 1.2);
  handcart.rotation.y = 2.45;
  meadowProps.add(handcart);

  for (const [bxOff, bzOff, fType, sc] of [
    [5.8, -4.1, 0, 1.05],
    [6.6, -3.7, 1, 0.92],
    [-4.3, -4.9, 0, 1.0],
    [3.8, -8.5, 2, 0.95],
  ]) {
    const bsk = makeWickerBasket(fType, sc);
    bsk.position.set(mlX + bxOff, terrainHeight(mlX + bxOff, mlZ + bzOff), mlZ + bzOff);
    meadowProps.add(bsk);
  }

  // Dry-stone meadow enclosure walls & stone gate pillars
  for (const [wx, wz, len, rot] of [
    [-7.8, 7.6, 5.8, 0.16],
    [7.5, 7.4, 6.2, -0.18],
    [10.8, -2.6, 5.2, 1.38],
  ]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(len, 0.78, 0.56), matStoneWarm);
    sw.position.set(mlX + wx, terrainHeight(mlX + wx, mlZ + wz) + 0.36, mlZ + wz);
    sw.rotation.y = rot;
    enableCast(sw);
    meadowProps.add(sw);
  }
  for (const gx of [-3.6, 3.6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.52, 1.15, 0.52), matStone);
    post.position.set(mlX + gx, terrainHeight(mlX + gx, mlZ + 7.2) + 0.55, mlZ + 7.2);
    enableCast(post);
    meadowProps.add(post);
  }

  const mBench1 = makeBench();
  mBench1.position.set(mlX - 5.6, terrainHeight(mlX - 5.6, mlZ + 4.2), mlZ + 4.2);
  mBench1.rotation.y = 0.72;
  meadowProps.add(mBench1);

  const mBench2 = makeBench();
  mBench2.position.set(mlX + 6.4, terrainHeight(mlX + 6.4, mlZ + 4.0), mlZ + 4.0);
  mBench2.rotation.y = -0.65;
  meadowProps.add(mBench2);

  const springGroup = new THREE.Group();
  const trough = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.62, 8), matStone);
  trough.position.y = 0.31;
  springGroup.add(trough);
  const troughWater = new THREE.Mesh(new THREE.CircleGeometry(0.92, 8).rotateX(-Math.PI / 2), riverMat);
  troughWater.position.y = 0.56;
  springGroup.add(troughWater);
  const spoutPillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.35, 0.45), matStoneWarm);
  spoutPillar.position.set(0, 0.68, -0.95);
  springGroup.add(spoutPillar);
  springGroup.position.set(mlX + 2.8, terrainHeight(mlX + 2.8, mlZ - 8.6), mlZ - 8.6);
  springGroup.rotation.y = -0.25;
  enableCast(springGroup);
  meadowProps.add(springGroup);

  for (const [ox, oz, v] of [[-4.2, -5.6, 0], [5.4, 2.2, 1], [-7.2, 1.8, 1], [1.4, -7.8, 0]]) {
    const pl = makePlanter(v);
    pl.position.set(mlX + ox, terrainHeight(mlX + ox, mlZ + oz), mlZ + oz);
    meadowProps.add(pl);
  }
  for (let i = 0; i < 6; i++) {
    const sx = mlX - 2.0 + i * 1.45;
    const sz = mlZ + 3.2 - i * 1.25;
    const st = new THREE.Mesh(stoneGeo, matStoneWarm);
    st.position.set(sx, terrainHeight(sx, sz) + 0.035, sz);
    meadowProps.add(st);
  }
  root.add(meadowProps);

  // 6. Stone Windmill on the western ridge
  const windmill = new THREE.Group();
  const wmY = terrainHeight(LANDMARKS.windmill.x, LANDMARKS.windmill.z);
  const wmTower = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.1, 9.2, 14), matStone);
  wmTower.position.y = 4.6;
  windmill.add(wmTower);
  const wmRoof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 2.8, 14), matRoofWarm);
  wmRoof.position.y = 10.6;
  windmill.add(wmRoof);
  const wmDoor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.3), matTurquoise);
  wmDoor.position.set(0, 1.05, 2.95);
  windmill.add(wmDoor);

  const sailHub = new THREE.Group();
  sailHub.position.set(0, 8.2, 2.45);
  const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 10), matWood);
  hubCap.rotation.x = Math.PI / 2;
  sailHub.add(hubCap);
  const matCanvas = new THREE.MeshStandardMaterial({
    color: PALETTE.cream,
    bumpMap: linenBump,
    bumpScale: lowQuality ? 0 : 0.02,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 5.2, 0.12), matWood);
    spar.position.y = 2.6;
    arm.add(spar);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 4.0), matCanvas);
    sail.position.set(0.62, 3.0, 0.03);
    arm.add(sail);
    sailHub.add(arm);
  }
  windmill.add(sailHub);
  windmill.position.set(LANDMARKS.windmill.x, wmY, LANDMARKS.windmill.z);
  windmill.rotation.y = 0.52;
  enableCast(windmill);
  root.add(windmill);

  // 7. Eastern Detour Village Cluster
  const detourOffsets = [
    { dx: -6, dz: -4, rot: 0.4, shut: matApricot, roof: matRoofWarm },
    { dx: 7, dz: -2, rot: -0.8, shut: matTurquoise, roof: matRoof },
    { dx: 1, dz: 9, rot: 2.6, shut: matTurquoise, roof: matRoofWarm },
    { dx: -8, dz: 8, rot: 1.3, shut: matApricot, roof: matRoof },
  ];
  detourOffsets.forEach((d) => {
    const vx = LANDMARKS.detourVillage.x + d.dx;
    const vz = LANDMARKS.detourVillage.z + d.dz;
    const vc = makeCottage({
      w: 5.4, h: 3.9, d: 4.5,
      wallMat: matStoneWarm, roofMat: d.roof, shutterMat: d.shut, chimney: true,
    });
    vc.position.set(vx, terrainHeight(vx, vz), vz);
    vc.rotation.y = d.rot;
    root.add(vc);
  });

  // 8. Clock Tower Square (Goal at LANDMARKS.towerPlaza: x=6, z=-330)
  // Cohesive foreground reunion layout so close arrival shot frames girl + recipient + balloon + tower!
  const plaza = new THREE.Group();
  const tx = LANDMARKS.towerPlaza.x;
  const tz = LANDMARKS.towerPlaza.z;
  const ty = terrainHeight(tx, tz);

  const terrace = new THREE.Mesh(new THREE.CylinderGeometry(18.8, 19.8, 0.52, 32), matCobble);
  terrace.position.y = 0.26;
  terrace.receiveShadow = !lowQuality;
  plaza.add(terrace);

  const curbRing = new THREE.Mesh(new THREE.TorusGeometry(18.7, 0.24, 6, 36), matStoneTrim);
  curbRing.rotation.x = Math.PI / 2;
  curbRing.position.y = 0.50;
  plaza.add(curbRing);

  // Landing circle set cozy-close in front-left of Clock Tower
  const landingPadLocal = new THREE.Vector3(-2.1, 0.52, 2.2);
  const landingRing = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.6, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: PALETTE.apricotSoft, transparent: true, opacity: 0.72 })
  );
  landingRing.position.copy(landingPadLocal);
  plaza.add(landingRing);

  for (let i = 0; i < 12; i++) {
    const a = -Math.PI * 0.92 + (i / 11) * Math.PI * 0.84;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.05, 0.56), matStoneWarm);
    post.position.set(Math.cos(a) * 17.9, 0.98, Math.sin(a) * 17.9);
    plaza.add(post);
  }

  // Clock Tower anchored right behind the reunion spot (local z = -7.6)
  const tower = new THREE.Group();
  tower.position.set(1.1, 0.52, -7.6);

  const towerPlinth = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.65, 4.9), matStoneTrim);
  towerPlinth.position.y = 0.32;
  tower.add(towerPlinth);

  const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.6, 4.4), matStoneWarm);
  base.position.y = 2.1;
  tower.add(base);

  const mid = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.6, 3.8), matStone);
  mid.position.y = 5.7;
  tower.add(mid);

  const stringCourse = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.22, 4.15), matStoneTrim);
  stringCourse.position.y = 3.92;
  tower.add(stringCourse);

  const doorArch = new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.45, 0.22), matStoneTrim);
  doorArch.position.set(0, 1.25, 2.18);
  tower.add(doorArch);
  const tDoor = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.18, 0.18), matTurquoise);
  tDoor.position.set(0, 1.12, 2.24);
  tower.add(tDoor);

  const matClockFace = new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.45 });
  const matBronze = new THREE.MeshStandardMaterial({ color: PALETTE.bronze, roughness: 0.35, metalness: 0.72 });
  for (const [fx, fz, ry] of [[0, 1.94, 0], [1.94, 0, Math.PI / 2], [-1.94, 0, -Math.PI / 2]]) {
    const dialGroup = new THREE.Group();
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.09, 8, 24), matTurquoise);
    dialGroup.add(bezel);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.94, 24), matClockFace);
    face.position.z = 0.02;
    dialGroup.add(face);
    for (let h = 0; h < 12; h++) {
      const ang = (h / 12) * Math.PI * 2;
      const dot = new THREE.Mesh(new THREE.CircleGeometry(h % 3 === 0 ? 0.062 : 0.038, 8), matIron);
      dot.position.set(Math.sin(ang) * 0.74, Math.cos(ang) * 0.74, 0.04);
      dialGroup.add(dot);
    }
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.04), matIron);
    hourHand.position.set(0.11, 0.14, 0.05);
    hourHand.rotation.z = -0.65;
    dialGroup.add(hourHand);
    const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.68, 0.04), matIron);
    minHand.position.set(-0.17, 0.22, 0.06);
    minHand.rotation.z = 0.72;
    dialGroup.add(minHand);

    dialGroup.position.set(fx, 6.05, fz);
    dialGroup.rotation.y = ry;
    tower.add(dialGroup);
  }

  const belfryY = 7.5;
  for (const cx of [-1.45, 1.45]) {
    for (const cz of [-1.45, 1.45]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.54, 2.35, 0.54), matStoneWarm);
      col.position.set(cx, belfryY + 1.18, cz);
      tower.add(col);
    }
  }
  const bellPivot = new THREE.Group();
  bellPivot.position.set(0, belfryY + 2.0, 0);
  const bellYoke = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.22), matWood);
  bellPivot.add(bellYoke);
  const bellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.72, 0.95, 14), matBronze);
  bellBody.position.y = -0.60;
  bellPivot.add(bellBody);
  const bellClapper = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), matBronze);
  bellClapper.position.y = -1.10;
  bellPivot.add(bellClapper);
  tower.add(bellPivot);

  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.9, 2.45, 4), matRoofWarm);
  spire.rotation.y = Math.PI / 4;
  spire.position.y = belfryY + 3.55;
  tower.add(spire);
  const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.95, 6), matIron);
  finial.position.y = belfryY + 5.15;
  tower.add(finial);
  plaza.add(tower);

  // Octagonal Provençal Stone Fountain (right-midground of square)
  const fountain = new THREE.Group();
  fountain.position.set(6.4, 0.52, -0.6);
  const fBase = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.15, 0.65, 8), matStone);
  fBase.position.y = 0.32;
  fountain.add(fBase);
  const fWater = new THREE.Mesh(new THREE.CircleGeometry(1.64, 8).rotateX(-Math.PI / 2), riverMat);
  fWater.position.y = 0.58;
  fountain.add(fWater);
  const fCol = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 1.55, 8), matStoneWarm);
  fCol.position.y = 1.15;
  fountain.add(fCol);
  const fUpperBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.35, 0.35, 8), matStone);
  fUpperBowl.position.y = 1.85;
  fountain.add(fUpperBowl);
  const fTopJet = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 8), riverMat);
  fTopJet.position.y = 2.28;
  fountain.add(fTopJet);
  plaza.add(fountain);

  // 3 Wordless Market Stalls framing the square
  const stalls = [
    { x: -7.8, z: -3.2, rot: 0.62, tex: awningApricotTex, type: 0 },
    { x: -9.8, z: 3.6, rot: 1.25, tex: awningTurqTex, type: 1 },
    { x: 9.8, z: -5.0, rot: -0.78, tex: awningTurqTex, type: 2 },
  ];
  stalls.forEach((st) => {
    const m = makeMarketStall(st.tex, st.type);
    m.position.set(st.x, 0.52, st.z);
    m.rotation.y = st.rot;
    plaza.add(m);
  });

  const plazaBenches = [
    { x: -4.4, z: -6.4, rot: 0.35 },
    { x: 6.2, z: -6.8, rot: -0.45 },
    { x: 8.6, z: 3.6, rot: -1.15 },
    { x: -8.4, z: 8.6, rot: 2.35 },
  ];
  plazaBenches.forEach((pb) => {
    const b = makeBench();
    b.position.set(pb.x, 0.52, pb.z);
    b.rotation.y = pb.rot;
    plaza.add(b);
  });

  const potCoords = [
    [-5.2, 0.2, 0], [-6.2, 6.2, 1], [4.1, -1.6, 1],
    [10.2, 1.0, 0], [-2.2, -7.8, 0], [4.8, -7.8, 1],
  ];
  potCoords.forEach(([pxPot, pzPot, v]) => {
    const p = makePlanter(v);
    p.position.set(pxPot, 0.52, pzPot);
    plaza.add(p);
  });

  // Waving Villagers positioned so the celebration is visible in the close reunion shot
  const villagers = [];
  const villagerSpecs = [
    { x: -5.4, z: -1.4, rot: 0.65, coat: PALETTE.apricot, hat: PALETTE.creamWarm, hair: PALETTE.hairBrown },
    { x: 4.5, z: -1.8, rot: -0.55, coat: PALETTE.lavender, hat: PALETTE.cream, hair: PALETTE.hairSilver },
    { x: 6.8, z: 2.4, rot: -0.95, coat: PALETTE.turquoise, hat: PALETTE.creamWarm, hair: PALETTE.hairBrown },
    { x: -8.0, z: 4.4, rot: 1.05, coat: PALETTE.meadowSage, hat: PALETTE.cream, hair: PALETTE.hairSilver },
  ];
  villagerSpecs.forEach((vs, idx) => {
    const v = makeVillager({ coatColor: vs.coat, hatColor: vs.hat, hairColor: vs.hair, lowQuality });
    v.group.position.set(vs.x, 0.52, vs.z);
    v.group.rotation.y = vs.rot;
    plaza.add(v.group);
    villagers.push({ ...v, phase: idx * 1.4 });
  });
  // Register meadow villager into waving list
  villagers.push({ ...meadowVillager, phase: 0.8 });

  plaza.position.set(tx, ty, tz);
  enableCast(plaza);
  root.add(plaza);

  const plazaHouses = [
    { dx: -17.5, dz: -13.5, rot: 0.68, w: 6.0, h: 4.6, d: 5.0, shut: matTurquoise, roof: matRoof },
    { dx: 17.5, dz: -12.5, rot: -0.72, w: 6.2, h: 4.4, d: 4.8, shut: matApricot, roof: matRoofWarm },
    { dx: -19.5, dz: 1.5, rot: 1.38, w: 5.6, h: 4.1, d: 4.6, shut: matApricot, roof: matRoofWarm },
    { dx: 19.5, dz: 2.0, rot: -1.38, w: 5.8, h: 4.2, d: 4.6, shut: matTurquoise, roof: matRoof },
    { dx: -8.5, dz: -20.5, rot: 0.25, w: 5.4, h: 4.0, d: 4.4, shut: matTurquoise, roof: matRoofWarm },
  ];
  plazaHouses.forEach((ph) => {
    const hx = tx + ph.dx;
    const hz = tz + ph.dz;
    const hc = makeCottage({
      w: ph.w, h: ph.h, d: ph.d,
      wallMat: matStoneWarm, roofMat: ph.roof, shutterMat: ph.shut, chimney: true,
    });
    hc.position.set(hx, terrainHeight(hx, hz), hz);
    hc.rotation.y = ph.rot;
    root.add(hc);
  });

  return {
    group: root,
    bellPivot,
    landingCenter: new THREE.Vector3(tx + landingPadLocal.x, ty + landingPadLocal.y, tz + landingPadLocal.z),
    update(time, bellSwingAmp = 0) {
      waterUniforms.uTime.value = time;
      sailHub.rotation.z = time * 0.45;
      for (const b of boats) {
        b.mesh.position.y = b.baseY + Math.sin(time * 1.3 + b.phase) * 0.045;
        b.mesh.rotation.z = Math.sin(time * 1.1 + b.phase) * 0.04;
        b.mesh.rotation.y = b.baseRot + Math.sin(time * 0.6 + b.phase) * 0.025;
      }
      bellPivot.rotation.z = Math.sin(time * 3.8) * (0.04 + bellSwingAmp * 0.34);
      fTopJet.scale.set(1 + Math.sin(time * 6) * 0.08, 0.9 + Math.sin(time * 8) * 0.14, 1 + Math.cos(time * 6) * 0.08);
      for (const v of villagers) {
        v.armR.rotation.z = -0.22 + Math.sin(time * 4.5 + v.phase) * 0.32;
      }
    },
  };
}
