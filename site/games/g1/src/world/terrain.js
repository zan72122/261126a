import * as THREE from '../../lib/three.module.js';
import {
  BOARD_POS,
  BRIDGE_POS,
  HOME_CHALET_POS,
  LAKE_POS,
  LAKE_WATER_Y,
  LOOKOUT_POS,
  SIDETRACK_POS,
  SUMMIT_POS,
  SUN_DIR,
  VILLAGE_POS,
} from '../core/env.js';
import { clamp, lerp, smoothstep } from '../core/math.js';
import { TRACK_DEFS } from './trackData.js';

const GROUND_RAIL_SPANS = [];
for (const [id, def] of Object.entries(TRACK_DEFS)) {
  if (id === 'seg5_viaduct') continue;
  const pts = def.pts;
  for (let i = 0; i < pts.length - 1; i++) {
    if (id === 'seg0_home_village' && (i === 2 || i === 3)) continue;
    GROUND_RAIL_SPANS.push([pts[i], pts[i + 1]]);
  }
}

function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

function fbm(x, z) {
  return (
    noise2(x, z) * 0.58 +
    noise2(x * 2.13, z * 2.13) * 0.28 +
    noise2(x * 4.7, z * 4.7) * 0.14
  );
}

export function distToSeg(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  const t = lenSq > 1e-5 ? clamp((wx * vx + wz * vz) / lenSq, 0, 1) : 0;
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

function flatten(h, targetY, dist, innerR, outerR) {
  const w = 1 - smoothstep(innerR, outerR, dist);
  return lerp(h, targetY, w);
}

/**
 * Deterministic terrain height at (x, z) across the Swiss alpine valley.
 * Keeps the Summit Ridge as a promontory dropping cleanly into the vast cloud sea behind it.
 */
export function heightAt(x, z) {
  const valleyDist = Math.abs(x + 6) * 0.0085;
  let h = (fbm(x * 0.012 + 3.1, z * 0.012 + 1.7) - 0.45) * 9.0;

  // Surrounding valley walls (tapered down around the northern cloud-sea basin z < -370)
  const northOpen = 1 - smoothstep(-320, -405, z);
  const sideRise = Math.pow(clamp((Math.abs(x - 10) - 95) / 170, 0, 1.5), 1.65) * 92 * (0.25 + 0.75 * northOpen);
  const southRise = Math.pow(clamp((z - 42) / 140, 0, 1.3), 1.5) * 58;
  const ridgeDetail = fbm(x * 0.025 + 9.2, z * 0.025 - 4.4) * 18;
  h += sideRise + southRise + valleyDist * 3.5 + (sideRise > 2 ? ridgeDetail : 0);

  // Mid-mountain climbing slope on east/north side around Switch 3 -> Lookout -> Gallery
  const climbDist = Math.hypot((x - 58) * 0.85, z + 290);
  h = flatten(h, 23.0, climbDist, 18, 66);

  // Lookout shoulder
  h = flatten(h, LOOKOUT_POS.y - 0.25, Math.hypot(x - LOOKOUT_POS.x, z - LOOKOUT_POS.z), 10, 32);

  // Mountain shoulder backing the stone gallery on seg4_main (east side of track near (45, -318))
  const galleryDist = Math.hypot((x - 53) * 0.85, z + 318);
  if (galleryDist < 28) {
    const gw = 1 - smoothstep(10, 28, galleryDist);
    h = lerp(h, 36.5, gw * 0.75);
  }

  // Keep valley floor LOW under the Grand Stone Viaduct AND open into a deep Cloud Sea basin north of the ridge!
  const dViaduct = distToSeg(x, z, 30, -340, -10, -378);
  if (dViaduct < 52) {
    const carve = 1 - smoothstep(18, 52, dViaduct);
    h = lerp(h, 14.0, carve);
  }
  if (z < -392) {
    const basinW = smoothstep(-395, -432, z);
    h = lerp(h, 16.0 + ridgeDetail * 0.45, basinW * 0.88);
  }

  // Summit Ridge Promontory Plateau (y = 75.75) overlooking the cloud sea
  const summitD = Math.hypot((x - (SUMMIT_POS.x + 2)) * 0.76, (z - (SUMMIT_POS.z - 2)) * 1.05);
  h = flatten(h, SUMMIT_POS.y - 0.25, summitD, 14, 29);

  // Keep final viaduct approach clear
  const dSummitTrack = distToSeg(x, z, -12, -380, 33, -393);
  if (dSummitTrack < 8 && x < 36) {
    const tApproach = clamp((x + 12) / 45, 0, 1);
    const maxAllowed = lerp(60.0, SUMMIT_POS.y - 0.18, tApproach);
    h = Math.min(h, maxAllowed);
  }

  // Home & Garden + Village Halt flat meadow (y = 0)
  h = flatten(h, 0.0, Math.hypot(x + 3, z - 1), 16, 36);
  h = flatten(h, 0.0, Math.hypot(x - BOARD_POS.x, z - BOARD_POS.z), 11, 24);
  h = flatten(h, 0.0, Math.hypot(x - HOME_CHALET_POS.x, z - HOME_CHALET_POS.z), 10, 22);

  // Village station & chalets flat terrace (y = 1.8)
  h = flatten(h, 1.8, Math.hypot(x - VILLAGE_POS.x, z - VILLAGE_POS.z), 16, 38);

  // Flower & Lumber Siding terrace (y = 3.95)
  h = flatten(h, SIDETRACK_POS.y - 0.25, Math.hypot(x - SIDETRACK_POS.x, z - SIDETRACK_POS.z), 14, 32);

  // Lake station shore (y = 0.25)
  h = flatten(h, LAKE_POS.y - 0.25, Math.hypot(x - LAKE_POS.x, z - LAKE_POS.z), 12, 28);

  // Gently conform terrain under ground-level rail corridors
  for (let i = 0; i < GROUND_RAIL_SPANS.length; i++) {
    const [a, b] = GROUND_RAIL_SPANS[i];
    const vx = b[0] - a[0];
    const vz = b[2] - a[2];
    const wx = x - a[0];
    const wz = z - a[2];
    const lenSq = vx * vx + vz * vz;
    const t = lenSq > 1e-5 ? clamp((wx * vx + wz * vz) / lenSq, 0, 1) : 0;
    const cx = a[0] + vx * t;
    const cz = a[2] + vz * t;
    const d = Math.hypot(x - cx, z - cz);
    if (d < 8.5) {
      const targetRailY = lerp(a[1], b[1], t) - 0.12;
      const w = 1 - smoothstep(2.4, 8.5, d);
      h = lerp(h, targetRailY, w * 0.92);
    }
  }

  // Turquoise River Channel
  const dRiver1 = distToSeg(x, z, 110, -28, BRIDGE_POS.x, -35);
  const dRiver2 = distToSeg(x, z, BRIDGE_POS.x, -35, -8, -95);
  const dRiver3 = distToSeg(x, z, -8, -95, -52, -172);
  const dRiver = Math.min(dRiver1, dRiver2, dRiver3);
  if (dRiver < 16) {
    const carve = 1 - smoothstep(4.5, 16, dRiver);
    h = lerp(h, LAKE_WATER_Y - 1.6, carve);
  }

  // Mountain Brook
  const dBrook1 = distToSeg(x, z, 96, -110, 62, -106);
  const dBrook2 = distToSeg(x, z, 62, -106, 26, -104);
  const dBrook3 = distToSeg(x, z, 26, -104, -8, -95);
  const dBrook = Math.min(dBrook1, dBrook2, dBrook3);
  if (dBrook < 9.5) {
    const carve = 1 - smoothstep(2.4, 9.5, dBrook);
    h = lerp(h, LAKE_WATER_Y - 1.15, carve * 0.88);
  }

  // Alpine Lake Basin
  const lakeD = Math.hypot((x + 76) * 0.82, (z + 194) * 0.88);
  if (lakeD < 32) {
    const carve = 1 - smoothstep(16, 32, lakeD);
    h = lerp(h, LAKE_WATER_Y - 2.1, carve);
  }

  return h;
}

/**
 * Generates the alpine valley terrain with surface-aware procedural micro-detail
 * (meadow grass, stratified alpine granite, wind-sculpted snow), aerial perspective,
 * distant snow peaks across the cloud sea, and reflective water with sun & lantern glints.
 */
export class ValleyTerrain {
  constructor(mats, { segs = 128, low = false } = {}) {
    this.group = new THREE.Group();

    const width = 560;
    const depth = 680;
    const centerZ = -235;
    const geo = new THREE.PlaneGeometry(width, depth, segs, Math.round(segs * 1.15));
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    // Surface weights: x = rock, y = snow, z = sand/gravel
    const weights = new Float32Array(pos.count * 3);

    const cGrass = new THREE.Color('#5d7b47');
    const cMeadow = new THREE.Color('#7a9459');
    const cWarmMeadow = new THREE.Color('#8c9b59');
    const cRock = new THREE.Color('#9e978b');
    const cSnow = new THREE.Color('#eef3f8');
    const cSand = new THREE.Color('#c8bda7');
    const cGravel = new THREE.Color('#b6b0a3');
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + 12;
      const z = pos.getZ(i) + centerZ;
      const y = heightAt(x, z);
      pos.setXYZ(i, x, y, z);

      const hx = heightAt(x + 2, z);
      const hz = heightAt(x, z + 2);
      const slope = Math.hypot(hx - y, hz - y) * 0.5;

      let rockW = 0;
      let snowW = 0;
      let sandW = 0;

      if (y < LAKE_WATER_Y + 0.35) {
        tmp.copy(cSand);
        sandW = 1.0;
      } else {
        const sunMix = fbm(x * 0.04, z * 0.04);
        const warmMix = fbm(x * 0.085 + 4.2, z * 0.085 - 2.1);
        tmp.copy(cGrass).lerp(cMeadow, sunMix);
        tmp.lerp(cWarmMeadow, smoothstep(0.55, 0.85, warmMix) * 0.45);

        const dBoard = Math.hypot(x - BOARD_POS.x, z - (BOARD_POS.z + 2));
        if (dBoard < 8.5) {
          const gw = (1 - smoothstep(2.5, 8.5, dBoard)) * 0.55;
          tmp.lerp(cGravel, gw);
          sandW = gw;
        }

        rockW = smoothstep(0.46, 1.15, slope) * 0.92;
        tmp.lerp(cRock, rockW);

        snowW = smoothstep(49, 68, y) * (1 - smoothstep(1.05, 1.9, slope) * 0.65);
        snowW = clamp(snowW, 0, 1);
        tmp.lerp(cSnow, snowW);
      }

      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;

      weights[i * 3] = rockW;
      weights[i * 3 + 1] = snowW;
      weights[i * 3 + 2] = sandW;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSurf', new THREE.BufferAttribute(weights, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: low ? 0.93 : 0.89,
      metalness: 0.02,
    });

    // Inject clean world-space procedural surface detail (no stretched UV grass lines on snow!)
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute vec3 aSurf;
          varying vec3 vSurfW;
          varying vec3 vTerrainWorld;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vSurfW = aSurf;
          vTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vSurfW;
          varying vec3 vTerrainWorld;
          float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float tNoise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x),
                       mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y);
          }`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec2 wp = vTerrainWorld.xz;
          float g1 = tNoise(wp * 0.55);
          float g2 = tNoise(wp * 2.1);
          float rockStrata = tNoise(vec2(vTerrainWorld.y * 0.85 + g1 * 1.4, (wp.x + wp.y) * 0.18));
          float snowDrift = tNoise(wp * 0.25 + vec2(vTerrainWorld.y * 0.08, 0.0));
          float grassMask = clamp(1.0 - max(vSurfW.x, max(vSurfW.y, vSurfW.z)), 0.0, 1.0);

          // Grass micro-mottling
          diffuseColor.rgb *= mix(1.0, 0.89 + (g1 * 0.55 + g2 * 0.45) * 0.22, grassMask);
          // Stratified alpine rock grain
          diffuseColor.rgb *= mix(1.0, 0.82 + rockStrata * 0.34, vSurfW.x);
          // Subtle wind-carved snow relief (pure pale blue-white, never green/dark dashes)
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.86, 0.91, 0.96), vec3(0.98, 0.99, 1.0), snowDrift), vSurfW.y * 0.36);`
        );
    };

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.group.add(mesh);

    // Distant Alpine Snow Peaks rising far across the cloud sea (aerial perspective silhouettes)
    this._buildDistantPeaks();

    // Turquoise Alpine River, Brook & Lake water plane with Fresnel sky, sun glitter & lantern reflections
    const waterGeo = new THREE.PlaneGeometry(360, 320, low ? 16 : 36, low ? 16 : 36);
    waterGeo.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: SUN_DIR.clone() },
        uShallow: { value: new THREE.Color('#64b8c3') },
        uDeep: { value: new THREE.Color('#276c7b') },
        uSkyTop: { value: new THREE.Color('#8ec0e7') },
        uSkyHorizon: { value: new THREE.Color('#e8f2fb') },
        uSunGold: { value: new THREE.Color('#fff1c4') },
        uLantern1: { value: new THREE.Vector3(LAKE_POS.x - 1.8, LAKE_POS.y + 2.4, LAKE_POS.z + 3.8) },
        uLantern2: { value: new THREE.Vector3(VILLAGE_POS.x - 2.2, VILLAGE_POS.y + 2.3, VILLAGE_POS.z + 1.8) },
        uLantern3: { value: new THREE.Vector3(BRIDGE_POS.x - 4.0, BRIDGE_POS.y + 2.0, BRIDGE_POS.z - 6.0) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uShallow;
        uniform vec3 uDeep;
        uniform vec3 uSkyTop;
        uniform vec3 uSkyHorizon;
        uniform vec3 uSunGold;
        uniform vec3 uLantern1;
        uniform vec3 uLantern2;
        uniform vec3 uLantern3;
        varying vec3 vWorld;

        float lanternGlint(vec3 w, vec3 lpos, float t, float rMax) {
          vec2 d = w.xz - lpos.xz;
          float dist = length(d);
          float falloff = exp(-dist * dist / (rMax * rMax));
          float shimmer = 0.65 + 0.35 * sin(w.x * 2.2 + w.z * 3.1 + t * 2.8);
          return falloff * shimmer;
        }

        void main() {
          // Multi-directional wave ripples & analytic normal perturbation
          float px = vWorld.x;
          float pz = vWorld.z;
          float t = uTime;
          float dHx =
            cos(px * 0.48 + pz * 0.85 + t * 1.35) * 0.032 +
            cos(px * 1.15 - pz * 0.62 - t * 1.1) * 0.022 +
            cos(px * 2.4 + pz * 1.9 + t * 2.1) * 0.012;
          float dHz =
            cos(px * 0.48 + pz * 0.85 + t * 1.35) * 0.056 -
            cos(px * 1.15 - pz * 0.62 - t * 1.1) * 0.014 +
            cos(px * 2.4 + pz * 1.9 + t * 2.1) * 0.016;

          vec3 N = normalize(vec3(-dHx, 1.0, -dHz));
          vec3 V = normalize(cameraPosition - vWorld);
          vec3 R = reflect(-V, N);

          // Water body turquoise shading
          float waveVal = sin(px * 0.32 + pz * 0.68 + t * 1.1) * 0.5 + 0.5;
          vec3 bodyCol = mix(uDeep, uShallow, 0.32 + waveVal * 0.48);

          // Fresnel sky reflection
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.4);
          fresnel = clamp(0.16 + fresnel * 0.72, 0.0, 0.88);
          vec3 skyRefl = mix(uSkyHorizon, uSkyTop, clamp(R.y * 1.4, 0.0, 1.0));
          vec3 col = mix(bodyCol, skyRefl, fresnel);

          // Sun specular glitter path & elongated directional wave glints
          vec3 sunD = normalize(uSunDir);
          float specBroad = pow(max(dot(R, sunD), 0.0), 32.0) * 0.32;
          float specSharp = pow(max(dot(R, sunD), 0.0), 150.0) * 0.95;
          float wA = sin(px * 1.4 + pz * 3.8 + t * 2.1);
          float wB = sin(px * 2.7 - pz * 2.1 - t * 1.7);
          float sparkle = smoothstep(0.84, 0.98, (wA * wB) * 0.5 + 0.5);
          col += uSunGold * (specBroad + specSharp + sparkle * fresnel * 0.18);

          // Warm station lantern & village window reflections on lake and river
          float lGlow =
            lanternGlint(vWorld, uLantern1, t, 14.0) * 0.48 +
            lanternGlint(vWorld, uLantern2, t, 16.0) * 0.38 +
            lanternGlint(vWorld, uLantern3, t, 15.0) * 0.34;
          col += vec3(0.98, 0.78, 0.38) * lGlow;

          gl_FragColor = vec4(col, 0.93);
        }`,
      transparent: true,
    });
    const water = new THREE.Mesh(waterGeo, this.waterMat);
    water.position.set(10, LAKE_WATER_Y, -125);
    this.group.add(water);
  }

  _buildDistantPeaks() {
    // Sculpted distant snow-capped Alpine mountain ranges far across the cloud sea
    // (kept low and wide on the horizon so the layered backlit cloud sea dominates the summit vista)
    const ridgeGeo = new THREE.PlaneGeometry(1600, 320, 72, 16);
    ridgeGeo.rotateX(-Math.PI / 2);
    const pos = ridgeGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cRock = new THREE.Color('#98a9bc');
    const cSnow = new THREE.Color('#eef4fa');
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const envZ = Math.exp(-Math.pow(lz / 95, 2));
      const h1 = (fbm(lx * 0.008 + 1.3, lz * 0.012 + 2.4) - 0.28) * 115;
      const h2 = Math.abs(Math.sin(lx * 0.011 + 0.6)) * 42 + Math.abs(Math.cos(lx * 0.023 - 1.1)) * 22;
      const y = Math.max(0, (h1 + h2) * envZ) + 18;
      pos.setXYZ(i, lx + 20, y, lz - 780);

      const snowW = smoothstep(58, 92, y);
      tmp.copy(cRock).lerp(cSnow, snowW);
      cols[i * 3] = tmp.r;
      cols[i * 3 + 1] = tmp.g;
      cols[i * 3 + 2] = tmp.b;
    }
    ridgeGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    ridgeGeo.computeVertexNormals();

    const ridgeMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.02,
    });
    const ridgeMesh = new THREE.Mesh(ridgeGeo, ridgeMat);
    this.group.add(ridgeMesh);
  }

  update(time) {
    this.waterMat.uniforms.uTime.value = time;
  }
}
