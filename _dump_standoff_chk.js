// _dump_standoff_chk.js — proves the "stand as close while carrying" change:
// the worker's push-out box is now IDENTICAL for carrying and empty-handed
// (raw collision box + 0.25u breathing room, SHARP corners), so he can tuck
// right up to the hopper while holding a bag / can / basket. The held item is
// allowed to visually clip into the PAINTED truck body: updatePlayer hides it
// the instant it goes inside the paint (it "disappears into the truck") and
// brings it back the moment it clears, so nothing ever pokes through. The
// dump zones must stay reachable at his new closest approach.
//
// Fix under test:
//   1) push-out: ONE box for both states — 0.25u margin on every side, no
//      CARRY_M / CARRY_M_CURB / CARRY_M_BACK / CARRY_CHAMFER, sharp corners;
//   2) item clip: the held item is hidden while its center is inside the
//      painted body (+ its own size), and visibility is reset on pickup and
//      on drop so a hidden item can never stay hidden;
//   3) the truck's own motion must never shove a STANDING worker: the push-out
//      is skipped only while he doesn't move — the instant he walks again he's
//      pushed OUT of the body (a truck that swept over him can't let him walk
//      through the hopper from either side);
//   4) dump zones: heavy cargo (heavy bag + full can) uses the tight 3.6u
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

