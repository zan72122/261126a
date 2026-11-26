// Procedural CanvasTextures (color maps + matching bumpMaps, lightweight for iPad Safari)
import * as THREE from '../../lib/three.module.js';

function makeSeededRand(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function makeLimestoneTextures() {
  const cv = document.createElement('canvas');
  const bv = document.createElement('canvas');
  cv.width = bv.width = 256;
  cv.height = bv.height = 256;
  const ctx = cv.getContext('2d');
  const btx = bv.getContext('2d');

  ctx.fillStyle = '#ddd0ba';
  ctx.fillRect(0, 0, 256, 256);
  btx.fillStyle = '#484848'; // recessed mortar
  btx.fillRect(0, 0, 256, 256);

  const rand = makeSeededRand(401);
  const rows = 6;
  const rh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * 32;
    for (let x = -48; x < 256; x += 64) {
      const bw = 58 + Math.floor(rand() * 5);
      const n = ((r * 23 + x * 11) & 31) - 15;
      const rr = 224 + Math.floor(n * 0.58);
      const gg = 212 + Math.floor(n * 0.54);
      const bb = 191 + Math.floor(n * 0.48);
      ctx.fillStyle = `rgb(${rr}, ${gg}, ${bb})`;
      ctx.fillRect(x + offset + 2, r * rh + 2, bw, rh - 4);

      const bh = 185 + Math.floor(rand() * 40);
      btx.fillStyle = `rgb(${bh}, ${bh}, ${bh})`;
      btx.fillRect(x + offset + 3, r * rh + 3, bw - 2, rh - 6);
    }
  }

  // Subtle mineral pitting and warm sun-bleached stone grain
  for (let i = 0; i < 950; i++) {
    const px = rand() * 256;
    const py = rand() * 256;
    const rad = 0.8 + rand() * 2.2;
    const light = rand() > 0.5;
    ctx.fillStyle = light ? 'rgba(255, 250, 238, 0.14)' : 'rgba(155, 140, 118, 0.15)';
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();

    btx.fillStyle = light ? 'rgba(255, 255, 255, 0.14)' : 'rgba(60, 60, 60, 0.18)';
    btx.beginPath();
    btx.arc(px, py, rad, 0, Math.PI * 2);
    btx.fill();
  }

  const map = new THREE.CanvasTexture(cv);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bv);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.colorSpace = THREE.NoColorSpace;

  return { map, bumpMap };
}

export function makeWickerTextures() {
  const cv = document.createElement('canvas');
  const bv = document.createElement('canvas');
  cv.width = bv.width = 256;
  cv.height = bv.height = 256;
  const ctx = cv.getContext('2d');
  const btx = bv.getContext('2d');

  ctx.fillStyle = '#8b683e';
  ctx.fillRect(0, 0, 256, 256);
  btx.fillStyle = '#303030';
  btx.fillRect(0, 0, 256, 256);

  const stepY = 12;
  const stepX = 24;
  for (let y = 0; y < 256; y += stepY) {
    const row = Math.floor(y / stepY);
    const shift = (row % 2) * (stepX * 0.5);
    for (let x = -stepX; x < 256 + stepX; x += stepX) {
      const px = x + shift;
      const g = ctx.createLinearGradient(px, y, px + stepX - 4, y);
      g.addColorStop(0, '#9e784a');
      g.addColorStop(0.5, '#dfc090');
      g.addColorStop(1, '#946f43');
      ctx.fillStyle = g;
      ctx.fillRect(px + 1, y + 1, stepX - 4, stepY - 3);

      // Vertical under-weave shadow gap
      ctx.fillStyle = '#73532e';
      ctx.fillRect(px + stepX - 3, y + 1, 3, stepY - 2);

      // Rounded cane ridge in bumpMap
      const bg = btx.createLinearGradient(px, y, px + stepX - 4, y);
      bg.addColorStop(0, '#858585');
      bg.addColorStop(0.5, '#f0f0f0');
      bg.addColorStop(1, '#858585');
      btx.fillStyle = bg;
      btx.fillRect(px + 1, y + 2, stepX - 4, stepY - 4);
    }
    ctx.fillStyle = 'rgba(84, 58, 30, 0.38)';
    ctx.fillRect(0, y, 256, 1.5);
  }

  const map = new THREE.CanvasTexture(cv);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.5, 2.0);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bv);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2.5, 2.0);
  bumpMap.colorSpace = THREE.NoColorSpace;

  return { map, bumpMap };
}

