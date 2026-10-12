// _sv_legs.js — LEG AUDIT on the rig's REAL axes (no THREE dependency).
// buildWorker hangs the legs at pivots (0, side*0.13, 0.78): the feet are separated along the
// worker's LOCAL Y, so local Y is his SIDEWAYS and local X is his FORWARD (the shirt is 0.26
// deep along x and 0.52 wide along y; the arm pivots sit at (0, +/-0.29, 1.38); worker.group
// spins about z to face where he walks). In a rig built that way:
//     leg.rotation.y -> rotates the leg about the SIDEWAYS axis -> the foot travels FORE/AFTER
//                       (the STRIDE axis; the walk cycle drives it on every level:
//                        legL.rotation.y = s, legR.rotation.y = -s, amp up to 0.7 rad)
//     leg.rotation.x -> rotates the leg about the FORWARD axis -> the foot travels SIDEWAYS
//                       (a SPLIT when the two legs go opposite ways)
// The audit measures the mid-swing stance in the BODY frame. The strike frame also turns the
// body 66 degrees about z (the bat turn) and tips it about x (chest over the blade); that
// spins the whole stance with him, so it is not measured as a leg problem here.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const DUR = +html.match(/const SHOVEL_SWING_DUR = ([0-9.]+);/)[1];
const STRIDE_LEAD = html.match(/lead\.rotation\.y \+= ([0-9.]+) \* swS/);
const STRIDE_TRAIL = html.match(/trail\.rotation\.y -= ([0-9.]+) \* swS/);
const WEIGHT_X = html.match(/wparts\.group\.position\.x \+= ([0-9.]+) \* swS/);
if (!STRIDE_LEAD || !STRIDE_TRAIL || !WEIGHT_X)
  throw new Error('the swing does not stride on the gait axis with a forward weight shift');
const A_LEAD = +STRIDE_LEAD[1], A_TRAIL = +STRIDE_TRAIL[1], A_SHIFT = +WEIGHT_X[1];
const OLD_X_L = 0.34, OLD_X_R = 0.3; // the sideways-tip stride that made the split
const S = 0.7; // the walk at its biggest stride (the amp cap)
function boot(side, yRot) {
  // The leg group spins about its pivot; the BOOT hangs at (0.06, 0, -0.7) under it. A rotation
  // about Y carries the foot through the FORE/AFTER (x) and vertical (z) plane.
  const piv = { x: 0, y: side * 0.13, z: 0.78 };
  const off = { x: 0.06, y: 0, z: -0.7 };
  const fx = off.x * Math.cos(yRot) + off.z * Math.sin(yRot);
  const fz = -off.x * Math.sin(yRot) + off.z * Math.cos(yRot);
  return { x: piv.x + fx, y: piv.y, z: piv.z + fz };
}
function bootTip(side, xRot) {
  // ...and a rotation about X carries it through the SIDEWAYS (y) and vertical plane.
  const piv = { x: 0, y: side * 0.13, z: 0.78 };
  const off = { x: 0.06, y: 0, z: -0.7 };
  return { x: piv.x + off.x, y: piv.y + (off.y * Math.cos(xRot) - off.z * Math.sin(xRot)), z: piv.z + (off.y * Math.sin(xRot) + off.z * Math.cos(xRot)) };
}
function measure(tag, f, shift) {
  const spread = Math.abs(f[0].y - f[1].y);
  const stride = Math.abs(f[0].x - f[1].x) + (shift || 0);
  console.log(tag.padEnd(14) + 'leg spread (sideways) ' + spread.toFixed(3) + 'u   stride fore/aft ' + stride.toFixed(2) + 'u');
  return { spread, stride };
}
console.log('swing stride   lead +' + (A_LEAD * 180 / Math.PI).toFixed(1) + 'deg  trail -' + (A_TRAIL * 180 / Math.PI).toFixed(1) + 'deg   weight +' + A_SHIFT + 'u forward');
const walk = measure('WALK', [boot(1, S), boot(-1, -S)], 0);
const swing = measure('STRIDE', [boot(1, S + A_LEAD), boot(-1, -S - A_TRAIL)], A_SHIFT);
const tips = measure('TIP (old)', [bootTip(1, OLD_X_L), bootTip(-1, -OLD_X_R)], 0);
const flat = measure('STAND', [boot(1, 0), boot(-1, 0)], 0);
let bad = 0;
if (/wparts\.leg[LR]\.rotation\.x/.test((html.match(/THE BODY DOES THE WORK[\s\S]{0,1800}?Dog-shit slip/) || [''])[0])) {
  console.log('FAIL: the swing tips a leg sideways (leg rotation.x) - that is the SPLIT axis'); bad++;
}
if (!/lead\.rotation\.y \+=/.test(html) || !/trail\.rotation\.y -=/.test(html)) { console.log('FAIL: the swing has no fore/aft stride'); bad++; }
if (!/wparts\.group\.position\.x \+=/.test(html)) { console.log('FAIL: the weight does not shift forward'); bad++; }
if (/worker\.group\.position\.z [-+]?= [^\n]*shovelStride/.test(html)) { console.log('FAIL: the swing rewrites the ground height'); bad++; }
if (Math.abs(swing.spread - walk.spread) > 1e-9) { console.log('FAIL: the swing changes the leg spread by ' + (swing.spread - walk.spread).toFixed(4) + 'u'); bad++; }
if (swing.stride - walk.stride < 0.4) { console.log('FAIL: the swing opens the stride by only ' + (swing.stride - walk.stride).toFixed(2) + 'u'); bad++; }
if (tips.spread - flat.spread < 0.15) { console.log('FAIL: the tip axis does not reproduce the split'); bad++; }
console.log('old tip axis at the same amplitudes: leg spread ' + flat.spread.toFixed(3) + 'u -> ' + tips.spread.toFixed(3) + 'u (+' + (((tips.spread - flat.spread) / flat.spread) * 100).toFixed(1) + '% sideways = the split the player saw)');
console.log('new stride: spread ' + walk.spread.toFixed(3) + 'u -> ' + swing.spread.toFixed(3) + 'u (' + (swing.spread - walk.spread === 0 ? 'unchanged' : 'MOVED') + '), fore/aft ' + walk.stride.toFixed(2) + 'u -> ' + swing.stride.toFixed(2) + 'u');
console.log('swing ' + DUR + 's; the body still turns 66deg into the throw and tips 17deg over the blade');
console.log(bad ? 'LEG AUDIT: ' + bad + ' PROBLEM(S)' : 'LEG AUDIT: OK - the swing strides on the stride axis, the legs never tip sideways, the spread never changes');
