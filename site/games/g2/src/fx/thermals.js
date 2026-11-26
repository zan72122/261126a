// Thermal Updraft Rings (上昇の輪) + Velocity-Aligned Soft Air Motes (zero horizontal bar artifacts)
import * as THREE from '../../lib/three.module.js';
import { PALETTE } from '../core/palette.js';
import { makeSoftDotTexture } from '../core/textures.js';

export class ThermalSystem {
  constructor(lowQuality = false) {
    this.group = new THREE.Group();
    this.group.name = 'thermals';

    // 7 scenic thermal updraft rings: Ring 1 & 2 carry the balloon cleanly above the y=28..35 cloud stratum!
    const ringSpecs = [
      { x: 1.5, y: 21, z: -70, r: 4.8 },    // Ring 1: initial climb after takeoff
      { x: -6, y: 39, z: -122, r: 5.2 },    // Ring 2: emerges above cloud stratum -> soar at y=60..68!
      { x: -46, y: 34, z: -145, r: 4.8 },   // Ring 3: toward windmill hill
      { x: 42, y: 36, z: -175, r: 5.0 },    // Ring 4: toward detour village
      { x: -16, y: 34, z: -215, r: 5.2 },   // Ring 5: above flower clearing
      { x: 12, y: 42, z: -265, r: 5.0 },    // Ring 6: high glide toward clock tower
      { x: 4, y: 46, z: -295, r: 4.8 },     // Ring 7: high approach before clock tower plaza
    ];

    this.rings = [];
    const dotTex = makeSoftDotTexture();

    ringSpecs.forEach((spec, idx) => {
      const rg = new THREE.Group();
      rg.position.set(spec.x, spec.y, spec.z);

      const outerMat = new THREE.MeshBasicMaterial({
        color: idx % 2 === 0 ? PALETTE.apricotSoft : PALETTE.turquoiseSoft,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      });
      const outer = new THREE.Mesh(new THREE.TorusGeometry(spec.r, 0.16, 10, 32), outerMat);
      rg.add(outer);

      const innerMat = new THREE.MeshBasicMaterial({
        color: PALETTE.cream,
        transparent: true,
        opacity: 0.56,
        side: THREE.DoubleSide,
      });
      const inner = new THREE.Mesh(new THREE.TorusGeometry(spec.r * 0.78, 0.08, 8, 28), innerMat);
      rg.add(inner);

      const motes = [];
      const moteCount = lowQuality ? 4 : 8;
      for (let m = 0; m < moteCount; m++) {
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: dotTex,
            color: m % 2 === 0 ? PALETTE.cream : PALETTE.apricotSoft,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
          })
        );
        sp.scale.setScalar(0.55);
        rg.add(sp);
        motes.push({ sp, phase: (m / moteCount) * Math.PI * 2 });
      }

