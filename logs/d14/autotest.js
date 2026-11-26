// usage: node autotest.js <base> <WxH> <q> <shotPrefix|-> [maxSec] [rotate] [speed]
// Drives games/d14/index.html?autotest (the page swipes through its own pointer handlers).
const { chromium } = require('playwright');
(async () => {
  const [base, size, q, shots, maxSecS, rot, speed] = process.argv.slice(2);
  const [w, h] = size.split('x').map(Number), maxSec = +(maxSecS || 900);
  const url = `${base}/games/d14/index.html?autotest&q=${q}${speed ? '&speed=' + speed : ''}`;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const cons = [];
  // the play-log endpoint is unreachable from this sandbox; answer it locally so it does not show up as a network error
  await p.route(/gf-playlog\.[^/]+\.workers\.dev/, r => r.fulfill({ status: 204, body: '' }));
  p.on('console', m => { if (m.type() === 'error') cons.push(m.text().slice(0, 300)); });
  p.on('pageerror', e => cons.push('pageerror ' + e.message));
  const ext = []; p.on('request', r => { const u = r.url(); if (/gf-playlog\.[^/]+\.workers\.dev/.test(u)) return; if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) ext.push(u.replace(/^(https?:\/\/[^/]+).*/, '$1')); });
  console.log(`== ${size} ${url}`);
  const t0 = Date.now();
  await p.goto(url);
  let ready = false;
  try { await p.waitForFunction(() => window.__ready === true, null, { timeout: 90000 }); ready = true; } catch (e) {}
  console.log(`__ready=${ready} after ${Date.now() - t0}ms`);
  let last = '', lastN = -1, done = false, rotated = 0;
  const shotsTaken = {};
  const st = { tS: 0, tOut: 0, tx0: 100, tx1: 0, ty0: 100, ty1: 0, sS: 0, sOut: 0, cS: 0, cOut: 0, cT: [] };
  const shot = async (name) => {
    if (shots === '-' || shotsTaken[name]) return; shotsTaken[name] = 1;
    await p.evaluate(() => { window.__atHold = true; });
    await p.screenshot({ path: `${shots}-${name}.jpg`, type: 'jpeg', quality: 82 });
    await p.evaluate(() => { window.__atHold = false; });
    console.log(`  shot ${name}`);
  };
  while ((Date.now() - t0) / 1000 < maxSec) {
    const s = await p.evaluate(() => { const d = window.__d14; return { state: d.state, n: d.n, stage: d.stage, lift: d.lift, speed: d.speed, q: d.q, fps: d.fps, freeN: d.freeN, settled: d.settled, done: d.done, ct: d.climaxT, hints: d.hints, v: d.view() }; });
    const t = ((Date.now() - t0) / 1000).toFixed(1), v = s.v;
    if (s.state !== last || s.n !== lastN) {
      console.log(`t=${t}s state=${s.state} n=${s.n} stage=${s.stage} lift=${s.lift} speed=${s.speed} free=${s.freeN} hints=${s.hints} q=${s.q} fps=${s.fps} target=${v.target.join('%,')}% ship=[${v.ship.join(',')}] camS=${v.camS} sunEl=${v.sunEl}`);
      last = s.state; lastN = s.n;
    }
    if (s.settled) {
      st.tS++; const [x, y] = v.target;
      st.tx0 = Math.min(st.tx0, x); st.tx1 = Math.max(st.tx1, x); st.ty0 = Math.min(st.ty0, y); st.ty1 = Math.max(st.ty1, y);
      if (Math.abs(x - 50) > 5 || Math.abs(y - 50) > 5) st.tOut++;
    }
    if (s.state !== 'CLIMAX') { st.sS++; const d = v.ship; if (d[0] < 1 || d[1] < 1 || d[2] > 99 || d[3] > 99) st.sOut++; }
    else if (s.ct > 1.5) {
      st.cS++; const d = v.ship, [x, y] = v.target;
      if (d[0] < 1 || d[1] < 1 || d[2] > 99 || d[3] > 99 || Math.abs(x - 50) > 6 || Math.abs(y - 50) > 6) st.cOut++;
      st.cT.push(`${x},${y}`);
    }
    if (rot && !rotated && s.n === 8 && s.state === 'ASCEND') { rotated = 1; await p.setViewportSize({ width: h, height: w }); console.log(`  viewport rotated to ${h}x${w} (n=${s.n})`); }
    if (rot && rotated === 1 && s.n === 9 && s.state === 'ASCEND') { rotated = 2; await p.setViewportSize({ width: w, height: h }); console.log(`  viewport rotated back to ${w}x${h} (n=${s.n})`); }
    if (s.n === 1 && s.state === 'ASCEND') await shot('early-light');
    if (s.n === 2 && s.settled) await shot('early');
    if (s.n === 12 && s.settled) await shot('mid');
    if (s.n === 16 && s.settled) await shot('cloudtop');
    if (s.n === 19 && s.settled) await shot('before-climax');
    if (s.state === 'CLIMAX' && s.ct > 4.5) await shot('climax');
    if (s.state === 'CLIMAX' && s.ct > 9) await shot('climax2');
    if (s.state === 'FREE_PLAY' && s.freeN >= 1) await shot('free');
    if (s.done) { done = true; break; }
    await p.waitForTimeout(150);
  }
  const fin = await p.evaluate(() => ({ errors: window.__errors, ready: window.__ready, seen: window.__d14.seen, taps: window.__d14.taps, gestures: window.__d14.gestures, n: window.__d14.n, freeN: window.__d14.freeN, lift: window.__d14.lift, hints: window.__d14.hints }));
  console.log(`target while waiting (x%,y% from top-left): x ${st.tx0}..${st.tx1}, y ${st.ty0}..${st.ty1}; off centre by >5%: ${st.tOut}/${st.tS}`);
  console.log(`ship bbox outside screen (outside CLIMAX): ${st.sOut}/${st.sS}`);
  console.log(`climax: light centre off centre >6% or ship outside: ${st.cOut}/${st.cS}; last centre samples ${st.cT.slice(-3).join(' | ')}`);
  console.log(`final: n=${fin.n} free=${fin.freeN} lift=${fin.lift} taps=${fin.taps} gestures=${fin.gestures} hints=${fin.hints} states=${fin.seen.join('>')}`);
  console.log(`__ready=${fin.ready} __errors=${JSON.stringify(fin.errors)} consoleErrors=${JSON.stringify(cons)} externalRequests=${JSON.stringify([...new Set(ext)])}`);
  const need = ['START', 'WAIT_WIND', 'WIND_BURST', 'SUNLIGHT', 'ASCEND', 'NEXT_TARGET', 'CLIMAX', 'FREE_PLAY'];
  const pass = fin.ready && fin.errors.length === 0 && cons.length === 0 && done && fin.n === 20 && fin.freeN >= 2 && need.every(x => fin.seen.includes(x));
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
  await b.close();
})();
