import * as THREE from '../lib/three.module.js';
import { PALETTE, PAVILION_POS, shared } from './core/env.js';
import { clamp, smoothstep } from './core/math.js';
import { SoundEngine } from './core/audio.js';
import { InputController } from './core/input.js';
import { CameraRig } from './core/camera.js';
import { createProceduralTextures } from './world/textures.js';
import { SkyDome } from './world/sky.js';
import { buildTerrainGroup } from './world/terrain.js';
import { SeaSurface } from './world/sea.js';
import { TailwindRings } from './world/windrings.js';
import { createMaterials } from './world/props.js';
import { HarborTown } from './world/harbor.js';
import { Archipelago } from './world/islands.js';
import { Girl } from './chars/girl.js';
import { Sailboat } from './chars/sailboat.js';
import { Welcomer } from './chars/welcomer.js';
import { ParticleFX } from './fx/particles.js';
import { Director } from './story/director.js';
import { AutoTest } from './story/autotest.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    const params = new URLSearchParams(window.location.search);
    this.lowQuality = params.get('q') === 'low';
    this.isAutoTest = params.has('autotest');
    this.isDebug = params.has('debug');

    this.dpr = this.lowQuality ? 1.0 : Math.min(window.devicePixelRatio || 1, 2.0);
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.lowQuality,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = !this.lowQuality;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(shared.uFogColor.value.getHex(), 0.0029);

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / Math.max(1, window.innerHeight), 0.3, 4600);
    this.rig = new CameraRig(this.camera);

    // Compact procedural textures & normal maps
    this.textures = createProceduralTextures({ lowQuality: this.lowQuality });

    // Sky, Layered Backlit Clouds & IBL Environment
    this.sky = new SkyDome(this.textures.cloudTex, { lowQuality: this.lowQuality });
    this.scene.add(this.sky.mesh);
    if (this.sky.clouds) this.scene.add(this.sky.clouds);
    if (!this.lowQuality) {
      this.scene.environment = this.sky.makeEnvironment(this.renderer);
      this.scene.environmentIntensity = 0.65;
    }

    // Mediterranean Twilight -> Starry Night Lighting
    this.hemi = new THREE.HemisphereLight(0xa3b4d8, 0x26354d, 0.85);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffcda0, 1.55);
    this.sun.position.set(-70, 32, 90);
    if (!this.lowQuality) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.camera.near = 5;
      this.sun.shadow.camera.far = 260;
      const d = 55;
      this.sun.shadow.camera.left = -d;
      this.sun.shadow.camera.right = d;
      this.sun.shadow.camera.top = d;
      this.sun.shadow.camera.bottom = -d;
      this.sun.shadow.bias = -0.0005;
    }
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Pavilion Goal Beacon Light
    this.pavilionLight = new THREE.PointLight(PALETTE.lantern, 2.8, 56, 1.35);
    this.pavilionLight.position.set(PAVILION_POS.x, 4.8, PAVILION_POS.z - 2.6);
    this.scene.add(this.pavilionLight);

    // World & Actors
    const mats = createMaterials(this.textures, { lowQuality: this.lowQuality });
    this.terrain = buildTerrainGroup({ lowQuality: this.lowQuality, textures: this.textures });
    this.scene.add(this.terrain);

    this.sea = new SeaSurface({ lowQuality: this.lowQuality });
    this.scene.add(this.sea.group);

    this.windRings = new TailwindRings();
    this.scene.add(this.windRings.group);

    this.harbor = new HarborTown(mats, { lowQuality: this.lowQuality });
    this.scene.add(this.harbor.group);

    this.archipelago = new Archipelago(mats, { lowQuality: this.lowQuality });
    this.scene.add(this.archipelago.group);

    this.girl = new Girl({ lowQuality: this.lowQuality, textures: this.textures });
    this.scene.add(this.girl.group);

    this.boat = new Sailboat({ lowQuality: this.lowQuality, textures: this.textures });
    this.scene.add(this.boat.group);

    this.welcomer = new Welcomer({ lowQuality: this.lowQuality, textures: this.textures });
    this.scene.add(this.welcomer.group);

    this.fx = new ParticleFX({ lowQuality: this.lowQuality });
    this.scene.add(this.fx.group);

    // Systems
    this.audio = new SoundEngine();
    this.input = new InputController(canvas);
    this.director = new Director({
      camera: this.camera,
      rig: this.rig,
      girl: this.girl,
      boat: this.boat,
      welcomer: this.welcomer,
      harbor: this.harbor,
      archipelago: this.archipelago,
      windRings: this.windRings,
      audio: this.audio,
    });
    this.input.onTap = (tap) => this.director.handleTap(tap);

    this.autotest = this.isAutoTest ? new AutoTest(this) : null;

    this.fpsEl = document.getElementById('fps');
    if (this.isDebug && this.fpsEl) this.fpsEl.style.display = 'block';
    this.frameCount = 0;
    this.fpsAccum = 0;
    this.lastTime = 0;
    this.elapsed = 0;

    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  start() {
    const veil = document.getElementById('veil');
    if (veil) {
      requestAnimationFrame(() => { veil.style.opacity = '0'; });
      setTimeout(() => { veil.style.display = 'none'; }, 1600);
    }
    window.__ready = true;
    this.lastTime = performance.now();
    const tick = (now) => {
      requestAnimationFrame(tick);
      const rawDt = (now - this.lastTime) * 0.001;
      this.lastTime = now;
      const dt = clamp(rawDt, 0.001, 0.05);
      this._step(dt);
    };
    requestAnimationFrame(tick);
  }

  _step(dt) {
    this.elapsed += dt;
    shared.uTime.value = this.elapsed;

    this.input.update(dt);
    if (this.autotest) this.autotest.frame(dt);

    this.director.update(dt, this.elapsed, this.input, this.isAutoTest);

    const night = shared.uNight.value;
    shared.uBoatPos.value.copy(this.boat.pos);
    shared.uBoatYaw.value = this.boat.yaw;
    shared.uBoatSpeed.value = this.boat.speed;
    shared.uBreezeBoost.value = clamp(this.director.breezeTimer / 2.2, 0, 1);

    this.scene.fog.color.copy(shared.uFogColor.value);
    this.hemi.intensity = 0.88 - night * 0.34;
    this.sun.intensity = 1.55 - night * 1.15;
    this.sun.color.setHex(0xffcda0).lerp(new THREE.Color(0x9cb8ec), smoothstep(0.3, 0.9, night));
    this.sun.position.set(
      this.girl.pos.x - 45 + night * 70,
      36 + night * 18,
      this.girl.pos.z + 65
    );
    this.sun.target.position.copy(this.girl.pos);
    this.sun.target.updateMatrixWorld();

    this.harbor.update(this.elapsed, this.director.lanternLevel);
    this.archipelago.update(this.elapsed, dt, this.director.lanternLevel);
    this.sea.update(this.elapsed);
    this.windRings.update(this.elapsed);
    this.sky.updateClouds(this.elapsed, this.camera.position);
    this.fx.update(
      this.elapsed,
      this.girl.pos,
      this.girl.isFloating,
      night,
      this.boat,
      shared.uBreezeBoost.value
    );

    const shot = this.director.computeShot();
    const camStiff = this.director.state === 'float' ? 5.6 : this.director.state === 'stars' ? 4.2 : 2.2;
    this.rig.update(dt, shot, camStiff);

    this.renderer.render(this.scene, this.camera);

    if (this.isDebug && this.fpsEl) {
      this.frameCount++;
      this.fpsAccum += dt;
      if (this.fpsAccum >= 0.4) {
        const fps = this.frameCount / this.fpsAccum;
        const p = this.girl.pos;
        this.fpsEl.textContent =
          `${fps.toFixed(0)} fps  ${this.lowQuality ? 'low' : 'std'}\n` +
          `${window.__moment}:${this.director.state} (${p.x.toFixed(0)},${p.y.toFixed(1)},${p.z.toFixed(0)})`;
        this.frameCount = 0;
        this.fpsAccum = 0;
      }
    }
  }
}
