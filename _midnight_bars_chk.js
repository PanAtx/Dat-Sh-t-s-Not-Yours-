// _midnight_bars_chk.js — THE EARN BARS AND THE EARN AMOUNTS ARE ONE SCALE PER LEVEL.
//
// Extracts the REAL bar / milestone code out of index.html (cashStepNow, scoreStepNow,
// setStartMilestones, armMidnightEarnSpans, checkHealerMilestone, addScoreFlat,
// addStreetCash, updatePowerProgress) and plays a shift on it: the seven weekdays first
// (the shipped law, byte-identical), then MIDNIGHT (level 8), where a healer costs
// NIGHT_POWERUP_CASH_STEP of HELL NOTES and a Red Bull NIGHT_MONSTER_SCORE_STEP of SCORE.
//
// PROVEN: a bar reads its full width on the very frame its power-up lands, the drops land on
// the ACTIVE LEVEL's amounts (5,000 notes on every shift - the night pays the same 5,000 load
// in HELL NOTES - and 30,000 / 120,000 SCORE for the Bull), the night
// shift re-anchors its spans on its own grid at every shift build, and a weekday shift build
// never touches the week's running anchors.
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let pass = true;
const check = (name, ok, extra) => {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok && !extra ? '' : '  [' + extra + ']'));
  if (!ok) pass = false;
};
const num = (n) => parseFloat(html.match(new RegExp('const ' + n + ' = (\\d+)'))[1]);
const CASH_STEP = num('POWERUP_CASH_STEP');
const SCORE_STEP = num('MONSTER_SCORE_STEP');
const NIGHT_CASH_STEP = num('NIGHT_POWERUP_CASH_STEP');
const NIGHT_SCORE_STEP = num('NIGHT_MONSTER_SCORE_STEP');

// ---- [1] the static law --------------------------------------------------------------
check('cashStepNow + scoreStepNow exist', /function cashStepNow\(\)/.test(html) && /function scoreStepNow\(\)/.test(html));
check('the weekday amounts are the shipped 5,000 / 30,000', CASH_STEP === 5000 && SCORE_STEP === 30000, CASH_STEP + '/' + SCORE_STEP);
check('the Midnight amounts are 5,000 NOTES / 120,000 SCORE', NIGHT_CASH_STEP === 5000 && NIGHT_SCORE_STEP === 120000, NIGHT_CASH_STEP + '/' + NIGHT_SCORE_STEP);
check('the night heal costs the SAME load as a weekday heal (paid in HELL NOTES), and stays cheaper than a night of SCORE',
  NIGHT_CASH_STEP === CASH_STEP && NIGHT_CASH_STEP < NIGHT_SCORE_STEP, NIGHT_CASH_STEP + ' vs ' + CASH_STEP + '/' + NIGHT_SCORE_STEP);
check('the healer drop pays the ACTIVE level cash step', /healerNextAt \+= cashStepNow\(\);/.test(html));
check('the Red Bull drop pays the ACTIVE level score step', /monsterNextAt \+= scoreStepNow\(\);/.test(html));
check('the span roll reads the ACTIVE level steps in the bars',
  /while \(bonusTally - healerSpanBase >= cashStep\)/.test(html) && /while \(score - monsterSpanBase >= scoreStep\)/.test(html));
check('MIDNIGHT re-anchors its spans, and ONLY on a night shift',
  /function armMidnightEarnSpans\(\) \{[\s\S]{0,140}isNightShift[\s\S]{0,90}return;/.test(html));
check('the re-arm runs from the per-shift world reset',
  /armMidnightEarnSpans\(\);/.test(html.slice(html.indexOf('function resetWorldState()'), html.indexOf('function resetWorldState()') + 4200)));

// ---- [2] the LIVE sim: the extracted code, driven the way the game drives it ----------
function extract(name) {
  const idx = html.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  let depth = 0, i = html.indexOf('{', idx);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) break;
  }
  return html.slice(idx, i + 1);
}
const FNS = ['cashStepNow', 'scoreStepNow', 'setStartMilestones', 'armMidnightEarnSpans',
  'checkHealerMilestone', 'addScoreFlat', 'addStreetCash', 'updatePowerProgress'].map(extract).join('\n');

