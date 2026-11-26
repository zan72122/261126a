import * as THREE from '../../lib/three.module.js';
import { clamp, springStep, springVec } from '../core/math.js';

const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _f = new THREE.Vector3();
const _o = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3();

/**
 * Computes a camera placement { pos, tgt, fov, dist } such that every 3D point in `points`
 * fits inside the viewport at any aspect ratio without clipping the top or sides.
 */
export function fitShot({
  points,
  dir,
  fov = 42,
  aspect = 1.33,
  margin = 0.16,
  target = null,
  minDist = 1.5,
  lift = 0,
}) {
  const tgt = target ? target.clone() : new THREE.Vector3();
  if (!target) {
    for (const p of points) tgt.add(p);
    tgt.multiplyScalar(1 / Math.max(1, points.length));
  }
  tgt.y += lift;

  const d = dir.clone().normalize();
  _f.copy(d).negate();
  _r.crossVectors(_f, _up);
  if (_r.lengthSq() < 1e-6) _r.set(1, 0, 0);
  _r.normalize();
  _u.crossVectors(_r, _f).normalize();

  const tv = Math.tan((fov * Math.PI) / 360) * (1 - margin);
  const th = tv * Math.max(0.45, aspect);

  let dist = minDist;
  for (const p of points) {
    _o.subVectors(p, tgt);
    const along = _o.dot(d);
    const x = Math.abs(_o.dot(_r));
    const y = Math.abs(_o.dot(_u));
    dist = Math.max(dist, along + x / th, along + y / tv);
  }
  return { pos: tgt.clone().addScaledVector(d, dist), tgt, fov, dist };
}

/**
 * Critically damped spring camera rig.
 * Immediately locks relative coordinates when switching to a moving anchor (e.g. girl float)
 * so the subject stays centered without getting left behind on the locomotive.
 */
export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3(0, 3, 8);
    this.tgt = new THREE.Vector3(0, 1, 0);
    this.vp = new THREE.Vector3();
    this.vt = new THREE.Vector3();
    this.fovS = { x: 42, v: 0 };
    this.stiff = 2.4;
    this.time = 0;
    this.anchorId = null;
    this.anchor = new THREE.Vector3();
    this.relPos = null;
    this.relTgt = null;
  }

  snap(shot) {
    this.pos.copy(shot.pos);
    this.tgt.copy(shot.tgt);
    this.anchorId = shot.anchorId || null;
    this.anchor.copy(shot.anchor || ZERO);
    this.relPos = this.pos.clone().sub(this.anchor);
    this.relTgt = this.tgt.clone().sub(this.anchor);
    this.vp.set(0, 0, 0);
    this.vt.set(0, 0, 0);
    this.fovS.x = shot.fov;
    this.fovS.v = 0;
    this._apply();
  }

  update(dt, shot, stiff = this.stiff) {
    this.time += dt;
    if (shot) {
      const A = shot.anchor || ZERO;
      const id = shot.anchorId || null;
      if (id !== this.anchorId || !this.relPos) {
        this.anchorId = id;
        this.relPos = this.pos.clone().sub(A);
        this.relTgt = this.tgt.clone().sub(A);
        // Reset velocity on anchor change so camera locks onto the new subject promptly
        this.vp.multiplyScalar(0.2);
        this.vt.multiplyScalar(0.2);
      }
      _o.subVectors(shot.pos, A);
      springVec(this.relPos, this.vp, _o, stiff, dt);
      _o.subVectors(shot.tgt, A);
      springVec(this.relTgt, this.vt, _o, stiff * 1.3, dt);
      this.pos.addVectors(A, this.relPos);
      this.tgt.addVectors(A, this.relTgt);
      springStep(this.fovS, shot.fov, stiff, dt);
    }
    this._apply();
  }

  _apply() {
    const c = this.cam;
    c.position.copy(this.pos);
    const t = this.time;
    c.position.x += Math.sin(t * 0.55) * 0.015;
    c.position.y += Math.sin(t * 0.43 + 1.1) * 0.012;
    c.lookAt(this.tgt);
    if (Math.abs(c.fov - this.fovS.x) > 1e-3) {
      c.fov = clamp(this.fovS.x, 18, 72);
      c.updateProjectionMatrix();
    }
    c.updateMatrixWorld();
  }
}
