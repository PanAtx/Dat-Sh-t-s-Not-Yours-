// _dump_standoff_chk.js — proves the carried-item dump fix: when the worker is
// CARRYING a bag / heavy bag / can / litter basket, (1) he's kept a full
// CARRY_M (0.7u) standoff off the PAINTED truck body on the sides and the cab
// so the held item (bag ~0.72u out, basket ~0.95u) can never clip the truck,
// and (2) the dump zone must be reachable at the CLOSEST he can get to the
// back of the hooper (the open REAR scoop — heavy bags + cans have to be
// hauled right up to it). Before the fix, the carrying push-out pinned him
// into the paint on the sides, and a past-tight margin left the dump zones
// (nearHopper / nearHopperHeavy / nearHopperLitter) just out of reach, so
// "I need to get closer to the truck!" fired at his closest spot.
//
// Fix under test:
//   1) push-out: carrying keeps a CARRY_M = 0.7u standoff off the painted
//      body on the street side + cab, a SMALLER CARRY_M_CURB = 0.4u on the
//      curb (LEFT) side (he may stand a bit closer to the truck's left), and
//      a SMALLER CARRY_M_BACK = 0.25u at the rear — the open scoop is the
//      dumping spot, so he stands a bit closer to the back of the hopper
//      (deepest = 0.25 + radius 0.45 = 0.7u past the face) while his held
//      item never reaches solid body; the rear CURB-side corner (hopper back
//      meets the truck's LEFT) is ROUNDED (CARRY_CORNER_R = 1.5u quarter
//      arc) so a carrying worker can tuck right up to that corner — the
//      sharp corner's diagonal push used to pin him well back from it. Only
//      that corner is rounded; the street-side rear corner stays sharp;
//   2) the truck's own motion must never shove a STANDING worker: the push-out
//      is skipped only while he doesn't move — the instant he walks again he's
//      pushed OUT of the body (a truck that swept over him can't let him walk
//      through the hopper from either side);
//   3) dump zones: heavy cargo (heavy bag + full can) uses the tight 3.6u
//      rear zone, lighter bags keep the generous band (dx < 4.0), basket 4.0.
const assert = require('assert');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
function extractFn(src, name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('not found: ' + name);
  const b = src.indexOf('{', idx); let d = 0, i = b;
  for (; i < src.length; i++){ if (src[i]==='{') d++; else if (src[i]==='}'){ d--; if (!d){ i++; break; } } }
  return src.slice(idx, i);
}
let pass = 0;
function check(n, f){ try { f(); pass++; console.log('  ok  ' + n); } catch (e){ console.error(' FAIL ' + n + ' :: ' + e.message); process.exitCode = 1; } }

// ---- REAL truck geometry (FBX path, the truck the player actually sees) ----------
// boxL is the HALF length; the rear (hopper) face is at wx - boxL. The scoop /
// deposit point sits 1.6u INSIDE the face (hopperOff = -boxL + 1.6, hopperY -0.5).
const BOX_L = 6.76, FACE_X = 0 - BOX_L, HOP_X = 0 + (-BOX_L + 1.6), HOP_Y = -4.5 - 0.5;
const truck = { wx: 0, boxL: BOX_L, boxW: 1.8, boxWStreet: 1.8, boxWCurb: 0.63, hopperOff: -BOX_L + 1.6, hopperY: -0.5, hidden: 0 };
const p = { wx: -7.56, wy: -4.5, stunT: 0 };

