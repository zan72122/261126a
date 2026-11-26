import * as THREE from '../../lib/three.module.js';

function makeSoftGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255, 250, 235, 1)');
  grad.addColorStop(0.45, 'rgba(255, 224, 155, 0.65)');
  grad.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// Floating sea-light motes, starry fireflies, float-aura sparkles, bow spray & breeze wind streaks.
export class ParticleFX {
  constructor({ lowQuality = false } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'particles';
    const glowTex = makeSoftGlowTexture();

    // 1. Ambient sea-light motes & fireflies
    this.count = lowQuality ? 48 : 96;
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.count * 3);
    this.phases = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      this.phases[i] = Math.random() * Math.PI * 2;
      this.positions[i * 3] = (Math.random() - 0.5) * 240;
      this.positions[i * 3 + 1] = 0.6 + Math.random() * 5.0;
      this.positions[i * 3 + 2] = -120 + Math.random() * 320;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    this.mat = new THREE.PointsMaterial({
      map: glowTex,
      color: 0xffd78a,
      size: lowQuality ? 0.72 : 0.62,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    // 2. Local float-aura motes circling the girl during slow descent
    this.floatCount = lowQuality ? 16 : 32;
    const fGeo = new THREE.BufferGeometry();
    this.fPos = new Float32Array(this.floatCount * 3);
    fGeo.setAttribute('position', new THREE.BufferAttribute(this.fPos, 3));
    this.fMat = new THREE.PointsMaterial({
      map: glowTex,
      color: 0xffe4a8,
      size: 0.44,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.floatPoints = new THREE.Points(fGeo, this.fMat);
    this.floatPoints.frustumCulled = false;
    this.group.add(this.floatPoints);

    // 3. Bow sea-spray droplets kicked up when sailing fast / boosting
    this.sprayCount = lowQuality ? 18 : 38;
    const spGeo = new THREE.BufferGeometry();
    this.sprayPos = new Float32Array(this.sprayCount * 3);
    spGeo.setAttribute('position', new THREE.BufferAttribute(this.sprayPos, 3));
    this.sprayMat = new THREE.PointsMaterial({
      map: glowTex,
      color: 0xf4f1ea,
      size: 0.36,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.sprayPoints = new THREE.Points(spGeo, this.sprayMat);
    this.sprayPoints.frustumCulled = false;
    this.group.add(this.sprayPoints);

    // 4. Breeze wind-streak lines around sailboat during tailwind boost
    this.streakCount = lowQuality ? 16 : 32;
    const stGeo = new THREE.BufferGeometry();
    this.streakPos = new Float32Array(this.streakCount * 6);
    stGeo.setAttribute('position', new THREE.BufferAttribute(this.streakPos, 3));
    this.streakMat = new THREE.LineBasicMaterial({
      color: 0xffe8ba,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.streaks = new THREE.LineSegments(stGeo, this.streakMat);
    this.streaks.frustumCulled = false;
    this.group.add(this.streaks);
  }

  update(t, girlPos, isFloating, nightLevel, boat = null, breezeBoost = 0) {
    this.mat.opacity = 0.28 + nightLevel * 0.58;
    const pos = this.points.geometry.attributes.position;
    for (let i = 0; i < this.count; i++) {
      const ph = this.phases[i];
      const y = pos.getY(i) + Math.sin(t * 0.9 + ph) * 0.004;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;

    this.fMat.opacity += ((isFloating ? 0.88 : 0.0) - this.fMat.opacity) * 0.12;
    if (this.fMat.opacity > 0.01) {
      const fp = this.floatPoints.geometry.attributes.position;
      for (let i = 0; i < this.floatCount; i++) {
        const a = t * 1.4 + (i / this.floatCount) * Math.PI * 2;
        const r = 0.58 + 0.36 * Math.sin(t * 2.1 + i);
        const dy = 0.3 + ((i % 7) / 6) * 1.35 + Math.sin(t * 2.5 + i) * 0.15;
        fp.setXYZ(i, girlPos.x + Math.cos(a) * r, girlPos.y + dy, girlPos.z + Math.sin(a) * r);
      }
      fp.needsUpdate = true;
    }

    if (boat) {
      const speedFactor = Math.max(0, Math.min(1, (boat.speed - 4.0) / 10.0));
      const sinY = Math.sin(boat.yaw);
      const cosY = Math.cos(boat.yaw);
      const rightX = cosY;
      const rightZ = -sinY;

      this.sprayMat.opacity = speedFactor * (0.48 + breezeBoost * 0.42);
      if (this.sprayMat.opacity > 0.02) {
        const sp = this.sprayPoints.geometry.attributes.position;
        const bowX = boat.pos.x + sinY * 2.35;
        const bowZ = boat.pos.z + cosY * 2.35;
        for (let i = 0; i < this.sprayCount; i++) {
          const u = ((t * (1.8 + speedFactor * 1.2) + i / this.sprayCount) % 1.0);
          const side = i % 2 === 0 ? 1 : -1;
          const spread = (0.35 + u * (1.45 + breezeBoost * 0.85)) * side;
          const arcY = boat.pos.y + 0.15 + Math.sin(u * Math.PI) * (0.55 + breezeBoost * 0.48);
          const back = -u * (2.4 + speedFactor * 1.8);
          sp.setXYZ(
            i,
            bowX + rightX * spread + sinY * back,
            arcY,
            bowZ + rightZ * spread + cosY * back
          );
        }
        sp.needsUpdate = true;
      }

      const targetStreakOp = Math.min(0.46, breezeBoost * 0.44 + Math.max(0, (boat.speed - 9.2) * 0.055));
      this.streakMat.opacity += (targetStreakOp - this.streakMat.opacity) * 0.15;
      if (this.streakMat.opacity > 0.02) {
        const st = this.streaks.geometry.attributes.position;
        const len = 1.4 + breezeBoost * 1.8;
        for (let i = 0; i < this.streakCount; i++) {
          const u = ((t * 2.1 + i * 0.17) % 1.0);
          const lateral = ((i % 7) - 3) * 1.25;
          const elev = 0.7 + ((i * 3) % 5) * 0.85;
          const along = 6.5 - u * 16.0;
          const hx = boat.pos.x + sinY * along + rightX * lateral;
          const hz = boat.pos.z + cosY * along + rightZ * lateral;
          const hy = boat.pos.y + elev;
          st.setXYZ(i * 2, hx, hy, hz);
          st.setXYZ(i * 2 + 1, hx - sinY * len, hy, hz - cosY * len);
        }
        st.needsUpdate = true;
      }
    }
  }
}
