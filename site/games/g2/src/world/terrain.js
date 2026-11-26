// Provençal hillside valley terrain heightfield, sculpted distant limestone ridges,
// procedural near-camera micro-detail & height-aware morning valley haze.
import * as THREE from '../../lib/three.module.js';
import { clamp, lerp, smoothstep } from '../core/math.js';
import { PALETTE, c } from '../core/palette.js';
import { makeMeadowTexture } from '../core/textures.js';

export const WATER_Y = 1.35;

export const LANDMARKS = {
  homeGarden: { x: 0, z: 0 },
  homeHouse: { x: -7.5, z: 4.5 },
  letterPedestal: { x: -0.8, z: -1.8 },
  balloonPad: { x: 3.6, z: -13.0 },
  bridge: { x: -8, z: -157.5 },
  pier: { x: 14, z: -149.5 },
  windmill: { x: -66, z: -140 },
  detourVillage: { x: 76, z: -188 },
  meadowLanding: { x: -22, z: -182 },
  flowerClearing: { x: -24, z: -222 },
  towerPlaza: { x: 6, z: -330 },
};

export function riverCenterZ(x) {
  return -155 + Math.sin(x * 0.022) * 18 + Math.cos(x * 0.011) * 7;
}

export function riverHalfWidth(x) {
  return 7.5 + Math.sin(x * 0.03 + 1.1) * 1.4;
}

export function isOverRiver(x, z) {
  if (Math.abs(x) > 250) return false;
  const dz = Math.abs(z - riverCenterZ(x));
  return dz < riverHalfWidth(x) + 0.6;
}

function plateauBlend(x, z, cx, cz, innerR, outerR) {
  const d = Math.hypot(x - cx, z - cz);
  return 1 - smoothstep(innerR, outerR, d);
}

// Smooth organic ridge noise for Provençal limestone crests
function hillRidge(x, z) {
  const a = Math.sin(x * 0.014 + z * 0.008 + 0.6);
  const b = Math.cos(x * 0.009 - z * 0.013 - 0.3);
  const r1 = 1.0 - Math.abs(Math.sin(x * 0.011 + Math.cos(z * 0.012) * 1.4));
  return a * b * 3.8 + r1 * r1 * 4.2;
}

export function rawTerrainHeight(x, z) {
  let h = 6.2;

  // Natural valley undulation + organic limestone hill crests
  h += Math.sin(x * 0.017 + 0.4) * Math.cos(z * 0.014) * 3.4;
  h += Math.sin(x * 0.036 - z * 0.022) * 1.15;
  h += hillRidge(x, z) * smoothstep(28, 120, Math.hypot(x, z + 80));

  // Gradual rise toward the northern clock tower hill
  h += smoothstep(-205, -345, z) * 18.0;

  // Sculpted side valley ridges framing east and west with terraced contours
  const absX = Math.abs(x);
  const sideMask = smoothstep(74, 240, absX);
  const sideCrest = 1.0 - Math.abs(Math.sin(z * 0.018 + Math.sign(x) * 0.9));
  h += sideMask * (22.0 + sideCrest * 14.0);

  // Distant Provençal limestone mountain massif behind clock tower and behind home
  const northDist = smoothstep(-360, -540, z);
  const northPeak = Math.pow(Math.max(0, Math.cos((x + 28) * 0.011)), 1.6) * 28.0
    + Math.pow(Math.max(0, Math.sin((x - 65) * 0.015)), 2.0) * 22.0;
  h += northDist * (34.0 + northPeak);
  h += smoothstep(46, 175, z) * (24.0 + Math.abs(Math.sin(x * 0.016)) * 12.0);

  // River channel carving around riverCenterZ(x)
  const rz = riverCenterZ(x);
  const rw = riverHalfWidth(x);
  const dRiver = Math.abs(z - rz);
  const riverCarve = 1 - smoothstep(rw * 0.6, rw + 28.0, dRiver);
  h = lerp(h, 0.2, riverCarve);

  // Smooth flat plateaus for settlements & landing meadows (wide enough for all perimeter buildings)
  h = lerp(h, 5.0, plateauBlend(x, z, 0, -4, 28, 50));
  h = lerp(h, 18.0, plateauBlend(x, z, LANDMARKS.windmill.x, LANDMARKS.windmill.z, 16, 34));
  h = lerp(h, 13.5, plateauBlend(x, z, LANDMARKS.detourVillage.x, LANDMARKS.detourVillage.z, 20, 38));
  h = lerp(h, 7.2, plateauBlend(x, z, LANDMARKS.meadowLanding.x, LANDMARKS.meadowLanding.z, 22, 42));
  h = lerp(h, 10.5, plateauBlend(x, z, LANDMARKS.flowerClearing.x, LANDMARKS.flowerClearing.z, 14, 30));
  h = lerp(h, 28.5, plateauBlend(x, z, LANDMARKS.towerPlaza.x, LANDMARKS.towerPlaza.z, 36, 60));

  return h;
}

