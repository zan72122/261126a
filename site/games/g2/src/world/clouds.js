// Volumetric-look layered Sea of Clouds (fast billboard puff impostors with FBM edges,
// normal-perturbed shading, backlit silver lining, and valley morning mist ribbons; zero raymarching).
import * as THREE from '../../lib/three.module.js';
import { PALETTE } from '../core/palette.js';
import { mulberry32 } from '../core/math.js';
import { makeSoftDotTexture } from '../core/textures.js';
import { SUN_DIR } from './sky.js';

export class ValleyClouds {
  constructor(lowQuality = false) {
    this.group = new THREE.Group();
    this.group.name = 'valleyClouds';
    this.lowQuality = lowQuality;
    this.puffs = [];
    this.mistSprites = [];
    this._sortTick = 0;

    const rng = mulberry32(7219);
    const maxPuffs = lowQuality ? 95 : 195;

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)
    );
    geo.setIndex([0, 1, 2, 0, 2, 3]);

    this.aPuff = new THREE.InstancedBufferAttribute(new Float32Array(maxPuffs * 4), 4).setUsage(
      THREE.DynamicDrawUsage
    );
    this.aCluster = new THREE.InstancedBufferAttribute(new Float32Array(maxPuffs * 4), 4).setUsage(
      THREE.DynamicDrawUsage
    );
    geo.setAttribute('aPuff', this.aPuff);
    geo.setAttribute('aCluster', this.aCluster);

    this.cloudMat = new THREE.ShaderMaterial({
      toneMapped: true,
      uniforms: {
        uSunDir: { value: SUN_DIR.clone() },
        uTime: { value: 0 },
        uCream: { value: new THREE.Color(0xefe5d2) },
        uShadow: { value: new THREE.Color(0x9fb0c4) },
        uBacklight: { value: new THREE.Color(PALETTE.apricotSoft) },
        uFogColor: { value: new THREE.Color(PALETTE.skyMist) },
        uFogDensity: { value: lowQuality ? 0.00105 : 0.0009 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aPuff;    // xyz center, w radius
        attribute vec4 aCluster; // xyz cluster center, w seed
        varying vec2 vUv;
        varying vec3 vCenter;
        varying vec3 vClCenter;
        varying float vRadius;
        varying float vSeed;
        varying float vFade;
        varying vec3 vWorld;
        varying float vFogDepth;

        void main() {
          vec3 c = aPuff.xyz;
          float r = aPuff.w;
          vec3 toCam = cameraPosition - c;
          float dist = max(length(toCam), 0.001);
          vec3 fwd = toCam / dist;
          vec3 upRef = abs(fwd.y) > 0.96 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
          vec3 right = normalize(cross(upRef, fwd));
          vec3 up = cross(fwd, right);

          vec3 world = c + (right * position.x * 1.55 + up * position.y * 0.85) * r;
          vUv = vec2(position.x * 1.16, position.y * 1.16);
          vCenter = c;
          vClCenter = aCluster.xyz;
          vRadius = r;
          vSeed = aCluster.w;
          vFade = smoothstep(r * 0.45, r * 1.55, dist);
          vWorld = world;

          vec4 mv = viewMatrix * vec4(world, 1.0);
          vFogDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir;
        uniform float uTime;
        uniform vec3 uCream;
        uniform vec3 uShadow;
        uniform vec3 uBacklight;
        uniform vec3 uFogColor;
        uniform float uFogDensity;

        varying vec2 vUv;
        varying vec3 vCenter;
        varying vec3 vClCenter;
        varying float vRadius;
        varying float vSeed;
        varying float vFade;
        varying vec3 vWorld;
        varying float vFogDepth;

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
        float fbm(vec2 p) {
          return 0.62 * vnoise(p) + 0.38 * vnoise(p * 2.13 + 3.7);
        }

        void main() {
          vec2 q = vUv;
          float n = vnoise(q * 1.7 + vec2(vSeed * 7.3, uTime * 0.015));
          float rr = length(q) + (n - 0.5) * 0.48;
          float a = smoothstep(1.0, 0.44, rr);
          if (a < 0.02) discard;

          vec3 toCam = cameraPosition - vCenter;
          vec3 fwd = toCam / max(length(toCam), 0.001);
          vec3 upRef = abs(fwd.y) > 0.96 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
          vec3 right = normalize(cross(upRef, fwd));
          vec3 up = cross(fwd, right);
          float z = sqrt(max(0.0, 1.0 - min(dot(q, q), 1.0)));
          vec3 N = normalize(right * q.x + up * q.y + fwd * z + vec3(n - 0.5) * 0.45);

          vec3 fromCl = normalize(vWorld - vClCenter + vec3(0.0, 0.25 * vRadius, 0.0));
          float sunSide = dot(normalize(N * 0.65 + fromCl * 0.65), uSunDir);
          float lit = smoothstep(-0.5, 0.8, sunSide);
          float heightRatio = clamp((vWorld.y - vClCenter.y) / max(vRadius * 1.3, 0.1) + 0.45, 0.0, 1.0);

          vec3 shadeCol = mix(uShadow, uCream * 0.85, heightRatio * 0.55);
          vec3 litCol = mix(uCream * 0.92, vec3(0.98, 0.94, 0.86), heightRatio * 0.45);
          vec3 col = mix(shadeCol, litCol, lit);

          // Warm apricot-gold silver-lining backlighting when sun is behind cloud rim
          vec3 V = normalize(vWorld - cameraPosition);
          float back = pow(max(dot(V, uSunDir), 0.0), 5.0);
          col += uBacklight * back * (1.0 - a * 0.72) * 0.65;

          float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
          col = mix(col, uFogColor, clamp(fogF, 0.0, 0.90));

          // Tone-map & convert to display sRGB BEFORE premultiplying by alpha!
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          float alpha = a * vFade * 0.74;
          gl_FragColor.rgb *= alpha;
          gl_FragColor.a = alpha;
        }
      `,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });

    this.cloudMesh = new THREE.Mesh(geo, this.cloudMat);
    this.cloudMesh.frustumCulled = false;
    this.cloudMesh.renderOrder = 3;
    this.group.add(this.cloudMesh);

    const addBank = (cx, cy, cz, span, puffCount, baseRad) => {
      const seed = rng() * 20;
      for (let i = 0; i < puffCount; i++) {
        if (this.puffs.length >= maxPuffs) return;
        const ang = rng() * Math.PI * 2;
        const dist = Math.pow(rng(), 0.65) * span;
        const px = cx + Math.cos(ang) * dist;
        const pz = cz + Math.sin(ang) * dist * 0.78;
        const r = baseRad * (0.72 + rng() * 0.50) * (1 - 0.30 * (dist / span));
        const py = cy + (1 - dist / span) * r * 0.28 + (rng() - 0.5) * 1.2;
        this.puffs.push({
          baseX: px,
          x: px,
          y: py,
          z: pz,
          r,
          clX: cx,
          clY: cy,
          clZ: cz,
          seed,
          speed: 0.25 + rng() * 0.35,
          phase: rng() * Math.PI * 2,
          d: 0,
        });
      }
    };

    // Lower continuous cloud sea stratum (y = 22..27) spanning broad valley
    const bankCountLower = lowQuality ? 20 : 38;
    for (let i = 0; i < bankCountLower; i++) {
      let bx = (rng() - 0.5) * 330;
      const bz = -54 - rng() * 315;
      if (bz < -275 && Math.abs(bx - 6) < 40) {
        bx += bx < 6 ? -44 : 44;
      }
      const by = 22.5 + rng() * 4.2;
      addBank(bx, by, bz, 24 + rng() * 13, lowQuality ? 3 : 3, 12.5 + rng() * 4.5);
    }

    // Upper sunlit billowing crests (y = 28..33)
    const bankCountUpper = lowQuality ? 12 : 22;
    for (let i = 0; i < bankCountUpper; i++) {
      let bx = (rng() - 0.5) * 290;
      const bz = -68 - rng() * 255;
      if (bz < -250 && Math.abs(bx - 6) < 42) {
        bx += bx < 6 ? -46 : 46;
      }
      if (Math.hypot(bx - (-22), bz - (-182)) < 32) {
        bx += bx < -22 ? -35 : 35;
      }
      const by = 28.0 + rng() * 4.2;
      addBank(bx, by, bz, 19 + rng() * 10, lowQuality ? 3 : 3, 10.5 + rng() * 4);
    }

    this._order = new Array(this.puffs.length);
    for (let i = 0; i < this.puffs.length; i++) this._order[i] = this.puffs[i];
    geo.instanceCount = this.puffs.length;

    // 2. Soft morning mist veils hugging the river valley (y = 4.5..9.5)
    const dotTex = makeSoftDotTexture();
    const mistCount = lowQuality ? 8 : 16;
    for (let i = 0; i < mistCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: dotTex,
        color: PALETTE.cream,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      const x = (rng() - 0.5) * 230;
      const z = -100 - rng() * 135;
      const y = 4.8 + rng() * 4.6;
      const w = 48 + rng() * 34;
      sp.position.set(x, y, z);
      sp.scale.set(w, w * 0.24, 1);
      this.group.add(sp);
      this.mistSprites.push({
        sp,
        baseX: x,
        phase: rng() * 6.28,
        speed: 0.28 + rng() * 0.26,
      });
    }
  }

  update(dt, time, camPos = null) {
    this.cloudMat.uniforms.uTime.value = time;

    for (const p of this.puffs) {
      p.x = p.baseX + Math.sin(time * 0.032 * p.speed + p.phase) * 9.0;
    }

    for (const m of this.mistSprites) {
      m.sp.position.x = m.baseX + Math.sin(time * 0.05 * m.speed + m.phase) * 10;
    }

    this._sortTick++;
    if (this._sortTick % 2 !== 0 && this._sortTick > 1) return;

    const cpX = camPos ? camPos.x : 0;
    const cpY = camPos ? camPos.y : 20;
    const cpZ = camPos ? camPos.z : 0;
    const n = this.puffs.length;
    const ord = this._order;

    for (let i = 0; i < n; i++) {
      const p = this.puffs[i];
      const dx = p.x - cpX;
      const dy = p.y - cpY;
      const dz = p.z - cpZ;
      p.d = dx * dx + dy * dy + dz * dz;
      ord[i] = p;
    }
    ord.sort((a, b) => b.d - a.d);

    const A = this.aPuff.array;
    const B = this.aCluster.array;
    for (let i = 0; i < n; i++) {
      const p = ord[i];
      const i4 = i * 4;
      A[i4] = p.x;
      A[i4 + 1] = p.y;
      A[i4 + 2] = p.z;
      A[i4 + 3] = p.r;
      B[i4] = p.clX;
      B[i4 + 1] = p.clY;
      B[i4 + 2] = p.clZ;
      B[i4 + 3] = p.seed;
    }
    this.aPuff.needsUpdate = true;
    this.aCluster.needsUpdate = true;
  }
}
