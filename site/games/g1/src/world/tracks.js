import * as THREE from '../../lib/three.module.js';
import { clamp, lerp } from '../core/math.js';
import { buildTrackCurves } from './trackData.js';
import { heightAt } from './terrain.js';

const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
const _r = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

function makeArchSpanGeometry() {
  // Unit span in X (-0.5..0.5), Y (-1.0..0.0), extruded in Z (-1.28..1.28)
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0.5, 0);
  shape.lineTo(0.5, -1.0);
  shape.lineTo(0.39, -1.0);
  const segs = 14;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI;
    const ax = Math.cos(a) * 0.39;
    const ay = -1.0 + Math.sin(a) * 0.82;
    shape.lineTo(ax, ay);
  }
  shape.lineTo(-0.5, -1.0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 2.56,
    bevelEnabled: false,
    curveSegments: 12,
  });
  geo.translate(0, 0, -1.28);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Branching mountain railway network:
 * - Solid 3D steel rails seated flush on instanced wooden sleepers over a 3D ballast/masonry deck
 * - Multi-arch stone viaducts & river bridges with wide deck clearance, tapered piers, pier caps & parapets
 * - Alpine stone mountain gallery/tunnel on seg4_main right before emerging onto the cloud-sea viaduct
 * - Registers walkable decks, pier obstacles, parapets & gallery walls into PhysicsWorld
 */
export class TrackNetwork {
  constructor(mats, { low = false, physics = null } = {}) {
    this.group = new THREE.Group();
    this.mats = mats;
    this.physics = physics;
    this.segments = buildTrackCurves();
    this.switches = {
      sw1: 0,
      sw2: 0,
      sw3: 0,
    };
    this.switchVisuals = {};
    this.pierObstacles = [];

    this._buildRailsAndSleepers(low);
    this._buildMountainGallery();
    this._buildSwitches();
  }

  sample(segId, s, outPos = new THREE.Vector3(), outTan = new THREE.Vector3()) {
    const seg = this.segments[segId];
    const u = clamp(s, 0, 1);
    seg.curve.getPointAt(u, outPos);
    seg.curve.getTangentAt(u, outTan).normalize();
    return { pos: outPos, tan: outTan, seg };
  }

  setSwitch(swId, branch) {
    if (!(swId in this.switches)) return;
    this.switches[swId] = branch ? 1 : 0;
    const vis = this.switchVisuals[swId];
    if (vis) {
      vis.targetAngle = branch ? -0.58 : 0.58;
    }
  }

  toggleSwitch(swId) {
    if (!(swId in this.switches)) return 0;
    const next = this.switches[swId] === 0 ? 1 : 0;
    this.setSwitch(swId, next);
    return next;
  }

  getNextSegment(segId) {
    const seg = this.segments[segId];
    if (!seg || !seg.next.length) return null;
    const idx = seg.switchId ? clamp(this.switches[seg.switchId] || 0, 0, seg.next.length - 1) : 0;
    return {
      segId: seg.next[idx],
      s: seg.nextS[idx] || 0,
    };
  }

  nearestTrackPoint(worldPos, excludeViaductHigh = true) {
    let best = { segId: 'seg0_home_village', s: 0.25, distSq: Infinity, pos: new THREE.Vector3() };
    for (const [id, seg] of Object.entries(this.segments)) {
      const steps = 28;
      for (let i = 0; i <= steps; i++) {
        const s = i / steps;
        seg.curve.getPointAt(s, _p);
        if (excludeViaductHigh) {
          const clearance = _p.y - heightAt(_p.x, _p.z);
          if (clearance > 2.2 || (_p.y > 38 && worldPos.y < 30)) continue;
        }
        const d2 = _p.distanceToSquared(worldPos);
        if (d2 < best.distSq) {
          best = { segId: id, s, distSq: d2, pos: _p.clone() };
        }
      }
    }
    return best;
  }

