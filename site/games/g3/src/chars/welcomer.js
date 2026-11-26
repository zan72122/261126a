import * as THREE from '../../lib/three.module.js';
import { PALETTE, WELCOMER_POS } from '../core/env.js';

// Welcoming figure at the Starlit Cove Pavilion holding a brass lantern.
export class Welcomer {
  constructor({ lowQuality = false, textures = null } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'welcomer';
    this.group.position.copy(WELCOMER_POS);
    this.group.rotation.y = Math.PI * 1.12; // Facing toward arriving girl & moored sailboat

    const castShadow = !lowQuality;
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xeac09f, roughness: 0.72 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3b2a22, roughness: 0.78 });
    const tunicMat = new THREE.MeshStandardMaterial({
      color: 0xefeae0,
      roughness: 0.85,
      map: textures?.sailMap || null,
    });
    const shawlMat = new THREE.MeshStandardMaterial({
      color: PALETTE.terracotta,
      roughness: 0.8,
      map: textures?.sailMap || null,
    });
    const trouserMat = new THREE.MeshStandardMaterial({ color: 0x3a4d66, roughness: 0.84 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0x94703e, roughness: 0.38, metalness: 0.68 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x261a14 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xfffaf0 });
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xe39484 });
    const lipMat = new THREE.MeshBasicMaterial({ color: 0xb86458 });

    this.lanternMat = new THREE.MeshStandardMaterial({
      color: 0xfff1c9,
      emissive: 0xffc364,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });

    for (const sx of [-0.095, 0.095]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.054, 0.78, 9), trouserMat);
      leg.position.set(sx, 0.39, 0);
      leg.castShadow = castShadow;
      this.group.add(leg);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.06, 0.17), hairMat);
      shoe.position.set(sx, 0.03, 0.025);
      this.group.add(shoe);
    }

    const tunic = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.19, 0.68, 12), tunicMat);
    tunic.position.y = 0.98;
    tunic.castShadow = castShadow;
    this.group.add(tunic);

    const shawl = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.21, 0.24, 12), shawlMat);
    shawl.position.y = 1.24;
    this.group.add(shawl);

    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 1.52;
    this.group.add(this.headGroup);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 14), skinMat);
    head.scale.set(0.96, 1.04, 0.98);
    head.castShadow = castShadow;
    this.headGroup.add(head);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.017, 7, 6), skinMat);
    nose.position.set(0, -0.015, 0.134);
    this.headGroup.add(nose);

    for (const sx of [-0.045, 0.045]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 7), eyeMat);
      eye.position.set(sx, 0.01, 0.125);
      this.headGroup.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 6, 5), glintMat);
      glint.position.set(sx + 0.004, 0.016, 0.139);
      this.headGroup.add(glint);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.008, 0.01), hairMat);
      brow.position.set(sx, 0.04, 0.123);
      this.headGroup.add(brow);

      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 6), cheekMat);
      cheek.scale.set(1.2, 0.72, 0.45);
      cheek.position.set(sx * 1.48, -0.026, 0.112);
      this.headGroup.add(cheek);
    }

    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.022, 0.0055, 6, 10, Math.PI * 0.72),
      lipMat
    );
    smile.position.set(0, -0.040, 0.129);
    smile.rotation.z = Math.PI + Math.PI * 0.14;
    this.headGroup.add(smile);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.142, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
    hair.position.set(0, 0.02, -0.01);
    hair.rotation.x = -0.22;
    this.headGroup.add(hair);

    // Left arm (gently waving when girl arrives)
    this.armL = new THREE.Group();
    this.armL.position.set(-0.2, 1.3, 0);
    const capL = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 7), shawlMat);
    this.armL.add(capL);
    const armLM = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.48, 8), tunicMat);
    armLM.position.y = -0.22;
    this.armL.add(armLM);
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 7), skinMat);
    handL.position.y = -0.47;
    this.armL.add(handL);
    this.group.add(this.armL);

    // Right arm holding brass lantern forward
    this.armR = new THREE.Group();
    this.armR.position.set(0.2, 1.3, 0);
    this.armR.rotation.x = -0.82;
    const capR = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 7), shawlMat);
    this.armR.add(capR);
    const armRM = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.48, 8), tunicMat);
    armRM.position.y = -0.22;
    this.armR.add(armRM);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 7), skinMat);
    handR.position.y = -0.47;
    this.armR.add(handR);

    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(0, -0.58, 0.14);
    lanternGroup.rotation.x = 0.82;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.1, 6), brassMat);
    cap.position.y = 0.16;
    lanternGroup.add(cap);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.22, 6), this.lanternMat);
    lanternGroup.add(core);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.05, 6), brassMat);
    base.position.y = -0.13;
    lanternGroup.add(base);

    this.armR.add(lanternGroup);
    this.group.add(this.armR);
  }

  update(t, waving = false, lanternLevel = 0.5) {
    this.lanternMat.emissiveIntensity = 1.1 + lanternLevel * 1.7;
    if (waving) {
      this.armL.rotation.z = 2.05 + Math.sin(t * 4.2) * 0.24;
      this.armL.rotation.x = -0.2;
      this.headGroup.rotation.z = Math.sin(t * 2.1) * 0.04;
    } else {
      this.armL.rotation.z = 0.08 + Math.sin(t * 1.5) * 0.03;
      this.armL.rotation.x = 0;
      this.headGroup.rotation.z = 0;
    }
  }
}
