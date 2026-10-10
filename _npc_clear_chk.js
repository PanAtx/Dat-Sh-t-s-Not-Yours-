// _npc_clear_chk.js — the HARD promise: a standing character (hooker / jacker / panhandler)
// must never end the fairness pass under a tree crown. Pins: SHADE_TOP.npc now measures the
// full 2.2u story (hard hat + jackhammer), the judge carries a grazing margin, and
// scanClearStandingSpot() rescues anyone a 3.5u ring hop could not fully free: it returns the
// NEAREST fully clear grid square in the whole block, and only on a block with literally no
// clear square falls back to the point farthest from any leaves. All math extracted from index.html.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let ok = true, n = 0;
function check(name, cond) {
  n++;
  if (!cond) { ok = false; console.log('FAIL: ' + name); }
  else console.log('pass ' + (n < 10 ? ' ' : '') + n + ' — ' + name);
}
function extractFn(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  let brace = src.indexOf('{', idx), depth = 0, i = brace;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}
// constants — SHADE_TOP / SHADE_NPC_MARGIN pulled from index.html itself so the suite
// tracks the game's numbers, never a copy of them
const CAM_ANGLE_OFFSET = 0, ARM_H = 1, ARM_D = 1.4142;
const SHADE_UX = Math.SQRT1_2 * (Math.sin(CAM_ANGLE_OFFSET) - Math.cos(CAM_ANGLE_OFFSET));
const SHADE_UY = -Math.SQRT1_2 * (Math.sin(CAM_ANGLE_OFFSET) + Math.cos(CAM_ANGLE_OFFSET));
const SHADE_UZ = ARM_H / ARM_D;
const SHADE_UN = Math.hypot(SHADE_UX, SHADE_UY, SHADE_UZ) || 1;
const SHX = SHADE_UX / SHADE_UN, SHY = SHADE_UY / SHADE_UN, SHZ = SHADE_UZ / SHADE_UN;
const SHADE_SAMPLE_Z = [0.25, 0.55, 0.85];
const SHADE_CLEAR = 0.5, SHADE_REACH = 9.0;
const SHADE_RINGS = [0.5, 0.9, 1.4, 2.0, 2.7, 3.5];
const SHADE_ANGLES = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6).sort((a, b) => Math.sin(a) - Math.sin(b));
const SHADE_SEP = 0.85, SHADE_SEP_NPC = 1.15;
const SHADE_TOP = eval('(' + src.match(/const SHADE_TOP = (\{[^}]*\});/)[1] + ')');
const SHADE_NPC_MARGIN = +src.match(/const SHADE_NPC_MARGIN = ([0-9.]+);/)[1];
check('the standers are measured at their FULL story (hard hat + jack, topH >= 2)', SHADE_TOP.npc >= 2);
check('the judge carries a grazing safety margin for standing characters', SHADE_NPC_MARGIN > 0.05);

let treeCrowns = [];
eval(extractFn('crownShadeDepth'));
eval(extractFn('sitsOnTreePit'));
eval(extractFn('putStreetSpot'));
eval(extractFn('hopOutOfTreeShade'));
eval(extractFn('scanClearStandingSpot'));
const strict = (x, y, m) => crownShadeDepth(x, y, 0.3, SHADE_TOP.npc, m === undefined ? SHADE_NPC_MARGIN : m, 1);

// brute-force reference: same grid, same rules, computed independently here
function bruteNearestClear(o, footZ, x0, x1, y0, y1, spots) {
  let best = null, bestD = Infinity, fb = null, fbC = -Infinity;
  for (let gx = Math.ceil(x0 * 2) / 2; gx <= x1; gx += 0.5)
    for (let gy = y0; gy <= y1; gy += 0.75) {
      if (sitsOnTreePit(gx, gy)) continue;
      let crow = false;
      for (const s of spots) if (s.o !== o && (s.x - gx) ** 2 + (s.y - gy) ** 2 < SHADE_SEP_NPC ** 2) crow = true;
      if (crow) continue;
      if (strict(gx, gy) <= 0) {
        const d = (gx - o.wx) ** 2 + (gy - o.wy) ** 2;
        if (d < bestD) { bestD = d; best = { x: gx, y: gy }; }
        continue;
      }
      let near = Infinity;
      for (const c of treeCrowns) near = Math.min(near, Math.hypot(c.wx - gx, c.wy - gy) - c.cr);
      if (near > fbC) { fbC = near; fb = { x: gx, y: gy }; }
    }
  return { best, fb };
}
const mk = (x, y) => ({ wx: x, wy: y, homeX: x, homeY: y, g: { position: { set() {} } } });

// ===== scenario 1: tree-choked block corner — crowns everywhere around a hidden jacker =====
treeCrowns = [
  { wx: 0, wy: 0, cz: 2.5, cr: 1.2 }, { wx: 2.4, wy: 1.4, cz: 2.5, cr: 1.2 },
  { wx: -1.8, wy: 1.6, cz: 2.5, cr: 1.1 }, { wx: 1.2, wy: 3.0, cz: 2.4, cr: 1.1 },
  { wx: -0.6, wy: -1.6, cz: 2.6, cr: 1.2 },
];
let hidden = null;
for (let gy = 0.9; gy <= 4 && !hidden; gy += 0.25)
  for (let gx = -3; gx <= 3 && !hidden; gx += 0.25)
    if (strict(gx, gy) > 0 && !sitsOnTreePit(gx, gy)) hidden = mk(gx, gy);
