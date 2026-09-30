// _multicarry_chk.js — test the REAL multi-carry logic extracted verbatim from
// index.html (pickUp / tossBag / dropCarried / tryInteract + hopper zones)
// with lightweight mocks. Rules under test:
//   * up to MAX_SMALL_BAGS (3) SMALL bags can be carried at once
//   * heavy bags / cans / litter baskets take BOTH hands (no stacking, nothing
//     else can be picked up while one is held)
//   * tossing the active bag promotes the next slung bag into the hand
//   * a knock drops the WHOLE stack
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

// ---- lightweight mocks -------------------------------------------------------------
function makeG(){
  const pos = { x:0, y:0, z:0, set(x,y,z){ this.x=x; this.y=y; this.z=z; } };
  const rot = { x:0, y:0, z:0, set(x,y,z){ this.x=x; this.y=y; this.z=z; } };
  return { parent:null, visible:true, children:[], position:pos, rotation:rot, scale:{ set(){}, setScalar(){} }, add(c){ this.children.push(c); if(c) c.parent=this; }, remove(){} };
}
const calls = { voices: [] };
const flyingBags = [];
const SFX = { playPickupSound(){}, playTossSound(){}, playCanDropSound(){}, playDropSound(){} };
const Voice = { say(t){ calls.voices.push(t); } };
const scoreCalls = [];
const bubbleCalls = [];
function addScore(n, isBonus){ scoreCalls.push({ n, isBonus }); }
function spawnBubble(t, x, y, sp){ bubbleCalls.push({ t, sp }); }
const pick = (a)=>a[0]; // deterministic: always the first line
const R = (a,b)=>a + Math.random()*(b-a);
const clamp = (v,a,b)=>v<a?a:(v>b?b:v);
const p = { wx: 5, wy: -4.5, stunT: 0 };
const worker = { group: { add(g){ g.parent = worker.group; }, remove(){} } };
const dynamicGroup = { add(g){ g.parent = dynamicGroup; }, remove(g){ g.parent = null; } };
function workerMaxY(){ return 8; }
const dist = (x,y)=>Math.hypot(x-p.wx, y-p.wy);
const truck = { wx: 10, hopperOff: -4.3, hopperY: 0, hidden: 0 };
const state = 'play', blocks = [], creatures = [], litterBaskets = [];
const WORKER_GENDER = 'male';
function speakBagType(){}
function speakBoneBasket(){}
function tryPunchBack(){ return false; }
function dumpCan(){ carry = 'none'; carried = null; }

function bag(type, state){ return { kind:'bag', type, state: state||'curb', g: makeG() }; }
function can(state){ return { kind:'can', state: state||'curb', g: makeG(), home: { wx: 0, wy: 0 } }; }

// ---- build the real logic closure --------------------------------------------------
const fns = ['pickUp','tossBag','dropCarried','tryInteract','nearHopper','nearHopperHeavy','nearHopperLitter','attachCarried','attachStacked'].map(n=>extractFn(html,n)).join('\n');
const api = new Function(
  'truck','p','dynamicGroup','worker','flyingBags','SFX','Voice','R','clamp','GZ','state','blocks','creatures','litterBaskets','dist','WORKER_GENDER','workerMaxY','speakBagType','speakBoneBasket','tryPunchBack','dumpCan','pick','addScore','spawnBubble',
  'var carry="none", carried=null; const MAX_SMALL_BAGS=3; var bagStack=[]; const HEAVY_DUMP_RADIUS = 3.6; var haulCount = 0; const HAUL_LINES = ["Three in one run! I\'m a machine!","Full stack, all in the hopper! Watch that!","I could haul all day, I\'m telling you!"];\n' + fns + '\n' +
  'return { pickUp, tossBag, dropCarried, tryInteract, nearHopper, ' +
  'carry:()=>carry, carried:()=>carried, stack:()=>bagStack.length, haul:()=>haulCount, resetHands:function(){ carry="none"; carried=null; bagStack.length=0; haulCount=0; } };'
)(truck, p, dynamicGroup, worker, flyingBags, SFX, Voice, R, clamp, 0.01, 'play', blocks, creatures, litterBaskets, dist, 'male', workerMaxY, speakBagType, speakBoneBasket, tryPunchBack, dumpCan, pick, addScore, spawnBubble);

