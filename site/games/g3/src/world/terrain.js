import * as THREE from '../../lib/three.module.js';
import { HARBOR_ORIGIN, ISLANDS, PALETTE, PAVILION_POS, REEFS } from '../core/env.js';
import { clamp, lerp, smoothstep } from '../core/math.js';

// Shared deck & pier footprint definitions (used consistently by terrain, harbor, islands, and colliders).
export const HARBOR_DECKS = [
  { name: 'promenade', x: 0, z: -123.625, w: 60.0, d: 18.75, topY: 1.04, baseBottom: -1.35, deckThick: 0.275 },
  { name: 'leftWing', x: -18.5, z: -106.875, w: 11.0, d: 14.75, topY: 1.04, baseBottom: -1.35, deckThick: 0.275 },
  { name: 'rightWing', x: 20.5, z: -106.875, w: 12.0, d: 14.75, topY: 1.04, baseBottom: -1.35, deckThick: 0.275 },
  { name: 'jetty', x: 3.8, z: -110.775, w: 3.4, d: 6.95, topY: 1.04, baseBottom: -1.25, deckThick: 0.275 },
  { name: 'bw1', x: -22.0, z: -93.0, w: 3.4, d: 13.0, topY: 0.90, baseBottom: -1.25, deckThick: 0.245 },
  { name: 'bw2', x: -15.15, z: -88.2, w: 10.3, d: 3.4, topY: 0.90, baseBottom: -1.25, deckThick: 0.245 },
];

export const PAVILION_TERRACE = { x: PAVILION_POS.x, z: PAVILION_POS.z - 1.5, r: 7.8, topY: 1.07 };
export const PAVILION_JETTY = { x: -1.6, z: 180.3, w: 2.6, d: 3.6, topY: 0.92 };

export function getPierDeckSegment(dockPos, walkPos) {
  const dx = walkPos.x - dockPos.x;
  const dz = walkPos.z - dockPos.z;
  const fullLen = Math.hypot(dx, dz);
  const berthGap = 2.8;
  const len = Math.max(3.6, fullLen - berthGap);
  const ux = fullLen > 1e-4 ? dx / fullLen : 0;
  const uz = fullLen > 1e-4 ? dz / fullLen : 1;
  const startX = dockPos.x + ux * berthGap;
  const startZ = dockPos.z + uz * berthGap;
  const ang = Math.atan2(dx, dz);
  return {
    startX,
    startZ,
    endX: walkPos.x,
    endZ: walkPos.z,
    len,
    ang,
    halfW: 1.3,
    topY: 0.735,
  };
}

function pointToSegmentDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  const t = lenSq > 1e-5 ? clamp((wx * vx + wz * vz) / lenSq, 0, 1) : 0;
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
}