// ---- 1) structural: index.html carries the asymmetric push-out + zones -------
check('push-out: carrying standoff constant CARRY_M = 0.7u', ()=>{
  assert.ok(html.indexOf('const CARRY_M = 0.7;') >= 0);
});
check('push-out: street side keeps the full CARRY_M standoff off the painted body (no item clipping)', ()=>{
  assert.ok(html.indexOf('Math.max(tHalfWStreet, _visReach) + CARRY_M') >= 0);
});
check('push-out: curb (LEFT) side uses the SMALLER CARRY_M_CURB margin (carrying worker stands a bit closer)', ()=>{
  assert.ok(html.indexOf('const CARRY_M_CURB = 0.4;') >= 0);
  assert.ok(html.indexOf('Math.max(tHalfWCurb, _visReach) + CARRY_M_CURB') >= 0);
  const mCur = html.match(/const CARRY_M_CURB = ([\d.]+);/),
    mStr = html.match(/const CARRY_M = ([\d.]+);/);
  assert.ok(mCur && mStr && parseFloat(mCur[1]) < parseFloat(mStr[1]), 'curb margin must stay smaller than the street/cab margin');
});
check('push-out: front (cab) keeps the CARRY_M carry margin', ()=>{
  assert.ok(html.indexOf('const tHalfLendPFront = _holding ? tHalfL + CARRY_M : tHalfL;') >= 0);
});
check('push-out: rear keeps the smaller CARRY_M_BACK standoff (a bit closer to the hopper)', ()=>{
  assert.ok(html.indexOf('const CARRY_M_BACK = 0.25;') >= 0);
  assert.ok(html.indexOf('const tHalfLendPBack = _holding ? tHalfL + CARRY_M_BACK : tHalfL;') >= 0);
});
check('push-out: truck motion must never drag a standing worker, but a walking one is pushed OUT (no hopper pass-through)', ()=>{
  assert.ok(html.indexOf('const preOut = pdx * pdx + pdy * pdy >= WR * WR;') >= 0);
  assert.ok(html.indexOf('if (preOut || f !== 0 || l !== 0) {') >= 0);
});
check('push-out: degenerate ejection exits through the NEAREST face (rear face included)', ()=>{
  assert.ok(html.indexOf('const dBack = p.wx - (tCx - tHalfLendPBack);') >= 0);
  assert.ok(html.indexOf('if (m === dBack) p.wx = tCx - tHalfLendPBack - WR;') >= 0);
});
check('push-out: cx clamp uses back limit on the rear side, front limit on the cab side', ()=>{
  assert.ok(html.indexOf('let cx = Math.min(Math.max(p.wx, tCx - tHalfLendPBack), tCx + tHalfLendPFront);') >= 0);
});
check('zones: nearHopper band dx < 4.0 (lighter bags toss from further back), basket 4.0, heavy 3.6', ()=>{
  assert.ok(html.indexOf('return dx > -1.0 && dx < 4.0 && Math.abs(dy) < 4.5;') >= 0);
  assert.ok(html.indexOf('const LITTER_DUMP_RADIUS = 4.0;') >= 0);
  assert.ok(html.indexOf('const HEAVY_DUMP_RADIUS = 3.6;') >= 0);
});
check('can is heavy cargo: dumped only from the tight rear zone (nearHopperHeavy)', ()=>{
  assert.ok(html.indexOf('carry === "canFull" || !!(carried && carried.type === "heavy")') >= 0);
});

