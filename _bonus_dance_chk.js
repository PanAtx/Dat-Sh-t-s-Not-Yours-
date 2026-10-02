// _bonus_dance_chk.js — verify the OVERTIME WIN celebration routine.
// Drives bonusPose(true) + updateBonusInterlude across a fake clock and asserts the
// five phases read correctly: HOP (jump, fist up) -> SPIN (full turn, arms V, TOSS cap)
// -> DANCE (slow groove, cap on display overhead) -> CATCH (cap drops back on head) ->
// SETTLE (fist-up pose, flag reset). Also checks the confetti cannon is fired + animated.
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
const p = { facing: 0.3, wx: 5, wy: -4 };
const GZ = 0.3;
function updateConfetti(dt){}
function updateCannon(dt){}

const api = new Function(
  'worker','wparts','p','GZ','updateConfetti','updateCannon',
  'var bonusHopStart = -1;' +
  extractFn(html,'bonusPose') + '\n' +
  extractFn(html,'updateBonusInterlude') + '\n' +
  'return { bonusPose, updateBonusInterlude, getStart:()=>bonusHopStart };'
)(worker, wparts, p, GZ, updateConfetti, updateCannon);

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
    hat: worker.hat.position, hatRot: worker.hat.rotation,
    start: api.getStart(),
  };
};

// ---- HOP ----
check('HOP (t=500): worker is airborne (z above the floor)', ()=>{
  const s = at(500);
  assert.ok(s.pos > GZ + 0.03, 'expected a hop above the floor, z=' + s.pos);
});
check('HOP (t=500): right fist is up (armR.rotation.y ~ PI)', ()=>{
  const s = at(500);
  assert.ok(Math.abs(s.armR.y - Math.PI) < 0.2, 'armR.y should be ~PI, got ' + s.armR.y);
});
check('HOP (t=500): cap is still on his head (hat z ~ 1.87)', ()=>{
  const s = at(500);
  assert.ok(Math.abs(s.hat.z - 1.87) < 0.01, 'hat should be on the head, z=' + s.hat.z);
});

// ---- SPIN (cap tossed up) ----
check('SPIN (t=1800): body has turned past a quarter-revolution (mid-spin)', ()=>{
  const s = at(1800);
  assert.ok(s.rot.z > p.facing + Math.PI / 2, 'rotation.z should be mid-spin, got ' + s.rot.z);
});
check('SPIN (t=1800): both arms raised (arms-in-a-V)', ()=>{
  const s = at(1800);
  assert.ok(s.armL.y > 2.0 && s.armR.y > 2.0, 'both arms should be up, got ' + s.armL.y + '/' + s.armR.y);
});
check('SPIN (t=1800): the cap has been TOSSed up off his head and is spinning', ()=>{
  const s = at(1800);
  assert.ok(s.hat.z > 1.87 + 0.3, 'hat should be airborne, z=' + s.hat.z);
  assert.ok(s.hatRot.x > 0, 'hat should be spinning as it rises, rx=' + s.hatRot.x);
});

// ---- DANCE (slow groove, cap on display overhead) ----
check('DANCE (t=3200): faces the camera (rotation.z back to facing)', ()=>{
  const s = at(3200);
  assert.ok(Math.abs(s.rot.z - p.facing) < 1e-6, 'rotation.z should be p.facing, got ' + s.rot.z);
});
check('DANCE (t=3200): wings flap — arms out to the sides, mirrored', ()=>{
  const s = at(3200);
  assert.ok(Math.abs(s.armL.x) > 0.1, 'armL should be flapping out (rotation.x), got ' + s.armL.x);
  assert.ok(Math.abs(s.armL.x + s.armR.x) < 1e-6, 'armL/armR flaps should be mirrored, got ' + s.armL.x + '/' + s.armR.x);
});
check('DANCE (t=3200): stomping (at least one knee lifted)', ()=>{
  const s = at(3200);
  assert.ok(s.legL.x !== 0 || s.legR.x !== 0, 'a leg should stomp during the dance');
});
check('DANCE (t=3200): the cap is held on display overhead (well above his head)', ()=>{
  const s = at(3200);
  assert.ok(s.hat.z > 3.0, 'hat should be overhead during the dance, z=' + s.hat.z);
});
check('DANCE is SLOW (still dancing at t=6400 — not cut off early)', ()=>{
  const s = at(6400);
  assert.ok(s.start !== 0, 'routine should not have settled by t=6400');
  assert.ok(Math.abs(s.rot.z - p.facing) < 1e-6, 'still facing the camera during the dance');
  assert.ok(s.hat.z > 3.0, 'cap still on display, z=' + s.hat.z);
});

// ---- CATCH (cap dropping back) ----
check('CATCH (t=6800): cap is dropping back toward his head (1.87 < z < 3.4)', ()=>{
  const s = at(6800);
  assert.ok(s.hat.z > 1.87 + 0.01 && s.hat.z < 3.4, 'hat should be mid-drop, z=' + s.hat.z);
});
check('CATCH (t=6800): finish pose — right fist up', ()=>{
  const s = at(6800);
  assert.ok(Math.abs(s.armR.y - Math.PI) < 0.2, 'armR should be the fist up, got ' + s.armR.y);
});

// ---- SETTLE ----
check('SETTLE (t=7200): cap CAUGHT back on his head (z ~ 1.87) and flag reset', ()=>{
  const s = at(7200);
  assert.strictEqual(s.start, 0, 'bonusHopStart should reset to 0 after settling');
  assert.ok(Math.abs(s.hat.z - 1.87) < 0.01, 'hat should be back on the head, z=' + s.hat.z);
  assert.ok(Math.abs(s.armR.y - Math.PI) < 0.2, 'armR should end with the fist up, got ' + s.armR.y);
  assert.ok(s.pos <= GZ + 1e-6, 'worker should be back on the floor, z=' + s.pos);
  assert.strictEqual(s.legL.x, 0, 'legs should be neutral after settling');
});

// ---- confetti cannon is wired in ----
check('static: confettiCannon() is fired on the win path (with startConfetti)', ()=>{
  const winPath = html.slice(html.indexOf('function resolveBonus'), html.indexOf('function startConfetti()'));
  assert.ok(winPath.indexOf('confettiCannon()') >= 0, 'confettiCannon() should be called on a win');
});
check('static: updateCannon is called every interlude tick', ()=>{
  assert.ok(html.indexOf('updateCannon(dt);') >= 0, 'updateCannon(dt) should be called in the interlude');
});
check('the cannon animates its particles (gravity + vertical + spin integrate)', ()=>{
  const src = extractFn(html, 'updateCannon');
  assert.ok(src.indexOf('c.vz += c.grav * dt') >= 0, 'gravity should integrate');
  assert.ok(src.indexOf('c.m.position.z += c.vz * dt') >= 0, 'vertical motion should integrate');
  assert.ok(src.indexOf('c.m.rotation.x += c.rx') >= 0, 'spin should advance');
});

console.log('\n' + pass + ' overtime win-celebration checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));