export function deckHeight(x, z) {
  // Arched wooden bridge deck
  const bx = LANDMARKS.bridge.x;
  const bz = riverCenterZ(bx);
  if (Math.abs(x - bx) <= 1.65 && Math.abs(z - bz) <= 8.9) {
    const t = clamp((z - bz) / 17.0, -0.5, 0.5);
    const archY = Math.cos(t * Math.PI) * 1.65;
    return WATER_Y + 0.65 + 0.08 + archY;
  }

  // Timber pier deck
  const px = LANDMARKS.pier.x;
  const pz = riverCenterZ(px) + 7.2;
  if (Math.abs(x - px) <= 1.35 && z >= pz - 3.45 && z <= pz + 1.05) {
    return WATER_Y + 0.42 + 0.09;
  }

  // Clock Tower Square cobble terrace top
  const tx = LANDMARKS.towerPlaza.x;
  const tz = LANDMARKS.towerPlaza.z;
  if (Math.hypot(x - tx, z - tz) <= 16.6) {
    return 28.5 + 0.06;
  }

  return -Infinity;
}

export function isOnBridgeOrPier(x, z) {
  const bx = LANDMARKS.bridge.x;
  const bz = riverCenterZ(bx);
  if (Math.abs(x - bx) <= 1.65 && Math.abs(z - bz) <= 8.9) return true;
  const px = LANDMARKS.pier.x;
  const pz = riverCenterZ(px) + 7.2;
  if (Math.abs(x - px) <= 1.35 && z >= pz - 3.45 && z <= pz + 1.05) return true;
  return false;
}

export function terrainHeight(x, z) {
  return Math.max(rawTerrainHeight(x, z), deckHeight(x, z));
}

export function terrainNormal(x, z, out = new THREE.Vector3()) {
  const e = 0.65;
  const hL = terrainHeight(x - e, z);
  const hR = terrainHeight(x + e, z);
  const hD = terrainHeight(x, z - e);
  const hU = terrainHeight(x, z + e);
  return out.set(hL - hR, 2 * e, hD - hU).normalize();
}

