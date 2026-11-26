import * as THREE from '../../lib/three.module.js';

/**
 * Shared Catmull-Rom railway network definition.
 * Every segment has control points, length, junction switch points, and next-segment links.
 */
export const TRACK_DEFS = {
  seg0_home_village: {
    pts: [
      [-12, 0.25, -9],
      [2.5, 0.25, -9],
      [20, 0.45, -13],
      [36, 1.8, -32],
      [31, 2.0, -58],
      [26, 2.5, -76],
    ],
    switchId: 'sw1',
    next: ['seg1_main', 'seg1_flower'],
    nextS: [0, 0],
    elevatedFrom: 0.42,
    elevatedTo: 0.65,
  },
  seg1_main: {
    pts: [
      [26, 2.5, -76],
      [12, 4.0, -104],
      [-8, 2.6, -134],
      [-18, 0.8, -162],
    ],
    next: ['seg2_lake'],
    nextS: [0],
  },
  seg1_flower: {
    pts: [
      [26, 2.5, -76],
      [41, 3.8, -96],
      [48, 4.2, -122],
      [26, 3.0, -148],
      [-18, 0.8, -162],
    ],
    next: ['seg2_lake'],
    nextS: [0],
  },
  seg2_lake: {
    pts: [
      [-18, 0.8, -162],
      [-34, 0.5, -188],
      [-30, 1.2, -214],
    ],
    switchId: 'sw2',
    next: ['seg3_climb', 'seg2_return'],
    nextS: [0, 0],
  },
  seg2_return: {
    pts: [
      [-30, 1.2, -214],
      [-14, 1.5, -222],
      [8, 1.8, -180],
      [12, 1.9, -120],
      [22, 1.9, -68],
      [33.5, 1.9, -44],
    ],
    next: ['seg0_home_village'],
    nextS: [0.68],
  },
  seg3_climb: {
    pts: [
      [-30, 1.2, -214],
      [-6, 6.5, -238],
      [28, 14.5, -252],
      [54, 24.0, -278],
    ],
    switchId: 'sw3',
    next: ['seg4_main', 'seg4_lookout'],
    nextS: [0, 0],
  },
  seg4_main: {
    pts: [
      [54, 24.0, -278],
      [48, 29.0, -308],
      [42, 34.0, -334],
    ],
    next: ['seg5_viaduct'],
    nextS: [0],
  },
  seg4_lookout: {
    pts: [
      [54, 24.0, -278],
      [76, 26.8, -286],
      [84, 28.5, -310],
      [64, 32.0, -328],
      [42, 34.0, -334],
    ],
    next: ['seg5_viaduct'],
    nextS: [0],
  },
  seg5_viaduct: {
    pts: [
      [42, 34.0, -334],
      [10, 46.0, -352],
      [-16, 58.0, -372],
      [-4, 68.0, -390],
      [18, 76.0, -395],
      [33, 76.0, -393],
    ],
    next: [],
    nextS: [],
    elevatedFrom: 0.02,
    elevatedTo: 0.84,
  },
};

export function buildTrackCurves() {
  const curves = {};
  for (const [id, def] of Object.entries(TRACK_DEFS)) {
    const curve = new THREE.CatmullRomCurve3(
      def.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
      false,
      'catmullrom',
      0.45
    );
    curves[id] = {
      id,
      curve,
      length: curve.getLength(),
      ...def,
    };
  }
  return curves;
}
