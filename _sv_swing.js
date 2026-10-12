// _sv_swing.js — validate the shovel swing keyframe curve against the EXACT poseShovel math
// and the _nightshift_chk.js pose contract (fist region, hand spread, twist/lean, carry).
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const SHOVEL_KEYS = {
  max: 1.22,
  keys: [
    { k: 0.0, r: [1.15, -0.35], l: [-0.5, -0.9], lean: 0, twist: 0 },
    { k: 0.3, r: [0.85, -0.22], l: [-0.62, -1.42], lean: -0.1, twist: -0.42 },
    { k: 0.6, r: [1.26, -0.3], l: [-0.4, -1.3], lean: 0.2, twist: 0.36 },
    { k: 1.0, r: [0.62, -1.06], l: [-0.16, -0.86], lean: 0.3, twist: 1.16 },
    { k: 1.22, r: [0.95, -0.45], l: [0.2, -0.95], lean: 0.1, twist: 1.5 },
  ],
};
function fist(side, ex, ey) {
  const cy = Math.cos(ey);
  return { x: -0.52 * Math.sin(ey), y: side * 0.29 + 0.52 * Math.sin(ex) * cy, z: 1.38 - 0.52 * Math.cos(ex) * cy };
}
function pose(k) {
  const K = SHOVEL_KEYS.keys, n = K.length - 1;
  k = clamp(k, 0, SHOVEL_KEYS.max);
  let i = 0;
  while (i < n && k > K[i + 1].k) i++;
  const a = K[i], b = K[Math.min(i + 1, n)];
  const span = b.k - a.k;
  let t = span > 1e-9 ? (k - a.k) / span : 1;
  t = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  return {
    r: [a.r[0] + (b.r[0] - a.r[0]) * t, a.r[1] + (b.r[1] - a.r[1]) * t],
    l: [a.l[0] + (b.l[0] - a.l[0]) * t, a.l[1] + (b.l[1] - a.l[1]) * t],
    lean: a.lean + (b.lean - a.lean) * t,
    twist: a.twist + (b.twist - a.twist) * t,
  };
}
// the same solve poseShovel() does: shaft laid on the two fists
function evalPose(k) {
  const P = pose(k), rf = fist(-1, P.r[0], P.r[1]), lf = fist(1, P.l[0], P.l[1]);
  const dx = lf.x - rf.x, dy = lf.y - rf.y, dz = lf.z - rf.z, dm = Math.hypot(dx, dy, dz) || 1;
  const m = dm, ux = dx / m, uy = dy / m, uz = dz / m;
  const ey2 = Math.acos(clamp(ux, -1, 1)), sy = Math.sin(ey2);
  const ex2 = sy > 1e-4 ? Math.atan2(uy, -uz) : 0;
  const ax = Math.cos(ey2), ay = Math.sin(ex2) * Math.sin(ey2), az = -Math.cos(ex2) * Math.sin(ey2);
  const o = { x: rf.x - ux * 0.14, y: rf.y - uy * 0.14, z: rf.z - uz * 0.14 };
  const t = (f) => (f.x - o.x) * ax + (f.y - o.y) * ay + (f.z - o.z) * az;
  const off = (f) => { const kk = t(f); return Math.hypot(f.x - o.x - ax * kk, f.y - o.y - ay * kk, f.z - o.z - az * kk); };
  return {
    P, rf, lf, ex2, ey2, ax, ay, az, o,
    tr: t(rf), tl: t(lf), offR: off(rf), offL: off(lf),
    gap: Math.hypot(lf.x - rf.x, lf.y - rf.y, lf.z - rf.z),
    dR: Math.hypot(rf.x, rf.y + 0.29, rf.z - 1.38), dL: Math.hypot(lf.x, lf.y - 0.29, lf.z - 1.38),
    tip: { x: o.x + ax * 1.78, y: o.y + ay * 1.78, z: o.z + az * 1.78 },
  };
}
const inBox = (f) => f.x > 0.1 && f.x < 0.56 && Math.abs(f.y) < 0.42 && f.z > 0.7 && f.z < 1.42;
let bad = 0;
for (let k = 0; k <= SHOVEL_KEYS.max + 1e-9; k += 0.02) {
  const E = evalPose(k);
  const ok = inBox(E.rf) && inBox(E.lf) && E.gap > 0.2 && E.gap < 0.55 &&
    E.tr > 0.02 && E.tr < 0.4 && E.tl > E.tr + 0.15 && E.tl < 1.05 &&
    Math.abs(E.dR - 0.52) < 1e-9 && Math.abs(E.dL - 0.52) < 1e-9 &&
    E.offR < 1e-9 && E.offL < 1e-9;
  if (!ok) {
    bad++;
    console.log('BAD k=' + k.toFixed(2), JSON.stringify({ rf: E.rf, lf: E.lf, gap: E.gap, tr: E.tr, tl: E.tl, off: [E.offR, E.offL] }));
  }
}
console.log(bad === 0 ? 'curve OK over sweep' : bad + ' bad samples');
const h0 = evalPose(0), h5 = evalPose(0.5), h1 = evalPose(1), hf = evalPose(SHOVEL_KEYS.max);
console.log('k=0  dir=' + [h0.ax, h0.ay, h0.az].map(n => n.toFixed(3)).join(',') + ' tip=' + JSON.stringify(h0.tip) + ' gap=' + h0.gap.toFixed(3) + ' twist=' + h0.P.twist + ' lean=' + h0.P.lean);
console.log('k=.5 gap=' + h5.gap.toFixed(3) + ' rot.y=' + h5.ey2.toFixed(3) + ' twist=' + h5.P.twist.toFixed(3) + ' rf=' + JSON.stringify(h5.rf) + ' lf=' + JSON.stringify(h5.lf));
console.log('k=1  gap=' + h1.gap.toFixed(3) + ' rot.y=' + h1.ey2.toFixed(3) + ' twist=' + h1.P.twist.toFixed(3) + ' lean=' + h1.P.lean.toFixed(3) + ' tr=' + h1.tr.toFixed(3) + ' tl=' + h1.tl.toFixed(3));
console.log('max  twist=' + hf.P.twist.toFixed(3) + ' lean=' + hf.P.lean.toFixed(3) + ' gap=' + hf.gap.toFixed(3) + ' rf=' + JSON.stringify(hf.rf) + ' lf=' + JSON.stringify(hf.lf));
// the suite's exact contract at the sampled amplitudes
console.log('SUITE k=0 carry:', h0.ax > 0.55 && h0.az < -0.05 && h0.tip.x > 1.15 && h0.tip.z < 1.0);
console.log('SUITE peak: gap grows', h1.gap > h0.gap + 0.08, '| shaft sweep', Math.abs(h1.ey2 - h0.ey2) > 0.12,
  '| twist0=0', h0.P.twist === 0, '| twist>0.4', h1.P.twist > 0.4, '| lean>0.15', h1.P.lean > 0.15);
