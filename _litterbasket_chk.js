// _litterbasket_chk.js — test the REAL litter-basket pickup / carry / dump /
// return logic extracted verbatim from index.html, driven with lightweight mocks.
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

// ---- lightweight THREE-style mocks -------------------------------------------------
function makeG(){ return {
  parent: null, visible: true, children: [],
  position: { x:0, y:0, z:0, set:function(x,y,z){ this.x=x; this.y=y; this.z=z; } },
  rotation: { x:0, y:0, z:0, set:function(x,y,z){ this.x=x; this.y=y; this.z=z; } },
  add(c){ this.children.push(c); if(c) c.parent=this; }, remove(){}
}; }
const THREE = { Group: function(){ return makeG(); } };
// ---- primitive-hierarchy mocks used by buildLitterTrash ---------------------------
// _h = the piece's horizontal half-extent, so a test can prove nothing pokes out.
const POS = () => ({ x:0, y:0, z:0, set:function(x,y,z){ this.x=x; this.y=y; this.z=z; } });
function meshMock(h){ return { parent:null, visible:true, _h:(h||0), position:POS(), rotation:POS(), scale:Object.assign(POS(),{ setScalar:function(s){ this.x=this.y=this.z=s; } }), add(){}, remove(){} }; }
const M = (c,o)=>({ c:c });
const MS = (c,o)=>({ c:c });
const BX = (w,h,d,m)=>meshMock(w/2);
const CY = (r1,r2,h,m,s)=>meshMock(Math.max(r1||0,r2||0));
const SP = (r,m,s)=>meshMock(r||0);
function makeContainer(){ return { add(g){ if(g) g.parent=this; }, remove(g){ if(g) g.parent=null; } }; }
const worker = { group: makeContainer() };
const groundGroup = makeContainer();
const dynamicGroup = makeContainer();
const LITTERBASKET_TPL = { template: { clone:(d)=>({ scale:{ setScalar(){} }, position:{ set(){} } }) } };
const LITTERBASKET_SCALE = 0.93 / 168;

// ---- game constants / helpers (real values where it matters) -----------------------
const CROSS_W = 9, IW = 16, LEVEL_XS = [0,16,32,48,64,80,96,112];
const R = (a,b)=>a + Math.random()*(b-a);
const clamp = (v,a,b)=>v<a?a:(v>b?b:v);
const GZ = 0.01;
const LITTER_DUMP_RADIUS = 3.5;
const truck = { wx: 10, hopperOff: -4.3, hopperY: 0, hidden: 0 };
const p = { wx: 5, wy: -4.5, stunT: 0 };
const state = 'play', blocks = [], creatures = [], WORKER_GENDER = 'male';
const dist = (x,y)=>Math.hypot(x-p.wx, y-p.wy);

// ---- counters / stubs --------------------------------------------------------------
const calls = { score:0, deposit:0, dispose:0, voices:[] };
const SFX = { playPickupSound(){}, playCanDropSound(){}, playTossSound(){}, playDropSound(){} };
const Voice = { say(t){ calls.voices.push(t); } };
function addScore(){ calls.score++; }
function hopperDeposit(){ calls.deposit++; }
function disposeObj(){ calls.dispose++; }
function resetCalls(){ calls.score=0; calls.deposit=0; calls.dispose=0; calls.voices.length=0; }

// ---- build the real logic closure --------------------------------------------------
const fns = ['nearHopper','nearHopperLitter','attachCarried','pickUp','dumpLitterBasket','updateFlyingBaskets',
  'resetLitterBaskets','placeLitterBasket','dropCarried','tryInteract','buildLitterTrash'].map(n=>extractFn(html,n)).join('\n');
