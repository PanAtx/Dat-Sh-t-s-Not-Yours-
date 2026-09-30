// Health carry-over check: the sanitation worker's health does NOT restore at the
// start of the next level - the pain carries over. A Street Cash healer power-up
// (coffee / BEC, spawned at the $5,000 milestone) restores it; so does a write-up
// where the shift continues (the worker comes back FULL).
// SCORE + STREET CASH carry-over check too: the HUD score and the street-cash
// tally (and the power-up milestones that ride on them) do NOT reset to 0 at a
// level restart or a level completion - only startGame (a brand-new run) zeroes
// them.
//   1) resetWorldState (fresh day / new level) no longer refills health and
//      no longer zeroes score / street cash / the milestones,
//   2) finishDying (a write-up, shift continues) DOES refill to FULL health -
//      the worker gets up at maxHealth (the 3rd write-up path returns before
//      the refill, so the run ends down),
//   3) startGame (a brand-new week = a fresh worker) DOES start healthy and
//      zeroes score / street cash / weekScore / the milestones,
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
    'the reset keeps refilling ONLY the per-day report counters (complaints / dayScore)',
    /complaints = 0;/.test(rws) && /dayScore = 0;/.test(rws),
  );
  check(
    'score / street cash / the power-up milestones CARRY OVER across days (no score = 0, bonusTally = 0 or milestone reset in resetWorldState)',
    !/(^|\s)score = 0;/.test(rws) &&
      !/bonusTally = 0;/.test(rws) &&
      !/monsterNextAt = MONSTER_SCORE_STEP;/.test(rws) &&
      !/healerNextAt = POWERUP_CASH_STEP;/.test(rws),
  );
  const i1 = rws.indexOf('dayScore = 0;');
  const i2 = rws.indexOf('p.wx = PLAYER_START_X');
  const slice = i1 >= 0 && i2 > i1 ? rws.slice(i1, i2) : '';
  check(
    'between the dayScore reset and the worker re-anchor there is NO health assignment',
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
      fd.indexOf('p.invuln = WRITEUP_RECOVERY_INVULN') > fd.indexOf('return;'),
  );
  check(
    'the get-up block grants recovery i-frames (p.invuln = WRITEUP_RECOVERY_INVULN) + state back to "play"',
    /p\.invuln = WRITEUP_RECOVERY_INVULN;/.test(fd) && /state = "play";/.test(fd),
  );
  const wm = src.match(/const WRITEUP_RECOVERY_INVULN = ([\d.]+);/);
  check(
    'the recovery i-frames outlast the 5s WRITTEN UP stamp (untouchable a bit AFTER it fades)',
    wm && parseFloat(wm[1]) >= 5 + 1,
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
  check(
    'startGame: a brand-new run zeroes the carried-over tallies (score / bonusTally / weekScore) + resets the power-up milestones (before showDayIntro)',
    sg.indexOf('weekScore = 0') >= 0 &&
      sg.indexOf('score = 0') > sg.indexOf('weekScore = 0') &&
      sg.indexOf('bonusTally = 0') > sg.indexOf('score = 0') &&
      sg.indexOf('monsterNextAt = MONSTER_SCORE_STEP') > sg.indexOf('bonusTally = 0') &&
      sg.indexOf('healerNextAt = POWERUP_CASH_STEP') > sg.indexOf('monsterNextAt = MONSTER_SCORE_STEP') &&
      sg.indexOf('healerNextAt = POWERUP_CASH_STEP') < sg.indexOf('showDayIntro()'),
  );
  const qg = extract('quitGame');
  check('quitGame (back to the menu) does NOT refill health either', qg.indexOf('health = maxHealth') < 0);
  check(
    'quitGame (back to the menu) zeroes the tallies + milestones too (the next start is a fresh run)',
    qg.indexOf('score = 0') >= 0 &&
      qg.indexOf('bonusTally = 0') >= 0 &&
      qg.indexOf('monsterNextAt = MONSTER_SCORE_STEP') >= 0 &&
      qg.indexOf('healerNextAt = POWERUP_CASH_STEP') >= 0,
  );
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
  const wmv = src.match(/const WRITEUP_RECOVERY_INVULN = ([\d.]+);/)[1];
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
      'var WRITEUP_RECOVERY_INVULN = ' + wmv + ';' +
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
    'write-up 1/3 at 35 hp: the worker gets up (state "play", recovery grace outlasting the 5s stamp) FULL health - refilled to 100',
    r1.state === 'play' && r1.invuln === parseFloat(wmv) && r1.health === 100 && r1.died === 0,
  );
  const r2 = runFinishDying(2, 0);
  check(
    'write-up 2/3 at 0 hp (fully down): gets up FULL health (100) - the shift continues fresh',
    r2.state === 'play' && r2.invuln === parseFloat(wmv) && r2.health === 100 && r2.died === 0,
  );
  const r3 = runFinishDying(3, 0);
  check(
    'write-up 3/3: NO get-up (state stays "dying", no recovery grace) and NO refill - the delayed game over takes over (run ends down)',
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
      'var score = 424242; var bonusTally = 555555; var monsterNextAt = 999999; var healerNextAt = 987654;' +
      'var MONSTER_SCORE_STEP = 30000; var POWERUP_CASH_STEP = 5000;' +
      'var SKIN_TONES = [0x000000];' +
      'var health = 0; var maxHealth = 100;' +
      'var dangerWarned = true; function dangerAlarmOff(){}' +
      sg +
      '\nstartGame();\nreturn { health: health, level: level, weekScore: weekScore, score: score, bonusTally: bonusTally, monsterNextAt: monsterNextAt, healerNextAt: healerNextAt, introduced: out.introduced, dangerWarned: dangerWarned };'
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
    'startGame: a carried-over run (score 424242 / street cash 555555 / stale milestones) is ZEROED for the fresh week - the tallies start at 0 and the milestones back at the first step (30000 / 5000)',
    r.score === 0 && r.bonusTally === 0 && r.monsterNextAt === 30000 && r.healerNextAt === 5000,
  );
  check(
    'startGame: a stale danger flag (warned in the previous run) is re-armed for the fresh week',
    r.dangerWarned === false,
  );
}

console.log('');
console.log(pass ? 'HEALTH CARRY-OVER CHECKS PASSED' : 'HEALTH CARRY-OVER CHECKS FAILED');
process.exit(pass ? 0 : 1);