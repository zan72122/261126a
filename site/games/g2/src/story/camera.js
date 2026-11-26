// Critically damped spring camera rig with automatic bounding-point framing
// Guarantees subjects (girl, entire balloon envelope, dandelion float, arrival trio) stay unclipped.
import * as THREE from '../../lib/three.module.js';
import { clamp, springStep, springVec } from '../core/math.js';
import { terrainHeight } from '../world/terrain.js';

const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _f = new THREE.Vector3();
const _o = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3();

export function fitPointsShot({ points, dir, fov = 45, aspect = 1.33, margin = 0.14, target = null, minDist = 3.2 }) {
  const tgt = target ? target.clone() : new THREE.Vector3();
  if (!target) {
    for (const p of points) tgt.add(p);
    tgt.multiplyScalar(1 / points.length);
  }
  const d = dir.clone().normalize();
  _f.copy(d).negate();
  _r.crossVectors(_f, UP);
  if (_r.lengthSq() < 1e-6) _r.set(1, 0, 0);
  _r.normalize();
  _u.crossVectors(_r, _f).normalize();

  const tv = Math.tan((fov * Math.PI) / 360) * (1 - margin);
  const th = tv * Math.max(0.5, aspect);
  let dist = minDist;

  for (const p of points) {
    _o.subVectors(p, tgt);
    const along = _o.dot(d);
    const x = Math.abs(_o.dot(_r));
    const y = Math.abs(_o.dot(_u));
    dist = Math.max(dist, along + x / th, along + y / tv);
  }

  return {
    pos: tgt.clone().addScaledVector(d, dist),
    tgt,
    fov,
    dist,
  };
}

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3(0, 8, 12);
    this.tgt = new THREE.Vector3(0, 6, 0);
    this.vp = new THREE.Vector3();
    this.vt = new THREE.Vector3();
    this.fovS = { x: 45, v: 0 };
    this.time = 0;
  }

  snap(shot) {
    this.pos.copy(shot.pos);
    this.tgt.copy(shot.tgt);
    this.anchorId = shot.anchorId || null;
    const A = shot.anchor || ZERO;
    this.relPos = this.pos.clone().sub(A);
    this.relTgt = this.tgt.clone().sub(A);
    this.vp.set(0, 0, 0);
    this.vt.set(0, 0, 0);
    this.fovS.x = shot.fov;
    this.fovS.v = 0;
    this._apply();
  }

  update(dt, shot, stiff = 2.4) {
    this.time += dt;
    if (!shot) return;

    // Prevent camera from dipping below terrain
    const minGroundY = terrainHeight(shot.pos.x, shot.pos.z) + 1.4;
    if (shot.pos.y < minGroundY) shot.pos.y = minGroundY;

    const A = shot.anchor || ZERO;
    const id = shot.anchorId || null;
    if (id !== this.anchorId || !this.relPos) {
      this.anchorId = id;
      this.relPos = this.pos.clone().sub(A);
      this.relTgt = this.tgt.clone().sub(A);
    }

    _o.subVectors(shot.pos, A);
    springVec(this.relPos, this.vp, _o, stiff, dt);
    _o.subVectors(shot.tgt, A);
    springVec(this.relTgt, this.vt, _o, stiff * 1.25, dt);

    this.pos.addVectors(A, this.relPos);
    this.tgt.addVectors(A, this.relTgt);
    springStep(this.fovS, shot.fov, stiff, dt);

    const actualGround = terrainHeight(this.pos.x, this.pos.z) + 1.2;
    if (this.pos.y < actualGround) this.pos.y = actualGround;

    this._apply();
  }

  _apply() {
    const t = this.time;
    const drift = 0.015;
    this.cam.position.set(
      this.pos.x + Math.sin(t * 0.55) * drift,
      this.pos.y + Math.sin(t * 0.42 + 1.1) * drift,
      this.pos.z
    );
    this.cam.lookAt(this.tgt);
    if (Math.abs(this.cam.fov - this.fovS.x) > 1e-3) {
      this.cam.fov = clamp(this.fovS.x, 22, 72);
      this.cam.updateProjectionMatrix();
    }
    this.cam.updateMatrixWorld();
  }
}
