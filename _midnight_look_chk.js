// _midnight_look_chk.js — THE MIDNIGHT LOOK: the haunted shift must LOOK like midnight.
// A dark moonlit block (no sun), street lamps that lean their pooled light out OVER THE ROAD,
// a share of the brownstone windows burning yellow, and a worker who STAYS HI-VIS YELLOW: his
// white striping kicks the light straight back at the camera (retroreflection) — night only,
// the seven weekdays left pixel-for-pixel as they were.
// PART 1 wiring (greps on the shipped file)  PART 2 the real functions, run headless against
// a mock Bed-Stuy block built with the REAL three r128.
const fs = require('fs');
const path = require('path');
const THREE = require(path.join(__dirname, 'three_r128.min.js'));
// THE HAZARD CLOCK IS THE WALL CLOCK (the same one the truck's lenses blink on), so the
// harness owns it: setNow(t) puts the whole game on second t of the 2-second DSNY pattern.
let FAKE_NOW = 0;
Object.defineProperty(globalThis, "performance", { value: { now: () => FAKE_NOW * 1000 }, configurable: true, writable: true });
const setNow = (t) => { FAKE_NOW = t; };
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
// THE MIDNIGHT-ONLY SET + the shelf, read out of the shipped files (never hardcoded here)
const NIGHT_BLOCK = (html.match(/const NIGHT_MUSIC_TRACKS = (\[[\s\S]*?\]);/) || [])[1] || '[]';
const NIGHT_THEME = (html.match(/const NIGHT_MUSIC_TRACK = "([^"]+)"/) || [])[1] || '';
const NIGHT_TRACKS = new Function('const NIGHT_MUSIC_TRACK = ' + JSON.stringify(NIGHT_THEME) + '; return ' + NIGHT_BLOCK + ';')();
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, 'music', 'manifest.json'), 'utf8'));
const musicManifest = MANIFEST;
const nightSrc = (name) => {
  // an OBJECT METHOD (name(...) {) or a plain function name(...)
  let i = html.indexOf('function ' + name + '(');
  if (i < 0) {
    const m = html.match(new RegExp("[\\r\\n\\t ]" + name + "\\s*\\([^)]*\\)\\s*\\{"));
    if (!m) return '';
    i = html.indexOf(name, m.index);
  }
  if (i < 0) return '';
  let j = html.indexOf('{', i), d = 0;
  for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}') { d--; if (!d) { j++; break; } } }
  return html.slice(i, j);
};
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  const info = name + (extra === undefined ? '' : '  [' + extra + ']');
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + info); failures.push(info); }
}
function srcFn(name) {
  const idx = html.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function not found: ' + name);
  let i = html.indexOf('{', idx), d = 0;
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(idx, i);
}
function srcNum(name) {
  const m = html.match(new RegExp('const\\s+' + name + '\\s*=\\s*(-?[0-9.]+)'));
  if (!m) throw new Error('constant not found: ' + name);
  return Number(m[1]);
}
const NIGHT_AMB = srcNum('NIGHT_AMB'), NIGHT_MOON_I = srcNum('NIGHT_MOON_I');
const NIGHT_LAMP_POOL = srcNum('NIGHT_LAMP_POOL'), NIGHT_LAMP_EVERY = srcNum('NIGHT_LAMP_EVERY');
const NIGHT_LAMP_I = srcNum('NIGHT_LAMP_I'), NIGHT_WIN_SHARE = srcNum('NIGHT_WIN_SHARE');
const NIGHT_RETRO_GAIN = srcNum('NIGHT_RETRO_GAIN'), NIGHT_RETRO_MAX = srcNum('NIGHT_RETRO_MAX');
const NIGHT_HIVIS_GLOW = srcNum('NIGHT_HIVIS_GLOW'), NIGHT_LAMP_TIP = srcNum('NIGHT_LAMP_TIP');
const NIGHT_LAMP_FOOT = srcNum('NIGHT_LAMP_FOOT'), NIGHT_WALK_TOP = srcNum('NIGHT_WALK_TOP');
const NIGHT_LAMP_NEAR = srcNum('NIGHT_LAMP_NEAR'), NIGHT_LAMP_BOOST = srcNum('NIGHT_LAMP_BOOST');
const NIGHT_RETRO_BAND = srcNum('NIGHT_RETRO_BAND'), NIGHT_POOL_Z = srcNum('NIGHT_POOL_Z');
const WALK_LINE = 0.75 + 0.35 + NIGHT_LAMP_FOOT; // curbClearY(NIGHT_LAMP_FOOT), the shipped rule
const NIGHT_LAMP_C = parseInt(html.match(/const NIGHT_LAMP_C = (0x[0-9a-fA-F]+);/)[1], 16);
const HI_VIS_YELLOW = parseInt(html.match(/const hiVis = M\((0x[0-9a-fA-F]+)\);/)[1], 16);
const lumOf = (hex) => (0.299 * ((hex >> 16) & 255) + 0.587 * ((hex >> 8) & 255) + 0.114 * (hex & 255)) / 255;
const NIGHT_LAMP_Y = srcNum('NIGHT_LAMP_Y'), NIGHT_POOL_OP = srcNum('NIGHT_POOL_OP');
const RETRO_N = srcNum('RETRO_N'), NIGHT_LAMP_R = srcNum('NIGHT_LAMP_R'), NIGHT_WIN_I = srcNum('NIGHT_WIN_I');
const NIGHT_LAMP_LAMPS = srcNum('NIGHT_LAMP_LAMPS'), NIGHT_TRUCK_R = srcNum('NIGHT_TRUCK_R');
const NIGHT_TRUCK_I = srcNum('NIGHT_TRUCK_I'), NIGHT_TRUCK_PROBE = srcNum('NIGHT_TRUCK_PROBE');
const NIGHT_LAMP_LENS_I = srcNum('NIGHT_LAMP_LENS_I'), NIGHT_LAMP_HALO_OP = srcNum('NIGHT_LAMP_HALO_OP');
const NIGHT_SHAFT_OP = srcNum('NIGHT_SHAFT_OP'), NIGHT_WIN_GLOW = srcNum('NIGHT_WIN_GLOW');
const NIGHT_GLOW_ECTO = srcNum('NIGHT_GLOW_ECTO'), NIGHT_GLOW_AURA = srcNum('NIGHT_GLOW_AURA');
const NIGHT_GLOW_BODY = srcNum('NIGHT_GLOW_BODY'), NIGHT_TRUCK_GLOW = srcNum('NIGHT_TRUCK_GLOW');
const NIGHT_ECTO_SIZE = srcNum('NIGHT_ECTO_SIZE');
const NIGHT_TRACK_M = html.match(/const NIGHT_MUSIC_TRACK = "([^"]+)";/);
const NIGHT_TRACK = NIGHT_TRACK_M ? NIGHT_TRACK_M[1] : '';
const GZv = 0.3, BWv = 8;

console.log('[1] THE SKY: the sun is OFF the haunted shift and a moon takes its place');
check('MIDNIGHT IS DARK: ambient floor ' + NIGHT_AMB + ' (was 0.32; the brief asks for NIGHT)',
  NIGHT_AMB > 0.05 && NIGHT_AMB <= 0.2);
check('the moon is thin, not a second sun (' + NIGHT_MOON_I + '), and the lamps are strong (' + NIGHT_LAMP_I + ')',
  NIGHT_MOON_I <= 0.4 && NIGHT_LAMP_I >= 1.6 && NIGHT_POOL_OP >= 0.5 && NIGHT_LAMP_LENS_I >= 5);
check('the moon is the only directional and it is cold (' + NIGHT_MOON_I + ')', NIGHT_MOON_I > 0.2 && NIGHT_MOON_I < 0.7);
check('applyNightPalette re-aims the per-frame sun line at the moon bearing',
  /SUN_X0 = NIGHT_MOON_X;[\s\S]{0,80}SUN_Y0 = NIGHT_MOON_Y;[\s\S]{0,80}SUN_Z0 = NIGHT_MOON_Z;/.test(srcFn('applyNightPalette')));
check('sky + fog are repainted to near-black navy with a real fog wall',
  /scene\.background\.setHex\(NIGHT_SKY\)/.test(srcFn('applyNightPalette')) &&
    /scene\.fog\.color\.setHex\(NIGHT_FOG_C\)/.test(srcFn('applyNightPalette')));
check('the midnight sky is DARKER than every daytime sky (0x03060f)',
  parseInt(html.match(/const NIGHT_SKY = (0x[0-9a-fA-F]+);/)[1], 16) <
    parseInt(html.match(/sky: (0x[0-9a-fA-F]+)/)[1], 16));
check('the moon + stars ride the CAMERA (the rain-rig pattern) and are fog-immune',
  /camera\.add\(g\);/.test(srcFn('ensureNightSkyRig')) &&
    /fog: false/.test(srcFn('ensureNightSkyRig')));
