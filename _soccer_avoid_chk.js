// _soccer_avoid_chk.js — the sidewalk soccer / tee-ball kids must be SMART about
// obstacles: when a tree or a USPS collection box stands in a kid's lane he routes
// AROUND it (rounding the close edge inside the walk band) instead of pressing his
// face into it forever. This suite (1) asserts the old dead-stop `kidStepBlocked`
// gating is gone and both team cases use the new `kidNav` steering, then (2) EXTRACTS
// the real kidNav code out of index.html and simulates it against solid boxes:
//   A. dribbler straight at a tree -> gets around it, never enters the solid box
//   B. receiver sprinting at a ball resting just past a tree -> closes to pickup range
//   C. tree hugging the build-side band edge -> the kid takes the curb side
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
let fails = 0;
const check = (name, ok) => {
  console.log((ok ? '  ok  ' : '  FAIL') + ' ' + name);
  if (!ok) fails++;
};

// ---- 1. the old dead-stop gating is gone, the new steering is in both cases ----
check('kidStepBlocked dead-stop gating fully removed', !html.includes('kidStepBlocked'));
const navDefs = html.match(/const kidNav = \(k, tx, ty, spd, loY, hiY\) => \{/g) || [];
check('kidNav defined in BOTH the soccer and the tee-ball case (x2)', navDefs.length === 2);
check('kidNav called by every kid branch (7 call sites)', (html.match(/kidNav\(k, /g) || []).length === 7);
check('dodge lanes are clamped to the walk band (navLoY present)', (html.match(/let navLoY = 1\.5/g) || []).length === 2);

// ---- 2. extract ONE real copy of the helpers and run it against solid boxes ----
const startMark = "const KID_PAD = 0.8; // half-size of a solid sidewalk obstacle's box";
const endMark = 'if (my && !kidHits(k.wx, k.wy + my)) k.wy += my;';
const s0 = html.indexOf(startMark);
const sMid = s0 >= 0 ? html.indexOf(endMark, s0) : -1;
const s1 = sMid >= 0 ? html.indexOf('};', sMid) : -1;
check('kidNav block extractable from index.html', s0 >= 0 && s1 > 0);
if (fails) process.exit(1);

const code =
  html.slice(s0, s1 + 2) + '\n;({ kidHits, kidPathHit, kidNav })';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dt = 1 / 60;
const sandbox = { blocks: [], clamp, dt, Math };
const api = vm.runInNewContext(code, sandbox);
const kidNav = api.kidNav;

// one frame of the sim: sandbox.dt/global blocks feed the extracted closures
function sim({ trees, kid, tx, ty, spd, loY, hiY, maxT, until }) {
  sandbox.blocks = [{ trees }];
  for (let t = 0; t < maxT; t += dt) {
    kidNav(kid, tx, ty, spd, loY, hiY);
    for (const o of trees)
      if (Math.abs(o.wx - kid.wx) < 0.8 && Math.abs(o.wy - kid.wy) < 0.8)
        return { ok: false, why: 'kid walked INTO the solid box', t };
    if (until(kid)) return { ok: true, t };
  }
  return { ok: false, why: 'never reached the goal (stuck?)' };
}

// A. dribbler: straight down the lane, tree planted dead ahead
let r = sim({
  trees: [{ wx: 10, wy: 3 }],
  kid: { wx: 0, wy: 3 },
  tx: 30, ty: 3, spd: 4, loY: 1.5, hiY: 4.3,
  maxT: 30, until: (k) => k.wx > 20,
});
check('A: dribbler runs AROUND a tree head-on and keeps going ' + (r.ok ? '' : r.why), r.ok);

// B. receiver: the loose ball rests just past the tree — close enough to grab
r = sim({
  trees: [{ wx: 10, wy: 3 }],
  kid: { wx: 0, wy: 3 },
  tx: 11, ty: 3, spd: 6, loY: 1.5, hiY: 4.3,
  maxT: 30, until: (k) => Math.hypot(k.wx - 11, k.wy - 3) <= 1.3,
});
check('B: ball-chaser reaches a ball resting past a tree (pickup range) ' + (r.ok ? '' : r.why), r.ok);

// C. tree hugging the build-side edge: only the curb side fits the band
const kidC = { wx: 0, wy: 4 };
r = sim({
  trees: [{ wx: 10, wy: 4 }],
  kid: kidC,
  tx: 30, ty: 4, spd: 4, loY: 1.5, hiY: 4.3,
  maxT: 30, until: (k) => k.wx > 12,
});
check('C: kid rounds a tree at the band edge on the side that fits ' + (r.ok ? '' : r.why), r.ok);

// D. a dodge must END: once past the tree the kid stops sidestepping (no wiggle)
{
  sandbox.blocks = [{ trees: [{ wx: 10, wy: 3 }] }];
  const k = { wx: 8, wy: 3.95, dir: 1 };
  // start already clear of the trunk on the far side, target straight ahead
  let minY = 99, maxY = -99;
  for (let t = 0; t < 4; t += dt) {
    kidNav(k, 30, 3.95, 4, 1.5, 4.3);
    minY = Math.min(minY, k.wy);
    maxY = Math.max(maxY, k.wy);
  }
  check('D: no dodge when the lane is already clear (y stays put)', maxY - minY < 0.05);
}

console.log(fails ? `\nSOCCER AVOID: ${fails} FAILED` : '\nSOCCER AVOID: ALL PASSED');
process.exit(fails ? 1 : 0);
