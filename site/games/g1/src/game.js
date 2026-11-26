import * as THREE from '../lib/three.module.js';
import { SUN_DIR } from './core/env.js';
import { lerp, smoothstep } from './core/math.js';
import { createSharedMaterials } from './core/palette.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Post } from './core/post.js';
import { Sky } from './world/sky.js';
import { ValleyTerrain } from './world/terrain.js';
import { TrackNetwork } from './world/tracks.js';
import { VillageWorld } from './world/village.js';
import { StationsAndSummit } from './world/lake_and_summit.js';
import { CloudWorld } from './world/clouds.js';
import { Locomotive } from './world/locomotive.js';
import { Girl } from './chars/girl.js';
import { MountainDog } from './chars/puppy.js';
import { CueRing, FloatMotes, GuideStream, SteamPool } from './fx/particles.js';
import { Director } from './story/director.js';

function detectQuality(params) {
  const ua = navigator.userAgent;
  const mobile =
    /iPhone|iPad|iPod|Android/i.test(ua) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const cores = navigator.hardwareConcurrency || 4;
  let tier = mobile ? (cores >= 6 ? 'mid' : 'low') : 'high';
  if (params.get('q')) tier = params.get('q');

  const Q = {
    high: { shadow: 2048, msaa: 4, bloom: true, maxDpr: 2, puffs: 380, deckSegs: 48, terrainSegs: 128, steam: 260, low: false },
    mid: { shadow: 1024, msaa: 2, bloom: true, maxDpr: 1.6, puffs: 240, deckSegs: 36, terrainSegs: 96, steam: 180, low: false },
    low: { shadow: 512, msaa: 0, bloom: false, maxDpr: 1.0, puffs: 130, deckSegs: 24, terrainSegs: 64, steam: 96, low: true },
  };
  return { tier, ...(Q[tier] || Q.mid) };
}