check('the stars are drawn FIRST, so the block occludes them', /stars\.renderOrder = -20;/.test(html));
check('the moon texture is a real disc with mare shading, not a glow blob',
  /ctx\.arc\(64, 64, 29, 0, Math\.PI \* 2\)/.test(srcFn('nightMoonTex')) && /\[56, 58, 8\]/.test(srcFn('nightMoonTex')));

console.log('\n[2] THE STREET LAMPS: iron poles ON THE SIDEWALK, sodium heads over the road');
const LAMP_SRC = srcFn('makeStreetLamp');
check('a lamp is pole + shoe + gooseneck arm + head + lens + bulb (' + (LAMP_SRC.match(/g\.add\(/g) || []).length + ' parts)',
  /CY\(0\.07, 0\.11, NIGHT_LAMP_H/.test(LAMP_SRC) && /CY\(0\.055, 0\.055, NIGHT_LAMP_ARM/.test(LAMP_SRC) &&
  /BX\(0\.46, 0\.92, 0\.26, iron\)/.test(LAMP_SRC) && (LAMP_SRC.match(/g\.add\(/g) || []).length >= 6);
check('the pole stands UP the world Z axis (the cylinder axis is Y: rotated)',
  /pole\.rotation\.x = Math\.PI \/ 2;/.test(LAMP_SRC));
check('the head carries a glowing sodium lens + an unlit core for the pooled light to ride',
  /emissive: NIGHT_LAMP_C/.test(LAMP_SRC) && /color: 0xfff8ee, fog: false/.test(LAMP_SRC));
check('every lamp paints a warm POOL on the pavement under it', /NIGHT_POOL_W, NIGHT_POOL_H/.test(LAMP_SRC) && /AdditiveBlending/.test(LAMP_SRC));
check('the lamps light THE STREET: gooseneck, head, lens, core and halo all lean OFF THE CURB on -Y',
  /arm\.position\.set\(0, -NIGHT_LAMP_ARM \/ 2/.test(LAMP_SRC) &&
    /head\.position\.set\(0, -NIGHT_LAMP_ARM,/.test(LAMP_SRC) &&
    /lens\.position\.set\(0, -NIGHT_LAMP_ARM - 0\.1,/.test(LAMP_SRC) &&
    /bulb\.position\.set\(0, -NIGHT_LAMP_ARM - 0\.1,/.test(LAMP_SRC) &&
    /glow\.position\.set\(0, -NIGHT_LAMP_ARM - 0\.1,/.test(LAMP_SRC));
check('the neck is tipped DOWN-AND-OUT and the hood + sodium window droop with it (aim: the road)',
  /arm\.rotation\.x = NIGHT_LAMP_TIP;/.test(LAMP_SRC) &&
    /head\.rotation\.x = NIGHT_LAMP_TIP \+ 0\.16;/.test(LAMP_SRC) &&
    /lens\.rotation\.x = NIGHT_LAMP_TIP \+ 0\.16;/.test(LAMP_SRC) && NIGHT_LAMP_TIP > 0.05);
check('the poles stand ON THE SIDEWALK beside the curb, placed by the games OWN curbClearY keep-out' +
  ' (the hydrant / sidewalk-tree rule: 0.75 walk-side curb face + 0.35 bare concrete + the foot radius)',
  /curbClearY\(NIGHT_LAMP_FOOT\)/.test(srcFn('buildNightLamps')) &&
    NIGHT_LAMP_Y === 0.75 + 0.35 + srcNum('NIGHT_LAMP_FOOT'));
check('the lamp base rides the WALK SLAB (the sidewalk stands 0.35 proud of the asphalt, so the pole is' +
  ' planted on the walk, never sunk on the curb strip)',
  /lamp\.g\.position\.set\(jx, lampY, GZ \+ NIGHT_WALK_TOP\)/.test(srcFn('buildNightLamps')) &&
    srcNum('NIGHT_WALK_TOP') === 0.35);
check('lamps are placed every ' + NIGHT_LAMP_EVERY + 'th cell, staggered, on the sidewalk line',
  /cell % NIGHT_LAMP_EVERY !== NIGHT_LAMP_CELL/.test(srcFn('buildNightLamps')) &&
    /lamp\.g\.position\.set\(jx, lampY,/.test(srcFn('buildNightLamps')));
check('a pole is a SOLID obstacle on the walk (registered in b.trees, like the mailbox)',
  /b\.trees\.push\(\{ wx: wx, wy: lampY, kind: "lamp" \}\)/.test(srcFn('buildNightLamps')));
check('the gooseneck reaches PAST the curb strip so the head hangs over the LANE (not over the walk)',
  srcNum('NIGHT_LAMP_ARM') > NIGHT_LAMP_Y - 0.25);
check('the ' + NIGHT_LAMP_LAMPS + ' lamps nearest the worker are pooled (+' + (NIGHT_LAMP_POOL - NIGHT_LAMP_LAMPS) + ' slot for the truck)',
  /for \(let i = 0; i < NIGHT_LAMP_POOL; i\+\+\)/.test(srcFn('ensureNightLampLights')));
check('the pooled lights start at ZERO intensity (no day-level lighting change ever)',
  /new THREE\.PointLight\(NIGHT_LAMP_C, 0,/.test(srcFn('ensureNightLampLights')));

console.log('\n[3] THE WINDOWS: some burn yellow, the rest of the row is dark');
check('the pane signature takes house glass and REFUSES frames, doors and muntins', (() => {
  const f = new Function('nightPaneSpecUnused', 'return ' + srcFn('nightPaneSpec'))();
  const glassOk = f(0.6, 0.04, 0.9) && f(0.7, 0.04, 0.9) && f(0.78, 0.06, 0.78);
  const rejects = !f(0.86, 0.11, 0.86) && !f(0.9, 0.08, 1.7) && !f(0.78, 0.05, 0.06) && !f(2.5, 1.0, 0.06);
  return glassOk && rejects;
})());
check('the lit share of the row is NIGHT_WIN_SHARE in 10 (' + NIGHT_WIN_SHARE + '/10)', NIGHT_WIN_SHARE > 0 && NIGHT_WIN_SHARE <= 10);
check('applyNightWindows is its OWN pass (applyDuskLamps is untouched: porch bulbs only)',
  !/nightWindow/.test(srcFn('applyDuskLamps')) && /nightWindow/.test(srcFn('applyNightWindows')));
check('lit windows get their OWN material (a shared clone would light the whole street)',
  /const m = o\.material\.clone\(\);/.test(srcFn('applyNightWindows')));

console.log('\n[4] THE HI-VIS SHEETING: retroreflection = the light comes back to the eye');
check('the sheen is computed in VIEW space (normalMatrix + modelViewMatrix)',
  /vRetP = \( modelViewMatrix \* vec4\( transformed, 1\.0 \) \)\.xyz;/.test(html) &&
    /vRetN = normalize\( normalMatrix \* objectNormal \);/.test(html));
check('the eye axis is the ORTHO view axis (0,0,1) — striping flashes when it faces the lamp AND the camera',
  /vec3 rV = vec3\( 0\.0, 0\.0, 1\.0 \);/.test(html));
check("the kick is square-on to the LAMP (the physical double term, cubed) times an eye BAND",
  /rSheen \+= uRetCol\[ri\] \* pow\( rNL \* rNL, 3\.0 \) \* rBand \* rFall \* rFall;/.test(html) &&
    /float rBand = 1\.0 - " \+ NIGHT_RETRO_BAND\.toFixed\(3\)/.test(html));
check('THE PROXIMITY FEED: the lamp the worker is standing under drives the striping at full force',
  /const dw = Math\.hypot\(rec\.wx - p\.wx, rec\.wy - p\.wy\);/.test(srcFn('updateNightLamps')) &&
    /const near = Math\.max\(0, 1 - dw \/ NIGHT_LAMP_NEAR\);/.test(srcFn('updateNightLamps')) &&
    /NIGHT_LAMP_BOOST - 1\) \* near \* near;/.test(srcFn('updateNightLamps')) &&
    /retroProbeColor\(U\.col\.value\[1 \+ k\], NIGHT_LAMP_C, f \* boost\)/.test(srcFn('updateNightLamps')));
check('the sheen arms RETRO_N probes (moon + the pooled lights + the truck)',
  new RegExp('#define RETRO_LIGHTS ' + RETRO_N).test(html) && new RegExp('const RETRO_N = ' + RETRO_N + ';').test(html) &&
    RETRO_N === NIGHT_LAMP_POOL + 1);
check('the striping kick is full strength (' + NIGHT_RETRO_GAIN + ') and CLAMPED at ' + NIGHT_RETRO_MAX + ' of white',
  NIGHT_RETRO_GAIN >= 0.9 && NIGHT_RETRO_MAX >= 0.8 && NIGHT_RETRO_MAX < 1.0);
// The striping flash, computed from the shipped constants exactly as the GLSL does it, for a stripe
// square-on to the bulb (rNL 0.86) reading the camera at 0.72, 5 units from the lamp.
const stripFlash = (nl, nv, fall, probeMul) =>
  Math.min(lumOf(NIGHT_LAMP_C) * probeMul * Math.pow(nl * nl, 3) *
    (1 - srcNum('NIGHT_RETRO_BAND') * (1 - nv)) * fall * fall, NIGHT_RETRO_MAX) * NIGHT_RETRO_GAIN;
const flashUnder = stripFlash(0.86, 0.72, 1 - 5 / srcNum('NIGHT_LAMP_R'), 1.08 * NIGHT_LAMP_BOOST);
const flashFar = stripFlash(0.86, 0.72, 1 - 5 / srcNum('NIGHT_LAMP_R'), 1.08);
check('STANDING UNDER THE LAMP the striping blazes: +' + flashUnder.toFixed(2) + ' added white on the stripe',
  flashUnder >= 0.4, 'flash=' + flashUnder.toFixed(3));
check('and it is a blaze-vs-glow: the same stripe by a lamp out of reach keeps a soft sheen only',
  flashFar < flashUnder * 0.55, 'under=' + flashUnder.toFixed(3) + ' far=' + flashFar.toFixed(3));
check('the SHEEN FEED IS ACHROMATIC (a raw amber bulb / cold blue moon is what painted the shirt red and the stripes violet)',
  lumOf(NIGHT_LAMP_C) > 0.75 && /retroProbeColor\(U\.col\.value\[1 \+ k\], NIGHT_LAMP_C/.test(srcFn('updateNightLamps')) &&
    /retroProbeColor\(U\.col\.value\[0\], hex/.test(srcFn('updateNightLamps')));
check('the striping flash is a luminance collapse, clamped, and can never blow past white',
  /vec3\( 0\.299, 0\.587, 0\.114 \)/.test(html) &&
    /rKick = vec3\( min\( rLum, /.test(html) &&
    /gl_FragColor\.rgb = min\( gl_FragColor\.rgb \+ rKick \* uRetGain, vec3\( 1\.0 \)/.test(html));
check('THE SHIRT IS NOT SHEETING: the kick goes on the striping alone (armNightRetro)',
  /patchRetroSheen\(wparts\.stripeMat, NIGHT_RETRO_GAIN/.test(srcFn('armNightRetro')) &&
    !/patchRetroSheen\(wparts\.hiVisMat/.test(srcFn('armNightRetro')));
check('the shirt keeps its OWN hi-vis yellow at midnight (fluorescent self-glow) and the striping stays white',
  /m\.emissive\.setHex\(m\.color && m\.color\.getHex/.test(srcFn('applyNightHiVis')) &&
    /m\.emissiveIntensity = NIGHT_HIVIS_GLOW;/.test(srcFn('applyNightHiVis')) &&
    NIGHT_HIVIS_GLOW > 0.3 && NIGHT_HIVIS_GLOW < 1 && lumOf(HI_VIS_YELLOW) > 0.45);
check('buildWorker exposes the worker\'s own stripes + shirt for the injection',
  /stripeMat: stripe,/.test(html) && /hiVisMat: hiVis,/.test(html));
check('the sheen gain is ZERO off the haunted shift (the seven weekdays are untouched)',
  /return onNight \? 1 : 0;/.test(srcFn('retroGainFor')) &&
    /const g8 = retroGainFor\(on\);/.test(srcFn('updateNightLamps')));
const lam = THREE.ShaderLib.lambert;
check('the injection anchors are REAL chunks of the shipped meshlambert shader',
  lam.vertexShader.indexOf('#include <common>') >= 0 &&
    lam.vertexShader.indexOf('#include <begin_vertex>') >= 0 &&
    lam.fragmentShader.indexOf('#include <common>') >= 0 &&
    lam.fragmentShader.indexOf('#include <dithering_fragment>') >= 0);

console.log('\n[5] HEADLESS RUN: a mock Bed-Stuy row built with the REAL three r128');
// ---- the game's own primitive helpers, mirrored (index.html 7598..7640) ----
function M(c, opt) { return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {})); }
function BX(w, h, d, m) { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.castShadow = true; return q; }
function CY(r1, r2, h, m, s) { const q = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m); q.castShadow = true; return q; }
function SP(r, m, s) { const q = new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m); q.castShadow = true; return q; }
const R = (a, b) => a + Math.random() * (b - a);
const gradMock = { addColorStop() {} };
const documentMock = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => gradMock, fillStyle: '', fillRect() {}, beginPath() {}, arc() {}, fill() {} }) }) };
// ---- 6 blocks x 10 cells of brownstone: 4 glass panes + 4 frames + a door per house ----
const frameM = new THREE.MeshLambertMaterial({ color: 0xffffff });
const doorM = new THREE.MeshLambertMaterial({ color: 0x3a2c20 });
const blocks = [];
for (let b = 0; b < 6; b++)
  for (let i = 0; i < 10; i++) {
    const worldX = b * 80 + i * BWv;
    const hg = new THREE.Group();
    const body = BX(5.2, 4.8, 5.2, M(0x8a5a3b));
    body.position.z = 2.9;
    hg.add(body);
    for (let f = 0; f < 2; f++)
      for (let s = -1; s <= 1; s += 2) {
        const pane = BX(0.78, 0.06, 0.78, M(0x9fd0e8, { emissive: 0x24434f, emissiveIntensity: 0.7 }));
        pane.position.set(s * 1.6, -2.45, 2.5 + f * 1.8);
        hg.add(pane);
        const frame = BX(0.86, 0.11, 0.86, frameM);
        frame.position.set(s * 1.6, -2.4, 2.5 + f * 1.8);
        hg.add(frame);
      }
    const door = BX(0.9, 0.08, 1.7, doorM);
    door.position.set(0, -2.45, 1.25);
    hg.add(door);
    const grp = new THREE.Group();
    grp.position.x = worldX;
    grp.add(hg);
    blocks.push({ group: grp, worldX, blockX: b * 80, hazards: [], trees: [], g: hg, passed: false });
  }
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb6c9);
scene.fog = new THREE.Fog(0x9fb6c9, 60, 160);
const camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 1, 400);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.78);
const dirLight = new THREE.DirectionalLight(0xfff2dd, 0.75);
// The mock worker is planted ON the sidewalk line, UNDER a lamp: the lamps land on cells where
// cell % 3 == 1, so block 1 has them at worldX 88 / 112 / 136, and the lamp line y is the same
// curbClearY() line the builder uses. Standing the worker at x 112 on that line is exactly the
// case the player sees: striping BLAZING under the light.
const p = { wx: 112, wy: 1.34 };
const wparts = {
  stripeMat: new THREE.MeshLambertMaterial({ color: 0xf5f7f2 }),
  hiVisMat: new THREE.MeshLambertMaterial({ color: 0xd8f010 }),
};
// the harness runs the REAL functions, so the constants block it splices in must include the
// NIGHT_SCRATCH colour the probe packer uses (it sits right after RETRO_U in the shipped file)
const radioLocks = [];
const NS_AT = html.indexOf('const NIGHT_SCRATCH =');
const CONSTS = html.slice(
  html.indexOf('const NIGHT_SKY'),
  html.indexOf('null; // probe packing', NS_AT) + 'null; // probe packing'.length + 1,
);
// the GLSL source strings the sheen injection splices in (declared just above retroUniforms)
const SHADER_CONSTS = html.slice(
  html.indexOf('const RETRO_VERT_PARS'),
  html.indexOf('function retroUniforms('),
);
const FUNCS = ['applyNightPalette', 'nightPaneSpec', 'pickNearestLamps', 'retroGainFor', 'nightLampFlicker',
  'nightRadialTex', 'nightMoonTex', 'ensureNightSkyRig', 'clearNightSkyRig', 'makeStreetLamp',
  'nightLampClear', 'buildNightLamps', 'ensureNightLampLights', 'applyNightWindows', 'armMidnightLook', 'retroUniforms',
  'patchRetroSheen', 'armNightRetro', 'applyNightHiVis', 'retroProbeColor', 'updateNightLamps',
  'nightEctoK', 'nightEctoSize', 'applyMidnightMusic', 'registerNightGlowMat', 'scanNightGlow',
  'applyNightGlow', 'nightTruckRadial', 'hazardClock',
  'armNightTruckRig', 'clearNightTruckRig', 'nightTruckRigUpdate', 'blinkHazardLights'].map(srcFn).join('\n');
const api = new Function('THREE', 'M', 'BX', 'CY', 'SP', 'R', 'GZ', 'BW', 'blocks', 'scene', 'camera',
  'dirLight', 'ambientLight', 'p', 'wparts', 'document', 'SFX',
  CONSTS + SHADER_CONSTS +
  // (the rig variables themselves — nightLamps / nightWindows / nightLampLights / nightSkyRig /
  // retroMats / RETRO_U — are ALREADY in CONSTS, straight out of the shipped file)
  'let SUN_X0 = -25, SUN_Y0 = 28, SUN_Z0 = 58; let NIGHT_ON = true;' +
  'let nightGlowMats = [], nightGlowT = -1e9, nightTruckRig = null, nightTruckLights = null;' +
  'let creatureList = [], truck = null, GHOST_OBJECT_MAT = null, GHOST_AURA_MAT = null;' +
  // The harness street is the PLAIN furnished block row (no grave cut), so the bottom
  // cemetery fence is parked off the map here; setFence() drops the real line in when a
  // section wants to prove the fence keep-out.
  'let NIGHT_FENCE_X = -1e6;' +
  'function isNightShift() { return NIGHT_ON; }\n' + FUNCS +
  '\nreturn { applyNightPalette, applyNightWindows, buildNightLamps, armMidnightLook, updateNightLamps,' +
  ' ensureNightSkyRig, clearNightSkyRig, getLamps: () => nightLamps, getWindows: () => nightWindows,' +
  ' getLights: () => nightLampLights, getRig: () => nightSkyRig, getRetroMats: () => retroMats,' +
  ' getUniforms: () => RETRO_U, getLampLamps: () => nightLamps,' +
  ' pickNearest: pickNearestLamps, retroGainFor: retroGainFor, nightLampFlicker: nightLampFlicker,' +
  ' paneSpec: nightPaneSpec,' +
  ' setFence: (v) => { NIGHT_FENCE_X = v; },' +
  ' getSun: () => [SUN_X0, SUN_Y0, SUN_Z0], setNight: (v) => { NIGHT_ON = v; },' +
  ' setTruck: (v) => { truck = v; }, setCreatures: (v) => { creatureList = v; },' +
  ' getGlowMats: () => nightGlowMats, getTruckRig: () => nightTruckRig,' +
  ' getTruckLights: () => nightTruckLights, applyNightGlow, scanNightGlow, nightEctoK,' +
  ' armNightTruckRig, clearNightTruckRig, nightTruckRigUpdate, nightEctoSize, applyMidnightMusic };')(
  THREE, M, BX, CY, SP, R, GZv, BWv, blocks, scene, camera, dirLight, ambientLight, p, wparts,
  documentMock, { radioSticky: (n) => { radioLocks.push(n); return true; } });

// ---- the palette, on the real lights ---------------------------------------------------
api.applyNightPalette();
check('the moonlight palette lands: ambient ' + ambientLight.intensity + ', moon ' + dirLight.intensity +
  ', sky 0x' + scene.background.getHex().toString(16),
  Math.abs(ambientLight.intensity - NIGHT_AMB) < 1e-9 && Math.abs(dirLight.intensity - NIGHT_MOON_I) < 1e-9 &&
    dirLight.color.getHex() === 0x9db4e8 && scene.background.getHex() === 0x03060f,
  'fog ' + scene.fog.near + '/' + scene.fog.far);
check('the shadow light is re-aimed MOONWARD (SUN_* = the moon bearing)',
  JSON.stringify(api.getSun()) === '[-30,26,52]', JSON.stringify(api.getSun()));
check('the fog wall tightens for a night block (near ' + scene.fog.near + ', far ' + scene.fog.far + ')',
  scene.fog.near <= 20 && scene.fog.far <= 90);

// ---- the windows ---------------------------------------------------------------------
const nWin = api.applyNightWindows();
const lit = api.getWindows();
check('the row lights ' + nWin + ' of 240 windows — some, not all, not none',
  nWin >= 72 && nWin <= 120 && lit.length === nWin, (100 * nWin / 240).toFixed(1) + '%');
check('every lit window burns WARM yellow with the shipped glow strength',
  lit.every((o) => o.material.emissive.getHex() === 0xffb44a && Math.abs(o.material.emissiveIntensity - srcNum('NIGHT_WIN_I')) < 1e-9));
check('lit windows use their OWN material (no shared glow washing the whole row)',
  new Set(lit.map((o) => o.material.uuid)).size === lit.length);
let frames = 0, doors = 0, framesOk = true, doorsOk = true;
blocks.forEach((b) => b.g.children.forEach((o) => {
  if (o.material === frameM) { frames++; if (o.material.emissive.getHex() !== 0) framesOk = false; }
  if (o.material === doorM) { doors++; if (o.material.emissive.getHex() !== 0) doorsOk = false; }
}));
check('the frames stay white and the doors stay dark (' + frames + ' frames + ' + doors + ' doors untouched)',
  frames === 240 && doors === 60 && framesOk && doorsOk);
check('lighting is DETERMINISTIC per cell (a replayed shift lights the same windows)', (() => {
  const first = api.applyNightWindows();
  const a = api.getWindows().map((o) => o.uuid).sort().join(',');
  const second = api.applyNightWindows();
  const b2 = api.getWindows().map((o) => o.uuid).sort().join(',');
  return first === second && a === b2;
})());

// ---- the lamps + the sky rig ---------------------------------------------------------
const nLamps = api.buildNightLamps();
// The lamps are deliberately staggered inside their cells, so plant the worker EXACTLY under the
// first lamp's own x/y — that is the case the player is asking about.
p.wx = api.getLamps()[0].wx;
p.wy = api.getLamps()[0].wy;
check('the street gets ' + nLamps + ' lamps (one every ' + NIGHT_LAMP_EVERY + ' cells over 6 blocks)',
  nLamps === 18, 'lamps=' + nLamps);
check('every lamp stands ON the curb line (y=' + NIGHT_LAMP_Y + ') with its pole up the Z axis',
  api.getLamps().every((l) => Math.abs(l.wy - NIGHT_LAMP_Y) < 1e-9 &&
    l.g.children[0].rotation.x === Math.PI / 2 && l.g.children[0].position.z > 2));
check('every pole is registered as a SOLID obstacle the worker walks around',
  blocks.filter((b) => b.trees && b.trees.some((t) => t.kind === 'lamp')).length === 18);
check('the lamps are staggered along their cells, not marched in a lockstep row',
  new Set(api.getLamps().map((l) => l.g.position.x)).size === nLamps);
check('each head has a sodium lens, an additive halo and a warm pool on the pavement',
  api.getLamps().every((l) => l.lens.material.emissive.getHex() === NIGHT_LAMP_C && !!l.glow && !!l.pool &&
    l.glow.material.blending === THREE.AdditiveBlending && l.pool.material.blending === THREE.AdditiveBlending));
check('every head throws a visible SHAFT down onto its pool (additive, double-sided, fog-immune)',
  api.getLamps().every((l) => l.shaft && l.shaft.material.blending === THREE.AdditiveBlending &&
    l.shaft.material.side === THREE.DoubleSide && l.shaft.material.fog === false &&
    l.shaft.geometry.parameters.radiusBottom > l.shaft.geometry.parameters.radiusTop &&
    l.shaft.getWorldPosition(new THREE.Vector3()).z < l.bulb.getWorldPosition(new THREE.Vector3()).z) &&
    srcNum('NIGHT_SHAFT_H') > 4);
check('the pole BASE stands on the sidewalk, clear of the curb strip (y > 0.75), on the walk slab (z = GZ + 0.35)',
  api.getLamps().every((l) => Math.abs(l.wy - WALK_LINE) < 1e-9 &&
    Math.abs(l.g.position.z - (GZv + NIGHT_WALK_TOP)) < 1e-9) && NIGHT_LAMP_Y > 0.75);
check('THE HEAD, THE CORE AND THE HALO REACH PAST THE CURB AND HANG OVER THE ROAD (world -y)',
  api.getLamps().every((l) => {
    const v = new THREE.Vector3();
    l.bulb.getWorldPosition(v);
    return v.y < 0 && l.glow !== null && l.glow.getWorldPosition(new THREE.Vector3()).y < 0;
  }), 'bulb y=' + (api.getLamps()[0].bulb.getWorldPosition(new THREE.Vector3()).y).toFixed(2));
check('the bulb burns NEAR-WHITE sodium, not saturated amber — the lamp is warm, the shirt stays YELLOW',
  NIGHT_LAMP_C === 0xffe4bd && lumOf(NIGHT_LAMP_C) > 0.85 && ((NIGHT_LAMP_C >> 16) & 255) - (NIGHT_LAMP_C & 255) < 90);
check('the pools lie FLAT ON THE ASPHALT (0.12 above the road), centred in the lane — the light is ON THE STREET',
  api.getLamps().every((l) => l.pool.rotation.x === 0 &&
    Math.abs(l.pool.getWorldPosition(new THREE.Vector3()).z - (GZv + 0.12)) < 1e-9 &&
    Math.abs(l.pool.getWorldPosition(new THREE.Vector3()).y - srcNum('NIGHT_POOL_Y')) < 1e-9) &&
    srcNum('NIGHT_POOL_Y') < -1.5 && Math.abs(NIGHT_WALK_TOP + NIGHT_POOL_Z - 0.12) < 1e-9,
  'pool world z=' + api.getLamps()[0].pool.getWorldPosition(new THREE.Vector3()).z.toFixed(2));
check('the ' + NIGHT_LAMP_POOL + ' pooled PointLights exist and are IDLE (zero) until the night frame runs',
  api.getLights().length === NIGHT_LAMP_POOL && api.getLights().every((L) => L.intensity === 0));

// ---- NO POLE STANDS ON A HYDRANT, A MAILBOX OR A TREE ---------------------------------
console.log('\n[2b] THE WALK ROW BELONGS TO ITS FIXTURES: no lamp lands on a hydrant, a mailbox or a tree');
const LAMP_KEEP = srcNum('NIGHT_LAMP_CLEAR');
const LAMP_TRIES_N = srcNum('NIGHT_LAMP_TRIES');
const HY_Y = 0.75 + 0.35 + 0.22, MB_Y = 1.5, TR_Y = 0.75 + 0.35 + 0.52; // the shipped fixture lines
const LAMP_CELLS = () => blocks.filter((b) => Math.round((b.worldX - b.blockX) / 8) % 3 === 1);
(function () {
  const cleanB = () => { blocks.forEach((b) => {
    b.hazards = b.hazards.filter((h) => !h._probe);
    b.trees = b.trees.filter((t) => !t._probe);
  }); };
  const seedAt = (b, rec, list) => { rec._probe = true; b[list].push(rec); };
  const rowFixtures = (b) => [].concat(
    (b.trees || []).filter((t) => t.kind !== "lamp" && Math.abs(t.wy - MB_Y) < 1.2),
    (b.hazards || []).filter((h) => h.type === "hit" && Math.abs(h.wy - HY_Y) < 0.06));
  const allClear = (lamps) => lamps.every((l) => blocks.every((b) =>
    rowFixtures(b).every((f) => !(Math.abs(f.wx - l.wx) < LAMP_KEEP &&
      Math.abs(f.wy - l.wy) < 1.2)) &&
    (b.hazards || []).filter((h) => h.type === "hit" && Math.abs(h.wy - HY_Y) < 0.06)
      .every((h) => Math.abs(h.wx - l.wx) >= LAMP_KEEP)));
  cleanB();
  const n18a = api.buildNightLamps();
  const n18b = api.buildNightLamps();
  check('the plain furnished street keeps its full row — ' + n18a + ' poles, and the same ' + n18b + ' next build (the keep-out costs nothing where nothing stands)',
    n18a === 18 && n18b === 18 && api.getLamps().length === 18, 'a=' + n18a + ' b=' + n18b);
  // hydrant + mailbox + sidewalk tree planted ACROSS the sampled stretch of every lamp cell
  LAMP_CELLS().forEach((b) => {
    seedAt(b, { wx: b.worldX + 1.5, wy: HY_Y, r: 0.75, type: "hit", drop: 0, cd: 0 }, "hazards");
    seedAt(b, { wx: b.worldX + 3.9, wy: MB_Y, kind: "mailbox" }, "trees");
    seedAt(b, { wx: b.worldX + 3.0, wy: TR_Y }, "trees");
  });
  const nF = api.buildNightLamps();
  const lampsF = api.getLamps();
  check('with a hydrant, a mailbox and a tree claiming a fat stretch of its walk row the builder SAMPLES up to ' + LAMP_TRIES_N + ' spots per cell (' + nF + ' poles stand of ' + n18a + ' cells) — every pole it plants squeezed its spot into the clear concrete that is left',
    nF > 0 && allClear(lampsF), 'nF=' + nF);
  check('EVERY pole standing on that furnished street keeps ' + LAMP_KEEP + 'u of clear walk from every hydrant, mailbox and sidewalk tree on its row (the lamp registrations themselves never block a lamp)',
    lampsF.length === nF && allClear(lampsF), 'poles=' + lampsF.length);
  // a FULLY claimed cell: the fixture line covers the WHOLE sampled stretch of every lamp cell
  cleanB();
  LAMP_CELLS().forEach((b) => {
    seedAt(b, { wx: b.worldX + 1.5, wy: HY_Y, r: 0.75, type: "hit", drop: 0, cd: 0 }, "hazards");
    seedAt(b, { wx: b.worldX + 2.75, wy: TR_Y }, "trees");
    seedAt(b, { wx: b.worldX + 4.0, wy: HY_Y, r: 0.75, type: "hit", drop: 0, cd: 0 }, "hazards");
    seedAt(b, { wx: b.worldX + 5.25, wy: MB_Y, kind: "mailbox" }, "trees");
    seedAt(b, { wx: b.worldX + 6.5, wy: HY_Y, r: 0.75, type: "hit", drop: 0, cd: 0 }, "hazards");
  });
  const nFull = api.buildNightLamps();
  check('a cell furnished across its ENTIRE sampled stretch (hydrants, a tree and a mailbox shoulder to shoulder) gets NO pole at all (' + nFull + ' lamps) — the lamp gives the whole cell up, it never stands on top of a fixture',
    nFull === 0 && api.getLamps().length === 0 && allClear(api.getLamps()), 'nFull=' + nFull);
  // off-the-row fixtures are nobody's business: the lawn tree and the road hazard do not claim spots
  cleanB();
  const FAR_Y = TR_Y + 4.5, ROAD_Y = -6;
  LAMP_CELLS().forEach((b) => {
    seedAt(b, { wx: b.worldX + 4.0, wy: FAR_Y }, "trees");
    seedAt(b, { wx: b.worldX + 4.0, wy: FAR_Y + 0.4 }, "trees");
    seedAt(b, { wx: b.worldX + 4.2, wy: ROAD_Y, r: 0.9, type: "hit", drop: 0, cd: 0 }, "hazards");
    seedAt(b, { wx: b.worldX + 4.0, wy: 0.5, r: 0.5, type: "hit", drop: 0, cd: 0 }, "hazards");
  });
  const nFar = api.buildNightLamps();
  check('a lawn tree five steps back from the walk line, a pothole in the road and a curb-level hit hazard own NOTHING on the lamp line — all ' + nFar + ' poles built as on the clean street (the keep-out is a ROW rule, not a ban)',
    nFar === 18 && rowFixtures(LAMP_CELLS()[0]).length === 0, 'nFar=' + nFar);
  cleanB();
})();
// ---- THE BOTTOM CEMETERY FENCE: no pole stands below it ------------------------------
console.log('\n[2c] THE BOTTOM CEMETERY FENCE: the graveyard gets no street furniture');
const GRAVE_FENCE_X = srcNum('NIGHT_FENCE_X');
(function () {
  api.setFence(GRAVE_FENCE_X); // the real border line, read out of the game
  const nCut = api.buildNightLamps();
  const Ls = api.getLamps();
  const minWx = Math.min.apply(null, Ls.map((l) => l.wx));
  check('with the real fence line in (' + GRAVE_FENCE_X + 'u) every pole the builder plants stands ABOVE the iron — ' +
    nCut + ' poles of 18 lamp cells, the ' + (18 - nCut) + ' cells the cemetery owns get none at all',
    nCut < 18 && nCut >= 16 && Ls.length === nCut && Ls.every((l) => l.wx >= GRAVE_FENCE_X + LAMP_KEEP),
    'n=' + nCut + ' nearest pole wx=' + minWx);
  api.setFence(-1e6); // the harness street is a plain furnished block row again
})();
check('the keep-out is driven by the fence constant, not a hard-coded x',
  srcFn('nightLampClear').includes("NIGHT_FENCE_X + NIGHT_LAMP_CLEAR"));
check('the fire hydrant spawner honours the same border: a spot below the fence is refused, and a weekday level (or a Node harness with no night flag) never sees the guard',
  /typeof isNightShift === "function"[\s\S]{0,200}isNightShift\(\)[\s\S]{0,200}wx < NIGHT_FENCE_X/.test(srcFn('addHydrant')));
check('the poured curb stops AT the fence on Midnight and keeps its full shipped length on every weekday',
  srcFn('buildGround').includes('Math.max(bl.x - 1.5, nightCurbCut)') &&
    srcFn('buildGround').includes('isNightShift() && typeof NIGHT_FENCE_X === "number"') &&
    srcFn('buildGround').includes('cs.w < 1'));
api.ensureNightSkyRig();
check('the moon + stars go UP in the sky (parented to the camera, behind the block)',
  !!api.getRig() && api.getRig().children.length === 2 && api.getRig().parent === camera);
check('the sky rig is fog-immune and the stars draw FIRST', (() => {
  const rig = api.getRig();
  const moon = rig.children[0], stars = rig.children[1];
  return moon.material.fog === false && moon.material.depthWrite === false &&
    stars.material.fog === false && stars.renderOrder === -20 && moon.position.z < -50;
})());

// ---- the night frame: pooled lamps, flicker, and the sheen ---------------------------
api.armMidnightLook();
// armMidnightLook REBUILDS the lamps (the stagger is rolled fresh), so plant the worker under a
// lamp of THIS build before the frame runs. With dw = 0 the boost is exactly NIGHT_LAMP_BOOST.
p.wx = api.getLamps()[0].wx;
p.wy = api.getLamps()[0].wy;
api.updateNightLamps(1.0, 1 / 60);
const lights = api.getLights();
check('the ' + NIGHT_LAMP_LAMPS + ' pooled lamp lights burn; the truck slot parks dark with no truck here',
  lights.length === NIGHT_LAMP_POOL && lights.slice(0, NIGHT_LAMP_LAMPS).every((L) => L.intensity > 0 && L.intensity <= NIGHT_LAMP_I * 1.2) &&
    lights.slice(NIGHT_LAMP_LAMPS).every((L) => L.intensity === 0),
  lights.map((L) => L.intensity.toFixed(2)).join('/'));
check('the pooled lights sit on the 3 lamps NEAREST the worker', (() => {
  const lamps = api.getLamps();
  const near = lamps.map((l, i) => [Math.hypot(l.wx - p.wx, l.wy - p.wy), i])
    .sort((a, b) => a[0] - b[0]).slice(0, NIGHT_LAMP_LAMPS).map((x) => lamps[x[1]]);
  return near.every((rec, k) => rec.bulb.getWorldPosition(new THREE.Vector3()).distanceTo(lights[k].position) < 1e-6);
})());
check('a sodium lamp is never steady: head, halo and pool breathe together',
  api.getLamps().some((l) => Math.abs(l.lens.material.emissiveIntensity - NIGHT_LAMP_LENS_I) > 1e-4) &&
    api.getLamps().every((l) => l.glow.material.opacity <= NIGHT_LAMP_HALO_OP + 1e-9 &&
      l.pool.material.opacity <= NIGHT_POOL_OP + 1e-9 && l.shaft.material.opacity <= NIGHT_SHAFT_OP + 1e-9));
check('lit windows flicker inside a safe band (no black-out, no blow-out)',
  lit.every((o) => o.material.emissiveIntensity >= 0.1 && o.material.emissiveIntensity <= srcNum('NIGHT_WIN_I') * srcNum('NIGHT_WIN_GLOW') * 1.02));
check('the sheen arms the worker\'s WHITE STRIPING ALONE (the shirt is cloth, not sheeting)',
  api.getRetroMats().length === 1 && api.getRetroMats()[0] === wparts.stripeMat &&
    !wparts.hiVisMat.userData.retroGain);
check('on MIDNIGHT the striping gain is ' + NIGHT_RETRO_GAIN + ' and the shirt takes NO kick',
  Math.abs(wparts.stripeMat.userData.retroGain.value - NIGHT_RETRO_GAIN) < 1e-9);
check('AT MIDNIGHT THE SHIRT IS STILL HI-VIS YELLOW: its own colour glows, so no light can tint it red',
  wparts.hiVisMat.emissive.getHex() === HI_VIS_YELLOW &&
    Math.abs(wparts.hiVisMat.emissiveIntensity - NIGHT_HIVIS_GLOW) < 1e-9);
// The lamp probe strength is lum(bulb) * flicker * boost. Under the lamp boost = NIGHT_LAMP_BOOST
// and the flicker floor is 0.40; a lamp out of NIGHT_LAMP_NEAR has boost 1 and flicker max 1.08,
// so the under-lamp probe (>= 1.14) beats every off-lamp probe (<= 1.03) for ANY flicker phase.
const probeL = api.getUniforms().col.value.slice(1, 1 + NIGHT_LAMP_LAMPS).map((c) => c.x).sort((a, b) => b - a);
check('the lamp the worker STANDS UNDER drives his striping at FULL boost (' + NIGHT_LAMP_BOOST + 'x): probe ' + probeL[0].toFixed(2),
  probeL[0] >= NIGHT_LAMP_BOOST * lumOf(NIGHT_LAMP_C) * 0.4 - 1e-9);
// dw = 0 -> boost = NIGHT_LAMP_BOOST (probe >= 1.14); every off-lamp lamp is >= 19u away, so its
// boost is exactly 1 and its probe can never pass lum * flicker max = 1.03. Strictly ordered.
check('the blaze is LOCAL: the under-lamp probe ' + probeL[0].toFixed(2) + ' beats BOTH off-lamp probes (' + probeL[1].toFixed(2) + ' / ' + probeL[2].toFixed(2) + ')',
  probeL[0] >= NIGHT_LAMP_BOOST * lumOf(NIGHT_LAMP_C) * 0.4 - 1e-9 && probeL[0] > probeL[1] && probeL[0] > probeL[2]);
check('off-lamp probes carry NO boost (they sit in the 1x band, so the striping glows, it does not blaze)',
  probeL[1] <= lumOf(NIGHT_LAMP_C) * 1.08 * 1.001 && probeL[2] <= lumOf(NIGHT_LAMP_C) * 1.08 * 1.001);
check('every sheen probe is ACHROMATIC grey (the flash reads white; a blue+amber stack read violet)',
  api.getUniforms().col.value.every((c) => Math.abs(c.x - c.y) < 1e-9 && Math.abs(c.y - c.z) < 1e-9),
  api.getUniforms().col.value.map((c) => c.x.toFixed(3) + '/' + c.y.toFixed(3) + '/' + c.z.toFixed(3)).join(' | '));
check('the lamps are lit and the shirt yellow in the SAME frame (one night feed, not two rigs)',
  lights.slice(0, NIGHT_LAMP_LAMPS).every((L) => L.intensity > 0) &&
    lights.slice(NIGHT_LAMP_LAMPS).every((L) => L.intensity === 0) &&
    wparts.hiVisMat.emissive.getHex() === HI_VIS_YELLOW);
check('the moon + the ' + NIGHT_LAMP_POOL + ' pooled lights are loaded into the ' + RETRO_N + ' sheen probes', (() => {
  const U = api.getUniforms();
  const lit3 = api.getLights().every((L, k) => U.pos.value[1 + k].distanceTo(L.position) < 1e-9);
  return U.pos.value[0].distanceTo(dirLight.position) < 1e-9 && lit3 &&
    U.rad.value[0] > 1e4 && Math.abs(U.rad.value[1] - NIGHT_LAMP_R) < 1e-9;
})());

// ---- the shader, injected into the SHIPPED meshlambert program ----------------------
const sh = { uniforms: {}, vertexShader: lam.vertexShader.slice(), fragmentShader: lam.fragmentShader.slice() };
wparts.stripeMat.onBeforeCompile(sh);
check('the sheen injects into the real meshlambert VERTEX program',
  sh.vertexShader.indexOf('varying vec3 vRetP;') >= 0 &&
    sh.vertexShader.indexOf('vRetN = normalize( normalMatrix * objectNormal );') >= 0);
check('the sheen injects into the real meshlambert FRAGMENT program',
  sh.fragmentShader.indexOf('#define RETRO_LIGHTS ' + RETRO_N) >= 0 &&
    sh.fragmentShader.indexOf('gl_FragColor.rgb = min( gl_FragColor.rgb + rKick * uRetGain, vec3( 1.0 ) );') >= 0);
check('the kick lands AFTER lighting + fog + dithering (it is sheeting, not a light term)',
  sh.fragmentShader.indexOf('#include <fog_fragment>') < sh.fragmentShader.indexOf('float rLum = dot('));
check('the COMPILED kick is clamped at the shipped NIGHT_RETRO_MAX and at full white (no violet, no flood)',
  sh.fragmentShader.indexOf('vec3( min( rLum, ' + NIGHT_RETRO_MAX.toFixed(3) + ' ) )') >= 0 &&
    sh.fragmentShader.indexOf('min( gl_FragColor.rgb + rKick * uRetGain, vec3( 1.0 ) )') >= 0);
check('the COMPILED kick carries the banded eye term with the shipped constant spliced in',
  sh.fragmentShader.indexOf('float rBand = 1.0 - ' + NIGHT_RETRO_BAND.toFixed(3) + ' * ( 1.0 - rNV );') >= 0 &&
    sh.fragmentShader.indexOf('pow( rNL * rNL, 3.0 ) * rBand * rFall * rFall;') >= 0);
check('every injected anchor is consumed exactly once (no duplicated include text)',
  (sh.vertexShader.match(/#include <begin_vertex>/g) || []).length === 1 &&
    (sh.fragmentShader.match(/#include <dithering_fragment>/g) || []).length === 1);
check('the injected GLSL is brace-balanced',
  (sh.vertexShader.match(/\{/g) || []).length === (sh.vertexShader.match(/\}/g) || []).length &&
    (sh.fragmentShader.match(/\{/g) || []).length === (sh.fragmentShader.match(/\}/g) || []).length);
check('the GLSL probe count matches the JS uniform arrays (' + RETRO_N + ' = the moon + the ' + NIGHT_LAMP_POOL + ' pooled lights)',
  sh.uniforms.uRetPos.value.length === RETRO_N && sh.uniforms.uRetCol.value.length === RETRO_N &&
    sh.uniforms.uRetR.value.length === RETRO_N && typeof sh.uniforms.uRetGain.value === 'number');
check('the sheen reads the SAME probe arrays the night feed writes (one feed per frame)',
  sh.uniforms.uRetPos.value === api.getUniforms().pos.value);
check('only the striping is patched, under one stable named program key',
  wparts.stripeMat.customProgramCacheKey() === 'dsnyRetroSheetingStripe' &&
    wparts.stripeMat.userData.retroPatched === true && !wparts.hiVisMat.userData.retroPatched);
check('the lamps carry a real reach and the moon an effectively infinite one',
  api.getUniforms().rad.value[0] > 1e4 && Math.abs(api.getUniforms().rad.value[1] - srcNum('NIGHT_LAMP_R')) < 1e-9);

console.log('\n[7] MIDNIGHT IS DARK, SO EVERYTHING THAT GLOWS READS AS LIGHT');
const glowAura = new THREE.ShaderMaterial({ uniforms: { uIntensity: { value: 1.1 }, uColor: { value: new THREE.Color(0x3f86ff) }, uPower: { value: 2.4 } },
  vertexShader: 'void main() {}', fragmentShader: 'void main() {}' });
const glowEye = new THREE.MeshLambertMaterial({ color: 0xffe9a0, emissive: 0xff9d0a, emissiveIntensity: 1.5 });
const glowBody = new THREE.MeshLambertMaterial({ color: 0x9cc0ff, emissive: 0x2a4a8a, emissiveIntensity: 0.3, transparent: true, opacity: 0.6 });
const glowShell = new THREE.MeshBasicMaterial({ color: 0x6dffc9, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
const glowGroup = new THREE.Group();
[glowAura, glowEye, glowBody, glowShell].forEach((m) => glowGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m)));
const mockTruck = { g: new THREE.Group(), boxL: 10.15, cabOff: 11.75, hopperOff: -4.3,
  hazLights: [{ phase: 'side', coreMat: new THREE.MeshLambertMaterial({ color: 0x2a0d00, emissive: 0xff6a00, emissiveIntensity: 1.6 }),
    haloMat: new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
    halo: new THREE.Mesh(new THREE.CircleGeometry(0.22, 20)) }] };
api.setCreatures([{ g: glowGroup }]); api.setTruck(mockTruck);
const wasEye = glowEye.emissiveIntensity, wasAura = glowAura.uniforms.uIntensity.value, wasBody = glowBody.emissiveIntensity;
const wasShell = glowShell.opacity, wasHaz = mockTruck.hazLights[0].coreMat.emissiveIntensity, wasHalo = mockTruck.hazLights[0].haloMat.opacity;
api.scanNightGlow();
api.applyNightGlow(true, 1.0);
check('the glow registry finds the ghoul auras, eyes, spectral bodies and the truck (' + api.getGlowMats().length + ' materials)',
  api.getGlowMats().length >= 6);
check('at midnight the AURA blazes (' + glowAura.uniforms.uIntensity.value.toFixed(2) + ') and the eyes burn (' + glowEye.emissiveIntensity.toFixed(2) + ')',
  glowAura.uniforms.uIntensity.value > wasAura * NIGHT_GLOW_AURA * 0.8 && glowEye.emissiveIntensity > wasEye * 1.4);
check('the spectral bodies and their additive shells come up out of the dark',
  glowBody.emissiveIntensity > wasBody * 1.4 && glowShell.opacity > wasShell && glowShell.opacity <= 1);
check('the truck lenses and halos burn hotter at midnight',
  mockTruck.hazLights[0].coreMat.emissiveIntensity > wasHaz && mockTruck.hazLights[0].haloMat.opacity > wasHalo &&
    mockTruck.hazLights[0].coreMat.emissive.r >= 1 - 1e-9);
api.applyNightGlow(false, 2.0);
check(
  '...and on a weekday every NON-blinking glow value is handed back exactly as built',
  glowEye.emissiveIntensity === wasEye &&
    glowAura.uniforms.uIntensity.value === wasAura &&
    glowBody.emissiveIntensity === wasBody &&
    glowShell.opacity === wasShell,
);
// THE HAZARD LENSES ARE DRIVER-OWNED ON EVERY ROUTE: blinkHazardLights writes their emissive
// intensity / halo opacity every frame (they are BUILT DARK and lit by the 2-second DSNY clock).
// A captured baseline pasted over them on a weekday is exactly what froze the amber row dark, so
// the flash read only on the Midnight shift. The harness stands in for the driver: write a
// mid-blink lit value, run the WEEKDAY pass, and demand the lens is still lit.
const litHaz = mockTruck.hazLights[0];
litHaz.coreMat.emissiveIntensity = 1.6;
litHaz.haloMat.opacity = 0.6;
api.applyNightGlow(false, 3.0);
check(
  'a WEEKDAY LEAVES THE DRIVER-OWNED HAZARD LENS LIT — the DSNY flash survives the glow pass on Monday-Sunday (the v1.0.479 freeze)',
  mockTruck.hazLights[0].coreMat.emissiveIntensity === 1.6 && mockTruck.hazLights[0].haloMat.opacity === 0.6,
);
check(
  'at midnight that same lens is AMPLIFIED to the live blink, never pinned to a frozen value',
  (api.applyNightGlow(true, 4.0), mockTruck.hazLights[0].coreMat.emissiveIntensity > 1.6),
);

check('ecoplasm is born glowing on the haunted shift (' + NIGHT_GLOW_ECTO + 'x) and plain on a weekday',
  api.nightEctoK() === NIGHT_GLOW_ECTO && (api.setNight(false), api.nightEctoK() === 1) && (api.setNight(true), true));
check('...and it is born SMALL on the haunted shift (' + NIGHT_ECTO_SIZE + 'x): the GLOW is not the SIZE',
  NIGHT_ECTO_SIZE > 0 && NIGHT_ECTO_SIZE < 1 && api.nightEctoSize() === NIGHT_ECTO_SIZE &&
  (api.setNight(false), api.nightEctoSize() === 1) && (api.setNight(true), true));
api.armNightTruckRig(); // (the wall clock was installed at the top of this harness: setNow(sec))
check('the truck gets its OWN midnight rig riding on the truck group (road pool + invisible worklight anchor + the REAR HAZARD BEACON)',
  !!api.getTruckRig() && api.getTruckRig().parent === mockTruck.g &&
    api.getTruckRig().children.length === 4 && api.getTruckLights().length === 2);
const rigPlanes = api.getTruckRig().children.filter((c) => c.geometry.type === 'PlaneGeometry').length;
check('the rig has exactly two flat things and both are RADIAL (the road pool + the beacon halo): zero untextured quads = zero square lights',
  rigPlanes === 2 &&
    api.getTruckRig().children.filter((c) => c.geometry.type === 'PlaneGeometry' && !c.material.map).length === 0);
const beacon = api.getTruckRig().userData.parts.beacon;
check('THE FLASHING HAZARD LIGHT IS BACK ON THE REAR: a visible amber bulb + halo riding the model hazard-lens row, not on the cab and not on the roof',
  !!beacon && !!beacon.core && !!beacon.halo && beacon.core.visible !== false &&
    beacon.core.position.x < -5 && beacon.core.position.x > -5.5 &&
    Math.abs(beacon.core.position.z - 3.655) < 0.02 && beacon.core.material.color.getHex() === 0xffb03a);
check('the rig lamp on the hopper is only an INVISIBLE light anchor, and nothing on the truck glows above the scoop',
  api.getTruckRig().userData.parts.work.core.visible === false &&
    api.getTruckRig().children.every((c) => c.position.z <= 4.4) &&
    !api.getTruckRig().children.some((c) => c.position.x > 0 && c.position.z > 3.5));
setNow(0.5); api.nightTruckRigUpdate(0.5, true); // the OUTER-lens second of the DSNY hazard clock
check('the beacon DIMS TO AN EMBER on the outer-lens second (a faint amber bulb; halo and its light cut out; the worklight keeps lighting the street)',
  api.getTruckRig().userData.parts.beacon.core.material.color.getHex() === 0x2a1c0c &&
    api.getTruckRig().userData.parts.beacon.core.material.opacity > 0 &&
    api.getTruckRig().userData.parts.beacon.core.material.opacity < 0.5 &&
    api.getTruckRig().userData.parts.beacon.halo.material.opacity === 0 &&
    api.getTruckLights()[1].intensity === 0 &&
    api.getTruckLights()[0].intensity > 0);
setNow(1.5); api.nightTruckRigUpdate(1.5, true); // the MIDDLE-lens second
check('the beacon BLAZES on the middle-lens second: bulb lit hot, halo glowing, its light pulsing',
  api.getTruckRig().userData.parts.beacon.core.material.color.getHex() === 0xffc256 &&
    api.getTruckRig().userData.parts.beacon.core.material.opacity > 0 &&
    api.getTruckRig().userData.parts.beacon.halo.material.opacity > 0 &&
    api.getTruckLights()[1].intensity > 0);
api.nightTruckRigUpdate(1.0, true);
check('the truck lights the street it parks on: both rig lights burn on the haunted shift',
  api.getTruckLights().every((L) => L.intensity > 0 && L.distance > 0));
api.updateNightLamps(1.0, 1 / 60);
check('the truck worklight is the 4th pooled light AND a sheen probe: striping flashes at the scoop',
  api.getLights()[NIGHT_LAMP_LAMPS].intensity > 0 && api.getUniforms().col.value[RETRO_N - 1].x > 0 &&
    Math.abs(api.getUniforms().rad.value[RETRO_N - 1] - NIGHT_TRUCK_R) < 1e-9);
check('the burning windows come UP for the dark (' + NIGHT_WIN_GLOW + 'x the built glow, measured live)',
  api.getWindows().filter((o) => o.material.emissiveIntensity >= NIGHT_WIN_I * NIGHT_WIN_GLOW * 0.8).length >=
    Math.floor(api.getWindows().length * 0.9) &&
    api.getLamps().every((l) => l.pool.material.opacity > 0 && l.shaft.material.opacity > 0));
api.nightTruckRigUpdate(1.0, false);
check('off the haunted shift the rig contributes NOTHING (every rig light at zero)',
  api.getTruckLights().every((L) => L.intensity === 0));
api.clearNightTruckRig();
check('the rig comes off cleanly (no orphan meshes left on the truck)',
  api.getTruckRig() === null && mockTruck.g.children.length === 0);
api.setTruck(null); api.setCreatures([]); api.applyNightGlow(false, 3);
console.log('\n[8] THE SEVEN WEEKDAYS ARE NOT TOUCHED (the rig is armed, never left on)');
api.setNight(false);
check('armMidnightLook() says NO on a weekday and clears the whole rig',
  api.armMidnightLook() === false && api.getRig() === null && api.getLamps().length === 0 && api.getWindows().length === 0);
api.updateNightLamps(2.0, 1 / 60);
check('the weekday lamp lights carry ZERO intensity (weather keeps sole charge of the day look)',
  api.getLights().every((L) => L.intensity === 0));
check('the sheen gain drops to ZERO on weekdays (the injected term adds exactly nothing)',
  wparts.stripeMat.userData.retroGain.value === 0 && !wparts.hiVisMat.userData.retroGain);
check('on a weekday the shirt is EXACTLY the plain built shirt again (no glow, no kick, no tint)',
  wparts.hiVisMat.emissive.getHex() === 0 && wparts.hiVisMat.emissiveIntensity === 1 &&
    wparts.hiVisMat.color.getHex() === HI_VIS_YELLOW);
check('pickNearestLamps on an empty street returns nobody',
  JSON.stringify(api.pickNearest([], 10, 2, 3)) === '[-1,-1,-1]');
check('retroGainFor(false) = 0 / retroGainFor(true) = 1',
  api.retroGainFor(false) === 0 && api.retroGainFor(true) === 1);
let flickLo = 9, flickHi = -9;
for (let i = 0; i < 400; i++) { const f = api.nightLampFlicker(i * 0.1, 3, 1); flickLo = Math.min(flickLo, f); flickHi = Math.max(flickHi, f); }
check('the lamp flicker stays in a warm band (0.40 .. 1.08)',
  flickLo >= 0.4 - 1e-9 && flickHi <= 1.08 + 1e-9, flickLo.toFixed(3) + '..' + flickHi.toFixed(3));
check('nothing touches the scene at module scope in the new section (every harness stays safe)',
  !/(scene|camera)\.add\(/.test(CONSTS));

console.log('\n[8] THE WIRING THE SHIPPED FILE DEPENDS ON');
check('the FRESH street arms the night look after spawnWorld builds it',
  /buildGround\(\);[\s\S]{0,400}spawnWorld\(\);[\s\S]{0,4000}armMidnightLook\(\);/.test(html));
check('the porch-bulb pass still fires for the night shift (the night suite keeps its guard)',
  /if \(nightShift\) applyDuskLamps\(\);/.test(html));
check('every bulb-flicker frame also pulses the midnight rig (' +
  (html.match(/updateNightLamps\(performance\.now\(\) \/ 1000, dt\);/g) || []).length + ' loop sites)',
  (html.match(/updateNightLamps\(performance\.now\(\) \/ 1000, dt\);/g) || []).length === 4);
check('the night shift still ROLLS THE STORM (3 AM lightning is part of the look)',
  /if \(d && d\.night\) applyNightPalette\(\);/.test(html));
check('the midnight start is still wired (level 8 on a plain START)',
  /const START_LEVEL = NIGHT_LEVEL;/.test(html));

check('a shovel splat scales SIZE by the size dial and GLOW by the glow dial (bright, thin, settles)',
  srcFn('spawnEctoSplat').includes('const es = nightEctoSize()') &&
  srcFn('spawnEctoSplat').includes('Math.round(11 * scale * es)') &&
  srcFn('spawnEctoSplat').includes('R(0.5, 2.0) * scale * es') &&
  srcFn('spawnEctoSplat').includes('R(0.03, 0.075) * scale * es') &&
  srcFn('spawnEctoSplat').includes('R(0.9, 2.6) * es') &&
  srcFn('spawnEctoSplat').includes('emissiveIntensity: 1.1 * ek'));
check('the scoop geyser keeps its count and its throw at midnight; only its drops shrink',
  srcFn('spawnEctoBurst').includes('const es = nightEctoSize()') &&
  srcFn('spawnEctoBurst').includes('Math.round(20 * intensity)') &&
  srcFn('spawnEctoBurst').includes('* (0.55 + intensity * 0.55)') &&
  srcFn('spawnEctoBurst').includes('(0.025 + Math.random() * 0.05) * es') &&
  srcFn('spawnEctoBurst').includes('emissiveIntensity: 1.25 * ek'));
api.setNight(true);
api.armMidnightLook();
const nightLock = radioLocks[radioLocks.length - 1];
check('arming the haunted shift LOCKS THE STATION ONTO ITS OWN SET (the theme + the 3 midnight-only songs)',
  NIGHT_TRACK === 'Midnight Menagerie.mp3' &&
    Array.isArray(nightLock) &&
    JSON.stringify(nightLock) === JSON.stringify(NIGHT_TRACKS));
check('the midnight set is exactly the four haunted songs and every one is on the shelf (file + manifest)',
  NIGHT_TRACKS.length === 4 && NIGHT_TRACKS[0] === 'Midnight Menagerie.mp3' &&
    ['Dead-End Sweep.mp3', 'Midnight Route.mp3', 'Midnight Sanitation Strike.mp3'].every((n) => NIGHT_TRACKS.includes(n)) &&
    NIGHT_TRACKS.every((n) => fs.existsSync(path.join(__dirname, 'music', n))) &&
    NIGHT_TRACKS.every((n) => MANIFEST.includes(n)));
check('the WEEKDAY rotation is locked out of the midnight set (the shipped bag filter excludes them)',
  nightSrc('radioNext').includes('this.radioList.filter((n) => !this._radioIsMidnightOnly(n))') &&
    nightSrc('_radioIsMidnightOnly').includes('NIGHT_MUSIC_TRACKS.indexOf(n) >= 0'));
api.setNight(false);
api.armMidnightLook();
check('arming a weekday street hands the station back to the shuffled rotation (null)',
  radioLocks[radioLocks.length - 1] === null);
api.setNight(true);
console.log('\n' + pass + ' midnight-look checks passed' + (fail ? ' — ' + fail + ' FAILED' : ' — all OK'));
if (fail) failures.forEach((f, i) => console.log('  FAIL ' + (i + 1) + ') ' + f));
process.exit(fail ? 1 : 0);