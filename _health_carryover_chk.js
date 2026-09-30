// Health carry-over check: the sanitation worker's health does NOT restore at the
// start of the next level - the pain carries over. A Street Cash healer power-up
// (coffee / BEC, spawned at the $5,000 milestone) restores it; so does a write-up
// where the shift continues (the worker comes back FULL).
//   1) resetWorldState (fresh day / new level) no longer refills health,
//   2) finishDying (a write-up, shift continues) DOES refill to FULL health -
//      the worker gets up at maxHealth (the 3rd write-up path returns before
//      the refill, so the run ends down),
//   3) startGame (a brand-new week = a fresh worker) DOES start healthy,
//   4) heal() (power-up) and hurtNPC() (damage) are untouched - heal() is the
//      only restore path, capped at maxHealth.
// Runs the REAL finishDying / startGame extracted from index.html in a harness.
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

console.log('[1] level start: resetWorldState no longer refills health');
{
  const rws = extract('resetWorldState');
  check('resetWorldState has NO health = maxHealth refill', rws.indexOf('health = maxHealth') < 0);
  check(
    'the reset keeps refilling the per-day counters (score / complaints / dayScore / monster + healer milestones)',
    /score = 0;/.test(rws) &&
      /complaints = 0;/.test(rws) &&
      /dayScore = 0;/.test(rws) &&
      /monsterNextAt = MONSTER_SCORE_STEP;/.test(rws) &&
      /healerNextAt = POWERUP_CASH_STEP;/.test(rws),
  );
  const i1 = rws.indexOf('healerNextAt = POWERUP_CASH_STEP');
  const i2 = rws.indexOf('p.wx = PLAYER_START_X');
  const slice = i1 >= 0 && i2 > i1 ? rws.slice(i1, i2) : '';
  check(
    'between the healer-milestone reset and the worker re-anchor there is NO health assignment',
    slice.length > 0 && !/health\s*=\s*maxHealth/.test(slice),
  );
}

console.log('');
console.log('[2] write-up: finishDying refills to FULL health (shift continues)');
{
  const fd = extract('finishDying');
  check('finishDying has the health = maxHealth full refill', /health = maxHealth;/.test(fd));
  check(
    'the 3rd write-up routes to game over BEFORE the refill (return precedes the refill site, so the run ends down)',
    fd.indexOf('gameOver("writeup")') >= 0 &&
      fd.indexOf('return;') > fd.indexOf('gameOver("writeup")') &&
      fd.indexOf('health = maxHealth') > fd.indexOf('return;') &&
      fd.indexOf('p.invuln = 3') > fd.indexOf('return;'),
  );
  check(
    'the get-up block still grants the 3s grace (p.invuln = 3) + state back to "play"',
    /p\.invuln = 3;/.test(fd) && /state = "play";/.test(fd),
  );
}

console.log('');
console.log('[3] fresh week: startGame starts healthy (a new run = a new worker)');
{
  const sg = extract('startGame');
  check(
    'startGame: health = maxHealth sits right after level = START_LEVEL (before showDayIntro)',
    sg.indexOf('level = START_LEVEL') >= 0 &&
      sg.indexOf('health = maxHealth') > sg.indexOf('level = START_LEVEL') &&
      sg.indexOf('health = maxHealth') < sg.indexOf('showDayIntro()'),
  );
  const qg = extract('quitGame');
  check('quitGame (back to the menu) does NOT refill health either', qg.indexOf('health = maxHealth') < 0);
}