// ---- 1b) behavioral: the REAL push-out math (carrying box), replicated from updatePlayer ----
// The player-reported bug: a carrying worker could walk THROUGH the back of the
// hopper (one side), because a truck whose motion covered the worker disabled the
// push-out entirely. These drive the exact formula to prove: (a) a standing worker
// is never dragged by the truck's back-up, (b) a walking worker is always pushed
// OUT of the body — he can never cross the rear face from either side.
const WR = 0.45, CARRY_M = 0.7, CARRY_M_CURB = 0.4, CARRY_M_BACK = 0.25, CARRY_CORNER_R = 1.5, T_CY = -4.5;
const C_STREET = T_CY - (Math.max(1.8, 1.8 * 1.25) + CARRY_M); // -7.45 painted street edge + 0.7
const C_CURB = T_CY + (Math.max(1.8, 1.8 * 1.25) + CARRY_M_CURB); // -1.85 curb margin is smaller
const X_FRONT = BOX_L + CARRY_M;                               // +7.46
function pushOut(wx, wy, prevX, prevY, moving, boxX0) {
  const cx = Math.min(Math.max(wx, boxX0), X_FRONT);
  const cy = Math.min(Math.max(wy, C_STREET), C_CURB);
  const dx = wx - cx, dy = wy - cy, d2 = dx * dx + dy * dy;
  if (d2 < WR * WR) {
    const pdx = prevX - cx, pdy = prevY - cy;
    if (pdx * pdx + pdy * pdy >= WR * WR || moving) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), push = WR - d;
        return [wx + (dx / d) * push, wy + (dy / d) * push];
      }
      const dBack = wx - boxX0, dFront = X_FRONT - wx, dSt = wy - C_STREET, dCu = C_CURB - wy;
      const m = Math.min(dBack, dFront, dSt, dCu);
      if (m === dBack) return [boxX0 - WR, wy];
      if (m === dFront) return [X_FRONT + WR, wy];
      if (m === dSt) return [wx, C_STREET - WR];
      return [wx, C_CURB + WR];
    }
  }
  return [wx, wy];
}
// Same push-out, but with the rear CURB-side corner rounded (CARRY_CORNER_R
// quarter arc) — mirrors the game's current carrying behavior exactly.
function pushOutR(wx, wy, prevX, prevY, moving, boxX0) {
  let cx = Math.min(Math.max(wx, boxX0), X_FRONT);
  let cy = Math.min(Math.max(wy, C_STREET), C_CURB);
  if (wx < boxX0 && wy > C_CURB) {
    const R = CARRY_CORNER_R;
    const acx = boxX0 + R, acy = C_CURB - R;
    const adx = wx - acx, ady = wy - acy;
    const ad = Math.hypot(adx, ady) || 1e-4;
    cx = acx + (adx / ad) * R;
    cy = acy + (ady / ad) * R;
  }
  const dx = wx - cx, dy = wy - cy, d2 = dx * dx + dy * dy;
  if (d2 < WR * WR) {
    const pdx = prevX - cx, pdy = prevY - cy;
    if (pdx * pdx + pdy * pdy >= WR * WR || moving) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), push = WR - d;
        return [wx + (dx / d) * push, wy + (dy / d) * push];
      }
      const dBack = wx - boxX0, dFront = X_FRONT - wx, dSt = wy - C_STREET, dCu = C_CURB - wy;
      const m = Math.min(dBack, dFront, dSt, dCu);
      if (m === dBack) return [boxX0 - WR, wy];
      if (m === dFront) return [X_FRONT + WR, wy];
      if (m === dSt) return [wx, C_STREET - WR];
      return [wx, C_CURB + WR];
    }
  }
  return [wx, wy];
}
check('push-out: rear CURB corner is rounded for carrying workers (CARRY_CORNER_R quarter arc)', ()=>{
  assert.ok(html.indexOf('const CARRY_CORNER_R = 1.5;') >= 0);
  assert.ok(html.indexOf('if (_holding && p.wx < tCx - tHalfLendPBack && p.wy > tCy + tHalfWCurbP) {') >= 0);
  assert.ok(html.indexOf('cx = acx + (adx / ad) * R;') >= 0);
  assert.ok(html.indexOf('cy = acy + (ady / ad) * R;') >= 0);
});
check('rounded corner: a carrying worker can now stand RIGHT AT the rear CURB corner (old sharp rule kept him 0.45u back)', ()=>{
  // u = 45-degree diagonal into the corner. r = distance from the old corner
  // point along it. Old sharp rule: he is legal only at r >= 0.45. The rounded
  // corner (radius 1.5) removes the corner material, so the whole zone
  // r <= ~0.17 must now be a legal standing spot — he tucks right into the
  // curve where bags / baskets used to be rejected as "far away".
  const ux = -Math.SQRT1_2, uy = Math.SQRT1_2;
  const corX = -BOX_L - CARRY_M_BACK, corY = C_CURB; // corner of the carrying push-out box
  for (const r of [0.05, 0.1, 0.15]) {
    const wx = corX + r * ux, wy = corY + r * uy;
    const [px, py] = pushOutR(wx, wy, wx, wy, true, -BOX_L - CARRY_M_BACK);
    assert.ok(Math.hypot(px - wx, py - wy) < 1e-6, 'rounded corner still rejects r=' + r);
  }
  // ...and the OLD sharp box rejected all of those spots (push > 0.3u out):
  for (const r of [0.05, 0.1]) {
    const wx = corX + r * ux, wy = corY + r * uy;
    const [px, py] = pushOut(wx, wy, wx, wy, true, -BOX_L - CARRY_M_BACK);
    assert.ok(Math.hypot(px - wx, py - wy) > 0.3, 'sharp box should reject r=' + r);
  }
});
check('rounded corner only at the rear CURB corner: street-side rear corner walk is identical to the sharp box', ()=>{
  function walk(rounded) {
    let x = FACE_X - 3.0, y = C_STREET - 3.0; // street-side corner diagonal (y-)
    for (let i = 0; i < 200; i++) {
      const b = [x, y];
      x += 0.1; y += 0.1;
      const r = rounded
        ? pushOutR(x, y, b[0], b[1], true, -BOX_L - CARRY_M_BACK)
        : pushOut(x, y, b[0], b[1], true, -BOX_L - CARRY_M_BACK);
      x = r[0]; y = r[1];
    }
    return [x, y];
  }
  const sharp = walk(false), rnd = walk(true);
  assert.ok(Math.abs(rnd[0] - sharp[0]) < 1e-9 && Math.abs(rnd[1] - sharp[1]) < 1e-9,
    'street corner moved: rounded (' + rnd[0].toFixed(2) + ',' + rnd[1].toFixed(2) + ') vs sharp (' + sharp[0].toFixed(2) + ',' + sharp[1].toFixed(2) + ')');
});
check('rounded corner cannot be exploited: crossing the face line near the corner happens only OUTSIDE the curb edge', ()=>{
  let x = FACE_X - 3, y = C_CURB + 1.2;
  let crossed = null;
  for (let i = 0; i < 500; i++) {
    const b = [x, y];
    x += 0.11;
    const r = pushOutR(x, y, b[0], b[1], true, -BOX_L - CARRY_M_BACK);
    x = r[0]; y = r[1];
    if (x > FACE_X + 1.2 && crossed === null) crossed = y;
    if (x > FACE_X + 3) break;
  }
  if (crossed !== null) assert.ok(crossed >= C_CURB, 'crossed the face inside the body at y=' + crossed.toFixed(2));
});
check('TRUCK BACKING UP over a standing carrying worker never drags him', ()=>{
  let wx = FACE_X - 0.85, wy = -4.5; // standing behind the carrying box rear (FACE_X - 0.25 - 0.45 band)
  let dragged = false;
  for (let i = 1; i <= 12; i++) {
    const boxX0 = -BOX_L - CARRY_M_BACK - 0.1 * i; // truck backs up 0.1u/frame
    const r = pushOut(wx, wy, wx, wy, false, boxX0);
    if (r[0] !== wx || r[1] !== wy) dragged = true;
    wx = r[0]; wy = r[1];
  }
  assert.ok(!dragged, 'worker moved to (' + wx.toFixed(2) + ',' + wy.toFixed(2) + ') while standing still');
});
check('overlapped worker who WALKS is pushed out of the body — never through the rear face (either side)', ()=>{
  // Truck has backed up over him: box rear at FACE_X - 1.25, he's at FACE_X - 0.85 (inside).
  let crossed = false;
  let wx = FACE_X - 0.85, wy = -4.5, boxX0 = FACE_X - 1.25;
  for (let i = 0; i < 60; i++) {
    const b = [wx, wy];
    wx += 0.09; // walks +x, trying to go through the hopper
    const r = pushOut(wx, wy, b[0], b[1], true, boxX0);
    wx = r[0]; wy = r[1];
    if (wx > FACE_X) crossed = true;
  }
  assert.ok(!crossed, 'worker crossed the hopper face at x=' + wx.toFixed(2));
});
check('carrying worker cannot cross the rear face from the STREET (right) side at any lane y', ()=>{
  for (let y0 = C_STREET - 0.4; y0 <= T_CY; y0 += 0.2) {
    let x = FACE_X - 3, y = y0, crossed = null;
    for (let i = 0; i < 500; i++) {
      const b = [x, y];
      x += 0.11;
      const r = pushOut(x, y, b[0], b[1], true, -BOX_L - CARRY_M_BACK);
      x = r[0]; y = r[1];
      if (x > FACE_X + 1.2 && crossed === null) crossed = y;
      if (x > FACE_X + 3) break;
    }
    if (crossed !== null) assert.ok(crossed <= C_STREET, 'crossed the face inside the street-side body at y=' + crossed.toFixed(2));
  }
});
check('carrying worker cannot cross the rear face from the CURB (left) side at any lane y (rounded corner in effect)', ()=>{
  for (let y0 = T_CY; y0 <= C_CURB + 0.4; y0 += 0.2) {
    let x = FACE_X - 3, y = y0, crossed = null;
    for (let i = 0; i < 500; i++) {
      const b = [x, y];
      x += 0.11;
      const r = pushOutR(x, y, b[0], b[1], true, -BOX_L - CARRY_M_BACK);
      x = r[0]; y = r[1];
      if (x > FACE_X + 1.2 && crossed === null) crossed = y;
      if (x > FACE_X + 3) break;
    }
    if (crossed !== null) assert.ok(crossed >= C_CURB, 'crossed the face inside the curb-side body at y=' + crossed.toFixed(2));
  }
});

