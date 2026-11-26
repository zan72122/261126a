import { LAKE_WATER_Y } from '../core/env.js';
import { clamp } from '../core/math.js';
import { minTrackSplineDist } from '../world/layout.js';
import { heightAt } from '../world/terrain.js';

/**
 * Unified world physics & spatial collision solver:
 * - Static OBB2D colliders (chalets, barns, church, stations, walls, benches, fences)
 * - Static Cylinder colliders (trees, rocks, haystacks, piers, posts, boats)
 * - Walkable Deck surfaces (platforms, lake pier, footbridge, bridge/viaduct decks, summit terrace)
 * - Dynamic Locomotive OBB collider
 * - Smooth iterative sliding & buoyancy resolution (never launches or traps characters)
 */
export class PhysicsWorld {
  constructor() {
    this.obbs = [];
    this.cylinders = [];
    this.decks = [];
    this.locoOBB = null;
  }

  addOBB(x, z, yaw, w, d, minY, maxY, kind = 'solid') {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const hw = w * 0.5;
    const hd = d * 0.5;
    const boundR = Math.hypot(hw, hd);
    this.obbs.push({ x, z, cos, sin, hw, hd, minY, maxY, boundR, kind });
  }

  addCylinder(x, z, r, minY, maxY, kind = 'solid') {
    this.cylinders.push({ x, z, r, minY, maxY, kind });
  }

