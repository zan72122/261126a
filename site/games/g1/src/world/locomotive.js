import * as THREE from '../../lib/three.module.js';

/**
 * 1960s Swiss Narrow-Gauge Tank Steam Locomotive:
 * - Main: deep pine-green boiler & water tanks with riveted/brushed sheen, dark cast-iron frame & smokebox
 * - Accent: mustard-yellow striping & brass steam dome/whistle/handrails/headlamp, cobalt cab doors
 * - Physical rotating spoked driving wheels with counterweights, reciprocating connecting rods, glowing firebox
 */
export class Locomotive {
  constructor(mats) {
    this.group = new THREE.Group();
    this.mats = mats;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.wheelAngle = 0;

    this.wheels = [];
    this.rods = [];
    this.interactables = [];

    this._buildBody();
  }

  _buildBody() {
    const m = this.mats;

    // 1. Iron Chassis & Buffer Beams
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.34, 5.1), m.ironDark);
    frame.position.set(0, 0.58, 0);
    frame.castShadow = true;
    frame.receiveShadow = true;
    this.group.add(frame);

    const runningBoard = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.08, 4.9), m.ironDark);
    runningBoard.position.set(0, 0.74, 0.1);
    this.group.add(runningBoard);

    const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.28, 0.22), m.mustard);
    frontBeam.position.set(0, 0.56, 2.62);
    frontBeam.castShadow = true;
    this.group.add(frontBeam);

    const rearBeam = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.28, 0.22), m.mustard);
    rearBeam.position.set(0, 0.56, -2.58);
    rearBeam.castShadow = true;
    this.group.add(rearBeam);

    for (const z of [2.8, -2.76]) {
      for (const x of [-0.52, 0.52]) {
        const buf = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 10), m.ironSteel);
        buf.rotation.x = Math.PI / 2;
        buf.position.set(x, 0.56, z);
        this.group.add(buf);
      }
    }

    // Sloped cowcatcher blade cleanly clear of rail heads (local y >= 0.12)
    const plowGeo = new THREE.ConeGeometry(0.68, 0.52, 4);
    plowGeo.rotateY(Math.PI / 4);
    plowGeo.scale(1.18, 0.52, 0.44);
    const plow = new THREE.Mesh(plowGeo, m.ironDark);
    plow.rotation.x = Math.PI / 2;
    plow.position.set(0, 0.34, 2.74);
    this.group.add(plow);

    // 2. Coupled Spoked Driving Wheels with Counterweights + Guide Wheels (bottoms at local y = 0.0)
    const wheelZs = [1.05, -0.25];
    for (const wz of wheelZs) {
      for (const side of [-1, 1]) {
        const wGroup = new THREE.Group();
        wGroup.position.set(side * 0.56, 0.42, wz);

        const tire = new THREE.Mesh(new THREE.TorusGeometry(0.375, 0.045, 8, 20), m.ironSteel);
        tire.rotation.y = Math.PI / 2;
        tire.castShadow = true;
        wGroup.add(tire);

        const innerRim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 18), m.mustard);
        innerRim.rotation.z = Math.PI / 2;
        wGroup.add(innerRim);

        for (let s = 0; s < 5; s++) {
          const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.68, 0.042), m.ironDark);
          spoke.rotation.x = (s / 5) * Math.PI;
          wGroup.add(spoke);
        }

        const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.09, 10, 1, false, 0, Math.PI * 0.65), m.ironDark);
        weight.rotation.z = Math.PI / 2;
        wGroup.add(weight);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 10), m.ironSteel);
        hub.rotation.z = Math.PI / 2;
        wGroup.add(hub);

        this.group.add(wGroup);
        this.wheels.push(wGroup);
      }
    }

    for (const wz of [2.15, -1.65]) {
      for (const side of [-1, 1]) {
        const wGroup = new THREE.Group();
        wGroup.position.set(side * 0.56, 0.28, wz);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.09, 14), m.ironSteel);
        rim.rotation.z = Math.PI / 2;
        wGroup.add(rim);
        const center = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12), m.ironDark);
        center.rotation.z = Math.PI / 2;
        wGroup.add(center);
        this.group.add(wGroup);
        this.wheels.push(wGroup);
      }
    }

    // Steam Cylinders, Valve Chests & Connecting Rods
    for (const side of [-1, 1]) {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.72, 12), m.ironDark);
      cyl.rotation.x = Math.PI / 2;
      cyl.position.set(side * 0.78, 0.46, 1.95);
      cyl.castShadow = true;
      this.group.add(cyl);

      const valveChest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.55), m.ironSteel);
      valveChest.position.set(side * 0.78, 0.69, 1.95);
      this.group.add(valveChest);

      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 1.85), m.ironSteel);
      rod.position.set(side * 0.7, 0.42, 0.6);
      this.group.add(rod);
      this.rods.push({ mesh: rod, side, baseX: side * 0.7, baseY: 0.42, baseZ: 0.6 });
    }

    // 3. Boiler (Pine Green) + Smokebox (Dark Iron) + Side Water Tanks + Brass Piping & Handrails
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 2.35, 22), m.locoGreen);
    boiler.rotation.x = Math.PI / 2;
    boiler.position.set(0, 1.32, 0.62);
    boiler.castShadow = true;
    this.group.add(boiler);

    for (const bz of [-0.15, 0.55, 1.25]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.586, 0.025, 8, 22), m.brass);
      band.position.set(0, 1.32, bz);
      this.group.add(band);
    }

    const smokebox = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.96, 22), m.ironDark);
    smokebox.rotation.x = Math.PI / 2;
    smokebox.position.set(0, 1.32, 2.18);
    smokebox.castShadow = true;
    this.group.add(smokebox);

    const saddle = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.56, 0.78), m.ironDark);
    saddle.position.set(0, 0.95, 2.18);
    this.group.add(saddle);

    const sbDoor = new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.35), m.ironDark);
    sbDoor.rotation.x = Math.PI / 2;
    sbDoor.position.set(0, 1.32, 2.48);
    this.group.add(sbDoor);

    const sbWheel = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 12), m.brass);
    sbWheel.position.set(0, 1.32, 2.74);
    this.group.add(sbWheel);

    for (const side of [-1, 1]) {
      const tank = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.82, 2.0), m.locoGreen);
      tank.position.set(side * 0.72, 1.15, 0.55);
      tank.castShadow = true;
      this.group.add(tank);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 2.02), m.mustard);
      stripe.position.set(side * 0.72, 1.35, 0.55);
      this.group.add(stripe);

      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.55, 8), m.brass);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(side * 0.62, 1.68, 1.05);
      this.group.add(rail);

      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.85, 8), m.brass);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(side * 0.58, 1.02, 0.45);
      this.group.add(pipe);
    }

    // 4. Smokestack with flared brass rim
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.94, 16), m.ironDark);
    stack.position.set(0, 2.22, 2.15);
    stack.castShadow = true;
    this.group.add(stack);

    const stackRim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 8, 18), m.brass);
    stackRim.rotation.x = Math.PI / 2;
    stackRim.position.set(0, 2.69, 2.15);
    this.group.add(stackRim);
    this.chimneyTipLocal = new THREE.Vector3(0, 2.75, 2.15);

    // 5. Interactive Brass Steam Dome & Whistle
    this.whistleDome = new THREE.Group();
    this.whistleDome.position.set(0, 1.88, 0.72);
    const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.36, 16), m.brass);
    domeBase.position.y = 0.16;
    domeBase.castShadow = true;
    this.whistleDome.add(domeBase);

    const domeCap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10), m.brass);
    domeCap.position.y = 0.34;
    this.whistleDome.add(domeCap);

    const whistlePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.38, 10), m.brass);
    whistlePipe.position.set(0, 0.62, -0.05);
    this.whistleDome.add(whistlePipe);

    this.whistleDome.userData.interact = 'whistle';
    this.group.add(this.whistleDome);
    this.interactables.push(this.whistleDome);
    this.whistleTipLocal = new THREE.Vector3(0, 2.72, 0.67);

    // Interactive Side Steam Valve
    this.steamValve = new THREE.Group();
    this.steamValve.position.set(0.92, 1.15, 1.38);
    const valveBody = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 10), m.brass);
    valveBody.rotation.z = Math.PI / 2;
    this.steamValve.add(valveBody);
    const valveWheel = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.026, 8, 12), m.mustard);
    valveWheel.rotation.y = Math.PI / 2;
    valveWheel.position.x = 0.09;
    this.steamValve.add(valveWheel);
    this.steamValve.userData.interact = 'valve';
    this.group.add(this.steamValve);
    this.interactables.push(this.steamValve);

    // Front Headlamp
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.24, 12), m.brass);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, 1.25, 2.72);
    this.group.add(lamp);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), m.lanternGlow);
    lens.position.set(0, 1.25, 2.85);
    this.group.add(lens);

    // 6. Open-Sided Timber & Iron Cab
    const cabFloor = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.12, 1.72), m.timberMid);
    cabFloor.position.set(0, 0.78, -1.55);
    cabFloor.receiveShadow = true;
    this.group.add(cabFloor);

    const bulkhead = new THREE.Mesh(new THREE.BoxGeometry(1.76, 1.38, 0.14), m.locoGreen);
    bulkhead.position.set(0, 1.5, -0.7);
    bulkhead.castShadow = true;
    this.group.add(bulkhead);

    for (const px of [-0.46, 0.46]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 14), m.brass);
      ring.position.set(px, 1.78, -0.62);
      this.group.add(ring);
    }

    for (const side of [-1, 1]) {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.68, 1.62), m.locoGreen);
      sideWall.position.set(side * 0.84, 1.15, -1.55);
      sideWall.castShadow = true;
      this.group.add(sideWall);

      const door = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.64, 0.56), m.cobalt);
      door.position.set(side * 0.85, 1.14, -1.35);
      this.group.add(door);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 1.32, 8), m.ironDark);
      post.position.set(side * 0.83, 2.02, -2.32);
      this.group.add(post);

      const grab = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 8), m.brass);
      grab.position.set(side * 0.9, 1.48, -1.65);
      this.group.add(grab);
    }

    const bunker = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.74, 0.58), m.ironDark);
    bunker.position.set(0, 1.18, -2.26);
    bunker.castShadow = true;
    this.group.add(bunker);

    const firebox = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), m.lanternGlow);
    firebox.scale.set(1.2, 0.8, 0.5);
    firebox.position.set(0, 1.05, -0.78);
    this.group.add(firebox);

    // Curved arched Swiss cab roof resting cleanly on the cab corner posts
    const roofArc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.45, 1.82, 16, 1, false, -0.68, 1.36),
      m.ironDark
    );
    roofArc.rotation.x = Math.PI / 2;
    roofArc.scale.set(0.96, 1.0, 0.24);
    roofArc.position.set(0, 2.34, -1.55);
    roofArc.castShadow = true;
    this.group.add(roofArc);

    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.56), m.ironSteel);
    vent.position.set(0, 2.71, -1.55);
    this.group.add(vent);

    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12), m.brass);
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(0, 1.56, -0.79);
    this.group.add(gauge);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), m.plaster);
    dial.rotation.y = Math.PI;
    dial.position.set(0, 1.56, -0.825);
    this.group.add(dial);

    this.girlSeatLocal = new THREE.Vector3(0.28, 0.84, -1.52);
    this.puppySeatLocal = new THREE.Vector3(-0.34, 0.84, -1.4);

    // Tag visible body parts for tap raycasting (no oversized invisible hit mesh)
    for (const part of [frame, runningBoard, boiler, smokebox, bulkhead, bunker, roofArc]) {
      part.userData.interact = 'loco';
      this.interactables.push(part);
    }
  }

  getWorldPoint(localVec, out = new THREE.Vector3()) {
    return out.copy(localVec).applyMatrix4(this.group.matrixWorld);
  }

  update(dt, speedSigned, whistleKick = 0) {
    const dist = speedSigned * dt;
    this.wheelAngle += dist / 0.42;
    for (const w of this.wheels) {
      w.rotation.x = this.wheelAngle;
    }
    const crankR = 0.14;
    const offY = Math.sin(this.wheelAngle) * crankR;
    const offZ = Math.cos(this.wheelAngle) * crankR;
    for (const r of this.rods) {
      r.mesh.position.set(r.baseX, r.baseY + offY, r.baseZ + offZ);
    }
    this.whistleDome.scale.y = 1 + whistleKick * 0.14;
    this.steamValve.rotation.x = whistleKick * 0.8;
  }
}