// Natural un-padded terrain height query (used to compute house pad elevations cleanly).
function getRawLandInfo(x, z) {
  let maxY = -4.0;
  let zone = 'sea';
  let islandId = null;

  // 1. Harbor Town quay, wings, jetty, breakwater & hillside
  if (z < -83 && Math.abs(x) < 64) {
    const shoreZ = -115.5 + Math.cos(x * 0.045) * 1.4;
    if (z <= shoreZ + 2.5) {
      const bank = smoothstep(shoreZ + 2.5, shoreZ - 2.2, z);
      const backSlope = z < -130 ? smoothstep(-130, -165, z) * 6.5 : 0;
      const sideHill = smoothstep(26, 56, Math.abs(x)) * 3.8;
      const h = -1.5 + bank * 2.4 + backSlope + sideHill;
      if (h > maxY) {
        maxY = h;
        zone = z <= shoreZ ? 'harbor' : 'shallows';
      }
    }

    // Exact harbor stone decks (promenade, left/right wings, jetty, breakwaters)
    for (const dk of HARBOR_DECKS) {
      if (Math.abs(x - dk.x) <= dk.w * 0.5 && Math.abs(z - dk.z) <= dk.d * 0.5) {
        if (dk.topY > maxY) {
          maxY = dk.topY;
          zone = 'harbor';
        }
      }
    }

    // Harbor hillside stair ramp (x in [0.4, 3.6], z in [-136.5, -131.0])
    if (x >= 0.4 && x <= 3.6 && z >= -136.5 && z <= -131.0) {
      const rampT = smoothstep(-131.0, -136.0, z);
      const rampH = 1.04 + rampT * 1.48;
      if (rampH > maxY) {
        maxY = rampH;
        zone = 'harbor';
      }
    }
  }

  // 2. Three Walkable Archipelago Islands
  for (const isl of ISLANDS) {
    const dx = x - isl.center.x;
    const dz = z - isl.center.z;
    const angle = Math.atan2(dz, dx);
    const lobe = 1.0 + 0.12 * Math.cos(angle * 3.0 + (isl.id === 'windmill' ? 1.1 : 0.3)) +
      0.07 * Math.sin(angle * 2.0 - 0.8);
    const r = Math.hypot(dx, dz) / lobe;

    if (r < isl.radius + 2.5) {
      const beach = smoothstep(isl.radius + 1.8, isl.radius - 4.2, r);
      const hill = smoothstep(isl.radius - 2.5, 3.0, r);
      let terrace = hill;
      if (isl.id === 'windmill') {
        terrace = (Math.floor(hill * 4.5) / 4.5) * 0.32 + hill * 0.68;
      }
      let h = -2.4 + beach * 3.05 + terrace * (isl.peakY - 0.65);

      if (isl.id === 'lighthouse') {
        const bluffD = Math.hypot(x - isl.detourPos.x, z - isl.detourPos.z);
        h = Math.max(h, 3.6 * smoothstep(9.0, 2.5, bluffD));
      }
      if (isl.id === 'windmill') {
        const coveD = Math.hypot(x - isl.detourPos.x, z - isl.detourPos.z);
        if (coveD < 9.0) {
          h = h * (1 - smoothstep(9.0, 3.5, coveD) * 0.55) + 0.65 * smoothstep(9.0, 3.5, coveD);
        }
      }

      if (h > maxY) {
        maxY = h;
        zone = h >= 0.25 ? 'island' : 'shallows';
        islandId = isl.id;
      }
    }

    // Main pier deck
    const seg = getPierDeckSegment(isl.dockPos, isl.walkLanding);
    const dDock = pointToSegmentDist(x, z, seg.startX, seg.startZ, seg.endX, seg.endZ);
    if (dDock <= seg.halfW) {
      if (seg.topY > maxY) {
        maxY = seg.topY;
        zone = 'island';
        islandId = isl.id;
      }
    }
    if (isl.altDockPos) {
      const altWalk = { x: isl.center.x + 2, z: isl.center.z - 16 };
      const altSeg = getPierDeckSegment(isl.altDockPos, altWalk);
      const dAlt = pointToSegmentDist(x, z, altSeg.startX, altSeg.startZ, altSeg.endX, altSeg.endZ);
      if (dAlt <= altSeg.halfW) {
        if (altSeg.topY > maxY) {
          maxY = altSeg.topY;
          zone = 'island';
          islandId = isl.id;
        }
      }
    }
  }

  // 3. Goal: Starlit Cove Pavilion (terrace centered at z = 188.5, landing jetty at (-1.6, 180.3))
  {
    const dx = x - PAVILION_TERRACE.x;
    const dz = z - PAVILION_TERRACE.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 50) {
      const coveD = Math.hypot(x, z - 178.0);
      let h = -2.6;
      if (dist <= PAVILION_TERRACE.r) {
        h = Math.max(h, PAVILION_TERRACE.topY);
      }
      if (dz > -1.5 && dist > 11.0 && dist < 44) {
        const arm = smoothstep(-1.5, 12.0, dz) * smoothstep(44, 29, dist) * smoothstep(11.0, 19.0, coveD);
        h = Math.max(h, arm * 7.4);
      }
      if (
        Math.abs(x - PAVILION_JETTY.x) <= PAVILION_JETTY.w * 0.5 &&
        Math.abs(z - PAVILION_JETTY.z) <= PAVILION_JETTY.d * 0.5
      ) {
        h = Math.max(h, PAVILION_JETTY.topY);
      }
      if (h > maxY) {
        maxY = h;
        zone = h >= 0.25 ? 'pavilion' : 'shallows';
      }
    }
  }

  // 4. Sea reefs
  for (const rf of REEFS) {
    const d = Math.hypot(x - rf.x, z - rf.z);
    if (d < rf.r + 2.5) {
      const h = -1.2 + (rf.h + 1.2) * smoothstep(rf.r + 2.0, 0.5, d);
      if (h > maxY) {
        maxY = h;
        zone = h >= 0.15 ? 'reef' : 'shallows';
      }
    }
  }

  return { y: maxY, zone, islandId };
}