function reset(){ calls.voices.length=0; scoreCalls.length=0; bubbleCalls.length=0; flyingBags.length=0; api.resetHands(); p.wx=5; p.wy=-4.5; truck.wx=10; blocks.length=0; }
function at(wx, wy){ p.wx = wx; p.wy = wy; }
// ---- 1) stacking small bags --------------------------------------------------------
check('two small bags back-to-back -> both carried (active + 1 slung)', ()=>{
  reset();
  const a = bag('normal'), b = bag('glass');
  assert.strictEqual(api.pickUp(a), true);
  assert.strictEqual(api.pickUp(b), true);
  assert.strictEqual(api.carry(), 'bag');
  assert.strictEqual(api.carried(), a, 'first bag stays the active one');
  assert.strictEqual(api.stack(), 1);
  assert.strictEqual(b.state, 'carried');
  assert.strictEqual(b.g.parent, worker.group, 'slung bag rides on the worker');
});
check('three small bags -> max stack (active + 2 slung)', ()=>{
  reset();
  [bag('normal'), bag('needle'), bag('piss')].forEach(b=>assert.strictEqual(api.pickUp(b), true));
  assert.strictEqual(api.stack(), 2);
});
check('FOURTH small bag -> refused with the three-bags line, stays on the curb', ()=>{
  reset();
  [bag('normal'), bag('glass'), bag('piss')].forEach(b=>api.pickUp(b));
  calls.voices.length=0;
  const fourth = bag('normal');
  assert.strictEqual(api.pickUp(fourth), false);
  assert.strictEqual(fourth.state, 'curb', 'refused bag is not taken');
  assert.deepStrictEqual(calls.voices, ["I've got three bags on me already!"]);
});

// ---- 2) heavy bags / cans / baskets take BOTH hands --------------------------------
check('heavy bag while holding small bags -> "Both hands are full!"', ()=>{
  reset();
  api.pickUp(bag('normal'));
  calls.voices.length=0;
  const h = bag('heavy');
  assert.strictEqual(api.pickUp(h), false);
  assert.strictEqual(h.state, 'curb');
  assert.deepStrictEqual(calls.voices, ['Both hands are full!']);
});
check('full can while holding small bags -> refused', ()=>{
  reset();
  api.pickUp(bag('normal'));
  calls.voices.length=0;
  const c = can('curb');
  assert.strictEqual(api.pickUp(c), false);
  assert.strictEqual(c.state, 'curb');
  assert.deepStrictEqual(calls.voices, ['Both hands are full!']);
});
check('small bag while holding a HEAVY bag -> refused (heavy takes both hands)', ()=>{
  reset();
  api.pickUp(bag('heavy'));
  calls.voices.length=0;
  const s = bag('normal');
  assert.strictEqual(api.pickUp(s), false);
  assert.strictEqual(s.state, 'curb');
  assert.deepStrictEqual(calls.voices, ['Both hands are full!']);
});
check('small bag while holding a full can -> refused', ()=>{
  reset();
  api.pickUp(can('curb'));
  calls.voices.length=0;
  const s = bag('normal');
  assert.strictEqual(api.pickUp(s), false);
  assert.deepStrictEqual(calls.voices, ['Both hands are full!']);
});
check('free hands -> a heavy bag is picked up normally (regression)', ()=>{
  reset();
  const h = bag('heavy');
  assert.strictEqual(api.pickUp(h), true);
  assert.strictEqual(api.carry(), 'bag');
  assert.strictEqual(api.carried(), h);
});
// ---- 3) tossing promotes the next slung bag ----------------------------------------
check('toss the active bag with a stack -> next slung bag moves into the hand', ()=>{
  reset();
  at(5, -4.5); // at the hopper
  const a = bag('normal'), b = bag('glass'), c = bag('piss');
  api.pickUp(a); api.pickUp(b); api.pickUp(c);
  assert.strictEqual(api.stack(), 2);
  api.tossBag(a);
  assert.strictEqual(a.state, 'dumped');
  assert.strictEqual(flyingBags.length, 1);
  assert.strictEqual(api.carry(), 'bag');
  assert.strictEqual(api.carried(), b, 'second bag is now the active one');
  assert.strictEqual(api.stack(), 1);
  api.tossBag(b);
  assert.strictEqual(api.carried(), c, 'third bag is now the active one');
  api.tossBag(c);
  assert.strictEqual(api.carry(), 'none', 'hands empty after the last bag');
  assert.strictEqual(api.stack(), 0);
});
check('toss with an EMPTY stack -> plain single-bag behavior (regression)', ()=>{
  reset();
  at(5, -4.5);
  const a = bag('normal');
  api.pickUp(a);
  api.tossBag(a);
  assert.strictEqual(a.state, 'dumped');
  assert.strictEqual(api.carry(), 'none');
  assert.strictEqual(api.carried(), null);
});

