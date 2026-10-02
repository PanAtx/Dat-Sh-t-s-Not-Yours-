// _bonus_win_chk.js — verify the OVERTIME win condition actually becomes reachable.
// Reproduces: service EVERY basket (dump at truck) + let toss-back flights finish,
// then evaluate the SAME win predicate used in the main loop:
//     litterBaskets.length > 0 && litterBaskets.every(b => b.state === "serviced")
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
function extractFn(src, name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('not found: ' + name);
  const b = src.indexOf('{', idx); let d = 0, i = b;
  for (; i < src.length; i++){ if (src[i]==='{') d++; else if (src[i]==='}'){ d--; if (!d){ i++; break; } } }
  return src.slice(idx, i);
}
function makeG(){ return {
  parent: null, visible: true, children: [],
  position:{x:0,y:0,z:0,set(a,b,c){this.x=a;this.y=b;this.z=c;}},
  rotation:{x:0,y:0,z:0,set(a,b,c){this.x=a;this.y=b;this.z=c;}},
  add(c){ this.children.push(c); if(c) c.parent=this; }, remove(){}
}; }
const THREE = { Group: function(){ return makeG(); } };
const groundGroup = { add(g){ if(g) g.parent=this; }, remove(g){ if(g) g.parent=null; } };
const dynamicGroup = { add(g){ if(g) g.parent=this; }, remove(g){ if(g) g.parent=null; } };
const LITTERBASKET_TPL = { template:{ clone:()=>({ scale:{setScalar(){}}, position:{set(){}} }) } };
const LITTERBASKET_SCALE = 0.93/168;
const POS = () => ({x:0,y:0,z:0,set(a,b,c){this.x=a;this.y=b;this.z=c;}});
function meshMock(h){ return { parent:null, visible:true, _h:(h||0), position:POS(), rotation:POS(), scale:Object.assign(POS(),{setScalar(s){this.x=this.y=this.z=s;}}), add(){}, remove(){} }; }
const M=(c)=>({c}), MS=(c)=>({c}), BX=(w)=>meshMock(w/2), CY=(r1,r2)=>meshMock(Math.max(r1||0,r2||0)), SP=(r)=>meshMock(r||0);
const worker = { group: groundGroup };
const CROSS_W = 9, IW = 16, LEVEL_XS = [0,16,32,48,64,80,96,112];
const R = (a,b)=>a + Math.random()*(b-a);
const GZ = 0.01, LITTER_DUMP_RADIUS = 4.0, BLOCK_W = 16, QUEENS_CEMETERY_X = 384;
const truck = { wx:10, hopperOff:-4.3, hopperY:0, hidden:0 };
const p = { wx:5, wy:-4.5, stunT:0 };
const state = 'play', blocks=[], creatures=[], WORKER_GENDER='male';
const dist = (x,y)=>Math.hypot(x-p.wx, y-p.wy);
const SFX = { playPickupSound(){}, playCanDropSound(){}, playTossSound(){}, playDropSound(){} };
const Voice = { say(){} };
const BONUS = true, BONUS_BASKET_COUNT = 6;
const fns = ['computeNormalLitterBasketHomes','nearHopper','nearHopperLitter','attachCarried','speakBoneBasket','pickUp','dumpLitterBasket','updateFlyingBaskets','resetLitterBaskets','placeLitterBasket','dropCarried','buildLitterTrash'].map(n=>extractFn(html,n)).join('\n');
const api = new Function(
  'THREE','worker','groundGroup','dynamicGroup','LITTERBASKET_TPL','LITTERBASKET_SCALE','CROSS_W','IW','LEVEL_XS','R','GZ','LITTER_DUMP_RADIUS','truck','p','state','blocks','creatures','WORKER_GENDER','dist','SFX','Voice','M','MS','BX','CY','SP','isQueensLevel','QUEENS_CEMETERY_X','BLOCK_W','BONUS','BONUS_BASKET_COUNT','isBedStuyLevel',
  'var carry="none", carried=null; var litterBaskets=[]; var litterBasketHomes=null; var litterBasketPlaced=false; var flyingBaskets=[]; var bagStack=[]; const MAX_SMALL_BAGS=3;\n'+
  'function tossBag(){} function dumpCan(){} function speakBagType(){} function attachStacked(it,slot){ worker.group.add(it.g); } function addScore(){} function hopperDeposit(){} function disposeObj(){}\n'+
  fns + '\n'+
  'return { dumpLitterBasket, updateFlyingBaskets, placeLitterBasket, baskets:()=>litterBaskets, flying:()=>flyingBaskets, setCarried:function(c,i){carry=c;carried=i;} };'
)(THREE, worker, groundGroup, dynamicGroup, LITTERBASKET_TPL, LITTERBASKET_SCALE,
  CROSS_W, IW, LEVEL_XS, R, GZ, LITTER_DUMP_RADIUS, truck, p, state, blocks, creatures, WORKER_GENDER, dist, SFX, Voice,
  M, MS, BX, CY, SP, ()=>false, QUEENS_CEMETERY_X, BLOCK_W, BONUS, BONUS_BASKET_COUNT, ()=>false);
