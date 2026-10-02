// _bonus_dance_chk.js — verify the OVERTIME WIN celebration routine.
// Drives bonusPose(true) + updateBonusInterlude across a fake clock and asserts the
// four phases read correctly: HOP (jump, fist up) -> SPIN (full turn, arms in a V) ->
// DANCE (face camera, wings flap mirrored, stomp) -> SETTLE (fist-up pose, flag reset).
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
function extractFn(src, name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('not found: ' + name);
  const b = src.indexOf('{', idx); let d = 0, i = b;
  for (; i < src.length; i++){ if (src[i]==='{') d++; else if (src[i]==='}'){ d--; if (!d){ i++; break; } } }
  return src.slice(idx, i);
}

// --- a steppable fake clock. Start on a non-zero base so bonusPose's
//     "bonusHopStart = performance.now()" is TRUTHY (0 would trip the early-return). ---
const T0 = 1000000;
let fakeNow = T0; // module-scoped; the performance.now closure below can see it
performance.now = () => fakeNow;

// --- minimal worker / parts mocks that record their last rotation ---------------
function rotObj(){ return { x:0, y:0, z:0, set(a,b,c){ this.x=a; this.y=b; this.z=c; } }; }
const worker = { group: { position: rotObj(), rotation: rotObj() }, hat: { position: rotObj(), rotation: rotObj() } };
const wparts = { legL:{rotation:rotObj()}, legR:{rotation:rotObj()}, armL:{rotation:rotObj()}, armR:{rotation:rotObj()} };
const p = { facing: 0.3 };
const GZ = 0.3;
function updateConfetti(dt){}

const api = new Function(
  'worker','wparts','p','GZ','updateConfetti',
  'var bonusHopStart = -1;' +
  extractFn(html,'bonusPose') + '\n' +
  extractFn(html,'updateBonusInterlude') + '\n' +
  'return { bonusPose, updateBonusInterlude, getStart:()=>bonusHopStart };'
)(worker, wparts, p, GZ, updateConfetti);

const assert = require('assert');
let pass = 0;
function check(n, f){ try { f(); pass++; console.log('  ok  ' + n); } catch (e){ console.error(' FAIL ' + n + ' :: ' + e.message); process.exitCode = 1; } }

// Kick off a WIN (bonusHopStart = T0), then step the interlude at offsets from T0.
api.bonusPose(true);
const at = (t) => {
  fakeNow = T0 + t;
  api.updateBonusInterlude(0.05);
  return {
    pos: worker.group.position.z, rot: worker.group.rotation,
    armL: wparts.armL.rotation, armR: wparts.armR.rotation,
    legL: wparts.legL.rotation, legR: wparts.legR.rotation,
    start: api.getStart(),
  };
};

check('HOP phase (t=450): worker is airborne (z above the floor)', ()=>{
  const s = at(450);
  assert.ok(s.pos > GZ + 0.05, 'expected a hop above the floor, z=' + s.pos);
});
check('HOP phase (t=450): right fist is up (armR.rotation.y ~ PI)', ()=>{
  const s = at(450);
  assert.ok(Math.abs(s.armR.y - Math.PI) < 0.2, 'armR.y should be ~PI, got ' + s.armR.y);
});
check('SPIN phase (t=1350): body has turned past a quarter-revolution (mid-spin)', ()=>{
  const s = at(1350);
  assert.ok(s.rot.z > p.facing + Math.PI / 2 && s.rot.z <= p.facing + Math.PI * 2,
    'rotation.z should be mid-spin, got ' + s.rot.z);
});
check('SPIN phase (t=1350): both arms are raised (arms-in-a-V)', ()=>{
  const s = at(1350);
  assert.ok(s.armL.y > 2.0 && s.armR.y > 2.0, 'both arms should be up, got ' + s.armL.y + '/' + s.armR.y);
});
check('DANCE phase (t=3000): faces the camera (rotation.z back to facing)', ()=>{
  const s = at(3000);
  assert.ok(Math.abs(s.rot.z - p.facing) < 1e-6, 'rotation.z should be p.facing, got ' + s.rot.z);
});
check('DANCE phase (t=3000): wings flap — arms out to the sides, mirrored', ()=>{
  const s = at(3000);
  assert.ok(Math.abs(s.armL.x) > 0.2, 'armL should be flapping out (rotation.x), got ' + s.armL.x);
  assert.ok(Math.abs(s.armL.x + s.armR.x) < 1e-6, 'armL/armR flaps should be mirrored, got ' + s.armL.x + '/' + s.armR.x);
});
check('DANCE phase (t=3000): stomping (at least one knee lifted)', ()=>{
  const s = at(3000);
  assert.ok(s.legL.x !== 0 || s.legR.x !== 0, 'a leg should stomp during the dance');
});
check('SETTLE phase (t=4600): holds the fist-up pose and resets the celebration flag', ()=>{
  const s = at(4600);
  assert.strictEqual(s.start, 0, 'bonusHopStart should reset to 0 after settling');
  assert.ok(Math.abs(s.armR.y - Math.PI) < 0.2, 'armR should end with the fist up, got ' + s.armR.y);
  assert.ok(s.pos <= GZ + 1e-6, 'worker should be back on the floor, z=' + s.pos);
  assert.strictEqual(s.legL.x, 0, 'legs should be neutral after settling');
});

console.log('\n' + pass + ' overtime win-celebration checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));