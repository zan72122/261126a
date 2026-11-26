// Articulated 1970s Provençal village girl (realistic proportions, linen cloth bumpMap,
// warm readable face, modest pinafore skirt — zero princess dress or crown).
// Also exports makeFlowerLetter() (wordless flower-wrapped envelope with apricot wax seal).
import * as THREE from '../../lib/three.module.js';
import { PALETTE } from '../core/palette.js';
import { makeLinenBumpTexture } from '../core/textures.js';

export function makeFlowerLetter() {
  const g = new THREE.Group();
  g.name = 'flowerLetter';

  const env = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.04, 0.21),
    new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.78 })
  );
  g.add(env);

  const flap = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.12, 3),
    new THREE.MeshStandardMaterial({ color: PALETTE.creamWarm, roughness: 0.8 })
  );
  flap.rotation.x = Math.PI / 2;
  flap.scale.set(1.2, 0.2, 0.95);
  flap.position.set(0, 0.022, -0.02);
  g.add(flap);

  const seal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.04, 0.016, 12),
    new THREE.MeshStandardMaterial({ color: PALETTE.apricot, roughness: 0.45 })
  );
  seal.position.set(0, 0.026, 0.02);
  g.add(seal);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.011, 0.22, 5),
    new THREE.MeshStandardMaterial({ color: PALETTE.oliveLeaf, roughness: 0.85 })
  );
  stem.rotation.z = 1.18;
  stem.position.set(0.04, 0.032, -0.02);
  g.add(stem);

  const lavMat = new THREE.MeshStandardMaterial({ color: PALETTE.lavender, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const bud = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 5), lavMat);
    bud.position.set(-0.04 - i * 0.022, 0.04, -0.04 + i * 0.008);
    g.add(bud);
  }
  const rose = new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 7, 6),
    new THREE.MeshStandardMaterial({ color: PALETTE.apricotSoft, roughness: 0.7 })
  );
  rose.position.set(0.07, 0.042, 0.01);
  g.add(rose);

  return g;
}

