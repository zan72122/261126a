import * as THREE from '../../lib/three.module.js';

// 70 : 25 : 5 Mediterranean Summer Twilight-to-Starlight Palette
export const PALETTE = {
  // Base (~70%): whitewash plaster, limestone pale sand, deep ultramarine sea & night sky
  plaster: 0xefeae0,
  plasterWarm: 0xe6dfd0,
  plasterShadow: 0xd8d0c0,
  seaDeep: 0x13284b,
  seaMid: 0x1b3b6b,
  sand: 0xdfd2b8,

  // Main (~25%): terracotta tiles, olive leaves, Mediterranean stone & wood
  terracotta: 0xb96243,
  terracottaDark: 0x974c33,
  olive: 0x5c7249,
  oliveLight: 0x728a5c,
  cypress: 0x425838,
  stone: 0x8f897e,
  stoneLight: 0xb0a99c,
  wood: 0x7a563c,
  woodLight: 0xa67c58,

  // Accent (~5%): citrus (lemon/orange/lanterns) and coral (bougainvillea, doors, pennants, shell)
  citrus: 0xe69d38,
  lemon: 0xe3be46,
  lantern: 0xffcf7a,
  coral: 0xd96b57,
  bougainvillea: 0xc95568,
  mailboxBlue: 0x3b6796,
  shutterOlive: 0x607853,
};

// Key World Coordinates (X, Z in meters, Y=0 is mean sea level)
export const HARBOR_ORIGIN = new THREE.Vector3(0, 0, -132);
export const SHELL_MAP_POS = new THREE.Vector3(2.1, 0.95, -118.2);
export const HARBOR_BOAT_POS = new THREE.Vector3(6.2, 0, -110.2);

// Starlit Cove Pavilion arranged so moored sailboat floats cleanly in front-left water beside terrace,
// with girl and welcomer standing clearly side-by-side at the open front terrace edge.
export const PAVILION_POS = new THREE.Vector3(0, 0, 190);
export const PAVILION_DOCK_POS = new THREE.Vector3(-5.2, 0, 177.2);
export const WELCOMER_POS = new THREE.Vector3(1.55, 1.07, 183.6);

export const ISLANDS = [
  {
    id: 'lighthouse',
    name: 'lighthouse',
    center: new THREE.Vector3(-58, 0, -34),
    radius: 26,
    peakY: 6.2,
    dockPos: new THREE.Vector3(-27.2, 0, -29.5),
    dockYaw: -Math.PI * 0.55,
    walkLanding: new THREE.Vector3(-37.0, 0.85, -30.2),
    detourPos: new THREE.Vector3(-73, 3.8, -37),
    landmarkPos: new THREE.Vector3(-60, 5.2, -33),
  },
  {
    id: 'windmill',
    name: 'windmill',
    center: new THREE.Vector3(60, 0, 26),
    radius: 28,
    peakY: 7.4,
    dockPos: new THREE.Vector3(28.2, 0, 23.0),
    dockYaw: Math.PI * 0.52,
    walkLanding: new THREE.Vector3(38.5, 0.85, 24.0),
    detourPos: new THREE.Vector3(63, 2.2, 46),
    landmarkPos: new THREE.Vector3(61, 6.8, 24),
  },
  {
    id: 'cove',
    name: 'cove',
    center: new THREE.Vector3(-42, 0, 96),
    radius: 27,
    peakY: 5.8,
    dockPos: new THREE.Vector3(-12.2, 0, 92.5),
    dockYaw: -Math.PI * 0.5,
    walkLanding: new THREE.Vector3(-22.2, 0.85, 93.0),
    altDockPos: new THREE.Vector3(-37.5, 0, 66.5),
    detourPos: new THREE.Vector3(-52, 4.6, 104),
    landmarkPos: new THREE.Vector3(-45, 3.8, 97),
  },
];

// Tailwind golden breeze rings along sea lanes (grant speed surge + billowing sail + water sparkle)
export const WIND_RINGS = [
  { pos: new THREE.Vector3(-6, 0, -84), yaw: -0.45, radius: 6.2 },
  { pos: new THREE.Vector3(-18, 0, -56), yaw: -0.58, radius: 6.2 },
  { pos: new THREE.Vector3(2, 0, -6), yaw: 0.92, radius: 6.4 },
  { pos: new THREE.Vector3(14, 0, 56), yaw: -0.48, radius: 6.4 },
  { pos: new THREE.Vector3(-12, 0, 126), yaw: 0.25, radius: 6.4 },
  { pos: new THREE.Vector3(-3, 0, 154), yaw: 0.08, radius: 6.4 },
];

// Buoyant sea-swell updraft zones
export const SWELL_ZONES = [
  { pos: new THREE.Vector3(2, 0, 54), radius: 13.5, lift: 7.4 },
  { pos: new THREE.Vector3(8, 0, 128), radius: 13.5, lift: 7.8 },
];

// Sea reefs (visual + gentle deflection)
export const REEFS = [
  { x: -28, z: -76, r: 4.8, h: 2.1 },
  { x: 30, z: -64, r: 4.5, h: 1.8 },
  { x: 18, z: -16, r: 4.6, h: 2.0 },
  { x: -12, z: 24, r: 4.2, h: 1.6 },
  { x: 34, z: 88, r: 5.5, h: 2.5 },
  { x: -20, z: 144, r: 4.4, h: 1.9 },
  { x: 24, z: 152, r: 4.8, h: 2.1 },
];

export const shared = {
  uTime: { value: 0 },
  uNight: { value: 0 }, // 0 = summer twilight, 1 = starry night
  uSunDir: { value: new THREE.Vector3(-0.55, 0.16, 0.82).normalize() },
  uMoonDir: { value: new THREE.Vector3(0.24, 0.34, 0.91).normalize() },
  uSkyZenith: { value: new THREE.Color(0x284375) },
  uSkyHorizon: { value: new THREE.Color(0xd5886c) },
  uFogColor: { value: new THREE.Color(0x6d6e8c) },
  uSeaDeep: { value: new THREE.Color(PALETTE.seaDeep) },
  uSeaMid: { value: new THREE.Color(PALETTE.seaMid) },
  uLanternGlow: { value: 0.35 },
  uBoatPos: { value: new THREE.Vector3(6.2, 0, -110.2) },
  uBoatYaw: { value: -0.32 },
  uBoatSpeed: { value: 0 },
  uBreezeBoost: { value: 0 },
};

export const GLSL_NOISE = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm2(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise2(p);
    p = p * 2.03 + vec2(17.1, 31.7);
    a *= 0.5;
  }
  return v;
}
`;
