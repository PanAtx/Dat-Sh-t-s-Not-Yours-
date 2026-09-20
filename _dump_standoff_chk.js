// _dump_standoff_chk.js — proves the carried-item dump fix: when the worker is
// CARRYING a bag / heavy bag / can / litter basket, the dump zone must be
// reachable at the CLOSEST he can get to the back of the hooper. Before the fix,
// the carrying push-out pinned him past the open rear face with a margin that
// left the dump zone (nearHopper / nearHopperHeavy / nearHopperLitter) just out
// of reach, so "I need to get closer to the truck!" fired at his closest spot.
//
// Fix under test:
//   1) push-out: front (cab) keeps the +0.35u carry margin, the REAR (open scoop)
//      allows his center up to (1.0u + worker radius) past the rear face;
//   2) dump zones widened (band dx < 4.0, basket 4.0, heavy 3.6) so they always
//      cover the carrying standoff with room to spare.
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

// ---- 1) structural: index.html carries the asymmetric push-out + wider zones ----
check('push-out: front (cab) keeps the +0.35u carry margin', ()=>{
  assert.ok(html.indexOf('const tHalfLendPFront = _holding ? tHalfL + 0.35 : tHalfL;') >= 0);
});
check('push-out: rear (open scoop) lets a carrying worker step right up to it (tHalfL - 1.0)', ()=>{
  assert.ok(html.indexOf('const tHalfLendPBack = _holding ? tHalfL - 1.0 : tHalfL;') >= 0);
});
check('push-out: cx clamp uses back limit on the rear side, front limit on the cab side', ()=>{
  assert.ok(html.indexOf('const cx = Math.min(Math.max(p.wx, tCx - tHalfLendPBack), tCx + tHalfLendPFront);') >= 0);
});
check('push-out: SIDE limits unchanged (painted reach + 0.35 both sides — no side clipping)', ()=>{
  assert.ok(html.indexOf('Math.max(tHalfWStreet, _visReach) + 0.35') >= 0);
  assert.ok(html.indexOf('Math.max(tHalfWCurb, _visReach) + 0.35') >= 0);
});
check('zones widened: nearHopper band dx < 4.0, basket 4.0, heavy 3.6', ()=>{
  assert.ok(html.indexOf('return dx > -1.0 && dx < 4.0 && Math.abs(dy) < 4.5;') >= 0);
  assert.ok(html.indexOf('const LITTER_DUMP_RADIUS = 4.0;') >= 0);
  assert.ok(html.indexOf('const HEAVY_DUMP_RADIUS = 3.6;') >= 0);
});

// ---- 2) the REAL zone functions, driven at the carrying standoff positions -------
const zoneBody = ['nearHopper','nearHopperHeavy','nearHopperLitter'].map(n=>extractFn(html,n)).join('\n');
const LITTER_DUMP_RADIUS = 4.0, HEAVY_DUMP_RADIUS = 3.6;
const zones = new Function('truck','p','LITTER_DUMP_RADIUS','HEAVY_DUMP_RADIUS',
  'var state="play";\n' + zoneBody + '\nreturn { nearHopper, nearHopperHeavy, nearHopperLitter };'
)(truck, p, LITTER_DUMP_RADIUS, HEAVY_DUMP_RADIUS);
function at(wx, wy){ p.wx = wx; p.wy = wy; }
function allNear(){ return zones.nearHopper() && zones.nearHopperHeavy() && zones.nearHopperLitter(); }

check('KEY: 1.0u past the rear face (his dumping spot) -> all three zones say NEAR', ()=>{
  at(FACE_X - 1.0, -4.5);
  assert.strictEqual(zones.nearHopper(), true, 'nearHopper dx=' + (HOP_X - p.wx));
  assert.strictEqual(zones.nearHopperHeavy(), true);
  assert.strictEqual(zones.nearHopperLitter(), true);
});
check('KEY: 0.8u past the face (his OLD pinned spot) -> all three zones say NEAR', ()=>{
  at(FACE_X - 0.8, -4.5);
  assert.strictEqual(allNear(), true);
});
check('truck auto-follow equilibrium (0.1u past the face) -> all zones say NEAR', ()=>{
  at(FACE_X - 0.1, -4.5);
  assert.strictEqual(allNear(), true);
});
check('deepest allowed (1.0 + worker radius 0.45 past the face) -> all zones say NEAR', ()=>{
  at(FACE_X - 1.45, -4.5);
  assert.strictEqual(allNear(), true);
});
check('rear street-side corner standoff -> all zones say NEAR', ()=>{
  at(FACE_X + 1.0 - 0.318, -7.1 - 0.318); // corner (-5.76, -7.1) + 0.45 diagonal
  assert.strictEqual(allNear(), true);
});
check('rear curb-side corner standoff -> all zones say NEAR', ()=>{
  at(FACE_X + 1.0 - 0.318, -1.9 + 0.318); // corner (-5.76, -1.9) + 0.45 diagonal
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
  reset(); at(FACE_X - 1.0, -4.5);
  const b = makeBag('normal');
  api.setCarry('bag', b);
  api.tryInteract();
  assert.strictEqual(b.state, 'dumped');
  assert.strictEqual(flyingBags.length, 1);
  assert.strictEqual(api.getCarry(), 'none');
  assert.deepStrictEqual(calls.voices, []);
});
check('END-TO-END: HEAVY bag at the deepest allowed spot -> dumped, silent', ()=>{
  reset(); at(FACE_X - 1.45, -4.5);
  const b = makeBag('heavy');
  api.setCarry('bag', b);
  api.tryInteract();
  assert.strictEqual(b.state, 'dumped');
  assert.strictEqual(flyingBags.length, 1);
  assert.deepStrictEqual(calls.voices, []);
});
check('END-TO-END: full can at the old pinned spot (0.8u past the face) -> dumped, silent', ()=>{
  reset(); at(FACE_X - 0.8, -4.5);
  const c = { kind:'can', state:'curb', h:{ wx:0, wy:0 }, home:{ wx:0, wy:0 }, g:{ parent:null } };
  api.setCarry('canFull', c);
  api.tryInteract();
  assert.strictEqual(c.state, 'dumped');
  assert.strictEqual(flyingCans.length, 1);
  assert.deepStrictEqual(calls.voices, []);
});
check('END-TO-END: litter basket at the rear curb-side corner -> dumped, silent', ()=>{
  reset(); at(FACE_X + 1.0 - 0.318, -1.9 + 0.318);
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

console.log('\n' + pass + ' dump-standoff checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));