check('the grove really does hide someone (a jacker-height spot exists in its shade)', !!hidden);
const spots1 = [{ o: hidden, x: hidden.wx, y: hidden.wy }, { o: mk(6, 6), x: 6, y: 6 }];
const B1 = { x0: -6, x1: 10, y0: 0.9, y1: 7 };
const got = scanClearStandingSpot(hidden, 0.3, B1.x0, B1.x1, B1.y0, B1.y1, spots1);
const ref1 = bruteNearestClear(hidden, 0.3, B1.x0, B1.x1, B1.y0, B1.y1, spots1);
check('the scan returns a spot (the block HAS clear squares)', !!got && !!ref1.best);
check('the rescued spot is FULLY clear under the strict rule (margin + 1 clipped line)', strict(got.x, got.y) <= 0);
check('the rescued spot is off every trunk pit', !sitsOnTreePit(got.x, got.y));
check('the rescued spot is not stacked on another street item',
  spots1.every((s) => s.o === hidden || (s.x - got.x) ** 2 + (s.y - got.y) ** 2 >= SHADE_SEP_NPC ** 2));
check('it is the NEAREST clear square on the block (matches the independent brute force)',
  !!ref1.best && Math.hypot(got.x - ref1.best.x, got.y - ref1.best.y) < 1e-9);

// ===== scenario 2: a stander already in clear sight is not shoved around =====
const clearSpot = { x: 8.5, y: 5.4 }; // 5.4 = 0.9 + 6*0.75: exactly on the scan's y-lattice
check('scenario setup: the open spot really is clear', strict(clearSpot.x, clearSpot.y) <= 0 && !sitsOnTreePit(clearSpot.x, clearSpot.y));
const still = scanClearStandingSpot(mk(clearSpot.x, clearSpot.y), 0.3, B1.x0, B1.x1, B1.y0, B1.y1, []);
check('an already-visible stander keeps his spot (scan returns exactly where he stands)',
  !!still && Math.hypot(still.x - clearSpot.x, still.y - clearSpot.y) < 1e-9);

// ===== scenario 3: a strip with literally no clear square falls back to max clearance =====
treeCrowns = [
  { wx: 0, wy: 0, cz: 2.5, cr: 1.2 }, { wx: 2.2, wy: 0.9, cz: 2.5, cr: 1.2 },
  { wx: -2.2, wy: 0.9, cz: 2.5, cr: 1.2 },
];
const tiny = { x0: -0.5, x1: 0.5, y0: 0.9, y1: 1.65 };
const ref3 = bruteNearestClear(mk(0, 1.2), 0.3, tiny.x0, tiny.x1, tiny.y0, tiny.y1, []);
check('setup: the tiny strip really has NO clear non-pit square', !ref3.best && !!ref3.fb);
const got3 = scanClearStandingSpot(mk(0, 1.2), 0.3, tiny.x0, tiny.x1, tiny.y0, tiny.y1, []);
check('last-resort fallback = the square farthest from ANY leaves (never a buried one)',
  !!got3 && Math.hypot(got3.x - ref3.fb.x, got3.y - ref3.fb.y) < 1e-9);

// ===== scenario 4: whole-street scale stays cheap (40 crowns, 70u block, one pass) =====
treeCrowns = [];
for (let i = 0; i < 40; i++) treeCrowns.push({ wx: ((i * 1.9) % 76) - 2, wy: 1.4 + (i % 3), cz: 2.5 + (i % 4) * 0.1, cr: 1.1 });
const t0 = Date.now();
const got4 = scanClearStandingSpot(mk(10, 2), 0.3, 0.6, 76, 0.9, 7, []);
const ms = Date.now() - t0;
check('a full 70u tree-choked block scans in well under a second (' + ms + 'ms)', ms < 1500);
check('some square on a normal-sized street is always found', !!got4);

// ===== wiring pins: the force actually runs inside keepStreetItemsVisible =====
check('keepStreetItemsVisible forces any stander still hidden after the hop into the scan',
  src.indexOf('scanClearStandingSpot(o, it.foot, x0, x1, y0, y1, spots)') >= 0 &&
  src.indexOf('SHADE_NPC_MARGIN * 0.5, 1) > 0') >= 0);
check('the day-start gate judges standers with the margin+strict rule',
  src.indexOf('it.kind === "npc" ? SHADE_NPC_MARGIN : 0') >= 0);
check('the ring-hop candidates keep their generous 0.5u crown clearance for standers too',
  src.indexOf('SHADE_TOP[kind], SHADE_CLEAR, needCuts') >= 0);

console.log(ok ? '\nGUARANTEED-CLEAR STAND: ALL CHECKS PASS' : '\nGUARANTEED-CLEAR STAND FAILURES');
process.exit(ok ? 0 : 1);

