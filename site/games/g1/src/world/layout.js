import {
  BOARD_POS,
  BRIDGE_POS,
  HOME_CHALET_POS,
  LAKE_PIER_POS,
  LAKE_POS,
  LOOKOUT_POS,
  SIDETRACK_POS,
  SUMMIT_POS,
  VILLAGE_POS,
} from '../core/env.js';
import { clamp } from '../core/math.js';
import { buildTrackCurves } from './trackData.js';

function distToSeg2D(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  const t = lenSq > 1e-5 ? clamp((wx * vx + wz * vz) / lenSq, 0, 1) : 0;
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

const CURVES = buildTrackCurves();
export const TRACK_POLYLINES = {};
const ALL_POLY_SPANS = [];

for (const [id, seg] of Object.entries(CURVES)) {
  const steps = Math.max(20, Math.round(seg.length / 2.2));
  const pts = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const p = seg.curve.getPointAt(u);
    pts.push({ x: p.x, y: p.y, z: p.z, u });
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const spans = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const isBridge =
      (seg.elevatedFrom !== undefined && a.u >= seg.elevatedFrom && b.u <= seg.elevatedTo) ||
      id === 'seg5_viaduct';
    const span = { ax: a.x, ay: a.y, az: a.z, au: a.u, bx: b.x, by: b.y, bz: b.z, bu: b.u, isBridge };
    spans.push(span);
    ALL_POLY_SPANS.push(span);
  }
  TRACK_POLYLINES[id] = { id, pts, spans, minX, maxX, minZ, maxZ };
}

export function minTrackSplineDist(x, z) {
  let best = Infinity;
  for (const poly of Object.values(TRACK_POLYLINES)) {
    if (x < poly.minX - 10 || x > poly.maxX + 10 || z < poly.minZ - 10 || z > poly.maxZ + 10) {
      continue;
    }
    for (let i = 0; i < poly.spans.length; i++) {
      const s = poly.spans[i];
      const d = distToSeg2D(x, z, s.ax, s.az, s.bx, s.bz);
      if (d < best) best = d;
    }
  }
  if (best === Infinity) {
    for (let i = 0; i < ALL_POLY_SPANS.length; i++) {
      const s = ALL_POLY_SPANS[i];
      const d = distToSeg2D(x, z, s.ax, s.az, s.bx, s.bz);
      if (d < best) best = d;
    }
  }
  return best;
}