console.log('SUITE fists k=0.5', inBox(h5.rf), inBox(h5.lf), 'gap', h5.gap > 0.2 && h5.gap < 0.55);
function shovelSwingArc(k) {
  if (k <= 0) return 0;
  if (k >= 1) return 0;
  if (k < 0.18) return (k / 0.18) * 0.34;
  if (k < 0.46) return 0.34 + ((k - 0.18) / 0.28) * 0.66;
  if (k < 0.72) return 1 + ((k - 0.46) / 0.26) * 0.22;
  const t = (k - 0.72) / 0.28;
  return 1.22 * (1 - t * t * (3 - 2 * t));
}
const DUR = 0.46;
let peaks = 0,
  maxAmp = 0,
  mono = true,
  prev = -1;
for (let f = 1; f <= 60; f++) {
  // 60 frames of the shipped swing at 1/60s, with the real decay rounding
  const k = 1 - Math.max(0, DUR - f / 60) / DUR;
  const A = shovelSwingArc(k);
  const P = pose(Math.min(A, SHOVEL_KEYS.max));
  peaks += P.twist > 0.95 ? 1 : 0;
  maxAmp = Math.max(maxAmp, A);
  if (f > 15 && f < 44 && A < prev - 1e-9) mono = false;
  prev = A;
}
console.log('strike frames (twist>0.95):', peaks, '| max amplitude:', maxAmp.toFixed(3),
  '| monotone through the hit:', mono);
console.log('amp at k=.1/.18/.3/.46/.6/.72/.9/1:',
  [0.1, 0.18, 0.3, 0.46, 0.6, 0.72, 0.9, 1].map((k) => shovelSwingArc(k).toFixed(2)).join(' '));

