import * as THREE from '../../lib/three.module.js';
import { PALETTE } from '../core/env.js';

// Consistent 1980s Mediterranean girl (~1.42 m tall) with articulated proportions.
// Clean linen blouse back with navy collar (no red numeral-like mark on the back), no crown or princess gown.
export class Girl {
  constructor({ lowQuality = false, textures = null } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'girl';
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.walkPhase = 0;
    this.isWalking = false;
    this.isSeated = false;
    this.isFloating = false;
    this.hasShell = false;

    const castShadow = !lowQuality;

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c7a7, roughness: 0.72 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x4e3528, roughness: 0.78 });
    const blouseMat = new THREE.MeshStandardMaterial({
      color: 0xf4efe4,
      roughness: 0.84,
      map: textures?.sailMap || null,
    });
    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x35536e,
      roughness: 0.82,
      map: textures?.sailMap || null,
    });
    const collarNavyMat = new THREE.MeshStandardMaterial({ color: 0x2a455e, roughness: 0.8 });
    const sandalMat = new THREE.MeshStandardMaterial({ color: 0x7a4e32, roughness: 0.76 });
    const ribbonMat = new THREE.MeshStandardMaterial({ color: PALETTE.citrus, roughness: 0.65 });
    const satchelMat = new THREE.MeshStandardMaterial({
      color: 0xb78b56,
      roughness: 0.84,
      map: textures?.woodMap || null,
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x261a14 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xfffaf0 });
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xe99888 });
    const lipMat = new THREE.MeshBasicMaterial({ color: 0xc96c62 });

    this.bodyRoot = new THREE.Group();
    this.group.add(this.bodyRoot);

    const makeLeg = (sx) => {
      const hip = new THREE.Group();
      hip.position.set(sx, 0.56, 0);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.056, 0.28, 9), skinMat);
      thigh.position.y = -0.14;
      thigh.castShadow = castShadow;
      hip.add(thigh);
      const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.042, 0.24, 9), skinMat);
      calf.position.y = -0.38;
      calf.castShadow = castShadow;
      hip.add(calf);
      const sandal = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.165), sandalMat);
      sandal.position.set(0, -0.52, 0.025);
      hip.add(sandal);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.022, 0.045), sandalMat);
      strap.position.set(0, -0.49, 0.04);
      hip.add(strap);
      return hip;
    };
    this.legL = makeLeg(-0.085);
    this.legR = makeLeg(0.085);
    this.bodyRoot.add(this.legL, this.legR);

    // Flared navy midi skirt + waistband
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.22, 0.39, 14), skirtMat);
    skirt.position.y = 0.68;
    skirt.castShadow = castShadow;
    this.bodyRoot.add(skirt);

    // Tapered torso in cream linen blouse
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.126, 0.106, 0.38, 12), blouseMat);
    torso.position.y = 0.99;
    torso.castShadow = castShadow;
    this.bodyRoot.add(torso);

    // Woven shoulder satchel on left hip (clean back, no back stripe or red mark)
    const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.16, 0.17), satchelMat);
    satchel.position.set(-0.145, 0.80, -0.01);
    satchel.rotation.z = 0.12;
    this.bodyRoot.add(satchel);

    // Clean navy collar around neckline (maintains round-2 removal of any back red mark)
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.024, 8, 16), collarNavyMat);
    collar.rotation.x = Math.PI * 0.5;
    collar.position.y = 1.175;
    this.bodyRoot.add(collar);

    const collarBackFlap = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.018, 0.095), collarNavyMat);
    collarBackFlap.position.set(0, 1.16, -0.095);
    collarBackFlap.rotation.x = 0.24;
    this.bodyRoot.add(collarBackFlap);

    // Small front-only navy collar knot (never visible on the back)
    this.scarfKnot = new THREE.Group();
    this.scarfKnot.position.set(0.0, 1.145, 0.105);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 6), collarNavyMat);
    this.scarfKnot.add(knot);
    this.scarfTipA = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.09, 5), collarNavyMat);
    this.scarfTipA.position.set(0.02, -0.045, 0.012);
    this.scarfTipA.rotation.set(0.18, 0, 0.28);
    this.scarfTipB = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.085, 5), collarNavyMat);
    this.scarfTipB.position.set(-0.02, -0.045, 0.014);
    this.scarfTipB.rotation.set(0.22, 0, -0.25);
    this.scarfKnot.add(this.scarfTipA, this.scarfTipB);
    this.bodyRoot.add(this.scarfKnot);

    // Articulated arms with rounded shoulder caps
    const makeArm = (sx) => {
      const sh = new THREE.Group();
      sh.position.set(sx, 1.13, 0);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 7), blouseMat);
      sh.add(cap);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.044, 0.16, 8), blouseMat);
      sleeve.position.y = -0.08;
      sh.add(sleeve);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.22, 8), skinMat);
      fore.position.y = -0.25;
      fore.castShadow = castShadow;
      sh.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 7), skinMat);
      hand.position.y = -0.37;
      sh.add(hand);
      return sh;
    };
    this.armL = makeArm(-0.155);
    this.armR = makeArm(0.155);
    this.bodyRoot.add(this.armL, this.armR);

    this.heldShell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.052, 0.042, 8),
      new THREE.MeshStandardMaterial({
        color: 0xf7ebd5,
        emissive: 0xe69d38,
        emissiveIntensity: 0.72,
        roughness: 0.35,
      })
    );
    this.heldShell.position.set(0, -0.39, 0.06);
    this.heldShell.rotation.x = 0.4;
    this.heldShell.visible = false;
    this.armR.add(this.heldShell);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.09, 8), skinMat);
    neck.position.y = 1.22;
    this.bodyRoot.add(neck);

    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 1.35;
    this.bodyRoot.add(this.headGroup);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.128, 16, 14), skinMat);
    head.scale.set(0.96, 1.04, 0.98);
    head.castShadow = castShadow;
    this.headGroup.add(head);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.016, 7, 6), skinMat);
    nose.position.set(0, -0.015, 0.128);
    this.headGroup.add(nose);

    for (const sx of [-0.044, 0.044]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 7), eyeMat);
      eye.position.set(sx, 0.01, 0.118);
      this.headGroup.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 6, 5), glintMat);
      glint.position.set(sx + 0.004, 0.016, 0.132);
      this.headGroup.add(glint);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.007, 0.01), hairMat);
      brow.position.set(sx, 0.038, 0.118);
      brow.rotation.z = sx < 0 ? 0.1 : -0.1;
      this.headGroup.add(brow);

      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.022, 7, 6), cheekMat);
      cheek.scale.set(1.2, 0.72, 0.45);
      cheek.position.set(sx * 1.48, -0.025, 0.106);
      this.headGroup.add(cheek);
    }

    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.022, 0.0055, 6, 10, Math.PI * 0.72),
      lipMat
    );
    smile.position.set(0, -0.038, 0.121);
    smile.rotation.z = Math.PI + Math.PI * 0.14;
    this.headGroup.add(smile);

    // Chestnut bob hair + neat citrus hair tie
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.138, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
    hairCap.position.set(0, 0.016, -0.014);
    hairCap.rotation.x = -0.22;
    this.headGroup.add(hairCap);

    const hairBack = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.145, 0.18, 12, 1, false, Math.PI * 0.55, Math.PI * 0.9), hairMat);
    hairBack.position.set(0, -0.045, -0.018);
    this.headGroup.add(hairBack);

    const bangs = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.126, 0.06, 10, 1, false, -0.7, 1.4), hairMat);
    bangs.position.set(0, 0.068, 0.015);
    bangs.rotation.x = 0.2;
    this.headGroup.add(bangs);

    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 6, 10), ribbonMat);
    ribbon.position.set(0, -0.03, -0.135);
    this.headGroup.add(ribbon);

    // Layered sea-breeze veil canopy for slow descent
    this.floatGroup = new THREE.Group();
    this.floatGroup.visible = false;
    this.floatMat = new THREE.MeshBasicMaterial({
      color: 0xffdf9e,
      transparent: true,
      opacity: 0.30,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.86, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.44),
      this.floatMat
    );
    canopy.position.y = 1.58;
    canopy.scale.set(1.12, 0.54, 1.12);
    this.floatGroup.add(canopy);

    const innerRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.84, 0.025, 6, 28).rotateX(Math.PI * 0.5),
      new THREE.MeshBasicMaterial({
        color: 0xffe9b8,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    innerRim.position.y = 1.66;
    this.floatGroup.add(innerRim);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.72, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xffcf7a,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    halo.position.y = 0.75;
    this.floatGroup.add(halo);
    this.group.add(this.floatGroup);
  }

  setShellCarried(v) {
    this.hasShell = v;
    this.heldShell.visible = v;
  }

  update(dt, t) {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;

    this.scarfTipA.rotation.x = 0.18 + Math.sin(t * 3.6) * 0.08;
    this.scarfTipB.rotation.z = -0.25 + Math.cos(t * 3.1) * 0.08;

    if (this.isFloating) {
      this.floatGroup.visible = true;
      this.floatMat.opacity = 0.24 + 0.08 * Math.sin(t * 3.2);
      this.bodyRoot.position.y = Math.sin(t * 2.4) * 0.04;
      this.legL.rotation.x = 0.12 + Math.sin(t * 1.9) * 0.08;
      this.legR.rotation.x = -0.1 - Math.sin(t * 1.9) * 0.08;
      this.armL.rotation.z = 0.65 + Math.sin(t * 2.3) * 0.1;
      this.armR.rotation.z = -0.65 - Math.sin(t * 2.3) * 0.1;
      this.armL.rotation.x = -0.25;
      this.armR.rotation.x = -0.25;
      return;
    }

    this.floatGroup.visible = false;

    if (this.isSeated) {
      this.bodyRoot.position.y = -0.24;
      this.legL.rotation.x = -1.15;
      this.legR.rotation.x = -1.15;
      this.armL.rotation.z = 0.08;
      this.armR.rotation.z = -0.08;
      this.armL.rotation.x = -0.45;
      this.armR.rotation.x = -0.65;
      return;
    }

    this.bodyRoot.position.y = 0;
    if (this.isWalking) {
      this.walkPhase += dt * 7.8;
      const s = Math.sin(this.walkPhase);
      this.legL.rotation.x = s * 0.52;
      this.legR.rotation.x = -s * 0.52;
      this.armL.rotation.x = -s * 0.38;
      this.armR.rotation.x = this.hasShell ? -0.55 : s * 0.38;
      this.armL.rotation.z = 0.08;
      this.armR.rotation.z = -0.08;
      this.bodyRoot.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.035;
    } else {
      const breath = Math.sin(t * 2.0);
      this.legL.rotation.x *= 0.82;
      this.legR.rotation.x *= 0.82;
      this.armL.rotation.x = breath * 0.03;
      this.armR.rotation.x = this.hasShell ? -0.65 : -breath * 0.03;
      this.armL.rotation.z = 0.07;
      this.armR.rotation.z = -0.07;
    }
  }
}