// Single source of truth for architectural sites (clear of track splines, river/brook/lake, and each other)
export const CHALET_SITES = [
  // Home & neighboring garden chalets
  { x: HOME_CHALET_POS.x, z: HOME_CHALET_POS.z, ry: 0.65, w: 6.2, d: 5.0, hBase: 1.65, hUpper: 2.0, pitch: 1.9, sh: 'cobalt', bal: true, slate: false, isHome: true },
  { x: -16.5, z: -17.0, ry: 0.25, w: 5.2, d: 4.2, pitch: 1.6, sh: 'mustard', bal: true, slate: true },
  { x: -19.0, z: 14.0, ry: 1.15, w: 4.8, d: 4.0, pitch: 1.5, sh: 'cobalt', bal: false, slate: false },
  { x: 17.5, z: 10.5, ry: -0.95, w: 5.4, d: 4.4, pitch: 1.75, sh: 'cobalt', bal: true, slate: true },

  // Village chalets (clear of river bank and village church)
  { x: 43.0, z: -52.0, ry: -1.2, w: 5.8, d: 4.8, sh: 'cobalt', bal: true, slate: true },
  { x: 46.0, z: -66.0, ry: -1.7, w: 5.0, d: 4.2, sh: 'mustard', bal: true, slate: false },
  { x: -3.0, z: -54.0, ry: 0.9, w: 5.4, d: 4.4, sh: 'cobalt', bal: true, slate: true },
  { x: -9.0, z: -68.0, ry: 0.5, w: 4.8, d: 4.0, sh: 'mustard', bal: true, slate: false },
  { x: 60.0, z: -84.0, ry: -2.1, w: 5.2, d: 4.2, sh: 'cobalt', bal: true, slate: true },

  // Trackside valley chalets (dry banks, well clear of tracks & river/brook)
  { x: 6.0, z: -26.0, ry: 0.45, w: 4.8, d: 4.0, sh: 'mustard', bal: true, slate: true },
  { x: 54.0, z: -18.0, ry: -1.1, w: 5.2, d: 4.2, sh: 'cobalt', bal: true, slate: false },
  { x: -18.0, z: -82.0, ry: 0.7, w: 5.0, d: 4.2, sh: 'cobalt', bal: true, slate: true },
  { x: 57.0, z: -94.0, ry: -1.5, w: 5.2, d: 4.2, sh: 'mustard', bal: true, slate: false },
  { x: -52.0, z: -132.0, ry: 0.85, w: 5.0, d: 4.0, sh: 'mustard', bal: false, slate: true },
  { x: 35.0, z: -160.0, ry: -1.2, w: 4.8, d: 3.8, sh: 'cobalt', bal: true, slate: false },
  { x: -16.0, z: -195.0, ry: -0.9, w: 4.8, d: 4.0, sh: 'mustard', bal: true, slate: true },
  { x: 24.0, z: -128.0, ry: 0.35, w: 5.0, d: 4.2, sh: 'cobalt', bal: false, slate: false },

  // Climbing slope terraced chalets
  { x: -27.0, z: -234.0, ry: 0.4, w: 4.8, d: 4.0, sh: 'mustard', bal: true, slate: true },
  { x: -3.0, z: -252.0, ry: 0.5, w: 5.0, d: 4.0, sh: 'cobalt', bal: true, slate: false },
  { x: 16.0, z: -266.0, ry: 0.85, w: 4.6, d: 3.8, sh: 'mustard', bal: false, slate: true },
  { x: 48.0, z: -255.0, ry: -0.8, w: 5.0, d: 4.0, sh: 'mustard', bal: true, slate: true },
  { x: 66.0, z: -264.0, ry: -1.2, w: 4.8, d: 4.0, sh: 'cobalt', bal: true, slate: false },
  { x: 29.0, z: -292.0, ry: 0.65, w: 5.0, d: 4.0, sh: 'cobalt', bal: true, slate: true },
  { x: 65.0, z: -306.0, ry: -0.9, w: 4.6, d: 3.8, sh: 'mustard', bal: true, slate: false },
  { x: 24.0, z: -322.0, ry: 0.55, w: 4.8, d: 4.0, sh: 'mustard', bal: true, slate: true },
];

export const SHED_SITE = { x: -16.2, z: -3.2, ry: 0.4, w: 3.6, d: 3.0 };
export const CHURCH_SITE = { x: 46.0, z: -80.0, ry: -0.35, w: 5.4, d: 10.2 };

export const BARN_SITES = [
  { x: 8.0, z: -38.0, ry: 0.2 },
  { x: 54.0, z: -48.0, ry: -0.9 },
  { x: 24.0, z: -140.0, ry: 0.6 },
  { x: 62.0, z: -130.0, ry: -0.5 },
  { x: -24.0, z: -152.0, ry: 0.3 },
  { x: -12.0, z: -178.0, ry: -0.7 },
  { x: 15.0, z: -230.0, ry: 0.8 },
  { x: -13.0, z: -246.0, ry: 0.45 },
  { x: 35.0, z: -236.0, ry: -0.6 },
  { x: 78.0, z: -268.0, ry: -0.4 },
  { x: 34.0, z: -306.0, ry: 0.35 },
  { x: 96.0, z: -312.0, ry: -0.8 },
];

export const HAY_SITES = [
  [12.0, -32.0, 1.0],
  [16.0, -37.0, 0.85],
  [60.0, -49.0, 1.1],
  [-12.0, -73.0, 0.95],
  [-10.0, -79.0, 1.05],
  [31.0, -115.0, 0.9],
  [-42.0, -112.0, 1.0],
  [-46.0, -118.0, 0.85],
  [22.0, -158.0, 1.1],
  [-18.0, -206.0, 0.9],
  [18.0, -238.0, 0.95],
  [-8.0, -230.0, 0.9],
  [24.0, -260.0, 1.0],
  [39.0, -284.0, 0.95],
  [58.0, -296.0, 0.9],
  [28.0, -314.0, 1.0],
];