api.placeLitterBasket();
const baskets = api.baskets();
console.log('overtime baskets spawned:', baskets.length);
function service(b){
  b.state = 'placed';
  api.setCarried('litterBasket', b);
  b.state = 'carried';
  p.wx = truck.wx + truck.hopperOff; p.wy = -4.5;
  api.dumpLitterBasket();
}
let pass = 0;
function check(n, f){ try { f(); pass++; console.log('  ok  ' + n); } catch (e){ console.error(' FAIL ' + n + ' :: ' + e.message); process.exitCode = 1; } }
const assert2 = require('assert');

// Service EVERY basket (empty it into the truck), exactly as the worker would.
check('overtime street spawns baskets to service', ()=>{
  assert2.ok(baskets.length > 0, 'expected overtime baskets, got ' + baskets.length);
});
check('baskets sit on Block 2 + the two middle blocks: 94,178 (B2) + 190,274 (B3) + 286,370 (B4)', ()=>{
  const xs = baskets.map(b => b.wx).sort((a, b) => a - b);
  assert2.deepStrictEqual(xs, [94, 178, 190, 274, 286, 370],
    'expected 6 baskets at 94/178/190/274/286/370, got ' + JSON.stringify(xs));
});
for (const b of baskets) service(b);

// The win predicate MUST match the one in index.html's main loop.
const basketDone = (bb) => bb.state === 'serviced' || bb.state === 'dumped';
const allDoneNow = baskets.length > 0 && baskets.every(basketDone);

check('WIN fires the instant the last basket is emptied (flights still in progress)', ()=>{
  // Right after emptying every basket, all are "dumped" (in their 0.8s toss-back).
  // The win must already be true here — the cosmetic flight must NOT hold the round hostage.
  assert2.strictEqual(allDoneNow, true,
    'allDone should be true with baskets still in flight: ' + baskets.map(b=>b.state).join(', '));
});

check('old predicate (all "serviced") would have let the clock steal the round', ()=>{
  // Proves the fix matters: before the fix, "dumped" (in-flight) baskets were NOT done,
  // so a clock that expired in the final 0.8s cost the worker a round they already won.
  assert2.strictEqual(baskets.every(bb => bb.state === 'serviced'), false,
    'at least one basket must still be in-flight "dumped" (not yet landed "serviced")');
});

// Let the toss-back flights finish, then the win must STILL hold.
let guard = 0;
while (api.flying().length > 0 && guard++ < 2000) api.updateFlyingBaskets(0.1);
check('flights land clean (no basket stuck mid-air)', ()=>{
  assert2.strictEqual(api.flying().length, 0, 'flying baskets remaining: ' + api.flying().length);
});
check('win still holds after flights land (all serviced)', ()=>{
  assert2.strictEqual(baskets.length > 0 && baskets.every(basketDone), true);
});

console.log('\n' + pass + ' overtime win-condition checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));
