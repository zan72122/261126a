// usage: node autotest.js <base> <WxH> <q> <shotPrefix|-> [maxSec]
const { chromium } = require('playwright');
(async () => {
  const [base, size, q, shots, maxSecS] = process.argv.slice(2);
  const [w, h] = size.split('x').map(Number), maxSec = +(maxSecS || 400);
  const url = `${base}/games/d09/index.html?autotest&q=${q}`;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const cons = [];
  // the play-log endpoint is unreachable from this sandbox; answer it locally so it does not show up as a network error
  await p.route(/gf-playlog\.[^/]+\.workers\.dev/, r => r.fulfill({ status: 204, body: '' }));
  let compT = 0;
  p.on('console', m => { if (m.type() === 'error') cons.push(m.text()); });
  p.on('pageerror', e => cons.push('pageerror ' + e.message));
  const local = []; p.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) local.push(u.replace(/^(https?:\/\/[^/]+).*/, '$1')); });
  console.log(`== ${size} ${url}`);
  const t0 = Date.now();
  await p.goto(url);
  let ready = false;
  try { await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }); ready = true; } catch (e) {}
  console.log(`__ready=${ready} after ${Date.now() - t0}ms`);
  let last = '', lastN = -1, done = false, shotsTaken = {};
  const st = { flowerSamples: 0, flowerOut: 0, fxMin: 100, fxMax: 0, fyMin: 100, fyMax: 0, gateSamples: 0, gateOut: 0, gateMinX: 100, gateMaxX: 0, gateMinY: 100, climaxSamples: 0, climaxOut: 0 };
  const shot = async (name) => { if (shots === '-' || shotsTaken[name]) return; shotsTaken[name] = 1; await p.screenshot({ path: `${shots}-${name}.jpg`, type: 'jpeg', quality: 82 }); console.log(`  shot ${name}`); };
  while ((Date.now() - t0) / 1000 < maxSec) {
    const s = await p.evaluate(() => { const d = window.__d09; return { state: d.state, n: d.n, stage: d.stage, q: d.q, fps: d.fps, counts: d.counts.join(''), seen: d.seen, freeN: d.freeN, sky: d.sky, v: d.view(), boatZ: d.boatZ }; });
    const t = ((Date.now() - t0) / 1000).toFixed(1);
    if (s.state !== last || s.n !== lastN) {
      const v = s.v;
      console.log(`t=${t}s state=${s.state} n=${s.n} stage=${s.stage} bands=${s.counts} free=${s.freeN} boatZ=${s.boatZ} q=${s.q} fps=${s.fps} flower=${v.flower ? v.flower.join('%,') + '%' : '-'} gate L=${v.gateL[0]}% R=${v.gateR[0]}% top=${v.gateTop[1]}% camD=${v.camD}${v.dest ? ' dest=' + v.dest.join('%,') + '%' : ''}`);
      last = s.state; lastN = s.n;
    }
    const v = s.v;
    if (v.flower && (s.state === 'WAIT' || s.state === 'INTRO')) {
      st.flowerSamples++; const [x, y] = v.flower;
      st.fxMin = Math.min(st.fxMin, x); st.fxMax = Math.max(st.fxMax, x); st.fyMin = Math.min(st.fyMin, y); st.fyMax = Math.max(st.fyMax, y);
      if (x < 40 || x > 60 || y < 40 || y > 65) st.flowerOut++;
    }
    if (!s.sky && ['INTRO', 'WAIT', 'COLLECT', 'STAGE', 'COMPLETE'].includes(s.state)) {
      st.gateSamples++;
      const out = v.gateL[0] < 0 || v.gateR[0] > 100 || v.gateTop[1] < 0 || v.gateL[1] > 100;
      if (out) st.gateOut++;
      st.gateMinX = Math.min(st.gateMinX, v.gateL[0]); st.gateMaxX = Math.max(st.gateMaxX, v.gateR[0]); st.gateMinY = Math.min(st.gateMinY, v.gateTop[1]);
      if (s.state === 'COMPLETE') { st.climaxSamples++; if (out || v.gateL[0] < 8 || v.gateR[0] > 92 || v.gateTop[1] < 8) st.climaxOut++; }
    }
    if (s.n === 3 && s.state === 'WAIT') await shot('early');
    if (s.n === 11 && s.state === 'WAIT') await shot('mid');
    if (s.state === 'COMPLETE' && s.seen && s.n === 21) { const tt = await p.evaluate(() => 0); }
    if (s.state === 'COMPLETE') { if (!compT) compT = Date.now(); if (Date.now() - compT > 1300) await shot('complete'); }
    if (s.state === 'PASS' && !s.sky) await shot('pass');
    if (s.state === 'PASS' && s.sky) await shot('sky');
    if (s.state === 'AFTER') await shot('after');
    if (s.state === 'FREE' && s.freeN >= 1) await shot('free');
    if (s.state === 'FREE' && s.freeN >= 3) { done = true; break; }
    await p.waitForTimeout(120);
  }
  if (shots !== '-') { await p.screenshot({ path: `${shots}-end.jpg`, type: 'jpeg', quality: 82 }); }
  const fin = await p.evaluate(() => ({ errors: window.__errors, ready: window.__ready, seen: window.__d09.seen, counts: window.__d09.counts.join(''), taps: window.__d09.taps, n: window.__d09.n, freeN: window.__d09.freeN }));
  console.log(`flower position while waiting (x%,y% from top-left): x ${st.fxMin}..${st.fxMax}, y ${st.fyMin}..${st.fyMax}; outside 40-60/40-65: ${st.flowerOut}/${st.flowerSamples}`);
  console.log(`gate in view (cove): samples=${st.gateSamples} cut=${st.gateOut} leftmost=${st.gateMinX}% rightmost=${st.gateMaxX}% topmost=${st.gateMinY}%; climax(COMPLETE) samples=${st.climaxSamples} outside 8% margin=${st.climaxOut}`);
  console.log(`final: n=${fin.n} bands=${fin.counts} free=${fin.freeN} taps=${fin.taps} states=${fin.seen.join('>')}`);
  console.log(`__ready=${fin.ready} __errors=${JSON.stringify(fin.errors)} consoleErrors=${JSON.stringify(cons)} externalRequests=${JSON.stringify(local)}`);
  const pass = fin.ready && fin.errors.length === 0 && cons.length === 0 && done && fin.n === 21 && ['COMPLETE', 'PASS', 'AFTER', 'FREE'].every(x => fin.seen.includes(x));
  console.log(pass ? 'RESULT: PASS' : 'RESULT: FAIL');
  await b.close();
})();