export function makeRoofTileTextures() {
  const cv = document.createElement('canvas');
  const bv = document.createElement('canvas');
  cv.width = bv.width = 256;
  cv.height = bv.height = 256;
  const ctx = cv.getContext('2d');
  const btx = bv.getContext('2d');

  ctx.fillStyle = '#cfa986';
  ctx.fillRect(0, 0, 256, 256);
  btx.fillStyle = '#555555';
  btx.fillRect(0, 0, 256, 256);

  const rand = makeSeededRand(902);
  for (let row = 0; row < 8; row++) {
    const ry = row * 32;
    for (let x = 0; x < 256; x += 16) {
      const shade = Math.floor((rand() - 0.5) * 18);
      const g = ctx.createLinearGradient(x, ry, x + 16, ry);
      g.addColorStop(0, `rgb(${182 + shade}, ${142 + shade}, ${108 + shade})`);
      g.addColorStop(0.45, `rgb(${232 + shade}, ${196 + shade}, ${164 + shade})`);
      g.addColorStop(1, `rgb(${168 + shade}, ${128 + shade}, ${96 + shade})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, ry, 16, 30);

      const bg = btx.createLinearGradient(x, ry, x + 16, ry);
      bg.addColorStop(0, '#5a5a5a');
      bg.addColorStop(0.45, '#ebebeb');
      bg.addColorStop(1, '#5a5a5a');
      btx.fillStyle = bg;
      btx.fillRect(x + 1, ry + 1, 14, 29);
    }
    ctx.fillStyle = 'rgba(130, 96, 68, 0.36)';
    ctx.fillRect(0, ry + 30, 256, 2);
    btx.fillStyle = '#383838';
    btx.fillRect(0, ry + 30, 256, 2);
  }

  const map = new THREE.CanvasTexture(cv);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.2, 2.2);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bv);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2.2, 2.2);
  bumpMap.colorSpace = THREE.NoColorSpace;

  return { map, bumpMap };
}

export function makeWoodTextures() {
  const cv = document.createElement('canvas');
  const bv = document.createElement('canvas');
  cv.width = bv.width = 256;
  cv.height = bv.height = 256;
  const ctx = cv.getContext('2d');
  const btx = bv.getContext('2d');

  ctx.fillStyle = '#a88766';
  ctx.fillRect(0, 0, 256, 256);
  btx.fillStyle = '#a8a8a8';
  btx.fillRect(0, 0, 256, 256);

  const rand = makeSeededRand(551);
  for (let i = 0; i < 120; i++) {
    const y = rand() * 256;
    const h = 1 + rand() * 2.6;
    const tone = rand() > 0.5;
    ctx.fillStyle = tone ? 'rgba(220, 195, 165, 0.16)' : 'rgba(104, 78, 52, 0.18)';
    ctx.fillRect(0, y, 256, h);
    btx.fillStyle = tone ? 'rgba(235, 235, 235, 0.22)' : 'rgba(70, 70, 70, 0.24)';
    btx.fillRect(0, y, 256, h);
  }

  const map = new THREE.CanvasTexture(cv);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bv);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.colorSpace = THREE.NoColorSpace;

  return { map, bumpMap };
}

export function makeLinenBumpTexture(repeatX = 6, repeatY = 6) {
  const bv = document.createElement('canvas');
  bv.width = bv.height = 128;
  const btx = bv.getContext('2d');
  btx.fillStyle = '#a0a0a0';
  btx.fillRect(0, 0, 128, 128);

  for (let y = 0; y < 128; y += 4) {
    btx.fillStyle = (y % 8 === 0) ? 'rgba(230,230,230,0.38)' : 'rgba(85,85,85,0.28)';
    btx.fillRect(0, y, 128, 2);
  }
  for (let x = 0; x < 128; x += 4) {
    btx.fillStyle = (x % 8 === 0) ? 'rgba(225,225,225,0.34)' : 'rgba(80,80,80,0.26)';
    btx.fillRect(x, 0, 2, 128);
  }

  const bumpMap = new THREE.CanvasTexture(bv);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeatX, repeatY);
  bumpMap.colorSpace = THREE.NoColorSpace;
  return bumpMap;
}

export function makeMeadowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#eff1e6';
  ctx.fillRect(0, 0, 256, 256);

  const rand = makeSeededRand(1337);
  for (let i = 0; i < 2400; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 1.0 + rand() * 3.2;
    const light = rand() > 0.46;
    ctx.fillStyle = light ? 'rgba(255, 254, 244, 0.16)' : 'rgba(182, 196, 164, 0.18)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(44, 52);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makePlazaCobbleTextures() {
  const cv = document.createElement('canvas');
  const bv = document.createElement('canvas');
  cv.width = bv.width = 256;
  cv.height = bv.height = 256;
  const ctx = cv.getContext('2d');
  const btx = bv.getContext('2d');

  ctx.fillStyle = '#cfc3ad';
  ctx.fillRect(0, 0, 256, 256);
  btx.fillStyle = '#404040';
  btx.fillRect(0, 0, 256, 256);

  const rand = makeSeededRand(812);
  const rows = 8;
  const rh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * 16;
    for (let x = -32; x < 256; x += 32) {
      const shade = Math.floor((rand() - 0.5) * 18);
      ctx.fillStyle = `rgb(${226 + shade}, ${216 + shade}, ${196 + shade})`;
      ctx.beginPath();
      ctx.roundRect(x + offset + 2, r * rh + 2, 28, rh - 4, 5);
      ctx.fill();

      const bVal = 195 + Math.floor(rand() * 45);
      btx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
      btx.beginPath();
      btx.roundRect(x + offset + 3, r * rh + 3, 26, rh - 6, 5);
      btx.fill();
    }
  }

  const map = new THREE.CanvasTexture(cv);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6.5, 6.5);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bv);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(6.5, 6.5);
  bumpMap.colorSpace = THREE.NoColorSpace;

  return { map, bumpMap };
}

export function makeBalloonEnvelopeTexture() {
  // Crisp 16-gore sewn canvas envelope texture (70:25:5 palette, ZERO text)
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 512;
  const ctx = cv.getContext('2d');

  const gores = 16;
  const gw = cv.width / gores;
  const bands = 6;
  const bh = cv.height / bands;

  for (let g = 0; g < gores; g++) {
    const x = g * gw;
    let mainColor = g % 2 === 0 ? '#f4ecdc' : '#eae0ca';
    if (g % 4 === 1) mainColor = '#a89ad0';
    ctx.fillStyle = mainColor;
    ctx.fillRect(x, 0, gw, cv.height);

    const grad = ctx.createLinearGradient(x, 0, x + gw, 0);
    grad.addColorStop(0, 'rgba(130, 114, 96, 0.16)');
    grad.addColorStop(0.5, 'rgba(255, 252, 245, 0.14)');
    grad.addColorStop(1, 'rgba(130, 114, 96, 0.16)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, gw, cv.height);
  }

  // Crown cap
  ctx.fillStyle = '#e89e6c';
  ctx.fillRect(0, 0, cv.width, Math.round(cv.height * 0.12));

  // Upper shoulder thin turquoise trim ring
  ctx.fillStyle = '#4aa8a6';
  ctx.fillRect(0, Math.round(cv.height * 0.12), cv.width, Math.round(cv.height * 0.03));

  // Equatorial accent bands
  const bandTop = Math.round(cv.height * 0.42);
  const bandMid = Math.round(cv.height * 0.50);
  const bandBot = Math.round(cv.height * 0.58);
  ctx.fillStyle = '#e89e6c';
  ctx.fillRect(0, bandTop, cv.width, bandMid - bandTop);
  ctx.fillStyle = '#4aa8a6';
  ctx.fillRect(0, bandMid, cv.width, bandBot - bandMid);

  // Cream diamond pattern along the apricot band (zero text)
  ctx.fillStyle = '#f4ecdc';
  for (let g = 0; g < gores; g++) {
    const cx = (g + 0.5) * gw;
    const cy = (bandTop + bandMid) * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 13);
    ctx.lineTo(cx + 12, cy);
    ctx.lineTo(cx, cy + 13);
    ctx.lineTo(cx - 12, cy);
    ctx.closePath();
    ctx.fill();
  }

  // Lower throat apron trim
  ctx.fillStyle = '#e6d8be';
  ctx.fillRect(0, Math.round(cv.height * 0.90), cv.width, Math.round(cv.height * 0.10));
  ctx.fillStyle = '#e89e6c';
  ctx.fillRect(0, Math.round(cv.height * 0.88), cv.width, Math.round(cv.height * 0.025));

  // Crisp stitched vertical gore seams & horizontal panel seams
  ctx.strokeStyle = 'rgba(138, 120, 98, 0.40)';
  ctx.lineWidth = 2;
  for (let g = 0; g <= gores; g++) {
    const x = g * gw;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, cv.height);
    ctx.stroke();
  }
  for (let b = 1; b < bands; b++) {
    const y = b * bh;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cv.width, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeAwningTexture(stripeHex = '#e89e6c') {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f4ecdc';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = stripeHex;
  for (let x = 0; x < 128; x += 32) {
    ctx.fillRect(x, 0, 16, 128);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSoftDotTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255, 250, 240, 1)');
  g.addColorStop(0.45, 'rgba(255, 245, 224, 0.55)');
  g.addColorStop(1, 'rgba(255, 245, 224, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSunbeamTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(64, 256);
  for (let y = 0; y < 256; y++) {
    const vy = y / 255;
    const fadeY = Math.sin(vy * Math.PI);
    const topFade = Math.pow(fadeY, 0.85) * (1 - vy * 0.25);
    for (let x = 0; x < 64; x++) {
      const vx = (x / 63) * 2 - 1;
      const fadeX = Math.pow(Math.max(0, 1 - vx * vx), 1.8);
      const a = Math.round(topFade * fadeX * 255);
      const idx = (y * 64 + x) * 4;
      img.data[idx] = 255;
      img.data[idx + 1] = 244;
      img.data[idx + 2] = 216;
      img.data[idx + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