// ---- 2) the REAL zone functions, driven at the carrying standoff positions -------
const zoneBody = ['nearHopper','nearHopperHeavy','nearHopperLitter'].map(n=>extractFn(html,n)).join('\n');
const LITTER_DUMP_RADIUS = 4.0, HEAVY_DUMP_RADIUS = 3.6;
const zones = new Function('truck','p','LITTER_DUMP_RADIUS','HEAVY_DUMP_RADIUS',
  'var state="play";\n' + zoneBody + '\nreturn { nearHopper, nearHopperHeavy, nearHopperLitter };'
)(truck, p, LITTER_DUMP_RADIUS, HEAVY_DUMP_RADIUS);
function at(wx, wy){ p.wx = wx; p.wy = wy; }
function allNear(){ return zones.nearHopper() && zones.nearHopperHeavy() && zones.nearHopperLitter(); }

check('KEY: 1.0u past the rear face (just past the deepest carrying approach) -> all three zones say NEAR', ()=>{
  at(FACE_X - 1.0, -4.5);
  assert.strictEqual(zones.nearHopper(), true, 'nearHopper dx=' + (HOP_X - p.wx));
  assert.strictEqual(zones.nearHopperHeavy(), true);
  assert.strictEqual(zones.nearHopperLitter(), true);
});
check('KEY: 0.8u past the face (edge of the carrying standoff) -> all three zones say NEAR', ()=>{
  at(FACE_X - 0.8, -4.5);
  assert.strictEqual(allNear(), true);
});
check('truck auto-follow equilibrium (0.1u past the face) -> all zones say NEAR', ()=>{
  at(FACE_X - 0.1, -4.5);
  assert.strictEqual(allNear(), true);
});
check('KEY: deepest carrying approach (CARRY_M_BACK 0.25 + worker radius 0.45 = 0.7u past the face) -> all zones say NEAR', ()=>{
  at(FACE_X - 0.7, -4.5);
  assert.strictEqual(allNear(), true);
});
check('rear street-side corner standoff -> all zones say NEAR', ()=>{
  at(FACE_X - 0.25 - 0.318, -7.45 - 0.318); // corner (-7.01, -7.45) + 0.45 diagonal
  assert.strictEqual(allNear(), true);
});
check('rear curb-side corner standoff -> light-bag band says NEAR', ()=>{
  at(FACE_X - 0.25 - 0.318, -1.85 + 0.318); // corner (-7.01, -1.85) + 0.45 diagonal
  assert.strictEqual(zones.nearHopper(), true);
  assert.strictEqual(zones.nearHopperHeavy(), false);
});
check('zone is still bounded: 4.5u past the face -> all zones say FAR', ()=>{
  at(FACE_X - 4.5, -4.5);
  assert.strictEqual(zones.nearHopper(), false);
  assert.strictEqual(zones.nearHopperHeavy(), false);
  assert.strictEqual(zones.nearHopperLitter(), false);
});
check('zone stays lateral-local: on the far sidewalk -> nearHopper FAR', ()=>{
  at(FACE_X - 0.8, 1.0);
  assert.strictEqual(zones.nearHopper(), false);
});

