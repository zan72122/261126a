// 70:25:5 color palette (Color Coordinator principle: unified pale-to-soft morning tone)
// Base (~70%): Morning cream & pale morning sky blue
// Main (~25%): Lavender & Provençal limestone + sage meadow green
// Accent (~5%): Turquoise & apricot (never red as hero)

import * as THREE from '../../lib/three.module.js';

export const PALETTE = {
  // Base (~70%)
  cream: 0xf4ecdc,
  creamWarm: 0xeae0ca,
  creamDeep: 0xddd0b8,
  skyZenith: 0x9ec8e2,
  skyHorizon: 0xdbeaf2,
  skyMist: 0xedf1f0,
  riverBlue: 0x98cadc,

  // Main (~25%)
  lavender: 0x9a8ac2,
  lavenderLight: 0xb5a8d6,
  lavenderDeep: 0x7e6ea8,
  limestone: 0xd8cbb4,
  limestoneShadow: 0xbcae96,
  roofTile: 0xd6b596,
  roofTileWarm: 0xcfa482,
  meadowSage: 0x8ea674,
  meadowSoft: 0x9eb482,
  oliveLeaf: 0x728c5c,
  cypressLeaf: 0x5c754d,
  woodWarm: 0x9e7d5e,
  wicker: 0xc29e70,

  // Accent (~5%)
  turquoise: 0x4aa8a6,
  turquoiseSoft: 0x67beba,
  apricot: 0xe89e6c,
  apricotSoft: 0xf2ba86,
  bronze: 0xb68b52,

  // Character skin / hair / garments (harmonized into main/base tone)
  skin: 0xf0c9ae,
  cheek: 0xe5a48e,
  hairBrown: 0x6e4f3e,
  hairSilver: 0x9c9288,
  eyeDark: 0x3a3230,
  shoeTan: 0x8e6446,
};

export function c(hex) {
  return new THREE.Color(hex);
}