  addSegmentCollider(ax, az, bx, bz, halfThick, minY, maxY, kind = 'fence') {
    const cx = (ax + bx) * 0.5;
    const cz = (az + bz) * 0.5;
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-4) return;
    const yaw = Math.atan2(bx - ax, bz - az);
    this.addOBB(cx, cz, yaw, halfThick * 2, len + halfThick * 2, minY, maxY, kind);
  }

  addDeckOBB(x, z, yaw, w, d, topY, stepUp = 0.8) {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const hw = w * 0.5;
    const hd = d * 0.5;
    const boundR = Math.hypot(hw, hd);
    this.decks.push({ type: 'obb', x, z, cos, sin, hw, hd, topY, stepUp, boundR });
  }

  addDeckRampOBB(x, z, yaw, w, d, yStart, yEnd, stepUp = 0.8) {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const hw = w * 0.5;
    const hd = d * 0.5;
    const boundR = Math.hypot(hw, hd);
    this.decks.push({ type: 'ramp', x, z, cos, sin, hw, hd, yStart, yEnd, topY: Math.max(yStart, yEnd), stepUp, boundR });
  }

  addDeckCircle(x, z, r, topY, stepUp = 0.8) {
    this.decks.push({ type: 'circle', x, z, r, topY, stepUp, boundR: r });
  }

  setLocomotive(pos, yaw) {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    this.locoOBB = {
      x: pos.x,
      z: pos.z,
      cos,
      sin,
      hw: 0.96,
      hd: 2.82,
      minY: pos.y,
      maxY: pos.y + 2.75,
      boundR: Math.hypot(0.96, 2.82),
      kind: 'loco',
    };
  }

  deckHeightAt(x, z, refY = 0) {
    let best = -Infinity;
    for (let i = 0; i < this.decks.length; i++) {
      const dk = this.decks[i];
      if (Math.abs(x - dk.x) > dk.boundR || Math.abs(z - dk.z) > dk.boundR) continue;
      let y = -Infinity;
      if (dk.type === 'circle') {
        if (Math.hypot(x - dk.x, z - dk.z) <= dk.r) y = dk.topY;
      } else {
        const dx = x - dk.x;
        const dz = z - dk.z;
        const lx = dx * dk.cos - dz * dk.sin;
        const lz = dx * dk.sin + dz * dk.cos;
        if (Math.abs(lx) <= dk.hw && Math.abs(lz) <= dk.hd) {
          if (dk.type === 'ramp') {
            const t = clamp((lz + dk.hd) / Math.max(0.01, dk.hd * 2), 0, 1);
            y = dk.yStart + (dk.yEnd - dk.yStart) * t;
          } else {
            y = dk.topY;
          }
        }
      }
      if (y > -Infinity && refY >= y - dk.stepUp) {
        if (y > best) best = y;
      }
    }
    return best;
  }

  surfaceHeightAt(x, z, refY = 0) {
    const g = heightAt(x, z);
    const d = this.deckHeightAt(x, z, refY);
    return Math.max(g, d);
  }

  canPlaceCircle(x, z, r, { minRail = 4.6, checkWater = true, minGap = 0.55 } = {}) {
    if (minTrackSplineDist(x, z) < minRail + r * 0.35) return false;
    const y = heightAt(x, z);
    if (checkWater && y < LAKE_WATER_Y + 0.45) return false;

    for (let i = 0; i < this.obbs.length; i++) {
      const b = this.obbs[i];
      if (Math.abs(x - b.x) > b.boundR + r + minGap || Math.abs(z - b.z) > b.boundR + r + minGap) continue;
      const dx = x - b.x;
      const dz = z - b.z;
      const lx = dx * b.cos - dz * b.sin;
      const lz = dx * b.sin + dz * b.cos;
      const cx = clamp(lx, -b.hw, b.hw);
      const cz = clamp(lz, -b.hd, b.hd);
      if (Math.hypot(lx - cx, lz - cz) < r + minGap) return false;
    }

    for (let i = 0; i < this.cylinders.length; i++) {
      const c = this.cylinders[i];
      const minD = c.r + r + minGap;
      if (Math.hypot(x - c.x, z - c.z) < minD) return false;
    }
    return true;
  }

  _pushFromOBB(pos, vel, radius, height, b, isFloat) {
    if (pos.y + height <= b.minY || pos.y >= b.maxY) return false;
    const dx = pos.x - b.x;
    const dz = pos.z - b.z;
    if (dx * dx + dz * dz > (b.boundR + radius + 0.2) ** 2) return false;

    const lx = dx * b.cos - dz * b.sin;
    const lz = dx * b.sin + dz * b.cos;
    const cx = clamp(lx, -b.hw, b.hw);
    const cz = clamp(lz, -b.hd, b.hd);
    const dlx = lx - cx;
    const dlz = lz - cz;
    const dist = Math.hypot(dlx, dlz);

    if (dist >= radius + 0.01) return false;

    let nLocalX = 0;
    let nLocalZ = 0;
    let push = 0;

    if (dist > 1e-5) {
      nLocalX = dlx / dist;
      nLocalZ = dlz / dist;
      push = radius + 0.02 - dist;
    } else {
      const penX = b.hw - Math.abs(lx);
      const penZ = b.hd - Math.abs(lz);
      if (penX < penZ) {
        nLocalX = lx >= 0 ? 1 : -1;
        push = penX + radius + 0.02;
      } else {
        nLocalZ = lz >= 0 ? 1 : -1;
        push = penZ + radius + 0.02;
      }
    }

    const nx = nLocalX * b.cos + nLocalZ * b.sin;
    const nz = -nLocalX * b.sin + nLocalZ * b.cos;

    if (isFloat && pos.y > b.maxY - 0.55) {
      pos.y = b.maxY + 0.04;
      if (vel && vel.y < 0.25) vel.y = 0.25;
      return true;
    }

    pos.x += nx * push;
    pos.z += nz * push;
    if (vel) {
      const vn = vel.x * nx + vel.z * nz;
      if (vn < 0) {
        vel.x -= vn * nx;
        vel.z -= vn * nz;
      }
      if (isFloat && vel.y < 0.2) vel.y = Math.min(0.35, vel.y + 0.55);
    }
    return true;
  }

  _pushFromCylinder(pos, vel, radius, height, c, isFloat) {
    if (pos.y + height <= c.minY || pos.y >= c.maxY) return false;
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const minDist = c.r + radius;
    const dSq = dx * dx + dz * dz;
    if (dSq >= (minDist + 0.01) * (minDist + 0.01)) return false;

    const d = Math.sqrt(dSq);
    const nx = d > 1e-5 ? dx / d : 1;
    const nz = d > 1e-5 ? dz / d : 0;
    const push = minDist + 0.02 - d;

    if (isFloat && pos.y > c.maxY - 0.45) {
      pos.y = c.maxY + 0.04;
      if (vel && vel.y < 0.25) vel.y = 0.25;
      return true;
    }

    pos.x += nx * push;
    pos.z += nz * push;
    if (vel) {
      const vn = vel.x * nx + vel.z * nz;
      if (vn < 0) {
        vel.x -= vn * nx;
        vel.z -= vn * nz;
      }
      if (isFloat && vel.y < 0.2) vel.y = Math.min(0.35, vel.y + 0.45);
    }
    return true;
  }

  resolveActor(pos, vel = null, { radius = 0.34, height = 1.26, mode = 'walk', keepDry = true, ignoreLoco = false } = {}) {
    const isFloat = mode === 'float';
    const prevX = pos.x;
    const prevZ = pos.z;

    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      for (let i = 0; i < this.obbs.length; i++) {
        if (this._pushFromOBB(pos, vel, radius, height, this.obbs[i], isFloat)) moved = true;
      }
      if (!ignoreLoco && this.locoOBB) {
        if (this._pushFromOBB(pos, vel, radius, height, this.locoOBB, isFloat)) moved = true;
      }
      for (let i = 0; i < this.cylinders.length; i++) {
        if (this._pushFromCylinder(pos, vel, radius, height, this.cylinders[i], isFloat)) moved = true;
      }
      if (!moved) break;
    }

    // World bounds keep characters inside the playable alpine valley
    pos.x = clamp(pos.x, -155, 165);
    pos.z = clamp(pos.z, -412, 48);

    const deckY = this.deckHeightAt(pos.x, pos.z, pos.y);
    const groundY = heightAt(pos.x, pos.z);
    const floorY = Math.max(groundY, deckY);

    if (keepDry && !isFloat) {
      if (deckY === -Infinity && groundY < LAKE_WATER_Y + 0.08) {
        // Gentle shoreline slide / step-back so characters never sink into deep lake or river
        const eps = 0.7;
        const gx = heightAt(pos.x + eps, pos.z) - heightAt(pos.x - eps, pos.z);
        const gz = heightAt(pos.x, pos.z + eps) - heightAt(pos.x, pos.z - eps);
        const gLen = Math.hypot(gx, gz);
        if (gLen > 1e-4) {
          pos.x += (gx / gLen) * 0.45;
          pos.z += (gz / gLen) * 0.45;
        } else {
          pos.x = prevX;
          pos.z = prevZ;
        }
      }
      const nextFloor = this.surfaceHeightAt(pos.x, pos.z, pos.y);
      pos.y = Math.max(nextFloor, LAKE_WATER_Y + 0.02);
    } else if (isFloat) {
      if (deckY === -Infinity && groundY < LAKE_WATER_Y) {
        // Water buoyancy under umbrella descent + soft drift toward shore
        const waterSurface = LAKE_WATER_Y - 0.1;
        if (pos.y < waterSurface) {
          pos.y = waterSurface;
          if (vel && vel.y < 0) vel.y = 0;
        }
      } else if (pos.y < floorY) {
        pos.y = floorY;
      }
    } else {
      pos.y = Math.max(pos.y, floorY);
    }

    return floorY;
  }

  /**
   * Resolves 3D locomotive movement against terrain, walkable decks, lake surface,
   * viaduct undersides, buildings, trees, rocks, and bridge piers.
   */
  resolveLocomotive(pos, vel, yaw, { railSupportY = -Infinity } = {}) {
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    const locoR = 0.92;
    const locoH = 2.6;

    const offsets = [1.3, -1.2];
    const tmp = { x: 0, y: 0, z: 0 };

    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (let oi = 0; oi < offsets.length; oi++) {
        const off = offsets[oi];
        tmp.x = pos.x + fwdX * off;
        tmp.y = pos.y;
        tmp.z = pos.z + fwdZ * off;
        const bx = tmp.x;
        const bz = tmp.z;

        for (let i = 0; i < this.obbs.length; i++) {
          const b = this.obbs[i];
          if (b.kind === 'fence' && pos.y >= b.maxY - 0.15) continue;
          if (this._pushFromOBB(tmp, vel, locoR, locoH, b, false)) moved = true;
        }
        for (let i = 0; i < this.cylinders.length; i++) {
          if (this._pushFromCylinder(tmp, vel, locoR, locoH, this.cylinders[i], false)) moved = true;
        }

        pos.x += tmp.x - bx;
        pos.z += tmp.z - bz;
      }
      if (!moved) break;
    }

    pos.x = clamp(pos.x, -152, 162);
    pos.z = clamp(pos.z, -408, 42);

    // Prevent passing upward through elevated bridge/viaduct deck slabs from underneath
    for (let i = 0; i < this.decks.length; i++) {
      const dk = this.decks[i];
      if (dk.type === 'circle') continue;
      if (Math.abs(pos.x - dk.x) > dk.boundR + 1.2 || Math.abs(pos.z - dk.z) > dk.boundR + 1.2) continue;
      const dx = pos.x - dk.x;
      const dz = pos.z - dk.z;
      const lx = dx * dk.cos - dz * dk.sin;
      const lz = dx * dk.sin + dz * dk.cos;
      if (Math.abs(lx) <= dk.hw + 0.5 && Math.abs(lz) <= dk.hd + 0.5) {
        const dkY = dk.type === 'ramp'
          ? dk.yStart + (dk.yEnd - dk.yStart) * clamp((lz + dk.hd) / Math.max(0.01, dk.hd * 2), 0, 1)
          : dk.topY;
        if (pos.y < dkY - 0.85 && pos.y + locoH > dkY - 0.45) {
          pos.y = dkY - 0.45 - locoH;
          if (vel && vel.y > 0) vel.y = 0;
        }
      }
    }

    const fx = pos.x + fwdX * 1.6;
    const fz = pos.z + fwdZ * 1.6;
    const rx = pos.x - fwdX * 1.6;
    const rz = pos.z - fwdZ * 1.6;

    const surfAt = (px, pz) => {
      const g = heightAt(px, pz);
      const d = this.deckHeightAt(px, pz, pos.y + 0.5);
      const s = Math.max(g, d);
      return Math.max(s, LAKE_WATER_Y + 0.08);
    };

    const sC = surfAt(pos.x, pos.z);
    const sF = surfAt(fx, fz);
    const sR = surfAt(rx, rz);
    const supportY = Math.max(sC, (sF + sR) * 0.5, railSupportY);

    if (pos.y < supportY) {
      pos.y = supportY;
      if (vel && vel.y < 0) vel.y = 0;
    }
    pos.y = clamp(pos.y, LAKE_WATER_Y + 0.08, 118);

    const grounded = pos.y <= supportY + 0.18;
    const slopePitch = -Math.atan2(sF - sR, 3.2);
    return { supportY, grounded, slopePitch };
  }
}