export class Game {
  constructor(params) {
    this.params = params;
    this.debug = params.has('debug');
    this.q = detectQuality(params);

    const canvas = document.getElementById('c');
    const renderer = (this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.q.low,
      powerPreference: 'high-performance',
      stencil: false,
    }));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.dpr = 1;
    this.time = 0;
    this.frameTimes = [];

    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 3400);
    this.scene = new THREE.Scene();
    this.fogValleyColor = new THREE.Color('#ddebf7');
    this.fogCloudColor = new THREE.Color('#eae8e0');
    this.scene.fog = new THREE.FogExp2('#ddebf7', 0.00078);
  }

  async init() {
    const r = this.renderer;
    this.input = new Input(r.domElement);
    this.audio = new Audio();
    this.post = new Post(r, { msaa: this.q.msaa, bloom: this.q.bloom });
    this.mats = createSharedMaterials();

    // Sky & IBL
    this.sky = new Sky();
    this.scene.add(this.sky.mesh);
    this.scene.environment = this.sky.makeEnvironment(r);

    // Clear early-autumn afternoon sun + balanced sky-bounce fill
    this.sun = new THREE.DirectionalLight('#fff0d2', 3.0);
    this.sun.position.copy(SUN_DIR).multiplyScalar(70);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.q.shadow, this.q.shadow);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 160;
    const sc = 20;
    this.sun.shadow.camera.left = -sc;
    this.sun.shadow.camera.right = sc;
    this.sun.shadow.camera.top = sc;
    this.sun.shadow.camera.bottom = -sc;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight('#b5d5f0', '#5a6e49', 0.96);
    this.scene.add(this.hemi);

    // Subtle front-side sky bounce fill so characters remain readable even in backlit summit framing
    this.bounceFill = new THREE.DirectionalLight('#d8e8f8', 0.52);
    this.bounceFill.position.set(-0.6, 0.4, 0.7).normalize().multiplyScalar(50);
    this.scene.add(this.bounceFill);

    // Alpine Valley World
    this.terrain = new ValleyTerrain(this.mats, { segs: this.q.terrainSegs, low: this.q.low });
    this.scene.add(this.terrain.group);

    this.tracks = new TrackNetwork(this.mats, { low: this.q.low });
    this.scene.add(this.tracks.group);

    this.village = new VillageWorld(this.mats, { low: this.q.low });
    this.scene.add(this.village.group);

    this.stations = new StationsAndSummit(this.mats);
    this.scene.add(this.stations.group);

    this.clouds = new CloudWorld({ maxPuffs: this.q.puffs, deckSegs: this.q.deckSegs });
    this.scene.add(this.clouds.group);

    // Characters & Locomotive
    this.loco = new Locomotive(this.mats);
    this.scene.add(this.loco.group);

    this.girl = new Girl(this.mats);
    this.scene.add(this.girl.group);

    this.puppy = new MountainDog(this.mats, { scale: 0.92, hasBell: true });
    this.scene.add(this.puppy.group);

    // FX
    this.steam = new SteamPool(this.q.steam);
    this.scene.add(this.steam.mesh);

    this.floatMotes = new FloatMotes(this.q.low ? 16 : 28);
    this.scene.add(this.floatMotes.points);

    this.guideStream = new GuideStream(this.q.low ? 26 : 44);
    this.scene.add(this.guideStream.points);

    this.cueRing = new CueRing();
    this.scene.add(this.cueRing.mesh);

    // Director & AutoTest
    this.director = new Director(this);
    if (this.params.has('autotest')) {
      const { AutoTest } = await import('./story/autotest.js');
      this.autotest = new AutoTest(this);
    }

    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this._resize(), 200));

    if (this.debug) document.getElementById('fps').style.display = 'block';

    const startState = this.params.get('scene') || 'home';
    this.director.go(startState);
    this.director.update(1 / 60);

    r.compile(this.scene, this.camera);
    this.last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);

    const veil = document.getElementById('veil');
    if (this.params.has('noveil')) {
      veil.style.display = 'none';
    } else {
      setTimeout(() => {
        veil.style.opacity = 0;
        setTimeout(() => {
          veil.style.display = 'none';
        }, 1400);
      }, 100);
    }

    window.__ready = true;
  }

  _resize() {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.q.maxDpr);
    this.camera.aspect = this.vw / Math.max(1, this.vh);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.vw, this.vh, false);
    this.post.resize(Math.max(2, Math.floor(this.vw * this.dpr)), Math.max(2, Math.floor(this.vh * this.dpr)));
  }

  _updateAtmosphere(dt) {
    const D = this.director;
    const inGallery = D.state === 'ride' && D.segId === 'seg4_main' && D.segS >= 0.38 && D.segS <= 0.80;
    const highCloud = D.state === 'summit' || (D.state === 'ride' && D.segId === 'seg5_viaduct') || this.camera.position.y > 46;

    const targetSun = inGallery ? 2.15 : highCloud ? 3.22 : 3.0;
    const targetHemi = inGallery ? 0.78 : highCloud ? 1.05 : 0.96;
    const targetFog = inGallery ? 0.00108 : highCloud ? 0.00058 : 0.00078;
    const targetExp = inGallery ? 0.96 : highCloud ? 1.06 : 1.02;

    const k = 1 - Math.exp(-2.8 * dt);
    this.sun.intensity = lerp(this.sun.intensity, targetSun, k);
    this.hemi.intensity = lerp(this.hemi.intensity, targetHemi, k);
    this.scene.fog.density = lerp(this.scene.fog.density, targetFog, k);
    this.renderer.toneMappingExposure = lerp(this.renderer.toneMappingExposure, targetExp, k);

    const cloudMix = smoothstep(32, 62, this.camera.position.y);
    this.scene.fog.color.copy(this.fogValleyColor).lerp(this.fogCloudColor, cloudMix * 0.65);
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    const maxDt = this.autotest ? 0.09 : 0.05;
    const dt = Math.min(maxDt, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;

    if (this.autotest) this.autotest.frame(dt);
    this.director.update(dt);
    this._updateAtmosphere(dt);
    this.tracks.update(dt);
    this.terrain.update(this.time);
    this.village.update(this.time);
    this.stations.update(dt, this.time, this.director.summitArrived);
    this.clouds.update(this.time);
    this.steam.update(dt, this.camera.quaternion);

    const focus = this.director.state === 'ride' ? this.loco.pos : this.girl.pos;
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(SUN_DIR, 70);
    this.sun.target.updateMatrixWorld();

    this.post.render(this.scene, this.camera);

    if (this.debug) {
      this.frameTimes.push(dt);
      if (this.frameTimes.length > 30) this.frameTimes.shift();
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      const fps = Math.round(1 / Math.max(0.001, avg));
      document.getElementById('fps').textContent =
        `${fps} fps | ${this.q.tier} | ${window.__moment} | ${this.director.segId}`;
    }
  }
}
