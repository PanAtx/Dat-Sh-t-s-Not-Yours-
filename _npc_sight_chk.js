// _npc_sight_chk.js — standing NPCs (hooker / jacker / panhandler) must never hold a spot
// the leaf crowns hide: for them ONE clipped sight line already means "player sees legs +
// a shadow" (the old cuts>=2 rule let exactly that through). Low items (bags/cans/baskets)
// keep the old two-line rule. Also pins the heavy-bag twist-tie: a thin sleeve flush on
// the cinch (headband-era wide ring is gone). All math extracted verbatim from index.html.
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

// ---- the sight-axis constants, re-derived exactly like index.html ----
const CAM_ANGLE_OFFSET = 0; // CAM_ANGLE_OFFSET_DEG = 0 in index.html
const ARM_H = 1, ARM_D = 1.4142; // ARM_H = ISO_A, ARM_D = 1.4142 * ISO_A (ISO_A cancels)
const SHADE_UX = Math.SQRT1_2 * (Math.sin(CAM_ANGLE_OFFSET) - Math.cos(CAM_ANGLE_OFFSET));
const SHADE_UY = -Math.SQRT1_2 * (Math.sin(CAM_ANGLE_OFFSET) + Math.cos(CAM_ANGLE_OFFSET));
const SHADE_UZ = ARM_H / ARM_D;
const SHADE_UN = Math.hypot(SHADE_UX, SHADE_UY, SHADE_UZ) || 1;
const SHX = SHADE_UX / SHADE_UN, SHY = SHADE_UY / SHADE_UN, SHZ = SHADE_UZ / SHADE_UN;
const SHADE_SAMPLE_Z = [0.25, 0.55, 0.85];
const SHADE_CLEAR = 0.5;
const SHADE_REACH = 9.0;
const SHADE_RINGS = [0.5, 0.9, 1.4, 2.0, 2.7, 3.5];
const SHADE_ANGLES = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6).sort((a, b) => Math.sin(a) - Math.sin(b));
const SHADE_TOP = { bag: 0.8, stormbox: 0.95, can: 1.05, litterbasket: 1.25, bonus: 0.8, npc: 1.75 };
const SHADE_SEP = 0.85, SHADE_SEP_NPC = 1.15;
let treeCrowns = [{ wx: 0, wy: 0, cz: 2.5, cr: 1.0 }]; // one sidewalk tree crown at the origin

eval(extractFn('crownShadeDepth'));
eval(extractFn('sitsOnTreePit'));
eval(extractFn('putStreetSpot'));
eval(extractFn('hopOutOfTreeShade'));

// ===== 1) the fairness gap exists AND the new rule catches it =====
let p1 = null; // a spot where EXACTLY ONE sight line drowns at standing-person height
for (let gy = -3; gy <= 4.5 && !p1; gy += 0.25)
  for (let gx = -3; gx <= 4.5 && !p1; gx += 0.25) {
    const d2 = crownShadeDepth(gx, gy, 0.3, SHADE_TOP.npc, 0, 2);
    const d1 = crownShadeDepth(gx, gy, 0.3, SHADE_TOP.npc, 0, 1);
    if (d2 === 0 && d1 > 0) p1 = { x: gx, y: gy };
  }
check('a legs-visible/torso-in-leaves spot exists near a crown (the reported bug)', !!p1);
check('old 2-line rule called it VISIBLE (depth 0)', crownShadeDepth(p1.x, p1.y, 0.3, SHADE_TOP.npc, 0, 2) === 0);
check('new 1-line rule calls it BLOCKED for standing characters (depth > 0)', crownShadeDepth(p1.x, p1.y, 0.3, SHADE_TOP.npc, 0, 1) > 0);
check('the needCuts parameter DEFAULTS to the old rule (items behave exactly as before)',
  crownShadeDepth(p1.x, p1.y, 0.3, SHADE_TOP.bag, 0) === crownShadeDepth(p1.x, p1.y, 0.3, SHADE_TOP.bag, 0, 2));
check('an open spot far from every crown is clear under BOTH rules',
  crownShadeDepth(12, 12, 0.3, SHADE_TOP.npc, 0, 1) === 0 && crownShadeDepth(12, 12, 0.3, SHADE_TOP.npc, 0, 2) === 0);