// Level building pads on sloped ground so every house & tower sits flush with zero floating corners.
const TERRACE_PADS = (() => {
  const lh = ISLANDS[0].center;
  const wm = ISLANDS[1].center;
  const cv = ISLANDS[2].center;
  const specs = [
    // Harbor hillside houses
    { x: -28.0, z: -133.5, hx: 3.4, hz: 2.4, ry: 0.08 },
    { x: 31.2, z: -133.5, hx: 3.4, hz: 2.4, ry: -0.12 },
    { x: -22.2, z: -143.5, hx: 2.8, hz: 2.6, ry: 0.14 },
    { x: -10.0, z: -142.8, hx: 2.9, hz: 2.7, ry: 0.06 },
    { x: 3.0, z: -143.5, hx: 3.2, hz: 2.3, ry: -0.04 },
    { x: 15.2, z: -142.5, hx: 4.2, hz: 2.4, ry: -0.14 },
    { x: 26.8, z: -144.2, hx: 2.8, hz: 2.6, ry: -0.20 },
    // Lighthouse Island
    { x: lh.x - 2.0, z: lh.z + 1.0, hx: 3.1, hz: 3.1, ry: 0 },
    { x: lh.x + 6.5, z: lh.z - 7.5, hx: 2.6, hz: 3.2, ry: 0.55 },
    { x: lh.x + 11.5, z: lh.z + 6.8, hx: 2.8, hz: 2.0, ry: -0.75 },
    { x: lh.x - 9.5, z: lh.z + 11.5, hx: 2.3, hz: 2.0, ry: 0.25 },
    // Windmill Island
    { x: wm.x + 1.5, z: wm.z - 2.0, hx: 3.3, hz: 3.3, ry: Math.PI * 0.68 },
    { x: wm.x - 8.5, z: wm.z + 6.2, hx: 2.4, hz: 2.8, ry: -0.5 },
    { x: wm.x + 10.5, z: wm.z - 7.5, hx: 2.4, hz: 2.6, ry: 0.6 },
    { x: wm.x - 11.8, z: wm.z - 7.2, hx: 2.2, hz: 1.9, ry: -0.9 },
    // Cove Village Island
    { x: cv.x + 3.5, z: cv.z + 6.5, hx: 2.5, hz: 3.0, ry: -1.1 },
    { x: cv.x - 6.5, z: cv.z - 6.5, hx: 3.0, hz: 2.2, ry: -0.6 },
    { x: cv.x - 14.5, z: cv.z + 2.5, hx: 3.8, hz: 2.6, ry: 0.4 },
    { x: cv.x + 6.5, z: cv.z - 8.5, hx: 2.3, hz: 2.0, ry: -1.4 },
    { x: cv.x + 12.0, z: cv.z + 4.8, hx: 2.3, hz: 2.7, ry: -0.8 },
  ];
  return specs.map((s) => ({
    ...s,
    cos: Math.cos(-s.ry),
    sin: Math.sin(-s.ry),
    y: Math.max(0.95, getRawLandInfo(s.x, s.z).y),
  }));
})();

// Deterministic terrain height & walkability queries for Harbor, Islands, and Pavilion Cove.
export function getLandInfo(x, z) {
  const info = getRawLandInfo(x, z);
  if (info.zone !== 'harbor' && info.zone !== 'island') return info;

  let y = info.y;
  for (const pad of TERRACE_PADS) {
    const dx = x - pad.x;
    const dz = z - pad.z;
    if (Math.abs(dx) > pad.hx + 3.0 || Math.abs(dz) > pad.hz + 3.0) continue;
    const lx = dx * pad.cos - dz * pad.sin;
    const lz = dx * pad.sin + dz * pad.cos;
    const ex = Math.max(0, Math.abs(lx) - pad.hx);
    const ez = Math.max(0, Math.abs(lz) - pad.hz);
    const d = Math.hypot(ex, ez);
    if (d < 1.8) {
      const k = smoothstep(1.8, 0.0, d);
      y = lerp(y, pad.y, k);
    }
  }
  return { y, zone: info.zone, islandId: info.islandId };
}

