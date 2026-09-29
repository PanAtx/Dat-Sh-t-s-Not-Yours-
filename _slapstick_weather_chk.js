// _slapstick_weather_chk.js — the slapstick hit reactions (squash-stretch, hat pop, bag
// cascade, dizzy stars) + the per-shift random weather (sun angle, sky, fog, rain streaks).
// Static asserts on the wiring + functional runs of rollWeather / updateWeatherRain /
// updateGag against the REAL code extracted verbatim from index.html.
const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
let pass = 0;
function check(name, cond, info) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { console.error(' FAIL ' + name + (info ? ' :: ' + info : '')); process.exitCode = 1; }
}
function grab(start, end) {
  const i = html.indexOf(start);
  assert(i >= 0, 'missing: ' + start);
  const j = html.indexOf(end, i);
  assert(j > i, 'missing end after: ' + start);
  return html.slice(i, j);
}
function extractFn(src, name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('not found: ' + name);
  const b = src.indexOf('{', idx);
  let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(idx, i);
}
function withRand(v, f) { const r = Math.random; Math.random = v; try { return f(); } finally { Math.random = r; } }

// ---- 1) wiring ------------------------------------------------------------------------
check('buildWorker wraps cap + brim in a hat pivot', grab('function buildWorker() {', '// ==================== 3D ASSET PIPELINE').includes('const hat = new THREE.Group();'));
check('buildWorker returns the hat rig part', /hat: hat,/.test(html));
check('doStun kicks the 0.9s slapstick reaction', /p\.gagT = 0\.9;/.test(html));
check('doStun: hit = full reaction, trip = modest pop', /p\.gagHard = type === "hit" \? 1 : 0\.45;/.test(html));
check('updateGag runs every play frame from updatePlayer', html.includes('updateGag(dt); // slapstick hit reaction'));
check('a knocked drop flags the Bag Cascade', grab('function dropCarried() {', 'const item = carried;').includes('p.dropGag = true;'));
check('the rainy-shift Karen quip fires once per day on a drop', html.includes("It's raining. I can see it.") && /p\.rainQuip = true;/.test(html));
check('rain ticks every live frame from the main loop', html.includes('updateWeatherRain(dt); // the storm keeps falling'));
check('resetWorldState clears the gag state', /p\.gagT = 0; \/\/ fresh shift/.test(html));
check('the down sequence ends the gag + reseats the cap', grab('function startDyingSequence() {', 'function updateDying(dt) {').includes('worker.hat.position.z = 1.87'));
check('the route-end cinematic reseats the cap', grab('function startRouteEnd() {', 'const boxW =').includes('worker.hat.position.z = 1.87'));
check('the day card names the weather', /d\.borough \+ " \\u00b7 " \+ d\.area \+ " \\u00b7 " \+ WEATHERS\[weather\]\.label/.test(html));
check('rollWeather fires from showDayIntro (new sky per shift)', grab('function showDayIntro() {', 'const sp = $("day-intro-special");').includes('rollWeather(d);'));

// ---- 2) weather table + weather-driven sun base ---------------------------------------
check('four skies defined', ['sunny', 'overcast', 'rain', 'dusk'].every((k) => html.includes(k + ': { label: ')));
check('sunny = the classic look byte-for-byte (amb .78, sun .75, sky 0x9fb6c9, fog 60/160)', /sunny: \{ label: "SUNNY", sunX: -25, sunY: 28, sunZ: 58, amb: 0\.78, sunI: 0\.75, sunC: 0xfff2dd, sky: 0x9fb6c9, fogNear: 60, fogFar: 160, rain: false, temp: \[74, 88\], dayLine: "Clear all day" \}/.test(html));
check('dusk sinks the sun low (z 34) for long golden shadows', /dusk: \{[^}]*sunZ: 34/.test(html));
check('SUN_X0/SUN_Y0/SUN_Z0 default to the classic offset', /let SUN_X0 = -25,\s+SUN_Y0 = 28,\s+SUN_Z0 = 58;/.test(html));
check('positionCamera reads the weather-driven sun base', html.includes('snappedY + SUN_Y0, SUN_Z0 - SUN_DIP * zt'));

