// _hazlights_chk.js — verify the truck's HAZARD LIGHTS (index.html).
// The truck's texture paints a row of small orange circles along the +Y side
// (just below the "sanitation" banner) — the three the player sees from behind
// (dots 2-4). Three real glowing lenses now sit on that side face, oriented
// along its normal (-0.14, 0.99, -0.06), and blink the DSNY pattern:
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
// the measured side-face dot centers (from _dotpos.js: texture dots 2-4 mapped
// UV->3D on the body mesh) must be the exact placement, each lens/halo lifted
// off the face along the side normal (-0.14, 0.99, -0.06)
check('light 1 sits on painted dot 4 (x=-1.844, y=1.224, z=2.011)', buildSrc.indexOf("{ x: -1.844, y: 1.224, z: 2.011, r: 0.06, haloR: 0.1, phase: 'side' }") >= 0);
check('light 2 (middle) sits on painted dot 3 (x=-0.299, y=1.432, z=1.912)', buildSrc.indexOf("{ x: -0.299, y: 1.432, z: 1.912, r: 0.06, haloR: 0.1, phase: 'mid' }") >= 0);
check('light 3 sits on painted dot 2 (x=1.288, y=1.645, z=1.812)', buildSrc.indexOf("{ x: 1.288, y: 1.645, z: 1.812, r: 0.06, haloR: 0.1, phase: 'side' }") >= 0);
check('lenses/halos are oriented along the side-face normal and lifted off it', buildSrc.indexOf('setFromUnitVectors') >= 0 && buildSrc.indexOf('addScaledVector(hazN, 0.03)') >= 0 && buildSrc.indexOf('addScaledVector(hazN, 0.02)') >= 0);
check('temporary magenta debug markers + H key toggle exist (remove after visual check)', buildSrc.indexOf('hazDebug') >= 0 && buildSrc.indexOf('0xff00ff') >= 0 && src.indexOf('e.code === "KeyH"') >= 0);
check('the truck object exposes hazLights for the blink driver', buildSrc.indexOf('hazLights: hazLights,') >= 0);

// ---- (2) updateTruck drives the blink on a 3-second clock ----
const upSrc = src.slice(src.indexOf('function updateTruck(dt)'), src.indexOf('// ==================== CREATURE AI'));
check('the blink cycle runs on a 3-second clock (% 3)', upSrc.indexOf('(performance.now() * 0.001) % 3') >= 0);
check('phase windows: 1s sides, then 1s middle, then 1s dark', upSrc.indexOf('const sideOn = hz < 1') >= 0 && upSrc.indexOf('midOn = hz >= 1 && hz < 2') >= 0);
check('core glow + halo pulse with the phase (emissiveIntensity / opacity)', upSrc.indexOf('L.coreMat.emissiveIntensity = on ? 1.7 : 0') >= 0 && upSrc.indexOf('L.haloMat.opacity = on ? 0.8 : 0') >= 0);
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
      const wantOp = e[i] ? 0.8 : 0;
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