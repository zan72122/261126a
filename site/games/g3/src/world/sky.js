import * as THREE from '../../lib/three.module.js';
import { shared, GLSL_NOISE } from '../core/env.js';
import { mulberry32 } from '../core/math.js';

function makeSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uNight: shared.uNight,
      uSunDir: shared.uSunDir,
      uMoonDir: shared.uMoonDir,
      uZenith: shared.uSkyZenith,
      uHorizon: shared.uSkyHorizon,
      uFogColor: shared.uFogColor,
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position, 1.0)).xyz, 1.0);
        gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uNight;
      uniform vec3 uSunDir, uMoonDir, uZenith, uHorizon, uFogColor;
      varying vec3 vDir;
      ${GLSL_NOISE}

      float starLayer(vec3 d, float scale, float density) {
        vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830988 + 0.5);
        uv *= vec2(scale * 2.2, scale);
        vec2 id = floor(uv);
        vec2 f = fract(uv) - 0.5;
        float rnd = hash21(id);
        if (rnd < density) return 0.0;
        vec2 off = vec2(hash21(id + 7.1), hash21(id + 13.7)) - 0.5;
        float dist = length(f - off * 0.65);
        float size = mix(0.028, 0.085, fract(rnd * 31.7));
        float twinkle = 0.72 + 0.28 * sin(uTime * (1.2 + rnd * 2.8) + rnd * 40.0);
        return smoothstep(size, 0.0, dist) * twinkle;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);

        // Base sky gradient: Mediterranean summer twilight -> starry night
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.50));

        // Low warm setting sun glow & horizon scatter
        float sd = dot(d, normalize(uSunDir));
        float sunFade = 1.0 - smoothstep(0.0, 0.85, uNight);
        col += vec3(0.95, 0.64, 0.42) * pow(max(sd, 0.0), 5.0) * (1.0 - h * 0.85) * 0.58 * sunFade;
        col += vec3(1.0, 0.84, 0.60) * pow(max(sd, 0.0), 42.0) * 0.52 * sunFade;
        col += vec3(1.0, 0.94, 0.82) * smoothstep(0.9988, 0.9994, sd) * 3.0 * sunFade;

        // High-altitude cirrus wisps
        vec2 cp = d.xz / (max(d.y, 0.04) + 0.16);
        float wisp = fbm2(cp * 1.25 + vec2(uTime * 0.0028, 0.0));
        wisp = smoothstep(0.52, 0.84, wisp) * smoothstep(0.03, 0.30, d.y) * (1.0 - uNight * 0.68);
        vec3 wispCol = mix(vec3(0.90, 0.74, 0.68), vec3(0.28, 0.38, 0.58), uNight);
        col = mix(col, wispCol, wisp * 0.24);

        // Crescent moon & halo
        vec3 mDir = normalize(uMoonDir);
        float md = dot(d, mDir);
        float moonAppear = smoothstep(0.12, 0.75, uNight);
        col += vec3(0.50, 0.65, 0.90) * pow(max(md, 0.0), 16.0) * 0.30 * moonAppear;
        float moonDisk = smoothstep(0.99905, 0.99935, md);
        vec3 cutoutDir = normalize(mDir + vec3(0.018, 0.014, 0.0));
        float moonCut = smoothstep(0.99905, 0.99935, dot(d, cutoutDir));
        float crescent = clamp(moonDisk - moonCut * 0.95, 0.0, 1.0);
        col += vec3(1.0, 0.96, 0.86) * crescent * 2.8 * moonAppear;

        // Crisp multi-scale starfield
        float starVis = smoothstep(0.03, 0.28, d.y) * smoothstep(0.04, 0.68, uNight);
        float s1 = starLayer(d, 56.0, 0.85);
        float s2 = starLayer(d, 98.0, 0.90);
        vec3 starCol = mix(vec3(0.86, 0.92, 1.0), vec3(1.0, 0.93, 0.78), 0.35);
        col += starCol * (s1 * 1.3 + s2 * 0.88) * starVis;

        // Atmospheric horizon mist blend
        col = mix(col, uFogColor, smoothstep(0.04, -0.06, d.y));

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
  });
}