  _buildRailsAndSleepers(low) {
    const sleeperTransforms = [];
    const railStep = low ? 2.0 : 1.3;
    const gaugeHalf = 0.48;

    const railPos = [];
    const railNorm = [];
    const railIdx = [];
    const deckPos = [];
    const deckNorm = [];
    const deckIdx = [];
    let railVerts = 0;
    let deckVerts = 0;

    const pushQuad = (verts, norms, idxs, vCount, a, b, c, d, nx, ny, nz) => {
      verts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
      for (let k = 0; k < 4; k++) norms.push(nx, ny, nz);
      idxs.push(vCount, vCount + 1, vCount + 2, vCount, vCount + 2, vCount + 3);
      return vCount + 4;
    };

    const addBoxSpan = (verts, norms, idxs, vCount, p0L, p0R, p1L, p1R, depthDown, rightVec) => {
      const b0L = p0L.clone();
      const b0R = p0R.clone();
      const b1L = p1L.clone();
      const b1R = p1R.clone();
      b0L.y -= depthDown;
      b0R.y -= depthDown;
      b1L.y -= depthDown;
      b1R.y -= depthDown;
      // Top
      vCount = pushQuad(verts, norms, idxs, vCount, p0L, p0R, p1R, p1L, 0, 1, 0);
      // Bottom
      vCount = pushQuad(verts, norms, idxs, vCount, b0R, b0L, b1L, b1R, 0, -1, 0);
      // Left side
      vCount = pushQuad(verts, norms, idxs, vCount, b0L, p0L, p1L, b1L, -rightVec.x, 0, -rightVec.z);
      // Right side
      vCount = pushQuad(verts, norms, idxs, vCount, p0R, b0R, b1R, p1R, rightVec.x, 0, rightVec.z);
      return vCount;
    };

    const pierRuns = [];
    const parapetTransforms = [];

    for (const [id, seg] of Object.entries(this.segments)) {
      const steps = Math.max(18, Math.round(seg.length / railStep));
      let prevL = null;
      let prevR = null;
      let prevDeckL = null;
      let prevDeckR = null;
      let prevElevated = false;
      let prevRight = null;
      let currentRun = [];

      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        seg.curve.getPointAt(u, _p);
        seg.curve.getTangentAt(u, _t).normalize();
        _r.crossVectors(_t, _up).normalize();

        const groundY = heightAt(_p.x, _p.z);
        const clearance = _p.y - groundY;
        const onSummitPlatform = id === 'seg5_viaduct' && u > 0.83;
        const isElevatedSection =
          !onSummitPlatform &&
          ((seg.elevatedFrom !== undefined && u >= seg.elevatedFrom && u <= seg.elevatedTo) ||
            clearance > 2.2);

        // Sleepers sit flush on deck top (_p.y .. _p.y + 0.08)
        if (i < steps) {
          const yaw = Math.atan2(_t.x, _t.z);
          const pitch = -Math.asin(clamp(_t.y, -0.95, 0.95));
          _q.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
          _s.set(1.44, 0.08, 0.22);
          sleeperTransforms.push(
            new THREE.Matrix4().compose(new THREE.Vector3(_p.x, _p.y + 0.04, _p.z), _q, _s)
          );
        }

        // Steel rail heads sit flush on sleepers (_p.y + 0.08 .. _p.y + 0.15)
        const railL = _p.clone().addScaledVector(_r, -gaugeHalf);
        railL.y += 0.15;
        const railR = _p.clone().addScaledVector(_r, gaugeHalf);
        railR.y += 0.15;

        const deckHalfW = isElevatedSection ? 1.6 : 1.18;
        const deckL = _p.clone().addScaledVector(_r, -deckHalfW);
        const deckR = _p.clone().addScaledVector(_r, deckHalfW);

        if (prevL) {
          const rw = 0.055;
          railVerts = addBoxSpan(
            railPos, railNorm, railIdx, railVerts,
            prevL.clone().addScaledVector(_r, -rw),
            prevL.clone().addScaledVector(_r, rw),
            railL.clone().addScaledVector(_r, rw),
            railL.clone().addScaledVector(_r, -rw),
            0.07, _r
          );
          railVerts = addBoxSpan(
            railPos, railNorm, railIdx, railVerts,
            prevR.clone().addScaledVector(_r, -rw),
            prevR.clone().addScaledVector(_r, rw),
            railR.clone().addScaledVector(_r, rw),
            railR.clone().addScaledVector(_r, -rw),
            0.07, _r
          );

          const deckDepth = (isElevatedSection || prevElevated) ? 0.42 : 0.22;
          deckVerts = addBoxSpan(
            deckPos, deckNorm, deckIdx, deckVerts,
            prevDeckL, prevDeckR, deckL, deckR, deckDepth, _r
          );

          if ((isElevatedSection || prevElevated) && this.physics) {
            const mid = prevDeckL.clone().add(prevDeckR).add(deckL).add(deckR).multiplyScalar(0.25);
            const spanDir = deckL.clone().add(deckR).multiplyScalar(0.5).sub(prevDeckL.clone().add(prevDeckR).multiplyScalar(0.5));
            const spanLen = Math.hypot(spanDir.x, spanDir.z);
            const yaw = Math.atan2(spanDir.x, spanDir.z);
            this.physics.addDeckOBB(mid.x, mid.z, yaw, 3.2, spanLen + 0.2, mid.y, 1.0);
          }
        }
        prevL = railL;
        prevR = railR;
        prevDeckL = deckL;
        prevDeckR = deckR;
        prevElevated = isElevatedSection;
        prevRight = _r.clone();

        if (isElevatedSection) {
          if (i < steps) {
            const yaw = Math.atan2(_t.x, _t.z);
            const pitch = -Math.asin(clamp(_t.y, -0.95, 0.95));
            _q.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
            // Parapets placed at +-1.48m (inner face 1.40m, leaving >0.39m lateral clearance for locomotive)
            _s.set(0.16, 0.42, railStep * 1.02);
            for (const side of [-1.48, 1.48]) {
              const pPos = _p.clone().addScaledVector(_r, side);
              pPos.y += 0.21; // sits flush on deck top (_p.y + 0.00 .. _p.y + 0.42)
              parapetTransforms.push(new THREE.Matrix4().compose(pPos, _q, _s));
              if (this.physics) {
                this.physics.addOBB(pPos.x, pPos.z, yaw, 0.18, railStep * 1.02, _p.y, _p.y + 0.45, 'parapet');
              }
            }
          }

          if (i % (low ? 5 : 4) === 1) {
            currentRun.push({
              pos: _p.clone(),
              groundY,
              yaw: Math.atan2(_t.x, _t.z),
            });
          }
        } else if (currentRun.length > 0) {
          pierRuns.push(currentRun);
          currentRun = [];
        }
      }
      if (currentRun.length > 0) pierRuns.push(currentRun);
    }