// ---- 3) end-to-end: tryInteract at the closest approach dumps, no "closer" line --
const body = ['nearHopper','nearHopperHeavy','nearHopperLitter','tossBag','dumpCan','dumpLitterBasket','tryInteract'].map(n=>extractFn(html,n)).join('\n');
const calls = { voices: [] };
const flyingBags = [], flyingCans = [], flyingBaskets = [];
const dynamicGroup = { add(g){ g.parent = dynamicGroup; }, remove(g){ g.parent = null; } };
const SFX = { playTossSound(){}, playCanDropSound(){} };
const Voice = { say(t){ calls.voices.push(t); } };
const R = (a,b)=>a; // deterministic
const clamp = (v,a,b)=>v<a?a:(v>b?b:v);
function addScore(){} function hopperDeposit(){} function checkHouse(){}
const api = new Function(
  'truck','p','dynamicGroup','flyingBags','flyingCans','flyingBaskets','SFX','Voice','R','clamp','state','blocks','creatures','WORKER_GENDER','LITTER_DUMP_RADIUS','HEAVY_DUMP_RADIUS','addScore','hopperDeposit','checkHouse',
  'var carry="none", carried=null; function pickUp(){}\n' + body + '\n' +
  'return { nearHopper, nearHopperHeavy, nearHopperLitter, tryInteract, ' +
  'setCarry:function(c,i){ carry=c; carried=i; }, getCarry:function(){ return carry; } };'
)(truck, p, dynamicGroup, flyingBags, flyingCans, flyingBaskets, SFX, Voice, R, clamp, 'play', [], [], 'male', LITTER_DUMP_RADIUS, HEAVY_DUMP_RADIUS, addScore, hopperDeposit, checkHouse);
function makeBag(type){ return { kind:'bag', type: type, state:'curb', h:{}, g:{ parent:null } }; }
function reset(){ calls.voices.length=0; flyingBags.length=0; flyingCans.length=0; flyingBaskets.length=0; }

