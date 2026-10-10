// _bagtype_chk.js — test the REAL garbage-bag TYPE logic extracted verbatim
// from index.html (roll, per-type visuals, worker's reaction line, and the
// heavy-bag "must be close to the scoop" dump rule), driven with lightweight mocks.
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
function makeG(){
  const pos = { x:0, y:0, z:0, set(x,y,z){ this.x=x; this.y=y; this.z=z; } };
  const rot = { x:0, y:0, z:0, set(x,y,z){ this.x=x; this.y=y; this.z=z; } };
  const scl = { x:1, y:1, z:1, set(x,y,z){ this.x=x; this.y=y; this.z=z; }, setScalar(s){ this.x=this.y=this.z=s; } };
  return { parent:null, visible:true, children:[], position:pos, rotation:rot, scale:scl, add(c){ this.children.push(c); if(c) c.parent=this; }, remove(){} };
}
// crinkle() runs for real inside these builds, so every mock geometry carries the position
// attribute it walks — with count 0 the walk is a no-op (these checks count PARTS; the
// actual folds are audited by _tree_bag_chk.js against the real three.js build).
function posBufMock(){
  return { count: 0, needsUpdate: false, getX(){ return 0; }, getY(){ return 0; }, getZ(){ return 0; }, setX(){}, setY(){}, setZ(){} };
}
function geoMock(type, params){
  return { type, parameters: params || {}, attributes: { position: posBufMock() }, computeVertexNormals(){} };
}
function meshMock(geo, mat){
  return { parent:null, visible:true, geometry: geo || geoMock('Mesh'), material: mat || null,
    position:{ x:0,y:0,z:0, set(){} }, rotation:{ x:0,y:0,z:0, set(){} }, scale:{ x:1,y:1,z:1, set(){}, setScalar(){} },
    add(){}, remove(){} };
}
const THREE = { Group: function(){ return makeG(); }, Mesh: function(g,m){ return meshMock(g, m); }, ConeGeometry: function(){ return geoMock('ConeGeometry'); }, TorusGeometry: function(){ return geoMock('TorusGeometry'); }, Vector2: function(x,y){ this.x=x; this.y=y; }, LatheGeometry: function(points, segments){ return geoMock('LatheGeometry', { points, segments }); } };
const M  = (c)=>({ c:c });
const MS = (c)=>({ c:c });
const BX = ()=>meshMock();
const CY = ()=>meshMock();
const SP = ()=>meshMock();
const SPH = ()=>meshMock();
const R = (a,b)=>a + Math.random()*(b-a);
// ---- game state / stubs (real values where they matter) ----------------------------
const truck = { wx: 10, hopperOff: -4.3, hopperY: 0, hidden: 0 };
const p = { wx: 5, wy: -4.5, stunT: 0 };
const dynamicGroup = { add(g){ g.parent = dynamicGroup; }, remove(g){ g.parent = null; } };
const worker = { group: { add(g){ g.parent = worker.group; }, remove(){} } };
const calls = { voices: [] };
const flyingBags = [];
const SFX = { playPickupSound(){}, playTossSound(){}, playCanDropSound(){}, playDropSound(){} };
const Voice = { say(t){ calls.voices.push(t); } };
const WORKER_GENDER = 'male';
const GZ = 0.01;
const LITTER_DUMP_RADIUS = 3.5;
const dist = (x,y)=>Math.hypot(x-p.wx, y-p.wy);
const state = 'play', blocks = [], creatures = [], litterBaskets = [];
function attachCarried(item){ worker.group.add(item.g); }
function dumpCan(){}
function dumpLitterBasket(){}
function nearHopperLitter(){ return false; }
function addScore(){} function hopperDeposit(){} function disposeObj(){} function checkHouse(){}
let bedStuy = false;
const isBedStuyLevel = function(){ return bedStuy; };

