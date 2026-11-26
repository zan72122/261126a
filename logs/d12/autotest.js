// usage: node autotest.js <base> <WxH> <q> <shotPrefix|-> [maxSec] [rotate]
// Drives games/d12/index.html?autotest (the page taps its own petal swirl through the normal pointer handlers).
const { chromium } = require('playwright');
(async () => {
  const [base, size, q, shots, maxSecS, rot] = process.argv.slice(2);
  const [w, h] = size.split('x').map(Number), maxSec = +(maxSecS || 600);
  const url = `${base}/games/d12/index.html?autotest&q=${q}`;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const cons = [];
  // the play-log endpoint is unreachable from this sandbox; answer it locally so it does not show up as a network error
  await p.route(/gf-playlog\.[^/]+\.workers\.dev/, r => r.fulfill({ status: 204, body: '' }));
  p.on('console', m => { if (m.type() === 'error') cons.push(m.text().slice(0, 300)); });
  p.on('pageerror', e => cons.push('pageerror ' + e.message));
  const ext = []; p.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) ext.push(u.replace(/^(https?:\/\/[^/]+).*/, '$1')); });
  console.log(`== ${size} ${url}`);
  const t0 = Date.now();
  await p.goto(url);
  let ready = false;
  try { await p.waitForFunction(() => window.__ready === true, null, { timeout: 90000 }); ready = true; } catch (e) {}
  console.log(`__ready=${ready} after ${Date.now() - t0}ms`);
  let last = '', lastN = -1, done = false, rotated = 0;
  const shotsTaken = {};
  const st = { tS: 0, tOut: 0, tx0: 100, tx1: 0, ty0: 100, ty1: 0, dS: 0, dOut: 0, cS: 0, cOut: 0, cTgt: [] };
  const shot = async (name) => { if (shots === '-' || shotsTaken[name]) return; shotsTaken[name] = 1; await p.evaluate(() => { window.__atHold = true; }); await p.screenshot({ path: `${shots}-${name}.jpg`, type: 'jpeg', quality: 80 }); await p.evaluate(() => { window.__atHold = false; }); console.log(`  shot ${name}`); };
  let climaxT = 0;
  while ((Date.now() - t0) / 1000 < maxSec) {
    const s = await p.evaluate(() => { const d = window.__d12; return { state: d.state, n: d.n, stage: d.stage, q: d.q, fps: d.fps, lit: d.lit, vis: d.visited, freeN: d.freeN, settled: d.settled, done: d.done, E: d.energy, P: d.P, v: d.view() }; });
    const t = ((Date.now() - t0) / 1000).toFixed(1), v = s.v;
    if (s.state !== last || s.n !== lastN) {
      console.log(`t=${t}s state=${s.state} n=${s.n} stage=${s.stage} lit=${s.lit} visited=${s.vis} free=${s.freeN} P=${s.P} q=${s.q} fps=${s.fps} target=${v.target.join('%,')}% deer=[${v.deer.join(',')}] stars=[${v.stars.join(',')}] camD=${v.camD}`);
      last = s.state; lastN = s.n;
    }
    if (s.settled) {
      st.tS++; const [x, y] = v.target;
      st.tx0 = Math.min(st.tx0, x); st.tx1 = Math.max(st.tx1, x); st.ty0 = Math.min(st.ty0, y); st.ty1 = Math.max(st.ty1, y);
      if (Math.abs(x - 50) > 6 || Math.abs(y - 50) > 6) st.tOut++;
    }
    if (['WAITING_FOR_TAP', 'COLLECTING_PETALS', 'BUILDING_PATH', 'RUNNING', 'FREE_PLAY'].includes(s.state)) {
      st.dS++; const d = v.deer; if (d[0] < 2 || d[1] < 2 || d[2] > 98 || d[3] > 98) st.dOut++;
    }
    if (s.state === 'CLIMAX' || s.state === 'AFTERGLOW') {
      if (!climaxT) climaxT = Date.now();
      if (Date.now() - climaxT > 6000) {
        st.cS++; const a = v.stars, d = v.deer;
        if (a[0] < 8 || a[1] < 8 || a[2] > 92 || a[3] > 92 || d[0] < 2 || d[1] < 2 || d[2] > 98 || d[3] > 98) st.cOut++;
        st.cTgt.push(v.starCen.join(','));
      }
    }
    if (rot && !rotated && s.n === 9 && s.state === 'RUNNING') { rotated = 1; await p.setViewportSize({ width: h, height: w }); console.log(`  viewport rotated to ${h}x${w} (n=${s.n})`); }
    if (rot && rotated === 1 && s.n === 10 && s.state === 'RUNNING') { rotated = 2; await p.setViewportSize({ width: w, height: h }); console.log(`  viewport rotated back to ${w}x${h} (n=${s.n})`); }
    if (s.n === 3 && s.settled) await shot('early');
    if (s.n === 13 && s.settled) await shot('mid');
    if (s.n === 20 && s.settled) await shot('stars');
    if (s.state === 'CLIMAX' && climaxT && Date.now() - climaxT > 5500) await shot('climax');
    if (s.state === 'AFTERGLOW') await shot('after');
    if (s.state === 'FREE_PLAY' && s.freeN >= 1) await shot('free');
    if (s.done) { done = true; break; }
    await p.waitForTimeout(150);
  }
  const fin = await p.evaluate(() => ({ errors: window.__errors, ready: window.__ready, seen: window.__d12.seen, lit: window.__d12.lit, vis: window.__d12.visited, taps: window.__d12.taps, n: window.__d12.n, freeN: window.__d12.freeN }));
  console.log(`target while waiting (x%,y% from top-left): x ${st.tx0}..${st.tx1}, y ${st.ty0}..${st.ty1}; off centre by >6%: ${st.tOut}/${st.tS}`);
  console.log(`deer bbox outside screen during play: ${st.dOut}/${st.dS}`);
  console.log(`climax/afterglow: seven stars + deer outside 8% margin: ${st.cOut}/${st.cS}; star centre samples ${st.cTgt.slice(-3).join(' | ')}`);
  console.log(`final: n=${fin.n} lit=${fin.lit} visited=${fin.vis} free=${fin.freeN} taps=${fin.taps} states=${fin.seen.join('>')}`);
  console.log(`__ready=${fin.ready} __errors=${JSON.stringify(fin.errors)} consoleErrors=${JSON.stringify(cons)} externalRequests=${JSON.stringify([...new Set(ext)])}`);
  const need = ['WAITING_FOR_TAP', 'COLLECTING_PETALS', 'BUILDING_PATH', 'RUNNING', 'CLIMAX', 'AFTERGLOW', 'FREE_PLAY'];
  const pass = fin.ready && fin.errors.length === 0 && cons.length === 0 && done && fin.n === 25 && fin.lit === '1111111' && fin.vis === '1111111' && need.every(x => fin.seen.includes(x));
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
  await b.close();
})();
