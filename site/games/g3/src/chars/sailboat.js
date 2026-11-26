import * as THREE from '../../lib/three.module.js';
import { PALETTE } from '../core/env.js';
import { makeBoatHullShape } from '../world/props.js';

// Handcrafted Mediterranean wooden lateen sailboat (~5.6m long, ~4.6m tall mast) with stitched canvas sail, rigging & brass bow lantern.
export class Sailboat {
  constructor({ lowQuality = false, textures = null } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'sailboat';
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.heel = 0;
    this.pitch = 0;
    this.sailAngle = 0.12;
    this.billow = 0.18;

    const castShadow = !lowQuality;
    const nm = (t, sx = 0.55, sy = 0.55) =>
      t && !lowQuality ? { normalMap: t, normalScale: new THREE.Vector2(sx, sy) } : {};

    const hullMat = new THREE.MeshStandardMaterial({
      color: PALETTE.plaster,
      roughness: 0.64,
      metalness: 0.04,
      map: textures?.hullMap || null,
      ...nm(textures?.hullNorm, 0.7, 0.7),
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: PALETTE.terracotta,
      roughness: 0.7,
      ...nm(textures?.hullNorm, 0.4, 0.4),
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0xa67c5a,
      roughness: 0.76,
      metalness: 0.04,
      map: textures?.woodMap || null,
      ...nm(textures?.woodNorm, 0.75, 0.75),
    });
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0xc89f78,
      roughness: 0.78,
      metalness: 0.04,
      map: textures?.woodMap || null,
      ...nm(textures?.woodNorm, 0.65, 0.65),
    });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xbda47d, roughness: 0.9 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0x94703e, roughness: 0.38, metalness: 0.7 });
    const sailMat = new THREE.MeshStandardMaterial({
      color: 0xf8f2e6,
      roughness: 0.84,
      metalness: 0.01,
      emissive: 0x3b2a16,
      emissiveIntensity: 0.08,
      side: THREE.DoubleSide,
      map: textures?.sailMap || null,
      ...nm(textures?.sailNorm, 0.45, 0.45),
    });
    const pennantMat = new THREE.MeshStandardMaterial({ color: PALETTE.coral, roughness: 0.72, side: THREE.DoubleSide });
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xfff0c8,
      emissive: 0xffc060,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });

    this.hullRoot = new THREE.Group();
    this.group.add(this.hullRoot);

    // Sculpted double-ended Mediterranean wooden hull (built along +Z forward)
    const hullGeo = new THREE.ExtrudeGeometry(makeBoatHullShape(0.92, 2.75), {
      depth: 0.66,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    hullGeo.rotateX(-Math.PI * 0.5);
    hullGeo.rotateY(Math.PI);
    const hullMain = new THREE.Mesh(hullGeo, hullMat);
    hullMain.position.y = -0.1;
    hullMain.castShadow = castShadow;
    hullMain.receiveShadow = castShadow;
    this.hullRoot.add(hullMain);

    // Terracotta waterline trim + dark timber rub-rail
    const trimGeo = new THREE.ExtrudeGeometry(makeBoatHullShape(0.95, 2.78), { depth: 0.14, bevelEnabled: false });
    trimGeo.rotateX(-Math.PI * 0.5);
    trimGeo.rotateY(Math.PI);
    const trim = new THREE.Mesh(trimGeo, stripeMat);
    trim.position.y = 0.34;
    this.hullRoot.add(trim);

    // Wooden slatted deck & interior cockpit framing
    const deckGeo = new THREE.ExtrudeGeometry(makeBoatHullShape(0.84, 2.55), { depth: 0.08, bevelEnabled: false });
    deckGeo.rotateX(-Math.PI * 0.5);
    deckGeo.rotateY(Math.PI);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = 0.56;
    deck.receiveShadow = castShadow;
    this.hullRoot.add(deck);

    // Raised longitudinal plank seams + bow stempost
    for (const px of [-0.42, -0.21, 0, 0.21, 0.42]) {
      const len = px === 0 ? 4.4 : Math.abs(px) < 0.3 ? 3.8 : 2.9;
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, len), woodMat);
      seam.position.set(px, 0.60, -0.05);
      this.hullRoot.add(seam);
    }

    const stemPost = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.85, 0.16), woodMat);
    stemPost.position.set(0, 0.42, 2.72);
    stemPost.rotation.x = 0.28;
    this.hullRoot.add(stemPost);

    // Cockpit thwarts (thicker timber benches + subtle side knees)
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.12, 0.62), woodMat);
    bench.position.set(0, 0.68, -0.78);
    this.hullRoot.add(bench);

    const foreBench = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.1, 0.44), woodMat);
    foreBench.position.set(0, 0.67, 0.92);
    this.hullRoot.add(foreBench);

    // Wooden gunwales & brass cleats
    for (const sx of [-0.78, 0.78]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 2.6), woodMat);
      rail.position.set(sx, 0.67, -0.1);
      this.hullRoot.add(rail);
      const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.22), brassMat);
      cleat.position.set(sx, 0.76, -1.0);
      this.hullRoot.add(cleat);
    }

    // Coiled hemp rope on foredeck
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 7, 16), ropeMat);
    coil.rotation.x = Math.PI * 0.5;
    coil.position.set(-0.36, 0.64, 1.55);
    this.hullRoot.add(coil);

    // Stern rudder with brass pintles & curved tiller
    const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.46), woodMat);
    rudder.position.set(0, 0.08, -2.95);
    this.hullRoot.add(rudder);
    this.tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 0.98, 7), woodMat);
    this.tiller.rotation.x = Math.PI * 0.48;
    this.tiller.position.set(0, 0.79, -2.25);
    this.hullRoot.add(this.tiller);

    // Tapered wooden mast with mast-collar & brass truck
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.098, 4.2, 10), woodMat);
    mast.position.set(0, 2.58, 0.35);
    mast.castShadow = castShadow;
    this.hullRoot.add(mast);

    const mastStep = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.22, 10), woodMat);
    mastStep.position.set(0, 0.68, 0.35);
    this.hullRoot.add(mastStep);

    // Standing rigging: shrouds, forestay & backstay
    for (const sx of [-0.75, 0.75]) {
      const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 3.92, 5), ropeMat);
      shroud.position.set(sx * 0.5, 2.52, 0.25);
      shroud.rotation.z = sx > 0 ? 0.19 : -0.19;
      this.hullRoot.add(shroud);
    }
    const forestay = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 4.35, 5), ropeMat);
    forestay.position.set(0, 2.55, 1.48);
    forestay.rotation.x = 0.54;
    this.hullRoot.add(forestay);

    // Lateen sail assembly pivoted at the mast
    this.sailPivot = new THREE.Group();
    this.sailPivot.position.set(0, 1.35, 0.35);
    this.hullRoot.add(this.sailPivot);

    // Angled lateen yard spar with rope lashings attached directly in yard local space
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.052, 4.4, 8), woodMat);
    yard.rotation.x = -0.92;
    yard.position.set(0, 1.65, -0.1);
    for (const tPos of [-1.05, 0.0, 1.05]) {
      const lashing = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.015, 5, 10), ropeMat);
      lashing.rotation.x = Math.PI * 0.5;
      lashing.position.set(0, tPos, 0);
      yard.add(lashing);
    }
    this.sailPivot.add(yard);

    // Subdivided triangular lateen sail mesh that dynamically billows in tailwinds
    this.sailGeo = this._createBillowSailGeometry();
    this.sailMesh = new THREE.Mesh(this.sailGeo, sailMat);
    this.sailMesh.castShadow = castShadow;
    this.sailPivot.add(this.sailMesh);

    // Coral masthead pennant (no text)
    this.pennant = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.65, 4), pennantMat);
    this.pennant.rotation.x = -Math.PI * 0.5;
    this.pennant.position.set(0, 4.62, 0.02);
    this.hullRoot.add(this.pennant);

    // Caged brass bow lantern
    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(0, 0.84, 2.38);
    const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.06, 8), brassMat);
    lBase.position.y = -0.14;
    lanternGroup.add(lBase);
    const bowLantern = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.09, 0.24, 8), lanternMat);
    lanternGroup.add(bowLantern);
    const lCap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.12, 8), brassMat);
    lCap.position.y = 0.16;
    lanternGroup.add(lCap);
    this.hullRoot.add(lanternGroup);
    this.lanternMat = lanternMat;

    // Inviting ring around sailboat when docked/waiting
    this.boardRing = new THREE.Mesh(
      new THREE.RingGeometry(2.5, 2.95, 36).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xffcf7a,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.boardRing.position.y = 0.12;
    this.group.add(this.boardRing);

    this.wakeGroup = new THREE.Group();
    this.wakeMat = { opacity: 0 };
    this.hullRoot.add(this.wakeGroup);
  }

  _createBillowSailGeometry() {
    const N = 8;
    const pTack = new THREE.Vector3(0, -0.15, 1.6);
    const pPeak = new THREE.Vector3(0, 3.05, -1.75);
    const pClew = new THREE.Vector3(0, 0.05, -1.95);

    const positions = [];
    const basePts = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= N; i++) {
      const u = i / N;
      for (let j = 0; j <= N - i; j++) {
        const v = j / N;
        const w = Math.max(0, 1 - u - v);
        const x = pTack.x * w + pPeak.x * u + pClew.x * v;
        const y = pTack.y * w + pPeak.y * u + pClew.y * v;
        const z = pTack.z * w + pPeak.z * u + pClew.z * v;
        const bellyWeight = Math.pow(Math.max(0, 27 * u * v * w), 0.72);
        basePts.push({ x, y, z, belly: bellyWeight });
        positions.push(x, y, z);
        uvs.push(u, v);
      }
    }

    let rowStart = 0;
    for (let i = 0; i < N; i++) {
      const rowLen = N - i + 1;
      const nextStart = rowStart + rowLen;
      for (let j = 0; j < N - i; j++) {
        const a = rowStart + j;
        const b = rowStart + j + 1;
        const c = nextStart + j;
        indices.push(a, b, c);
        if (j + 1 < N - i) {
          const d = nextStart + j + 1;
          indices.push(b, d, c);
        }
      }
      rowStart = nextStart;
    }

    this._sailBasePts = basePts;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  _updateSailBillow(billowAmt, t) {
    const pos = this.sailGeo.attributes.position;
    const pts = this._sailBasePts;
    const flutter = Math.sin(t * 6.0) * 0.015 * Math.min(1, this.speed * 0.1);
    for (let i = 0; i < pts.length; i++) {
      const bp = pts[i];
      const offset = bp.belly * (billowAmt + flutter);
      pos.setXYZ(i, bp.x + offset, bp.y, bp.z);
    }
    pos.needsUpdate = true;
    this.sailGeo.computeVertexNormals();
  }

  getSeatWorldPos(out = new THREE.Vector3()) {
    out.set(0, 0.72, -0.78);
    this.hullRoot.updateMatrixWorld();
    return out.applyMatrix4(this.hullRoot.matrixWorld);
  }

  getFramingPoints() {
    this.group.updateMatrixWorld();
    const pts = [
      new THREE.Vector3(0, 0.5, 2.85),   // bow
      new THREE.Vector3(0, 0.5, -2.85),  // stern
      new THREE.Vector3(0, 4.65, 0.35),  // masthead
      new THREE.Vector3(-1.05, 0.6, 0),  // port beam
      new THREE.Vector3(1.05, 0.6, 0),   // starboard beam
    ];
    return pts.map((p) => p.applyMatrix4(this.group.matrixWorld));
  }

  update(dt, t, steerX = 0, showRing = false, lanternLevel = 0.4, breezeBoost = 0, sailYawOverride = null) {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;

    const targetHeel = -steerX * 0.15 + Math.sin(t * 1.4) * 0.028 + breezeBoost * 0.05;
    const targetPitch = Math.cos(t * 1.1) * 0.024 - Math.min(0.09, this.speed * 0.006);
    this.heel += (targetHeel - this.heel) * Math.min(1, dt * 4);
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 4);

    this.hullRoot.rotation.z = this.heel;
    this.hullRoot.rotation.x = this.pitch;

    const targetSail = sailYawOverride !== null ? sailYawOverride : (0.14 + steerX * 0.36 + Math.sin(t * 1.6) * 0.04);
    this.sailAngle += (targetSail - this.sailAngle) * Math.min(1, dt * 3.5);
    this.sailPivot.rotation.y = this.sailAngle;

    const targetBillow = sailYawOverride !== null ? 0.06 : (0.16 + Math.min(0.44, this.speed * 0.025 + breezeBoost * 0.24));
    this.billow += (targetBillow - this.billow) * Math.min(1, dt * 4.5);
    this._updateSailBillow(this.billow, t);

    this.tiller.rotation.y = steerX * 0.42;
    this.pennant.rotation.y = Math.sin(t * (4.5 + this.speed * 0.45)) * 0.28 + steerX * 0.3;

    this.wakeMat.opacity = Math.min(0.62, Math.max(0, (this.speed - 0.8) * 0.048 + breezeBoost * 0.18));
    const ws = 1 + Math.min(1.1, this.speed * 0.055);
    this.wakeGroup.scale.set(1 + breezeBoost * 0.25, 1, ws);

    this.boardRing.visible = showRing;
    if (showRing) {
      const s = 1 + 0.08 * Math.sin(t * 2.5);
      this.boardRing.scale.set(s, 1, s);
    }

    this.lanternMat.emissiveIntensity = 0.9 + lanternLevel * 1.6;
  }
}