// ===== 2) hopOutOfTreeShade rescues an NPC planted there and lands him in clear sight =====
const mkNpc = (x, y) => ({ wx: x, wy: y, homeX: x, homeY: y, g: { position: { set() {} } } });
const hiddenNpc = mkNpc(p1.x, p1.y);
const spots = [{ o: hiddenNpc, x: p1.x, y: p1.y }];
const hopped = hopOutOfTreeShade(hiddenNpc, 'npc', 0.3, -6, 6, 0.9, 7, spots);
check('the hidden standing NPC gets hopped (returns true, actually moves)',
  hopped === true && (hiddenNpc.wx !== p1.x || hiddenNpc.wy !== p1.y));
check('the new spot is CLEAR under the strict standing-character rule',
  crownShadeDepth(hiddenNpc.wx, hiddenNpc.wy, 0.3, SHADE_TOP.npc, 0, 1) === 0);
check('the new spot is not wedged into the trunk pit', !sitsOnTreePit(hiddenNpc.wx, hiddenNpc.wy));
check('the NPC stays in its block strip and the walkable band',
  hiddenNpc.wx >= -6 && hiddenNpc.wx <= 6 && hiddenNpc.wy >= 0.9 && hiddenNpc.wy <= 7);
check('the home post moves with him (AI never walks him back into the leaves)',
  hiddenNpc.homeX === hiddenNpc.wx && hiddenNpc.homeY === hiddenNpc.wy);
const clearNpc = mkNpc(12, 12);
const before = { x: clearNpc.wx, y: clearNpc.wy };
check('an NPC in an already-clear block is left alone by the gate (depth 0, no pit)',
  crownShadeDepth(clearNpc.wx, clearNpc.wy, 0.3, SHADE_TOP.npc, 0, 1) === 0 && !sitsOnTreePit(clearNpc.wx, clearNpc.wy));
void before;

// ===== 3) the strict rule is wired at both call sites (source pins) =====
check('hopOutOfTreeShade passes needCuts straight from the kind (npc -> 1)',
  src.indexOf('kind === "npc" ? 1 : 2; // standers') >= 0 &&
  src.indexOf('SHADE_TOP[kind], SHADE_CLEAR, needCuts') >= 0);
check('keepStreetItemsVisible judges standing characters with the strict rule too',
  src.indexOf('it.kind === "npc" ? SHADE_NPC_MARGIN : 0') >= 0 &&
  src.indexOf('it.kind === "npc" ? 1 : 2,') >= 0);

// ===== 4) the tied top: gathered neck, pleats + hairline cinch tie (no dreidel, no ears) =====
check('the wide 0.135 headband ring is gone from makeBag',
  src.indexOf('CY(0.135, 0.135, 0.075') < 0);
check('the closed vase/dreidel top is gone (no frustum stack, no gathered tip)',
  !/const VASE =/.test(src) && !/const vTip =/.test(src));
