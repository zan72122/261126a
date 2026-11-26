// Solid world collision volumes (oriented boxes, vertical cylinders, spheres)
// and gentle, non-trapping physical resolution for walker, dandelion float, and balloon.
import * as THREE from '../../lib/three.module.js';
import { clamp } from '../core/math.js';

export class ColliderWorld {
  constructor() {
    this.boxes = [];
    this.cylinders = [];
    this.spheres = [];
    this.treeClearanceCircles = [];
  }

  addBox({ cx, cz, w, d, rotY = 0, minY, maxY, kind = 'building', label = '' }) {
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const hx = w * 0.5;
    const hz = d * 0.5;
    this.boxes.push({ cx, cz, hx, hz, cos, sin, minY, maxY, kind, label });
    this.treeClearanceCircles.push({ x: cx, z: cz, r: Math.hypot(hx, hz) });
  }

  addCylinder({ x, z, r, minY, maxY, kind = 'prop', label = '', blockTrees = true }) {
    this.cylinders.push({ x, z, r, minY, maxY, kind, label });
    if (blockTrees) {
      this.treeClearanceCircles.push({ x, z, r });
    }
  }

  addSphere({ x, y, z, r, kind = 'canopy', label = '' }) {
    this.spheres.push({ x, y, z, r, kind, label });
  }

  // Push a vertical cylinder [pos.y, pos.y + height] of radius R out of an oriented box
  _pushCylinderOutOfBox(pos, r, minY, maxY, b, allowLift = false) {
    if (maxY <= b.minY + 0.01 || minY >= b.maxY - 0.01) return null;

    // Transform point into box local XZ (box rotated by rotY around Y: x' = x*cos - z*sin, z' = x*sin + z*cos)
    const dx = pos.x - b.cx;
    const dz = pos.z - b.cz;
    const lx = dx * b.cos - dz * b.sin;
    const lz = dx * b.sin + dz * b.cos;

    const clx = clamp(lx, -b.hx, b.hx);
    const clz = clamp(lz, -b.hz, b.hz);
    const ox = lx - clx;
    const oz = lz - clz;
    const distSq = ox * ox + oz * oz;

    if (distSq >= r * r) return null;

    let pushLX = 0;
    let pushLZ = 0;
    let pen = 0;

    if (distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      pen = r - dist;
      pushLX = (ox / dist) * pen;
      pushLZ = (oz / dist) * pen;
    } else {
      // Center is inside box: push out along nearest edge
      const penX = b.hx - Math.abs(lx) + r;
      const penZ = b.hz - Math.abs(lz) + r;
      if (penX < penZ) {
        pen = penX;
        pushLX = (lx >= 0 ? 1 : -1) * penX;
      } else {
        pen = penZ;
        pushLZ = (lz >= 0 ? 1 : -1) * penZ;
      }
    }

    // Rotate push back to world XZ
    const nx = pushLX * b.cos + pushLZ * b.sin;
    const nz = -pushLX * b.sin + pushLZ * b.cos;

    if (allowLift && minY > b.maxY - 1.35) {
      const lift = b.maxY - minY + 0.05;
      if (lift < pen * 1.4) {
        return { dx: nx * 0.35, dy: lift, dz: nz * 0.35, pen: lift };
      }
    }
    return { dx: nx, dy: 0, dz: nz, pen };
  }

  _pushCylinderOutOfCylinder(pos, r, minY, maxY, c, allowLift = false) {
    if (maxY <= c.minY + 0.01 || minY >= c.maxY - 0.01) return null;
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const distSq = dx * dx + dz * dz;
    const sumR = r + c.r;
    if (distSq >= sumR * sumR) return null;

    const dist = Math.sqrt(distSq);
    const pen = sumR - dist;
    const nx = dist > 1e-5 ? dx / dist : 1;
    const nz = dist > 1e-5 ? dz / dist : 0;

    if (allowLift && minY > c.maxY - 1.35) {
      const lift = c.maxY - minY + 0.05;
      if (lift < pen * 1.4) {
        return { dx: nx * pen * 0.35, dy: lift, dz: nz * pen * 0.35, pen: lift };
      }
    }
    return { dx: nx * pen, dy: 0, dz: nz * pen, pen };
  }