      this.group.add(rg);
      this.rings.push({
        group: rg,
        outer,
        inner,
        motes,
        pos: new THREE.Vector3(spec.x, spec.y, spec.z),
        radius: spec.r,
        cooldown: 0,
      });
    });

    // Velocity-aligned translucent air wisps (curved/aligned with flight direction, faded during circling)
    this.wisps = [];
    const wispGeo = new THREE.PlaneGeometry(0.11, 1.8);
    wispGeo.rotateX(Math.PI / 2);
    const wispCount = lowQuality ? 10 : 18;
    for (let i = 0; i < wispCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: dotTex,
        color: PALETTE.cream,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(wispGeo, mat);
      m.visible = false;
      this.group.add(m);
      this.wisps.push({
        mesh: m,
        mat,
        ox: (Math.random() - 0.5) * 14,
        oy: 0.8 + Math.random() * 6.5,
        oz: (Math.random() - 0.5) * 16,
      });
    }

    // Gentle morning breeze motes & tower sunlight beacon for 15-20s goal assist
    this.assistGroup = new THREE.Group();
    this.assistGroup.visible = false;
    this.assistAlpha = 0;

    this.assistMotes = [];
    const assistCount = lowQuality ? 12 : 20;
    for (let i = 0; i < assistCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: dotTex,
        color: i % 3 === 0 ? PALETTE.cream : PALETTE.apricotSoft,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.setScalar(0.55 + (i % 3) * 0.22);
      this.assistGroup.add(sp);
      this.assistMotes.push({
        sp,
        mat,
        phase: i / assistCount,
        side: ((i % 5) - 2) * 1.15,
        yOff: ((i % 4) - 1.2) * 0.9,
      });
    }

    const beaconGeo = new THREE.CylinderGeometry(3.2, 5.2, 46, 16, 1, true);
    this.towerBeaconMat = new THREE.MeshBasicMaterial({
      color: PALETTE.apricotSoft,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.towerBeacon = new THREE.Mesh(beaconGeo, this.towerBeaconMat);
    this.assistGroup.add(this.towerBeacon);

    this.towerHaloMat = new THREE.SpriteMaterial({
      map: dotTex,
      color: PALETTE.cream,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.towerHalo = new THREE.Sprite(this.towerHaloMat);
    this.towerHalo.scale.set(18, 18, 1);
    this.assistGroup.add(this.towerHalo);

    this.group.add(this.assistGroup);
  }

  checkTrigger(balloonCenter) {
    for (const r of this.rings) {
      if (r.cooldown > 0) continue;
      const dist = balloonCenter.distanceTo(r.pos);
      if (dist < r.radius + 3.4) {
        r.cooldown = 5.5;
        return r;
      }
    }
    return null;
  }

  nearestAhead(pos, maxDist = 110) {
    let best = null;
    let bestScore = Infinity;
    for (const r of this.rings) {
      if (r.cooldown > 0) continue;
      const d = pos.distanceTo(r.pos);
      if (d < maxDist && r.pos.z < pos.z + 15 && d < bestScore) {
        best = r;
        bestScore = d;
      }
    }
    return best;
  }

  update(dt, time, balloonPos, balloonYaw, airSpeed, climbRate, turnRate, activeFlying, assistFactor = 0, towerCenter = null) {
    for (const r of this.rings) {
      if (r.cooldown > 0) r.cooldown = Math.max(0, r.cooldown - dt);
      const pulse = 1.0 + Math.sin(time * 2.2 + r.pos.z * 0.05) * 0.05;
      r.outer.scale.setScalar(pulse);
      r.inner.rotation.z = time * 0.9;
      r.group.position.y = r.pos.y + Math.sin(time * 1.4 + r.pos.x) * 0.35;

      for (const m of r.motes) {
        const a = m.phase + time * 2.1;
        const cycle = (time * 0.75 + m.phase) % 1;
        m.sp.position.set(
          Math.cos(a) * r.radius * 0.68,
          (cycle - 0.5) * 4.2,
          Math.sin(a) * r.radius * 0.68
        );
      }
    }

    // Only show delicate heading-aligned wisps when gliding swiftly forward (never as sideways bars when circling!)
    const showWisps = activeFlying && (airSpeed > 9.5 || climbRate > 1.8) && Math.abs(turnRate) < 0.35;
    const fx = -Math.sin(balloonYaw);
    const fz = -Math.cos(balloonYaw);
    const rx = Math.cos(balloonYaw);
    const rz = -Math.sin(balloonYaw);

    for (const s of this.wisps) {
      s.mesh.visible = showWisps;
      if (!showWisps) continue;
      s.oz += dt * (10 + airSpeed * 1.2);
      if (s.oz > 8) s.oz -= 16;
      s.mesh.position.set(
        balloonPos.x + rx * s.ox - fx * s.oz,
        balloonPos.y + s.oy,
        balloonPos.z + rz * s.ox - fz * s.oz
      );
      s.mesh.rotation.y = balloonYaw;
      s.mat.opacity = 0.28 * (1 - Math.abs(s.oz) / 8.5);
    }

    // Visible morning wind stream & light beacon guiding back to Clock Tower Square when assist is active
    const blend = 1 - Math.exp(-3.0 * dt);
    this.assistAlpha += ((activeFlying && assistFactor > 0.5 ? 1 : 0) - this.assistAlpha) * blend;
    this.assistGroup.visible = this.assistAlpha > 0.02 && !!towerCenter;
    if (this.assistGroup.visible && towerCenter) {
      const dx = towerCenter.x - balloonPos.x;
      const dz = towerCenter.z - balloonPos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const dirX = dx / dist;
      const dirZ = dz / dist;
      const perpX = -dirZ;
      const perpZ = dirX;
      const span = Math.min(54, Math.max(14, dist - 2));

      for (const m of this.assistMotes) {
        const prog = (m.phase + time * 0.34) % 1;
        const along = 6 + prog * span;
        const sway = Math.sin(time * 2.2 + m.phase * 12) * 1.1;
        const yTarget = balloonPos.y + 3.4 + (towerCenter.y + 4.5 - (balloonPos.y + 3.4)) * (along / Math.max(dist, 12));
        m.sp.position.set(
          balloonPos.x + dirX * along + perpX * (m.side + sway),
          yTarget + m.yOff + Math.cos(time * 1.9 + m.phase * 9) * 0.45,
          balloonPos.z + dirZ * along + perpZ * (m.side + sway)
        );
        const fade = Math.sin(prog * Math.PI);
        m.mat.opacity = 0.72 * fade * this.assistAlpha;
      }

      const pulse = 0.85 + 0.15 * Math.sin(time * 2.4);
      this.towerBeacon.position.set(towerCenter.x, towerCenter.y + 22, towerCenter.z);
      this.towerBeaconMat.opacity = 0.14 * pulse * this.assistAlpha;
      this.towerHalo.position.set(towerCenter.x, towerCenter.y + 8, towerCenter.z);
      this.towerHaloMat.opacity = 0.42 * pulse * this.assistAlpha;
    }
  }
}
