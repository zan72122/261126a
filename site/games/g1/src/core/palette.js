import * as THREE from '../../lib/three.module.js';

/**
 * 70 : 25 : 5 Color Coordinator Palette for 1960s Swiss Alpine Early Autumn Afternoon.
 * Base (70%): pale blue-white sky, snowfields, layered cloud sea, lime plaster & light stone.
 * Main (25%): deep alpine pine green, autumn larch & pasture, cedar/oak timber, engine iron.
 * Accent (5%): mustard yellow & cobalt blue (never dominant red).
 */
export const PALETTE = {
  // Base 70%
  skyZenith: '#82b3dc',
  skyHorizon: '#ebf3fb',
  snow: '#eef3f8',
  cloud: '#f7fafd',
  cloudShadow: '#c0d5ea',
  cloudGold: '#f6e4b8',
  plaster: '#e7e1d6',
  stoneLight: '#d5cfc3',
  stoneMid: '#a9a397',

  // Main 25%
  pineDeep: '#254a35',
  pineMid: '#376145',
  larchAutumn: '#839149',
  grassBase: '#62804e',
  grassSun: '#7d965d',
  timberLight: '#a67b54',
  timberMid: '#785237',
  timberDark: '#4e3322',
  locoGreen: '#244b38',
  ironDark: '#2b3137',
  ironSteel: '#68717c',

  // Accent 5%
  mustard: '#d9a431',
  mustardSoft: '#ecc96b',
  cobalt: '#275da8',
  cobaltLight: '#497ec4',
  waterTurquoise: '#4e9ba8',
  waterDeep: '#2b707e',
  lanternWarm: '#f7ca6d',
};

function makeTexturePair(size, drawDiffuse, drawBump, repeat = [1, 1]) {
  const dc = document.createElement('canvas');
  dc.width = size;
  dc.height = size;
  drawDiffuse(dc.getContext('2d'), size);
  const map = new THREE.CanvasTexture(dc);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat[0], repeat[1]);
  map.colorSpace = THREE.SRGBColorSpace;

  const bc = document.createElement('canvas');
  bc.width = size;
  bc.height = size;
  drawBump(bc.getContext('2d'), size);
  const bumpMap = new THREE.CanvasTexture(bc);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeat[0], repeat[1]);

  return { map, bumpMap };
}

function makeBumpOnly(size, drawBump, repeat = [1, 1]) {
  const bc = document.createElement('canvas');
  bc.width = size;
  bc.height = size;
  drawBump(bc.getContext('2d'), size);
  const bumpMap = new THREE.CanvasTexture(bc);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeat[0], repeat[1]);
  return bumpMap;
}

/**
 * Build shared PBR materials with compact procedural diffuse + bump maps (no large image assets).
 */