// Layered translucent cloud banks with twilight backlighting & moonlit silver rims (no heavy raymarch)
function makeCloudLayer(cloudTex, { lowQuality = false } = {}) {
  const group = new THREE.Group();
  group.name = 'skyClouds';
  const rand = mulberry32(9012);
  const banks = lowQuality ? 10 : 18;
  const puffsPerBank = lowQuality ? 2 : 3;

  const cloudMat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: cloudTex },
      uNight: shared.uNight,
      uSunDir: shared.uSunDir,
      uMoonDir: shared.uMoonDir,
      uFogColor: shared.uFogColor,
    },
    vertexShader: /* glsl */ `
      attribute float aShade;
      attribute vec3 aOffset;
      varying vec2 vUv;
      varying float vShade;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vShade = aShade;
        // Camera-facing billboard quad anchored at instance world pos
        vec4 worldCenter = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 wp = worldCenter.xyz + right * position.x + up * position.y;
        vWorld = wp;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uNight;
      uniform vec3 uSunDir, uMoonDir, uFogColor;
      varying vec2 vUv;
      varying float vShade;
      varying vec3 vWorld;
      void main() {
        vec4 tex = texture2D(uMap, vUv);
        float alpha = tex.a;
        if (alpha < 0.01) discard;

        vec3 dir = normalize(vWorld - cameraPosition);
        float backSun = pow(max(dot(dir, normalize(uSunDir)), 0.0), 4.0);
        float backMoon = pow(max(dot(dir, normalize(uMoonDir)), 0.0), 5.0);

        // Upper/backlit rim vs shadowed belly
        float topK = smoothstep(0.25, 0.82, vUv.y) * 0.7 + vShade * 0.3;
        vec3 twilightBelly = vec3(0.36, 0.37, 0.52);
        vec3 twilightRim = vec3(0.95, 0.72, 0.56) + vec3(0.18, 0.12, 0.05) * backSun;
        vec3 nightBelly = vec3(0.11, 0.18, 0.32);
        vec3 nightRim = vec3(0.36, 0.48, 0.70) + vec3(0.24, 0.28, 0.34) * backMoon;

        vec3 dayCol = mix(twilightBelly, twilightRim, topK);
        vec3 nightCol = mix(nightBelly, nightRim, topK);
        vec3 col = mix(dayCol, nightCol, uNight);

        // Soft aerial haze blend at low elevation
        float distFade = smoothstep(320.0, 880.0, length(vWorld.xz - cameraPosition.xz));
        col = mix(col, uFogColor, distFade * 0.45);
        float outAlpha = alpha * mix(0.68, 0.36, uNight) * (1.0 - distFade * 0.25);

        gl_FragColor = vec4(col, outAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });

  const total = banks * puffsPerBank;
  const quad = new THREE.PlaneGeometry(1, 1);
  const im = new THREE.InstancedMesh(quad, cloudMat, total);
  const shadeAttr = new Float32Array(total);
  const dummy = new THREE.Object3D();
  const baseAngles = [];

  let idx = 0;
  for (let b = 0; b < banks; b++) {
    const ang = (b / banks) * Math.PI * 2 + (rand() - 0.5) * 0.22;
    const dist = 420 + rand() * 340;
    const baseY = 44 + rand() * 56;
    const bankScale = 44 + rand() * 48;
    for (let p = 0; p < puffsPerBank; p++) {
      const ox = (p - (puffsPerBank - 1) * 0.5) * bankScale * 0.46 + (rand() - 0.5) * 14;
      const oy = (p % 2) * bankScale * 0.14 + (rand() - 0.5) * 8;
      const w = bankScale * (1.15 + rand() * 0.65);
      const h = w * (0.42 + rand() * 0.14);
      const px = Math.cos(ang) * dist - Math.sin(ang) * ox;
      const pz = Math.sin(ang) * dist + Math.cos(ang) * ox;
      dummy.position.set(px, baseY + oy, pz);
      dummy.scale.set(w, h, 1);
      dummy.updateMatrix();
      im.setMatrixAt(idx, dummy.matrix);
      shadeAttr[idx] = p === 0 ? 0.8 : 0.45 + rand() * 0.45;
      baseAngles.push({ px, py: baseY + oy, pz, w, h, drift: 0.6 + rand() * 0.8 });
      idx++;
    }
  }
  quad.setAttribute('aShade', new THREE.InstancedBufferAttribute(shadeAttr, 1));
  im.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false;
  im.renderOrder = -500;
  group.add(im);
  group.userData = { im, baseAngles, dummy };
  return group;
}

export class SkyDome {
  constructor(cloudTex = null, { lowQuality = false } = {}) {
    this.material = makeSkyMaterial();
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.material);
    this.mesh.scale.setScalar(4200);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.onBeforeRender = (_r, _s, cam) => {
      this.mesh.position.copy(cam.position);
      this.mesh.updateMatrixWorld();
    };

    this.clouds = cloudTex ? makeCloudLayer(cloudTex, { lowQuality }) : null;
  }

  updateClouds(t, camPos) {
    if (!this.clouds) return;
    this.clouds.position.set(camPos.x * 0.65, 0, camPos.z * 0.65);
    const { im, baseAngles, dummy } = this.clouds.userData;
    for (let i = 0; i < baseAngles.length; i++) {
      const b = baseAngles[i];
      dummy.position.set(b.px + Math.sin(t * 0.015 + i) * 12.0, b.py, b.pz + Math.cos(t * 0.012 + i) * 8.0);
      dummy.scale.set(b.w, b.h, 1);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  }

  makeEnvironment(renderer) {
    const envScene = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 28, 14), makeSkyMaterial());
    envScene.add(sky);
    const seaBounce = new THREE.Mesh(
      new THREE.CircleGeometry(75, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x1a3866 })
    );
    seaBounce.position.y = -2;
    envScene.add(seaBounce);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromScene(envScene, 0.03);
    pmrem.dispose();
    return rt.texture;
  }
}
