import * as THREE from '../../lib/three.module.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

function fsMat(frag, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * Lightweight HDR post-processing pipeline with progressive downsample/upsample bloom.
 * When bloom=false (?q=low), renders directly to the screen for fast iPad Safari performance.
 */
export class Post {
  constructor(renderer, { msaa = 2, bloom = true } = {}) {
    this.renderer = renderer;
    this.bloomOn = bloom;
    const isGL2 = renderer.capabilities.isWebGL2;

    if (!bloom) return;

    this.sceneRT = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      samples: isGL2 ? msaa : 0,
      depthBuffer: true,
    });
    this.levels = [];
    this.scratch = [];
    for (let i = 0; i < 4; i++) {
      const a = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
      const b = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
      for (const rt of [a, b]) {
        rt.texture.minFilter = THREE.LinearFilter;
        rt.texture.magFilter = THREE.LinearFilter;
        rt.texture.generateMipmaps = false;
      }
      this.levels.push(a);
      this.scratch.push(b);
    }

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.prefilter = fsMat(
      /* glsl */ `
      uniform sampler2D tSrc;
      uniform vec2 uTexel;
      uniform float uThreshold;
      varying vec2 vUv;
      void main() {
        vec3 c = (
          texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb +
          texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb +
          texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb +
          texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb
        ) * 0.25;
        float br = max(c.r, max(c.g, c.b));
        float soft = clamp(br - uThreshold + 0.35, 0.0, 1.0);
        soft = soft * soft * 0.42;
        float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
        gl_FragColor = vec4(min(c * contrib, vec3(8.0)), 1.0);
      }`,
      { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.28 } }
    );

    this.down = fsMat(
      /* glsl */ `
      uniform sampler2D tSrc;
      uniform vec2 uTexel;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tSrc, vUv).rgb * 0.4;
        c += (
          texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb +
          texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb +
          texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb +
          texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb
        ) * 0.15;
        gl_FragColor = vec4(c, 1.0);
      }`,
      { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }
    );

    this.up = fsMat(
      /* glsl */ `
      uniform sampler2D tBase;
      uniform sampler2D tSmall;
      uniform vec2 uTexel;
      varying vec2 vUv;
      void main() {
        vec3 b = texture2D(tBase, vUv).rgb;
        vec3 s = (
          texture2D(tSmall, vUv + uTexel * vec2(-1.0, 0.0)).rgb +
          texture2D(tSmall, vUv + uTexel * vec2( 1.0, 0.0)).rgb +
          texture2D(tSmall, vUv + uTexel * vec2(0.0, -1.0)).rgb +
          texture2D(tSmall, vUv + uTexel * vec2(0.0,  1.0)).rgb
        ) * 0.25;
        gl_FragColor = vec4(b + s * 0.65, 1.0);
      }`,
      { tBase: { value: null }, tSmall: { value: null }, uTexel: { value: new THREE.Vector2() } }
    );

    this.comp = fsMat(
      /* glsl */ `
      uniform sampler2D tScene;
      uniform sampler2D tBloom;
      uniform float uBloomStrength;
      varying vec2 vUv;
      vec3 neutralTone(vec3 x) {
        const float startCompression = 0.8 - 0.04;
        float d = min(x.r, min(x.g, x.b));
        float offset = d < 0.08 ? d - 6.25 * d * d : 0.04;
        x -= offset;
        float peak = max(x.r, max(x.g, x.b));
        if (peak < startCompression) return x;
        float d2 = 1.0 - startCompression;
        float newPeak = 1.0 - d2 * d2 / (peak + d2 - startCompression);
        x *= newPeak / peak;
        return x;
      }
      void main() {
        vec3 col = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloomStrength;
        col = neutralTone(max(col, 0.0));
        col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
        gl_FragColor = vec4(col, 1.0);
      }`,
      { tScene: { value: null }, tBloom: { value: null }, uBloomStrength: { value: 0.14 } }
    );
  }

  resize(w, h) {
    if (!this.bloomOn) return;
    this.sceneRT.setSize(w, h);
    let bw = Math.max(4, Math.floor(w / 2));
    let bh = Math.max(4, Math.floor(h / 2));
    for (let i = 0; i < this.levels.length; i++) {
      this.levels[i].setSize(bw, bh);
      this.scratch[i].setSize(bw, bh);
      bw = Math.max(4, Math.floor(bw / 2));
      bh = Math.max(4, Math.floor(bh / 2));
    }
  }

  render(scene, camera) {
    const r = this.renderer;
    if (!this.bloomOn) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }

    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);

    const prevTM = r.toneMapping;
    r.toneMapping = THREE.NoToneMapping;

    this.quad.material = this.prefilter;
    this.prefilter.uniforms.tSrc.value = this.sceneRT.texture;
    this.prefilter.uniforms.uTexel.value.set(1 / this.sceneRT.width, 1 / this.sceneRT.height);
    r.setRenderTarget(this.levels[0]);
    r.render(this.scene, this.cam);

    this.quad.material = this.down;
    for (let i = 1; i < this.levels.length; i++) {
      const prev = this.levels[i - 1];
      this.down.uniforms.tSrc.value = prev.texture;
      this.down.uniforms.uTexel.value.set(1 / prev.width, 1 / prev.height);
      r.setRenderTarget(this.levels[i]);
      r.render(this.scene, this.cam);
    }

    this.quad.material = this.up;
    let small = this.levels[this.levels.length - 1];
    for (let i = this.levels.length - 2; i >= 0; i--) {
      const base = this.levels[i];
      this.up.uniforms.tBase.value = base.texture;
      this.up.uniforms.tSmall.value = small.texture;
      this.up.uniforms.uTexel.value.set(1 / small.width, 1 / small.height);
      r.setRenderTarget(this.scratch[i]);
      r.render(this.scene, this.cam);
      small = this.scratch[i];
    }

    this.quad.material = this.comp;
    this.comp.uniforms.tScene.value = this.sceneRT.texture;
    this.comp.uniforms.tBloom.value = small.texture;
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);

    r.toneMapping = prevTM;
  }
}