// Each literal may be multiplied by tieTop's shared size factor `u` (= 1 for a 0.4 bag).
const nk = src.match(/const neck = CY\(([\d.]+)[^,]*, ([\d.]+)[^,]*, ([\d.]+)[^,]*, mat(?:,\s*\d+)*\)[\s\S]{0,240}?neck\.position\.z = zof\(([\d.]+)\)/);
const sn = src.match(/const snout = CY\(([\d.]+)[^,]*, ([\d.]+)[^,]*, ([\d.]+)[^,]*, mat(?:,\s*\d+)*\)[\s\S]{0,240}?snout\.position\.z = zof\(([\d.]+)\)/);
const tm = src.match(/const tie = CY\(\s*([\d.]+)[^,]*,\s*([\d.]+)[^,]*,\s*([\d.]+)[^,]*,\s*MS\(0xcfc79a/);
const tz = +(src.match(/tie\.position\.z = zof\(([\d.]+)\)/) || [])[1];
check('the tied top = gathered neck + a last pinch above the cinch + hairline twist-tie', !!nk && !!sn && !!tm);
if (nk && sn && tm) {
  const nr = +nk[1], nb = +nk[2], nh = +nk[3], nz = +nk[4];
  const sr = +sn[1], sb = +sn[2], sh = +sn[3], sz = +sn[4];
  const cinch = nz + nh / 2;
  // The neck gathers in and the pinch above it keeps NARROWING. The only thing allowed to get
  // wider again above the cinch is the loose grab flap, and that is a separate sheet (see 5).
  check('the neck GATHERS IN to a cinch and the pinch above it keeps narrowing (contiguous)',
    nr < nb && sr < sb && Math.abs(cinch - (sz - sh / 2)) < 1e-9);
  const rOf = (z) =>
    z <= cinch
      ? nb + (nr - nb) * ((z - (nz - nh / 2)) / nh)
      : sb + (sr - sb) * ((z - (sz - sh / 2)) / sh);
  const trTop = +tm[1], trBot = +tm[2], th = +tm[3];
  const gapLo = trBot - rOf(tz - th / 2), gapHi = trTop - rOf(tz + th / 2);
  check('the twist-tie rides the CINCH (within 0.03 of the gathered waist)', Math.abs(tz - cinch) <= 0.03);
  check('the band hugs the profile within 2-10 thousandths at BOTH ends (hairline, not a halo)',
    gapLo > 0.002 && gapLo < 0.01 && gapHi > 0.002 && gapHi < 0.01);
  check('the band is HAIRLINE thin (height <= 0.04) - a stripe, not a band', th <= 0.04);
}
// THE FILM IS NEVER SMOOTH and never round: the body is slumped BOTTOM-HEAVY, loaded from
// inside and then creased, while the neck is pleated into the folds a tie really leaves.
check('the body is slumped BOTTOM-HEAVY, loaded from inside, then creased',
  src.indexOf('slump(body.geometry') >= 0 && /stuff\(\s*body\.geometry/.test(src) &&
  src.indexOf('crinkle(body.geometry') >= 0);
check('the load is spent out of the bag\'s own slack and clamped back inside its envelope',
  /RIM = [\d.]+;[\s\S]{0,3000}?if \(rh > RIM\)/.test(src) &&
  src.indexOf('if (floor !== undefined && pz < floor)') >= 0);
check('the neck and the pinch are PLEATED (the folds a tie makes), not merely wrinkled',
  src.indexOf('pleat(neck.geometry') >= 0 && src.indexOf('pleat(snout.geometry') >= 0);

// ===== 5) THE TIED TOP: ONE knot band + TWO long grab ears (no loops, no bowl, no ball) =====
const tieSrc = src.slice(
  src.indexOf('function tieTop(g, o) {'),
  src.indexOf('function makeBag('),
);
check('the old hollow-loop ears stay dead: no loop constants, no oval, no flop rig',
  !/\bEAR_R\b/.test(src) && !/OVAL_X/.test(src) && !/flop\.rotation/.test(src) &&
  // the ONLY ear machinery left is the per-frame film-sway system the frames hang on.
  src.indexOf('function updateEarSway(') >= 0 &&
  src.indexOf('function registerEars(') >= 0);
check('tieTop ties ONCE: one knot band, and ONE builder loop growing exactly two ears',
  tieSrc.length > 400 &&
  (tieSrc.match(/TorusGeometry/g) || []).length === 1 &&
  (tieSrc.match(/ LA\(/g) || []).length === 1 &&
  (tieSrc.match(/for \(/g) || []).length === 1 &&
  tieSrc.indexOf('i < 2') >= 0);
check('the hollow crown is gone too: nothing is lathed as a bowl with a liner inside it',
  src.indexOf('const crown = LA(') < 0 && src.indexOf('const dimple = LA(') < 0);
check('the knot is ONE flattened band of film in the darker tone, not a ball and not a hoop',
  (() => {
    const k = src.match(/const knot = new THREE\.Mesh\(\s*new THREE\.TorusGeometry\(([\d.]+) \* u, ([\d.]+) \* u, \d+, \d+\),\s*dark,\s*\);[\s\S]{0,90}?knot\.scale\.set\(([^)]*)\)/);
    if (!k) return false;
    const s = k[3].split(',').map((n) => +n.trim());
    return +k[1] <= 0.11 && +k[2] <= 0.04 && s[2] > 0 && s[2] <= 0.75;
  })());
// THE GRAB: the excess film a tied bag is left with, doubled into the two long strips a
// garbageman hooks two fingers under. Being SHEETS they are surfaces of revolution stopping
// far short of a full turn (a NARROW arc = a strip, not a fan), crimped nearly SHUT at the
// root the knot grips, staying narrow on the way up and opening out to the knicked cut edge —
// the wide end points at the SKY (a root as wide as the knot continued the neck's cone and the
// whole top read as a lampshade) — and folded back down inside themselves: two faces, no slit.
check('each ear is lathed over a NARROW ARC of a turn: a strip, never a fan, horn or cone',
  (() => {
    const m = tieSrc.match(/arc = R\(([\d.]+), ([\d.]+)\)/);
    if (!m) return false;
    return (
      +m[1] > 0.3 && +m[2] < 0.9 && +m[2] > +m[1] && // 24-36 degrees: a folded strip
      tieSrc.indexOf('LA(PROF, mat, 7, -arc / 2, arc)') >= 0 // centred on the lean
    );
  })());
check('each ear is a FOLDED, LONG strip: crimped shut at its root, WIDEST at its cut edge',
  (() => {
    const body = (tieSrc.match(/PROF = \[([\s\S]*?)\n\s*\],/) || [])[1];
    if (!body) return false;
    const p = [...body.matchAll(/\[\s*([\d.]+) \* u,\s*([^,\]]+?)\s*\]/g)].map((m) => [
      parseFloat(m[1]),
      m[2] === '0' ? 0 : m[2] === 'L' ? 1 : parseFloat(m[2]), // height as a FRACTION of L
    ]);
    if (p.length < 6) return false;
    const iTop = p.reduce((a, b, i) => (b[1] > p[a][1] ? i : a), 0),
      iWide = p.reduce((a, b, i) => (b[0] > p[a][0] ? i : a), 0);
    return (
      Math.abs(p[0][0] - p[p.length - 1][0]) < 1e-9 && // welded shut at the root: two faces
      Math.abs(p[0][1] - p[p.length - 1][1]) < 1e-9 &&
      p[iTop][1] === 1 && // the strip runs its full drawn length L...
      iWide === iTop && // ...and is WIDEST at the loose cut end — the flare opens to the sky,
      p[iWide][0] > p[1][0] && // from a root that the knot has crimped nearly shut: an ear
      p[0][0] <= p[iWide][0] * 0.5 && // whose root is as wide as its tip is a LAMPSHADE, full stop
      iTop < p.length - 1 // the wall folds back inside itself: hollow, not solid
    );
  })());
check('each ear is CUT UNEVEN, CRINKLED, CURLED OVER — and flops harder the emptier the bag',
  tieSrc.indexOf('fray(film.geometry') >= 0 &&
  tieSrc.indexOf('crinkle(film.geometry') >= 0 &&
  tieSrc.indexOf('curl(film.geometry') >= 0 &&
  /tilt = 0\.055 \* \(1 \+ 5 \* \(1 - full\)\)/.test(tieSrc) && // the fullness tell itself
  tieSrc.indexOf('i * Math.PI + R(-0.5, 0.5)') >= 0); // splayed near-opposite, never a bow
check('the ears are rooted INSIDE the knot band they grow out of (nothing floats)',
  (() => {
    const gz = +((src.match(/yaw\.position\.z = zof\(([\d.]+)\)/) || [])[1] || 0);
    const kz = +((src.match(/knot\.position\.z = zof\(([\d.]+)\)/) || [])[1] || 0);
    return gz > 0.8 && kz > 0.8 && Math.abs(gz - kz) < 0.03;
  })());
check('the curb bags AND the truck\'s grey hopper lumps share ONE tie builder (tieTop)',
  /function tieTop\(g, o\) \{/.test(src) &&
  /tieTop\(g, \{\s*s: 0\.4,\s*top: 0\.715,/.test(src) &&
  /tieTop\(g, \{\s*s: 0\.4,\s*top: 0\.48,/.test(src));

console.log(ok ? '\nNPC TREE-SIGHT ALL CHECKS PASS' : '\nNPC TREE-SIGHT FAILURES');
process.exit(ok ? 0 : 1);

check('thin plastic is never smooth: body, bulge, neck and ear film are all crinkled',
  src.indexOf('crinkle(body.geometry') >= 0 && src.indexOf('crinkle(lump.geometry') >= 0 &&
  src.indexOf('crinkle(neck.geometry') >= 0 && src.indexOf('crinkle(film.geometry') >= 0);