// ---- 1) structural: index.html carries the one-box push-out + item clip + zones
check('push-out: ONE box for carrying AND empty-handed (0.25u margin, sharp corners)', ()=>{
  assert.ok(html.indexOf('const tHalfWStreetP = tHalfWStreet + 0.25;') >= 0);
  assert.ok(html.indexOf('const tHalfWCurbP = tHalfWCurb + 0.25;') >= 0);
  assert.ok(html.indexOf('const tHalfLendPFront = tHalfL;') >= 0);
  assert.ok(html.indexOf('const tHalfLendPBack = tHalfL;') >= 0);
});
check('push-out: the old carrying standoffs are GONE (no CARRY_M / CARRY_M_CURB / CARRY_M_BACK / CARRY_CHAMFER)', ()=>{
  assert.ok(html.indexOf('CARRY_M = 0.7') < 0);
  assert.ok(html.indexOf('CARRY_M_CURB') < 0);
  assert.ok(html.indexOf('CARRY_M_BACK') < 0);
  assert.ok(html.indexOf('CARRY_CHAMFER') < 0);
  assert.ok(html.indexOf('_holding ?') < 0, 'no carry-conditional box left');
});
check('item clip: the held item is hidden while its center is inside the painted truck body', ()=>{
  assert.ok(html.indexOf('carried.g.getWorldPosition(_truckClipV);') >= 0);
  assert.ok(html.indexOf('truck.g.worldToLocal(_truckClipV);') >= 0);
  assert.ok(html.indexOf('carried.g.visible = !(') >= 0);
  assert.ok(html.indexOf('* 1.25 + 0.4') >= 0, 'clip volume = painted reach (x1.25) + item size');
});
check('item clip: visibility is reset on PICK-UP and on DROP (a hidden item must not stay hidden)', ()=>{
  const attach = html.indexOf('function attachCarried(');
  assert.ok(attach >= 0 && html.indexOf('item.g.visible = true;', attach) > attach);
  const drop = html.indexOf('function dropCarried(');
  assert.ok(drop > attach && html.indexOf('item.g.visible = true;', drop) > drop);
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

// ---- 1b) behavioral: the REAL push-out math, replicated from updatePlayer ----
// The push-out box is now the SAME for carrying and empty-handed: raw box +
// 0.25u margin, sharp corners, 0.45u worker radius band. These drive the exact
// formula to prove: (a) a standing worker is never dragged by the truck's
// back-up, (b) a walking worker is always pushed OUT of the body — he can
// never cross the rear face from either side, (c) a carrying worker stands
// exactly as close as an empty-handed one.
const WR = 0.45, T_CY = -4.5;
const C_STREET = T_CY - (1.8 + 0.25); // -6.55 street edge + 0.25 margin
const C_CURB = T_CY + (1.8 + 0.25); // -2.55 curb edge + 0.25 margin
const X_FRONT = BOX_L; // +6.76
const X_BACK = -BOX_L - 0.25; // rear face (the 0.25u margin baked into the box)
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
check('push-out: a CARRYING worker can tuck right up to the rear face (same 0.25 + 0.45 band as empty-handed)', ()=>{
  // 0.7u past the raw face = 0.25 margin + 0.45 radius: exactly on the band -> stays put
  const [px, py] = pushOut(FACE_X - 0.7, T_CY, FACE_X - 0.7, T_CY, true, X_BACK);
  assert.ok(Math.hypot(px - (FACE_X - 0.7), py - T_CY) < 1e-6, '0.7u past the face must be legal');
  // 0.6u past: inside the band -> pushed back exactly to 0.7u
  const [qx, qy] = pushOut(FACE_X - 0.6, T_CY, FACE_X - 0.6, T_CY, true, X_BACK);
  assert.ok(Math.abs(qx - (FACE_X - 0.7)) < 1e-6 && Math.abs(qy - T_CY) < 1e-6, '0.6u past must be pushed back to 0.7u');
});
check('push-out: sharp rear CURB corner — the diagonal is legal right to the band', ()=>{
  // on the 45-degree diagonal into the corner: legal once past the 0.45 band
  const wx = X_BACK - 0.5 * Math.SQRT1_2, wy = C_CURB + 0.5 * Math.SQRT1_2;
  const [px, py] = pushOut(wx, wy, wx, wy, true, X_BACK);
  assert.ok(Math.hypot(px - wx, py - wy) < 1e-6, 'diagonal r=0.5 must be legal');
  // ...and 0.25u along it is inside the band -> pushed out
  const wx2 = X_BACK - 0.25 * Math.SQRT1_2, wy2 = C_CURB + 0.25 * Math.SQRT1_2;
  const [px2, py2] = pushOut(wx2, wy2, wx2, wy2, true, X_BACK);
  assert.ok(Math.hypot(px2 - wx2, py2 - wy2) > 0.05, 'diagonal r=0.25 must be pushed out');
});
check('push-out cannot be exploited: crossing the face line near the corner happens only OUTSIDE the curb edge', ()=>{
  let x = FACE_X - 3, y = C_CURB + 1.2;
  let crossed = null;
  for (let i = 0; i < 500; i++) {
    const b = [x, y];
    x += 0.11;
    const r = pushOut(x, y, b[0], b[1], true, X_BACK);
    x = r[0]; y = r[1];
    if (x > FACE_X + 1.2 && crossed === null) crossed = y;
    if (x > FACE_X + 3) break;
  }
  if (crossed !== null) assert.ok(crossed >= C_CURB, 'crossed the face inside the body at y=' + crossed.toFixed(2));
});
check('TRUCK BACKING UP over a standing worker never drags him', ()=>{
  let wx = FACE_X - 0.85, wy = -4.5; // standing behind the box rear (0.7u past the raw face)
  let dragged = false;
  for (let i = 1; i <= 12; i++) {
    const boxX0 = X_BACK - 0.1 * i; // truck backs up 0.1u/frame
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
      const r = pushOut(x, y, b[0], b[1], true, X_BACK);
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
      const r = pushOut(x, y, b[0], b[1], true, X_BACK);
      x = r[0]; y = r[1];
      if (x > FACE_X + 1.2 && crossed === null) crossed = y;
      if (x > FACE_X + 3) break;
    }
    if (crossed !== null) assert.ok(crossed >= C_CURB, 'crossed the face inside the curb-side body at y=' + crossed.toFixed(2));
  }
});

// ---- 2) the REAL zone functions, driven at the closest-approach positions -------
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
check('KEY: deepest approach (0.25 margin + worker radius 0.45 = 0.7u past the face) -> all zones say NEAR', ()=>{
  at(FACE_X - 0.7, -4.5);
  assert.strictEqual(allNear(), true);
});
check('rear street-side corner approach -> all zones say NEAR', ()=>{
  at(X_BACK - 0.318, C_STREET - 0.318); // box corner (X_BACK, C_STREET) + 0.45 diagonal
  assert.strictEqual(allNear(), true);
});
check('rear curb-side corner approach -> all zones say NEAR', ()=>{
  at(X_BACK - 0.318, C_CURB + 0.318); // box corner (X_BACK, C_CURB) + 0.45 diagonal
  assert.strictEqual(allNear(), true);
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

// ---- 4) TEST MODE B: the magenta debug box (push-out + item clip) -------
check('debug box: B toggles the MAGENTA push-out + clip outline that follows the truck', ()=>{
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
check('debug box: mirrors the push-out + clip constants (0.25 margin / 0.45 radius / 0.4 clip / x1.25 paint)', ()=>{
  assert.ok(html.indexOf('const C_M = 0.25,') >= 0);
  assert.ok(html.indexOf('CLIP_E = 0.4;') >= 0);
  assert.ok(html.indexOf('* 1.25 + CLIP_E') >= 0);
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
check('debug box outline: the worker box is a SHARP rectangle (carrying == empty-handed, no corner cuts)', ()=>{
  const make = makeDebugOutline();
  const bL = BOX_L, eS = 1.8 + 0.25, eC = 0.63 + 0.25; // real truck half-widths + 0.25 margin
  const pts = outlinePts(make(bL, bL, eS, eC, 0));
  assert.ok(pts.length >= 4 && pts.every(q => isFinite(q[0]) && isFinite(q[1])));
  for (const q of pts) {
    const onEdge =
      (Math.abs(q[0] - bL) < 1e-5 && q[1] >= -eS - 1e-5 && q[1] <= eC + 1e-5) ||
      (Math.abs(q[0] + bL) < 1e-5 && q[1] >= -eS - 1e-5 && q[1] <= eC + 1e-5) ||
      (Math.abs(q[1] - eC) < 1e-5 && q[0] <= bL + 1e-5 && q[0] >= -bL - 1e-5) ||
      (Math.abs(q[1] + eS) < 1e-5 && q[0] <= bL + 1e-5 && q[0] >= -bL - 1e-5);
    assert.ok(onEdge, 'off-shape point ' + q);
  }
  assert.ok(pts.some(q => Math.abs(q[0] + bL) < 1e-5 && Math.abs(q[1] - eC) < 1e-5), 'missing rear CURB corner vertex (must be sharp)');
  assert.ok(pts.some(q => Math.abs(q[0] + bL) < 1e-5 && Math.abs(q[1] + eS) < 1e-5), 'missing rear STREET corner vertex (must be sharp)');
});
check('debug box outline: OUTER line = inner + the 0.45u worker radius (where his CENTER stops)', ()=>{
  const make = makeDebugOutline();
  const bL = BOX_L, eS = 1.8 + 0.25, eC = 0.63 + 0.25;
  const inr = outlinePts(make(bL, bL, eS, eC, 0));
  const out = outlinePts(make(bL + 0.45, bL + 0.45, eS + 0.45, eC + 0.45, 0));
  const ext = (a, f) => f(...a.map(q => q[0])), extY = (a, f) => f(...a.map(q => q[1]));
  assert.ok(Math.abs(ext(out, Math.max) - (ext(inr, Math.max) + 0.45)) < 1e-5);
  assert.ok(Math.abs(ext(out, Math.min) - (ext(inr, Math.min) - 0.45)) < 1e-5);
  assert.ok(Math.abs(extY(out, Math.max) - (extY(inr, Math.max) + 0.45)) < 1e-5);
  assert.ok(Math.abs(extY(out, Math.min) - (extY(inr, Math.min) - 0.45)) < 1e-5);
});
check('debug box outline: CLIP volume = painted body + item size (where the held item vanishes)', ()=>{
  const make = makeDebugOutline();
  const bL = BOX_L;
  const pts = outlinePts(make(bL + 0.4, bL + 0.4, 1.8 * 1.25 + 0.4, 0.63 * 1.25 + 0.4, 0));
  const ext = (a, f) => f(...a.map(q => q[0])), extY = (a, f) => f(...a.map(q => q[1]));
  assert.ok(Math.abs(ext(pts, Math.max) - (bL + 0.4)) < 1e-5);
  assert.ok(Math.abs(ext(pts, Math.min) + (bL + 0.4)) < 1e-5);
  assert.ok(Math.abs(extY(pts, Math.max) - (0.63 * 1.25 + 0.4)) < 1e-5);
  assert.ok(Math.abs(extY(pts, Math.min) + (1.8 * 1.25 + 0.4)) < 1e-5);
});
check('debug box: the CLIP outline is drawn (a third magenta loop in the block)', ()=>{
  const blk = html.indexOf('TEST MODE: B = MAGENTA TRUCK DEBUG BOX');
  assert.ok(blk >= 0);
  assert.ok(html.indexOf('truckDebugOutline(bL + CLIP_E, bL + CLIP_E, bS * 1.25 + CLIP_E, bC * 1.25 + CLIP_E, 0)', blk) > blk);
});

console.log('\n' + pass + ' dump-standoff checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));