export const FENCE_RUNS = [
  // Home garden fence (wide gate opening at x = -4.0 .. 2.8 for girl & puppy)
  [[-8.0, -3.5], [-6.0, -3.5], [-4.0, -3.5]],
  [[2.8, -3.5], [4.8, -3.5], [6.8, -3.5], [8.8, -3.5], [10.5, -2.5]],
  // Valley & climbing slope fences (dry banks, clear of tracks & chalets)
  [[8.0, -20.5], [13.0, -21.5], [18.0, -23.5], [22.0, -26.5]],
  [[-1.0, -46.0], [-3.0, -50.0], [-4.0, -60.0], [-3.0, -66.0]],
  [[45.0, -86.0], [48.0, -90.0], [50.0, -95.0]],
  [[-18.0, -174.0], [-21.0, -181.0], [-22.0, -188.0]],
  [[38.0, -118.0], [40.0, -125.0], [38.0, -132.0]],
  // Climbing slope terraced fences
  [[-12.0, -214.0], [-6.0, -218.0], [0.0, -222.0], [6.0, -226.0]],
  [[10.0, -256.0], [16.0, -258.0], [22.0, -260.0], [27.0, -262.0]],
  [[36.0, -274.0], [42.0, -279.0], [46.0, -285.0]],
  [[56.0, -294.0], [60.0, -298.0], [65.0, -301.0]],
  [[32.0, -316.0], [36.0, -322.0], [38.0, -328.0]],
];

// Terraced pads flattened in terrain.js so buildings never float or sink on slopes
export const BUILDING_PADS = [
  ...CHALET_SITES.filter((c) => !c.isHome).map((c) => ({
    x: c.x,
    z: c.z,
    innerR: Math.hypot(c.w * 0.5, c.d * 0.5) + 0.9,
    outerR: Math.hypot(c.w * 0.5, c.d * 0.5) + 3.4,
  })),
  ...BARN_SITES.map((b) => ({
    x: b.x + Math.cos(b.ry) * 1.2,
    z: b.z - Math.sin(b.ry) * 1.2,
    innerR: 4.4,
    outerR: 7.2,
  })),
  { x: SHED_SITE.x, z: SHED_SITE.z, innerR: 3.4, outerR: 6.2 },
  { x: CHURCH_SITE.x, z: CHURCH_SITE.z, innerR: 6.2, outerR: 9.2 },
  { x: LAKE_POS.x + 4.4, z: LAKE_POS.z + 0.5, innerR: 3.5, outerR: 6.8, fixedY: LAKE_POS.y - 0.2 },
  { x: SIDETRACK_POS.x + 5.2, z: SIDETRACK_POS.z, innerR: 5.5, outerR: 9.2, fixedY: SIDETRACK_POS.y - 0.25 },
  { x: LOOKOUT_POS.x + 4.4, z: LOOKOUT_POS.z, innerR: 4.6, outerR: 8.2, fixedY: LOOKOUT_POS.y - 0.25 },
  { x: VILLAGE_POS.x + 3.4, z: VILLAGE_POS.z, innerR: 3.2, outerR: 6.2, fixedY: VILLAGE_POS.y - 0.2 },
];

export const LANDMARK_CLEARANCE = [
  { x: BOARD_POS.x, z: BOARD_POS.z, r: 9.5 },
  { x: BRIDGE_POS.x, z: BRIDGE_POS.z, r: 8.0 },
  { x: VILLAGE_POS.x, z: VILLAGE_POS.z, r: 12.0 },
  { x: SIDETRACK_POS.x, z: SIDETRACK_POS.z, r: 11.0 },
  { x: LAKE_POS.x, z: LAKE_POS.z, r: 11.0 },
  { x: LAKE_PIER_POS.x - 5.0, z: LAKE_PIER_POS.z, r: 9.0 },
  { x: LOOKOUT_POS.x + 4.4, z: LOOKOUT_POS.z, r: 9.0 },
  { x: SUMMIT_POS.x + 2.0, z: SUMMIT_POS.z - 3.0, r: 24.0 },
];