check('END-TO-END: normal bag at the closest approach -> dumped, silent', ()=>{
  reset(); at(FACE_X - 0.7, -4.5);
  const b = makeBag('normal');
  api.setCarry('bag', b);
  api.tryInteract();
  assert.strictEqual(b.state, 'dumped');
  assert.strictEqual(flyingBags.length, 1);
  assert.strictEqual(api.getCarry(), 'none');
  assert.deepStrictEqual(calls.voices, []);
});
check('END-TO-END: HEAVY bag at the deepest carrying approach -> dumped, silent', ()=>{
  reset(); at(FACE_X - 0.7, -4.5);
  const b = makeBag('heavy');
  api.setCarry('bag', b);
  api.tryInteract();
  assert.strictEqual(b.state, 'dumped');
  assert.strictEqual(flyingBags.length, 1);
  assert.deepStrictEqual(calls.voices, []);
});
check('END-TO-END: full can at the deepest carrying approach -> dumped, silent', ()=>{
  reset(); at(FACE_X - 0.6, -4.5);
  const c = { kind:'can', state:'curb', h:{ wx:0, wy:0 }, home:{ wx:0, wy:0 }, g:{ parent:null } };
  api.setCarry('canFull', c);
  api.tryInteract();
  assert.strictEqual(c.state, 'dumped');
  assert.strictEqual(flyingCans.length, 1);
  assert.deepStrictEqual(calls.voices, []);
});
check('END-TO-END: litter basket at the rear curb side of the standoff -> dumped, silent', ()=>{
  reset(); at(FACE_X - 0.8, -1.9);
  const b = { kind:'litterbasket', state:'curb', h:{}, hx:10, hy:0, g:{ parent:null }, trash:null };
  api.setCarry('litterBasket', b);
  api.tryInteract();
  assert.strictEqual(b.state, 'dumped');
  assert.strictEqual(flyingBaskets.length, 1);
  assert.deepStrictEqual(calls.voices, []);
});
check('regression: normal bag 4.5u past the face -> "get closer" line, no dump', ()=>{
  reset(); at(FACE_X - 4.5, -4.5);
  const b = makeBag('normal');
  api.setCarry('bag', b);
  api.tryInteract();
  assert.strictEqual(b.state, 'curb');
  assert.deepStrictEqual(calls.voices, ['I need to get closer to the truck!']);
});
check('regression: heavy bag 4.5u past the face -> "too heavy" line, no dump', ()=>{
  reset(); at(FACE_X - 4.5, -4.5);
  const b = makeBag('heavy');
  api.setCarry('bag', b);
  api.tryInteract();
  assert.strictEqual(b.state, 'curb');
  assert.deepStrictEqual(calls.voices, ['I need to be closer to the truck. This bag is too heavy!']);
});
check('regression: full can 4.5u past the face -> "get closer" line, no dump (can = heavy cargo)', ()=>{
  reset(); at(FACE_X - 4.5, -4.5);
  const c = { kind:'can', state:'curb', h:{ wx:0, wy:0 }, home:{ wx:0, wy:0 }, g:{ parent:null } };
  api.setCarry('canFull', c);
  api.tryInteract();
  assert.strictEqual(c.state, 'curb');
  assert.strictEqual(flyingCans.length, 0);
  assert.deepStrictEqual(calls.voices, ['I need to get closer to the truck!']);
});