export function makeTerrainMesh(lowQuality = false) {
  const width = 620;
  const depth = 700;
  const segX = lowQuality ? 68 : 98;
  const segZ = lowQuality ? 78 : 116;
  const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -215);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const colMeadow = c(PALETTE.meadowSage);
  const colMeadowWarm = c(PALETTE.meadowSoft);
  const colMeadowDeep = c(0x768f60);
  const colPath = c(PALETTE.creamWarm);
  const colLimestone = c(PALETTE.limestone);
  const colRock = c(0xcbbda4);
  const colBank = c(PALETTE.creamDeep);
  const colLavenderTint = c(0x9897a6);
  const colTmp = new THREE.Color();
  const normTmp = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = rawTerrainHeight(x, z);
    pos.setY(i, y);

    terrainNormal(x, z, normTmp);
    const slope = 1.0 - normTmp.y;

    // Multi-angle organic meadow variation (prevents any striping)
    const n1 = 0.5 + 0.5 * Math.sin(x * 0.043 + Math.cos(z * 0.037) * 1.7);
    const n2 = 0.5 + 0.5 * Math.cos(z * 0.051 - Math.sin(x * 0.029) * 1.5);
    colTmp.copy(colMeadow).lerp(colMeadowWarm, n1 * 0.46).lerp(colMeadowDeep, n2 * 0.24);

    // Subtle sun-baked limestone scree on steeper hillside slopes & high ridge crests
    const rockFactor = smoothstep(0.055, 0.22, slope) + smoothstep(32, 58, y) * 0.42;
    colTmp.lerp(colRock, clamp(rockFactor, 0, 0.72));

    // Lavender hillside soil tint
    const slopeZone = smoothstep(-45, -112, z) * (1 - smoothstep(-250, -305, z));
    colTmp.lerp(colLavenderTint, slopeZone * 0.20 * (1 - clamp(rockFactor, 0, 1)));

    // Warm sandy path near home courtyard & stepping stones
    const dHomePath = Math.hypot(x - 1.2, z + 5.5);
    if (dHomePath < 15) {
      colTmp.lerp(colPath, (1 - smoothstep(4, 15, dHomePath)) * 0.48);
    }

    // Winding footpath from home garden toward river bridge
    const pathCenterX = -8 * smoothstep(-15, -145, z);
    const dRoad = Math.abs(x - pathCenterX);
    if (z < -12 && z > -148 && dRoad < 3.6) {
      colTmp.lerp(colPath, (1 - smoothstep(1.1, 3.6, dRoad)) * 0.60);
    }

    // Footpath across meadow landing toward flower clearing
    const dMeadowPath = Math.abs(x - LANDMARKS.meadowLanding.x + (z - LANDMARKS.meadowLanding.z) * 0.08);
    if (z < -165 && z > -235 && dMeadowPath < 2.8) {
      colTmp.lerp(colPath, (1 - smoothstep(0.9, 2.8, dMeadowPath)) * 0.50);
    }

    // Clock tower hillside plateau transition
    const dTower = Math.hypot(x - LANDMARKS.towerPlaza.x, z - LANDMARKS.towerPlaza.z);
    if (dTower < 25) {
      colTmp.lerp(colLimestone, (1 - smoothstep(18, 25, dTower)) * 0.8);
    }

    // River pebbles / sand near water
    const dRiv = Math.abs(z - riverCenterZ(x)) - riverHalfWidth(x);
    if (dRiv < 4.5) {
      colTmp.lerp(colBank, clamp(1 - dRiv / 4.5, 0, 1) * 0.82);
    }

    // Distant ridges softer for aerial perspective
    const dist = Math.hypot(x, z + 60);
    if (dist > 250) {
      colTmp.lerp(c(PALETTE.skyHorizon), smoothstep(250, 470, dist) * 0.42);
    }

    colors[i * 3] = colTmp.r;
    colors[i * 3 + 1] = colTmp.g;
    colors[i * 3 + 2] = colTmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const meadowTex = makeMeadowTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: meadowTex,
    vertexColors: true,
    roughness: 0.93,
    metalness: 0.0,
  });

  if (!lowQuality) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uMistColor = { value: c(PALETTE.skyMist) };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldTerrainPos;')
        .replace(
          '#include <worldpos_vertex>',
          '#include <worldpos_vertex>\nvWorldTerrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldTerrainPos;
          uniform vec3 uMistColor;
          float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float tNoise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x),
                       mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y);
          }`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          {
            float camD = length(vWorldTerrainPos - cameraPosition);
            float nearFade = 1.0 - smoothstep(22.0, 115.0, camD);
            float nCoarse = tNoise(vWorldTerrainPos.xz * 0.22);
            float nFine = tNoise(vWorldTerrainPos.xz * 2.1);
            float nMicro = tNoise(vWorldTerrainPos.xz * 7.8);
            diffuseColor.rgb *= mix(1.0, 0.87 + 0.26 * nCoarse, 0.72);
            diffuseColor.rgb *= mix(1.0, 0.89 + 0.20 * nFine + 0.06 * nMicro, nearFade * 0.85);
          }`
        )
        .replace(
          '#include <fog_fragment>',
          `{
            float valleyDepth = smoothstep(26.0, 4.0, vWorldTerrainPos.y);
            float distFade = smoothstep(75.0, 320.0, length(vWorldTerrainPos - cameraPosition));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uMistColor, valleyDepth * distFade * 0.36);
          }
          #include <fog_fragment>`
        );
    };
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = !lowQuality;
  mesh.name = 'terrain';
  return mesh;
}
