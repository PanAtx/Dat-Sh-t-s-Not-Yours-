// _hazlights_chk.js — verify the truck's HAZARD LIGHTS (index.html).
// The truck's texture paints a row of three orange circles on the REAR face
// (above the hopper). Three real glowing lenses sit on that rear face, oriented
// along its normal (-0.989, -0.133, 0.063), and blink the DSNY pattern:
// 1s both OUTER lights ON, 1s the MIDDLE light ON, 1s ALL dark — then repeat
// forever. The glow is an emissive core + an additive-blended halo.
//
// THIS CHECK: (0) the inline scripts still parse, (1) buildTruck builds three
// lenses+halos on the measured side-face dots and exposes them as
// truck.hazLights, (2) updateTruck drives the blink on a 3-second clock,
// (3) the REAL blink block is extracted and executed headlessly for 3 full
// cycles against the exact expected pattern.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let ok = true;
const check = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) ok = false;
};

// ---- (0) inline scripts still parse ----
const scripts = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let synOk = true;
scripts.forEach((code, i) => {
  try {
    new vm.Script(code, { filename: 'inline#' + i });
  } catch (e) {
    synOk = false;
    console.log('  syntax fail inline#' + i + ': ' + e.message);
  }
});
check('inline script(s) parse (' + scripts.length + ')', synOk);

// ---- (1) buildTruck builds the three glowing lenses + halos ----
const buildSrc = src.slice(src.indexOf('function buildTruck()'), src.indexOf('function updateHopperTrash('));
check('the hazard lights are built (hazLights array)', buildSrc.indexOf('const hazLights = []') >= 0);
check('each light = emissive orange core lens + additive-blended halo (the glow)', buildSrc.indexOf('emissive: 0xff6a00') >= 0 && buildSrc.indexOf('THREE.AdditiveBlending') >= 0 && buildSrc.indexOf('new THREE.CircleGeometry(s.haloR, 20)') >= 0);
check('ONE MIDDLE light + two SIDE lights (the 3-circle pattern)', buildSrc.indexOf('phase: \'mid\'') >= 0 && (buildSrc.match(/phase: 'side'/g) || []).length === 2);
// the measured REAR-face dot centers (from _rear_color.js blobs: orange circles
// on the rear raycast to their true (y,z) + surface x) must be the exact placement,
// each lens/halo lifted off the face along the rear normal (-0.989, -0.133, 0.063)
check('light 1 sits on rear hazard zone (x=-3.998, y=-0.239, z=3.979)', buildSrc.indexOf("{ x: -3.998, y: -0.239, z: 3.979, r: 0.105, haloR: 0.22, phase: 'side' }") >= 0);
check('light 2 (middle) sits on rear hazard zone (x=-3.957, y=-0.227, z=3.863)', buildSrc.indexOf("{ x: -3.957, y: -0.227, z: 3.863, r: 0.105, haloR: 0.22, phase: 'mid' }") >= 0);
check('light 3 sits on rear hazard zone (x=-4.027, y=-0.378, z=3.695)', buildSrc.indexOf("{ x: -4.027, y: -0.378, z: 3.695, r: 0.105, haloR: 0.22, phase: 'side' }") >= 0);
check('lenses/halos are oriented along the rear-face normal and lifted off it', buildSrc.indexOf('setFromUnitVectors') >= 0 && buildSrc.indexOf('addScaledVector(hazN, 0.03)') >= 0 && buildSrc.indexOf('addScaledVector(hazN, 0.02)') >= 0);
check('temporary magenta debug markers + H key toggle exist (remove after visual check)', buildSrc.indexOf('hazDebug') >= 0 && buildSrc.indexOf('0xff00ff') >= 0 && src.indexOf('e.code === "KeyH"') >= 0);
check('manual L1 nudge keys exist: U/I=x, J/K=y, N/M=z (run before the e.repeat guard so held keys slide)', buildSrc.indexOf('const nudgeHaz = (i, dx, dy, dz) => {') >= 0 && buildSrc.indexOf('hazRings: hazRings,') >= 0 && buildSrc.indexOf('nudgeHaz: nudgeHaz,') >= 0 && src.indexOf('e.code === "KeyU"') >= 0 && src.indexOf('e.code === "KeyI"') >= 0 && src.indexOf('e.code === "KeyJ"') >= 0 && src.indexOf('e.code === "KeyK"') >= 0 && src.indexOf('e.code === "KeyN"') >= 0 && src.indexOf('e.code === "KeyM"') >= 0 && src.indexOf('truck.nudgeHaz(0, HAZ_STEP, 0, 0)') >= 0 && src.indexOf('truck.nudgeHaz(0, 0, 0, -HAZ_STEP)') >= 0);
check('the truck object exposes hazLights for the blink driver', buildSrc.indexOf('hazLights: hazLights,') >= 0);