    // Steel rails
    const railGeo = new THREE.BufferGeometry();
    railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
    railGeo.setAttribute('normal', new THREE.Float32BufferAttribute(railNorm, 3));
    railGeo.setIndex(railIdx);
    const railMesh = new THREE.Mesh(railGeo, this.mats.ironSteel);
    railMesh.receiveShadow = true;
    this.group.add(railMesh);

    // Solid 3D Ballast / Stone Deck
    const deckGeo = new THREE.BufferGeometry();
    deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPos, 3));
    deckGeo.setAttribute('normal', new THREE.Float32BufferAttribute(deckNorm, 3));
    deckGeo.setIndex(deckIdx);
    const deckMat = new THREE.MeshStandardMaterial({
      map: this.mats.stoneMid.map,
      bumpMap: this.mats.stoneMid.bumpMap,
      bumpScale: 0.06,
      color: '#a39c90',
      roughness: 0.92,
      side: THREE.DoubleSide,
    });
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.receiveShadow = true;
    this.group.add(deckMesh);

    // Instanced sleepers
    const sleeperGeo = new THREE.BoxGeometry(1, 1, 1);
    const sleepers = new THREE.InstancedMesh(sleeperGeo, this.mats.timberDark, sleeperTransforms.length);
    sleepers.receiveShadow = true;
    for (let i = 0; i < sleeperTransforms.length; i++) {
      sleepers.setMatrixAt(i, sleeperTransforms[i]);
    }
    sleepers.instanceMatrix.needsUpdate = true;
    this.group.add(sleepers);

    // Stone Viaduct Piers, Pier Caps, & Masonry Arches
    const flatPiers = [];
    const archSpans = [];
    for (const run of pierRuns) {
      for (let i = 0; i < run.length; i++) {
        flatPiers.push(run[i]);
        this.pierObstacles.push({ x: run[i].pos.x, z: run[i].pos.z, radius: 2.1 });
        if (i < run.length - 1) {
          const a = run[i];
          const b = run[i + 1];
          const dist = a.pos.distanceTo(b.pos);
          if (dist > 1.5 && dist < 15.0) {
            archSpans.push({ a, b, dist });
          }
        }
      }
    }

    if (flatPiers.length > 0) {
      const pierGeo = new THREE.CylinderGeometry(1.12, 1.44, 1, 4);
      pierGeo.rotateY(Math.PI / 4);
      const piers = new THREE.InstancedMesh(pierGeo, this.mats.stoneMid, flatPiers.length);
      piers.castShadow = !low;
      piers.receiveShadow = true;

      const capGeo = new THREE.BoxGeometry(3.25, 0.38, 1.65);
      const caps = new THREE.InstancedMesh(capGeo, this.mats.stoneLight, flatPiers.length);
      caps.receiveShadow = true;

      for (let i = 0; i < flatPiers.length; i++) {
        const { pos, groundY, yaw } = flatPiers[i];
        // Sample lowest corner around pier base so pier touches sloped ground without excessive burial
        const minFootY = Math.min(
          groundY,
          heightAt(pos.x + 1.1, pos.z),
          heightAt(pos.x - 1.1, pos.z),
          heightAt(pos.x, pos.z + 1.1),
          heightAt(pos.x, pos.z - 1.1)
        ) - 0.18;
        const capTop = pos.y - 0.42;
        const capBottom = capTop - 0.38;
        const h = Math.max(1.2, capBottom - minFootY);
        _q.setFromAxisAngle(_up, yaw);
        _s.set(1.36, h, 0.85);
        _m.compose(new THREE.Vector3(pos.x, capBottom - h * 0.5, pos.z), _q, _s);
        piers.setMatrixAt(i, _m);

        _s.set(1, 1, 1);
        _m.compose(new THREE.Vector3(pos.x, (capTop + capBottom) * 0.5, pos.z), _q, _s);
        caps.setMatrixAt(i, _m);

        if (this.physics) {
          this.physics.addCylinder(pos.x, pos.z, 1.55, minFootY, capTop, 'pier');
        }
      }
      piers.instanceMatrix.needsUpdate = true;
      caps.instanceMatrix.needsUpdate = true;
      this.group.add(piers, caps);
    }

    if (archSpans.length > 0) {
      const archGeo = makeArchSpanGeometry();
      const arches = new THREE.InstancedMesh(archGeo, this.mats.stoneLight, archSpans.length);
      arches.castShadow = !low;
      arches.receiveShadow = true;

      for (let i = 0; i < archSpans.length; i++) {
        const { a, b } = archSpans[i];
        const mid = a.pos.clone().add(b.pos).multiplyScalar(0.5);
        const dir = b.pos.clone().sub(a.pos);
        const horizDist = Math.hypot(dir.x, dir.z);
        const yaw = Math.atan2(dir.x, dir.z);
        const pitch = -Math.atan2(dir.y, Math.max(0.1, horizDist));
        const spanLen = dir.length() + 0.3;
        const groundMid = heightAt(mid.x, mid.z);
        const archDrop = clamp((mid.y - groundMid) * 0.65, 1.8, 6.2);

        _q.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
        _s.set(1.02, archDrop, spanLen);
        _m.compose(new THREE.Vector3(mid.x, mid.y - 0.42, mid.z), _q, _s);
        arches.setMatrixAt(i, _m);
      }
      arches.instanceMatrix.needsUpdate = true;
      this.group.add(arches);
    }

    if (parapetTransforms.length > 0) {
      const paraGeo = new THREE.BoxGeometry(1, 1, 1);
      const parapets = new THREE.InstancedMesh(paraGeo, this.mats.stoneLight, parapetTransforms.length);
      parapets.receiveShadow = true;
      for (let i = 0; i < parapetTransforms.length; i++) {
        parapets.setMatrixAt(i, parapetTransforms[i]);
      }
      parapets.instanceMatrix.needsUpdate = true;
      this.group.add(parapets);
    }
  }

  _buildMountainGallery() {
    const m = this.mats;
    const gallery = new THREE.Group();
    const sStart = 0.40;
    const sEnd = 0.78;
    const bays = 6;

    for (let i = 0; i < bays; i++) {
      const u0 = lerp(sStart, sEnd, i / bays);
      const u1 = lerp(sStart, sEnd, (i + 1) / bays);
      const um = (u0 + u1) * 0.5;
      const p0 = this.sample('seg4_main', u0).pos;
      const p1 = this.sample('seg4_main', u1).pos;
      const { pos } = this.sample('seg4_main', um);
      const dir = p1.clone().sub(p0);
      const segLen = dir.length() + 0.25;
      const yaw = Math.atan2(dir.x, dir.z);
      const pitch = -Math.atan2(dir.y, Math.max(0.1, Math.hypot(dir.x, dir.z)));

      const bay = new THREE.Group();
      bay.position.copy(pos);
      bay.rotation.set(pitch, yaw, 0, 'YXZ');

      const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.95, 4.7, segLen), m.stoneMid);
      backWall.position.set(2.35, 2.25, 0);
      backWall.castShadow = true;
      backWall.receiveShadow = true;
      bay.add(backWall);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.52, segLen + 0.12), m.stoneMid);
      roof.position.set(0.25, 4.55, 0);
      roof.rotation.z = 0.14;
      roof.castShadow = true;
      roof.receiveShadow = true;
      bay.add(roof);

      const snowCap = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.22, segLen + 0.08), m.snowRoof);
      snowCap.position.set(0.25, 4.86, 0);
      snowCap.rotation.z = 0.14;
      bay.add(snowCap);

      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 4.55, 0.72), m.stoneLight);
      pillar.position.set(-1.95, 1.98, 0);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      bay.add(pillar);

      if (i === 0 || i === bays - 1) {
        const zEnd = i === 0 ? -segLen * 0.44 : segLen * 0.44;
        const header = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.95, 0.72), m.stoneLight);
        header.position.set(0.2, 4.15, zEnd);
        header.castShadow = true;
        bay.add(header);
      }

      if (this.physics) {
        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);
        const wxBack = pos.x + 2.35 * cos;
        const wzBack = pos.z - 2.35 * sin;
        this.physics.addOBB(wxBack, wzBack, yaw, 0.95, segLen, pos.y - 0.5, pos.y + 4.8, 'wall');
        const wxPil = pos.x - 1.95 * cos;
        const wzPil = pos.z + 1.95 * sin;
        this.physics.addOBB(wxPil, wzPil, yaw, 0.62, 0.72, pos.y - 0.5, pos.y + 4.4, 'wall');
      }

      gallery.add(bay);
    }

    this.group.add(gallery);
  }

  _buildSwitches() {
    const switchSpecs = [
      { id: 'sw1', segId: 'seg0_home_village', s: 0.985, side: 1.75 },
      { id: 'sw2', segId: 'seg2_lake', s: 0.975, side: -1.75 },
      { id: 'sw3', segId: 'seg3_climb', s: 0.985, side: 1.75 },
    ];

    for (const sp of switchSpecs) {
      const { pos, tan } = this.sample(sp.segId, sp.s);
      const right = new THREE.Vector3().crossVectors(tan, _up).normalize();
      const standPos = pos.clone().addScaledVector(right, sp.side);
      const groundY = heightAt(standPos.x, standPos.z);

      const g = new THREE.Group();
      g.position.set(standPos.x, groundY, standPos.z);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.65, 8), this.mats.ironDark);
      post.position.y = 0.825;
      post.castShadow = true;
      g.add(post);

      const leverPivot = new THREE.Group();
      leverPivot.position.y = 1.55;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.08), this.mats.mustard);
      arm.position.y = 0.34;
      leverPivot.add(arm);

      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 12), this.mats.cobalt);
      disc.rotation.x = Math.PI / 2;
      disc.position.y = 0.72;
      leverPivot.add(disc);

      leverPivot.rotation.z = 0.58;
      g.add(leverPivot);
      this.group.add(g);

      if (this.physics) {
        this.physics.addCylinder(standPos.x, standPos.z, 0.28, groundY, groundY + 2.2, 'post');
      }

      this.switchVisuals[sp.id] = {
        pivot: leverPivot,
        angle: 0.58,
        targetAngle: 0.58,
        pos: standPos,
      };
    }
  }

  update(dt) {
    for (const vis of Object.values(this.switchVisuals)) {
      vis.angle = lerp(vis.angle, vis.targetAngle, 1 - Math.exp(-9 * dt));
      vis.pivot.rotation.z = vis.angle;
    }
  }
}
