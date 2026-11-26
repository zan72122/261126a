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

// Merge multiple geometry/material parts into a single multi-material THREE.Mesh
// so composite props (windmill sails, clock tower bell, articulated arms) stay flat without nested Groups.
export function mergeColoredParts(parts) {
  let vertCount = 0;
  for (const p of parts) {
    vertCount += p.geo.attributes.position.count;
  }
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];
  const geo = new THREE.BufferGeometry();
  const materials = [];
  const matIdx = new Map();

  let vOff = 0;
  let iOff = 0;
  const mat4 = new THREE.Matrix4();
  const nMat = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  const t = new THREE.Vector3(0, 0, 0);

  for (const p of parts) {
    let mId = matIdx.get(p.mat);
    if (mId === undefined) {
      mId = materials.length;
      materials.push(p.mat);
      matIdx.set(p.mat, mId);
    }
    const g = p.geo;
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const uv = g.attributes.uv;
    if (p.matrix) {
      mat4.copy(p.matrix);
    } else {
      t.set(0, 0, 0);
      q.identity();
      s.set(1, 1, 1);
      if (p.pos) t.copy(p.pos);
      if (p.rot) q.setFromEuler(p.rot);
      if (p.scale) s.copy(p.scale);
      mat4.compose(t, q, s);
    }
    nMat.getNormalMatrix(mat4);

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mat4);
      positions[(vOff + i) * 3] = v.x;
      positions[(vOff + i) * 3 + 1] = v.y;
      positions[(vOff + i) * 3 + 2] = v.z;
      if (norm) {
        n.fromBufferAttribute(norm, i).applyMatrix3(nMat).normalize();
        normals[(vOff + i) * 3] = n.x;
        normals[(vOff + i) * 3 + 1] = n.y;
        normals[(vOff + i) * 3 + 2] = n.z;
      }
      if (uv) {
        uvs[(vOff + i) * 2] = uv.getX(i);
        uvs[(vOff + i) * 2 + 1] = uv.getY(i);
      }
    }

    const startIdx = iOff;
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        indices.push(vOff + g.index.getX(i));
      }
      iOff += g.index.count;
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(vOff + i);
      }
      iOff += pos.count;
    }
    geo.addGroup(startIdx, iOff - startIdx, mId);
    vOff += pos.count;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return new THREE.Mesh(geo, materials.length === 1 ? materials[0] : materials);
}