// ---- build the real logic closure --------------------------------------------------
const fns = ['LA','crinkle','slump','stuff','pleat','fray','curl','twist','rollBagType','tieTop','makeBag','speakBagType','pickUp','nearHopper','nearHopperHeavy','tossBag','tryInteract'].map(n=>extractFn(html,n)).join('\n');
const api = new Function(
  'THREE','M','MS','BX','CY','SP','SPH','R','truck','p','dynamicGroup','worker','flyingBags','SFX','Voice','WORKER_GENDER','GZ','LITTER_DUMP_RADIUS','HEAVY_DUMP_RADIUS','dist','state','blocks','creatures','litterBaskets','addScore','hopperDeposit','disposeObj','checkHouse','attachCarried','dumpCan','dumpLitterBasket','nearHopperLitter','isBedStuyLevel',
  'var carry="none", carried=null; const MAX_SMALL_BAGS=3; var bagStack=[]; var haulCount = 0; function attachStacked(it,slot){ worker.group.add(it.g); }\n' + fns + '\n' +
  'return { rollBagType, makeBag, speakBagType, pickUp, nearHopper, nearHopperHeavy, tryInteract, ' +
  'carry:()=>carry, carried:()=>carried, flying:()=>flyingBags, ' +
  'setCarried:function(c,i){ carry=c; carried=i; } };'
)(THREE, M, MS, BX, CY, SP, SPH, R, truck, p, dynamicGroup, worker, flyingBags, SFX, Voice, WORKER_GENDER, GZ, LITTER_DUMP_RADIUS, 3.2, dist, state, blocks, creatures, litterBaskets, addScore, hopperDeposit, disposeObj, checkHouse, attachCarried, dumpCan, dumpLitterBasket, nearHopperLitter, isBedStuyLevel);
// ---- 1) rollBagType: only valid types, sane rarity ordering ------------------------
check('rollBagType -> only valid types, rarest-to-commonest ordering holds', ()=>{
  const valid = ['normal','heavy','maggot','piss','glass','needle'];
  const counts = {};
  for (let i=0;i<40000;i++){ const t = api.rollBagType(); assert.ok(valid.indexOf(t)>=0, 'bad type: '+t); counts[t]=(counts[t]||0)+1; }
  assert.ok(counts.normal > counts.heavy,  'normal should outpace heavy ('+counts.normal+' vs '+counts.heavy+')');
  assert.ok(counts.heavy > counts.glass,   'heavy should outpace rare glass');
  assert.ok(counts.glass > counts.needle,  'glass should outpace rarest needle');
  assert.ok(counts.maggot > 0 && counts.piss > 0, 'maggot & piss should both appear');
});

// ---- 2) speakBagType: the exact worker line per type; normal is silent ------------
check('speakBagType heavy -> green-bag / haul-to-truck line', ()=>{ calls.voices.length=0; api.speakBagType({type:'heavy'}); assert.deepStrictEqual(calls.voices, ['That green bag is heavy — haul it to the truck!']); });
check('speakBagType maggot -> "Maggots!!!"', ()=>{ calls.voices.length=0; api.speakBagType({type:'maggot'}); assert.deepStrictEqual(calls.voices, ['Maggots!!!']); });
check('speakBagType piss -> dog-piss line', ()=>{ calls.voices.length=0; api.speakBagType({type:'piss'}); assert.deepStrictEqual(calls.voices, ['Dog piss! Shake it before you take it!']); });
check('speakBagType glass -> "OW! Broken glass!"', ()=>{ calls.voices.length=0; api.speakBagType({type:'glass'}); assert.deepStrictEqual(calls.voices, ['OW! Broken glass!']); });
check('speakBagType needle -> needle line', ()=>{ calls.voices.length=0; api.speakBagType({type:'needle'}); assert.deepStrictEqual(calls.voices, ['There\'s a needle sticking out!']); });
check('speakBagType normal -> silent (no comment)', ()=>{ calls.voices.length=0; api.speakBagType({type:'normal'}); assert.strictEqual(calls.voices.length, 0); });
check('speakBagType unknown/missing type -> silent', ()=>{ calls.voices.length=0; api.speakBagType({}); api.speakBagType(null); assert.strictEqual(calls.voices.length, 0); });

