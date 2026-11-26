import * as THREE from '../../lib/three.module.js';

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/**
 * Critically damped spring for a scalar state { x, v }.
 */
export function springStep(s, target, omega, dt) {
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const det = f + hhoo;
  const x = (f * s.x + dt * s.v + hhoo * target) / det;
  const v = (s.v + hoo * (target - s.x)) / det;
  s.x = x;
  s.v = v;
  return x;
}

/**
 * Critically damped spring for a Vector3 position and velocity.
 */
export function springVec(pos, vel, target, omega, dt) {
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const det = f + hhoo;
  const nx = (f * pos.x + dt * vel.x + hhoo * target.x) / det;
  const ny = (f * pos.y + dt * vel.y + hhoo * target.y) / det;
  const nz = (f * pos.z + dt * vel.z + hhoo * target.z) / det;
  vel.x = (vel.x + hoo * (target.x - pos.x)) / det;
  vel.y = (vel.y + hoo * (target.y - pos.y)) / det;
  vel.z = (vel.z + hoo * (target.z - pos.z)) / det;
  pos.set(nx, ny, nz);
}

/**
 * Deterministic PRNG (Mulberry32).
 */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const _v1 = new THREE.Vector3();
export const _v2 = new THREE.Vector3();
export const _v3 = new THREE.Vector3();