// ---- 3) rollWeather + rain field: functional -------------------------------------------
function runWeather() {
  const THREE = {
    BufferGeometry: function () { this.attributes = {}; this.setAttribute = (n, a) => { this.attributes[n] = a; }; this.dispose = () => {}; },
    BufferAttribute: function (arr, size) { this.array = arr; this.size = size; this.needsUpdate = false; },
    PointsMaterial: function (o) { this.o = o; this.dispose = () => {}; },
    Points: function (g, m) { this.geometry = g; this.material = m; this.frustumCulled = true; this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }; },
    LineBasicMaterial: function (o) { this.o = o; this.dispose = () => {}; },
    LineSegments: function (g, m) { this.geometry = g; this.material = m; this.frustumCulled = true; this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }; },
    PlaneGeometry: function (a, b) {},
    MeshBasicMaterial: function (o) { this.o = o; this.opacity = 1; this.dispose = () => {}; },
    Mesh: function (g, m) { this.geometry = g; this.material = m; this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }; this.rotation = { x: 0, y: 0, z: 0 }; },
    DoubleSide: 2,
  };
  const scene = {
    background: { setHex(c) { this.hex = c; } },
    fog: { color: { setHex(c) { this.hex = c; } }, near: 60, far: 160 },
    add(o) { o.parent = scene; },
    remove(o) { o.parent = null; },
  };
  const camera = { isCam: true, add(o) { o.parent = camera; }, remove(o) { o.parent = null; } }; // the rain field is parented to the camera
  const dirLight = { intensity: 0.75, color: { setHex(c) { this.hex = c; } } };
  const ambientLight = { intensity: 0.78 };
  const R = (a, b) => a + Math.random() * (b - a);
  const src =
    'let SUN_X0 = -25, SUN_Y0 = 28, SUN_Z0 = 58;\n' + // the classic defaults (declared above the weather block in index.html)
    grab('let _lanePrevWy = 0; // previous frame', 'let state = "menu",');
  const fn = new Function(
    'THREE', 'scene', 'dirLight', 'ambientLight', 'R', 'camFollowX', 'p', 'camera',
    src + '\nreturn { rollWeather, updateWeatherRain, getWeather: () => weather, getSUN: () => [SUN_X0, SUN_Y0, SUN_Z0], getRain: () => weatherRain, getAmb: () => ambientLight.intensity, getSunI: () => dirLight.intensity, getSky: () => scene.background.hex, getFog: () => [scene.fog.near, scene.fog.far], getTemp: () => weatherTemp, getForecast: () => updateWeatherHud(), getDayForecast: () => weatherIcon() + " " + weatherTemp + "\u00B0F \u00b7 " + WEATHERS[weather].dayLine, countSplashes: () => { let c = 0; for (let i = 0; i < weatherRain.splashN; i++) if (weatherRain.life[i] > 0) c++; return c; }, setStormNext: v => { stormNext = v; }, setGust: v => { gustT = v; }, setGustNext: v => { gustNext = v; }, getPapers: () => gustPapers.length, getPaperList: () => gustPapers, getPuddles: () => weatherPuddles, WEATHERS };'
  );
  return fn(THREE, scene, dirLight, ambientLight, R, 42, { wx: 5, wy: 2.5 }, camera);
}

const wDusk = runWeather();
const rDusk = withRand(() => 0.99, () => wDusk.rollWeather({})); // (0.99*5)|0 = 4 -> dusk
check('roll (rnd 0.99) -> DUSK', rDusk === 'dusk', rDusk);
check('dusk re-aims the sun base to [-44, 16, 34]', JSON.stringify(wDusk.getSUN()) === '[-44,16,34]', JSON.stringify(wDusk.getSUN()));
check('dusk light is warm + strong (0.95), ambient drops to 0.62, sky amber', wDusk.getSunI() === 0.95 && wDusk.getAmb() === 0.62 && wDusk.getSky() === 0xa8836a);

const wSunny = runWeather();
const rSunny = withRand(() => 0, () => wSunny.rollWeather({})); // (0*5)|0 = 0 -> sunny
check('roll (rnd 0) -> SUNNY keeps the classic sun [-25, 28, 58]', rSunny === 'sunny' && JSON.stringify(wSunny.getSUN()) === '[-25,28,58]', JSON.stringify(wSunny.getSUN()));
check('sunny light = the original 0.75 / ambient 0.78 / sky 0x9fb6c9 / fog 60-160', wSunny.getSunI() === 0.75 && wSunny.getAmb() === 0.78 && wSunny.getSky() === 0x9fb6c9 && JSON.stringify(wSunny.getFog()) === '[60,160]');