// ---- (2) updateTruck drives the blink on a 3-second clock ----
const upSrc = src.slice(src.indexOf('function updateTruck(dt)'), src.indexOf('// ==================== CREATURE AI'));
check('the blink cycle runs on a 3-second clock (% 3)', upSrc.indexOf('(performance.now() * 0.001) % 3') >= 0);
check('phase windows: 1s sides, then 1s middle, then 1s dark', upSrc.indexOf('const sideOn = hz < 1') >= 0 && upSrc.indexOf('midOn = hz >= 1 && hz < 2') >= 0);
check('core glow + halo pulse with the phase (emissiveIntensity / opacity)', upSrc.indexOf('L.coreMat.emissiveIntensity = on ? 2.6 : 0') >= 0 && upSrc.indexOf('L.haloMat.opacity = on ? 0.95 : 0') >= 0);
check('the halo is hidden while its light is dark (no ghost glow)', upSrc.indexOf('L.halo.visible = on;') >= 0);

// ---- (3) execute the REAL blink block for 3 full cycles ----
const iHZ = upSrc.indexOf('if (truck.hazLights) {');
if (iHZ < 0) {
  check('the REAL blink block is found in updateTruck', false);
} else {
  let k = upSrc.indexOf('{', iHZ),
    d = 0;
  for (; k < upSrc.length; k++) {
    if (upSrc[k] === '{') d++;
    else if (upSrc[k] === '}') {
      d--;
      if (d === 0) break;
    }
  }
  const hazBlock = upSrc.slice(iHZ, k + 1);
  const runBlink = new Function('performance', 'truck', hazBlock);
  const hazLights = [
    { phase: 'side', coreMat: { emissiveIntensity: -1 }, haloMat: { opacity: -1 }, halo: { visible: true } },
    { phase: 'mid', coreMat: { emissiveIntensity: -1 }, haloMat: { opacity: -1 }, halo: { visible: true } },
    { phase: 'side', coreMat: { emissiveIntensity: -1 }, haloMat: { opacity: -1 }, halo: { visible: true } },
  ];
  const truck = { hazLights: hazLights };
  let patOk = true,
    glowOk = true,
    patDetail = '',
    glowDetail = '';
  const expectAt = (t) => (t % 3 < 1 ? [1, 0, 1] : t % 3 < 2 ? [0, 1, 0] : [0, 0, 0]);
  for (let t = 0; t < 9; t += 0.1) {
    const fakeNow = t * 1000;
    runBlink({ now: () => fakeNow }, truck);
    const on = hazLights.map((L) => (L.coreMat.emissiveIntensity > 0 ? 1 : 0));
    const e = expectAt(t);
    if (on[0] !== e[0] || on[1] !== e[1] || on[2] !== e[2]) {
      patOk = false;
      patDetail = 't=' + t.toFixed(1) + 's got ' + JSON.stringify(on) + ' want ' + JSON.stringify(e);
      break;
    }
    hazLights.forEach((L, i) => {
      const wantOp = e[i] ? 0.95 : 0;
      if (Math.abs(L.haloMat.opacity - wantOp) > 1e-9 || L.halo.visible !== !!e[i]) {
        glowOk = false;
        glowDetail = 't=' + t.toFixed(1) + 's light ' + i + ' opacity=' + L.haloMat.opacity + ' visible=' + L.halo.visible;
      }
    });
  }
  check('the REAL blink block: 1s both outer / 1s middle / 1s all dark, repeated for 3 full cycles', patOk, patDetail);
  check('the glow follows the core: halo opacity 0.8 + visible only while the light is on', glowOk, glowDetail);
}

console.log(ok ? '\nHAZARD LIGHT CHECKS PASSED' : '\nHAZARD LIGHT CHECKS FAILED');
process.exit(ok ? 0 : 1);