console.log('');
console.log('[4] restore path: only heal() (the street-cash healer power-up) restores');
{
  const h = extract('heal');
  check('heal() caps at maxHealth (health = Math.min(maxHealth, health + amount))', /health = Math\.min\(maxHealth, health \+/.test(h));
  const hp = extract('hurtNPC');
  check('hurtNPC() still floors at 0 (health = Math.max(0, health - amount))', /health = Math\.max\(0, health -/.test(hp));
  const assigns = src.match(/\bhealth\s*=[^=][^\n]*/g) || [];
  const resets = assigns.filter((s) => /health\s*=\s*maxHealth/.test(s));
  check(
    'the ONLY `health = maxHealth` sites in the whole file: the startGame fresh-worker refill + the write-up full refill',
    resets.length === 2 &&
      resets.some((r) => r.indexOf('FRESH, healthy worker') >= 0) &&
      resets.some((r) => /write-up/i.test(r)),
  );
  check(
    'the street-cash milestone healer still spawns (coffee / BEC)',
    /let healerNextAt = POWERUP_CASH_STEP;/.test(src) && /Math\.random\(\) < 0\.5 \? "coffee" : "bec"/.test(src),
  );
}

console.log('');
console.log('[5] behavioral: the REAL finishDying / startGame in a harness');
{
  const fd = extract('finishDying');
  function runFinishDying(nWriteUps, startHealth) {
    const out = { died: 0 };
    const fn = new Function(
      'worker',
      'wparts',
      'SFX',
      'Voice',
      'WORKER_GENDER',
      'showWriteUpText',
      'gameOver',
      'updateHUD',
      'GZ',
      'out',
      'var dying = { t: 0 }; var state = "dying";' +
        'var health = ' +
        startHealth +
        '; var maxHealth = 100;' +
        'var p = { stunT: 1, shake: 1, invuln: 0, wx: 5, wy: 2 };' +
        'function addWriteUp() { return ' +
        nWriteUps +
        '; }' +
        fd +
        '\nfinishDying(); return { health: health, state: state, invuln: p.invuln, died: out.died };'
    );
    return fn(
      { group: { quaternion: { identity() {} }, rotation: { set() {} }, position: { set() {} } } },
      {
        legL: { rotation: { set() {} } },
        legR: { rotation: { set() {} } },
        armL: { rotation: { set() {} } },
        armR: { rotation: { set() {} } },
      },
      { playSadTrombone: () => undefined },
      { say: () => undefined },
      'male',
      () => undefined,
      () => (out.died = 1),
      () => undefined,
      0.9,
      out,
    );
  }
  const r1 = runFinishDying(1, 35);
  check(
    'write-up 1/3 at 35 hp: the worker gets up (state "play", 3s grace) FULL health - refilled to 100',
    r1.state === 'play' && r1.invuln === 3 && r1.health === 100 && r1.died === 0,
  );
  const r2 = runFinishDying(2, 0);
  check(
    'write-up 2/3 at 0 hp (fully down): gets up FULL health (100) - the shift continues fresh',
    r2.state === 'play' && r2.invuln === 3 && r2.health === 100 && r2.died === 0,
  );
  const r3 = runFinishDying(3, 0);
  check(
    'write-up 3/3: NO get-up (state stays "dying", no 3s grace) and NO refill - the delayed game over takes over (run ends down)',
    r3.state === 'dying' && r3.invuln === 0 && r3.health === 0,
  );
}
{
  const sg = extract('startGame');
  const out = { introduced: 0 };
  const fn = new Function(
    'worker',
    'SFX',
    'enterLandscapeFullscreen',
    'showDayIntro',
    'out',
    'var _preloading = false; var level = 99; var weekScore = 55; var START_LEVEL = 6;' +
      'var SKIN_TONES = [0x000000];' +
      'var health = 0; var maxHealth = 100;' +
      'var dangerWarned = true; function dangerAlarmOff(){}' +
      sg +
      '\nstartGame();\nreturn { health: health, level: level, weekScore: weekScore, introduced: out.introduced, dangerWarned: dangerWarned };'
  );
  const r = fn(
    null,
    { ensure: () => undefined, ctx: { state: 'running' }, radioStart: () => undefined },
    () => undefined,
    () => (out.introduced = 1),
    out,
  );
  check(
    'startGame: a battered worker (0 hp) starts the FRESH WEEK healthy (100) at the first day, week total reset',
    r.health === 100 && r.level === 6 && r.weekScore === 0 && r.introduced === 1,
  );
  check(
    'startGame: a stale danger flag (warned in the previous run) is re-armed for the fresh week',
    r.dangerWarned === false,
  );
}

console.log('');
console.log(pass ? 'HEALTH CARRY-OVER CHECKS PASSED' : 'HEALTH CARRY-OVER CHECKS FAILED');
process.exit(pass ? 0 : 1);