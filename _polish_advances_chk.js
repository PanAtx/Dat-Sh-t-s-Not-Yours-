// Polish-advances check (Thursday, Maspeth): the worker bumps a Polish lady
// near her trash -> her little brother STORMS OVER (BUMP-GATED):
//   1) the bump gate in collideCreatures finds the bumped lady (polishLadies)
//      then HER brother (q.sis === pl.pw) and arms him: aggro + hot + a 12s
//      temper (aggroT = 12), cancelling any mid-flee (scareT = 0, scared = false),
//   2) he sprints up (2.6u/s) and lands ONE whack: the over-hand windup ->
//      smash (0.48s) delivers HP_HIT_POLISHBOY (3 - a scared kid, not a street
//      pro) + a stun + a shove + a curse, then BACKS OFF (4s, 1.6u/s) before
//      re-engaging for another; a NEW bump re-arms it,
//   3) the blow's hurtNPC (cause "polishboy") arms the 10s PUNCH window
//      (PUNCHBACK_CAUSES now lists the 13 attack NPCs),
//   4) a landed punchback (landPunch) scares him off: 5s flee (the generic scare
//      block preempts his AI), then the scared-leash walks him away (scaredT = 6s)
//      and the bout is OVER - only a NEW bump re-arms him,
//   5) the 12s temper (aggroT) cools the bout; on expiry he re-roots at his
//      sister's block,
//   6) every lady's curb trash is anchored at her feet (the nearest bag
//      re-anchored, or created if the curb is bare) - always within 2.5u of
//      the lady, on the walkable curb band.
// Runs the REAL polishboy AI case (extracted from index.html) + the real
// hurtNPC / landPunch in a harness.
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
// Extract the polishboy AI case body (brace-matched from the case's own brace);
// the trailing `break;` becomes a `return;` so the body is one AI step.
function extractPolishboyCase() {
  const u = src.indexOf('function updateCreatures(');
  const idx = src.indexOf('case "polishboy":', u);
  if (idx < 0) throw new Error('polishboy case not found in updateCreatures');
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
  const body = src.slice(idx, i + 1);
  if ((body.match(/\bbreak;/g) || []).length < 1)
    throw new Error('expected at least one break; in the polishboy case body');
  return 'switch ("polishboy") { ' + body.replace(/\bbreak;/g, 'return;') + '\n}';
}

