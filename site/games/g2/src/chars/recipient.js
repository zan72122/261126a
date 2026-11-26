// Welcoming recipient & waving Provençal villagers at Clock Tower Square & meadow
import * as THREE from '../../lib/three.module.js';
import { PALETTE } from '../core/palette.js';
import { mergeColoredParts } from '../core/math.js';
import { makeLinenBumpTexture } from '../core/textures.js';

export class RecipientCharacter {
  constructor(lowQuality = false) {
    this.group = new THREE.Group();
    this.group.name = 'recipient';

    const linenBump = makeLinenBumpTexture(3, 3);
    const skinMat = new THREE.MeshStandardMaterial({ color: PALETTE.skin, roughness: 0.70 });
    const cheekMat = new THREE.MeshStandardMaterial({ color: PALETTE.cheek, roughness: 0.75 });
    const hairMat = new THREE.MeshStandardMaterial({ color: PALETTE.hairSilver, roughness: 0.75 });
    const blouseMat = new THREE.MeshStandardMaterial({
      color: PALETTE.cream,
      bumpMap: linenBump,
      bumpScale: lowQuality ? 0 : 0.008,
      roughness: 0.82,
    });
    const skirtMat = new THREE.MeshStandardMaterial({
      color: PALETTE.turquoise,
      bumpMap: linenBump,
      bumpScale: lowQuality ? 0 : 0.012,
      roughness: 0.82,
    });
    const apronMat = new THREE.MeshStandardMaterial({
      color: PALETTE.creamWarm,
      bumpMap: linenBump,
      bumpScale: lowQuality ? 0 : 0.010,
      roughness: 0.84,
    });
    const kerchiefMat = new THREE.MeshStandardMaterial({ color: PALETTE.apricot, roughness: 0.7 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: PALETTE.eyeDark, roughness: 0.25 });

    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.25, 0.68, 14), skirtMat);
    skirt.position.y = 0.34;
    this.group.add(skirt);

    const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.23, 0.56, 12, 1, false, -0.9, 1.8), apronMat);
    apron.position.set(0, 0.34, 0.02);
    this.group.add(apron);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.145, 0.42, 12), blouseMat);
    torso.position.y = 0.89;
    this.group.add(torso);

    const armLParts = [
      { geo: new THREE.CapsuleGeometry(0.044, 0.30, 4, 8), mat: blouseMat, pos: new THREE.Vector3(0, -0.18, 0) },
      { geo: new THREE.ConeGeometry(0.08, 0.16, 8), mat: apronMat, pos: new THREE.Vector3(0, -0.34, 0.08), rot: new THREE.Euler(Math.PI, 0, 0) },
    ];
    for (const [bx, by, col] of [
      [-0.03, 0.09, PALETTE.lavender],
      [0.03, 0.10, PALETTE.apricotSoft],
      [0, 0.12, PALETTE.lavenderLight],
    ]) {
      armLParts.push({
        geo: new THREE.SphereGeometry(0.042, 7, 6),
        mat: new THREE.MeshStandardMaterial({ color: col, roughness: 0.75 }),
        pos: new THREE.Vector3(bx, -0.34 + by, 0.08),
      });
    }
    this.armL = mergeColoredParts(armLParts);
    this.armL.position.set(-0.17, 1.06, 0);
    this.armL.rotation.x = -0.65;
    this.group.add(this.armL);

    this.armR = mergeColoredParts([
      { geo: new THREE.CapsuleGeometry(0.044, 0.30, 4, 8), mat: blouseMat, pos: new THREE.Vector3(0, -0.18, 0) },
      { geo: new THREE.SphereGeometry(0.04, 7, 6), mat: skinMat, pos: new THREE.Vector3(0, -0.36, 0) },
    ]);
    this.armR.position.set(0.17, 1.06, 0);
    this.group.add(this.armR);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 12), skinMat);
    head.position.y = 1.27;
    this.group.add(head);

    for (const ex of [-0.05, 0.05]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 7, 6), eyeMat);
      eye.position.set(ex, 1.28, 0.132);
      this.group.add(eye);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), cheekMat);
      cheek.scale.set(1.2, 0.7, 0.4);
      cheek.position.set(ex * 1.45, 1.245, 0.122);
      this.group.add(cheek);
    }
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.026, 0.005, 5, 10, Math.PI * 0.75),
      cheekMat
    );
    smile.position.set(0, 1.23, 0.132);
    smile.rotation.z = -Math.PI * 0.875;
    this.group.add(smile);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.153, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.64), hairMat);
    hair.position.set(0, 1.29, -0.01);
    hair.rotation.x = -0.22;
    this.group.add(hair);

    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.075, 9, 8), hairMat);
    bun.position.set(0, 1.31, -0.14);
    this.group.add(bun);

    const kerchief = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.022, 6, 14), kerchiefMat);
    kerchief.rotation.x = Math.PI / 2;
    kerchief.position.y = 1.11;
    this.group.add(kerchief);

    this.receivedLetterSpot = new THREE.Object3D();
    this.receivedLetterSpot.position.set(0, 0.85, 0.25);
    this.group.add(this.receivedLetterSpot);

    if (!lowQuality) {
      this.group.traverse((n) => {
        if (n.isMesh) {
          n.castShadow = true;
          n.receiveShadow = true;
        }
      });
    }
  }

  update(time, waving = true) {
    if (waving) {
      this.armR.rotation.set(-2.3, 0, -0.22 + Math.sin(time * 5.0) * 0.28);
    } else {
      this.armR.rotation.set(-0.55, 0, -0.15);
    }
    this.armL.rotation.x = -0.68 + Math.sin(time * 1.8) * 0.05;
  }
}

