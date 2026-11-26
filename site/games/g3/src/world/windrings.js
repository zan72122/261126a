import * as THREE from '../../lib/three.module.js';
import { PALETTE, WIND_RINGS } from '../core/env.js';
import { getSeaWaveHeight } from './sea.js';

// Golden-apricot tailwind light rings along sea lanes with spiraling breeze ribbons & orbiting wind motes.
export class TailwindRings {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'tailwindRings';
    this.gates = [];

    const outerGeo = new THREE.TorusGeometry(4.8, 0.12, 8, 42, Math.PI * 1.28);
    const innerGeo = new THREE.TorusGeometry(4.25, 0.07, 7, 38, Math.PI * 1.24);
    const ribbonGeo = new THREE.TorusGeometry(3.55, 0.042, 6, 30, Math.PI * 0.78);
    const moteGeo = new THREE.SphereGeometry(0.11, 6, 5);

    for (let i = 0; i < WIND_RINGS.length; i++) {
      const spec = WIND_RINGS[i];
      const gateGroup = new THREE.Group();
      gateGroup.position.set(spec.pos.x, 0.2, spec.pos.z);
      gateGroup.rotation.y = spec.yaw;

      const outerMat = new THREE.MeshBasicMaterial({
        color: PALETTE.lantern,
        transparent: true,
        opacity: 0.64,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffe8b8,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const ribbonMat = new THREE.MeshBasicMaterial({
        color: PALETTE.citrus,
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const outer = new THREE.Mesh(outerGeo, outerMat);
      outer.rotation.z = -Math.PI * 0.14;
      outer.position.y = 1.65;
      gateGroup.add(outer);

      const inner = new THREE.Mesh(innerGeo, innerMat);
      inner.rotation.z = -Math.PI * 0.12;
      inner.position.y = 1.65;
      gateGroup.add(inner);

      const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
      ribbon.position.y = 1.85;
      ribbon.rotation.z = 0.4;
      gateGroup.add(ribbon);

      const motes = [];
      for (let m = 0; m < 6; m++) {
        const mm = new THREE.Mesh(moteGeo, innerMat);
        gateGroup.add(mm);
        motes.push(mm);
      }

      this.group.add(gateGroup);
      this.gates.push({
        spec,
        group: gateGroup,
        ribbon,
        motes,
        outerMat,
        innerMat,
        ribbonMat,
        cooldown: 0,
        pulseBurst: 0,
      });
    }
  }

  checkPass(boatPos, dt) {
    let triggered = false;
    for (const g of this.gates) {
      if (g.cooldown > 0) g.cooldown = Math.max(0, g.cooldown - dt);
      if (g.pulseBurst > 0) g.pulseBurst = Math.max(0, g.pulseBurst - dt * 1.4);

      const d = Math.hypot(boatPos.x - g.spec.pos.x, boatPos.z - g.spec.pos.z);
      if (d < g.spec.radius && g.cooldown <= 0) {
        g.cooldown = 12.0;
        g.pulseBurst = 1.0;
        triggered = true;
      }
    }
    return triggered;
  }

  update(t) {
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i];
      const wy = getSeaWaveHeight(g.spec.pos.x, g.spec.pos.z, t);
      g.group.position.y = wy + 0.15;

      const burst = g.pulseBurst;
      const sc = 1.0 + burst * 0.35 + Math.sin(t * 1.9 + i) * 0.025;
      g.group.scale.setScalar(sc);

      g.ribbon.rotation.z = t * 1.25 + i * 0.9;
      g.motes.forEach((mm, mIdx) => {
        const a = t * 1.8 + mIdx * (Math.PI / 3) + i;
        mm.position.set(Math.cos(a) * 4.45, 1.7 + Math.sin(a) * 4.45, Math.sin(t * 2.2 + mIdx) * 0.55);
      });

      const ready = g.cooldown <= 0 ? 1.0 : 0.35;
      g.outerMat.opacity = (0.48 + 0.16 * Math.sin(t * 2.4 + i) + burst * 0.35) * ready;
      g.innerMat.opacity = (0.34 + 0.14 * Math.cos(t * 2.1 + i) + burst * 0.3) * ready;
      g.ribbonMat.opacity = (0.34 + burst * 0.35) * ready;
    }
  }
}
