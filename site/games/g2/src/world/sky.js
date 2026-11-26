// Early-summer morning sky dome (soft cerulean sky + eastern cream sunlight + high cirrus)
import * as THREE from '../../lib/three.module.js';
import { PALETTE } from '../core/palette.js';

export const SUN_DIR = new THREE.Vector3(0.66, 0.30, -0.68).normalize();

export function makeSkyMaterial() {
  return new THREE.ShaderMaterial({
    toneMapped: true,
    uniforms: {
      uSunDir: { value: SUN_DIR.clone() },
      uZenith: { value: new THREE.Color(0x6da9d4) },
      uHorizon: { value: new THREE.Color(0xd2e6f0) },
      uCream: { value: new THREE.Color(PALETTE.cream) },
      uTime: { value: 0 },
      uAltitudeFactor: { value: 0 },
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
      uniform vec3 uSunDir;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uCream;
      uniform float uTime;
      uniform float uAltitudeFactor;
      varying vec3 vDir;

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
        float v = 0.0;
        v += 0.55 * vnoise(p);
        v += 0.30 * vnoise(p * 2.07 + 1.7);
        v += 0.15 * vnoise(p * 4.13 + 3.1);
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;
        float h = clamp(y, 0.0, 1.0);

        // Soft morning gradient from pale sky horizon to clear cerulean zenith
        vec3 zenithCol = mix(uZenith, uZenith * vec3(0.76, 0.88, 1.06), uAltitudeFactor);
        vec3 col = mix(uHorizon, zenithCol, pow(h, 0.44));

        // Eastern morning cream glow near low sun (balanced so sky blue remains visible)
        float sd = dot(d, uSunDir);
        float sunHalo = pow(max(sd, 0.0), 12.0) * (1.0 - h * 0.55);
        col = mix(col, uCream * 0.98, sunHalo * 0.45);
        col += vec3(1.0, 0.90, 0.72) * pow(max(sd, 0.0), 140.0) * 0.65;
        col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9992, 0.9998, sd) * 1.4;

        // Soft high cirrus streaks
        vec2 cp = d.xz / (max(y, 0.04) + 0.20);
        float cir = fbm(cp * 1.15 + vec2(uTime * 0.003, 0.0));
        cir = smoothstep(0.55, 0.86, cir) * smoothstep(0.04, 0.30, y);
        col = mix(col, uCream * 0.96, cir * 0.28);

        // Lower horizon morning mist blend
        col = mix(col, uCream * 0.92, smoothstep(0.04, -0.12, y));

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

export class SkyDome {
  constructor() {
    this.material = makeSkyMaterial();
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 20), this.material);
    this.mesh.scale.setScalar(2600);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.onBeforeRender = (_r, _s, cam) => {
      this.mesh.position.copy(cam.position);
      this.mesh.updateMatrixWorld();
    };
  }

  update(time, altitude) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uAltitudeFactor.value = Math.min(1, Math.max(0, (altitude - 26) / 36));
  }

  makeEnvironment(renderer) {
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(80, 24, 12), makeSkyMaterial());
    envScene.add(envSky);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(75, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: PALETTE.meadowSage })
    );
    ground.position.y = -2;
    envScene.add(ground);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromScene(envScene, 0.04);
    pmrem.dispose();
    return rt.texture;
  }
}