function makeSim(night) {
  const els = {
    'pw-heal-bar': { style: {} }, 'pw-bull-bar': { style: {} },
    'pw-heal-fill': { style: {} }, 'pw-bull-fill': { style: {} },
  };
  const box = { heals: 0, bulls: 0 };
  const body =
    'var state="play",score=0,dayScore=0,weekScore=0,bonusTally=0;' +
    'var POWERUP_CASH_STEP=' + CASH_STEP + ',MONSTER_SCORE_STEP=' + SCORE_STEP + ',' +
    'NIGHT_POWERUP_CASH_STEP=' + NIGHT_CASH_STEP + ',NIGHT_MONSTER_SCORE_STEP=' + NIGHT_SCORE_STEP + ';' +
    'var healerNextAt=0,monsterNextAt=0,healerSpanBase=0,monsterSpanBase=0,pwBarsShown=false;' +
    'var lastHeal="",lastBull="";' + FNS +
    'function paint(){ updatePowerProgress(); lastHeal=$("pw-heal-fill").style.width;' +
    '  lastBull=$("pw-bull-fill").style.width; }' +
    'function beginRun(){ setStartMilestones(); paint(); }' +
    'function shiftBuild(){ armMidnightEarnSpans(); paint(); }' +
    'function setTallies(c,s){ bonusTally=c; score=s; paint(); }' +
    'function addCash(n){ addStreetCash(n); paint(); }' +
    'function addPts(n){ addScoreFlat(n,true); paint(); }' +
    'return { beginRun, shiftBuild, setTallies, addCash, addPts, paint,' +
    '  bars: () => [lastHeal, lastBull],' +
    '  anchors: () => ({ healerNextAt: healerNextAt, monsterNextAt: monsterNextAt,' +
    '    healerSpanBase: healerSpanBase, monsterSpanBase: monsterSpanBase }),' +
    '  stats: () => ({ cash: bonusTally, score: score }),' +
    '  drops: () => ({ heals: box.heals, bulls: box.bulls }) };';
  return new Function('$', 'clamp', 'layoutGoalStrip', 'isNightShift', 'scoreMultiplier',
    'spawnHealerNearPlayer', 'spawnMonsterNearPlayer', 'box', body)(
      (id) => els[id], (v, lo, hi) => Math.max(lo, Math.min(hi, v)), () => {},
      () => night, () => 1, () => { box.heals++; }, () => { box.bulls++; }, box);
}
const pct = (v, base, step) => (Math.max(0, Math.min(1, (v - base) / step)) * 100).toFixed(1) + '%';
const grid = (v, step) => Math.floor(v / step) * step;
// ---- [3] THE SEVEN WEEKDAYS + OVERTIME: the shipped law, untouched ------------------
(function () {
  const g = makeSim(false);
  g.beginRun();
  const a0 = g.anchors();
  check('W: a fresh run arms 5,000 cash / 30,000 score with the spans pinned at 0',
    a0.healerNextAt === 5000 && a0.monsterNextAt === 30000 && a0.healerSpanBase === 0 && a0.monsterSpanBase === 0, JSON.stringify(a0));
  check('W: a fresh run paints both bars at 0.0%', g.bars()[0] === '0.0%' && g.bars()[1] === '0.0%', JSON.stringify(g.bars()));
  for (let i = 0; i < 39; i++) g.addCash(1000); // 39,000 notes banked
  const s1 = g.stats(), a1 = g.anchors(), d1 = g.drops();
  check('W: 39,000 notes = 7 healers on the 5,000 cadence, bar at 80.0% of the live span',
    d1.heals === 7 && a1.healerSpanBase === 35000 && a1.healerNextAt === 40000 &&
      g.bars()[0] === '80.0%' && g.bars()[0] === pct(s1.cash, a1.healerSpanBase, CASH_STEP),
    JSON.stringify(d1) + ' ' + JSON.stringify(a1) + ' ' + JSON.stringify(g.bars()));
  g.addCash(1000); // 40,000 - the shipped line
  const a2 = g.anchors();
  check('W: the 8th healer lands exactly at 40,000 (79,000 read 80%+ of the span) and the bar resets to 0.0%',
    g.drops().heals === 8 && g.bars()[0] === '0.0%' && a2.healerNextAt === 45000 && a2.healerSpanBase === 40000,
    JSON.stringify(g.drops()) + ' ' + JSON.stringify(g.bars()));

  const h = makeSim(false); // the BULL axis on its own
  h.beginRun();
  h.addPts(29970);
  const hb = h.bars();
  check('W: 29,970 SCORE reads 99.9% of the 30,000 Bull span with no Bull spawn',
    hb[1] === '99.9%' && h.drops().bulls === 0, JSON.stringify(hb) + ' ' + JSON.stringify(h.drops()));
  h.addPts(30);
  const hc = h.anchors();
  check('W: the Bull lands on the frame the bar fills - 30,000 SCORE, bar 0.0%, next line 60,000',
    h.drops().bulls === 1 && h.bars()[1] === '0.0%' && hc.monsterNextAt === 60000 && hc.monsterSpanBase === 30000,
    JSON.stringify(h.drops()) + ' ' + JSON.stringify(h.bars()));
  check('W: the banked cash grinds healers on the shipped cadence - one milestone per pickup call (5,000 -> 10,000)',
    h.drops().heals === 2 && h.anchors().healerNextAt === 15000, JSON.stringify(h.drops()) + ' ' + JSON.stringify(h.anchors()));

  const k = makeSim(false); // a NEW DAY with the week's tallies carried over
  k.beginRun();
  k.addCash(12000);
  k.addPts(12000);
  const before = k.anchors();
  k.shiftBuild(); // resetWorldState for the next weekday (and OVERTIME): the night guard never fires
  const after = k.anchors();
  check('W: a new shift keeps the running anchors AND spans - nothing is re-based off a weekday',
    JSON.stringify(before) === JSON.stringify(after) && after.healerNextAt === 15000 && after.healerSpanBase === 20000 &&
      after.monsterNextAt === 30000 && after.monsterSpanBase === 0,
    JSON.stringify(before) + ' -> ' + JSON.stringify(after));
  check('W: the carried 24,000 notes / 12,000 SCORE read 80.0% and 40.0% of the weekday spans',
    k.bars()[0] === '80.0%' && k.bars()[1] === '40.0%', JSON.stringify(k.bars()));
})();
// ---- [4] MIDNIGHT: 5,000 HELL NOTES buy a heal, a haunted night of SCORE buys a Bull --
(function () {
  const m = makeSim(true);
  m.beginRun();
  m.setTallies(60000, 90000); // the week walks in with its tallies (SCORE + STREET CASH carry over)
  m.shiftBuild(); // resetWorldState -> armMidnightEarnSpans
  const a = m.anchors(), b = m.bars();
  check('M: the night shift re-anchors both spans on tonight\'s grid - 5,000 NOTES / 120,000 SCORE (60,000 notes -> base 60,000 / next 65,000)',
    a.healerSpanBase === grid(60000, NIGHT_CASH_STEP) && a.healerNextAt === grid(60000, NIGHT_CASH_STEP) + NIGHT_CASH_STEP &&
      a.monsterSpanBase === grid(90000, NIGHT_SCORE_STEP) && a.monsterNextAt === grid(90000, NIGHT_SCORE_STEP) + NIGHT_SCORE_STEP,
    JSON.stringify(a));
  check('M: the bars start on TONIGHT scale - 60,000 sits on a 5,000 line (0.0%) and 90,000 of 120,000 SCORE (75.0%)',
    b[0] === '0.0%' && b[1] === '75.0%', JSON.stringify(b));
  for (let i = 0; i < 9; i++) m.addCash(1000); // 69,000
  check('M: the heal bar spans 5,000 NOTES - 69,000 reads 80.0% with ONE healer banked, Bull bar 75.0%',
    m.drops().heals === 1 && m.bars()[0] === '80.0%' && m.bars()[1] === '75.0%',
    JSON.stringify(m.drops()) + ' ' + JSON.stringify(m.bars()));
  m.addCash(1000); // 70,000
  check('M: a healer every 5,000 of tonight\'s notes - 65,000 and 70,000 both fired, bar 0.0%, next line 75,000',
    m.drops().heals === 2 && m.bars()[0] === '0.0%' && m.anchors().healerNextAt === 75000 && m.anchors().healerSpanBase === 70000,
    JSON.stringify(m.drops()) + ' ' + JSON.stringify(m.bars()));
  for (let i = 0; i < 8; i++) m.addCash(1000); // 78,000
  check('M: 78,000 reads 60.0% of the live 5,000 span, 3 heals deep on 18,000 notes of the night',
    m.drops().heals === 3 && m.bars()[0] === '60.0%', JSON.stringify(m.drops()) + ' ' + JSON.stringify(m.bars()));
  for (let i = 0; i < 2; i++) m.addCash(1000); // 80,000
  check('M: the 80,000 line fires the 4th healer (bar 0.0%, next line 85,000)',
    m.drops().heals === 4 && m.bars()[0] === '0.0%' && m.anchors().healerNextAt === 85000, JSON.stringify(m.anchors()));
  for (let i = 0; i < 11; i++) m.addPts(2500); // 11 heart strikes of the shipped 2,500 purse (SCORE + notes)
  check('M: a whole boss fight (25,000 SCORE) reads 97.9% of the 120,000 Bull span - the can stays a night of SCORE',
    m.drops().bulls === 0 && m.bars()[1] === '97.9%', JSON.stringify(m.bars()) + ' ' + JSON.stringify(m.drops()));
  check('M: the notes the strikes banked keep the heal bar on the 5,000 grid (heals 4-9 on 85k-105k, bar 50.0% at 107,500)',
    m.drops().heals === 9 && m.bars()[0] === '50.0%' && m.anchors().healerNextAt === 110000,
    JSON.stringify(m.drops()) + ' ' + JSON.stringify(m.bars()));
  m.addPts(2500); // 120,000 SCORE / 110,000 notes
  check('M: the Bull lands exactly when its bar fills - 120,000 SCORE, bar 0.0%, next line 240,000',
    m.drops().bulls === 1 && m.bars()[1] === '0.0%' && m.anchors().monsterNextAt === 240000 && m.anchors().monsterSpanBase === 120000,
    JSON.stringify(m.drops()) + ' ' + JSON.stringify(m.bars()));
  check('M: the 110,000th note fires the 10th healer (bar 0.0%, next line 115,000)',
    m.drops().heals === 10 && m.bars()[0] === '0.0%' && m.anchors().healerNextAt === 115000 && m.anchors().healerSpanBase === 110000,
    JSON.stringify(m.drops()) + ' ' + JSON.stringify(m.anchors()));

  const f = makeSim(true); // a CLEAN night boot (the trainer's MIDNIGHT start): the tallies at zero
  f.beginRun();
  f.setTallies(0, 0);
  f.shiftBuild();
  for (let i = 0; i < 4; i++) f.addCash(1000); // 4,000 of notes (40 of the $100 joss bills)
  check('M: on a clean night, 4,000 of the 5,000 notes reads 80.0% with no healer on the street yet',
    f.drops().heals === 0 && f.bars()[0] === '80.0%', JSON.stringify(f.drops()) + ' ' + JSON.stringify(f.bars()));
  f.addCash(1000);
  check('M: 5,000 notes - one full bar - is exactly ONE healer (50 of the $100 joss notes)',
    f.drops().heals === 1 && f.bars()[0] === '0.0%' && f.anchors().healerNextAt === 10000,
    JSON.stringify(f.drops()) + ' ' + JSON.stringify(f.anchors()));

  const r = makeSim(true); // a REPLAYED night: the same law at the shift re-build
  r.beginRun();
  r.setTallies(85000, 125000);
  r.shiftBuild();
  const ra = r.anchors();
  check('M: a replayed night re-anchors on the night grid (85,000 notes -> 0.0% of the next 5,000 line, 125,000 SCORE -> 4.2% of 120,000)',
    ra.healerNextAt === 90000 && ra.healerSpanBase === 85000 && ra.monsterNextAt === 240000 && ra.monsterSpanBase === 120000 &&
      r.bars()[0] === '0.0%' && r.bars()[1] === '4.2%', JSON.stringify(ra) + ' ' + JSON.stringify(r.bars()));

  const w = makeSim(false); // the SAME tallies on a WEEKDAY shift build: never re-anchored
  w.beginRun();
  w.setTallies(60000, 90000);
  w.paint();
  w.shiftBuild();
  const wa = w.anchors();
  check('W: a weekday shift build with the same tallies keeps the shipped cumulative anchors (5,000 / 30,000) — the night grid never applies',
    wa.healerNextAt === 5000 && wa.monsterNextAt === 30000 &&
      wa.healerSpanBase === grid(60000, CASH_STEP) && wa.monsterSpanBase === grid(90000, SCORE_STEP),
    JSON.stringify(wa));
})();

console.log('\n' + (pass ? 'ALL MIDNIGHT BAR CHECKS PASSED' : 'MIDNIGHT BAR CHECKS FAILED'));
process.exit(pass ? 0 : 1);