export function makeVillager({ coatColor = PALETTE.lavender, hatColor = PALETTE.creamWarm, hairColor = PALETTE.hairBrown, lowQuality = false } = {}) {
  const g = new THREE.Group();
  g.name = 'villager';
  const linenBump = makeLinenBumpTexture(3, 3);
  const skinMat = new THREE.MeshStandardMaterial({ color: PALETTE.skin, roughness: 0.70 });
  const coatMat = new THREE.MeshStandardMaterial({
    color: coatColor,
    bumpMap: linenBump,
    bumpScale: lowQuality ? 0 : 0.01,
    roughness: 0.84,
  });
  const shirtMat = new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.84 });
  const trousersMat = new THREE.MeshStandardMaterial({ color: PALETTE.woodWarm, roughness: 0.86 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.78 });
  const hatMat = new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.82 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: PALETTE.eyeDark, roughness: 0.25 });

  for (const lx of [-0.08, 0.08]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.44, 4, 6), trousersMat);
    leg.position.set(lx, 0.275, 0);
    g.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.48, 10), coatMat);
  torso.position.y = 0.78;
  g.add(torso);

  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.28, 4, 6), shirtMat);
  armL.position.set(-0.19, 0.80, 0);
  armL.rotation.z = 0.14;
  g.add(armL);

  const armRGeo = new THREE.CapsuleGeometry(0.04, 0.28, 4, 6);
  armRGeo.translate(0, -0.16, 0);
  const armR = new THREE.Mesh(armRGeo, shirtMat);
  armR.position.set(0.17, 0.96, 0);
  armR.rotation.set(-2.25, 0, -0.2);
  g.add(armR);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 8), skinMat);
  head.position.y = 1.18;
  g.add(head);

  for (const ex of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 5), eyeMat);
    eye.position.set(ex, 1.19, 0.123);
    g.add(eye);
  }

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
  hair.position.set(0, 1.20, -0.01);
  hair.rotation.x = -0.2;
  g.add(hair);

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.025, 12), hatMat);
  brim.position.y = 1.28;
  g.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.09, 12), hatMat);
  crown.position.y = 1.33;
  g.add(crown);

  if (!lowQuality) {
    g.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });
  }
  return { group: g, armR };
}
