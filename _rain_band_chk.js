// _rain_band_chk.js — THE RAIN BANDING METER (the mobile "horizontal white waves" fix).
// Runs the REAL weather/streak code out of index.html as a phone would: frames that land on
// the loop's dt clamp (0.05s = 20fps), the 30fps cap, a 12fps grind and the 60fps baseline,
// then measures the streak field's HEIGHT LADDER — how many distinct heights the 220 streaks
// occupy and how many share one exact height. A field integrated on the raw frame dt
// phase-locks: every drop takes the same step and re-enters on the same line, so the sheet
// collapses onto ~26-43 exact heights with 12-15 streaks stacked on each — collinear 1px
// lines = horizontal white bars that slide together in waves. The fixed-timestep +
// per-streak-rate field must never pile up, at any frame rate, and must keep wall-clock time.
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
let pass = 0;
function check(name, cond, info) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { console.error(' FAIL ' + name + (info ? ' :: ' + info : '')); process.exitCode = 1; }
}
function grab(start, end) {
  const i = html.indexOf(start);
  if (i < 0) throw new Error('missing: ' + start);
  const j = html.indexOf(end, i);
  if (j < 0) throw new Error('missing end: ' + end);
  return html.slice(i, j);
}
function runWeather() {
  const THREE = {
    BufferGeometry: function () { this.attributes = {}; this.setAttribute = (n, a) => { this.attributes[n] = a; }; this.dispose = () => {}; },
    BufferAttribute: function (arr, size) { this.array = arr; this.size = size; this.needsUpdate = false; },
    LineBasicMaterial: function (o) { this.o = o; this.dispose = () => {}; },
    LineSegments: function (g, m) { this.geometry = g; this.material = m; this.frustumCulled = true; },
    PlaneGeometry: function (a, b) { this.dispose = () => {}; },
    MeshBasicMaterial: function (o) { this.o = o; this.opacity = 1; this.dispose = () => {}; },
    Mesh: function (g, m) { this.geometry = g; this.material = m; this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }; this.rotation = { x: 0, y: 0, z: 0 }; },
    DoubleSide: 2,
  };
  const scene = { background: { setHex(c) { this.hex = c; } }, fog: { color: { setHex(c) { this.hex = c; } }, near: 60, far: 160 }, add(o) { o.parent = scene; }, remove(o) { o.parent = null; } };
  const camera = { isCam: true, add(o) { o.parent = camera; }, remove(o) { o.parent = null; } };
  const dirLight = { intensity: 0.75, color: { setHex(c) { this.hex = c; } } };
  const ambientLight = { intensity: 0.78 };
  const R = (a, b) => a + Math.random() * (b - a);
  const src = 'let SUN_X0 = -25, SUN_Y0 = 28, SUN_Z0 = 58;\n' + grab('let _lanePrevWy = 0; // previous frame', 'let state = "menu",');
  const f = new Function(
    'THREE', 'scene', 'dirLight', 'ambientLight', 'R', 'camFollowX', 'p', 'camera', 'state',
    src + '\nreturn { rollWeather, updateWeatherRain, getRain: () => weatherRain, getPos: () => weatherRain.pos, getSpd: () => weatherRain.spd, splashEvents: () => weatherRain.splashFired, setGustNext: v => { gustNext = v; }, setGust: v => { gustT = v; } };'
  );
  return f(THREE, scene, dirLight, ambientLight, R, 42, { wx: 5, wy: 2.5 }, camera, 'play');
}
// Rain for `frames` frames of `dt`, starting from a settled sheet.
function shower(dt, frames) {
  const api = runWeather();
  api.rollWeather({ special: true }); // always rain, on REAL randomness
  const warm = Math.ceil(24 / (8.5 * 0.72 * dt)) + 20; // every streak lands at least once
  for (let i = 0; i < warm + frames; i++) api.updateWeatherRain(dt);
  const P = api.getPos();
  const n = api.getRain().n;
  const rung = new Map(); // height -> streaks standing on it
  let min = 1e9, max = -1e9;
  for (let i = 0; i < n; i++) {
    const y = P[i * 6 + 1];
    min = Math.min(min, y); max = Math.max(max, y);
    const k = y.toFixed(6);
    rung.set(k, (rung.get(k) || 0) + 1);
  }
  let deepest = 0;
  for (const v of rung.values()) deepest = Math.max(deepest, v);
  return { heights: rung.size, deepest, min, max, n };
}
const fmt = (r) => 'heights=' + r.heights + '/' + r.n + ' deepest=' + r.deepest + ' span=[' + r.min.toFixed(1) + ',' + r.max.toFixed(1) + ']';
console.log('---- the streak field height ladder, by frame rate ----');
const r20 = shower(0.05, 60); // the stalled mobile frame (the loop's dt clamp)
console.log('  20fps grind  : ' + fmt(r20));
const r30 = shower(1 / 30, 120); // the 30fps cap
console.log('  30fps cap    : ' + fmt(r30));
const r60 = shower(1 / 60, 240); // the desktop baseline
console.log('  60fps smooth : ' + fmt(r60));
const r12 = shower(0.0833, 40); // a 12fps worst case
console.log('  12fps wreck  : ' + fmt(r12));
check('no frame rate collapses the field onto a height ladder (>= 150 distinct of 220 at 20fps, 30fps, 60fps and 12fps)', r20.heights >= 150 && r30.heights >= 150 && r60.heights >= 150 && r12.heights >= 150, fmt(r20) + ' | ' + fmt(r12));
check('no rung holds a row of streaks (the horizontal white bar): <= 4 share any exact height', r20.deepest <= 4 && r30.deepest <= 4 && r60.deepest <= 4 && r12.deepest <= 4, fmt(r20) + ' | ' + fmt(r30));
check('the sheet stays in its box at every frame rate (-9.6 .. 12.6u)', [r20, r30, r60, r12].every((r) => r.min > -9.6 && r.max < 12.6), fmt(r12));
// ---- the frame rate must not change the STORM'S CLOCK ----
function medianFall(api, pos, n, dt, frames) {
  const before = [];
  for (let i = 0; i < n; i++) before.push(pos[i * 6 + 1]);
  for (let i = 0; i < frames; i++) api.updateWeatherRain(dt);
  const d = [];
  for (let i = 0; i < n; i++) {
    const dd = before[i] - pos[i * 6 + 1];
    if (dd > 0 && dd < 6) d.push(dd); // the streaks that did NOT land in this window
  }
  d.sort((a, b) => a - b);
  return d.length ? d[(d.length / 2) | 0] : 0;
}
{
  const api = runWeather();
  api.rollWeather({ special: true });
  for (let i = 0; i < 60; i++) api.updateWeatherRain(1 / 60); // settle the sheet
  const pos = api.getPos();
  const n = api.getRain().n;
  const f60 = medianFall(api, pos, n, 1 / 60, 30); // 0.5s of rain at 60fps
  const f20 = medianFall(api, pos, n, 0.05, 10); // the same 0.5s, stalled at 20fps
  const ratio = f60 > 0 ? f20 / f60 : 0;
  check('0.5s of rain falls the SAME distance at 60fps and at 20fps (no out-of-sync lurch)', ratio > 0.93 && ratio < 1.07, 'f60=' + f60.toFixed(3) + ' f20=' + f20.toFixed(3) + ' ratio=' + ratio.toFixed(3));
}
{
  const landings = (dt, frames) => {
    const api = runWeather();
    api.rollWeather({ special: true });
    for (let i = 0; i < frames; i++) api.updateWeatherRain(dt);
    return api.splashEvents();
  };
  const l60 = landings(1 / 60, 180); // 3s of rain at 60fps
  const l20 = landings(0.05, 60); // ...the same 3s stalled
  const ratio = l60 > 0 ? l20 / l60 : 0;
  check('the same 3 seconds land the same number of drops at 60fps and at 20fps (the splash clock is honest)', ratio > 0.75 && ratio < 1.3, 'l60=' + l60 + ' l20=' + l20 + ' ratio=' + ratio.toFixed(3));
}
{
  // A held gust must not walk the sheet out of the frustum (the old field only randomised x
  // on landing, so a 6.1u/sec gust shoved the whole left half of the screen off frame).
  const api = runWeather();
  api.rollWeather({ special: true });
  for (let i = 0; i < 260; i++) {
    api.setGustNext(0); // a gust on every frame: the shove never lets up
    api.updateWeatherRain(0.05);
  }
  const P = api.getPos();
  const n = api.getRain().n;
  let out = 0;
  for (let i = 0; i < n; i++) {
    const x = P[i * 6];
    if (x < -16.001 || x > 16.001) out++;
  }
  check('a relentless gust keeps every streak inside the ±16 box (no streak-free half screen)', out === 0, 'out=' + out);
}
console.log('\n' + pass + ' checks passed' + (process.exitCode ? ' (WITH FAILURES)' : ''));

