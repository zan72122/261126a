import * as THREE from '../../lib/three.module.js';
import { ISLANDS, PAVILION_POS, REEFS, WELCOMER_POS } from '../core/env.js';
import { clamp, wrapAngle } from '../core/math.js';
import { getGroundY, getLandInfo, HARBOR_DECKS, PAVILION_JETTY, PAVILION_TERRACE } from './terrain.js';
import { getSeaWaveHeight } from './sea.js';

// Unified world collision & obstacle registry for static placement checks and smooth dynamic physics.
const obstacles = [];
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

export function resetObstacles() {
  obstacles.length = 0;
}

/** Register an axis-aligned or Y-rotated solid box collider. */
export function addBoxObstacle(x, z, w, d, ry = 0, minY = 0, maxY = 5, tag = 'prop', boatSolid = false) {
  obstacles.push({
    kind: 'box',
    x,
    z,
    hx: w * 0.5,
    hz: d * 0.5,
    cos: Math.cos(-ry),
    sin: Math.sin(-ry),
    cosW: Math.cos(ry),
    sinW: Math.sin(ry),
    minY,
    maxY,
    tag,
    boatSolid,
  });
}

/** Register a vertical cylinder/circle solid collider. */
export function addCircleObstacle(x, z, r, minY = 0, maxY = 5, tag = 'prop', boatSolid = false) {
  obstacles.push({
    kind: 'circle',
    x,
    z,
    r,
    minY,
    maxY,
    tag,
    boatSolid,
  });
}

/** Register a Three.js object's tight world-space bounding box as a solid obstacle. */
export function addObjectObstacle(obj, tag = 'prop', pad = 0.04, boatSolid = false) {
  obj.updateMatrixWorld(true);
  _box.setFromObject(obj);
  if (_box.isEmpty()) return;
  _box.getCenter(_center);
  _box.getSize(_size);
  addBoxObstacle(
    _center.x,
    _center.z,
    _size.x + pad * 2,
    _size.z + pad * 2,
    0,
    _box.min.y,
    _box.max.y,
    tag,
    boatSolid
  );
}

/** Check if a horizontal circle overlaps any registered obstacle (used by foliage scatter). */
export function isSpotClear(x, z, r = 0.45, ignoreTags = null) {
  for (const ob of obstacles) {
    if (ignoreTags && ignoreTags.has(ob.tag)) continue;
    if (ob.kind === 'circle') {
      const dx = x - ob.x;
      const dz = z - ob.z;
      const lim = ob.r + r;
      if (dx * dx + dz * dz < lim * lim) return false;
    } else {
      const dx = x - ob.x;
      const dz = z - ob.z;
      const lx = dx * ob.cos - dz * ob.sin;
      const lz = dx * ob.sin + dz * ob.cos;
      const cx = clamp(lx, -ob.hx, ob.hx);
      const cz = clamp(lz, -ob.hz, ob.hz);
      const ddx = lx - cx;
      const ddz = lz - cz;
      if (ddx * ddx + ddz * ddz < r * r) return false;
    }
  }
  return true;
}

function pushCircleOutOfBox(px, pz, r, ob) {
  const dx = px - ob.x;
  const dz = pz - ob.z;
  const lx = dx * ob.cos - dz * ob.sin;
  const lz = dx * ob.sin + dz * ob.cos;

  const cx = clamp(lx, -ob.hx, ob.hx);
  const cz = clamp(lz, -ob.hz, ob.hz);
  const offX = lx - cx;
  const offZ = lz - cz;
  const distSq = offX * offX + offZ * offZ;

  if (distSq >= r * r) return null;

  let pushLx = 0;
  let pushLz = 0;
  let normLx = 0;
  let normLz = 0;

  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    const pen = r - dist;
    normLx = offX / dist;
    normLz = offZ / dist;
    pushLx = normLx * pen;
    pushLz = normLz * pen;
  } else {
    // Center is inside the box; push out along shortest axis
    const penX = ob.hx - Math.abs(lx) + r;
    const penZ = ob.hz - Math.abs(lz) + r;
    if (penX < penZ) {
      normLx = lx >= 0 ? 1 : -1;
      pushLx = normLx * penX;
    } else {
      normLz = lz >= 0 ? 1 : -1;
      pushLz = normLz * penZ;
    }
  }

  const pushWx = pushLx * ob.cosW - pushLz * ob.sinW;
  const pushWz = pushLx * ob.sinW + pushLz * ob.cosW;
  const normWx = normLx * ob.cosW - normLz * ob.sinW;
  const normWz = normLx * ob.sinW + normLz * ob.cosW;
  return { dx: pushWx, dz: pushWz, nx: normWx, nz: normWz };
}