const wRain = runWeather();
const rRain = withRand(() => 0.5, () => wRain.rollWeather({ special: true }));
check('Bed-Stuy special day ALWAYS rolls rain (theme matches the sky)', rRain === 'rain', rRain);
check('rain builds the 220-streak + 120-splash pool, parented to the CAMERA', !!(wRain.getRain() && wRain.getRain().n === 220 && wRain.getRain().splashN === 120 && wRain.getRain().streaks.parent && wRain.getRain().streaks.parent.isCam === true && wRain.getRain().splashes.parent.isCam === true));
check('rain streak material is fog-immune + non-wrapping (visible over the sky, not washed out)', wRain.getRain().streaks.material.o.fog === false && wRain.getRain().streaks.material.o.depthWrite === false);
check('rain pushes fog closer (38/120) + dark slate sky', JSON.stringify(wRain.getFog()) === '[38,120]' && wRain.getSky() === 0x75848f);
check('rain rolls a temperature inside its range (52..64°F)', wRain.getTemp() >= 52 && wRain.getTemp() <= 64, String(wRain.getTemp()));
check('the forecast string carries icon + sky + temperature', /☔ RAIN · \d+°F/.test(wRain.getForecast()), wRain.getForecast());

const rw = runWeather();
withRand(() => 0.5, () => rw.rollWeather({ special: true }));
withRand(() => 0.5, () => {
  for (let i = 0; i < 200; i++) rw.updateWeatherRain(0.016); // ~3.2s of rain: every streak lands and wraps
});
check('landing streaks fire splash bursts (pool active after the rain falls)', rw.countSplashes() > 0, String(rw.countSplashes()));
check('splash is the simple see-through blue dash (no vertex-color fade — that multiplied to black spikes)', /0xbfe0f5/.test(html) && !/vertexColors: true,/.test(html) && /opacity: 0\.7,/.test(html));

// ---- day card forecast panel --------------------------------------------------------------
check('day card has a forecast panel (icon + temp + sky line)', /id="day-intro-forecast"/.test(html) && /dayLine:/.test(html) && /\$\("day-intro-forecast"\)\.textContent/.test(html));
{
  const wf = runWeather();
  withRand(() => 0.5, () => wf.rollWeather({ special: true }));
  check('the day card forecast reads icon + temp + the sky line', /☔ \d+°F · Precip 90% — bring the umbrella/.test(wf.getDayForecast()), wf.getDayForecast());
}

