import * as THREE from '../../lib/three.module.js';
import { HARBOR_ORIGIN, ISLANDS, PALETTE, PAVILION_POS, REEFS } from '../core/env.js';
import { clamp, smoothstep } from '../core/math.js';

// Deterministic terrain height & walkability queries for Harbor, Islands, and Pavilion Cove.
export function getLandInfo(x, z) {
  let maxY = -4.0;
  let zone = 'sea';
  let islandId = null;

  // 1. Harbor Town quay & hillside (z <= -114)
  if (z < -105 && Math.abs(x) < 62) {
    const shoreZ = -115.5 + Math.cos(x * 0.045) * 1.4;
    if (z <= shoreZ + 2.5) {
      const bank = smoothstep(shoreZ + 2.5, shoreZ - 2.2, z);
      const backSlope = z < -130 ? smoothstep(-130, -165, z) * 6.5 : 0;
      const sideHill = smoothstep(26, 56, Math.abs(x)) * 3.8;
      let h = -1.5 + bank * 2.4 + backSlope + sideHill;
      if (z <= -114.6 && z >= -132.5 && Math.abs(x) < 29) {
        h = Math.max(h, 1.02);
      }
      if (Math.abs(x - 3.8) < 1.7 && z <= -107.4 && z >= -116.5) {
        h = Math.max(h, 1.04);
      }
      if (h > maxY) {
        maxY = h;
        zone = z <= shoreZ ? 'harbor' : 'shallows';
      }
    }
    const bwDist = Math.min(
      Math.hypot(x - (-17), clamp(z, -116, -96) - z),
      Math.hypot(clamp(x, -17, -4) - x, z - (-96))
    );
    if (bwDist < 2.2) {
      const bwH = 0.72 * smoothstep(2.2, 1.3, bwDist);
      if (bwH > maxY) {
        maxY = bwH;
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
        terrace = Math.floor(hill * 4.5) / 4.5 * 0.32 + hill * 0.68;
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

    const pierEndX = isl.dockPos.x + (isl.walkLanding.x - isl.dockPos.x) * 0.25;
    const pierEndZ = isl.dockPos.z + (isl.walkLanding.z - isl.dockPos.z) * 0.25;
    const dDock = pointToSegmentDist(x, z, pierEndX, pierEndZ, isl.walkLanding.x, isl.walkLanding.z);
    if (dDock < 1.8) {
      const pierH = 0.72 * smoothstep(1.8, 1.1, dDock);
      if (pierH > maxY) {
        maxY = pierH;
        zone = 'island';
        islandId = isl.id;
      }
    }
    if (isl.altDockPos) {
      const dAlt = pointToSegmentDist(x, z, isl.altDockPos.x, isl.altDockPos.z + 2.0, isl.center.x + 2, isl.center.z - 16);
      if (dAlt < 1.7) {
        const altH = 0.68 * smoothstep(1.7, 1.0, dAlt);
        if (altH > maxY) {
          maxY = altH;
          zone = 'island';
          islandId = isl.id;
        }
      }
    }
  }

  // 3. Goal: Starlit Cove Pavilion (terrace centered at z = 188.5, crescent hills behind)
  {
    const terraceZ = PAVILION_POS.z - 1.5; // 188.5
    const dx = x - PAVILION_POS.x;
    const dz = z - terraceZ;
    const dist = Math.hypot(dx, dz);
    if (dist < 50) {
      const coveD = Math.hypot(x, z - 178.0);
      const terraceD = Math.hypot(dx, dz);
      let h = -2.6;
      if (terraceD < 8.6) {
        h = Math.max(h, 0.95 * smoothstep(8.6, 6.8, terraceD));
      }
      if (dz > -1.5 && dist > 11.5 && dist < 44) {
        const arm = smoothstep(-1.5, 12.0, dz) * smoothstep(44, 29, dist) * smoothstep(11.0, 19.0, coveD);
        h = Math.max(h, arm * 7.4);
      }
      // Front landing steps from (-1.6, 179.4) onto terrace
      const stepD = pointToSegmentDist(x, z, -1.6, 179.4, -0.8, 182.2);
      if (stepD < 2.2) {
        h = Math.max(h, 0.85 * smoothstep(2.2, 1.2, stepD));
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

function pointToSegmentDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  const t = lenSq > 1e-5 ? clamp((wx * vx + wz * vz) / lenSq, 0, 1) : 0;
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
}

export function getGroundY(x, z) {
  return getLandInfo(x, z).y;
}

// Builds vertex-colored & normal-mapped Mediterranean island & cove terrain meshes
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
      // Keep terrain slightly below stone quay promenade (top at 1.04) so no Z-fighting occurs
      if (info.zone === 'harbor' && wz >= -133 && wz <= -114.5 && Math.abs(wx) < 30) {
        meshY = Math.min(meshY, 0.84);
      }
      if (info.zone === 'pavilion' && Math.hypot(wx, wz - (PAVILION_POS.z - 1.5)) < 11.2) {
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
