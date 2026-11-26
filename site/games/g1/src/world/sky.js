import * as THREE from '../../lib/three.module.js';
import { SUN_DIR } from '../core/env.js';

/**
 * Early-autumn Swiss alpine afternoon sky dome:
 * Pale cerulean zenith blending smoothly into misty pale-blue-and-gold horizon,
 * subtle high-altitude cirrus wisps, sun disc + warm atmospheric halo,
 * and procedural IBL environment map for PBR materials.
 */
export class Sky {
  constructor() {
    this.uniforms = {
      uSunDir: { value: SUN_DIR.clone() },
      uZenith: { value: new THREE.Color('#7caed9') },
      uMid: { value: new THREE.Color('#bad7ee') },
      uHorizon: { value: new THREE.Color('#eef4fa') },
      uHorizonGold: { value: new THREE.Color('#f7e8c6') },
      uGround: { value: new THREE.Color('#c2d3e3') },
      uSunColor: { value: new THREE.Color('#fff5d8') },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir;
        uniform vec3 uZenith;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform vec3 uHorizonGold;
        uniform vec3 uGround;
        uniform vec3 uSunColor;
        varying vec3 vDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
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
          vec3 d = normalize(vDir);
          vec3 sunD = normalize(uSunDir);
          float h = d.y;

          vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.24, max(h, 0.0)));
          col = mix(col, uZenith, smoothstep(0.18, 0.82, max(h, 0.0)));
          if (h < 0.0) {
            col = mix(uHorizon, uGround, smoothstep(0.0, -0.35, h));
          }

          // Warm golden-amber horizon scattering toward the afternoon sun azimuth
          float azMatch = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sunD.x, 0.0, sunD.z))), 0.0);
          float horizBand = exp(-abs(h) * 8.5) * pow(azMatch, 1.8);
          col = mix(col, uHorizonGold, horizBand * 0.62);

          // Delicate high-altitude cirrus streaks
          if (h > 0.06) {
            vec2 cuv = d.xz / (h + 0.35) * 1.9;
            float c1 = noise(cuv + vec2(1.4, 2.7));
            float c2 = noise(cuv * 2.4 + vec2(4.1, -1.2));
            float cirrus = smoothstep(0.58, 0.86, c1 * 0.65 + c2 * 0.35) * smoothstep(0.06, 0.25, h) * (1.0 - smoothstep(0.55, 0.9, h));
            col = mix(col, mix(vec3(0.98), uHorizonGold, horizBand * 0.5), cirrus * 0.26);
          }

          float sunCos = max(dot(d, sunD), 0.0);
          float halo = pow(sunCos, 10.0) * 0.28 + pow(sunCos, 90.0) * 0.42;
          float disc = smoothstep(0.9989, 0.9996, sunCos) * 1.5;
          col += uSunColor * (halo + disc);

          gl_FragColor = vec4(col, 1.0);
        }`,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(2400, 36, 22), mat);
    this.mesh.frustumCulled = false;
  }

  makeEnvironment(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(60, 20, 12), this.mesh.material));
    const rt = pmrem.fromScene(envScene, 0.04);
    pmrem.dispose();
    return rt.texture;
  }
}
