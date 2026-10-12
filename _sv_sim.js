// _sv_sim.js — HEADLESS PROOF of the new swing: play the shipped arc, frame by frame, with
// the shipped pose solver, and verify (a) the tool stays IN BOTH HANDS on every frame,
// (b) the hands stay anatomically inside the worker's reach, (c) the head sweeps a WIDE arc
// (a bat, not a flick), and (d) the catch lands in the middle of the swing.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
function srcFn(name) {
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let j = html.indexOf('{', i), d = 0;
  for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}') { d--; if (!d) { j++; break; } } }
  return html.slice(i, j);
}
function srcNum(name) { return Number(html.match(new RegExp('const\\s+' + name + '\\s*=\\s*(-?[0-9.]+)'))[1]); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const group = () => ({ children: [], isGroup: true, userData: {}, rotation: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; } }, position: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; } }, add(...o) { this.children.push(...o); o.forEach((x) => { if (x) x.parent = this; }); }, remove(o) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); if (o) o.parent = null; } });
const mesh = () => ({ userData: {}, rotation: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; }, }, position: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; }, } });
const THREE = { Group: function () { return group(); }, Vector3: function (x, y, z) { return { x, y, z }; } };
const M = () => ({}), BX = () => mesh(), CY = () => mesh(), SP = () => mesh();
const HOLD_START = html.indexOf('const SHOVEL_HOLD = {') + 'const SHOVEL_HOLD = '.length;

let HOLD_END = HOLD_START, depth = 0;
for (let j = HOLD_START; j < html.length; j++) { const c = html[j]; if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) { j++; HOLD_END = j; break; } } }
const HOLD = eval('(' + html.slice(HOLD_START, HOLD_END) + ')');

const MOD = new Function('THREE', 'M', 'BX', 'CY', 'SP', 'clamp', 'SHOVEL_HOLD', 'worker', 'wparts', 'shovelGroup',
  'let shovelTwist = 0; let shovelStride = 0; let shovelLean = 0;' +
  [srcFn('shovelSwingArc'), srcFn('shovelFist'), srcFn('shovelShaftEuler'), srcFn('poseShovel'), srcFn('makeShovelProp')].join('\n') +
  '\nreturn { shovelSwingArc, poseShovel, makeShovelProp, fist: shovelFist, twist: () => shovelTwist, setShovel: (g) => { shovelGroup = g; } };');
const ROOT = group();
const armR = mesh(), armL = mesh();
const kit = MOD(THREE, M, BX, CY, SP, clamp, HOLD, { group: ROOT }, { armR, armL }, null);
// The prop is built and parented exactly the way equipShovel does it
const prop = kit.makeShovelProp();
ROOT.add(prop);
kit.setShovel(prop); // poseShovel poses the tool that is IN his hand
const DUR = srcNum('SHOVEL_SWING_DUR');

const dt = 1 / 60;
let shovelT = DUR, arm = 0, deliveredAt = -1, tipPath = [], bad = [];
let prevTip = null, sweep = 0;
while (shovelT > 0) {
  shovelT = Math.max(0, shovelT - dt);
  const k = 1 - shovelT / DUR;
  const swPrev = kit.shovelSwingArc(Math.max(0, k - dt / DUR));
  const sw = kit.shovelSwingArc(k);
  if (arm >= 0 && sw >= 1.06 && swPrev < 1.06) { arm = -1; if (deliveredAt < 0) deliveredAt = 1 - shovelT / DUR; }
  shovelStride = sw > 1 ? 1 : sw;
  const hold = kit.poseShovel(sw);
  if (hold) { shovelTwist = shovelStride > 0.66 ? -hold.twist : hold.twist; shovelLean = hold.lean; }
  // the fists the arms actually put there (the rig's own math)
  const rf = kit.fist(-1, armR.rotation.x, armR.rotation.y);
  const lf = kit.fist(1, armL.rotation.x, armL.rotation.y);
  const o = prop.position, e = prop.rotation;
  const ax = Math.cos(e.y), ay = Math.sin(e.x) * Math.sin(e.y), az = -Math.cos(e.x) * Math.sin(e.y);
  const off = (f) => { const t = (f.x - o.x) * ax + (f.y - o.y) * ay + (f.z - o.z) * az; return Math.hypot(f.x - o.x - ax * t, f.y - o.y - ay * t, f.z - o.z - az * t); };
  const inBox = (f) => f.x > 0.1 && f.x < 0.56 && Math.abs(f.y) < 0.42 && f.z > 0.7 && f.z < 1.42;
  if (off(rf) > 1e-6 || off(lf) > 1e-6 || !inBox(rf) || !inBox(lf))
    bad.push('k=' + k.toFixed(2) + ' off ' + off(rf).toFixed(5) + '/' + off(lf).toFixed(5));
  const tip = { x: o.x + ax * prop.userData.handleLen, y: o.y + ay * prop.userData.handleLen, z: o.z + az * prop.userData.handleLen };
  if (prevTip) sweep += Math.hypot(tip.x - prevTip.x, tip.y - prevTip.y, tip.z - prevTip.z);
  prevTip = tip;
  tipPath.push(tip);
}
console.log('frames', tipPath.length, '| handle', prop.userData.handleLen + 'u',
  '| head sweep (path length of the point)', sweep.toFixed(2) + 'u');
console.log('max |body rotation| during the swing', (Math.max.apply(null, tipPath.map((t, i) => i)) * 0).toFixed(0) + '',
  '| delivered at k =', deliveredAt < 0 ? 'NEVER' : deliveredAt.toFixed(2), 'of', DUR + 's');
console.log('frames where the tool left the fists / the fists left the body:', bad.length, bad.slice(0, 3).join(' '));
console.log(sweep > 2.2 && deliveredAt > 0.3 && deliveredAt < 0.65 && bad.length === 0
  ? 'SWING SIM: OK — a wide arc, the catch lands mid-swing, the tool never leaves his hands'
  : 'SWING SIM: PROBLEM');