console.log('[1] damage constant + source wiring');
{
  check('HP_HIT_POLISHBOY = 3 (the scared-kid whack)', /const HP_HIT_POLISHBOY = 3;/.test(src));
  check(
    '3 sits between the arcade bump (1) and the mack daddy (20)',
    (() => {
      const b = +src.match(/const HP_HIT_BUMPER = (\d+)/)[1];
      const p = +src.match(/const HP_HIT_PIMP = (\d+)/)[1];
      return b < 3 && 3 < p;
    })()
  );
  const causes = src.match(/const PUNCHBACK_CAUSES = \[[\s\S]*?\];/);
  check(
    'PUNCHBACK_CAUSES lists the 13 attack NPCs and includes "polishboy"',
    causes &&
      (causes[0].match(/"\w+"/g) || []).length === 13 &&
      causes[0].indexOf('"polishboy"') >= 0
  );
  check(
    'WRITEUP_REASONS has a polishboy entry',
    (() => {
      const wrS = src.indexOf('const WRITEUP_REASONS = {');
      const REASONS = eval(src.slice(wrS, src.indexOf('};', wrS) + 1).replace('const ', ''));
      return REASONS.polishboy && REASONS.polishboy.length >= 1;
    })()
  );
  const cc = src.slice(src.indexOf('function collideCreatures()'), src.indexOf('function collideCreatures()') + 36000);
  const bi = cc.indexOf('polishLadies.find((e) => e.pw === c)');
  const bump = bi >= 0 ? cc.slice(bi, bi + 900) : '';
  check(
    'the bump gate is PER LADY: it finds the bumped lady (polishLadies.find) then HER brother (q.sis === pl.pw)',
    bump.indexOf('polishLadies.find((e) => e.pw === c)') >= 0 &&
      bump.indexOf('q.type === "polishboy" && q.sis === pl.pw') >= 0
  );
  check(
    'a NEW bump re-arms: cancels mid-flee (scareT = 0, scared = false) + aggro + hot + 12s temper + whack reset',
    bump.indexOf('boy.scareT = 0;') >= 0 &&
      bump.indexOf('boy.scared = false;') >= 0 &&
      bump.indexOf('boy.aggro = true;') >= 0 &&
      bump.indexOf('boy.hot = true;') >= 0 &&
      bump.indexOf('boy.aggroT = 12;') >= 0 &&
      bump.indexOf('boy.punches = 0;') >= 0
  );
  const ai = (() => {
    const u = src.indexOf('function updateCreatures(');
    const i = src.indexOf('case "polishboy":', u);
    return src.slice(i, i + 13000);
  })();
  check(
    'the AI: WALK_UP sprint (2.6) + BACK_OFF (1.6, backoffT) then re-engage (punches reset)',
    ai.indexOf('2.6 * dt') >= 0 && ai.indexOf('c.backoffT > 0') >= 0 && ai.indexOf('1.6 * dt') >= 0
  );
  check(
    'the AI: the Polish opener lands once (saidOpen) + curses while walking up (POLISH_BOY_CURSES)',
    ai.indexOf('c.saidOpen') >= 0 && ai.indexOf('POLISH_BOY_CURSES') >= 0
  );
  check(
    'the AI: ONE whack - over-hand windup -> smash (0.48) delivers HP_HIT_POLISHBOY + stun 0.45 + backoffT = 4',
    ai.indexOf('hurtNPC(HP_HIT_POLISHBOY, "polishboy")') >= 0 &&
      ai.indexOf('doStun(0.45, "hit")') >= 0 &&
      ai.indexOf('c.backoffT = 4') >= 0
  );
  check(
    'the AI: the scared-leash (c.scared) preempts the bout; the temper (aggroT) expiry cools it',
    ai.indexOf('if (c.scared)') >= 0 && ai.indexOf('c.aggroT -= dt') >= 0
  );
  const uc = src.slice(src.indexOf('function updateCreatures'), src.indexOf('function updateCreatures') + 400000);
  check(
    'the generic scare block (the 5s flee) preempts the type AI - a punched boy RUNS',
    uc.indexOf('if (c.scareT > 0) {') >= 0 &&
      uc.indexOf('if (c.scareT > 0) {') < uc.indexOf('switch (c.type) {')
  );
}