// ---- 3) makeBag: every type builds a bag; heavy is bigger; specials add bits --------
check('makeBag -> every type builds a bag with the base 7 parts', ()=>{
  ['normal','heavy','maggot','piss','glass','needle'].forEach(t => {
    const g = api.makeBag(t);
    assert.ok(g && g.children && g.children.length >= 7, t + ' should keep the body/lump/neck/snout/knot/2 grabs (got ' + (g&&g.children&&g.children.length) + ')');
  });
});
check('makeBag -> every type ends in TWO lathed GRAB EARS, never a bowl, a ball or loops', ()=>{
  // The excess above the pinches into TWO long strips of film: lathes spun over a narrow arc,
  // splayed apart. One flap was the old duster rag; the old bowl needed two whole lathed
  // surfaces, and before that the top ended in a squashed ball and a pair of loops.
  ['normal','heavy','maggot','piss','glass','needle'].forEach(t => {
    const all = [], walk = (o) => { all.push(o); (o.children || []).forEach(walk); };
    walk(api.makeBag(t));
    const lathes = all.filter(c => c.geometry && c.geometry.type === 'LatheGeometry');
    assert.strictEqual(lathes.length, 2, t + ' should grow exactly two grab ears (got ' + lathes.length + ')');
    lathes.forEach((m) => assert.ok(m.rotation.x !== 0, t + ' ear must be stood up on its axis'));
  });
});
check('makeBag -> the ears are rooted in the knot, splay apart and lean (never a fin or horn)', ()=>{
  ['normal','heavy','maggot','piss','glass','needle'].forEach(t => {
    const g = api.makeBag(t);
    // azimuth group -> lean group -> swing group -> the ear film itself
    const grabs = g.children.filter(c =>
      Array.isArray(c.children) && c.children.length === 1 &&
      Array.isArray(c.children[0].children) && c.children[0].children.length === 1);
    assert.strictEqual(grabs.length, 2, t + ' should grow two grab ears (got ' + grabs.length + ')');
    const leans = grabs.map(c => c.children[0].rotation.x);
    leans.forEach((lean) => assert.ok(Math.abs(lean) >= 0.02 && Math.abs(lean) <= 0.66,
      t + ' ear must hang loose in the wind, not saw through the air (got ' + lean + ')'));
    assert.ok(grabs[0].position.z > 0.7 && grabs[1].position.z > 0.7, t + ' ears must come out of the knot');
    assert.ok(Math.abs(grabs[0].rotation.z - grabs[1].rotation.z) > 1.05, t + ' ears must V-split apart');
  });
});
check('makeBag -> the bag is tied ONCE: one knot band, no ear loops anywhere', ()=>{
  ['normal','heavy','maggot','piss','glass','needle'].forEach(t => {
    const knots = api.makeBag(t).children.filter(c => c.geometry && c.geometry.type === 'TorusGeometry');
    assert.strictEqual(knots.length, 1, t + ' should be tied with exactly one knot band (got ' + knots.length + ')');
  });
});
check('makeBag heavy -> visibly scaled up (fuller)', ()=>{
  const n = api.makeBag('normal'), h = api.makeBag('heavy');
  assert.strictEqual(n.scale.x, 1.0, 'normal bag should be unscaled');
  assert.ok(h.scale.x > 1.0, 'heavy bag should be scaled up (' + h.scale.x + ')');
});
check('makeBag specials -> carry extra hazard bits beyond the base 7', ()=>{
  assert.strictEqual(api.makeBag('normal').children.length, 7);
  assert.strictEqual(api.makeBag('heavy').children.length, 8, 'heavy adds only the twist-tie');
  assert.ok(api.makeBag('maggot').children.length > 7, 'maggot slime/worms');
  assert.ok(api.makeBag('piss').children.length   > 7, 'piss puddle');
  assert.ok(api.makeBag('glass').children.length  > 7, 'glass shards');
  assert.ok(api.makeBag('needle').children.length > 7, 'needle');
});

