import * as THREE from '../../lib/three.module.js';
import { mulberry32 } from '../core/math.js';

// Compact procedural textures & tangent-space normal maps (no external images, iPad Safari friendly).
function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function heightToNormalTexture(heights, size, strength = 2.2, repeatX = 1, repeatY = 1) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const idx = (x, y) => ((y + size) % size) * size + ((x + size) % size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = heights[idx(x - 1, y)];
      const hR = heights[idx(x + 1, y)];
      const hD = heights[idx(x, y - 1)];
      const hU = heights[idx(x, y + 1)];
      const nx = (hL - hR) * strength;
      const ny = (hD - hU) * strength;
      const nz = 1.0;
      const inv = 1.0 / Math.hypot(nx, ny, nz);
      const o = (y * size + x) * 4;
      d[o] = Math.round((nx * inv * 0.5 + 0.5) * 255);
      d[o + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
      d[o + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

function finalizeColorTex(c, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

function buildValueNoise2D(size, grid, seed) {
  const rand = mulberry32(seed);
  const g = new Float32Array(grid * grid);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const gy = (y / size) * grid;
    const y0 = Math.floor(gy) % grid;
    const y1 = (y0 + 1) % grid;
    const fy = gy - Math.floor(gy);
    const sy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * grid;
      const x0 = Math.floor(gx) % grid;
      const x1 = (x0 + 1) % grid;
      const fx = gx - Math.floor(gx);
      const sx = fx * fx * (3 - 2 * fx);
      const a = g[y0 * grid + x0];
      const b = g[y0 * grid + x1];
      const c = g[y1 * grid + x0];
      const d = g[y1 * grid + x1];
      out[y * size + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
  }
  return out;
}

export function createProceduralTextures({ lowQuality = false } = {}) {
  const sz = lowQuality ? 64 : 128;
  const rand = mulberry32(8421);

  // 1. Limewash plaster (subtle trowel mottling + fine stucco grain)
  const plasterH = new Float32Array(sz * sz);
  const nCoarse = buildValueNoise2D(sz, 8, 11);
  const nFine = buildValueNoise2D(sz, 24, 17);
  const plasterC = makeCanvas(sz);
  const pCtx = plasterC.getContext('2d');
  const pImg = pCtx.createImageData(sz, sz);
  for (let i = 0; i < sz * sz; i++) {
    const h = nCoarse[i] * 0.55 + nFine[i] * 0.45;
    plasterH[i] = h;
    const v = 228 + Math.round((h - 0.5) * 26);
    const o = i * 4;
    pImg.data[o] = Math.min(255, v + 5);
    pImg.data[o + 1] = Math.min(255, v + 1);
    pImg.data[o + 2] = Math.max(0, v - 8);
    pImg.data[o + 3] = 255;
  }
  pCtx.putImageData(pImg, 0, 0);

  // 2. Mediterranean limestone cobblestones (staggered courses + recessed mortar joints)
  const cobbleH = new Float32Array(sz * sz);
  const cobbleC = makeCanvas(sz);
  const cCtx = cobbleC.getContext('2d');
  const cImg = cCtx.createImageData(sz, sz);
  const rows = 6;
  const cols = 5;
  const cellTint = new Float32Array(rows * cols);
  for (let i = 0; i < cellTint.length; i++) cellTint[i] = (rand() - 0.5) * 26;
  for (let y = 0; y < sz; y++) {
    const v = y / sz;
    const r = Math.floor(v * rows);
    const fr = v * rows - r;
    const shift = (r % 2) * 0.5;
    for (let x = 0; x < sz; x++) {
      const u = (x / sz) * cols + shift;
      const col = Math.floor(u) % cols;
      const fc = u - Math.floor(u);
      const edgeX = Math.min(fc, 1 - fc);
      const edgeY = Math.min(fr, 1 - fr);
      const joint = Math.min(edgeX * 1.15, edgeY);
      const stoneMask = Math.min(1, Math.max(0, (joint - 0.065) / 0.11));
      const grain = nFine[y * sz + x] * 0.6 + nCoarse[y * sz + x] * 0.4;
      const h = stoneMask * (0.68 + 0.32 * grain);
      const i = y * sz + x;
      cobbleH[i] = h;
      const tint = cellTint[r * cols + col];
      const base = stoneMask > 0.2 ? 168 + tint + (grain - 0.5) * 24 : 112 + (grain - 0.5) * 14;
      const o = i * 4;
      cImg.data[o] = Math.max(0, Math.min(255, Math.round(base + 6)));
      cImg.data[o + 1] = Math.max(0, Math.min(255, Math.round(base + 1)));
      cImg.data[o + 2] = Math.max(0, Math.min(255, Math.round(base - 8)));
      cImg.data[o + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);

  // 3. Terracotta barrel roof tiles (curved flutes + horizontal overlap courses)
  const tileH = new Float32Array(sz * sz);
  const tileC = makeCanvas(sz);
  const tCtx = tileC.getContext('2d');
  const tImg = tCtx.createImageData(sz, sz);
  const flutes = 8;
  const courses = 6;
  for (let y = 0; y < sz; y++) {
    const v = (y / sz) * courses;
    const cr = Math.floor(v);
    const fv = v - cr;
    for (let x = 0; x < sz; x++) {
      const u = (x / sz) * flutes;
      const fl = Math.floor(u);
      const fu = u - fl;
      const arch = Math.sin(fu * Math.PI);
      const step = 1.0 - Math.pow(1.0 - fv, 3.0) * 0.35;
      const grain = nFine[y * sz + x];
      const h = arch * 0.65 * step + (1 - fv) * 0.2 + grain * 0.15;
      const i = y * sz + x;
      tileH[i] = h;
      const kiln = ((fl * 7 + cr * 13) % 5 - 2) * 5;
      const shade = 152 + arch * 34 + kiln + (grain - 0.5) * 18 - (fv < 0.1 ? 26 : 0);
      const o = i * 4;
      tImg.data[o] = Math.max(0, Math.min(255, Math.round(shade + 22)));
      tImg.data[o + 1] = Math.max(0, Math.min(255, Math.round(shade * 0.60)));
      tImg.data[o + 2] = Math.max(0, Math.min(255, Math.round(shade * 0.43)));
      tImg.data[o + 3] = 255;
    }
  }
  tCtx.putImageData(tImg, 0, 0);

  // 4. Mediterranean cedar/teak wood planks
  const woodH = new Float32Array(sz * sz);
  const woodC = makeCanvas(sz);
  const wCtx = woodC.getContext('2d');
  const wImg = wCtx.createImageData(sz, sz);
  const planks = 5;
  for (let y = 0; y < sz; y++) {
    const v = y / sz;
    for (let x = 0; x < sz; x++) {
      const u = (x / sz) * planks;
      const pl = Math.floor(u);
      const fu = u - pl;
      const seam = Math.min(fu, 1 - fu) < 0.045 ? 0 : 1;
      const grainWave = Math.sin(v * 18 + nCoarse[y * sz + x] * 6.0 + pl * 1.7) * 0.5 + 0.5;
      const streak = nFine[Math.floor((y * 0.25) % sz) * sz + x];
      const h = seam * (0.45 + grainWave * 0.28 + streak * 0.27);
      const i = y * sz + x;
      woodH[i] = h;
      const tone = seam ? 150 + (pl % 3 - 1) * 10 + (grainWave - 0.5) * 26 + (streak - 0.5) * 18 : 78;
      const o = i * 4;
      wImg.data[o] = Math.max(0, Math.min(255, Math.round(tone + 18)));
      wImg.data[o + 1] = Math.max(0, Math.min(255, Math.round(tone * 0.76)));
      wImg.data[o + 2] = Math.max(0, Math.min(255, Math.round(tone * 0.54)));
      wImg.data[o + 3] = 255;
    }
  }
  wCtx.putImageData(wImg, 0, 0);

  // 5. Painted white wooden hull planking (subtle horizontal carvel strake seams)
  const hullH = new Float32Array(sz * sz);
  const hullC = makeCanvas(sz);
  const hCtx = hullC.getContext('2d');
  const hImg = hCtx.createImageData(sz, sz);
  const strakes = 7;
  for (let y = 0; y < sz; y++) {
    const v = (y / sz) * strakes;
    const fv = v - Math.floor(v);
    const seam = Math.min(fv, 1 - fv) < 0.055 ? 0.25 : 1.0;
    for (let x = 0; x < sz; x++) {
      const grain = nFine[y * sz + x];
      const i = y * sz + x;
      hullH[i] = seam * (0.75 + grain * 0.25);
      const base = seam < 0.5 ? 202 : 238 + Math.round((grain - 0.5) * 14);
      const o = i * 4;
      hImg.data[o] = Math.min(255, base + 4);
      hImg.data[o + 1] = Math.min(255, base);
      hImg.data[o + 2] = Math.max(0, base - 7);
      hImg.data[o + 3] = 255;
    }
  }
  hCtx.putImageData(hImg, 0, 0);

  // 6. Woven linen sailcloth with stitched panel seams
  const sailH = new Float32Array(sz * sz);
  const sailC = makeCanvas(sz);
  const sCtx = sailC.getContext('2d');
  const sImg = sCtx.createImageData(sz, sz);
  for (let y = 0; y < sz; y++) {
    const stitchRow = (y % Math.max(8, Math.floor(sz / 5))) <= 1;
    for (let x = 0; x < sz; x++) {
      const weave = ((x + y) % 2 === 0 ? 0.55 : 0.45) + (nFine[y * sz + x] - 0.5) * 0.25;
      const i = y * sz + x;
      sailH[i] = stitchRow ? 0.85 : weave;
      const base = stitchRow ? 226 : 244 + Math.round((weave - 0.5) * 14);
      const o = i * 4;
      sImg.data[o] = Math.min(255, base + 4);
      sImg.data[o + 1] = Math.min(255, base);
      sImg.data[o + 2] = Math.max(0, base - 10);
      sImg.data[o + 3] = 255;
    }
  }
  sCtx.putImageData(sImg, 0, 0);

  // 7. Terrain micro-relief & soil/stone grain normal map
  const terrainH = new Float32Array(sz * sz);
  for (let i = 0; i < sz * sz; i++) {
    terrainH[i] = nCoarse[i] * 0.5 + nFine[i] * 0.5;
  }

  // 8. Soft multi-lobed cloud puff sprite texture (no sharp circle edge)
  const cloudSize = lowQuality ? 64 : 128;
  const cloudC = makeCanvas(cloudSize);
  const clCtx = cloudC.getContext('2d');
  clCtx.clearRect(0, 0, cloudSize, cloudSize);
  const lobes = [
    [0.50, 0.56, 0.30, 0.52],
    [0.34, 0.58, 0.22, 0.45],
    [0.66, 0.59, 0.22, 0.44],
    [0.44, 0.44, 0.22, 0.42],
    [0.58, 0.46, 0.20, 0.40],
  ];
  for (const [lx, ly, lr, op] of lobes) {
    const gx = lx * cloudSize;
    const gy = ly * cloudSize;
    const gr = lr * cloudSize;
    const grad = clCtx.createRadialGradient(gx, gy, gr * 0.08, gx, gy, gr);
    grad.addColorStop(0, `rgba(255,255,255,${op})`);
    grad.addColorStop(0.55, `rgba(255,255,255,${op * 0.48})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    clCtx.fillStyle = grad;
    clCtx.fillRect(0, 0, cloudSize, cloudSize);
  }
  const cloudTex = new THREE.CanvasTexture(cloudC);
  cloudTex.colorSpace = THREE.SRGBColorSpace;

  const cobblePlazaMap = finalizeColorTex(cobbleC, 24, 8);
  const cobblePlazaNorm = lowQuality ? null : heightToNormalTexture(cobbleH, sz, 2.5, 24, 8);
  const stoneWallMap = finalizeColorTex(cobbleC, 18, 2);
  const stoneWallNorm = lowQuality ? null : heightToNormalTexture(cobbleH, sz, 2.2, 18, 2);

  return {
    plasterMap: finalizeColorTex(plasterC, 2, 2),
    plasterNorm: lowQuality ? null : heightToNormalTexture(plasterH, sz, 1.3, 2, 2),
    cobbleMap: finalizeColorTex(cobbleC, 6, 4),
    cobbleNorm: lowQuality ? null : heightToNormalTexture(cobbleH, sz, 2.5, 6, 4),
    cobblePlazaMap,
    cobblePlazaNorm,
    stoneWallMap,
    stoneWallNorm,
    stoneNorm: lowQuality ? null : heightToNormalTexture(cobbleH, sz, 2.1, 2, 2),
    tileMap: finalizeColorTex(tileC, 3, 2),
    tileNorm: lowQuality ? null : heightToNormalTexture(tileH, sz, 2.6, 3, 2),
    woodMap: finalizeColorTex(woodC, 2, 2),
    woodNorm: lowQuality ? null : heightToNormalTexture(woodH, sz, 2.0, 2, 2),
    hullMap: finalizeColorTex(hullC, 3, 2),
    hullNorm: lowQuality ? null : heightToNormalTexture(hullH, sz, 1.6, 3, 2),
    sailMap: finalizeColorTex(sailC, 1, 1),
    sailNorm: lowQuality ? null : heightToNormalTexture(sailH, sz, 1.1, 1, 1),
    terrainNorm: lowQuality ? null : heightToNormalTexture(terrainH, sz, 1.7, 14, 14),
    cloudTex,
  };
}