// ---- wind gusts ---------------------------------------------------------------------------
check('gusts slant the streaks harder + drive the drops down faster', /0\.09 \+ 0\.28 \* gustK/.test(html) && /0\.63 \+ 5\.5 \* gustK/.test(html) && /8\.5 \+ 2\.2 \* gustK/.test(html));
check('a gust SHORTENS the streaks (long diagonals read as streaks, not drops)', /0\.5 \* \(1 - 0\.62 \* gustK\)/.test(html) && /P\[o \+ 4\] = y \+ streakLen;/.test(html));
check('a gust rattles a paper into the street + rolls its own thunderclap', /if \(gustPapers\.length < 2\) spawnGustPaper\(\);/.test(html) && /the gust's own thunderclap/.test(html));
check('the gust whoosh is bandpassed noise + a low pressure dip, scaled by gust length', /playGustSound\(power\) \{[\s\S]{0,250}noise\(0\.5 \+ 0\.6 \* k, "bandpass", 520 - 180 \* k/.test(html) && /SFX\.playGustSound\(gustT\); \/\/ the whoosh hits/.test(html));
{
  const wp = runWeather();
  withRand(() => 0.5, () => wp.rollWeather({ special: true }));
  const PUD = wp.getPuddles();
  check('rainy shift lays 3 glossy wet patches on the street (camera-parented)', PUD.length === 3 && PUD.every((g) => g.parent && g.parent.isCam === true && g.material.o.opacity === 0.45), String(PUD.length));
  check('the puddle sheen picks up the streaks\' blue (0x5d7d99)', /color: 0x5d7d99/.test(html));
}
{
  const wg = runWeather();
  withRand(() => 0.5, () => wg.rollWeather({ special: true }));
  withRand(() => 0.5, () => {
    wg.setGust(1); // mid-gust
    wg.updateWeatherRain(0.016);
  });
  const G = wg.getRain().pos;
  check('mid-gust streak slant is ~0.37u (calm is 0.09u)', Math.abs(G[3] - G[0] - 0.37) < 0.01, String(G[3] - G[0]));
  check('mid-gust streaks shorten (0.5u -> ~0.19u)', Math.abs(G[4] - G[1] - 0.19) < 0.01, String(G[4] - G[1]));
  withRand(() => 0.5, () => {
    wg.setGustNext(0); // fire a gust now
    wg.updateWeatherRain(0.016);
    wg.updateWeatherRain(0.016);
  });
  check('a gust fired a paper into the street', wg.getPapers() > 0, String(wg.getPapers()));
}
check('settled papers hop when a gust hits (lift + tumble + drift + land)', /if \(q\.landed && q\.fade > 0\.4\) q\.hopT = 0\.7;/.test(html) && /0\.36 \+ Math\.sin\(hk \* Math\.PI\) \* 0\.9/.test(html) && /g\.position\.x \+= 3\.5 \* dt; \/\/ carried along by the wind/.test(html));
{
  const wh = runWeather();
  withRand(() => 0.5, () => wh.rollWeather({ special: true }));
  withRand(() => 0.5, () => { wh.setGustNext(0); wh.updateWeatherRain(0.016); });
  for (let i = 0; i < 200; i++) withRand(() => 0.5, () => wh.updateWeatherRain(0.016)); // let the sheet settle
  const settled = wh.getPaperList()[0];
  check('the first sheet is settled on the pavement', settled.landed === true && Math.abs(settled.g.position.z - 0.36) < 1e-6, String(settled.g.position.z));
  withRand(() => 0.5, () => {
    wh.setGustNext(0); // the next gust catches it
    wh.updateWeatherRain(0.016);
    wh.updateWeatherRain(0.016);
  });
  check('a new gust lifts the settled paper and makes it hop + tumble', wh.getPaperList()[0].hopT > 0 && wh.getPaperList()[0].g.position.z > 0.4, String(wh.getPaperList()[0].g.position.z));
}

// ---- no-repeat rule: the week visibly changes level to level -----------------------------
function withRandSeq(vals, fn) {
  const orig = Math.random;
  let i = 0;
  Math.random = () => vals[i++ % vals.length];
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}
{
  const w2 = runWeather();
  const a = withRandSeq([0], () => w2.rollWeather({})); // (0*5)|0 -> sunny
  const b = withRandSeq([0, 0.2, 0.5], () => w2.rollWeather({})); // sunny again -> 0.2 < 0.7 re-roll -> (0.5*4)|0 = 2 -> rain
  check('no-repeat rule: a 2nd same sky is re-rolled (sunny -> rainy week keeps moving)', a === 'sunny' && b === 'rain', a + ' -> ' + b);
}
// ---- forecast corner replaces the in-game build tag ---------------------------------------
check('version IIFE no longer owns the HUD corner (forecast does)', /var vs = \["app-version"\];/.test(html) && /updateWeatherHud\(\); \/\/ the bottom-left forecast/.test(html));
check('hud-version fallback is the forecast, not a build tag', /id="hud-version">☀ SUNNY · 78°F/.test(html));

// ---- 4) updateGag: squash-stretch + hat pop + bag cascade -------------------------------
function runGag() {
  const src = extractFn(html, 'updateGag');
  const scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
  const worker = { group: { scale, rotation: { x: 0 } }, hat: { position: { z: 1.87 }, rotation: { x: 0 } } };
  const wparts = { armL: { rotation: { y: 0 } }, armR: { rotation: { y: 0 } } };
  const p = { wx: 5, wy: 2.5, gagT: 0.9, gagHard: 1, dropGag: true };
  let stars = 0;
  const api = new Function('worker', 'wparts', 'p', 'spawnStars', src + '\nreturn updateGag;')(worker, wparts, p, () => stars++);
  return { api, worker, wparts, p, stars: () => stars };
}
{
  const g = runGag();
  withRand(() => 0, () => { // stars always spawn (0 < dt*10)
    g.api(0.05);
    check('impact frame: body squashed (short + wide)', g.worker.group.scale.z < 1 && g.worker.group.scale.x > 1, JSON.stringify(g.worker.group.scale));
    check('hat is airborne on the first frame', g.worker.hat.position.z > 1.87, 'z=' + g.worker.hat.position.z);
    check('bag cascade windmills both arms', g.wparts.armL.rotation.y !== 0 && g.wparts.armR.rotation.y !== 0, JSON.stringify([g.wparts.armL.rotation.y, g.wparts.armR.rotation.y]));
    check('bag cascade pitches the body (face-plant stagger)', g.worker.group.rotation.x !== 0, 'rx=' + g.worker.group.rotation.x);
    for (let i = 0; i < 17; i++) g.api(0.05);
  });
  check('gag settles: scale back to 1, hat re-capped', g.worker.group.scale.z === 1 && g.worker.group.scale.x === 1 && g.worker.hat.position.z === 1.87 && g.worker.hat.rotation.x === 0, JSON.stringify({ s: g.worker.group.scale.z, hz: g.worker.hat.position.z }));
  check('hard hit showered dizzy stars', g.stars() > 0, 'stars=' + g.stars());
  check('dropGag is consumed once the gag ends', g.p.dropGag === false);
  const g2 = runGag();
  g2.p.gagHard = 0.45; // trip, not a whack
  g2.p.dropGag = false;
  g2.api(0.05);
  check('trip pop is a MILD squash (not the full whack)', g2.worker.group.scale.z > 0.7 && g2.worker.group.scale.z < 1, 'z=' + g2.worker.group.scale.z);
}

// ---- 5) thunder & lightning ---------------------------------------------------------
check('playThunder is procedural (sub-sine boom + long low rumble)', /playThunder\(\) \{[\s\S]{0,300}lowpass", 85/.test(html));
check('lightning flash lifts the scene lights + settles back', /stormFlash = 0\.32;/.test(html) && /ambientLight\.intensity = SW\.amb \+ 1\.1 \* k;/.test(html));
{
  const wT = runWeather();
  withRand(() => 0.5, () => wT.rollWeather({ special: true }));
  wT.setStormNext(0);
  wT.updateWeatherRain(0.016);
  check('flash frame: ambient surges well above the rain base (0.88)', wT.getAmb() > 0.88 + 0.5, String(wT.getAmb()));
  for (let i = 0; i < 30; i++) wT.updateWeatherRain(0.016);
  check('after the flash the lights settle back to the weather base', Math.abs(wT.getAmb() - 0.88) < 1e-6, String(wT.getAmb()));
}

// ---- 6) wet-street gameplay -----------------------------------------------------------
check('wet-street: cans slide 1.5x farther when tossed in the rain', grab('function dumpCan() {', 'flyingCans.push').includes('weather === "rain" ? 1.5 : 1'));
check('wet-street: knocked items slide a couple of feet in the rain', grab('function dropCarried() {', 'item.kind === "litterbasket"').includes('R(-2.4, 2.4)'));
check('wet-street: random puddle-slip trip (full hit gag) in the rain', /Whoops \u2014 slippery!/.test(html) && /Math\.random\(\) < dt \* 0\.08/.test(html));

// ---- 7) dusk special -------------------------------------------------------------------
check('dusk golden hour: porch bulbs light after the street rebuilds', /if \(weather === "dusk"\) applyDuskLamps\(\);/.test(html));
check('dusk shift line sets the mood', /Dusk shift \u2014 sun's dropping, long shadows out here\./.test(html));
{
  const lit = [];
  const fakeBlocks = [
    {
      g: {
        traverse(fn) {
          fn({ isMesh: true, geometry: { type: 'SphereGeometry' }, position: { z: 2.12 }, material: { color: { setHex() {} }, emissive: { setHex(h) { lit.push(h); } } } }); // the porch bulb
          fn({ isMesh: true, geometry: { type: 'BoxGeometry' }, position: { z: 1.2 }, material: { color: { setHex(h) { lit.push(h); } }, emissive: { setHex(h) { lit.push(h); } } } }); // a door-level box: must NOT light
        },
      },
    },
  ];
  const fn = new Function('blocks', extractFn(html, 'applyDuskLamps') + '\nreturn applyDuskLamps;')(fakeBlocks);
  fn();
  check('applyDuskLamps lights the porch bulb warm (0xffff66) and nothing else', lit.length === 1 && lit[0] === 0xffff66, JSON.stringify(lit));
}

console.log(pass + ' checks passed' + (process.exitCode ? ' (WITH FAILURES)' : ''));