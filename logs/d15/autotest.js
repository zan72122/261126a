// usage: node autotest.js <base> <WxH> <q> <shotPrefix|-> [maxSec] [rotate]
// Drives games/d15/index.html?autotest (the page taps its own rings through the normal pointer handlers).
const { chromium } = require('playwright');
(async () => {
  const [base, size, q, shots, maxSecS, rot] = process.argv.slice(2);
  const [w, h] = size.split('x').map(Number), maxSec = +(maxSecS || 900);
  const url = `${base}/games/d15/index.html?autotest&q=${q}`;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const cons = [], info = [];
  await p.route(/gf-playlog\.[^/]+\.workers\.dev/, r => r.fulfill({ status: 204, body: '' }));
  p.on('console', m => { if (m.type() === 'error') cons.push(m.text().slice(0, 300)); else if (m.text().startsWith('[d15]')) info.push(m.text()); });
  p.on('pageerror', e => cons.push('pageerror ' + e.message));
  const ext = []; p.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) ext.push(u.replace(/^(https?:\/\/[^/]+).*/, '$1')); });
  console.log(`== ${size} ${url}`);
  const t0 = Date.now();
  await p.goto(url);
  let ready = false;
  try { await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }); ready = true; } catch (e) {}
  console.log(`__ready=${ready} after ${Date.now() - t0}ms`);
  let last = '', lastN = -1, done = false, rotated = 0, climaxT = 0;
  const taken = {};
  const st = { tS: 0, tOut: 0, tx0: 100, tx1: 0, ty0: 100, ty1: 0, dS: 0, dOut: 0, cS: 0, cOut: 0, eShort: [] };
  const shot = async (name) => { if (shots === '-' || taken[name]) return; taken[name] = 1; await p.evaluate(() => { window.__atHold = true; }); await p.waitForTimeout(50); await p.screenshot({ path: `${shots}-${name}.jpg`, type: 'jpeg', quality: 80 }); await p.evaluate(() => { window.__atHold = false; }); console.log(`  shot ${name}`); };
  while ((Date.now() - t0) / 1000 < maxSec) {
    let s;
    try { s = await p.evaluate(() => { const d = window.__d15; return { state: d.state, n: d.n, stage: d.stage, q: d.q, fps: d.fps, settled: d.settled, done: d.done, climax: d.climax, v: d.view() }; }); }
    catch (e) { console.log('eval failed ' + e.message); break; }
    const t = ((Date.now() - t0) / 1000).toFixed(1), v = s.v;
    if (s.state !== last || s.n !== lastN) {
      console.log(`t=${t}s state=${s.state} n=${s.n} stage=${s.stage} q=${s.q} fps=${s.fps} target=${(v.target || []).join('%,')}% dolphin=[${v.dolphin.join(',')}] camD=${v.camD}`);
      last = s.state; lastN = s.n;
    }
    if (s.settled && v.target) {
      st.tS++; const [x, y] = v.target;
      st.tx0 = Math.min(st.tx0, x); st.tx1 = Math.max(st.tx1, x); st.ty0 = Math.min(st.ty0, y); st.ty1 = Math.max(st.ty1, y);
      if (Math.abs(x - 50) > 5 || Math.abs(y - 50) > 5) st.tOut++;
    }
    if (['READY', 'APPROACH', 'WAIT_INPUT', 'TRANSITION', 'BOOST'].includes(s.state)) {
      st.dS++; const d = v.dolphin; if (d[0] < 0 || d[1] < 0 || d[2] > 100 || d[3] > 100) st.dOut++;
    }
    if (s.state === 'CLIMAX' || s.state === 'AFTERGLOW') {
      if (!climaxT) climaxT = Date.now();
      if (s.state === 'AFTERGLOW') {
        st.cS++; const e = v.earth, d = v.dolphin;
        if (e[0] < 0 || e[1] < 0 || e[2] > 100 || e[3] > 100 || d[0] < 0 || d[1] < 0 || d[2] > 100 || d[3] > 100) st.cOut++;
        st.eShort.push(v.earthShort);
      }
    }
    if (rot && !rotated && s.n === 9 && s.state === 'APPROACH') { rotated = 1; await p.setViewportSize({ width: h, height: w }); console.log(`  viewport rotated to ${h}x${w}`); }
    if (rot && rotated === 1 && s.n === 10 && s.state === 'APPROACH') { rotated = 2; await p.setViewportSize({ width: w, height: h }); console.log(`  viewport rotated back to ${w}x${h}`); }
    if (s.n === 0 && s.state === 'READY' && (Date.now() - t0) > 4000) await shot('start');
    if (s.n === 4 && s.state === 'WAIT_INPUT') await shot('early');
    if (s.n === 7 && s.state === 'APPROACH') await shot('stars');
    if (s.n === 10 && s.state === 'WAIT_INPUT') await shot('moon');
    if (s.n === 15 && s.state === 'WAIT_INPUT') await shot('mid');
    if (s.n === 16 && s.state === 'WAIT_INPUT') await shot('rings');
    if (s.n === 22 && s.state === 'WAIT_INPUT') await shot('earthring');
    if (s.state === 'CLIMAX' && climaxT && Date.now() - climaxT > 3500) await shot('climax');
    if (s.state === 'AFTERGLOW' && s.settled) await shot('climax2');
    if (s.done) { done = true; break; }
    await p.waitForTimeout(150);
  }
  const fin = await p.evaluate(() => ({ errors: window.__errors, ready: window.__ready, seen: window.__d15.seen, taps: window.__d15.taps, n: window.__d15.n, climax: window.__d15.climax }));
  console.log(`target while waiting (x%,y% from top-left): x ${st.tx0}..${st.tx1}, y ${st.ty0}..${st.ty1}; off centre by >5%: ${st.tOut}/${st.tS}`);
  console.log(`dolphin bbox outside screen during play: ${st.dOut}/${st.dS}`);
  console.log(`afterglow: earth(+atmosphere)/dolphin outside screen: ${st.cOut}/${st.cS}; earth diameter / short side %: ${st.eShort.slice(-3).join(', ')}`);
  console.log('page log: ' + info.filter(x => /stage|climax|autotest|quality/.test(x)).join(' | '));
  console.log(`final: n=${fin.n} climax=${fin.climax} taps=${fin.taps} states=${fin.seen.join('>')}`);
  console.log(`__ready=${fin.ready} __errors=${JSON.stringify(fin.errors)} consoleErrors=${JSON.stringify(cons)} externalRequests=${JSON.stringify([...new Set(ext)])}`);
  const need = ['READY', 'BOOST', 'APPROACH', 'WAIT_INPUT', 'TRANSITION', 'CLIMAX', 'AFTERGLOW', 'RESTART'];
  const pass = fin.ready && fin.errors.length === 0 && cons.length === 0 && done && fin.climax && need.every(x => fin.seen.includes(x));
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
  await b.close();
})();
