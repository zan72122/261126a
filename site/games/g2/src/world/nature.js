// Instanced Provençal flora: dense swaying grass tufts, organic non-grid lavender contour rows,
// tiered cypresses, multi-canopy olive trees, naturally scattered wildflower drifts, and weathered stone walls.
import * as THREE from '../../lib/three.module.js';
import { PALETTE } from '../core/palette.js';
import { mulberry32, smoothstep } from '../core/math.js';
import { makeLimestoneTextures } from '../core/textures.js';
import { LANDMARKS, rawTerrainHeight, terrainHeight, isOverRiver, riverCenterZ, riverHalfWidth } from './terrain.js';

function makeGrassTuftGeometry() {
  // 3-blade curved tuft (2 segs/blade = 12 tris) for dense lush coverage at high FPS on iPad Safari
  const blades = [
    { x: -0.07, z: 0.02, ry: 0.25, h: 0.38, lean: 0.10 },
    { x: 0.06, z: -0.03, ry: -0.65, h: 0.44, lean: 0.11 },
    { x: 0.01, z: 0.05, ry: 1.55, h: 0.33, lean: 0.08 },
  ];
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let vertOffset = 0;

  for (const b of blades) {
    const cos = Math.cos(b.ry);
    const sin = Math.sin(b.ry);
    const segs = 2;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = 0.056 * (1 - t * 0.88);
      const y = t * b.h;
      const zLocal = t * t * b.lean;
      for (const side of [-1, 1]) {
        const lx = side * w;
        const wx = b.x + lx * cos - zLocal * sin;
        const wz = b.z + lx * sin + zLocal * cos;
        positions.push(wx, y, wz);
        normals.push(-sin * 0.25, 0.92, cos * 0.25);
        uvs.push(side < 0 ? 0 : 1, t);
      }
    }
    for (let s = 0; s < segs; s++) {
      const a = vertOffset + s * 2;
      const b0 = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b0, c, b0, d, c);
    }
    vertOffset += (segs + 1) * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function makeLavenderPanicleGeometry() {
  // Multi-stem tapered lavender flower panicle cluster (not a round sphere)
  const positions = [];
  const normals = [];
  const indices = [];
  let vOff = 0;

  const stems = [
    { ox: 0.0, oz: 0.0, h: 0.44, r: 0.09, tx: 0.02, tz: -0.02 },
    { ox: -0.14, oz: 0.06, h: 0.36, r: 0.075, tx: -0.10, tz: 0.05 },
    { ox: 0.13, oz: 0.07, h: 0.38, r: 0.08, tx: 0.09, tz: 0.06 },
    { ox: -0.05, oz: -0.13, h: 0.35, r: 0.075, tx: -0.04, tz: -0.09 },
    { ox: 0.09, oz: -0.11, h: 0.34, r: 0.07, tx: 0.08, tz: -0.08 },
  ];

  const radial = 5;
  for (const st of stems) {
    // 3 rings (base, mid bulge, pointed tip)
    const rings = [
      { t: 0.0, rad: st.r * 0.55 },
      { t: 0.48, rad: st.r * 1.05 },
      { t: 0.82, rad: st.r * 0.72 },
      { t: 1.0, rad: 0.012 },
    ];
    for (let rIdx = 0; rIdx < rings.length; rIdx++) {
      const rg = rings[rIdx];
      const cy = rg.t * st.h;
      const cx = st.ox + st.tx * rg.t;
      const cz = st.oz + st.tz * rg.t;
      for (let k = 0; k <= radial; k++) {
        const a = (k / radial) * Math.PI * 2;
        const nx = Math.cos(a);
        const nz = Math.sin(a);
        positions.push(cx + nx * rg.rad, cy, cz + nz * rg.rad);
        normals.push(nx * 0.8, 0.5, nz * 0.8);
      }
    }
    const stride = radial + 1;
    for (let rIdx = 0; rIdx < rings.length - 1; rIdx++) {
      for (let k = 0; k < radial; k++) {
        const a = vOff + rIdx * stride + k;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    vOff += rings.length * stride;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

export function buildNature(lowQuality = false, colliders = null) {
  const root = new THREE.Group();
  root.name = 'nature';
  const rng = mulberry32(1974);
  const dummy = new THREE.Object3D();
  const colVar = new THREE.Color();

  // 1. Dense Instanced Swaying Meadow Grass Tufts with root-to-tip shading
  const grassSpots = [];
  const grassZones = [
    { cx: 0, cz: -4, r: 24, count: lowQuality ? 260 : 720, keepClear: [[LANDMARKS.letterPedestal.x, LANDMARKS.letterPedestal.z, 1.5], [3.6, -13.0, 2.2]] },
    { cx: LANDMARKS.meadowLanding.x, cz: LANDMARKS.meadowLanding.z, r: 23, count: lowQuality ? 280 : 780, keepClear: [[-22, -182, 2.2]] },
    { cx: LANDMARKS.flowerClearing.x, cz: LANDMARKS.flowerClearing.z, r: 19, count: lowQuality ? 160 : 400, keepClear: [] },
    { cx: LANDMARKS.windmill.x, cz: LANDMARKS.windmill.z, r: 20, count: lowQuality ? 100 : 220, keepClear: [[LANDMARKS.windmill.x, LANDMARKS.windmill.z, 4.5]] },
    { cx: LANDMARKS.detourVillage.x, cz: LANDMARKS.detourVillage.z, r: 22, count: lowQuality ? 100 : 220, keepClear: [] },
    { cx: LANDMARKS.towerPlaza.x, cz: LANDMARKS.towerPlaza.z + 24, r: 15, count: lowQuality ? 100 : 220, keepClear: [] },
  ];

  for (const z of grassZones) {
    for (let i = 0; i < z.count; i++) {
      const a = rng() * Math.PI * 2;
      const rr = Math.pow(rng(), 0.56) * z.r;
      const gx = z.cx + Math.cos(a) * rr;
      const gz = z.cz + Math.sin(a) * rr;
      if (isOverRiver(gx, gz)) continue;
      if (Math.hypot(gx - LANDMARKS.towerPlaza.x, gz - LANDMARKS.towerPlaza.z) < 20.5) continue;
      let skip = false;
      for (const [kx, kz, kr] of z.keepClear) {
        if (Math.hypot(gx - kx, gz - kz) < kr) { skip = true; break; }
      }
      if (skip) continue;
      grassSpots.push([gx, gz]);
    }
  }

  const tuftGeo = makeGrassTuftGeometry();
  const grassUniforms = { uTime: { value: 0 } };
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = grassUniforms.uTime;
    shader.vertexShader = 'uniform float uTime;\nvarying float vBladeH;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vBladeH = uv.y;
      #ifdef USE_INSTANCING
        float tip = uv.y;
        vec3 instPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float gust = sin(uTime * 1.7 + instPos.x * 0.22 + instPos.z * 0.18) * 0.5 + 0.5;
        float sway = (sin(uTime * 2.1 + instPos.x * 0.5 + instPos.z * 0.4) * 0.065 + gust * 0.055) * tip * tip;
        transformed.x += sway;
        transformed.z += sway * 0.45;
      #endif
      `
    );
    shader.fragmentShader = 'varying float vBladeH;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      diffuseColor.rgb *= mix(0.76, 1.14, vBladeH);`
    );
  };

  const grassMesh = new THREE.InstancedMesh(tuftGeo, grassMat, grassSpots.length);
  const grassTones = [0x88a16e, 0x9ab07f, 0x7c9663, 0xa5b988, 0x90a875];
  grassSpots.forEach(([gx, gz], i) => {
    const y = terrainHeight(gx, gz);
    const sc = 0.72 + rng() * 0.68;
    dummy.position.set(gx, y - 0.02, gz);
    dummy.rotation.set((rng() - 0.5) * 0.12, rng() * Math.PI * 2, (rng() - 0.5) * 0.12);
    dummy.scale.set(sc, sc * (0.82 + rng() * 0.44), sc);
    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);
    colVar.setHex(grassTones[Math.floor(rng() * grassTones.length)]);
    grassMesh.setColorAt(i, colVar);
  });
  grassMesh.instanceMatrix.needsUpdate = true;
  if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
  root.add(grassMesh);

  // 2. Non-Grid Organic Provençal Lavender Contour Furrows (varied spacing, gaps, size, tilt & hue)
  const lavPositions = [];
  const addOrganicFurrow = (xStart, xEnd, zBase, curveAmp, curveFreq, phase, densityScale = 1.0) => {
    let x = xStart;
    while (x <= xEnd) {
      const step = (lowQuality ? 3.8 : 2.35) * (0.72 + rng() * 0.75) / densityScale;
      x += step;
      if (rng() < 0.16) continue; // organic gap so rows never feel mechanical
      const z = zBase + Math.sin(x * curveFreq + phase) * curveAmp + Math.cos(x * 0.09) * 1.1 + (rng() - 0.5) * 1.15;
      const jx = x + (rng() - 0.5) * 0.95;
      if (isOverRiver(jx, z)) continue;
      if (Math.abs(jx) < 8.5 && z > -84 && z < -36) continue;
      if (Math.hypot(jx - LANDMARKS.windmill.x, z - LANDMARKS.windmill.z) < 19) continue;
      if (Math.hypot(jx - LANDMARKS.meadowLanding.x, z - LANDMARKS.meadowLanding.z) < 21) continue;
      if (Math.hypot(jx - LANDMARKS.flowerClearing.x, z - LANDMARKS.flowerClearing.z) < 14) continue;
      if (Math.hypot(jx - LANDMARKS.detourVillage.x, z - LANDMARKS.detourVillage.z) < 22) continue;
      if (Math.hypot(jx - LANDMARKS.towerPlaza.x, z - LANDMARKS.towerPlaza.z) < 24) continue;
      lavPositions.push([jx, z, 0.72 + rng() * 0.68]);
    }
  };

  // Mid-south undulating hillside patches (different contour curves on left and right slopes)
  for (let rowZ = -48; rowZ >= -124; rowZ -= (lowQuality ? 5.8 : 4.1) * (0.85 + rng() * 0.35)) {
    addOrganicFurrow(-104, -10, rowZ, 4.2, 0.042, rowZ * 0.03, 1.0);
    addOrganicFurrow(8, 102, rowZ - 1.5, 3.8, 0.038, rowZ * 0.05 + 1.4, 1.0);
  }
  // North valley hillside patches
  for (let rowZ = -196; rowZ >= -278; rowZ -= (lowQuality ? 6.0 : 4.2) * (0.85 + rng() * 0.35)) {
    addOrganicFurrow(-98, 96, rowZ, 5.2, 0.036, rowZ * 0.04 + 0.8, 0.95);
  }
  // Home garden lavender borders (clumped naturally)
  for (let i = 0; i < 22; i++) {
    const gx = (i < 11 ? -6.2 : 5.4) + (rng() - 0.5) * 3.4;
    const gz = -4.2 + (rng() - 0.5) * 5.2;
    lavPositions.push([gx, gz, 0.64 + rng() * 0.36]);
  }

  const lavBaseGeo = new THREE.DodecahedronGeometry(0.36, 0);
  lavBaseGeo.scale(1.22, 0.50, 1.05);
  const lavBaseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  const lavSpikeGeo = makeLavenderPanicleGeometry();
  const lavSpikeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84 });

  const lavBases = new THREE.InstancedMesh(lavBaseGeo, lavBaseMat, lavPositions.length);
  const spikesPerBush = 2;
  const lavSpikes = new THREE.InstancedMesh(lavSpikeGeo, lavSpikeMat, lavPositions.length * spikesPerBush);
  const lavHues = [PALETTE.lavender, PALETTE.lavenderLight, PALETTE.lavenderDeep, 0xa89bc9];
  const sageHues = [0x6f855e, 0x798f68, 0x677c58];

  let spikeIdx = 0;
  lavPositions.forEach(([x, z, s], i) => {
    const y = terrainHeight(x, z);
    const ry = rng() * Math.PI * 2;
    const sx = s * (0.88 + rng() * 0.28);
    const sz = s * (0.88 + rng() * 0.28);
    dummy.position.set(x, y + 0.12 * s, z);
    dummy.rotation.set((rng() - 0.5) * 0.14, ry, (rng() - 0.5) * 0.14);
    dummy.scale.set(sx, s, sz);
    dummy.updateMatrix();
    lavBases.setMatrixAt(i, dummy.matrix);
    colVar.setHex(sageHues[i % sageHues.length]);
    lavBases.setColorAt(i, colVar);

    const cosR = Math.cos(ry);
    const sinR = Math.sin(ry);
    for (let k = 0; k < spikesPerBush; k++) {
      const ox = (k === 0 ? -0.10 : 0.11) * sx;
      const oz = (k === 0 ? 0.05 : -0.06) * sz;
      dummy.position.set(x + ox * cosR - oz * sinR, y + 0.24 * s, z + ox * sinR + oz * cosR);
      dummy.rotation.set((rng() - 0.5) * 0.18, ry + k * 1.9, (rng() - 0.5) * 0.18);
      dummy.scale.setScalar(s * (0.92 + rng() * 0.34));
      dummy.updateMatrix();
      lavSpikes.setMatrixAt(spikeIdx, dummy.matrix);
      colVar.setHex(lavHues[Math.floor(rng() * lavHues.length)]);
      lavSpikes.setColorAt(spikeIdx, colVar);
      spikeIdx++;
    }
  });
  lavBases.instanceMatrix.needsUpdate = true;
  if (lavBases.instanceColor) lavBases.instanceColor.needsUpdate = true;
  lavSpikes.instanceMatrix.needsUpdate = true;
  if (lavSpikes.instanceColor) lavSpikes.instanceColor.needsUpdate = true;
  root.add(lavBases, lavSpikes);

  // 3 & 4. Clearance-verified Multi-Tier Cypress & Gnarled Olive Trees (zero overlap with houses/walls/other trees)
  const placedTrees = [];
  const wallSpots = [
    [-26, -62, 0.12], [-42, -78, -0.08], [28, -72, -0.15],
    [-32, -222, 0.08], [30, -218, -0.1], [-46, -245, 0.14],
  ];

  function isTreeClear(x, z, canopyR) {
    // Keep away from river channel & steep banks
    if (Math.abs(z - riverCenterZ(x)) < riverHalfWidth(x) + 3.8 + canopyR) return false;
    // Keep landing pads, home courtyard, and plaza terrace AABB clear
    if (Math.hypot(x - 0, z + 4) < 12.5) return false;
    if (Math.hypot(x - LANDMARKS.balloonPad.x, z - LANDMARKS.balloonPad.z) < 6.0 + canopyR) return false;
    if (Math.hypot(x - LANDMARKS.meadowLanding.x, z - LANDMARKS.meadowLanding.z) < 15.0 + canopyR) return false;
    if (Math.abs(x - LANDMARKS.towerPlaza.x) < 17.0 + canopyR && Math.abs(z - LANDMARKS.towerPlaza.z) < 17.0 + canopyR) return false;
    // Keep clear of bridge & pier approaches
    if (Math.hypot(x - LANDMARKS.bridge.x, z - riverCenterZ(LANDMARKS.bridge.x)) < 13.0) return false;
    if (Math.hypot(x - LANDMARKS.pier.x, z - (riverCenterZ(LANDMARKS.pier.x) + 7.2)) < 8.0) return false;
    // Keep main thermal flight line to tower open
    if (Math.abs(x - 4.0) < 6.5 && z < -275 && z > -325) return false;

    // Check against all village buildings, walls, and props (exact box AABB + circle clearance)
    if (colliders) {
      for (const b of colliders.boxes) {
        const hw = Math.abs(b.hx * b.cos) + Math.abs(b.hz * b.sin);
        const hd = Math.abs(b.hx * b.sin) + Math.abs(b.hz * b.cos);
        if (Math.abs(x - b.cx) < hw + canopyR + 0.6 && Math.abs(z - b.cz) < hd + canopyR + 0.6) {
          return false;
        }
      }
      for (const c of colliders.treeClearanceCircles) {
        if (Math.hypot(x - c.x, z - c.z) < c.r + canopyR + 1.2) return false;
      }
    }
    // Check against hillside terrace walls
    for (const [wx, wz] of wallSpots) {
      if (Math.hypot(x - wx, z - wz) < 6.2 + canopyR) return false;
    }
    // Check against previously placed trees
    for (const t of placedTrees) {
      if (Math.hypot(x - t.x, z - t.z) < t.r + canopyR + 0.9) return false;
    }
    return true;
  }

  function findClearTreePos(x, z, canopyR, allowNudge) {
    if (isTreeClear(x, z, canopyR)) return [x, z];
    if (!allowNudge) return null;
    for (const rad of [3.5, 5.5, 8.0, 11.0]) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const cx = x + Math.cos(a) * rad;
        const cz = z + Math.sin(a) * rad;
        if (isTreeClear(cx, cz, canopyR)) return [cx, cz];
      }
    }
    return null;
  }

  const cypressData = [];
  const cypressCandidates = [
    [-12, -2], [-15, -14], [11, -10], [15, -18], [-22, -32], [22, -36],
    [-12, -75], [14, -84], [-18, -125], [22, -135],
    [LANDMARKS.meadowLanding.x - 16, LANDMARKS.meadowLanding.z + 11],
    [LANDMARKS.meadowLanding.x + 17, LANDMARKS.meadowLanding.z - 12],
    [LANDMARKS.meadowLanding.x - 17, LANDMARKS.meadowLanding.z - 14],
    [LANDMARKS.meadowLanding.x + 16, LANDMARKS.meadowLanding.z + 11],
    [LANDMARKS.windmill.x - 14, LANDMARKS.windmill.z + 8],
    [LANDMARKS.windmill.x + 12, LANDMARKS.windmill.z - 11],
    [LANDMARKS.detourVillage.x - 16, LANDMARKS.detourVillage.z - 8],
    [LANDMARKS.detourVillage.x + 15, LANDMARKS.detourVillage.z + 10],
    [LANDMARKS.towerPlaza.x - 22, LANDMARKS.towerPlaza.z + 11],
    [LANDMARKS.towerPlaza.x + 22, LANDMARKS.towerPlaza.z + 10],
    [LANDMARKS.towerPlaza.x - 16, LANDMARKS.towerPlaza.z - 22],
    [LANDMARKS.towerPlaza.x + 16, LANDMARKS.towerPlaza.z - 21],
    [LANDMARKS.towerPlaza.x - 11, LANDMARKS.towerPlaza.z - 26],
    [LANDMARKS.towerPlaza.x + 11, LANDMARKS.towerPlaza.z - 24],
  ];
  for (let i = 0; i < (lowQuality ? 18 : 38); i++) {
    cypressCandidates.push([(rng() - 0.5) * 280, -35 - rng() * 320]);
  }
  cypressCandidates.forEach(([cx, cz], idx) => {
    const s = 0.78 + rng() * 0.56;
    const ry = rng() * 6;
    const tilt = (rng() - 0.5) * 0.04;
    const canopyR = 1.35 * s;
    const pos = findClearTreePos(cx, cz, canopyR, idx < 24);
    if (!pos) return;
    placedTrees.push({ x: pos[0], z: pos[1], r: canopyR });
    cypressData.push({ x: pos[0], z: pos[1], s, ry, tilt });
  });

  const cypTrunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.8, 6);
  const cypTrunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.woodWarm, roughness: 0.9 });
  const cypTierGeo = new THREE.DodecahedronGeometry(1.0, 1);
  cypTierGeo.scale(0.88, 1.95, 0.88);
  const cypCrownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });
  const cypTones = [PALETTE.cypressLeaf, 0x526b44, 0x667f55];

  const cypTrunks = new THREE.InstancedMesh(cypTrunkGeo, cypTrunkMat, cypressData.length);
  const cypTiers = new THREE.InstancedMesh(cypTierGeo, cypCrownMat, cypressData.length * 3);
  cypressData.forEach(({ x, z, s, ry, tilt }, i) => {
    const y = rawTerrainHeight(x, z);
    dummy.position.set(x, y + 0.9 * s, z);
    dummy.rotation.set(tilt, ry, -tilt);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    cypTrunks.setMatrixAt(i, dummy.matrix);

    const tone = cypTones[i % cypTones.length];
    const tierSpecs = [
      { dy: 2.75, sx: 1.05, sy: 1.05 },
      { dy: 4.55, sx: 0.82, sy: 1.15 },
      { dy: 6.25, sx: 0.52, sy: 1.05 },
    ];
    tierSpecs.forEach((t, ti) => {
      dummy.position.set(x, y + t.dy * s, z);
      dummy.rotation.set(tilt, ry + ti * 1.1, -tilt);
      dummy.scale.set(s * t.sx, s * t.sy, s * t.sx);
      dummy.updateMatrix();
      cypTiers.setMatrixAt(i * 3 + ti, dummy.matrix);
      colVar.setHex(tone);
      cypTiers.setColorAt(i * 3 + ti, colVar);
    });
    if (colliders) {
      colliders.addCylinder({ x, z, r: 0.85 * s, minY: y, maxY: y + 7.6 * s, kind: 'tree', label: 'cypress' + i, blockTrees: false });
    }
  });
  cypTrunks.castShadow = !lowQuality;
  cypTiers.castShadow = !lowQuality;
  if (cypTiers.instanceColor) cypTiers.instanceColor.needsUpdate = true;
  root.add(cypTrunks, cypTiers);

  // 4. Gnarled Provençal Olive Trees (silver-sage canopies with natural variation)
  const oliveData = [];
  const oliveCandidates = [
    [-14, 9], [11, 7], [-24, 6], [24, -14],
    [LANDMARKS.meadowLanding.x - 16, LANDMARKS.meadowLanding.z - 11],
    [LANDMARKS.meadowLanding.x + 15, LANDMARKS.meadowLanding.z + 10],
    [LANDMARKS.meadowLanding.x + 16, LANDMARKS.meadowLanding.z - 10],
    [LANDMARKS.meadowLanding.x - 14, LANDMARKS.meadowLanding.z + 13],
    [-28, -148], [26, -162], [-34, -210], [-14, -238],
    [42, -96], [-48, -82], [52, -235],
    [LANDMARKS.towerPlaza.x - 20, LANDMARKS.towerPlaza.z + 14],
    [LANDMARKS.towerPlaza.x + 20, LANDMARKS.towerPlaza.z + 13],
  ];
  for (let i = 0; i < (lowQuality ? 16 : 32); i++) {
    oliveCandidates.push([(rng() - 0.5) * 260, -30 - rng() * 300]);
  }
  oliveCandidates.forEach(([ox, oz], idx) => {
    const s = 0.84 + rng() * 0.52;
    const ry = rng() * 6;
    const canopyR = 3.55 * s;
    const pos = findClearTreePos(ox, oz, canopyR, idx < 17);
    if (!pos) return;
    placedTrees.push({ x: pos[0], z: pos[1], r: canopyR });
    oliveData.push({ x: pos[0], z: pos[1], s, ry });
  });

  const olTrunkGeo = new THREE.CylinderGeometry(0.21, 0.36, 2.3, 6);
  const olCrownGeo = new THREE.IcosahedronGeometry(1.40, 1);
  olCrownGeo.scale(1.25, 0.76, 1.15);
  const olCrownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });
  const olTones = [PALETTE.oliveLeaf, 0x7d9767, 0x6a8455];

  const olTrunks = new THREE.InstancedMesh(olTrunkGeo, cypTrunkMat, oliveData.length);
  const olCrowns = new THREE.InstancedMesh(olCrownGeo, olCrownMat, oliveData.length * 4);
  oliveData.forEach(({ x, z, s, ry }, i) => {
    const y = rawTerrainHeight(x, z);
    dummy.position.set(x, y + 1.05 * s, z);
    dummy.rotation.set(0.08, ry, -0.06);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    olTrunks.setMatrixAt(i, dummy.matrix);

    const lobes = [
      { ox: 0, oy: 3.0, oz: 0, sc: 1.04 },
      { ox: 0.88, oy: 2.55, oz: 0.42, sc: 0.78 },
      { ox: -0.82, oy: 2.62, oz: -0.35, sc: 0.82 },
      { ox: 0.15, oy: 2.48, oz: -0.75, sc: 0.68 },
    ];
    const tone = olTones[i % olTones.length];
    lobes.forEach((l, li) => {
      dummy.position.set(x + l.ox * s, y + l.oy * s, z + l.oz * s);
      dummy.rotation.set(0, ry + li * 1.4, 0);
      dummy.scale.setScalar(s * l.sc);
      dummy.updateMatrix();
      olCrowns.setMatrixAt(i * 4 + li, dummy.matrix);
      colVar.setHex(tone);
      olCrowns.setColorAt(i * 4 + li, colVar);
    });
    if (colliders) {
      colliders.addCylinder({ x, z, r: 0.48 * s, minY: y, maxY: y + 2.2 * s, kind: 'treeTrunk', label: 'oliveTrunk' + i, blockTrees: false });
      colliders.addSphere({ x, y: y + 2.9 * s, z, r: 2.25 * s, kind: 'treeCanopy', label: 'oliveCrown' + i });
    }
  });
  olTrunks.castShadow = !lowQuality;
  olCrowns.castShadow = !lowQuality;
  if (olCrowns.instanceColor) olCrowns.instanceColor.needsUpdate = true;
  root.add(olTrunks, olCrowns);

  // 5. Naturally Scattered Wildflower Drifts (varied sizes, tilts, heights, 5 harmonized hues, ZERO grid!)
  const flowerCoords = [];
  const clusters = [
    { x: -3.8, z: -2.5, r: 7.5, n: 48 },
    { x: 4.2, z: -11.5, r: 8.0, n: 36 },
    { x: LANDMARKS.meadowLanding.x, z: LANDMARKS.meadowLanding.z, r: 19, n: 150 },
    { x: LANDMARKS.flowerClearing.x, z: LANDMARKS.flowerClearing.z, r: 15, n: 90 },
    { x: LANDMARKS.towerPlaza.x + 2, z: LANDMARKS.towerPlaza.z + 23, r: 12, n: 45 },
  ];
  for (const cl of clusters) {
    const count = lowQuality ? Math.floor(cl.n * 0.48) : cl.n;
    for (let i = 0; i < count; i++) {
      // Cluster into organic sub-drifts rather than uniform circles
      const subAng = Math.floor(rng() * 5) * 1.25;
      const subR = rng() * cl.r * 0.45;
      const a = rng() * Math.PI * 2;
      const rr = 1.4 + Math.pow(rng(), 0.72) * (cl.r - 1.4);
      const fx = cl.x + Math.cos(a) * rr + Math.cos(subAng) * subR * 0.35;
      const fz = cl.z + Math.sin(a) * rr + Math.sin(subAng) * subR * 0.35;
      if (isOverRiver(fx, fz)) continue;
      if (Math.hypot(fx - LANDMARKS.towerPlaza.x, fz - LANDMARKS.towerPlaza.z) < 20.0) continue;
      flowerCoords.push([fx, fz, 0.58 + rng() * 0.78]);
    }
  }
  const stemGeo = new THREE.CylinderGeometry(0.011, 0.017, 0.16, 4);
  const stemMat = new THREE.MeshStandardMaterial({ color: PALETTE.oliveLeaf, roughness: 0.88 });
  const flBloomGeo = new THREE.DodecahedronGeometry(0.082, 0);
  flBloomGeo.scale(1.25, 0.52, 1.15);
  const flBloomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.80 });

  const flStems = new THREE.InstancedMesh(stemGeo, stemMat, flowerCoords.length);
  const flBlooms = new THREE.InstancedMesh(flBloomGeo, flBloomMat, flowerCoords.length);
  const paletteChoices = [
    PALETTE.cream,
    PALETTE.lavenderLight,
    PALETTE.apricotSoft,
    PALETTE.creamWarm,
    0xaacbe0, // pale sky chicory
  ];
  flowerCoords.forEach(([x, z, s], i) => {
    const y = terrainHeight(x, z);
    const tiltX = (rng() - 0.5) * 0.28;
    const tiltZ = (rng() - 0.5) * 0.28;
    const ry = rng() * Math.PI * 2;
    dummy.position.set(x, y + 0.07 * s, z);
    dummy.rotation.set(tiltX, ry, tiltZ);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    flStems.setMatrixAt(i, dummy.matrix);

    dummy.position.set(x + tiltZ * 0.05, y + 0.14 * s, z - tiltX * 0.05);
    dummy.rotation.set(tiltX, ry, tiltZ);
    dummy.scale.set(s * (0.85 + rng() * 0.35), s, s * (0.85 + rng() * 0.35));
    dummy.updateMatrix();
    flBlooms.setMatrixAt(i, dummy.matrix);
    colVar.setHex(paletteChoices[Math.floor(rng() * paletteChoices.length)]);
    flBlooms.setColorAt(i, colVar);
  });
  flStems.instanceMatrix.needsUpdate = true;
  flBlooms.instanceMatrix.needsUpdate = true;
  if (flBlooms.instanceColor) flBlooms.instanceColor.needsUpdate = true;
  root.add(flStems, flBlooms);

  // 6. Weathered Dry-Stone Hillside Terrace Walls (contour-aligned segments hugging terrain)
  const wallTex = makeLimestoneTextures();
  wallTex.map.repeat.set(1.0, 1);
  wallTex.bumpMap.repeat.set(1.0, 1);
  const wallSegLen = 1.95;
  const wallGeo = new THREE.BoxGeometry(wallSegLen, 0.88, 0.58);
  const wallMat = new THREE.MeshStandardMaterial({
    color: PALETTE.limestone,
    map: wallTex.map,
    bumpMap: wallTex.bumpMap,
    bumpScale: 0.04,
    roughness: 0.92,
  });
  wallSpots.forEach(([wx, wz], wIdx) => {
    // Orient wall perpendicular to local hillside gradient: tangent (cos, -sin) . (dhx, dhz) = 0 => rot = atan2(dhx, dhz)
    const dhx = rawTerrainHeight(wx + 1.0, wz) - rawTerrainHeight(wx - 1.0, wz);
    const dhz = rawTerrainHeight(wx, wz + 1.0) - rawTerrainHeight(wx, wz - 1.0);
    const rot = Math.atan2(dhx, dhz);
    const cos = Math.cos(rot), sin = Math.sin(rot);
    for (let s = 0; s < 3; s++) {
      const along = (s - 1) * (wallSegLen + 1.15);
      const sx = wx + cos * along;
      const sz = wz - sin * along;
      const hA = rawTerrainHeight(sx - cos * 0.9, sz + sin * 0.9);
      const hB = rawTerrainHeight(sx + cos * 0.9, sz - sin * 0.9);
      const baseH = Math.min(hA, hB, rawTerrainHeight(sx, sz));
      const m = new THREE.Mesh(wallGeo, wallMat);
      m.position.set(sx, baseH + 0.44, sz);
      m.rotation.y = rot;
      if (!lowQuality) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      root.add(m);
      if (colliders) {
        colliders.addBox({ cx: sx, cz: sz, w: wallSegLen, d: 0.62, rotY: rot, minY: baseH, maxY: baseH + 0.88, kind: 'wall', label: 'terraceWall' + wIdx });
      }
    }
  });

  return {
    group: root,
    update(time) {
      grassUniforms.uTime.value = time;
    },
  };
}