export function getGroundY(x, z) {
  return getLandInfo(x, z).y;
}

// Builds vertex-colored & normal-mapped terrain meshes plus stone quay/terrace/pier foundations.
export function buildTerrainGroup({ lowQuality = false, textures = null } = {}) {
  const group = new THREE.Group();
  group.name = 'terrain';

  const islandMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.90,
    metalness: 0.02,
    normalMap: textures && !lowQuality ? textures.terrainNorm : null,
    normalScale: new THREE.Vector2(0.55, 0.55),
  });

  const cSand = new THREE.Color(PALETTE.sand);
  const cSandWet = new THREE.Color(0xcabaa0);
  const cStone = new THREE.Color(PALETTE.stoneLight);
  const cOlive = new THREE.Color(PALETTE.olive);
  const cOliveLight = new THREE.Color(PALETTE.oliveLight);
  const cTerracotta = new THREE.Color(PALETTE.terracotta);

  const makePatchMesh = (cx, cz, sizeX, sizeZ, segs) => {
    const geo = new THREE.PlaneGeometry(sizeX, sizeZ, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + cx;
      const wz = pos.getZ(i) + cz;
      const info = getLandInfo(wx, wz);
      let meshY = info.y;
      // Keep natural terrain patch safely below architectural stone decks to prevent Z-fighting
      if (info.zone === 'harbor' && wz >= -133.2 && wz <= -86.0 && Math.abs(wx) < 30.2) {
        let onDeck = false;
        for (const dk of HARBOR_DECKS) {
          if (Math.abs(wx - dk.x) <= dk.w * 0.5 + 0.4 && Math.abs(wz - dk.z) <= dk.d * 0.5 + 0.4) {
            onDeck = true;
            break;
          }
        }
        if (onDeck) meshY = Math.min(meshY, 0.55);
      }
      if (info.zone === 'pavilion' && Math.hypot(wx, wz - PAVILION_TERRACE.z) < 9.5) {
        meshY = Math.min(meshY, -0.35);
      }
      pos.setY(i, meshY);

      const mottle = Math.sin(wx * 0.27 + wz * 0.19) * 0.5 + Math.cos(wx * 0.14 - wz * 0.31) * 0.5;

      if (info.y < 0.22) {
        col.copy(cSandWet);
      } else if (info.y < 0.65) {
        col.copy(cSandWet).lerp(cSand, smoothstep(0.22, 0.65, info.y));
      } else if (info.y < 1.55) {
        col.copy(cSand).lerp(cStone, smoothstep(0.65, 1.55, info.y));
      } else if (info.y < 3.6) {
        col.copy(cStone).lerp(cOlive, smoothstep(1.35, 3.3, info.y));
        col.lerp(cOliveLight, clamp(mottle * 0.25 + 0.15, 0, 0.35));
      } else {
        col.copy(cOlive).lerp(cOliveLight, clamp(mottle * 0.35 + 0.25, 0, 0.55));
        col.lerp(cStone, 0.18 + 0.12 * Math.sin(wx * 0.25));
      }

      if (info.zone === 'harbor' && info.y > 0.7 && info.y < 1.4) {
        col.lerp(cStone, 0.7).lerp(cTerracotta, 0.08);
      }

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, islandMat);
    mesh.position.set(cx, 0, cz);
    mesh.receiveShadow = !lowQuality;
    mesh.castShadow = !lowQuality;
    return mesh;
  };

  const patchSegs = lowQuality ? 48 : 80;
  group.add(makePatchMesh(HARBOR_ORIGIN.x, -138, 128, 72, patchSegs));

  for (const isl of ISLANDS) {
    group.add(makePatchMesh(isl.center.x, isl.center.z, 74, 74, lowQuality ? 42 : 72));
  }

  group.add(makePatchMesh(PAVILION_POS.x, PAVILION_POS.z + 4, 96, 76, lowQuality ? 42 : 72));

  // Stone seawall & pier foundations below surface deck slabs (sit in seabed, never overlapping top slabs)
  const stoneWallMat = new THREE.MeshStandardMaterial({
    color: 0xc2bbb0,
    roughness: 0.9,
    metalness: 0.03,
    map: textures?.stoneWallMap || null,
    normalMap: textures && !lowQuality ? textures.stoneWallNorm : null,
    normalScale: new THREE.Vector2(0.85, 0.85),
  });
  const woodPileMat = new THREE.MeshStandardMaterial({
    color: 0xb08462,
    roughness: 0.82,
    map: textures?.woodMap || null,
  });

  for (const dk of HARBOR_DECKS) {
    const slabBot = dk.topY - dk.deckThick - 0.005;
    const h = slabBot - dk.baseBottom;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(dk.w, h, dk.d), stoneWallMat);
    wall.position.set(dk.x, dk.baseBottom + h * 0.5, dk.z);
    wall.receiveShadow = !lowQuality;
    group.add(wall);
  }

  // Pavilion circular stone base & landing jetty foundation
  const pavBaseTop = PAVILION_TERRACE.topY - 0.14;
  const pavBaseH = pavBaseTop - (-1.05);
  const pavBase = new THREE.Mesh(
    new THREE.CylinderGeometry(PAVILION_TERRACE.r - 0.15, PAVILION_TERRACE.r + 0.35, pavBaseH, 32),
    stoneWallMat
  );
  pavBase.position.set(PAVILION_TERRACE.x, -1.05 + pavBaseH * 0.5, PAVILION_TERRACE.z);
  pavBase.receiveShadow = !lowQuality;
  group.add(pavBase);

  const pavJTop = PAVILION_JETTY.topY - 0.14;
  const pavJH = pavJTop - (-1.05);
  const pavJBase = new THREE.Mesh(
    new THREE.BoxGeometry(PAVILION_JETTY.w, pavJH, PAVILION_JETTY.d),
    stoneWallMat
  );
  pavJBase.position.set(PAVILION_JETTY.x, -1.05 + pavJH * 0.5, PAVILION_JETTY.z);
  pavJBase.receiveShadow = !lowQuality;
  group.add(pavJBase);

  // Island wooden pier underwater pilings (below deck bottom y=0.455)
  const addPierPilings = (dockPos, walkPos) => {
    const seg = getPierDeckSegment(dockPos, walkPos);
    const dirX = Math.sin(seg.ang);
    const dirZ = Math.cos(seg.ang);
    const nx = Math.cos(seg.ang);
    const nz = -Math.sin(seg.ang);
    for (let d = 0.6; d <= seg.len - 0.4; d += 2.2) {
      for (const sx of [-1.02, 1.02]) {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.45, 7), woodPileMat);
        pile.position.set(
          seg.startX + dirX * d + nx * sx,
          -0.27,
          seg.startZ + dirZ * d + nz * sx
        );
        group.add(pile);
      }
    }
  };
  for (const isl of ISLANDS) {
    addPierPilings(isl.dockPos, isl.walkLanding);
    if (isl.altDockPos) {
      addPierPilings(isl.altDockPos, { x: isl.center.x + 2, z: isl.center.z - 16 });
    }
  }

  // Stone sea reefs with rock normal shading
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  const rockMat = new THREE.MeshStandardMaterial({
    color: PALETTE.stone,
    roughness: 0.9,
    metalness: 0.04,
    normalMap: textures && !lowQuality ? textures.stoneNorm : null,
    normalScale: new THREE.Vector2(0.85, 0.85),
  });
  for (const rf of REEFS) {
    const rGroup = new THREE.Group();
    rGroup.position.set(rf.x, -0.2, rf.z);
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(rockGeo, rockMat);
      const a = k * 2.1 + rf.x;
      m.position.set(Math.cos(a) * rf.r * 0.28, k === 0 ? rf.h * 0.35 : rf.h * 0.12, Math.sin(a) * rf.r * 0.28);
      m.scale.set(rf.r * (0.55 - k * 0.1), rf.h * (0.65 - k * 0.15), rf.r * (0.48 - k * 0.08));
      m.rotation.set(0.2 * k, a, 0.15 * k);
      m.castShadow = !lowQuality;
      m.receiveShadow = !lowQuality;
      rGroup.add(m);
    }
    group.add(rGroup);
  }

  return group;
}