export function createSharedMaterials() {
  // 1. Cedar / Oak Planks with grain & recessed seams
  const wood = makeTexturePair(
    128,
    (ctx, s) => {
      ctx.fillStyle = '#926847';
      ctx.fillRect(0, 0, s, s);
      const planks = 8;
      const ph = s / planks;
      for (let i = 0; i < planks; i++) {
        const y = i * ph;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(60, 36, 20, 0.16)' : 'rgba(196, 152, 108, 0.14)';
        ctx.fillRect(0, y, s, ph - 1.5);
        ctx.fillStyle = 'rgba(32, 18, 8, 0.42)';
        ctx.fillRect(0, y + ph - 1.5, s, 1.5);
        // Subtle plank end joint
        const jx = ((i * 53 + 21) % (s - 16)) + 8;
        ctx.fillRect(jx, y, 1.5, ph);
      }
      for (let i = 0; i < 160; i++) {
        const gx = (i * 41) % s;
        const gy = (i * 19) % s;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(38, 22, 10, 0.13)' : 'rgba(210, 170, 128, 0.08)';
        ctx.fillRect(gx, gy, 14 + (i % 12), 1);
      }
    },
    (ctx, s) => {
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(0, 0, s, s);
      const planks = 8;
      const ph = s / planks;
      for (let i = 0; i < planks; i++) {
        const y = i * ph;
        ctx.fillStyle = i % 2 === 0 ? '#b2b2b2' : '#9f9f9f';
        ctx.fillRect(0, y + 1, s, ph - 3);
        ctx.fillStyle = '#383838';
        ctx.fillRect(0, y + ph - 2, s, 2);
        const jx = ((i * 53 + 21) % (s - 16)) + 8;
        ctx.fillRect(jx, y, 2, ph);
      }
      for (let i = 0; i < 140; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#c4c4c4' : '#787878';
        ctx.fillRect((i * 41) % s, (i * 19) % s, 16, 1);
      }
    },
    [2, 2]
  );

  // 2. Alpine Ashlar & Rubble Stone Masonry
  const stone = makeTexturePair(
    128,
    (ctx, s) => {
      ctx.fillStyle = '#8b8579';
      ctx.fillRect(0, 0, s, s);
      const rows = 4;
      const rh = s / rows;
      for (let r = 0; r < rows; r++) {
        const y = r * rh;
        const off = (r % 2) * (s / 4);
        const cols = 3;
        for (let c = 0; c < cols; c++) {
          const w = s / cols;
          const x = (c * w + off) % s;
          const shade = ((r * 7 + c * 11) % 4) * 9;
          ctx.fillStyle = `rgb(${182 + shade}, ${176 + shade}, ${164 + shade})`;
          ctx.fillRect(x + 2, y + 2, w - 4, rh - 4);
          if (x + w > s) {
            ctx.fillRect(0, y + 2, (x + w - s) - 2, rh - 4);
          }
          ctx.fillStyle = 'rgba(255,252,244,0.14)';
          ctx.fillRect(x + 2, y + 2, w - 4, 2);
        }
      }
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(65, 60, 52, 0.14)' : 'rgba(245, 240, 230, 0.12)';
        ctx.fillRect((i * 67) % s, (i * 101) % s, 2, 2);
      }
    },
    (ctx, s) => {
      ctx.fillStyle = '#404040';
      ctx.fillRect(0, 0, s, s);
      const rows = 4;
      const rh = s / rows;
      for (let r = 0; r < rows; r++) {
        const y = r * rh;
        const off = (r % 2) * (s / 4);
        const w = s / 3;
        for (let c = 0; c < 3; c++) {
          const x = (c * w + off) % s;
          ctx.fillStyle = (r + c) % 2 === 0 ? '#d8d8d8' : '#b8b8b8';
          ctx.fillRect(x + 2.5, y + 2.5, w - 5, rh - 5);
          if (x + w > s) {
            ctx.fillRect(0, y + 2.5, (x + w - s) - 2.5, rh - 5);
          }
        }
      }
      for (let i = 0; i < 220; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#efefef' : '#808080';
        ctx.fillRect((i * 59) % s, (i * 89) % s, 2, 2);
      }
    },
    [2, 2]
  );

  // 3. Lime Plaster Stucco
  const plaster = makeTexturePair(
    128,
    (ctx, s) => {
      ctx.fillStyle = '#ebe5da';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 480; i++) {
        const x = (i * 61) % s;
        const y = (i * 97) % s;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(176, 168, 154, 0.13)' : 'rgba(255, 252, 246, 0.18)';
        ctx.fillRect(x, y, 5, 3);
      }
    },
    (ctx, s) => {
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 420; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#bababa' : '#7b7b7b';
        ctx.fillRect((i * 61) % s, (i * 97) % s, 5, 3);
      }
    },
    [2, 2]
  );

  // 4. Slate / Shingle Roof Tiles
  const slate = makeTexturePair(
    128,
    (ctx, s) => {
      ctx.fillStyle = '#47505a';
      ctx.fillRect(0, 0, s, s);
      const rows = 8;
      const rh = s / rows;
      for (let r = 0; r < rows; r++) {
        const y = r * rh;
        const off = (r % 2) * 8;
        for (let x = -8; x < s; x += 16) {
          ctx.fillStyle = ((r + x) % 3 === 0) ? '#535d68' : '#404852';
          ctx.fillRect(x + off + 1, y + 1, 14, rh - 2);
        }
        ctx.fillStyle = 'rgba(20, 24, 30, 0.35)';
        ctx.fillRect(0, y + rh - 1.5, s, 1.5);
      }
    },
    (ctx, s) => {
      ctx.fillStyle = '#555555';
      ctx.fillRect(0, 0, s, s);
      const rows = 8;
      const rh = s / rows;
      for (let r = 0; r < rows; r++) {
        const y = r * rh;
        const off = (r % 2) * 8;
        for (let x = -8; x < s; x += 16) {
          ctx.fillStyle = '#c8c8c8';
          ctx.fillRect(x + off + 1, y + 1, 14, rh - 2);
        }
      }
    },
    [3, 3]
  );

  // 5. Brushed / Riveted Locomotive Metal Bump
  const metalBump = makeBumpOnly(
    128,
    (ctx, s) => {
      ctx.fillStyle = '#888888';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 180; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#989898' : '#7a7a7a';
        ctx.fillRect((i * 37) % s, (i * 13) % s, 18, 1);
      }
      // Seam line with rivets
      ctx.fillStyle = '#505050';
      ctx.fillRect(0, 62, s, 2);
      ctx.fillStyle = '#e0e0e0';
      for (let rx = 8; rx < s; rx += 16) {
        ctx.beginPath();
        ctx.arc(rx, 58, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [2, 2]
  );

  // 6. Woven Wool/Linen Fabric Bump
  const fabricBump = makeBumpOnly(
    64,
    (ctx, s) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 2) {
        for (let x = 0; x < s; x += 2) {
          ctx.fillStyle = ((x + y) / 2) % 2 === 0 ? '#9c9c9c' : '#6c6c6c';
          ctx.fillRect(x, y, 2, 2);
        }
      }
    },
    [4, 4]
  );

  // 7. Pine Foliage & Snow Micro-Bump
  const pineBump = makeBumpOnly(
    64,
    (ctx, s) => {
      ctx.fillStyle = '#7c7c7c';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 240; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#bdbdbd' : '#4a4a4a';
        ctx.fillRect((i * 29) % s, (i * 43) % s, 2, 5);
      }
    },
    [2, 2]
  );

  const snowBump = makeBumpOnly(
    128,
    (ctx, s) => {
      ctx.fillStyle = '#888888';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 140; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(215,215,215,0.28)' : 'rgba(100,100,100,0.22)';
        ctx.fillRect((i * 43) % s, (i * 29) % s, 24, 3);
      }
    },
    [2, 2]
  );

  return {
    timberLight: new THREE.MeshStandardMaterial({
      map: wood.map,
      bumpMap: wood.bumpMap,
      bumpScale: 0.045,
      color: '#c89e76',
      roughness: 0.78,
      metalness: 0.04,
    }),
    timberMid: new THREE.MeshStandardMaterial({
      map: wood.map,
      bumpMap: wood.bumpMap,
      bumpScale: 0.055,
      color: '#9e7450',
      roughness: 0.82,
      metalness: 0.04,
    }),
    timberDark: new THREE.MeshStandardMaterial({
      map: wood.map,
      bumpMap: wood.bumpMap,
      bumpScale: 0.06,
      color: '#6e4c34',
      roughness: 0.85,
      metalness: 0.05,
    }),
    plaster: new THREE.MeshStandardMaterial({
      map: plaster.map,
      bumpMap: plaster.bumpMap,
      bumpScale: 0.032,
      color: '#f1ece2',
      roughness: 0.89,
      metalness: 0.02,
    }),
    stoneLight: new THREE.MeshStandardMaterial({
      map: stone.map,
      bumpMap: stone.bumpMap,
      bumpScale: 0.08,
      color: '#dcd6ca',
      roughness: 0.88,
      metalness: 0.03,
    }),
    stoneMid: new THREE.MeshStandardMaterial({
      map: stone.map,
      bumpMap: stone.bumpMap,
      bumpScale: 0.09,
      color: '#b7b1a5',
      roughness: 0.91,
      metalness: 0.04,
    }),
    slateRoof: new THREE.MeshStandardMaterial({
      map: slate.map,
      bumpMap: slate.bumpMap,
      bumpScale: 0.06,
      color: '#6c7785',
      roughness: 0.76,
      metalness: 0.12,
    }),
    snowRoof: new THREE.MeshStandardMaterial({
      bumpMap: snowBump,
      bumpScale: 0.035,
      color: PALETTE.snow,
      roughness: 0.72,
      metalness: 0.02,
    }),
    pineDeep: new THREE.MeshStandardMaterial({
      bumpMap: pineBump,
      bumpScale: 0.05,
      color: PALETTE.pineDeep,
      roughness: 0.84,
      metalness: 0.02,
    }),
    pineMid: new THREE.MeshStandardMaterial({
      bumpMap: pineBump,
      bumpScale: 0.05,
      color: PALETTE.pineMid,
      roughness: 0.82,
      metalness: 0.02,
    }),
    larch: new THREE.MeshStandardMaterial({
      bumpMap: pineBump,
      bumpScale: 0.04,
      color: PALETTE.larchAutumn,
      roughness: 0.82,
      metalness: 0.02,
    }),
    larchGold: new THREE.MeshStandardMaterial({
      bumpMap: pineBump,
      bumpScale: 0.04,
      color: '#a3a44a',
      roughness: 0.8,
      metalness: 0.02,
    }),
    locoGreen: new THREE.MeshStandardMaterial({
      bumpMap: metalBump,
      bumpScale: 0.02,
      color: PALETTE.locoGreen,
      roughness: 0.34,
      metalness: 0.36,
    }),
    ironDark: new THREE.MeshStandardMaterial({
      bumpMap: metalBump,
      bumpScale: 0.026,
      color: PALETTE.ironDark,
      roughness: 0.44,
      metalness: 0.68,
    }),
    ironSteel: new THREE.MeshStandardMaterial({
      bumpMap: metalBump,
      bumpScale: 0.015,
      color: '#939ca6',
      roughness: 0.25,
      metalness: 0.84,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: '#e0b248',
      roughness: 0.22,
      metalness: 0.86,
    }),
    mustard: new THREE.MeshStandardMaterial({
      bumpMap: fabricBump,
      bumpScale: 0.014,
      color: PALETTE.mustard,
      roughness: 0.56,
      metalness: 0.08,
    }),
    mustardSoft: new THREE.MeshStandardMaterial({
      color: PALETTE.mustardSoft,
      roughness: 0.66,
      metalness: 0.04,
    }),
    cobalt: new THREE.MeshStandardMaterial({
      bumpMap: fabricBump,
      bumpScale: 0.014,
      color: PALETTE.cobalt,
      roughness: 0.54,
      metalness: 0.06,
    }),
    cobaltLight: new THREE.MeshStandardMaterial({
      color: PALETTE.cobaltLight,
      roughness: 0.58,
      metalness: 0.05,
    }),
    fabricBump,
    snowBump,
    lanternGlow: new THREE.MeshStandardMaterial({
      color: '#ffe8a8',
      emissive: '#f5b23b',
      emissiveIntensity: 1.25,
      roughness: 0.32,
    }),
  };
}