  _pushSphereOutOfBox(center, r, b, allowLift = true) {
    if (center.y + r <= b.minY + 0.01 || center.y - r >= b.maxY - 0.01) return null;
    const dx = center.x - b.cx;
    const dz = center.z - b.cz;
    const lx = dx * b.cos - dz * b.sin;
    const lz = dx * b.sin + dz * b.cos;

    const clx = clamp(lx, -b.hx, b.hx);
    const cly = clamp(center.y, b.minY, b.maxY);
    const clz = clamp(lz, -b.hz, b.hz);

    const ox = lx - clx;
    const oy = center.y - cly;
    const oz = lz - clz;
    const distSq = ox * ox + oy * oy + oz * oz;
    if (distSq >= r * r) return null;

    let pushLX = 0;
    let pushY = 0;
    let pushLZ = 0;
    let pen = 0;
    if (distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      pen = r - dist;
      pushLX = (ox / dist) * pen;
      pushY = (oy / dist) * pen;
      pushLZ = (oz / dist) * pen;
    } else {
      pen = r + 0.2;
      pushY = allowLift ? pen : 0;
      if (!allowLift) pushLX = pen;
    }

    const nx = pushLX * b.cos + pushLZ * b.sin;
    const nz = -pushLX * b.sin + pushLZ * b.cos;
    return { dx: nx, dy: allowLift ? Math.max(0, pushY) : pushY, dz: nz, pen };
  }

  _pushSphereOutOfCylinder(center, r, c, allowLift = true) {
    if (center.y + r <= c.minY + 0.01 || center.y - r >= c.maxY - 0.01) return null;
    const dx = center.x - c.x;
    const dz = center.z - c.z;
    const distXZ = Math.hypot(dx, dz);
    const clampedR = Math.min(distXZ, c.r);
    const scale = distXZ > 1e-6 ? clampedR / distXZ : 0;
    const cx = c.x + dx * scale;
    const cz = c.z + dz * scale;
    const cy = clamp(center.y, c.minY, c.maxY);

    const ox = center.x - cx;
    const oy = center.y - cy;
    const oz = center.z - cz;
    const distSq = ox * ox + oy * oy + oz * oz;
    if (distSq >= r * r) return null;

    if (distSq > 1e-8) {
      const dist = Math.sqrt(distSq);
      const pen = r - dist;
      return {
        dx: (ox / dist) * pen,
        dy: allowLift ? Math.max(0, (oy / dist) * pen) : (oy / dist) * pen,
        dz: (oz / dist) * pen,
        pen,
      };
    }
    const nx = distXZ > 1e-5 ? dx / distXZ : 1;
    const nz = distXZ > 1e-5 ? dz / distXZ : 0;
    const pen = c.r + r - distXZ;
    return { dx: nx * pen, dy: allowLift ? r * 0.45 : 0, dz: nz * pen, pen };
  }

  _pushSphereOutOfSphere(center, r, s, allowLift = true) {
    const dx = center.x - s.x;
    const dy = center.y - s.y;
    const dz = center.z - s.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const sumR = r + s.r;
    if (distSq >= sumR * sumR) return null;

    const dist = Math.sqrt(distSq);
    const pen = sumR - dist;
    if (dist > 1e-5) {
      return {
        dx: (dx / dist) * pen,
        dy: allowLift ? Math.max(0, (dy / dist) * pen) : (dy / dist) * pen,
        dz: (dz / dist) * pen,
        pen,
      };
    }
    return { dx: pen, dy: allowLift ? pen * 0.5 : 0, dz: 0, pen };
  }

