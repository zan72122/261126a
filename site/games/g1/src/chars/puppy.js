import * as THREE from '../../lib/three.module.js';

/**
 * Realistic-proportioned Swiss Mountain Dog / Puppy (Bernese/Appenzell inspired):
 * Rounded organic skull, tapered muzzle, floppy ears, cream chest blaze,
 * 4 articulated legs, wagging tail, cobalt collar and tiny brass bell.
 */
export class MountainDog {
  constructor(mats, { scale = 1.0, hasBell = true } = {}) {
    this.group = new THREE.Group();
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.walkPhase = 0;
    this.interactables = [];

    const coatDark = new THREE.MeshStandardMaterial({ color: '#3b322c', roughness: 0.84 });
    const coatTan = new THREE.MeshStandardMaterial({ color: '#b47846', roughness: 0.84 });
    const coatCream = new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.88 });
    const noseMat = new THREE.MeshStandardMaterial({ color: '#1d1917', roughness: 0.35 });

    this.bodyRoot = new THREE.Group();
    this.bodyRoot.scale.setScalar(scale);
    this.group.add(this.bodyRoot);

    // Torso (rounded barrel chest & haunches)
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.28, 6, 12), coatDark);
    torso.rotation.x = Math.PI / 2;
    torso.position.set(0, 0.28, 0);
    torso.castShadow = true;
    this.bodyRoot.add(torso);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), coatCream);
    chest.scale.set(0.76, 0.92, 0.95);
    chest.position.set(0, 0.26, 0.16);
    this.bodyRoot.add(chest);

    // Cobalt collar & brass bell
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.022, 8, 14), mats.cobalt);
    collar.rotation.x = Math.PI / 3;
    collar.position.set(0, 0.35, 0.18);
    this.bodyRoot.add(collar);

    if (hasBell) {
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), mats.brass);
      bell.position.set(0, 0.28, 0.26);
      this.bodyRoot.add(bell);
    }

    // Neck & Head with sculpted rounded skull, tapered muzzle & floppy ears
    this.head = new THREE.Group();
    this.head.position.set(0, 0.38, 0.21);
    this.bodyRoot.add(this.head);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), coatDark);
    skull.scale.set(0.92, 0.9, 1.02);
    skull.position.set(0, 0.06, 0.03);
    skull.castShadow = true;
    this.head.add(skull);

    const blaze = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.07, 4, 8), coatCream);
    blaze.position.set(0, 0.07, 0.115);
    blaze.rotation.x = -0.3;
    this.head.add(blaze);

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.056, 0.11, 10), coatTan);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.025, 0.13);
    this.head.add(muzzle);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), noseMat);
    nose.position.set(0, 0.04, 0.188);
    this.head.add(nose);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), noseMat);
      eye.position.set(side * 0.052, 0.085, 0.115);
      this.head.add(eye);

      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.065, 4, 8), coatDark);
      ear.scale.set(0.55, 1.0, 0.95);
      ear.position.set(side * 0.095, 0.025, 0.015);
      ear.rotation.z = side * 0.24;
      this.head.add(ear);
    }

    // 4 Articulated legs with tan/cream paws
    this.legs = [];
    const legPos = [
      [-0.085, 0.22, 0.14],
      [0.085, 0.22, 0.14],
      [-0.085, 0.22, -0.15],
      [0.085, 0.22, -0.15],
    ];
    for (const [lx, ly, lz] of legPos) {
      const hip = new THREE.Group();
      hip.position.set(lx, ly, lz);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.028, 0.18, 8), coatTan);
      upper.position.y = -0.09;
      upper.castShadow = true;
      hip.add(upper);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), coatCream);
      paw.scale.set(0.85, 0.68, 1.2);
      paw.position.set(0, -0.195, 0.015);
      hip.add(paw);
      this.bodyRoot.add(hip);
      this.legs.push(hip);
    }

    // Wagging Tail
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.31, -0.2);
    const tailMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.18, 4, 8), coatDark);
    tailMesh.position.set(0, 0.09, -0.05);
    tailMesh.rotation.x = -0.7;
    this.tail.add(tailMesh);
    this.bodyRoot.add(this.tail);

    torso.userData.interact = 'puppy';
    skull.userData.interact = 'puppy';
    this.interactables.push(torso, skull);
  }

  update(dt, time, { moving = false, excited = false } = {}) {
    const wagFreq = excited ? 14 : 6.5;
    const wagAmp = excited ? 0.55 : 0.28;
    this.tail.rotation.z = Math.sin(time * wagFreq) * wagAmp;

    if (moving) {
      this.walkPhase += dt * 11;
      const s = Math.sin(this.walkPhase) * 0.55;
      this.legs[0].rotation.x = s;
      this.legs[1].rotation.x = -s;
      this.legs[2].rotation.x = -s;
      this.legs[3].rotation.x = s;
      this.bodyRoot.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.035;
      this.head.rotation.x = Math.sin(this.walkPhase * 2) * 0.05;
    } else {
      for (const leg of this.legs) leg.rotation.x *= 0.85;
      this.bodyRoot.position.y = excited ? Math.abs(Math.sin(time * 7)) * 0.06 : 0;
      this.head.rotation.x = Math.sin(time * 2.3) * 0.04 - (excited ? 0.12 : 0);
    }

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
  }
}
