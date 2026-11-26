import * as THREE from '../../lib/three.module.js';
import { CLOUD_DECK_Y, SUN_DIR } from '../core/env.js';
import { rng } from '../core/math.js';

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

function createCloudStrataMaterial({
  yAmp = 2.4,
  scale = 0.025,
  opacity = 0.82,
  goldWeight = 0.55,
  seed = 0.0,
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: SUN_DIR.clone() },
      uTop: { value: new THREE.Color('#f9fbfe') },
      uShadow: { value: new THREE.Color('#b6cde4') },
      uGold: { value: new THREE.Color('#f7dfad') },
      uHaze: { value: new THREE.Color('#e6f0f9') },
      uAmp: { value: yAmp },
      uScale: { value: scale },
      uOpacity: { value: opacity },
      uGoldWeight: { value: goldWeight },
      uSeed: { value: seed },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uAmp;
      uniform float uScale;
      uniform float uSeed;
      varying vec2 vUv;
      varying float vWave;
      varying vec3 vWorld;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vUv = uv;
        vec3 p = position;
        vec4 wp0 = modelMatrix * vec4(p, 1.0);
        vec2 q = wp0.xz * uScale + vec2(uTime * 0.035 + uSeed, -uTime * 0.022);
        float n1 = vnoise(q);
        float n2 = vnoise(q * 2.15 + vec2(4.2, -1.7)) * 0.5;
        float n3 = vnoise(q * 4.3 - vec2(1.9, 3.1)) * 0.25;
        float billow = (n1 + n2 + n3) / 1.75;
        vWave = billow;
        p.y += (billow - 0.45) * uAmp * 2.2;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uTop;
      uniform vec3 uShadow;
      uniform vec3 uGold;
      uniform vec3 uHaze;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uGoldWeight;
      uniform float uSeed;
      varying vec2 vUv;
      varying float vWave;
      varying vec3 vWorld;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vec2 d = (vUv - 0.5) * 2.0;
        float r = length(d * vec2(0.9, 1.05));
        float radialFade = 1.0 - smoothstep(0.58, 0.99, r);

        // Multi-scale FBM detail for realistic billowing sea-of-clouds folds
        vec2 fuv = vWorld.xz * 0.022 + vec2(uTime * 0.015 + uSeed, -uTime * 0.01);
        float f1 = vnoise(fuv);
        float f2 = vnoise(fuv * 2.4 + vec2(2.7, 5.1)) * 0.5;
        float f3 = vnoise(fuv * 5.2 - vec2(3.4, 1.1)) * 0.25;
        float density = clamp((f1 + f2 + f3) / 1.75 * 0.65 + vWave * 0.45, 0.0, 1.0);

        float crest = smoothstep(0.32, 0.84, density);
        vec3 col = mix(uShadow, uTop, crest);

        // Warm golden backlit forward-scattering along sun-facing crests & horizon
        vec3 viewDir = normalize(vWorld - cameraPosition);
        float sunFwd = max(dot(normalize(vec3(viewDir.x, 0.08, viewDir.z)), normalize(vec3(uSunDir.x, 0.08, uSunDir.z))), 0.0);
        float rim = pow(sunFwd, 2.2) * (0.35 + crest * 0.65);
        col = mix(col, uGold, rim * uGoldWeight);

        // Atmospheric aerial perspective fading gently into pale-blue-gold horizon
        float dist = length(vWorld - cameraPosition);
        float fogAmt = smoothstep(180.0, 950.0, dist);
        col = mix(col, mix(uHaze, uGold, pow(sunFwd, 2.0) * 0.4), fogAmt * 0.58);

        // Keep the direct float/viaduct descent corridor & summit platform crisp without mid-body plane slice
        float floatGap = smoothstep(18.0, 44.0, length(vWorld.xz - vec2(26.0, -344.0)));
        float summitGap = smoothstep(14.0, 32.0, length(vWorld.xz - vec2(20.0, -396.0)));
        float alpha = radialFade * smoothstep(0.16, 0.56, density) * uOpacity * floatGap * summitGap;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function createBacklitPuffMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: SUN_DIR.clone() },
      uTop: { value: new THREE.Color('#fafcfe') },
      uShadow: { value: new THREE.Color('#bdd2e8') },
      uGold: { value: new THREE.Color('#f6e0ae') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        #ifdef USE_INSTANCING
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        #else
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
        #endif
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uTop;
      uniform vec3 uShadow;
      uniform vec3 uGold;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;

      void main() {
        vec3 n = normalize(vNormalW);
        vec3 sunD = normalize(uSunDir);
        vec3 viewD = normalize(cameraPosition - vWorldPos);

        // Wrap-diffuse lighting for volumetric-feeling cumulus scattering
        float ndl = clamp(dot(n, sunD) * 0.55 + 0.45, 0.0, 1.0);
        float topFill = clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(uShadow, uTop, smoothstep(0.18, 0.88, ndl * 0.65 + topFill * 0.35));

        // Backlit golden forward-scatter & soft silver-gold rim
        float backScatter = pow(max(dot(-viewD, sunD), 0.0), 3.0);
        float fresnel = pow(1.0 - max(dot(n, viewD), 0.0), 1.8);
        col = mix(col, uGold, clamp(backScatter * 0.48 + fresnel * ndl * 0.42, 0.0, 0.72));

        // Soft feathered edge alpha so spheres never look like hard plastic balls
        float edgeAlpha = smoothstep(0.05, 0.62, max(dot(n, viewD), 0.0));
        float distFade = 1.0 - smoothstep(380.0, 1100.0, length(cameraPosition - vWorldPos));
        gl_FragColor = vec4(col, edgeAlpha * 0.72 * (0.35 + 0.65 * distFade));
      }`,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Multi-layered Alpine Cloud Sea & Backlit Cumulus Banks:
 * - Three translucent billowing cloud-sea strata (cool blue base, main sunlit/backlit billow deck, high mist veil)
 * - Soft-edged backlit instanced cumulus clusters (zero raymarching, smooth on iPad Safari)
 */
export class CloudWorld {
  constructor({ maxPuffs = 380, deckSegs = 48 } = {}) {
    this.group = new THREE.Group();
    this.puffs = [];
    this.strataMats = [];

    const strataDefs = [
      { y: CLOUD_DECK_Y - 4.0, w: 1500, d: 1200, amp: 2.2, scale: 0.016, op: 0.78, gold: 0.30, seed: 1.1 },
      { y: CLOUD_DECK_Y + 4.5, w: 1450, d: 1150, amp: 3.2, scale: 0.022, op: 0.88, gold: 0.66, seed: 4.7 },
      { y: CLOUD_DECK_Y + 12.0, w: 1350, d: 1050, amp: 2.4, scale: 0.029, op: 0.52, gold: 0.82, seed: 9.3 },
    ];

    const segsX = deckSegs;
    const segsZ = Math.round(deckSegs * 0.8);
    for (const st of strataDefs) {
      const geo = new THREE.PlaneGeometry(st.w, st.d, segsX, segsZ);
      geo.rotateX(-Math.PI / 2);
      const mat = createCloudStrataMaterial({
        yAmp: st.amp,
        scale: st.scale,
        opacity: st.op,
        goldWeight: st.gold,
        seed: st.seed,
      });
      this.strataMats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(18, st.y, -480);
      this.group.add(mesh);
    }

    // Soft-feathered backlit cumulus clusters across the cloud sea & afternoon sky
    const puffGeo = new THREE.SphereGeometry(1, 14, 10);
    const puffMat = createBacklitPuffMaterial();
    this.mesh = new THREE.InstancedMesh(puffGeo, puffMat, maxPuffs);
    this.mesh.frustumCulled = false;

    const rand = rng(1964);
    for (let i = 0; i < maxPuffs; i++) {
      const inDeck = i < maxPuffs * 0.76;
      let x, y, z, sx, sy, sz;
      if (inDeck) {
        const angle = rand() * Math.PI * 2;
        const dist = 36 + Math.pow(rand(), 0.78) * 440;
        x = 18 + Math.cos(angle) * dist * 1.35;
        z = -460 + Math.sin(angle) * dist * 0.95;
        // Keep the Summit Station & direct float/viaduct approach crisp above the deck
        if (Math.hypot(x - 20, z + 395) < 40 || Math.hypot(x - 26, z + 344) < 34) {
          x += x > 20 ? 64 : -64;
        }
        // Keep home/village valley clear below
        if (z > -260) {
          z -= 220;
        }
        y = CLOUD_DECK_Y - 2.0 + rand() * 14.5;
        const base = 12 + rand() * 19;
        sx = base * (1.35 + rand() * 0.65);
        sy = base * (0.34 + rand() * 0.22);
        sz = base * (1.05 + rand() * 0.55);
      } else {
        // High early-autumn afternoon sky cumulus
        x = (rand() - 0.5) * 920;
        z = -60 - rand() * 740;
        y = 124 + rand() * 62;
        const base = 14 + rand() * 20;
        sx = base * 1.75;
        sy = base * 0.42;
        sz = base * 1.15;
      }
      this.puffs.push({
        baseX: x,
        y,
        z,
        sx,
        sy,
        sz,
        speed: 0.4 + rand() * 0.55,
        phase: rand() * Math.PI * 2,
      });
    }
    this.group.add(this.mesh);
    this.update(0);
  }

  update(time) {
    for (const mat of this.strataMats) {
      mat.uniforms.uTime.value = time;
    }
    for (let i = 0; i < this.puffs.length; i++) {
      const p = this.puffs[i];
      const drift = Math.sin(time * 0.06 * p.speed + p.phase) * 6.5;
      _p.set(p.baseX + drift, p.y + Math.cos(time * 0.12 + p.phase) * 0.45, p.z);
      _q.identity();
      _s.set(p.sx, p.sy, p.sz);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
