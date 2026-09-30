// Punchback check (retaliation vs the 12 attack NPCs):
//   1) any of the 12 attack NPCs that hits the worker arms a 10s PUNCH window
//      (markPunchback, called from the hurtNPC hook) and empties his hands,
//   2) the interact key in the window throws a jab at the nearest attacker within
//      2.0u (tryPunchBack: face snap, 0.34s punchT, 0.14s land frame, one punch
//      per window) - a whiff (nobody in reach) falls through, no SFX,
//   3) the 0.14s smash frame (landPunch): red jagged "POW!" burst at the fist,
//      the NPC's squeal, the attacker disarmed (held item removed + disposed),
//      a 5s scare-off at ~7 u/s (updateCreatures generic block) and a bonus "mark"
//      drop at his feet - a whiff (target already gone) plays no effect,
//   4) SFX.playPunchSound: WHOOSH (bandpass) + the THUMP delayed to the land frame,
//   5) the punch fields reset in resetWorldState and the gate preempts the
//      pickup/throw handling in tryInteract.
// Runs the REAL markPunchback / tryPunchBack / landPunch / hurtNPC extracted from
// index.html in a harness.
const fs = require('fs');
const src = fs.readFileSync('index.html', 'utf8');

let pass = true;
const check = (name, c, e) => {
  console.log((c ? 'PASS' : 'FAIL') + '  ' + name + (c ? '' : '  [' + e + ']'));
  if (!c) pass = false;
};

function extract(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found');
  const brace = src.indexOf('{', idx);
  let depth = 0,
    i = brace;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(idx, i + 1);
}