console.log('');
console.log('[2] spawn: one lady per active block + the trash anchor at her feet');
{
  const spawn = src.slice(src.indexOf('// Maspeth Polish women'), src.indexOf('he hangs around the corner store'));
  check(
    'ONE lady per active block (the spawn loop walks polishBlocks exactly once)',
    spawn.indexOf('for (const bl of polishBlocks)') >= 0 &&
      (spawn.match(/addCreature\("polish"\)/g) || []).length === 1 &&
      spawn.indexOf('polishLadies.push({ pw: pw, bl: bl });') >= 0
  );
  check(
    'active blocks = garbage blocks x 96..576 (the cemetery block counts too)',
    spawn.indexOf('b.garbage === true') >= 0 &&
      spawn.indexOf('b.x >= 96') >= 0 &&
      spawn.indexOf('b.x <= 576') >= 0
  );
  const LEVEL_BLOCKS = [
    { x: 0, garbage: false },
    { x: 96, garbage: true },
    { x: 192, garbage: true },
    { x: 288, garbage: true },
    { x: 384, garbage: true },
    { x: 480, garbage: true },
    { x: 576, garbage: true },
    { x: 672, garbage: false },
  ];
  const active = LEVEL_BLOCKS.filter((b) => b.garbage === true && b.x >= 96 && b.x <= 576);
  check('6 active blocks -> 6 Polish ladies (one each)', active.length === 6);
  check(
    'the anchor pass: nearest curb bag re-anchored (position + mesh) or a fresh makeCurbBag, on the curb band',
    src.indexOf('best.g.position.x = tx;') >= 0 &&
      src.indexOf('best.g.position.y = ty;') >= 0 &&
      src.indexOf('makeCurbBag(tx, ty, cells[0].house);') >= 0 &&
      src.indexOf('const tx = pw.wx + R(-1.0, 1.0);') >= 0 &&
      src.indexOf('const ty = clamp(pw.wy - R(1.0, 1.8), 0.7, 4.8);') >= 0
  );
  // The anchor pass, mirrored with the deterministic R (R(a,b) = (a+b)/2)
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const detR = (a, b) => (a + b) / 2;
  function anchorPass(pw, blocks) {
    const cells = blocks.filter((b) => b.house && b.house.bags && b.blockX === pw.blX);
    let best = null,
      bestD = Infinity;
    for (const cl of cells) {
      for (const bag of cl.house.bags) {
        if (bag.state !== 'curb') continue;
        const bd = Math.hypot(bag.wx - pw.wx, bag.wy - pw.wy);
        if (bd < bestD) {
          bestD = bd;
          best = bag;
        }
      }
    }
    const tx = pw.wx + detR(-1.0, 1.0);
    const ty = clamp(pw.wy - detR(1.0, 1.8), 0.7, 4.8);
    if (best) {
      best.wx = tx;
      best.wy = ty;
    } else if (cells.length) {
      cells[0].house.bags.push({ state: 'curb', wx: tx, wy: ty });
    }
    return best || (cells.length ? cells[0].house.bags[cells[0].house.bags.length - 1] : null);
  }
  const mkBlock = (x, bags) => [{ blockX: x, house: { bags: bags.map((b) => ({ state: 'curb', wx: b[0], wy: b[1] })) } }];
  const r1 = anchorPass({ wx: 200, wy: 2.0, blX: 192 }, mkBlock(192, [[205, 1.5]]));
  check(
    'a sidewalk lady (y 2.0): the re-anchored bag lands on the curb band within 2.5u of her',
    r1 && Math.abs(r1.wx - 200) <= 1.0 && r1.wy >= 0.7 && r1.wy <= 4.8 && Math.hypot(r1.wx - 200, r1.wy - 2.0) < 2.5
  );
  const blk2 = mkBlock(192, []);
  const r2 = anchorPass({ wx: 210, wy: 6.5, blX: 192 }, blk2);
  check(
    'a lawn lady (y 6.5) on a bare curb: a fresh bag is created at her feet (within 2.5u, on the band)',
    r2 && blk2[0].house.bags.length === 1 && r2.wy >= 0.7 && r2.wy <= 4.8 && Math.hypot(r2.wx - 210, r2.wy - 6.5) < 2.5
  );
  const blk3 = [{ blockX: 384, house: null }]; // the cemetery block: no house
  let cemOk = true;
  try {
    const r3 = anchorPass({ wx: 390, wy: 3.0, blX: 384 }, blk3);
    cemOk = r3 === null;
  } catch (e) {
    cemOk = false;
  }
  check('a cemetery-block lady: nothing to anchor (no house) - no crash, no bag created', cemOk);
  // Randomized: 2000 ladies across the full spawn band (sidewalk 1.4..4.2, lawn 5..7)
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  let worst = 0,
    bandOk = true;
  for (let i = 0; i < 2000; i++) {
    const onLawn = rnd() < 0.5;
    const wy = onLawn ? 5.0 + rnd() * 2.0 : 1.4 + rnd() * 2.8;
    const wx = 96 + rnd() * 480;
    const blk = mkBlock(96, [[wx + 10, 2.0]]);
    const bag = anchorPass({ wx: wx, wy: wy, blX: 96 }, blk);
    const d = Math.hypot(bag.wx - wx, bag.wy - wy);
    worst = Math.max(worst, d);
    if (bag.wy < 0.7 || bag.wy > 4.8) bandOk = false;
  }
  check(
    '2000 randomized ladies: the bag is ALWAYS within 2.5u of her and on the curb band (worst ' + worst.toFixed(2) + 'u)',
    worst < 2.5 && bandOk
  );
}