function pushCircleOutOfCircle(px, pz, r, ox, oz, or) {
  const dx = px - ox;
  const dz = pz - oz;
  const dSq = dx * dx + dz * dz;
  const minD = r + or;
  if (dSq >= minD * minD) return null;
  const d = Math.sqrt(dSq);
  const nx = d > 1e-5 ? dx / d : 0;
  const nz = d > 1e-5 ? dz / d : 1;
  const pen = minD - d;
  return { dx: nx * pen, dz: nz * pen, nx, nz };
}

/** Resolve a moving circle against registered obstacles whose vertical span overlaps [yMin, yMax]. */
export function resolveCircleObstacles(x, z, r, yMin, yMax, { boatOnly = false, ignoreTags = null } = {}) {
  let px = x;
  let pz = z;
  let hit = false;
  let lastNx = 0;
  let lastNz = 0;

  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    for (const ob of obstacles) {
      if (boatOnly && !ob.boatSolid) continue;
      if (ignoreTags && ignoreTags.has(ob.tag)) continue;
      if (ob.maxY <= yMin || ob.minY >= yMax) continue;

      const res = ob.kind === 'circle'
        ? pushCircleOutOfCircle(px, pz, r, ob.x, ob.z, ob.r)
        : pushCircleOutOfBox(px, pz, r, ob);
      if (res) {
        px += res.dx;
        pz += res.dz;
        lastNx = res.nx;
        lastNz = res.nz;
        hit = true;
        moved = true;
      }
    }
    if (!moved) break;
  }

  return { x: px, z: pz, hit, nx: lastNx, nz: lastNz };
}

// Compute terrain height downhill gradient when pushing boat/character out of steep shore.
function terrainGrad(x, z) {
  const e = 0.45;
  const hx = getGroundY(x + e, z) - getGroundY(x - e, z);
  const hz = getGroundY(x, z + e) - getGroundY(x, z - e);
  const len = Math.hypot(hx, hz);
  if (len < 1e-4) return { gx: 0, gz: 0 };
  return { gx: hx / len, gz: hz / len };
}

/**
 * Resolve sailboat hull collisions against harbor structures, piers, islands, reefs, and pavilion.
 * Computes realistic waterline wave elevation, wave pitch/roll, and smooth tangential slide.
 */
