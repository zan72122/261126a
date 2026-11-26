// Detailed Provençal Montgolfier Hot Air Balloon
// Woven wicker basket (map + bumpMap), wood uprights/shelf, brass burner, 16 rigging ropes,
// 16-gore paneled linen-textured envelope with vertical load-tape ribs and crown cap.
import * as THREE from '../../lib/three.module.js';
import { PALETTE } from '../core/palette.js';
import {
  makeWickerTextures,
  makeWoodTextures,
  makeLinenBumpTexture,
  makeBalloonEnvelopeTexture,
  makeSoftDotTexture,
} from '../core/textures.js';
import { makeFlowerLetter } from './girl.js';

function envelopeProfileRadius(t) {
  if (t <= 0.001) return 0.88;
  if (t >= 0.999) return 0.22;
  const theta = Math.pow(t, 0.78) * Math.PI * 0.96;
  const bulb = Math.sin(theta) * (1.0 + 0.14 * Math.sin(t * Math.PI));
  const throatFlare = t < 0.26 ? 0.88 * Math.pow(1 - t / 0.26, 1.5) : 0;
  return Math.max(0.22 * (1 - Math.max(0, t - 0.95) * 12), bulb * 2.32 + throatFlare * 0.65);
}

export class HotAirBalloon {
  constructor(lowQuality = false) {
    this.group = new THREE.Group();
    this.group.name = 'balloon';
    this.totalHeight = 7.7;
    this.basketRadius = 0.76;

    const wickerTex = makeWickerTextures();
    const woodTex = makeWoodTextures();
    const linenBump = makeLinenBumpTexture(16, 10);

    const matWicker = new THREE.MeshStandardMaterial({
      color: 0xe2c296,
      map: wickerTex.map,
      bumpMap: wickerTex.bumpMap,
      bumpScale: lowQuality ? 0 : 0.04,
      roughness: 0.85,
      metalness: 0.0,
    });
    const matCaneTrim = new THREE.MeshStandardMaterial({ color: 0xb08450, roughness: 0.82 });
    const matLeather = new THREE.MeshStandardMaterial({
      color: PALETTE.shoeTan,
      bumpMap: linenBump,
      bumpScale: lowQuality ? 0 : 0.012,
      roughness: 0.66,
    });
    const matWood = new THREE.MeshStandardMaterial({
      color: PALETTE.woodWarm,
      map: woodTex.map,
      bumpMap: woodTex.bumpMap,
      bumpScale: lowQuality ? 0 : 0.024,
      roughness: 0.80,
    });
    const matBrass = new THREE.MeshStandardMaterial({ color: PALETTE.bronze, roughness: 0.32, metalness: 0.76 });
    const matSteel = new THREE.MeshStandardMaterial({ color: 0x626a70, roughness: 0.42, metalness: 0.72 });
    const matRope = new THREE.MeshStandardMaterial({ color: PALETTE.creamDeep, roughness: 0.88 });

    // 1. Woven Wicker Basket (base y=0 .. padded rim y=1.08)
    this.basketGroup = new THREE.Group();

    const basketShell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 0.82, 0.96, 12, 1, false),
      matWicker
    );
    basketShell.rotation.y = Math.PI / 12;
    basketShell.scale.set(1.04, 1, 0.96);
    basketShell.position.y = 0.50;
    this.basketGroup.add(basketShell);

    const innerHollow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.80, 0.72, 0.88, 12),
      new THREE.MeshStandardMaterial({ color: 0x5d452e, roughness: 0.94 })
    );
    innerHollow.rotation.y = Math.PI / 12;
    innerHollow.position.y = 0.56;
    this.basketGroup.add(innerHollow);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.76, 0.74, 0.08, 12),
      matWood
    );
    floor.position.y = 0.16;
    this.basketGroup.add(floor);

    for (const [ry, rad] of [[0.14, 0.83], [0.54, 0.88], [0.92, 0.93]]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.036, 6, 18), matCaneTrim);
      rib.rotation.x = Math.PI / 2;
      rib.scale.set(1.04, 0.96, 1);
      rib.position.y = ry;
      this.basketGroup.add(rib);
    }

    const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.085, 8, 18), matLeather);
    rimTorus.rotation.x = Math.PI / 2;
    rimTorus.scale.set(1.04, 0.96, 1);
    rimTorus.position.y = 1.03;
    this.basketGroup.add(rimTorus);

    const bagMat = new THREE.MeshStandardMaterial({
      color: PALETTE.creamWarm,
      bumpMap: linenBump,
      bumpScale: lowQuality ? 0 : 0.015,
      roughness: 0.9,
    });
    const sandbagAngles = [0.42, Math.PI - 0.42, Math.PI + 0.42, -0.42];
    for (const ang of sandbagAngles) {
      const bagGroup = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6), bagMat);
      body.scale.set(0.85, 1.32, 0.78);
      bagGroup.add(body);
      const neck = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 5, 10), matRope);
      neck.rotation.x = Math.PI / 2;
      neck.position.y = 0.13;
      bagGroup.add(neck);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 5), matRope);
      cord.position.y = 0.25;
      bagGroup.add(cord);

      bagGroup.position.set(Math.cos(ang) * 0.94, 0.64, Math.sin(ang) * 0.88);
      bagGroup.rotation.y = -ang;
      this.basketGroup.add(bagGroup);
    }

    const dialCase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12), matBrass);
    dialCase.rotation.x = Math.PI / 2.6;
    dialCase.position.set(-0.34, 1.09, 0.78);
    this.basketGroup.add(dialCase);
    const dialFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.072, 12),
      new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.5 })
    );
    dialFace.rotation.x = -Math.PI / 2 + Math.PI / 2.6;
    dialFace.position.set(-0.34, 1.11, 0.80);
    this.basketGroup.add(dialFace);

    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.28), matWood);
    shelf.position.set(0.32, 1.07, 0.76);
    shelf.rotation.y = -0.3;
    this.basketGroup.add(shelf);

    this.basketLetter = makeFlowerLetter();
    this.basketLetter.position.set(0.32, 1.11, 0.76);
    this.basketLetter.rotation.set(0.12, -0.32, 0);
    this.basketLetter.visible = false;
    this.basketGroup.add(this.basketLetter);

    this.group.add(this.basketGroup);

    // 2. Leather-Wrapped Upright Poles, Brass Burner Frame & 16 Rigging Ropes
    const poleCoords = [[-0.58, -0.54], [0.58, -0.54], [-0.58, 0.54], [0.58, 0.54]];
    const burnerY = 2.18;
    const throatY = 2.65;
    const throatR = 0.88;

    for (const [cx, cz] of poleCoords) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 1.24, 7), matLeather);
      pole.position.set(cx, 1.62, cz);
      this.group.add(pole);

      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.82, 6), matSteel);
      strut.position.set(cx * 0.55, burnerY - 0.02, cz * 0.55);
      strut.lookAt(0, burnerY, 0);
      strut.rotateX(Math.PI / 2);
      this.group.add(strut);
    }

    const ropeCount = 16;
    const ropeUp = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < ropeCount; i++) {
      const ang = (i / ropeCount) * Math.PI * 2;
      const topPt = new THREE.Vector3(Math.cos(ang) * throatR, throatY + 0.06, Math.sin(ang) * throatR);
      const sx = Math.cos(ang) >= 0 ? 0.58 : -0.58;
      const sz = Math.sin(ang) >= 0 ? 0.54 : -0.54;
      const botPt = new THREE.Vector3(sx, 2.18, sz);

      const dir = topPt.clone().sub(botPt);
      const len = dir.length();
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, len, 4), matRope);
      rope.position.copy(botPt).addScaledVector(dir, 0.5);
      rope.quaternion.setFromUnitVectors(ropeUp, dir.normalize());
      this.group.add(rope);

      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.03), matLeather);
      tab.position.copy(topPt);
      tab.rotation.y = -ang;
      this.group.add(tab);
    }

    const burnerFrame = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.028, 6, 16), matSteel);
    burnerFrame.rotation.x = Math.PI / 2;
    burnerFrame.position.y = burnerY;
    this.group.add(burnerFrame);

    for (const bx of [-0.11, 0.11]) {
      const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.16, 10, 1, true), matBrass);
      coil.position.set(bx, burnerY + 0.04, 0);
      this.group.add(coil);
    }

    this.flameOuterMat = new THREE.MeshBasicMaterial({
      color: 0xffb85c,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.78, 10), this.flameOuterMat);
    this.flameOuter.position.y = burnerY + 0.44;
    this.group.add(this.flameOuter);

    this.flameInnerMat = new THREE.MeshBasicMaterial({
      color: 0xfff6d6,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.48, 8), this.flameInnerMat);
    this.flameInner.position.y = burnerY + 0.34;
    this.group.add(this.flameInner);

    this.flameHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeSoftDotTexture(),
        color: 0xffcf7a,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      })
    );
    this.flameHalo.position.y = burnerY + 0.45;
    this.flameHalo.scale.set(1.6, 1.6, 1);
    this.group.add(this.flameHalo);

    // 3. Sculpted 16-Gore Paneled Montgolfier Envelope (with woven linen bumpMap)
    const radialSegs = lowQuality ? 32 : 48;
    const heightSegs = lowQuality ? 18 : 26;
    const envelopeGeo = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];
    const indices = [];

    const yMin = throatY;
    const yMax = 7.65;
    const goreCount = 16;

    for (let iy = 0; iy <= heightSegs; iy++) {
      const v = iy / heightSegs;
      const y = yMin + v * (yMax - yMin);
      const baseR = envelopeProfileRadius(v);

      for (let ix = 0; ix <= radialSegs; ix++) {
        const u = ix / radialSegs;
        const theta = u * Math.PI * 2;
        const goreWave = Math.abs(Math.sin(u * goreCount * Math.PI));
        const r = baseR * (1.0 + 0.042 * goreWave * Math.sin(v * Math.PI));
        positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
        uvs.push(u, v);
      }
    }

    for (let iy = 0; iy < heightSegs; iy++) {
      for (let ix = 0; ix < radialSegs; ix++) {
        const a = iy * (radialSegs + 1) + ix;
        const b = a + radialSegs + 1;
        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }

    envelopeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    envelopeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    envelopeGeo.setIndex(indices);
    envelopeGeo.computeVertexNormals();

    const envTex = makeBalloonEnvelopeTexture();
    this.envelopeMat = new THREE.MeshStandardMaterial({
      map: envTex,
      bumpMap: linenBump,
      bumpScale: lowQuality ? 0 : 0.015,
      roughness: 0.72,
      metalness: 0.0,
      emissive: 0xf4b668,
      emissiveIntensity: 0.04,
      side: THREE.DoubleSide,
    });
    this.envelopeMesh = new THREE.Mesh(envelopeGeo, this.envelopeMat);
    this.group.add(this.envelopeMesh);

    const ribStep = lowQuality ? 2 : 1;
    const ribMat = new THREE.MeshStandardMaterial({ color: PALETTE.creamDeep, roughness: 0.85 });
    for (let g = 0; g < goreCount; g += ribStep) {
      const theta = (g / goreCount) * Math.PI * 2;
      const pts = [];
      for (let s = 0; s <= 12; s++) {
        const v = s / 12;
        const y = yMin + v * (yMax - yMin);
        const r = envelopeProfileRadius(v) + 0.015;
        pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const ribGeo = new THREE.TubeGeometry(curve, 14, 0.022, 4, false);
      this.group.add(new THREE.Mesh(ribGeo, ribMat));
    }

    const crownCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
      new THREE.MeshStandardMaterial({
        color: PALETTE.apricot,
        bumpMap: linenBump,
        bumpScale: lowQuality ? 0 : 0.012,
        roughness: 0.75,
      })
    );
    crownCap.scale.set(1.0, 0.55, 1.0);
    crownCap.position.y = yMax - 0.28;
    this.group.add(crownCap);

    const crownLoop = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 12), matRope);
    crownLoop.rotation.x = Math.PI / 2;
    crownLoop.position.y = yMax + 0.11;
    this.group.add(crownLoop);

    // 4. Cord-hung Pennant Flags around the lower equator (NO text!)
    const penMatA = new THREE.MeshStandardMaterial({ color: PALETTE.apricot, roughness: 0.75 });
    const penMatT = new THREE.MeshStandardMaterial({ color: PALETTE.turquoise, roughness: 0.75 });
    const penGeo = new THREE.ConeGeometry(0.13, 0.36, 3);
    this.pennants = [];
    for (let i = 0; i < 8; i++) {
      const ang = ((i + 0.5) / 8) * Math.PI * 2;
      const eqR = envelopeProfileRadius(0.46) * 1.045;
      const pen = new THREE.Mesh(penGeo, i % 2 === 0 ? penMatA : penMatT);
      pen.position.set(Math.cos(ang) * eqR, yMin + 0.46 * (yMax - yMin), Math.sin(ang) * eqR);
      pen.rotation.x = Math.PI;
      pen.rotation.y = ang;
      this.group.add(pen);
      this.pennants.push({ mesh: pen, baseAng: ang });
    }

    // 5. Soft Ground Invitation Ring
    this.beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(1.25, 1.54, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: PALETTE.apricotSoft,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      })
    );
    this.beaconRing.position.y = 0.05;
    this.group.add(this.beaconRing);

    if (!lowQuality) {
      this.group.traverse((n) => {
        if (
          n.isMesh &&
          n !== this.flameOuter &&
          n !== this.flameInner &&
          n !== this.beaconRing
        ) {
          n.castShadow = true;
          n.receiveShadow = true;
        }
      });
    }
  }

  update(time, { burnerLevel = 0, showBeacon = false, tiltX = 0, tiltZ = 0 } = {}) {
    const flicker = 0.76 + 0.24 * Math.sin(time * 26);
    this.flameOuterMat.opacity = burnerLevel * flicker * 0.92;
    this.flameInnerMat.opacity = burnerLevel * (0.82 + 0.18 * Math.cos(time * 31));
    this.flameHalo.material.opacity = burnerLevel * 0.58 * flicker;

    const sy = 0.45 + burnerLevel * (0.95 + 0.25 * Math.sin(time * 21));
    const sxz = 0.8 + burnerLevel * 0.48;
    this.flameOuter.scale.set(sxz, sy, sxz);
    this.flameInner.scale.set(sxz * 0.9, sy * 0.92, sxz * 0.9);
    this.flameHalo.scale.setScalar(1.3 + burnerLevel * 1.1);

    this.envelopeMat.emissiveIntensity = 0.04 + burnerLevel * 0.22;

    for (let i = 0; i < this.pennants.length; i++) {
      this.pennants[i].mesh.rotation.z = Math.sin(time * 3.4 + i) * 0.09;
    }

    this.beaconRing.visible = showBeacon;
    if (showBeacon) {
      const s = 1.0 + Math.sin(time * 3.0) * 0.08;
      this.beaconRing.scale.set(s, s, 1);
    }

    this.group.rotation.x = tiltX;
    this.group.rotation.z = tiltZ;
  }
}
