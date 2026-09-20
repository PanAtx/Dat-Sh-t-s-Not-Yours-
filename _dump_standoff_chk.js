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
//      body on the sides + cab, and a SMALLER CARRY_M_BACK = 0.25u at the
//      rear — the open scoop is the dumping spot, so he stands a bit closer
//      to the back of the hopper (deepest = 0.25 + radius 0.45 = 0.7u past
//      the face) while his held item never reaches solid body;
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
check('push-out: sides keep the CARRY_M standoff off the painted body (no item clipping)', ()=>{
  assert.ok(html.indexOf('Math.max(tHalfWStreet, _visReach) + CARRY_M') >= 0);
  assert.ok(html.indexOf('Math.max(tHalfWCurb, _visReach) + CARRY_M') >= 0);
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
  assert.ok(html.indexOf('const cx = Math.min(Math.max(p.wx, tCx - tHalfLendPBack), tCx + tHalfLendPFront);') >= 0);
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
const WR = 0.45, CARRY_M = 0.7, CARRY_M_BACK = 0.25, T_CY = -4.5;
const C_STREET = T_CY - (Math.max(1.8, 1.8 * 1.25) + CARRY_M); // -7.45 painted street edge + 0.7
const C_CURB = T_CY + (Math.max(1.8, 1.8 * 1.25) + CARRY_M);   // -1.55
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
check('carrying worker cannot cross the rear face from the CURB (left) side at any lane y', ()=>{
  for (let y0 = T_CY; y0 <= C_CURB + 0.4; y0 += 0.2) {
    let x = FACE_X - 3, y = y0, crossed = null;
    for (let i = 0; i < 500; i++) {
      const b = [x, y];
      x += 0.11;
      const r = pushOut(x, y, b[0], b[1], true, -BOX_L - CARRY_M_BACK);
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
  at(FACE_X - 0.25 - 0.318, -1.55 + 0.318); // corner (-7.01, -1.55) + 0.45 diagonal
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

console.log('\n' + pass + ' dump-standoff checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));