export function resolveBoatPhysics(boat, dt, t, steerX = 0) {
  const hullOffsets = [-2.05, 0.0, 2.05];
  const hullR = 1.15;
  const ignoreBoat = new Set(['plaza', 'stair', 'curb', 'flagstone', 'foliage']);

  let hitNormalX = 0;
  let hitNormalZ = 0;
  let collided = false;

  for (let iter = 0; iter < 3; iter++) {
    const sy = Math.sin(boat.yaw);
    const cy = Math.cos(boat.yaw);
    let anyMoved = false;

    for (const off of hullOffsets) {
      const cx = boat.pos.x + sy * off;
      const cz = boat.pos.z + cy * off;

      // 1. Registered solid marine obstacles (quay, wings, jetty, breakwater, island piers, fishing boats)
      const res = resolveCircleObstacles(cx, cz, hullR, -0.5, 2.5, { boatOnly: true, ignoreTags: ignoreBoat });
      if (res.hit) {
        boat.pos.x += res.x - cx;
        boat.pos.z += res.z - cz;
        hitNormalX = res.nx;
        hitNormalZ = res.nz;
        collided = true;
        anyMoved = true;
      }

      // 2. Harbor quay & wing solid footplates (prevent hull ever entering quay/wings)
      const cxNow = boat.pos.x + sy * off;
      const czNow = boat.pos.z + cy * off;
      for (const dk of HARBOR_DECKS) {
        const boxRes = pushCircleOutOfBox(cxNow, czNow, hullR, {
          x: dk.x,
          z: dk.z,
          hx: dk.w * 0.5,
          hz: dk.d * 0.5,
          cos: 1,
          sin: 0,
          cosW: 1,
          sinW: 0,
        });
        if (boxRes) {
          boat.pos.x += boxRes.dx;
          boat.pos.z += boxRes.dz;
          hitNormalX = boxRes.nx;
          hitNormalZ = boxRes.nz;
          collided = true;
          anyMoved = true;
        }
      }

      // 3. Pavilion terrace & landing jetty
      const pCx = boat.pos.x + sy * off;
      const pCz = boat.pos.z + cy * off;
      const pavTerr = pushCircleOutOfCircle(
        pCx,
        pCz,
        hullR,
        PAVILION_TERRACE.x,
        PAVILION_TERRACE.z,
        PAVILION_TERRACE.r + 0.15
      );
      if (pavTerr) {
        boat.pos.x += pavTerr.dx;
        boat.pos.z += pavTerr.dz;
        hitNormalX = pavTerr.nx;
        hitNormalZ = pavTerr.nz;
        collided = true;
        anyMoved = true;
      }
      const pavJetty = pushCircleOutOfBox(pCx, pCz, hullR, {
        x: PAVILION_JETTY.x,
        z: PAVILION_JETTY.z,
        hx: PAVILION_JETTY.w * 0.5,
        hz: PAVILION_JETTY.d * 0.5,
        cos: 1,
        sin: 0,
        cosW: 1,
        sinW: 0,
      });
      if (pavJetty) {
        boat.pos.x += pavJetty.dx;
        boat.pos.z += pavJetty.dz;
        hitNormalX = pavJetty.nx;
        hitNormalZ = pavJetty.nz;
        collided = true;
        anyMoved = true;
      }

      // 4. Sea reefs
      for (const rf of REEFS) {
        const rfRes = pushCircleOutOfCircle(
          boat.pos.x + sy * off,
          boat.pos.z + cy * off,
          hullR,
          rf.x,
          rf.z,
          rf.r + 0.45
        );
        if (rfRes) {
          boat.pos.x += rfRes.dx;
          boat.pos.z += rfRes.dz;
          hitNormalX = rfRes.nx;
          hitNormalZ = rfRes.nz;
          collided = true;
          anyMoved = true;
        }
      }

      // 5. Island & coastal terrain heightfield shoreline (y > -0.22)
      const sxNow = boat.pos.x + sy * off;
      const szNow = boat.pos.z + cy * off;
      const info = getLandInfo(sxNow, szNow);
      if (info.y > -0.22) {
        const g = terrainGrad(sxNow, szNow);
        let nx = -g.gx;
        let nz = -g.gz;
        if (Math.hypot(nx, nz) < 0.1) {
          // Fallback away from nearest island/harbor/pavilion center
          if (szNow < -100) {
            nx = 0;
            nz = 1;
          } else if (szNow > 165) {
            nx = sxNow >= 0 ? 0.3 : -0.3;
            nz = -0.95;
          } else {
            let bestIsl = ISLANDS[0];
            let bestD = Infinity;
            for (const isl of ISLANDS) {
              const d = Math.hypot(sxNow - isl.center.x, szNow - isl.center.z);
              if (d < bestD) {
                bestD = d;
                bestIsl = isl;
              }
            }
            const d = Math.max(0.1, bestD);
            nx = (sxNow - bestIsl.center.x) / d;
            nz = (szNow - bestIsl.center.z) / d;
          }
        }
        const pushAmt = clamp((info.y + 0.25) * 0.85, 0.25, 1.45);
        boat.pos.x += nx * pushAmt;
        boat.pos.z += nz * pushAmt;
        hitNormalX = nx;
        hitNormalZ = nz;
        collided = true;
        anyMoved = true;
      }
    }

    if (!anyMoved) break;
  }

  // Smooth tangential deflection when sailing into an obstacle
  if (collided && boat.speed > 0.3 && Math.hypot(hitNormalX, hitNormalZ) > 0.1) {
    const vx = Math.sin(boat.yaw);
    const vz = Math.cos(boat.yaw);
    const into = vx * hitNormalX + vz * hitNormalZ;
    if (into < -0.05) {
      // Slide heading smoothly along tangent without violent bounce
      const tx = vx - into * hitNormalX;
      const tz = vz - into * hitNormalZ;
      if (Math.hypot(tx, tz) > 0.05) {
        const tangYaw = Math.atan2(tx, tz);
        boat.yaw = wrapAngle(boat.yaw + wrapAngle(tangYaw - boat.yaw) * Math.min(1, dt * 3.8));
      }
      boat.speed *= 1 - Math.min(0.45, -into * 0.45);
    }
  }

  // Buoyancy on sea wave surface; never sink below local ground height
  const waveY = getSeaWaveHeight(boat.pos.x, boat.pos.z, t);
  const groundY = getGroundY(boat.pos.x, boat.pos.z);
  boat.pos.y = groundY > -0.32 ? Math.max(waveY, groundY + 0.32) : waveY;

  // Physical wave pitch and roll from 4 hull waterline samples
  const sy = Math.sin(boat.yaw);
  const cy = Math.cos(boat.yaw);
  const hBow = getSeaWaveHeight(boat.pos.x + sy * 2.2, boat.pos.z + cy * 2.2, t);
  const hStern = getSeaWaveHeight(boat.pos.x - sy * 2.2, boat.pos.z - cy * 2.2, t);
  const hStbd = getSeaWaveHeight(boat.pos.x - cy * 0.85, boat.pos.z + sy * 0.85, t);
  const hPort = getSeaWaveHeight(boat.pos.x + cy * 0.85, boat.pos.z - sy * 0.85, t);
  boat.wavePitch = clamp((hStern - hBow) / 4.4, -0.14, 0.14);
  boat.waveRoll = clamp((hPort - hStbd) / 1.7, -0.16, 0.16) - steerX * 0.12;
}