// ---- 4) TEST MODE B: the magenta debug box for the carrying push-out -------
check('debug box: B toggles the MAGENTA carrying push-out outline that follows the truck', ()=>{
  assert.ok(html.indexOf('if (e.code === "KeyB") toggleTruckDebugBox();') >= 0);
  assert.ok(html.indexOf('0xff00ff') >= 0, 'magenta color');
  assert.ok(html.indexOf('truckDebugBox.position.set(Number.isFinite(truck.wx) ? truck.wx : 0, -4.5, GZ);') >= 0);
  assert.ok(html.indexOf('updateTruckDebugBox();') > html.indexOf('truck.g.position.set(truck.wx, -4.5, GZ);'));
});
check('debug box: group is placed at the truck AT BUILD TIME (not buried at the world origin under the road)', ()=>{
  assert.ok(html.indexOf('grp.position.set(Number.isFinite(truck.wx) ? truck.wx : 0, -4.5, GZ);') >= 0);
});
check('debug box: lives INSIDE worldGroup (the +45deg-rotated world) so it sits on the street, and forces a fresh menu frame', ()=>{
  const blk = html.indexOf('TEST MODE: B = MAGENTA TRUCK DEBUG BOX');
  assert.ok(blk >= 0);
  assert.ok(html.indexOf('worldGroup.add(grp);') > blk);
  assert.ok(html.indexOf('worldGroup.remove(truckDebugBox);') > blk);
  assert.ok(html.indexOf('needsIdleRender = true;', blk) > blk);
});
check('debug box: mirrors the carrying push-out constants (0.7 street / 0.4 curb / 0.25 back / 1.5 corner / 0.45 radius)', ()=>{
  assert.ok(html.indexOf('const C_M = 0.7,') >= 0);
  assert.ok(html.indexOf('C_M_CURB = 0.4,') >= 0);
  assert.ok(html.indexOf('C_M_BACK = 0.25,') >= 0);
  assert.ok(html.indexOf('CORNER_R = 1.5;') >= 0);
  assert.ok(html.indexOf('const TRUCK_DEBUG_WR = 0.45;') >= 0);
});
// Run the REAL outline builder from index.html with a minimal THREE stub:
function makeDebugOutline(){
  const stub = {
    BufferGeometry: class { setAttribute(n, a) { this[n] = a; } getAttribute(n) { return this[n]; } },
    BufferAttribute: class { constructor(a, s) { this.array = a; this.itemSize = s; } },
  };
  const f = extractFn(html, 'truckDebugOutline');
  return new Function('THREE', f + '; return truckDebugOutline;')(stub);
}
function outlinePts(geo){
  const a = geo.getAttribute('position').array, out = [];
  for (let i = 0; i < a.length; i += 3) out.push([a[i], a[i + 1]]);
  return out;
}
check('debug box outline: the rounded rear CURB corner is drawn as a quarter arc (depth = R·(√2−1))', ()=>{
  const make = makeDebugOutline();
  const halfBack = BOX_L + 0.25, halfFront = BOX_L + 0.7, eS = 2.25 + 0.7, eC = 2.25 + 0.4;
  const pts = outlinePts(make(halfBack, halfFront, eS, eC, 1.5));
  assert.ok(pts.length >= 10 && pts.every(q => isFinite(q[0]) && isFinite(q[1])));
  const corX = -halfBack, corY = eC; // where the OLD sharp corner point was
  let dmin = 1e9;
  for (const q of pts) dmin = Math.min(dmin, Math.hypot(q[0] - corX, q[1] - corY));
  assert.ok(Math.abs(dmin - 1.5 * (Math.SQRT2 - 1)) < 1e-3, 'arc depth ' + dmin);
  // every point sits on a flat edge OR exactly on the arc circle:
  const ax = corX + 1.5, ay = corY - 1.5;
  for (const q of pts) {
    const onEdge =
      (Math.abs(q[0] - halfFront) < 1e-5 && q[1] >= -eS - 1e-5 && q[1] <= eC + 1e-5) ||
      (Math.abs(q[1] - eC) < 1e-5 && q[0] <= corX + 1.5 + 1e-5 && q[0] >= corX - 1e-5) ||
      (Math.abs(q[0] - corX) < 1e-5 && q[1] <= eC - 1.5 + 1e-5 && q[1] >= -eS - 1e-5) ||
      (Math.abs(q[1] + eS) < 1e-5 && q[0] <= halfFront + 1e-5 && q[0] >= corX - 1e-5);
    assert.ok(onEdge || Math.abs(Math.hypot(q[0] - ax, q[1] - ay) - 1.5) < 1e-4, 'off-shape point ' + q);
  }
});
check('debug box outline: OUTER line = inner + the 0.45u worker radius (where his CENTER stops)', ()=>{
  const make = makeDebugOutline();
  const halfBack = BOX_L + 0.25, halfFront = BOX_L + 0.7, eS = 2.25 + 0.7, eC = 2.25 + 0.4;
  const inr = outlinePts(make(halfBack, halfFront, eS, eC, 1.5));
  const out = outlinePts(make(halfBack + 0.45, halfFront + 0.45, eS + 0.45, eC + 0.45, 1.5 + 0.45));
  const ext = (a, f) => f(...a.map(q => q[0])), extY = (a, f) => f(...a.map(q => q[1]));
  assert.ok(Math.abs(ext(out, Math.max) - (ext(inr, Math.max) + 0.45)) < 1e-5);
  assert.ok(Math.abs(ext(out, Math.min) - (ext(inr, Math.min) - 0.45)) < 1e-5);
  assert.ok(Math.abs(extY(out, Math.max) - (extY(inr, Math.max) + 0.45)) < 1e-5);
  assert.ok(Math.abs(extY(out, Math.min) - (extY(inr, Math.min) - 0.45)) < 1e-5);
  const corX = -halfBack, corY = eC;
  let dmin = 1e9;
  for (const q of out) dmin = Math.min(dmin, Math.hypot(q[0] - corX, q[1] - corY));
  // same arc center, bigger radius -> the corner depth shrinks by exactly 0.45
  assert.ok(Math.abs(dmin - (1.5 * (Math.SQRT2 - 1) - 0.45)) < 1e-3, 'outer arc depth ' + dmin);
});
check('debug box outline: the rear STREET-side corner stays SHARP (exact vertex, no arc)', ()=>{
  const make = makeDebugOutline();
  const halfBack = BOX_L + 0.25, halfFront = BOX_L + 0.7, eS = 2.25 + 0.7, eC = 2.25 + 0.4;
  const pts = outlinePts(make(halfBack, halfFront, eS, eC, 1.5));
  assert.ok(
    pts.some(q => Math.abs(q[0] + halfBack) < 1e-5 && Math.abs(q[1] + eS) < 1e-5),
    'missing sharp street corner vertex',
  );
});

console.log('\n' + pass + ' dump-standoff checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));