console.log('');
console.log('[3] the bump-gated bout - the REAL polishboy AI case in a harness');
{
  const ai = extractPolishboyCase();
  function step(c, p, dt, out) {
    const fn = new Function(
      'c',
      'p',
      'dt',
      'state',
      'clamp',
      'R',
      'pick',
      'Voice',
      'SFX',
      'animParts',
      'hurtNPC',
      'doStun',
      'workerMaxY',
      'POLISH_BOY_CURSES',
      'POLISH_BOY_OPEN',
      'HP_HIT_POLISHBOY',
      ai
    );
    fn(
      c,
      p,
      dt,
      'play',
      (v, a, b) => Math.min(b, Math.max(a, v)),
      (a, b) => (a + b) / 2,
      (a) => a[0],
      { say: (t) => out.said.push(t) },
      { playHurtSound: () => out.sfx++ },
      () => {},
      (d, cause) => out.hits.push({ d: d, cause: cause }),
      () => out.stuns++,
      () => 9,
      ['Odstap od mojej siostry!'],
      ['You speak my sister?'],
      3
    );
  }
  function mkBoy() {
    return {
      type: 'polishboy',
      wx: 1.0, // at the worker (|dx| <= 1.8) so the at-worker branch runs
      wy: 2.5,
      loiter: { minX: 0, maxX: 4, dir: 1 },
      aggro: true,
      hot: true,
      aggroT: 12,
      punches: 0,
      punchCd: 0,
      sayCd: 99, // silence the ambient cursing (the hit lines still land)
      swinging: false,
      swingT: 0,
      swingHitDone: false,
      backoffT: 0,
      saidOpen: false,
      scared: false,
      scaredT: 0,
      cd: 0,
      gender: 'male',
      parts: { armR: { rotation: { y: 0 } }, upper: { rotation: { y: 0 } } },
      g: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    };
  }
  const out = { hits: [], stuns: 0, said: [], sfx: 0 };
  const c = mkBoy();
  const p = { wx: 0, wy: 2.5, invuln: 0, immuneT: 0 };
  for (let i = 0; i < 40; i++) step(c, p, 1 / 60, out); // ~0.67s: already at range -> one whack
  check(
    'ONE whack per engagement: the over-hand windup -> smash (0.48s) lands EXACTLY 1 (HP 3, cause "polishboy")',
    out.hits.length === 1 && out.hits[0].d === 3 && out.hits[0].cause === 'polishboy'
  );
  check(
    'the whack: a stun (0.45s), the hurt SFX, a shove of the worker + a Polish curse, then BACK_OFF (backoffT > 0) + punches = 1',
    out.stuns === 1 && out.sfx === 1 && p.wx < -0.2 && c.backoffT > 0 && c.punches === 1
  );
  const out2 = { hits: [], stuns: 0, said: [], sfx: 0 };
  c.punchCd = 99;
  c.backoffT = 0.03; // one step past the end of the 4s backoff
  step(c, p, 1 / 30, out2);
  check(
    'BACK_OFF ends -> RE-ENGAGE: punches reset + punchCd re-armed (0.8) - ready for another whack',
    c.punches === 0 && Math.abs(c.punchCd - 0.8) < 0.001
  );
  const out3 = { hits: [], stuns: 0, said: [], sfx: 0 };
  c.wx = 1.0;
  c.punchCd = 0;
  c.saidOpen = false;
  c.punches = 0;
  c.swinging = false;
  c.swingT = 0;
  c.swingHitDone = false;
  c.backoffT = 0;
  for (let i = 0; i < 40; i++) step(c, p, 1 / 60, out3);
  check('the re-engage whack lands (the bout repeats until the temper cools)', out3.hits.length === 1 && out3.hits[0].cause === 'polishboy');
  const out4 = { hits: [], stuns: 0, said: [], sfx: 0 };
  const c4 = mkBoy();
  const p4 = { wx: 0, wy: 2.5, invuln: 99, immuneT: 0 }; // i-frames
  for (let i = 0; i < 180; i++) step(c4, p4, 1 / 60, out4);
  check('i-frames (p.invuln): NO whack lands (the windup never even arms)', out4.hits.length === 0 && !c4.swinging);
  const out5 = { hits: [], stuns: 0, said: [], sfx: 0 };
  const c5 = mkBoy();
  c5.aggroT = 0.02;
  c5.punches = 1;
  c5.backoffT = 0;
  const p5 = { wx: 0, wy: 2.5, invuln: 0, immuneT: 0 };
  step(c5, p5, 1 / 30, out5);
  check('the temper cools (aggroT expires): the bout ends - aggro/hot cleared + punches reset', c5.aggro === false && c5.hot === false && c5.punches === 0);
  const out6 = { hits: [], stuns: 0, said: [], sfx: 0 };
  const c6 = mkBoy();
  c6.scared = true;
  c6.scaredT = 2;
  c6.aggro = true;
  c6.punches = 1;
  const p6 = { wx: 1.0, wy: 2.5, invuln: 0, immuneT: 0 };
  step(c6, p6, 1 / 30, out6);
  check('the scared-leash (c.scared) preempts the bout: he is leashed away (scaredT decays) - no whack', c6.scaredT < 2 && out6.hits.length === 0);
}