// ---- 4) a knock drops the WHOLE stack ----------------------------------------------
check('dropCarried with 3 bags -> all three hit the curb, hands empty', ()=>{
  reset();
  const a = bag('normal'), b = bag('glass'), c = bag('piss');
  api.pickUp(a); api.pickUp(b); api.pickUp(c);
  api.dropCarried();
  assert.strictEqual(api.carry(), 'none');
  assert.strictEqual(api.stack(), 0);
  [a, b, c].forEach(b=>{
    assert.strictEqual(b.state, 'curb', 'every bag is back on the curb');
    assert.strictEqual(b.g.parent, dynamicGroup, 'every bag is in the world, not the worker');
  });
});
check('dropCarried with free hands -> no-op (regression)', ()=>{
  reset();
  api.dropCarried(); // must not throw
  assert.strictEqual(api.carry(), 'none');
});
// ---- 5) interact key: stack up away from the hopper --------------------------------
check('carrying a small bag, far, another small bag in reach -> picks it up (stack)', ()=>{
  reset();
  at(0, -11.5);
  const near = bag('glass');
  near.wx = 0.5; near.wy = -11.2;
  blocks.push({ house: { bags: [near], can: null } });
  api.pickUp(bag('normal')); // active bag in hand
  calls.voices.length=0;
  api.tryInteract();
  assert.strictEqual(near.state, 'carried', 'second bag got stacked');
  assert.strictEqual(api.stack(), 1);
  assert.strictEqual(api.carry(), 'bag');
});
check('carrying a small bag, far, a HEAVY bag is the nearest -> refused line, no stack', ()=>{
  reset();
  at(0, -11.5);
  const heavy = bag('heavy');
  heavy.wx = 0.5; heavy.wy = -11.2;
  blocks.push({ house: { bags: [heavy], can: null } });
  api.pickUp(bag('normal'));
  calls.voices.length=0;
  api.tryInteract();
  assert.strictEqual(heavy.state, 'curb', 'heavy bag not taken');
  assert.deepStrictEqual(calls.voices, ['Both hands are full!']);
});
check('carrying a small bag, far, NOTHING in reach -> "closer" line (regression)', ()=>{
  reset();
  at(0, -11.5);
  api.pickUp(bag('normal'));
  calls.voices.length=0;
  api.tryInteract();
  assert.deepStrictEqual(calls.voices, ['I need to get closer to the truck!']);
});
check('full stack (3), far, another small bag in reach -> "closer" line, no pickup', ()=>{
  reset();
  at(0, -11.5);
  const near = bag('glass');
  near.wx = 0.5; near.wy = -11.2;
  blocks.push({ house: { bags: [near], can: null } });
  [bag('normal'), bag('piss'), bag('needle')].forEach(b=>api.pickUp(b));
  calls.voices.length=0;
  api.tryInteract();
  assert.strictEqual(near.state, 'curb', 'full stack does not pick up a fourth');
  assert.deepStrictEqual(calls.voices, ['I need to get closer to the truck!']);
});
check('carrying a stack, AT the hopper -> dumps the active bag, promotes the next', ()=>{
  reset();
  at(5, -4.5);
  const near = bag('glass');
  near.wx = 5.5; near.wy = -4.2;
  blocks.push({ house: { bags: [near], can: null } });
  const a = bag('normal');
  api.pickUp(a); api.pickUp(near);
  calls.voices.length=0;
  api.tryInteract();
  assert.strictEqual(a.state, 'dumped', 'the active bag is dumped at the hopper');
  assert.strictEqual(flyingBags.length, 1);
  assert.strictEqual(api.carried(), near, 'the slung bag is promoted into the hand');
});
check('HEAVY bag, far -> "too heavy" line (regression)', ()=>{
  reset();
  at(0, -11.5);
  api.pickUp(bag('heavy'));
  calls.voices.length=0;
  api.tryInteract();
  assert.deepStrictEqual(calls.voices, ['I need to be closer to the truck. This bag is too heavy!']);
});
// ---- 6) HAUL REWARD: full-stack dump bonus ----------------------------------------
const HAUL_LINES_REF = [
  "Three in one run! I'm a machine!",
  "Full stack, all in the hopper! Watch that!",
  "I could haul all day, I'm telling you!",
];
check('full stack (3) hauled to the hopper -> +40 bonus + bubble + brag on the LAST dump only', ()=>{
  reset();
  const a = bag('normal'), b = bag('glass'), c = bag('piss');
  api.pickUp(a); api.pickUp(b); api.pickUp(c);
  api.tossBag(a);
  assert.strictEqual(scoreCalls.length, 0, 'no bonus while the stack still has bags');
  api.tossBag(b);
  assert.strictEqual(scoreCalls.length, 0, 'no bonus on the second dump either');
  api.tossBag(c); // the last bag of the run
  assert.strictEqual(scoreCalls.length, 1, 'bonus fires exactly once');
  assert.strictEqual(scoreCalls[0].n, 40);
  assert.strictEqual(scoreCalls[0].isBonus, true);
  assert.strictEqual(bubbleCalls.length, 1);
  assert.ok(bubbleCalls[0].t.indexOf('HAUL') >= 0, 'score bubble says HAUL');
  assert.strictEqual(bubbleCalls[0].sp, 'score');
  assert.strictEqual(calls.voices.length, 1, 'one brag line');
  assert.strictEqual(calls.voices[0], HAUL_LINES_REF[0]);
  assert.strictEqual(api.haul(), 0, 'counter resets for the next run');
});
check('dumping ONE bag at a time NEVER fires the bonus (regression gate)', ()=>{
  for (let i = 0; i < 5; i++) {
    reset();
    api.pickUp(bag('normal'));
    api.tossBag(api.carried());
    assert.strictEqual(scoreCalls.length, 0, 'run ' + (i+1) + ': single-bag dump pays no bonus');
  }
});
check('a 2-bag run (active + 1 slung) -> no bonus, counter back to 0', ()=>{
  reset();
  const a = bag('normal'), b = bag('glass');
  api.pickUp(a); api.pickUp(b);
  api.tossBag(a);
  api.tossBag(b);
  assert.strictEqual(scoreCalls.length, 0);
  assert.strictEqual(api.haul(), 0);
});
check('a DROP mid-run aborts the haul (no bonus later)', ()=>{
  reset();
  const a = bag('normal'), b = bag('glass'), c = bag('piss');
  api.pickUp(a); api.pickUp(b); api.pickUp(c);
  api.tossBag(a);
  api.tossBag(b);
  assert.strictEqual(api.haul(), 2, 'two hauled before the knock');
  api.dropCarried(); // knocked — the last bag hits the curb
  assert.strictEqual(api.haul(), 0, 'the aborted run resets the counter');
  assert.strictEqual(scoreCalls.length, 0);
});
// ---- 7) SLUNG-BAG WOBBLE + haul wiring (static checks on the real source) --------
check('attachStacked records baseSlot + sway for the wobble to orbit', ()=>{
  const s = extractFn(html, 'attachStacked');
  assert(s.indexOf('item.baseSlot') >= 0, 'baseSlot recorded');
  assert(s.indexOf('item.sway') >= 0, 'sway initialized');
});
check('updatePlayer runs the spring-lagged wobble for every slung bag', ()=>{
  const up = html.indexOf('function updatePlayer(');
  assert(up >= 0);
  const m = html.indexOf('SLUNG-BAG WOBBLE', up);
  assert(m > up, 'wobble block lives inside updatePlayer');
  const seg = html.slice(m, m + 1800);
  assert(seg.indexOf('bagStack') >= 0, 'iterates the slung stack');
  assert(seg.indexOf('baseSlot') >= 0, 'offsets around the resting slot');
  assert(seg.indexOf('sway') >= 0, 'spring-lagged offsets');
  assert(seg.indexOf('Math.sin(p.phase') >= 0, 'step-synced to the walk phase');
  assert(seg.indexOf('amp') >= 0, 'scaled by walk intensity (settles at 0)');
});
check('haulCount is declared, reset by the shift reset, and reset by a drop', ()=>{
  assert(html.indexOf('let haulCount = 0;') >= 0, 'declared next to bagStack');
  const rw = html.slice(html.indexOf('function resetWorldState('), html.indexOf('function resetWorldState(') + 2500);
  assert(rw.indexOf('haulCount = 0') >= 0, 'reset by resetWorldState');
  assert(extractFn(html, 'dropCarried').indexOf('haulCount = 0') >= 0, 'reset by dropCarried');
});
check('HAUL_LINES is defined with 3 brag lines', ()=>{
  const i = html.indexOf('const HAUL_LINES');
  assert(i >= 0, 'defined');
  const seg = html.slice(i, i + 500);
  assert((seg.match(/"/g) || []).length >= 6, 'at least three quoted lines');
});
console.log('\n' + pass + ' multi-carry checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));