// _deposit_logic_chk.js — test the REAL deposit logic extracted from index.html
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
function check(n, f){ try { f(); pass++; console.log('  ok  ' + n); } catch (e) { console.error(' FAIL ' + n + ' :: ' + e.message); process.exitCode = 1; } }

const truck = { wx: 10, hopperOff: -4.3, hopperY: 0, hidden: 0 };
const p = { wx: 5, wy: -4.5, stunT: 0 };
const flyingBags = [];
const dynamicGroup = { add(g){ g.parent = dynamicGroup; }, remove(g){ g.parent = null; } };
const calls = { deposit: 0, score: 0, house: 0, dispose: 0, voices: [] };
const SFX = { playTossSound(){}, playCanDropSound(){} };
const Voice = { say(t){ calls.voices.push(t); } };
function hopperWorldX(){ return truck.wx + (truck.hopperOff != null ? truck.hopperOff : -4.3); }
function hopperWorldY(){ return -4.5 + (truck.hopperY != null ? truck.hopperY : 0); }
function hopperTopZ(){ return 1.0; }   // FBX scoop floor (the truck roof measures ~5.05)
function disposeObj(){ calls.dispose++; }
function addScore(){ calls.score++; }
function hopperDeposit(){ calls.deposit++; }
function checkHouse(){ calls.house++; }
const body = ['nearHopper', 'tossBag', 'updateFlyingBags', 'tryInteract'].map(n => extractFn(html, n)).join('\n');
const api = new Function(
  'truck','p','flyingBags','dynamicGroup','SFX','Voice','hopperWorldX','hopperWorldY','hopperTopZ','GZ','state','blocks','creatures','pickUp','dumpCan','disposeObj','addScore','hopperDeposit','checkHouse','WORKER_GENDER',
  'var carry="none", carried=null;\n' + body + '\n' +
  'return { nearHopper, tossBag, updateFlyingBags, tryInteract, setCarry:function(c,i){carry=c;carried=i;}, getCarry:function(){return carry;} };'
)(truck, p, flyingBags, dynamicGroup, SFX, Voice, hopperWorldX, hopperWorldY, hopperTopZ, 0.01, 'play', [], [], ()=>{}, ()=>{calls.deposit++;}, disposeObj, addScore, hopperDeposit, checkHouse, 'male');

function makeBag(){ return { state:'curb', h:{}, g:{ parent:{ remove:(x)=>{x.parent=null;} }, position:{ __z:0, set:function(x,y,z){this.__z=z;} }, rotation:{x:0,y:0,z:0} } }; }
function stepBags(n){ for (let i=0;i<n;i++) api.updateFlyingBags(0.05); }
function reset(){ calls.deposit=0; calls.score=0; calls.house=0; calls.dispose=0; calls.voices.length=0; flyingBags.length=0; }

check('nearHopper TRUE at rear hopper', ()=>{ truck.wx=10; p.wx=5; p.wy=-4.5; assert.strictEqual(api.nearHopper(), true); });
check('nearHopper FALSE across far sidewalk', ()=>{ truck.wx=10; p.wx=5; p.wy=-11.5; assert.strictEqual(api.nearHopper(), false); });
check('nearHopper FALSE across near sidewalk', ()=>{ truck.wx=10; p.wx=5; p.wy=2.5; assert.strictEqual(api.nearHopper(), false); });
check('nearHopper FALSE far behind truck', ()=>{ truck.wx=10; p.wx=0; p.wy=-4.5; assert.strictEqual(api.nearHopper(), false); });
check('nearHopper FALSE when truck hidden', ()=>{ truck.wx=10; p.wx=5; p.wy=-4.5; truck.hidden=1; assert.strictEqual(api.nearHopper(), false); truck.hidden=0; });

check('far + bag -> closer line, no dump', ()=>{ reset(); truck.wx=10; p.wx=0; p.wy=-11.5; api.setCarry('bag', makeBag()); api.tryInteract(); assert.deepStrictEqual(calls.voices, ['I need to get closer to the truck!']); assert.strictEqual(flyingBags.length, 0); assert.strictEqual(calls.deposit, 0); });
check('far + full can -> closer line, no dump', ()=>{ reset(); truck.wx=10; p.wx=0; p.wy=-11.5; api.setCarry('canFull', {state:'curb',h:{},g:{parent:null}}); api.tryInteract(); assert.deepStrictEqual(calls.voices, ['I need to get closer to the truck!']); assert.strictEqual(calls.deposit, 0); });
check('close + bag -> arc launched, worker freed', ()=>{ reset(); truck.wx=10; p.wx=5; p.wy=-4.5; const b=makeBag(); api.setCarry('bag', b); api.tryInteract(); assert.strictEqual(flyingBags.length, 1); assert.strictEqual(api.getCarry(), 'none'); assert.strictEqual(b.g.parent, dynamicGroup); assert.strictEqual(calls.voices.length, 0); });
function peakZAt(sx, sy){ reset(); truck.wx=10; p.wx=sx; p.wy=sy; const b=makeBag(); api.tossBag(b); api.updateFlyingBags(0.3); return b.g.position.__z; }
check('behind-throw: low gentle lob (peak well below the roof)', ()=>{ const z=peakZAt(5,-4.5); assert.ok(z > 1.0 && z < 4.5, 'peak z=' + z + ' should be a low lob (< 4.5, below the 5.05 roof)'); });
check('side-throw peaks clearly higher than behind-throw (adaptive arc)', ()=>{ const behind=peakZAt(5,-4.5), side=peakZAt(6,-8.5); assert.ok(side > behind + 1.0, 'side ' + side + ' should exceed behind ' + behind + ' by >1.0'); });
check('side-throw still clears the truck roof (z~5.05)', ()=>{ const z=peakZAt(6,-8.5); assert.ok(z > 5.05, 'peak z=' + z + ' should clear roof 5.05'); });
check('landing -> deposit+score+house, bag removed', ()=>{ reset(); truck.wx=10; p.wx=5; p.wy=-4.5; const b=makeBag(); api.tossBag(b); stepBags(20); assert.strictEqual(flyingBags.length, 0); assert.strictEqual(calls.deposit, 1); assert.ok(calls.score >= 1); assert.strictEqual(calls.house, 1); assert.strictEqual(calls.dispose, 1); assert.strictEqual(b.g.parent, null); });

console.log('\n' + pass + ' deposit logic checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));