console.log('');
console.log('[4] the punchback - the REAL hurtNPC / landPunch in a harness');
{
  const causesLit = src.match(/const PUNCHBACK_CAUSES = \[[\s\S]*?\];/)[0];
  const hn = extract('hurtNPC');
  const dangerHp = 10;
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
      () => {},
      () => {},
      () => {},
      () => {},
      out
    );
    return { r: r, out: out };
  }
  const r1 = run(3, 'polishboy', { invuln: 0, immuneT: 0, wx: 0, wy: 2 });
  check(
    'a whack from the brother (cause "polishboy", 3 HP): damage lands (20 -> 17) + the 10s punch window is armed',
    r1.r.health === 17 && r1.out.marked === 'polishboy'
  );
  const lp = extract('landPunch');
  const outL = { bubbles: [], said: [], disposed: 0, bonus: null };
  const c = {
    type: 'polishboy',
    wx: 10,
    wy: 2.5,
    g: { position: { x: 0, y: 0, z: 0 }, rotation: { z: 0 } },
    gun: null,
    data: { userData: { held: null } },
  };
  const fnL = new Function(
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
  fnL(
    { wx: 8, wy: 2.5 },
    [c],
    c,
    (t, x, y, s, st) => outL.bubbles.push({ t: t, st: st }),
    (a) => a[0],
    { say: (t) => outL.said.push(t) },
    () => outL.disposed++,
    (x, y) => (outL.bonus = [x, y])
  );
  check(
    'a landed punchback on the brother: the "POW!" burst + his squeal + the 5s scare-off (flee at ~7 u/s, away from the worker) + the bonus mark at his feet',
    outL.bubbles.length === 1 &&
      outL.bubbles[0].t === 'POW!' &&
      outL.said.length === 1 &&
      c.scareT === 5 &&
      c.dir === 1 &&
      outL.bonus &&
      outL.bonus[0] === 10 &&
      outL.bonus[1] === 2.5
  );
}

console.log('');
console.log(pass ? 'POLISH-ADVANCES CHECKS PASSED' : 'POLISH-ADVANCES CHECKS FAILED');
process.exit(pass ? 0 : 1);