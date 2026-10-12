// _sv_legs.js — LEG AUDIT, computed from the SHIPPED rig math (no THREE dependency).
// The worker's leg pivot is mkLeg(side): pv.position (0, side*0.13, 0.78) with the boot at
// local (0.06, 0, -0.7). In this rig local +Y is the worker's facing and local +Z is up, so:
//   rotation.x = PITCH  -> the foot travels FORE/AFTER (a stride: what a bat swing does)
//   rotation.y = YAW    -> the foot travels SIDEWAYS (a strut: what a walk cycle does)
// The shipped swing used to lay its step-through on rotation.y in OPPOSITE directions on the
// two legs, on top of a gait that already strides wide, while the torso twisted 67 degrees the
// other way. Result: both feet flung OUT to his sides. A SPLIT. This measures the feet through
// the real Euler composition (XYZ: Rz facing, then Ry yaw, then Rx pitch, then the body lean)
// for three mid-swing frames, so the split is counted and can never quietly come back.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const DUR = +html.match(/const SHOVEL_SWING_DUR = ([0-9.]+);/)[1];
const SWING_L = html.match(/wparts\.legL\.rotation\.x \+= ([0-9.]+) \* shovelStride/);
const SWING_R = html.match(/wparts\.legR\.rotation\.x -= ([0-9.]+) \* shovelStride/);
if (!SWING_L || !SWING_R) throw new Error('no fore/aft stride in the shipped swing');
const P_L = +SWING_L[1], P_R = +SWING_R[1];
const OLD_Y_L = 0.42, OLD_Y_R = 0.3; // the yaw the swing used to add on the legs (the split)
const OLD_P_L = 0.2, OLD_P_R = 0.16; // ...and the pitch it added at the same time
const S = 0.63, LIFT = 0.18; // the walk cycle at its widest mid-stride frame (yaw, pitch lift)
const TWIST = 1.16, LEAN = 0.3; // the strike frame's body rotation and chest tip
function boot(side, yaw, pitch, facing) {
  // The leg GROUP sits at its pivot in the body (fixed); the group's rotation swings the
  // meshes hung under it — the leg box at (0,0,-0.36) and the boot at (0.06, 0, -0.7).
  const piv = { x: 0, y: side * 0.13, z: 0.78 };
  const off = { x: 0.06, y: 0, z: -0.7 };
  // Intrinsic XYZ: Ry(yaw) first, then Rx(pitch) — exactly how THREE composes the leg group.
  const a = { x: off.x * Math.cos(yaw) + off.z * Math.sin(yaw), y: off.y, z: -off.x * Math.sin(yaw) + off.z * Math.cos(yaw) };
  const b = { x: a.x, y: a.y * Math.cos(pitch) - a.z * Math.sin(pitch), z: a.y * Math.sin(pitch) + a.z * Math.cos(pitch) };
  const pt = { x: piv.x + b.x, y: piv.y + b.y, z: piv.z + b.z }; // boot in the body frame
  const f = { x: pt.x * Math.cos(facing) - pt.y * Math.sin(facing), y: pt.x * Math.sin(facing) + pt.y * Math.cos(facing), z: pt.z };
  const l = { x: f.x, y: f.y * Math.cos(-LEAN) - f.z * Math.sin(-LEAN), z: f.y * Math.sin(-LEAN) + f.z * Math.cos(-LEAN) };
  return l;
}

// The stance is measured in the BODY's frame: local x is his sideways, local y is fore/aft.
// The torso twist spins the whole body toward the ghoul, so world-axis comparisons across a
// twisted frame and an untwisted walk frame compare apples with oranges — the split is about
// how his feet sit ON HIM.
function frame(yawL, yawR, pitchL, pitchR) {
  return [boot(1, yawL, pitchL, 0), boot(-1, yawR, pitchR, 0)];
}
function describe(tag, f) {
  const dx = Math.abs(f[0].x - f[1].x), dy = Math.abs(f[0].y - f[1].y);
  console.log(tag.padEnd(18) + 'sideways ' + dx.toFixed(2) + 'u   fore/aft ' + dy.toFixed(2) + 'u');
  return { dx, dy };
}
console.log('stride pitch on the legs  L +' + (P_L * 180 / Math.PI).toFixed(1) + 'deg  R -' + (P_R * 180 / Math.PI).toFixed(1) + 'deg');
const walk = describe('WALK FRAME', frame(S, -S, LIFT, -LIFT));
const old = describe('OLD SWING', frame(S + OLD_Y_L, -S - OLD_Y_R, LIFT + OLD_P_L, -LIFT - OLD_P_R));
const now = describe('NEW SWING', frame(S, -S, LIFT + P_L, -LIFT - P_R));
let bad = 0;
if (/rotation\.y [+]?= [^\n]*shovelStride/.test(html)) { console.log('FAIL: the swing still yaws a leg at the hip'); bad++; }
if (!/worker\.group\.position\.z -= [0-9.]+ \* shovelStride/.test(html)) { console.log('FAIL: no weight sink'); bad++; }
if (!/worker\.group\.rotation\.x = -shovelLean/.test(html)) { console.log('FAIL: no lean'); bad++; }
if (old.dx - walk.dx < 0.3) { console.log('FAIL: the old swing does not reproduce the split (it widened the stance by only ' + (old.dx - walk.dx).toFixed(2) + 'u)'); bad++; }
if (Math.abs(now.dx - walk.dx) > 0.05) { console.log('FAIL: the new swing moves the feet sideways by ' + (now.dx - walk.dx).toFixed(3) + 'u — a stride never does that'); bad++; }
if (now.dy - walk.dy < 0.3) { console.log('FAIL: the new stride opens fore/aft by only ' + (now.dy - walk.dy).toFixed(2) + 'u'); bad++; }
console.log('old split adds  +' + (old.dx - walk.dx).toFixed(2) + 'u sideways / +' + (old.dy - walk.dy).toFixed(2) + 'u fore-aft  (a ' + (((old.dx - walk.dx) / walk.dx) * 100).toFixed(0) + '% wider stance on a frame already at its widest gait)');
console.log('new stride adds ' + (now.dx - walk.dx).toFixed(2) + 'u sideways / +' + (now.dy - walk.dy).toFixed(2) + 'u fore-aft  (the stance width never changes; he lunges where he threw)');
console.log('swing ' + DUR + 's, body twisted ' + (TWIST * 180 / Math.PI).toFixed(0) + 'deg, chest tipped ' + (LEAN * 180 / Math.PI).toFixed(0) + 'deg over the blade, weight sunk ' + html.match(/worker\.group\.position\.z -= ([0-9.]+) \* shovelStride/)[1] + 'u into the plant');
console.log(bad ? 'LEG AUDIT: ' + bad + ' PROBLEM(S)' : 'LEG AUDIT: OK - the split is measured out of the swing; the stride opens in the direction he threw the head');

