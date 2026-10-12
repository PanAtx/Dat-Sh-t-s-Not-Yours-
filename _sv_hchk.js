// _sv_hchk.js — does the shipped code carry the rear hazard flash back?
const H = require('fs').readFileSync('index.html', 'utf8');
const marks = [
  ['shared hazard clock helper', 'function hazardClock() {'],
  ['the lenses read the shared clock', 'const hc = hazardClock();'],
  ['rig lamp takes size/glow/amber args', 'const mkLamp = (x, y, z, r, op, amber) =>'],
  ['bulb uses a radial billboarded halo', 'halo.userData.billboard = true;'],
  ['beacon sits on the hazard-lens row', 'mkLamp(-5.341, -0.051, 3.655, 0.14, 0.5, true)'],
  ['worklight is an invisible anchor', 'work.core.visible = false;'],
  ['rig update flashes the beacon', 'const flash = hazardClock().midOn ? 1 : 0;'],
  ['beacon bulb dims to an ember between flashes', 'setHex(flash > 0 ? 0xffc256 : 0x2a1c0c)'],
  ['beacon halo opacity rides the flash', 'parts.beacon.halo.material.opacity = 0.5 * k * flash;'],
  ['halo faces the camera', 'parts.beacon.halo.quaternion.copy(camera.quaternion);'],
  ['beacon light pulses with the flash', 'NIGHT_TRUCK_I * 0.8 * flash'],
  ['no flat lamp quad left on the truck', 'mkLamp(rear - 1.6, 0, 3.1)'],
];
let bad = 0;
for (const [name, needle] of marks) {
  const want = name !== 'no flat lamp quad left on the truck';
  const found = H.includes(needle);
  const ok = want === found;
  console.log((ok ? 'OK  ' : 'FAIL') + '  ' + name + (ok ? '' : '  <' + needle + '>'));
  if (!ok) bad++;
}
console.log(bad ? 'HAZARD CHECK: ' + bad + ' PROBLEM(S)' : 'HAZARD CHECK: the rear flash is back, in beat with the lenses');
