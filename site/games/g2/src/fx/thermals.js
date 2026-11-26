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

  update(dt, time, balloonPos, balloonYaw, airSpeed, climbRate, turnRate, activeFlying) {
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
  }
}