// ---- 4) heavy-bag dump rule: tight zone + the "too heavy" line ---------------------
check('heavy bag, far from hopper -> "too heavy" line, not dumped', ()=>{
  truck.wx=10; p.wx=0; p.wy=-11.5;
  calls.voices.length=0;
  api.setCarried('bag', { kind:'bag', type:'heavy', state:'curb', g:makeG() });
  api.tryInteract();
  assert.deepStrictEqual(calls.voices, ['I need to be closer to the truck. This bag is too heavy!']);
  assert.strictEqual(api.carry(), 'bag');
});
check('heavy bag, at the rear scoop -> dumped, no line', ()=>{
  truck.wx=10; p.wx=5.7; p.wy=-4.5;
  calls.voices.length=0;
  const b = { kind:'bag', type:'heavy', state:'curb', g:makeG() };
  api.setCarried('bag', b);
  api.tryInteract();
  assert.strictEqual(b.state, 'dumped');
  assert.strictEqual(api.carry(), 'none');
  assert.strictEqual(b.g.parent, dynamicGroup);
  assert.strictEqual(calls.voices.length, 0);
});
check('KEY: same spot dumps a normal bag but REFUSES a heavy bag', ()=>{
  truck.wx=10; p.wx=2.3; p.wy=-0.1;   // inside the generous band, outside the heavy radius
  assert.strictEqual(api.nearHopper(), true,   'precondition: inside generous band');
  assert.strictEqual(api.nearHopperHeavy(), false, 'precondition: outside heavy radius');
  calls.voices.length=0;
  const nb = { kind:'bag', type:'normal', state:'curb', g:makeG() };
  api.setCarried('bag', nb);
  api.tryInteract();
  assert.strictEqual(nb.state, 'dumped', 'normal bag dumps fine here');
  calls.voices.length=0;
  const hb = { kind:'bag', type:'heavy', state:'curb', g:makeG() };
  api.setCarried('bag', hb);
  api.tryInteract();
  assert.deepStrictEqual(calls.voices, ['I need to be closer to the truck. This bag is too heavy!']);
  assert.strictEqual(hb.state, 'curb', 'heavy bag is NOT dumped here');
});
check('regression: normal bag, far -> generic closer line', ()=>{
  truck.wx=10; p.wx=0; p.wy=-11.5;
  calls.voices.length=0;
  api.setCarried('bag', { kind:'bag', type:'normal', state:'curb', g:makeG() });
  api.tryInteract();
  assert.deepStrictEqual(calls.voices, ['I need to get closer to the truck!']);
});
check('regression: normal bag, at hopper -> dumped, silent', ()=>{
  truck.wx=10; p.wx=5; p.wy=-4.5;
  calls.voices.length=0;
  const b = { kind:'bag', type:'normal', state:'curb', g:makeG() };
  api.setCarried('bag', b);
  api.tryInteract();
  assert.strictEqual(b.state, 'dumped');
  assert.strictEqual(api.carry(), 'none');
  assert.strictEqual(calls.voices.length, 0);
});

// ---- 5) Bed-Stuy STORM DEBRIS SUNDAY: roll + new meshes + worker line ---------------
check('Bed-Stuy roll -> storm debris dominates, base bags still appear', ()=>{
  bedStuy = true;
  const counts = {};
  for (let i=0;i<40000;i++){ const t = api.rollBagType(); counts[t]=(counts[t]||0)+1; }
  bedStuy = false;
  const valid = ['stormbox','woodpile','normal','heavy','maggot','piss','glass','needle'];
  Object.keys(counts).forEach(t=>assert.ok(valid.indexOf(t)>=0, 'bad type: '+t));
  assert.ok(counts.stormbox > 0 && counts.woodpile > 0, 'both debris types appear');
  const debris = (counts.stormbox||0)+(counts.woodpile||0);
  assert.ok(debris > 28000, 'storm debris should be the majority of curb items (got ' + debris + ')');
  assert.ok((counts.normal||0)+(counts.heavy||0)+(counts.glass||0) > 0, 'some normal bags remain');
});
check('makeBag stormbox/woodpile -> both build a non-empty group', ()=>{
  ['stormbox','woodpile'].forEach(t=>{
    const g = api.makeBag(t);
    assert.ok(g && g.children && g.children.length >= 3, t + ' should build a debris group (got ' + (g&&g.children&&g.children.length) + ')');
  });
});
check('speakBagType stormbox -> debris-box line', ()=>{ calls.voices.length=0; api.speakBagType({type:'stormbox'}); assert.deepStrictEqual(calls.voices, ['Storm debris — haul this box to the truck!']); });
check('speakBagType woodpile -> wood-pile line', ()=>{ calls.voices.length=0; api.speakBagType({type:'woodpile'}); assert.deepStrictEqual(calls.voices, ['Half a fence in this pile!']); });
check('non-Bed-Stuy roll -> never returns debris (regression)', ()=>{
  bedStuy = false;
  for (let i=0;i<20000;i++){ const t = api.rollBagType(); assert.ok(t!=='stormbox' && t!=='woodpile', 'debris leaked off Bed-Stuy: '+t); }
});

console.log('\n' + pass + ' bag-type checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));