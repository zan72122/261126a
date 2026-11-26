import * as THREE from '../../lib/three.module.js';
import { GLSL_NOISE, ISLANDS, PAVILION_POS, REEFS, SWELL_ZONES, shared } from '../core/env.js';

// Evaluates gentle sea wave + buoyant wave swell height at (x, z, t)
export function getSeaWaveHeight(x, z, t) {
  let y = Math.sin(x * 0.11 + t * 1.25) * 0.08 + Math.cos(z * 0.09 - t * 0.98) * 0.07;
  y += Math.sin((x * 0.7 + z * 0.7) * 0.18 + t * 1.65) * 0.035;
  for (const sw of SWELL_ZONES) {
    const d = Math.hypot(x - sw.pos.x, z - sw.pos.z);
    if (d < sw.radius) {
      const k = 1 - d / sw.radius;
      const smooth = k * k * (3 - 2 * k);
      y += smooth * (sw.lift * 0.42 + Math.sin(t * 1.4) * 0.35);
    }
  }
  return y;
}

export class SeaSurface {
  constructor({ lowQuality = false } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'sea';

    const segs = lowQuality ? 96 : 176;
    const geo = new THREE.PlaneGeometry(540, 580, segs, segs);
    geo.rotateX(-Math.PI / 2);

    this.uniforms = {
      uTime: shared.uTime,
      uNight: shared.uNight,
      uSunDir: shared.uSunDir,
      uMoonDir: shared.uMoonDir,
      uSkyHorizon: shared.uSkyHorizon,
      uSkyZenith: shared.uSkyZenith,
      uSeaDeep: shared.uSeaDeep,
      uSeaMid: shared.uSeaMid,
      uFogColor: shared.uFogColor,
      uSwell0: { value: new THREE.Vector3(SWELL_ZONES[0].pos.x, SWELL_ZONES[0].radius, SWELL_ZONES[0].lift) },
      uSwell1: { value: new THREE.Vector3(SWELL_ZONES[1].pos.x, SWELL_ZONES[1].radius, SWELL_ZONES[1].lift) },
      uPavilion: { value: new THREE.Vector3(PAVILION_POS.x, 1.8, PAVILION_POS.z - 2.0) },
      uLanternGlow: shared.uLanternGlow,
      uBoatPos: shared.uBoatPos,
      uBoatYaw: shared.uBoatYaw,
      uBoatSpeed: shared.uBoatSpeed,
      uBreezeBoost: shared.uBreezeBoost,
      uLighthouse: { value: new THREE.Vector2(ISLANDS[0].center.x - 2, ISLANDS[0].center.z + 1) },
      uWindmill: { value: new THREE.Vector2(ISLANDS[1].dockPos.x, ISLANDS[1].dockPos.z) },
      uCove: { value: new THREE.Vector2(ISLANDS[2].dockPos.x, ISLANDS[2].dockPos.z) },
      uIsl0: { value: new THREE.Vector3(ISLANDS[0].center.x, ISLANDS[0].center.z, ISLANDS[0].radius) },
      uIsl1: { value: new THREE.Vector3(ISLANDS[1].center.x, ISLANDS[1].center.z, ISLANDS[1].radius) },
      uIsl2: { value: new THREE.Vector3(ISLANDS[2].center.x, ISLANDS[2].center.z, ISLANDS[2].radius) },
      uLowQ: { value: lowQuality ? 1.0 : 0.0 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSwell0, uSwell1;
        varying vec3 vWorld;
        varying float vSwell;

        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          float wave = sin(w.x * 0.11 + uTime * 1.25) * 0.08 + cos(w.z * 0.09 - uTime * 0.98) * 0.07;
          wave += sin((w.x * 0.7 + w.z * 0.7) * 0.18 + uTime * 1.65) * 0.035;

          float s0 = clamp(1.0 - length(w.xz - vec2(uSwell0.x, 54.0)) / uSwell0.y, 0.0, 1.0);
          float s1 = clamp(1.0 - length(w.xz - vec2(uSwell1.x, 128.0)) / uSwell1.y, 0.0, 1.0);
          s0 = s0 * s0 * (3.0 - 2.0 * s0);
          s1 = s1 * s1 * (3.0 - 2.0 * s1);
          float swLift = s0 * (uSwell0.z * 0.42) + s1 * (uSwell1.z * 0.42);

          w.y += wave + swLift;
          vWorld = w.xyz;
          vSwell = max(s0, s1);
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uNight, uLanternGlow, uBoatYaw, uBoatSpeed, uBreezeBoost, uLowQ;
        uniform vec3 uSunDir, uMoonDir, uSkyHorizon, uSkyZenith, uSeaDeep, uSeaMid, uFogColor, uPavilion, uBoatPos;
        uniform vec2 uLighthouse, uWindmill, uCove;
        uniform vec3 uIsl0, uIsl1, uIsl2;
        varying vec3 vWorld;
        varying float vSwell;
        ${GLSL_NOISE}

        // Analytical multi-wave capillary & swell slope for crisp dancing reflections
        vec3 evalWaveNormal(vec2 p, float t, float detailScale, float speedRipple) {
          float dx = 0.0;
          float dz = 0.0;
          // Wave 1 (primary swell)
          float ph1 = dot(p, vec2(0.18, 0.11)) + t * 1.22;
          dx += cos(ph1) * 0.055;
          dz += cos(ph1) * 0.034;
          // Wave 2 (cross sea breeze)
          float ph2 = dot(p, vec2(-0.24, 0.31)) - t * 1.55;
          dx += cos(ph2) * -0.042;
          dz += cos(ph2) * 0.054;
          // Wave 3 (short chop)
          float ph3 = dot(p, vec2(0.55, -0.48)) + t * 2.1 * speedRipple;
          dx += cos(ph3) * 0.048 * detailScale;
          dz += cos(ph3) * -0.044 * detailScale;
          // Wave 4 (fine capillary ripples)
          float ph4 = dot(p, vec2(-0.92, -0.78)) - t * 2.75 * speedRipple;
          dx += cos(ph4) * -0.036 * detailScale;
          dz += cos(ph4) * -0.032 * detailScale;

          if (uLowQ < 0.5) {
            float e = 0.22;
            float nC = vnoise2(p * 1.35 + vec2(t * 0.24, -t * 0.19));
            float nX = vnoise2((p + vec2(e, 0.0)) * 1.35 + vec2(t * 0.24, -t * 0.19));
            float nZ = vnoise2((p + vec2(0.0, e)) * 1.35 + vec2(t * 0.24, -t * 0.19));
            dx += (nX - nC) * 0.42 * detailScale;
            dz += (nZ - nC) * 0.42 * detailScale;

            float mC = vnoise2(p * 3.1 - vec2(t * 0.32, t * 0.28));
            float mX = vnoise2((p + vec2(0.12, 0.0)) * 3.1 - vec2(t * 0.32, t * 0.28));
            float mZ = vnoise2((p + vec2(0.0, 0.12)) * 3.1 - vec2(t * 0.32, t * 0.28));
            dx += (mX - mC) * 0.24 * detailScale;
            dz += (mZ - mC) * 0.24 * detailScale;
          }
          return normalize(vec3(-dx, 1.0, -dz));
        }

        // Wave-broken lantern reflection ribbon: keeps wave troughs deep ultramarine while crests catch crisp golden bars
        float brokenLanternColumn(vec2 xz, vec2 src, vec3 N, vec3 V, float width, float maxDist) {
          vec2 toSrc = src - xz;
          float dist = length(toSrc);
          vec2 viewDir = normalize(xz - cameraPosition.xz);
          float inFront = smoothstep(-2.0, 2.0, dot(toSrc, viewDir));
          vec2 perpDir = vec2(-viewDir.y, viewDir.x);
          float perp = abs(dot(toSrc, perpDir));
          float slopeShift = dot(N.xz, perpDir) * (1.8 + dist * 0.06);
          float aligned = perp + slopeShift;
          float lane = exp(-(aligned * aligned) / (width + dist * 0.008));
          vec3 L = normalize(vec3(toSrc.x, 3.8, toSrc.y));
          vec3 R = reflect(-V, N);
          float align = max(dot(R, L), 0.0);
          float crestBar = pow(align, 22.0) * 1.5 + smoothstep(0.74, 0.96, align) * 0.45;
          float distFall = smoothstep(maxDist, 2.2, dist) * (0.20 + 0.80 * exp(-dist * 0.022));
          return lane * inFront * (0.04 + crestBar) * distFall;
        }

        float shoreProximity(vec2 p) {
          float s = 0.0;
          s = max(s, smoothstep(uIsl0.z + 4.5, uIsl0.z - 1.5, length(p - uIsl0.xy)));
          s = max(s, smoothstep(uIsl1.z + 4.5, uIsl1.z - 1.5, length(p - uIsl1.xy)));
          s = max(s, smoothstep(uIsl2.z + 4.5, uIsl2.z - 1.5, length(p - uIsl2.xy)));
          s = max(s, smoothstep(-108.0, -116.5, -p.y)); // Harbor shore
          float pavDist = length(p - vec2(uPavilion.x, 189.0));
          s = max(s, smoothstep(14.0, 8.2, pavDist));
          return s;
        }

        void main() {
          vec2 p = vWorld.xz;
          float camDist = length(vWorld.xz - cameraPosition.xz);
          float detailScale = 1.0 - smoothstep(45.0, 220.0, camDist) * 0.78;
          float speedRipple = 1.0 + uBreezeBoost * 0.35;

          vec3 N = evalWaveNormal(p, uTime, detailScale, speedRipple);
          vec3 V = normalize(cameraPosition - vWorld);
          float NdotV = max(dot(N, V), 0.001);
          float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 4.2);

          // Reflected sky ray for accurate ultramarine water + twilight/starry reflection
          vec3 R = reflect(-V, N);
          float rY = clamp(R.y, 0.0, 1.0);
          vec3 reflSky = mix(uSkyHorizon, uSkyZenith, pow(rY, 0.55));
          // Subtle warm sunset bounce in twilight sky reflection
          float sunReflSky = pow(max(dot(R, normalize(uSunDir)), 0.0), 4.0) * (1.0 - uNight);
          reflSky += vec3(0.95, 0.65, 0.42) * sunReflSky * 0.45;

          // Deep ultramarine water body with subtle shallow turquoise tint near coasts
          float depthNoise = vnoise2(p * 0.16 + vec2(uTime * 0.05));
          vec3 deepCol = mix(uSeaDeep, uSeaMid, 0.25 + 0.35 * depthNoise);
          float shallow = shoreProximity(p);
          deepCol = mix(deepCol, vec3(0.12, 0.31, 0.44), shallow * (0.48 - uNight * 0.28));

          vec3 col = mix(deepCol, reflSky, clamp(fresnel * 0.86, 0.0, 0.9));

          // Setting sun broken apricot-gold specular path (via reflected ray R so grazing view never washes out)
          vec3 sDir = normalize(uSunDir);
          float sunAlign = max(dot(R, sDir), 0.0);
          float sunSpec = pow(sunAlign, 120.0) * (1.0 - uNight * 0.9);
          float sunGlint = smoothstep(0.84, 0.98, sunAlign) * (1.0 - uNight * 0.88);
          col += vec3(1.0, 0.78, 0.48) * (sunSpec * 1.35 + sunGlint * 0.36);

          // Crescent moon crisp silver-white broken wave path (via reflected ray R)
          vec3 mDir = normalize(uMoonDir);
          float moonAlign = max(dot(R, mDir), 0.0);
          float moonSpec = pow(moonAlign, 160.0) * smoothstep(0.08, 0.72, uNight);
          float moonGlint = smoothstep(0.86, 0.985, moonAlign) * smoothstep(0.12, 0.8, uNight);
          col += vec3(0.92, 0.96, 1.0) * (moonSpec * 1.65 + moonGlint * 0.32);

          // Starlight reflections across dark ultramarine waves (reflected sky star cells + wave facet glints)
          float starVis = smoothstep(0.18, 0.85, uNight) * smoothstep(0.02, 0.22, R.y);
          if (starVis > 0.01) {
            vec2 starUv = R.xz / (R.y + 0.28) * 18.0;
            vec2 sid = floor(starUv);
            vec2 sf = fract(starUv) - 0.5;
            float sr = hash21(sid);
            if (sr > 0.84) {
              vec2 soff = vec2(hash21(sid + 3.1), hash21(sid + 9.7)) - 0.5;
              float dStar = length(sf - soff * 0.55);
              float twinkle = 0.55 + 0.45 * sin(uTime * (2.2 + sr * 4.0) + sr * 50.0);
              float starSpark = smoothstep(0.14, 0.01, dStar) * twinkle;
              col += mix(vec3(0.86, 0.93, 1.0), vec3(1.0, 0.91, 0.72), fract(sr * 17.3)) * starSpark * starVis * (0.45 + 0.9 * fresnel);
            }
          }

          // Broken golden lantern reflections from Starlit Pavilion (multiple lamps along colonnade), Harbor, & Islands
          float pavMid = brokenLanternColumn(p, uPavilion.xz, N, V, 0.16, 360.0);
          float pavLeft = brokenLanternColumn(p, uPavilion.xz + vec2(-3.8, -0.8), N, V, 0.09, 95.0) * 0.72;
          float pavRight = brokenLanternColumn(p, uPavilion.xz + vec2(3.8, -0.8), N, V, 0.09, 95.0) * 0.72;
          float harbL = brokenLanternColumn(p, vec2(-9.2, -115.6), N, V, 0.11, 65.0) * 0.6;
          float harbR = brokenLanternColumn(p, vec2(7.2, -115.6), N, V, 0.11, 65.0) * 0.6;
          float lhCol = brokenLanternColumn(p, uLighthouse, N, V, 0.18, 110.0) * 0.65;
          float wmCol = brokenLanternColumn(p, uWindmill, N, V, 0.12, 75.0) * 0.5;
          float cvCol = brokenLanternColumn(p, uCove, N, V, 0.12, 75.0) * 0.55;

          float lanternSum = pavMid + pavLeft + pavRight + harbL + harbR + lhCol + wmCol + cvCol;
          col += vec3(1.0, 0.76, 0.40) * lanternSum * (0.48 + 1.05 * uLanternGlow);

          // Sailboat bow brass lantern pool & organic V-wake foam trail
          vec2 relBoat = p - uBoatPos.xz;
          float dBoat = length(relBoat);
          vec2 bowPos = uBoatPos.xz + vec2(sin(uBoatYaw), cos(uBoatYaw)) * 2.4;
          float bowLantern = brokenLanternColumn(p, bowPos, N, V, 0.08, 16.0);
          col += vec3(1.0, 0.79, 0.46) * bowLantern * (0.35 + 0.75 * uNight);

          float speedSparkle = clamp((uBoatSpeed - 1.6) / 10.5, 0.0, 1.0);
          if (dBoat < 22.0 && speedSparkle > 0.02) {
            float sy = sin(uBoatYaw);
            float cy = cos(uBoatYaw);
            float fwdDist = dot(relBoat, vec2(sy, cy));
            float latDist = abs(dot(relBoat, vec2(cy, -sy)));
            float aft = clamp(2.3 - fwdDist, 0.0, 20.0);
            if (fwdDist < 2.5) {
              float nWake = vnoise2(p * 2.4 + vec2(0.0, -uTime * 0.9));
              float nFoam = vnoise2(p * 5.2 - vec2(uTime * 0.6, uTime * 1.1));
              float vLine = exp(-pow(latDist - (0.38 + aft * 0.25), 2.0) / (0.14 + aft * 0.045));
              float centerTrail = exp(-latDist * latDist / (0.16 + aft * 0.018)) * exp(-aft * 0.14);
              float foamTex = smoothstep(0.32, 0.84, nWake * 0.58 + nFoam * 0.42);
              float wakeAlpha = (vLine * 0.82 + centerTrail * 0.68) * exp(-aft * 0.11) * foamTex * speedSparkle;
              vec3 foamCol = mix(vec3(0.92, 0.94, 0.96), vec3(0.75, 0.84, 0.95), uNight * 0.45);
              col = mix(col, foamCol, clamp(wakeAlpha * (0.62 + uBreezeBoost * 0.35), 0.0, 0.88));
            }
          }

          // Subtle animated wave-crest lapping foam near shallow shorelines
          if (shallow > 0.22) {
            float foamWave = sin(shallow * 26.0 - uTime * 2.4 + vnoise2(p * 0.6) * 3.0);
            float shoreFoam = smoothstep(0.45, 0.95, foamWave) * smoothstep(0.22, 0.68, shallow);
            col = mix(col, mix(vec3(0.90, 0.90, 0.88), vec3(0.58, 0.68, 0.82), uNight), shoreFoam * 0.32);
          }

          // Buoyant sea-swell crest glow
          if (vSwell > 0.02) {
            float ring = smoothstep(0.15, 0.85, vSwell);
            col += vec3(0.95, 0.78, 0.52) * ring * 0.32;
          }

          // Atmospheric perspective into distant sea haze
          float fogAmt = smoothstep(115.0, 360.0, camDist);
          col = mix(col, uFogColor, fogAmt * 0.90);

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.set(0, 0, 20);
    this.mesh.receiveShadow = !lowQuality;
    this.group.add(this.mesh);

    // Subtle reef surf rings
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xe8e4da,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    for (const rf of REEFS) {
      const rGeo = new THREE.RingGeometry(rf.r - 0.3, rf.r + 0.85, 24);
      rGeo.rotateX(-Math.PI / 2);
      const rMesh = new THREE.Mesh(rGeo, ringMat);
      rMesh.position.set(rf.x, 0.07, rf.z);
      this.group.add(rMesh);
    }

    // Buoyant swell beacons on sea surface
    this.swellRings = [];
    const swGeo = new THREE.RingGeometry(3.2, 4.3, 40);
    swGeo.rotateX(-Math.PI / 2);
    for (const sw of SWELL_ZONES) {
      const sm = new THREE.Mesh(
        swGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffcf7a,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      sm.position.set(sw.pos.x, sw.lift * 0.42 + 0.25, sw.pos.z);
      this.group.add(sm);
      this.swellRings.push(sm);
    }
  }

  update(t) {
    this.swellRings.forEach((r, idx) => {
      const s = 1.0 + 0.14 * Math.sin(t * 1.8 + idx * 1.5);
      r.scale.set(s, 1, s);
      r.material.opacity = 0.34 + 0.16 * Math.sin(t * 2.1 + idx);
    });
  }
}