const api = new Function(
  'THREE','worker','groundGroup','dynamicGroup','LITTERBASKET_TPL','LITTERBASKET_SCALE',
  'CROSS_W','IW','LEVEL_XS','R','clamp','GZ','LITTER_DUMP_RADIUS','truck','p','state','blocks','creatures','WORKER_GENDER',
  'dist','SFX','Voice','addScore','hopperDeposit','disposeObj','M','MS','BX','CY','SP',
  'var carry="none", carried=null; var litterBaskets=[]; var litterBasketHomes=null; var litterBasketPlaced=false; var flyingBaskets=[];\n' +
  'function tossBag(){} function dumpCan(){}\n' +
  fns + '\n' +
  'return { nearHopper, pickUp, attachCarried, dumpLitterBasket, updateFlyingBaskets, resetLitterBaskets, placeLitterBasket, dropCarried, tryInteract, buildLitterTrash, ' +
  'carry:()=>carry, carried:()=>carried, baskets:()=>litterBaskets, homes:()=>litterBasketHomes, flying:()=>flyingBaskets, ' +
  'setCarried:function(c,i){ carry=c; carried=i; } };'
)(THREE, worker, groundGroup, dynamicGroup, LITTERBASKET_TPL, LITTERBASKET_SCALE,
  CROSS_W, IW, LEVEL_XS, R, clamp, GZ, LITTER_DUMP_RADIUS, truck, p, state, blocks, creatures, WORKER_GENDER,
  dist, SFX, Voice, addScore, hopperDeposit, disposeObj, M, MS, BX, CY, SP);
// ---- 1) placement ------------------------------------------------------------------
check('placeLitterBasket -> 14 baskets at corners, all "placed" on groundGroup, FULL of visible trash', ()=>{
  api.placeLitterBasket();
  assert.strictEqual(api.baskets().length, 14);
  assert.strictEqual(api.homes().length, 14);
  for (const b of api.baskets()){
    assert.strictEqual(b.state, 'placed');
    assert.strictEqual(b.g.parent, groundGroup);
    assert.strictEqual(b.hx, b.wx); assert.strictEqual(b.hy, b.wy);
    assert.ok(b.trash && b.trash.visible === true, 'each basket is filled with visible trash');
  }
});

// ---- 1b) geometry: no piece may poke out the sides of the basket -----------------
check('trash geometry -> every piece stays INSIDE the walls, only overflows the TOP', ()=>{
  const LIMIT = 0.32;            // basket outer half-width ~0.33; keep a hair of margin
  const seen = [];
  (function walk(n){ for (const c of (n.children||[])){ if (c._h!==undefined) seen.push(c); walk(c); } })(api.buildLitterTrash());
  assert.ok(seen.length >= 8, 'the pile should have several pieces, got ' + seen.length);
  let anyLow = false, anyHigh = false;
  for (const m of seen){
    const sx = (m.scale.x || 1), sy = (m.scale.y || 1);
    const rx = Math.abs(m.position.x) + (m._h||0) * sx;
    const ry = Math.abs(m.position.y) + (m._h||0) * sy;
    assert.ok(rx <= LIMIT, 'piece pokes out the +X side: reach ' + rx.toFixed(3) + ' > ' + LIMIT);
    assert.ok(ry <= LIMIT, 'piece pokes out the +Y side: reach ' + ry.toFixed(3) + ' > ' + LIMIT);
    if (m.position.z < 0.35) anyLow = true;    // fills the lower half
    if (m.position.z > 0.9)  anyHigh = true;   // spills over the rim
  }
  assert.ok(anyLow,  'some trash should sit low, filling the bottom half');
  assert.ok(anyHigh, 'some trash should spill over the top rim');
});

// ---- 2) pickup when hands empty and standing on a basket ---------------------------
check('hands empty + standing on a basket -> pick it up (carry="litterBasket")', ()=>{
  const b0 = api.baskets()[0];
  p.wx = b0.hx; p.wy = b0.hy;
  api.tryInteract();
  assert.strictEqual(api.carry(), 'litterBasket');
  assert.strictEqual(b0.state, 'carried');
  assert.strictEqual(b0.g.parent, worker.group);
});

// ---- 3) carrying basket, far from the hopper -> "get closer", no dump ---------------
check('carrying basket + far from hopper -> closer line, no dump', ()=>{
  resetCalls();
  p.wx = 100; p.wy = 100;
  api.tryInteract();
  assert.deepStrictEqual(calls.voices, ['I need to get closer to the truck!']);
  assert.strictEqual(api.flying().length, 0);
  assert.strictEqual(api.carry(), 'litterBasket');
  assert.strictEqual(calls.deposit, 0);
});

