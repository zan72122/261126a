import * as THREE from '../../lib/three.module.js';

function makeSoftPuffTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);

  // Multi-lobed organic wisp radial gradient (avoids solid sphere ball look)
  const drawLobe = (cx, cy, r, a) => {
    const g = ctx.createRadialGradient(cx, cy, r * 0.08, cx, cy, r);
    g.addColorStop(0.0, `rgba(255, 255, 255, ${a})`);
    g.addColorStop(0.45, `rgba(246, 250, 254, ${a * 0.65})`);
    g.addColorStop(0.78, `rgba(235, 243, 250, ${a * 0.18})`);
    g.addColorStop(1.0, 'rgba(235, 243, 250, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  drawLobe(64, 64, 52, 0.58);
  drawLobe(46, 56, 34, 0.42);
  drawLobe(80, 58, 34, 0.42);
  drawLobe(62, 46, 36, 0.38);
  drawLobe(66, 78, 32, 0.34);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Pooled steam & atmospheric particle effects:
 * - Soft camera-facing billowing steam puffs for chimney, whistle plume, and cylinder valves
 * - Gentle golden-blue wind stream guiding toward summit after 20s idle
 * - Interactive ground selection ring (wordless visual cue)
 * - Sunlit motes swirling around the girl during aerial umbrella float
 */
export class SteamPool {
  constructor(maxPuffs = 220) {
    this.max = maxPuffs;
    this.items = [];
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: makeSoftPuffTexture(),
      color: '#ffffff',
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxPuffs);
    this.mesh.frustumCulled = false;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._rollQ = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._zAxis = new THREE.Vector3(0, 0, 1);

    for (let i = 0; i < maxPuffs; i++) {
      this.items.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        life: 1,
        scale0: 0.5,
        scale1: 2.2,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.8,
      });
      this._m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.cursor = 0;
  }

  emit(pos, vel, { life = 1.8, scale0 = 0.45, scale1 = 2.4 } = {}) {
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    p.active = true;
    p.pos.copy(pos);
    p.vel.copy(vel);
    p.age = 0;
    p.life = life;
    p.scale0 = scale0;
    p.scale1 = scale1;
    p.rot = Math.random() * Math.PI * 2;
    p.spin = (Math.random() - 0.5) * 0.9;
  }

  update(dt, camQuat) {
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        this._m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this._m);
        continue;
      }
      const t = p.age / p.life;
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - Math.min(0.9, dt * 1.15));
      p.vel.y += dt * 1.35;
      p.rot += p.spin * dt;

      // Smooth billow growth then gentle fade shrinkage
      const grow = Math.min(1, t / 0.18);
      const fade = t < 0.2 ? t / 0.2 : Math.max(0, 1 - (t - 0.2) / 0.8);
      const sc = (p.scale0 + (p.scale1 - p.scale0) * Math.sqrt(t)) * grow * (0.35 + fade * 0.65);

      if (camQuat) {
        this._q.copy(camQuat);
        this._rollQ.setFromAxisAngle(this._zAxis, p.rot);
        this._q.multiply(this._rollQ);
      } else {
        this._q.identity();
      }
      this._s.set(sc, sc * 0.92, sc);
      this._m.compose(p.pos, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class FloatMotes {
  constructor(count = 28) {
    this.count = count;
    const pos = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: '#ffe394',
      size: 0.18,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.alpha = 0;
  }

  update(dt, time, active, centerPos) {
    this.alpha += ((active ? 0.88 : 0) - this.alpha) * Math.min(1, dt * 4.5);
    this.points.material.opacity = this.alpha;
    this.points.visible = this.alpha > 0.02;
    if (!this.points.visible) return;

    const attr = this.points.geometry.attributes.position;
    for (let i = 0; i < this.count; i++) {
      const a = (i / this.count) * Math.PI * 2 + time * 1.1;
      const r = 0.65 + (i % 4) * 0.24 + Math.sin(time * 2.2 + i) * 0.14;
      const yOff = ((i * 0.37 + time * 0.45) % 2.4) - 0.1;
      attr.setXYZ(
        i,
        centerPos.x + Math.cos(a) * r,
        centerPos.y + yOff,
        centerPos.z + Math.sin(a) * r
      );
    }
    attr.needsUpdate = true;
  }
}

export class GuideStream {
  constructor(count = 44) {
    this.count = count;
    const pos = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: '#f2cb63',
      size: 0.85,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.alpha = 0;
  }

  update(dt, time, active, fromPos, toPos) {
    this.alpha += ((active ? 0.85 : 0) - this.alpha) * Math.min(1, dt * 2.5);
    this.points.material.opacity = this.alpha;
    this.points.visible = this.alpha > 0.02;
    if (!this.points.visible) return;

    const attr = this.points.geometry.attributes.position;
    const dx = toPos.x - fromPos.x;
    const dz = toPos.z - fromPos.z;
    const len = Math.max(1, Math.hypot(dx, dz));
    const perpX = -dz / len;
    const perpZ = dx / len;
    for (let i = 0; i < this.count; i++) {
      const f = ((i / this.count) + time * 0.26) % 1;
      const arc = Math.sin(f * Math.PI) * 6.5;
      const swirl = Math.sin(f * Math.PI * 3.0 - time * 2.4 + i * 0.2) * 1.8 * Math.sin(f * Math.PI);
      const x = fromPos.x + dx * f + perpX * swirl;
      const y = fromPos.y + (toPos.y - fromPos.y) * f + arc + 1.6;
      const z = fromPos.z + dz * f + perpZ * swirl;
      attr.setXYZ(i, x, y, z);
    }
    attr.needsUpdate = true;
  }
}

/**
 * Luminous golden-cream steam rails emitted beneath the locomotive wheels while flying through the sky.
 */
export class SkyTrackPool {
  constructor(maxPuffs = 140) {
    this.max = maxPuffs;
    this.items = [];
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: makeSoftPuffTexture(),
      color: '#ffe9a8',
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxPuffs);
    this.mesh.frustumCulled = false;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();

    for (let i = 0; i < maxPuffs; i++) {
      this.items.push({ active: false, pos: new THREE.Vector3(), age: 0, life: 1.6, scale: 0.9 });
      this._m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.cursor = 0;
  }

  emit(pos, scale = 0.95, life = 1.8) {
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    p.active = true;
    p.pos.copy(pos);
    p.age = 0;
    p.life = life;
    p.scale = scale;
  }

  update(dt, camQuat) {
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        this._m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this._m);
        continue;
      }
      const t = p.age / p.life;
      p.pos.y -= dt * 0.18;
      const sc = p.scale * (0.65 + t * 0.65) * (1 - t * 0.55);
      if (camQuat) this._q.copy(camQuat);
      else this._q.identity();
      this._s.set(sc * 1.35, sc * 0.65, sc);
      this._m.compose(p.pos, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class CueRing {
  constructor() {
    const geo = new THREE.RingGeometry(0.65, 0.86, 28);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: '#edd06d',
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
  }

  update(time, visible, pos, scale = 1) {
    this.mesh.visible = visible;
    if (!visible) return;
    this.mesh.position.set(pos.x, pos.y + 0.08, pos.z);
    const pulse = 1 + Math.sin(time * 3.8) * 0.09;
    this.mesh.scale.setScalar(scale * pulse);
    this.mesh.material.opacity = 0.55 + Math.sin(time * 3.8) * 0.25;
  }
}