const GIRL_IGNORED_SOLID = new Set(['deck', 'flagstone', 'stair', 'foliage']);

/**
 * Resolve girl collisions against buildings, props, trees, welcomer, boat, and terrain boundaries.
 * Ensures smooth wall sliding, walkable shoreline containment, and exact ground seating.
 */
export function resolveGirlPhysics(girl, mode, boat = null, allowBoard = false) {
  const r = 0.30;
  const y0 = girl.pos.y;
  const y1 = y0 + 1.42;

  if (mode === 'float') {
    const res = resolveCircleObstacles(girl.pos.x, girl.pos.z, r, y0, y1, { ignoreTags: GIRL_IGNORED_SOLID });
    girl.pos.x = res.x;
    girl.pos.z = res.z;
    const gy = getGroundY(girl.pos.x, girl.pos.z);
    if (girl.pos.y < gy + 0.25) {
      girl.pos.y = gy + 0.25;
    }
    return;
  }

  // Grounded modes: harbor, board (walkJetty), walk, stars (stepAshore / reunion)
  const ignore = new Set(GIRL_IGNORED_SOLID);
  if (allowBoard) ignore.add('curb');

  const res = resolveCircleObstacles(girl.pos.x, girl.pos.z, r, y0 + 0.08, y1, { ignoreTags: ignore });
  girl.pos.x = res.x;
  girl.pos.z = res.z;

  // Welcomer solid body avoidance
  if (mode === 'stars') {
    const wr = pushCircleOutOfCircle(girl.pos.x, girl.pos.z, r, WELCOMER_POS.x, WELCOMER_POS.z, 0.36);
    if (wr) {
      girl.pos.x += wr.dx;
      girl.pos.z += wr.dz;
    }
  }

  // Sailboat hull avoidance when walking beside it (not while stepping aboard)
  if (boat && !allowBoard) {
    const sy = Math.sin(boat.yaw);
    const cy = Math.cos(boat.yaw);
    for (const off of [-1.6, 0, 1.6]) {
      const br = pushCircleOutOfCircle(
        girl.pos.x,
        girl.pos.z,
        r,
        boat.pos.x + sy * off,
        boat.pos.z + cy * off,
        1.0
      );
      if (br) {
        girl.pos.x += br.dx;
        girl.pos.z += br.dz;
      }
    }
  }

  // Walkable ground containment (keep feet on land/deck/jetty, never fall into deep sea)
  if (!allowBoard) {
    const minWalkY = mode === 'walk' ? 0.22 : 0.45;
    for (let step = 0; step < 3; step++) {
      const info = getLandInfo(girl.pos.x, girl.pos.z);
      if (info.y >= minWalkY) break;
      const g = terrainGrad(girl.pos.x, girl.pos.z);
      if (Math.hypot(g.gx, g.gz) > 0.05) {
        girl.pos.x += g.gx * 0.45;
        girl.pos.z += g.gz * 0.45;
      } else {
        // Fallback toward harbor plaza / pavilion terrace
        if (girl.pos.z < -80) {
          girl.pos.z -= 0.4;
        } else if (girl.pos.z > 160) {
          girl.pos.x += (0 - girl.pos.x) * 0.2;
          girl.pos.z += (185 - girl.pos.z) * 0.2;
        }
      }
    }
    girl.pos.y = getGroundY(girl.pos.x, girl.pos.z);
  } else {
    const gy = getGroundY(girl.pos.x, girl.pos.z);
    if (girl.pos.y < gy) girl.pos.y = gy;
  }
}