// ---- 3b) inside the bag/can band but outside the basket radius -> no dump ----------
check('carrying basket within the bag/can band but >radius from scoop -> closer line', ()=>{
  resetCalls();
  p.wx = 5.7; p.wy = -0.5;   // nearHopper()=true here, but 4.0 from the scoop (>3.5)
  assert.strictEqual(api.nearHopper(), true);
  api.tryInteract();
  assert.deepStrictEqual(calls.voices, ['I need to get closer to the truck!']);
  assert.strictEqual(api.flying().length, 0);
  assert.strictEqual(api.carry(), 'litterBasket');
  assert.strictEqual(calls.deposit, 0);
});

// ---- 4) carrying basket AT the hopper -> dump + launch flight ----------------------
check('carrying basket + at hopper -> dumped, flight launched, worker freed', ()=>{
  resetCalls();
  const b0 = api.baskets()[0];
  p.wx = 5; p.wy = -4.5;
  api.tryInteract();
  assert.strictEqual(api.flying().length, 1);
  assert.strictEqual(api.carry(), 'none');
  assert.strictEqual(b0.state, 'dumped');
  assert.strictEqual(b0.g.parent, dynamicGroup);
  assert.strictEqual(b0.trash.visible, false);   // contents dumped -> empty basket tossed back
  assert.strictEqual(calls.deposit, 1);
  assert.ok(calls.score >= 1);
});

// ---- 5) flight lands the basket back on its home corner ----------------------------
check('updateFlyingBaskets -> lands upright at home corner, marked SERVICED (not re-armed)', ()=>{
  const b0 = api.baskets()[0];
  for (let i=0;i<10;i++) api.updateFlyingBaskets(0.1);
  assert.strictEqual(api.flying().length, 0);
  assert.strictEqual(b0.state, 'serviced');
  assert.strictEqual(b0.wx, b0.hx); assert.strictEqual(b0.wy, b0.hy);
  assert.strictEqual(b0.g.parent, groundGroup);
  assert.strictEqual(b0.g.rotation.z, 0);
});

// ---- 5b) a serviced basket must NOT be picked up again ------------------------------
check('serviced basket -> standing on it does nothing (no re-carry)', ()=>{
  const b0 = api.baskets()[0];
  p.wx = b0.wx; p.wy = b0.wy;
  api.tryInteract();
  assert.notStrictEqual(api.carry(), 'litterBasket');
  assert.strictEqual(b0.state, 'serviced');
  assert.strictEqual(b0.g.parent, groundGroup);
});

// ---- 6) knocked-out basket stays pickable ------------------------------------------
check('dropCarried (basket) -> stays "placed" and pickable again', ()=>{
  const b0 = api.baskets()[1];
  p.wx = b0.hx; p.wy = b0.hy;
  api.tryInteract();
  assert.strictEqual(api.carry(), 'litterBasket');
  api.dropCarried();
  assert.strictEqual(api.carry(), 'none');
  assert.strictEqual(b0.state, 'placed');
  assert.strictEqual(b0.g.parent, dynamicGroup);
  p.wx = b0.wx; p.wy = b0.wy;
  api.tryInteract();
  assert.strictEqual(api.carry(), 'litterBasket');
});

// ---- 7) reset restores all 14 baskets to their corners -----------------------------
check('resetLitterBaskets -> all 14 restored "placed" on groundGroup, in-flight cleared', ()=>{
  const b3 = api.baskets()[3];
  p.wx = b3.hx; p.wy = b3.hy;
  if (api.carry() !== 'litterBasket') api.tryInteract();
  api.resetLitterBaskets();
  assert.strictEqual(api.baskets().length, 14);
  assert.strictEqual(api.flying().length, 0);
  for (const b of api.baskets()){
    assert.strictEqual(b.state, 'placed');
    assert.strictEqual(b.g.parent, groundGroup);
    assert.ok(b.trash && b.trash.visible === true, 'fresh shift: every basket refilled with visible trash');
  }
});

console.log('\n' + pass + ' litter-basket checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));