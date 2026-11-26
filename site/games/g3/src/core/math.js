export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, t) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function springStep(state, target, omega, dt) {
  const f = 1 + 2 * omega * dt;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const detInv = 1 / (f + hhoo);
  const x = state.x;
  const v = state.v;
  state.x = (f * x + dt * v + hhoo * target) * detInv;
  state.v = (v + hoo * (target - x)) * detInv;
  return state.x;
}

export function springVec(pos, vel, target, omega, dt) {
  const f = 1 + 2 * omega * dt;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const detInv = 1 / (f + hhoo);
  pos.x = (f * pos.x + dt * vel.x + hhoo * target.x) * detInv;
  pos.y = (f * pos.y + dt * vel.y + hhoo * target.y) * detInv;
  pos.z = (f * pos.z + dt * vel.z + hhoo * target.z) * detInv;
  vel.x = (vel.x + hoo * (target.x - pos.x)) * detInv;
  vel.y = (vel.y + hoo * (target.y - pos.y)) * detInv;
  vel.z = (vel.z + hoo * (target.z - pos.z)) * detInv;
  return pos;
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