export class GirlCharacter {
  constructor(lowQuality = false) {
    this.group = new THREE.Group();
    this.group.name = 'girl';
    this.totalHeight = 1.32;

    const linenBump = makeLinenBumpTexture(3, 3);
    const skinMat = new THREE.MeshStandardMaterial({ color: PALETTE.skin, roughness: 0.70 });
    const cheekMat = new THREE.MeshStandardMaterial({ color: PALETTE.cheek, roughness: 0.75 });
    const hairMat = new THREE.MeshStandardMaterial({ color: PALETTE.hairBrown, roughness: 0.76 });
    const blouseMat = new THREE.MeshStandardMaterial({
      color: PALETTE.cream,
      bumpMap: linenBump,
      bumpScale: lowQuality ? 0 : 0.008,
      roughness: 0.82,
    });
    const skirtMat = new THREE.MeshStandardMaterial({
      color: PALETTE.lavender,
      bumpMap: linenBump,
      bumpScale: lowQuality ? 0 : 0.012,
      roughness: 0.84,
    });
    const ribbonMat = new THREE.MeshStandardMaterial({ color: PALETTE.apricot, roughness: 0.65 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: PALETTE.shoeTan, roughness: 0.70 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: PALETTE.eyeDark, roughness: 0.25 });

    this.bodyRoot = new THREE.Group();
    this.group.add(this.bodyRoot);

    const makeLeg = (sx) => {
      const hip = new THREE.Group();
      hip.position.set(sx, 0.54, 0);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.18, 4, 8), skinMat);
      thigh.position.y = -0.14;
      hip.add(thigh);
      const sock = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.17, 4, 8), blouseMat);
      sock.position.y = -0.36;
      hip.add(sock);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.068, 0.165), shoeMat);
      shoe.position.set(0, -0.505, 0.032);
      hip.add(shoe);
      return hip;
    };
    this.legL = makeLeg(-0.085);
    this.legR = makeLeg(0.085);
    this.bodyRoot.add(this.legL, this.legR);

    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.21, 0.34, 14), skirtMat);
    skirt.position.y = 0.58;
    this.bodyRoot.add(skirt);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.32, 12), blouseMat);
    torso.position.y = 0.86;
    this.bodyRoot.add(torso);

    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.21, 0.16), skirtMat);
    bib.position.set(0, 0.83, 0.01);
    this.bodyRoot.add(bib);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.092, 0.022, 6, 12),
      new THREE.MeshStandardMaterial({ color: PALETTE.turquoise, roughness: 0.72 })
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.01;
    this.bodyRoot.add(collar);

    const makeArm = (sx) => {
      const sh = new THREE.Group();
      sh.position.set(sx, 0.97, 0);
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.09, 4, 8), blouseMat);
      sleeve.position.y = -0.07;
      sh.add(sleeve);
      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.19, 4, 8), skinMat);
      forearm.position.y = -0.23;
      sh.add(forearm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 7, 6), skinMat);
      hand.position.y = -0.36;
      sh.add(hand);
      return sh;
    };
    this.armL = makeArm(-0.145);
    this.armR = makeArm(0.145);
    this.bodyRoot.add(this.armL, this.armR);

    this.heldLetter = makeFlowerLetter();
    this.heldLetter.position.set(0.04, 0.72, 0.23);
    this.heldLetter.rotation.set(0.35, 0.15, -0.08);
    this.heldLetter.visible = false;
    this.bodyRoot.add(this.heldLetter);

    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.04, 0);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.09, 8), skinMat);
    neck.position.y = 0.03;
    this.headGroup.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 12), skinMat);
    head.scale.set(0.95, 1.04, 0.98);
    head.position.y = 0.175;
    this.headGroup.add(head);

    // Eyes, rosy cheeks & subtle happy smile (facing +Z locally)
    for (const ex of [-0.048, 0.048]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 7, 6), eyeMat);
      eye.position.set(ex, 0.18, 0.123);
      this.headGroup.add(eye);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.023, 6, 5), cheekMat);
      cheek.scale.set(1.2, 0.7, 0.4);
      cheek.position.set(ex * 1.45, 0.145, 0.114);
      this.headGroup.add(cheek);
    }
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.024, 0.005, 5, 10, Math.PI * 0.75),
      cheekMat
    );
    smile.position.set(0, 0.135, 0.122);
    smile.rotation.z = -Math.PI * 0.875;
    this.headGroup.add(smile);

    // Chestnut bob hair + simple apricot ribbon band (no tiara/crown)
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.146, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.68), hairMat);
    hairCap.position.set(0, 0.19, -0.01);
    hairCap.rotation.x = -0.18;
    this.headGroup.add(hairCap);

    const hairBack = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.155, 0.18, 12, 1, false, Math.PI * 0.62, Math.PI * 0.76), hairMat);
    hairBack.position.set(0, 0.13, -0.015);
    this.headGroup.add(hairBack);

    const ribbonBand = new THREE.Mesh(new THREE.TorusGeometry(0.136, 0.014, 6, 16, Math.PI * 1.15), ribbonMat);
    ribbonBand.position.set(0, 0.215, 0.01);
    ribbonBand.rotation.set(-0.35, 0, -Math.PI * 0.075);
    this.headGroup.add(ribbonBand);

    this.bodyRoot.add(this.headGroup);

    if (!lowQuality) {
      this.group.traverse((n) => {
        if (n.isMesh) {
          n.castShadow = true;
          n.receiveShadow = true;
        }
      });
    }
  }

  setPose({ mode = 'idle', time = 0, walkSpeed = 0, holdingLetter = false }) {
    this.heldLetter.visible = holdingLetter;
    const stride = walkSpeed > 0.15 ? Math.sin(time * 9.0) * Math.min(1, walkSpeed / 3.0) * 0.55 : 0;

    if (mode === 'walk') {
      this.legL.rotation.x = stride;
      this.legR.rotation.x = -stride;
      this.bodyRoot.position.y = Math.abs(stride) * 0.035;
      if (holdingLetter) {
        this.armL.rotation.set(-0.58, 0, 0.14);
        this.armR.rotation.set(-0.58, 0, -0.14);
      } else {
        this.armL.rotation.set(-stride * 0.75, 0, 0.08);
        this.armR.rotation.set(stride * 0.75, 0, -0.08);
      }
      this.headGroup.rotation.set(0.03, Math.sin(time * 1.5) * 0.05, 0);
    } else if (mode === 'float') {
      this.legL.rotation.set(0.12 + Math.sin(time * 2.1) * 0.07, 0, 0);
      this.legR.rotation.set(-0.08 - Math.sin(time * 2.1) * 0.07, 0, 0);
      this.bodyRoot.position.y = 0;
      this.armR.rotation.set(-2.55, 0, -0.18);
      this.armL.rotation.set(-0.25, 0, 0.35 + Math.sin(time * 2.3) * 0.08);
      this.headGroup.rotation.set(-0.08, Math.sin(time * 1.2) * 0.08, 0);
    } else if (mode === 'aboard') {
      this.legL.rotation.set(0, 0, 0);
      this.legR.rotation.set(0, 0, 0);
      this.bodyRoot.position.y = 0;
      this.armL.rotation.set(-0.48, 0, 0.15);
      this.armR.rotation.set(-0.48, 0, -0.15);
      this.headGroup.rotation.set(-0.06 + Math.sin(time * 1.4) * 0.04, Math.sin(time * 0.9) * 0.15, 0);
    } else if (mode === 'wave') {
      this.legL.rotation.set(0, 0, 0);
      this.legR.rotation.set(0, 0, 0);
      this.bodyRoot.position.y = Math.sin(time * 3.0) * 0.015;
      this.armL.rotation.set(holdingLetter ? -0.55 : -0.1, 0, 0.14);
      this.armR.rotation.set(-2.35, 0, -0.25 + Math.sin(time * 6.0) * 0.25);
      this.headGroup.rotation.set(-0.04, Math.sin(time * 1.6) * 0.08, 0);
    } else {
      this.legL.rotation.set(0, 0, 0);
      this.legR.rotation.set(0, 0, 0);
      this.bodyRoot.position.y = Math.sin(time * 2.0) * 0.008;
      if (holdingLetter) {
        this.armL.rotation.set(-0.58, 0, 0.14);
        this.armR.rotation.set(-0.58, 0, -0.14);
      } else {
        this.armL.rotation.set(0, 0, 0.08 + Math.sin(time * 1.7) * 0.02);
        this.armR.rotation.set(0, 0, -0.08 - Math.sin(time * 1.7) * 0.02);
      }
      this.headGroup.rotation.set(0, Math.sin(time * 0.9) * 0.1, 0);
    }
  }
}