  // Smooth ground walker resolution (girl on foot)
  resolveWalker(pos, {
    radius = 0.36,
    height = 1.32,
    terrainHeight,
    isOverRiver,
    riverCenterZ,
    riverHalfWidth,
    isOnDeck,
    waterY,
  }) {
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      const minY = pos.y + 0.08;
      const maxY = pos.y + height;

      for (const b of this.boxes) {
        const res = this._pushCylinderOutOfBox(pos, radius, minY, maxY, b, false);
        if (res) {
          pos.x += res.dx;
          pos.z += res.dz;
          moved = true;
        }
      }
      for (const c of this.cylinders) {
        const res = this._pushCylinderOutOfCylinder(pos, radius, minY, maxY, c, false);
        if (res) {
          pos.x += res.dx;
          pos.z += res.dz;
          moved = true;
        }
      }

      if (isOverRiver(pos.x, pos.z) && !isOnDeck(pos.x, pos.z)) {
        const rz = riverCenterZ(pos.x);
        const rw = riverHalfWidth(pos.x) + 0.9;
        pos.z = pos.z < rz ? rz - rw : rz + rw;
        moved = true;
      }

      if (!moved) break;
    }

    pos.x = clamp(pos.x, -210, 210);
    pos.z = clamp(pos.z, -385, 65);
    pos.y = Math.max(waterY + 0.05, terrainHeight(pos.x, pos.z));
    return pos;
  }

  // Gentle dandelion parachute descent collision
  resolveFloatGirl(pos, vel, {
    radius = 0.48,
    height = 2.0,
    terrainHeight,
    isOverRiver,
    riverCenterZ,
    riverHalfWidth,
    isOnDeck,
    waterY,
    dt,
  }) {
    for (let iter = 0; iter < 3; iter++) {
      const minY = pos.y + 0.05;
      const maxY = pos.y + height;
      for (const b of this.boxes) {
        const res = this._pushCylinderOutOfBox(pos, radius, minY, maxY, b, true);
        if (res) {
          pos.x += res.dx;
          pos.y += res.dy;
          pos.z += res.dz;
        }
      }
      for (const c of this.cylinders) {
        const res = this._pushCylinderOutOfCylinder(pos, radius, minY, maxY, c, true);
        if (res) {
          pos.x += res.dx;
          pos.y += res.dy;
          pos.z += res.dz;
        }
      }
      const center = new THREE.Vector3(pos.x, pos.y + 1.1, pos.z);
      for (const s of this.spheres) {
        const res = this._pushSphereOutOfSphere(center, radius, s, true);
        if (res) {
          pos.x += res.dx;
          pos.y += res.dy;
          pos.z += res.dz;
          center.set(pos.x, pos.y + 1.1, pos.z);
        }
      }
    }

    if (isOverRiver(pos.x, pos.z) && !isOnDeck(pos.x, pos.z) && pos.y < waterY + 4.5) {
      const rz = riverCenterZ(pos.x);
      const rw = riverHalfWidth(pos.x) + 1.1;
      const targetZ = pos.z < rz ? rz - rw : rz + rw;
      pos.z += clamp(targetZ - pos.z, -5.0 * dt, 5.0 * dt);
    }

    const gY = Math.max(waterY + 0.08, terrainHeight(pos.x, pos.z));
    if (pos.y < gY) {
      pos.y = gY;
      if (vel && vel.y < 0) vel.y = 0;
    }
    return pos;
  }

  // Hot Air Balloon full-envelope + basket collision & gentle buoyant deflection
  resolveBalloon(pos, vel, {
    inFlight = true,
    terrainHeight,
    isOverRiver,
    isOnDeck,
    waterY,
  }) {
    let lifted = 0;
    const center = new THREE.Vector3();
    const volumes = [
      { type: 'cyl', r: 1.02, minOff: 0.04, maxOff: 2.35 },
      { type: 'sph', r: 2.35, yOff: 4.55 },
      { type: 'sph', r: 2.02, yOff: 6.15 },
    ];

    for (let iter = 0; iter < 3; iter++) {
      let hit = false;
      for (const vol of volumes) {
        if (vol.type === 'cyl') {
          const minY = pos.y + vol.minOff;
          const maxY = pos.y + vol.maxOff;
          for (const b of this.boxes) {
            const res = this._pushCylinderOutOfBox(pos, vol.r, minY, maxY, b, inFlight);
            if (res) {
              pos.x += res.dx;
              pos.y += res.dy;
              pos.z += res.dz;
              if (inFlight && res.dy === 0) {
                const liftStep = Math.min(0.35, res.pen * 0.25);
                pos.y += liftStep;
                lifted += liftStep;
              } else {
                lifted += res.dy;
              }
              hit = true;
            }
          }
          for (const c of this.cylinders) {
            const res = this._pushCylinderOutOfCylinder(pos, vol.r, minY, maxY, c, inFlight);
            if (res) {
              pos.x += res.dx;
              pos.y += res.dy;
              pos.z += res.dz;
              if (inFlight && res.dy === 0) {
                const liftStep = Math.min(0.35, res.pen * 0.25);
                pos.y += liftStep;
                lifted += liftStep;
              } else {
                lifted += res.dy;
              }
              hit = true;
            }
          }
          center.set(pos.x, pos.y + 1.0, pos.z);
          for (const s of this.spheres) {
            const res = this._pushSphereOutOfSphere(center, vol.r, s, inFlight);
            if (res) {
              pos.x += res.dx;
              pos.y += res.dy;
              pos.z += res.dz;
              lifted += res.dy;
              center.set(pos.x, pos.y + 1.0, pos.z);
              hit = true;
            }
          }
        } else {
          center.set(pos.x, pos.y + vol.yOff, pos.z);
          for (const b of this.boxes) {
            const res = this._pushSphereOutOfBox(center, vol.r, b, inFlight);
            if (res) {
              pos.x += res.dx;
              pos.y += res.dy;
              pos.z += res.dz;
              lifted += res.dy;
              center.set(pos.x, pos.y + vol.yOff, pos.z);
              hit = true;
            }
          }
          for (const c of this.cylinders) {
            const res = this._pushSphereOutOfCylinder(center, vol.r, c, inFlight);
            if (res) {
              pos.x += res.dx;
              pos.y += res.dy;
              pos.z += res.dz;
              lifted += res.dy;
              center.set(pos.x, pos.y + vol.yOff, pos.z);
              hit = true;
            }
          }
          for (const s of this.spheres) {
            const res = this._pushSphereOutOfSphere(center, vol.r, s, inFlight);
            if (res) {
              pos.x += res.dx;
              pos.y += res.dy;
              pos.z += res.dz;
              lifted += res.dy;
              center.set(pos.x, pos.y + vol.yOff, pos.z);
              hit = true;
            }
          }
        }
      }
      if (!hit) break;
    }

    // Terrain heightfield collision across basket footprint (never sink into hillsides or water)
    let groundMax = terrainHeight(pos.x, pos.z);
    for (const [ox, oz] of [[0.92, 0], [-0.92, 0], [0, 0.92], [0, -0.92]]) {
      const gh = terrainHeight(pos.x + ox, pos.z + oz);
      if (gh > groundMax) groundMax = gh;
    }
    if (isOverRiver(pos.x, pos.z) && !isOnDeck(pos.x, pos.z)) {
      groundMax = Math.max(groundMax, waterY + 0.14);
    }

    if (pos.y < groundMax) {
      lifted += groundMax - pos.y;
      pos.y = groundMax;
      if (vel && vel.y < 0) vel.y = 0;
    }

    pos.x = clamp(pos.x, -210, 210);
    pos.z = clamp(pos.z, -385, 65);
    return lifted;
  }
}
