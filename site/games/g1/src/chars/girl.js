import * as THREE from '../../lib/three.module.js';
import { lerp } from '../core/math.js';

/**
 * Realistic-proportioned Girl protagonist (~1.26m tall, articulated limbs, no princess look).
 * Wears an early-autumn wool cardigan, pleated cobalt skirt, dark leggings, laced boots,
 * braided twin tails with a knit beret. Holds a wordless cloth ticket + tiny brass bell at home,
 * and opens a sunlit cobalt-and-mustard umbrella during slow aerial descent.
 */
export class Girl {
  constructor(mats) {
    this.group = new THREE.Group();
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.walkCycle = 0;
    this.mats = mats;
    this.interactables = [];

    const skin = new THREE.MeshStandardMaterial({ color: '#f3d1bd', roughness: 0.72 });
    const hair = new THREE.MeshStandardMaterial({ color: '#5b3c2b', roughness: 0.78 });
    const cardigan = new THREE.MeshStandardMaterial({
      bumpMap: mats.fabricBump,
      bumpScale: 0.012,
      color: '#ece6d8',
      roughness: 0.85,
    });
    const scarf = mats.mustard;
    const skirtMat = mats.cobalt;
    const leggings = new THREE.MeshStandardMaterial({ color: '#2b3342', roughness: 0.85 });
    const boots = mats.timberDark;

    this.root = new THREE.Group();
    this.group.add(this.root);

    this.legL = this._makeLeg(leggings, boots);
    this.legL.hip.position.set(-0.1, 0.56, 0);
    this.root.add(this.legL.hip);

    this.legR = this._makeLeg(leggings, boots);
    this.legR.hip.position.set(0.1, 0.56, 0);
    this.root.add(this.legR.hip);

    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.28, 16), skirtMat);
    skirt.position.y = 0.58;
    skirt.castShadow = true;
    this.root.add(skirt);

    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.012, 6, 18), scarf);
    hem.rotation.x = Math.PI / 2;
    hem.position.y = 0.45;
    this.root.add(hem);

    this.torso = new THREE.Group();
    this.torso.position.y = 0.68;
    this.root.add(this.torso);

    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.145, 0.34, 14), cardigan);
    chest.position.y = 0.17;
    chest.scale.set(1.08, 1, 0.78);
    chest.castShadow = true;
    this.torso.add(chest);

    for (const by of [0.1, 0.18, 0.26]) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), boots);
      btn.position.set(0, by, 0.112);
      this.torso.add(btn);
    }

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.032, 8, 14), scarf);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.34;
    this.torso.add(collar);

    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.025), scarf);
    scarfTail.position.set(-0.07, 0.24, 0.09);
    scarfTail.rotation.z = 0.12;
    this.torso.add(scarfTail);

    this.armL = this._makeArm(cardigan, skin);
    this.armL.shoulder.position.set(-0.17, 0.31, 0);
    this.torso.add(this.armL.shoulder);

    this.armR = this._makeArm(cardigan, skin);
    this.armR.shoulder.position.set(0.17, 0.31, 0);
    this.torso.add(this.armR.shoulder);

    this.head = new THREE.Group();
    this.head.position.y = 0.38;
    this.torso.add(this.head);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.07, 10), skin);
    neck.position.y = 0.01;
    this.head.add(neck);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 14), skin);
    skull.position.y = 0.12;
    skull.scale.set(0.95, 1.02, 0.96);
    skull.castShadow = true;
    this.head.add(skull);

    const hairTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.123, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
      hair
    );
    hairTop.position.set(0, 0.13, -0.015);
    hairTop.rotation.x = -0.18;
    this.head.add(hairTop);

    for (const side of [-1, 1]) {
      const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.018, 0.2, 8), hair);
      braid.position.set(side * 0.11, 0.02, -0.04);
      braid.rotation.z = side * -0.18;
      this.head.add(braid);

      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.009, 6, 10), mats.cobalt);
      tie.rotation.x = Math.PI / 2;
      tie.position.set(side * 0.12, -0.04, -0.04);
      this.head.add(tie);
    }

    const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.095, 0.055, 16), mats.cobalt);
    beret.position.set(0.01, 0.225, -0.015);
    beret.rotation.z = -0.12;
    this.head.add(beret);

    const eyeMat = new THREE.MeshStandardMaterial({ color: '#241c18', roughness: 0.3 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), eyeMat);
      eye.position.set(side * 0.042, 0.125, 0.098);
      this.head.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), skin);
    nose.position.set(0, 0.105, 0.112);
    this.head.add(nose);

    // Wordless Cloth Ticket + Tiny Brass Bell held at start
    this.ticketProp = new THREE.Group();
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.015), mats.cobalt);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.122, 0.022, 0.018), mats.mustard);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), mats.brass);
    bell.position.set(0.05, -0.04, 0);
    this.ticketProp.add(cloth, band, bell);
    this.ticketProp.position.set(0, -0.19, 0.05);
    this.armR.forearm.add(this.ticketProp);

    // Cobalt & Mustard Umbrella (with ribs & backlit translucent sheen during float)
    this.umbrella = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.94, 8), mats.timberLight);
    pole.position.y = 0.45;
    this.umbrella.add(pole);

    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 0.3, 14, 1, true),
      new THREE.MeshStandardMaterial({
        bumpMap: mats.fabricBump,
        bumpScale: 0.01,
        color: '#2d67b8',
        emissive: '#3a72bc',
        emissiveIntensity: 0.42,
        roughness: 0.48,
        side: THREE.DoubleSide,
      })
    );
    canopy.position.y = 0.88;
    this.umbrella.add(canopy);

    for (let r = 0; r < 6; r++) {
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.82, 5), mats.timberLight);
      rib.position.y = 0.88;
      rib.rotation.z = 1.2;
      rib.rotation.y = (r / 6) * Math.PI * 2;
      this.umbrella.add(rib);
    }

    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.024, 8, 24), mats.mustard);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.73;
    this.umbrella.add(trim);

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), mats.brass);
    finial.position.y = 1.04;
    this.umbrella.add(finial);

    this.halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.96, 16, 12),
      new THREE.MeshBasicMaterial({
        color: '#fff4c8',
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      })
    );
    this.halo.position.y = 0.92;
    this.umbrella.add(this.halo);

    this.umbrella.position.set(0.14, 1.05, 0.1);
    this.umbrella.visible = false;
    this.root.add(this.umbrella);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 1.35, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.68;
    hit.userData.interact = 'girl';
    this.group.add(hit);
    this.interactables.push(hit);
  }

  _makeLeg(legMat, bootMat) {
    const hip = new THREE.Group();
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.27, 10), legMat);
    thigh.position.y = -0.135;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.27;
    hip.add(knee);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.034, 0.23, 10), legMat);
    shin.position.y = -0.115;
    knee.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.09, 0.15), bootMat);
    boot.position.set(0, -0.245, 0.028);
    boot.castShadow = true;
    knee.add(boot);
    return { hip, knee };
  }

  _makeArm(sleeveMat, skinMat) {
    const shoulder = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.2, 10), sleeveMat);
    upper.position.y = -0.1;
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.2;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.028, 0.18, 10), sleeveMat);
    forearm.position.y = -0.09;
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), skinMat);
    hand.position.y = -0.19;
    elbow.add(hand);
    return { shoulder, elbow, forearm };
  }

  update(dt, time, { mode = 'idle', moveSpeed = 0, showTicket = false } = {}) {
    this.ticketProp.visible = showTicket;
    this.umbrella.visible = mode === 'float';

    const k = 1 - Math.exp(-10 * dt);

    if (mode === 'walk') {
      this.walkCycle += dt * (4.5 + moveSpeed * 1.4);
      const sw = Math.sin(this.walkCycle);
      this.legL.hip.rotation.x = lerp(this.legL.hip.rotation.x, sw * 0.55, k);
      this.legR.hip.rotation.x = lerp(this.legR.hip.rotation.x, -sw * 0.55, k);
      this.legL.knee.rotation.x = lerp(this.legL.knee.rotation.x, Math.max(0, -sw) * 0.45, k);
      this.legR.knee.rotation.x = lerp(this.legR.knee.rotation.x, Math.max(0, sw) * 0.45, k);
      this.armL.shoulder.rotation.x = lerp(this.armL.shoulder.rotation.x, -sw * 0.42, k);
      this.armR.shoulder.rotation.x = lerp(this.armR.shoulder.rotation.x, showTicket ? -0.65 : sw * 0.42, k);
      this.armR.elbow.rotation.x = lerp(this.armR.elbow.rotation.x, showTicket ? -0.55 : -0.15, k);
      this.root.position.y = Math.abs(Math.cos(this.walkCycle)) * 0.03;
      this.torso.rotation.z = Math.sin(this.walkCycle) * 0.03;
    } else if (mode === 'ride') {
      this.legL.hip.rotation.x = lerp(this.legL.hip.rotation.x, -0.08, k);
      this.legR.hip.rotation.x = lerp(this.legR.hip.rotation.x, -0.08, k);
      this.legL.knee.rotation.x = lerp(this.legL.knee.rotation.x, 0.08, k);
      this.legR.knee.rotation.x = lerp(this.legR.knee.rotation.x, 0.08, k);
      this.armL.shoulder.rotation.x = lerp(this.armL.shoulder.rotation.x, -0.45, k);
      this.armR.shoulder.rotation.x = lerp(this.armR.shoulder.rotation.x, -0.35 + Math.sin(time * 2.2) * 0.06, k);
      this.armR.elbow.rotation.x = lerp(this.armR.elbow.rotation.x, -0.5, k);
      this.root.position.y = Math.sin(time * 7.5) * 0.012;
      this.torso.rotation.z = lerp(this.torso.rotation.z, 0, k);
    } else if (mode === 'float') {
      const sway = Math.sin(time * 1.9);
      this.legL.hip.rotation.x = lerp(this.legL.hip.rotation.x, sway * 0.14, k);
      this.legR.hip.rotation.x = lerp(this.legR.hip.rotation.x, -sway * 0.14, k);
      this.legL.knee.rotation.x = lerp(this.legL.knee.rotation.x, 0.22, k);
      this.legR.knee.rotation.x = lerp(this.legR.knee.rotation.x, 0.18, k);
      this.armR.shoulder.rotation.x = lerp(this.armR.shoulder.rotation.x, -2.5, k);
      this.armR.elbow.rotation.x = lerp(this.armR.elbow.rotation.x, -0.2, k);
      this.armL.shoulder.rotation.x = lerp(this.armL.shoulder.rotation.x, -0.25 + sway * 0.12, k);
      this.umbrella.rotation.z = sway * 0.06;
      this.halo.material.opacity = 0.16 + Math.sin(time * 3.1) * 0.05;
      this.root.position.y = 0;
    } else {
      const breath = Math.sin(time * 2.1) * 0.015;
      this.legL.hip.rotation.x = lerp(this.legL.hip.rotation.x, 0, k);
      this.legR.hip.rotation.x = lerp(this.legR.hip.rotation.x, 0, k);
      this.legL.knee.rotation.x = lerp(this.legL.knee.rotation.x, 0, k);
      this.legR.knee.rotation.x = lerp(this.legR.knee.rotation.x, 0, k);
      this.armL.shoulder.rotation.x = lerp(this.armL.shoulder.rotation.x, breath, k);
      this.armR.shoulder.rotation.x = lerp(this.armR.shoulder.rotation.x, showTicket ? -0.78 + Math.sin(time * 3.2) * 0.08 : -breath, k);
      this.armR.elbow.rotation.x = lerp(this.armR.elbow.rotation.x, showTicket ? -0.6 : -0.1, k);
      this.root.position.y = 0;
      this.torso.rotation.z = lerp(this.torso.rotation.z, 0, k);
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
  }
}
