// Airy Luminous Dandelion Seed Tuft (たんぽぽの綿毛) parachute + morning light motes
import * as THREE from '../../lib/three.module.js';
import { PALETTE } from '../core/palette.js';
import { makeSoftDotTexture } from '../core/textures.js';

export class DandelionFloat {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'dandelionFloat';
    this.group.visible = false;

    const dotTex = makeSoftDotTexture();

    // Slender cream stem extending from the girl's raised hand
    const stemMat = new THREE.MeshStandardMaterial({
      color: PALETTE.cream,
      emissive: PALETTE.apricotSoft,
      emissiveIntensity: 0.28,
      roughness: 0.55,
    });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 1.12, 6), stemMat);
    stem.position.y = 0.56;
    this.group.add(stem);

    // Seed achene & crown hub
    const hub = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 8, 6),
      new THREE.MeshBasicMaterial({ color: PALETTE.apricotSoft })
    );
    hub.position.y = 1.12;
    this.group.add(hub);

    // Delicate multi-tier radial pappus silk filaments + feathery down tufts
    const filMat = new THREE.MeshBasicMaterial({
      color: 0xfffaf0,
      transparent: true,
      opacity: 0.92,
    });
    const tipMat = new THREE.SpriteMaterial({
      map: dotTex,
      color: 0xfff8e6,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    const tiers = [
      { count: 18, tilt: 1.08, len: 0.96, rTip: 0.92, yTip: 1.54 },
      { count: 12, tilt: 0.58, len: 0.84, rTip: 0.52, yTip: 1.80 },
      { count: 6, tilt: 0.22, len: 0.72, rTip: 0.22, yTip: 1.90 },
    ];
    for (const tier of tiers) {
      for (let i = 0; i < tier.count; i++) {
        const ang = (i / tier.count) * Math.PI * 2 + tier.tilt * 0.35;
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, tier.len, 4), filMat);
        const rx = Math.cos(ang) * tier.rTip * 0.5;
        const rz = Math.sin(ang) * tier.rTip * 0.5;
        const ry = 1.12 + (tier.yTip - 1.12) * 0.5;
        rib.position.set(rx, ry, rz);
        rib.lookAt(Math.cos(ang) * tier.rTip, tier.yTip, Math.sin(ang) * tier.rTip);
        rib.rotateX(Math.PI / 2);
        this.group.add(rib);

        const tuft = new THREE.Sprite(tipMat);
        tuft.position.set(Math.cos(ang) * tier.rTip, tier.yTip, Math.sin(ang) * tier.rTip);
        tuft.scale.setScalar(0.36);
        this.group.add(tuft);
      }
    }

    // Airy inner-glowing pappus sphere aura
    this.canopyGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: dotTex,
        color: 0xfff3d8,
        transparent: true,
        opacity: 0.54,
        depthWrite: false,
      })
    );
    this.canopyGlow.position.y = 1.58;
    this.canopyGlow.scale.set(2.45, 1.62, 1);
    this.group.add(this.canopyGlow);

    // Warm morning-light aura surrounding the descending girl
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: dotTex,
        color: PALETTE.apricotSoft,
        transparent: true,
        opacity: 0.40,
        depthWrite: false,
      })
    );
    this.halo.position.y = 0.25;
    this.halo.scale.set(3.2, 3.2, 1);
    this.group.add(this.halo);

    this.motes = [];
    for (let i = 0; i < 16; i++) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: dotTex,
          color: i % 2 === 0 ? PALETTE.cream : PALETTE.apricotSoft,
          transparent: true,
          opacity: 0.80,
          depthWrite: false,
        })
      );
      sp.scale.setScalar(0.16 + (i % 3) * 0.06);
      this.group.add(sp);
      this.motes.push({
        sp,
        ang: (i / 16) * Math.PI * 2,
        r: 0.58 + (i % 4) * 0.18,
        yOff: -0.95 + (i % 5) * 0.45,
      });
    }
  }

  update(time, active) {
    this.group.visible = active;
    if (!active) return;
    this.group.rotation.y = time * 0.5;
    this.halo.scale.setScalar(3.0 + Math.sin(time * 2.5) * 0.22);
    this.canopyGlow.scale.set(2.4 + Math.sin(time * 3.1) * 0.12, 1.6 + Math.cos(time * 2.7) * 0.08, 1);
    for (const m of this.motes) {
      const a = m.ang + time * 1.1;
      m.sp.position.set(
        Math.cos(a) * m.r,
        m.yOff + ((time * 0.5 + m.ang) % 1.8) * 0.45,
        Math.sin(a) * m.r
      );
    }
  }
}