console.log('[1] punchback source wiring');
{
  check(
    'SFX.playPunchSound: WHOOSH bandpass + the THUMP delayed to the 0.13-0.14s land frame',
    /playPunchSound\(\) \{[\s\S]{0,400}?bandpass[\s\S]{0,400}?0\.1[34]/.test(src),
  );
  const causes = src.match(/const PUNCHBACK_CAUSES = \[[\s\S]*?\];/);
  check(
    'PUNCHBACK_CAUSES lists exactly the 12 attack NPCs',
    causes && (causes[0].match(/"\w+"/g) || []).length === 12,
  );
  check(
    'the 12 are exactly: dealer pimp mafia crazy crazyAlien panhandler rapper cop robber football bball jacker',
    causes &&
      ['dealer', 'pimp', 'mafia', 'crazy', 'crazyAlien', 'panhandler', 'rapper', 'cop', 'robber', 'football', 'bball', 'jacker'].every(
        (t) => causes[0].indexOf('"' + t + '"') >= 0
      ),
  );
  const mp = extract('markPunchback');
  check(
    'markPunchback: arms the 10s window (attackerT = 10) + records the cause + empties his hands (dropCarried)',
    /p\.attackerT = 10/.test(mp) && /p\.attackerCause = cause/.test(mp) && /dropCarried\(\)/.test(mp),
  );
  const hn = extract('hurtNPC');
  check(
    'hurtNPC hook: the 12-cause hit arms the window BEFORE the death check (absorbed i-frame hits do not arm it)',
    /PUNCHBACK_CAUSES\.indexOf\(cause \|\| "route"\) >= 0\) markPunchback\(cause\);/.test(hn) &&
      hn.indexOf('markPunchback(cause)') < hn.indexOf('if (health <= 0)') &&
      hn.indexOf('if (health <= 0)') >= 0,
  );
  const ti = src.indexOf('function tryInteract()');
  check(
    'tryInteract gate: the punch preempts the pickup/throw handling (one punch per window; a whiff falls through)',
    ti >= 0 &&
      /function tryInteract\(\) \{\s*if \(state !== "play" \|\| p\.stunT > 0\) return;\s*[\s\S]{0,400}?if \(p\.attackerT > 0 && tryPunchBack\(\)\) return;/.test(
        src.slice(ti, ti + 700)
      ),
  );
}

console.log('');
console.log('[2] the p state fields + the resetWorldState reset');
{
  check(
    'the p literal: punchT / punchLandT / punchTarget / attackerT / attackerCause',
    /punchT: 0,/.test(src) &&
      /punchLandT: 0,/.test(src) &&
      /punchTarget: null,/.test(src) &&
      /attackerT: 0,/.test(src) &&
      /attackerCause: "",/.test(src),
  );
  const rw = src.slice(src.indexOf('function resetWorldState'));
  check(
    'resetWorldState: all five punch fields reset (punchT 0 / punchLandT 0 / punchTarget null / attackerT 0 / attackerCause "")',
    /p\.punchT = 0;/.test(rw) &&
      /p\.punchLandT = 0;/.test(rw) &&
      /p\.punchTarget = null;/.test(rw) &&
      /p\.attackerT = 0;/.test(rw) &&
      /p\.attackerCause = "";/.test(rw),
  );
}

console.log('');
console.log('[3] markPunchback — the real function in a harness');
{
  const causesLit = src.match(/const PUNCHBACK_CAUSES = \[[\s\S]*?\];/)[0];
  const mp = extract('markPunchback');
  const p = { attackerT: 0, attackerCause: '' };
  let dropped = 0;
  new Function('p', 'dropCarried', causesLit + '\n' + mp + '\nmarkPunchback("dealer");')(
    p,
    () => dropped++
  );
  check('hit by a dealer: 10s window armed + cause recorded', p.attackerT === 10 && p.attackerCause === 'dealer');
  check('hit: his hands empty (dropCarried called once)', dropped === 1);
}

console.log('');
console.log('[4] tryPunchBack — the real function in a harness');
{
  const causesLit = src.match(/const PUNCHBACK_CAUSES = \[[\s\S]*?\];/)[0];
  const causesArr = (causesLit.match(/"(\w+)"/g) || []).map((s) => s.slice(1, -1));
  const tp = extract('tryPunchBack');
  function run(p, creatures) {
    const out = { said: [], punch: 0 };
    const fn = new Function(
      'p',
      'creatures',
      'PUNCHBACK_CAUSES',
      'dist',
      'pick',
      'Voice',
      'SFX',
      'WORKER_GENDER',
      tp + '\nreturn tryPunchBack();'
    );
    const ok = fn(
      p,
      creatures,
      causesArr,
      (x, y) => Math.hypot(x - p.wx, y - p.wy),
      (a) => a[0],
      { say: (t) => out.said.push(t) },
      { playPunchSound: () => out.punch++ },
      'male'
    );
    return { ok: ok, out: out, p: p };
  }
  const mkP = () => ({ wx: 0, wy: 2, facing: 0, punchT: 0, punchLandT: 0, punchTarget: null, attackerT: 10 });
  const ped = { type: 'ped', wx: 0.5, wy: 2 };
  const dealer = { type: 'dealer', wx: 1.5, wy: 2 };
  const copFar = { type: 'cop', wx: 3, wy: 2 }; // 3u: outside the 2.0u reach
  const r1 = run(mkP(), [ped, dealer, copFar]);
  check(
    'a dealer 1.5u away (ped 0.5u + cop 3u also present): the punch goes out at the dealer',
    r1.ok === true && r1.p.punchTarget === dealer
  );
  check(
    'the jab: 0.34s punchT + 0.14s land frame + one punch per window (attackerT back to 0)',
    r1.p.punchT === 0.34 && r1.p.punchLandT === 0.14 && r1.p.attackerT === 0
  );
  check(
    'face snap: p.facing = atan2 toward the attacker (dealer on +x -> 0)',
    Math.abs(r1.p.facing - Math.atan2(2 - 2, 1.5 - 0)) < 1e-9
  );
  check('the worker taunts (a voice line) + the WHOOSH/THUMP SFX fires', r1.out.said.length === 1 && r1.out.punch === 1);
  const r2 = run(mkP(), [ped, copFar]); // nobody in the 2.0u reach
  check(
    'whiff (only a ped 0.5u + a cop 3u): NO punch, NO SFX (falls through to the pickup/throw handling)',
    r2.ok === false && r2.out.punch === 0 && r2.out.said.length === 0 && r2.p.punchTarget === null
  );
  const dealerNear = { type: 'dealer', wx: 1.0, wy: 2 };
  const r3 = run(mkP(), [dealerNear, dealer]);
  check('two attackers in reach (1.0u + 1.5u): the NEAREST one gets punched', r3.ok === true && r3.p.punchTarget === dealerNear);
}

console.log('');
console.log('[5] landPunch — the smash frame in a harness');
{
  const lp = extract('landPunch');
  function run(p, creatures, c) {
    const out = { bubbles: [], said: [], disposed: 0, removed: 0, bonus: null };
    const fn = new Function(
      'p',
      'creatures',
      'c',
      'spawnBubble',
      'pick',
      'Voice',
      'disposeObj',
      'spawnBonus',
      lp + '\nlandPunch(c);'
    );
    fn(
      p,
      creatures,
      c,
      (t, x, y, s, st) => out.bubbles.push({ t: t, x: x, y: y, s: s, st: st }),
      (a) => a[0],
      { say: (t) => out.said.push(t) },
      (o) => out.disposed++,
      (x, y) => (out.bonus = [x, y])
    );
    return out;
  }
  const p = { wx: 8, wy: 2.5 };
  const gun = { parent: { remove: () => undefined } };
  const c = {
    type: 'dealer',
    wx: 10,
    wy: 2.5,
    g: { position: { x: 0, y: 0, z: 0 }, rotation: { z: 0 } },
    gun: gun,
    data: { userData: { held: null } },
  };
  gun.parent.remove = () => (gun.parent._n = (gun.parent._n || 0) + 1);
  const out = run(p, [c], c);
  check(
    'the red jagged "POW!" burst at the fist (worker burst style, halfway between the two)',
    out.bubbles.length === 1 && out.bubbles[0].t === 'POW!' && out.bubbles[0].st === 'burst' && out.bubbles[0].x === 9 && out.bubbles[0].y === 2.5
  );
  check("the NPC's squeal (a voice line)", out.said.length === 1);
  check('disarmed: the held item removed from the scene + disposed + c.gun cleared', (gun.parent._n || 0) === 1 && out.disposed === 1 && c.gun === null);
  check(
    'the 5s scare-off armed (c.scareT = 5) + bolting AWAY from the worker (dir = +1, the NPC is on +x)',
    c.scareT === 5 && c.dir === 1
  );
  check('the bonus "mark" drop at his feet (10, 2.5)', out.bonus && out.bonus[0] === 10 && out.bonus[1] === 2.5);
  const c2 = { type: 'cop', wx: 10, wy: 2.5, g: null, gun: null, data: { userData: { held: null } } };
  const out2 = run(p, [], c2); // the target is already gone (not in creatures)
  check(
    'whiff (the attacker already gone): NO burst, NO squeal, NO bonus, no scare-off',
    out2.bubbles.length === 0 && out2.said.length === 0 && out2.bonus === null && !c2.scareT
  );
}

console.log('');
console.log('[6] the hurtNPC hook — the real function in a harness');
{
  const causesLit = src.match(/const PUNCHBACK_CAUSES = \[[\s\S]*?\];/)[0];
  const hn = extract('hurtNPC');
  const dangerHp = 10; // 10% of the 100 pool (the real game: Math.ceil(maxHealth * 0.10))
  function run(amount, cause, p) {
    const out = { marked: null, died: 0 };
    const fn = new Function(
      'state',
      'p',
      '$',
      'SFX',
      'Voice',
      'WORKER_GENDER',
      'startDyingSequence',
      'PUNCHBACK_CAUSES',
      'markPunchback',
      'dangerFlash',
      'dangerBanner',
      'dangerAlarmOn',
      'dangerAlarmOff',
      'out',
      'var health = 20; var lastHitCause = ""; var dangerWarned = false; var DANGER_HP = ' + dangerHp + ';' +
        hn +
        '\nhurtNPC(' +
        amount +
        ', "' +
        cause +
        '"); return { health: health, cause: lastHitCause };'
    );
    const r = fn(
      'play',
      p,
      () => null,
      { playHurtSound: () => undefined, dingDingDing: () => undefined, fireAlarmStart: () => undefined, fireAlarmStop: () => undefined },
      { say: () => undefined },
      'male',
      () => out.died++,
      (causesLit.match(/"(\w+)"/g) || []).map((s) => s.slice(1, -1)),
      (c) => (out.marked = c),
      () => (out.flash = (out.flash || 0) + 1),
      () => (out.banner = (out.banner || 0) + 1),
      () => (out.alarmOn = (out.alarmOn || 0) + 1),
      () => (out.alarmOff = (out.alarmOff || 0) + 1),
      out
    );
    return { r: r, out: out };
  }
  const r1 = run(2, 'dealer', { invuln: 0, immuneT: 0, wx: 0, wy: 2 });
  check('a dealer hit: damage lands (health 20 -> 18) + the 10s window armed (markPunchback("dealer"))', r1.r.health === 18 && r1.out.marked === 'dealer');
  const r2 = run(2, 'route', { invuln: 0, immuneT: 0, wx: 0, wy: 2 });
  check('a "route" (non-NPC) hit: damage lands, but NO punchback window', r2.r.health === 18 && r2.out.marked === null);
  const r3 = run(2, 'dealer', { invuln: 1, immuneT: 0, wx: 0, wy: 2 });
  check('an absorbed hit (i-frames): NO damage, NO window (the early return fires first)', r3.r.health === 20 && r3.out.marked === null);
}

console.log('');
console.log('[7] the scare-off block in updateCreatures + the jab pose in updatePlayer');
{
  const uc = src.slice(src.indexOf('function updateCreatures'), src.indexOf('function updateCreatures') + 400000);
  const scareIdx = uc.indexOf('if (c.scareT > 0) {');
  const switchIdx = uc.indexOf('switch (c.type) {');
  check(
    'the scare-off block sits BEFORE the type switch (it preempts the type AI for those frames)',
    scareIdx >= 0 && switchIdx > scareIdx
  );
  const block = uc.slice(scareIdx, scareIdx + 600);
  check(
    'scare-off: 5s decay, flee at ~7 u/s AWAY from the worker, the walkable band clamp, self position/rotation sync (the continue skips the post-switch sync), legs pump at flee speed',
    /c\.scareT -= dt/.test(block) &&
      /c\.wx \+= \(c\.wx >= p\.wx \? 1 : -1\) \* 7 \* dt/.test(block) &&
      /clamp\(c\.wy, 0\.8, 4\.4\)/.test(block) &&
      /c\.g\.position\.x = c\.wx/.test(block) &&
      /c\.g\.rotation\.z = c\.wx >= p\.wx \? 0 : Math\.PI/.test(block) &&
      /animParts\(c, 7 \* dt \* 2\.2\)/.test(block) &&
      /continue;/.test(block)
  );
  const up = src.slice(src.indexOf('function updatePlayer'));
  check(
    'the jab pose (0.34s): punchT decay + the 0.14s smash frame fires landPunch + the lean (-0.35) + the jab arm extended (-1.9) + the rear arm pulled back (0.5)',
    /if \(p\.punchT > 0\) \{[\s\S]{0,1400}?p\.punchT = Math\.max\(0, p\.punchT - dt\);[\s\S]{0,1400}?landPunch\(p\.punchTarget\);[\s\S]{0,1400}?\-0\.35 \* k;[\s\S]{0,1400}?\-1\.9 \* k;[\s\S]{0,1400}?0\.5 \* k;/.test(up)
  );
  check(
    'the smash frame: punchLandT counts down to 0.14s in (the moment of contact)',
    /p\.punchLandT -= dt;[\s\S]{0,200}?if \(p\.punchLandT <= 0\) landPunch\(p\.punchTarget\);/.test(up)
  );
}

console.log('');
console.log(pass ? 'PUNCHBACK CHECKS PASSED' : 'PUNCHBACK CHECKS FAILED');
process.exit(pass ? 0 : 1);
