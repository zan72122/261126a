// Math and damping utilities
import * as THREE from '../../lib/three.module.js';

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDiff(from, to) {
  return wrapAngle(to - from);
}

// Critically damped scalar spring
export function springStep(state, target, omega, dt) {
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const detInv = 1 / (f + hhoo);
  const x = (f * state.x + dt * state.v + hhoo * target) * detInv;
  const v = (state.v + hoo * (target - state.x)) * detInv;
  state.x = x;
  state.v = v;
  return x;
}

// Critically damped Vector3 spring
export function springVec(pos, vel, target, omega, dt) {
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const detInv = 1 / (f + hhoo);

  const tx = target.x, ty = target.y, tz = target.z;
  const px = pos.x, py = pos.y, pz = pos.z;
  const vx = vel.x, vy = vel.y, vz = vel.z;

  pos.x = (f * px + dt * vx + hhoo * tx) * detInv;
  pos.y = (f * py + dt * vy + hhoo * ty) * detInv;
  pos.z = (f * pz + dt * vz + hhoo * tz) * detInv;

  vel.x = (vx + hoo * (tx - px)) * detInv;
  vel.y = (vy + hoo * (ty - py)) * detInv;
  vel.z = (vz + hoo * (tz - pz)) * detInv;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
