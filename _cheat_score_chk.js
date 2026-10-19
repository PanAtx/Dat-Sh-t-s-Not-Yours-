// THE CHEAT LAW - the HI-SCORE is the honest run's medal. Run: node _cheat_score_chk.js
/* ============================================================================
   Every cheat lives in the hidden TRAINER (tap the build number on the menu). The law:
     1) THE LEDGER: engaging any trainer cheat flags THIS RUN for good - switching the cheat
        off later is too late. The flag rides in localStorage ("dsnysweep_cheat"), so
        refreshing mid-shift cannot launder a cheated score, and only a brand-new week
        (startGame) or quitting to the menu (quitGame) re-opens the ledger.
     2) A flagged run NEVER writes dsnysweep_hi: commitHighScore() is the single banking path
        and all three end screens (routeComplete / showWeekComplete / gameOver) use it, with
        the verbatim legacy path in the `else` branch for the harnesses that execute those
        functions with only the score module in scope (_ending_screens_chk.js).
     3) A flagged run prints its HI-SCORE line CROSSED OUT (.score.hi-cross) under a
        "NO CHEATING! - CHEATS IN USE - HI-SCORE NOT SAVED" stamp (.no-cheat: #over-cheat /
        #complete-cheat / #week-cheat) and never lights NEW HIGH SCORE!. The mark appears
        ONLY on a panel that prints a HI-SCORE - never on the day card, the shift report
        grid, or the HUD.
     4) THE STREET'S OWN LAW IS HARD, AND THE TRAINER CANNOT TOUCH IT: every screw-up is a
        WRITE-UP - a worker DOWN in the street AND a route left dirty at the end-of-shift
        inspection. The meter counts 1, 2, 3 and the 3rd write-up is GAME OVER. The counter
        never climbs past 3 (no "4/3" seal exists - the shift ends on the 3rd strike), no
        toggle removes a strike and none buys a 4th: a cheat only voids the HI-SCORE.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
let ok = true, n = 0;
function check(name, cond, got) {
  n++;
  if (cond) console.log('PASS  ' + name);
  else { ok = false; console.log('FAIL  ' + name + (got !== undefined ? '  [' + got + ']' : '')); }
}
const count = (re) => (src.match(new RegExp(re.source, 'g')) || []).length;
function fnBody(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function ' + name + ' not found in index.html');
  let depth = 0, q = null;
  const open = src.indexOf('{', i);
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (src.startsWith('/*', j)) { j = src.indexOf('*/', j) + 1; continue; }
    if (src.startsWith('//', j)) { j = src.indexOf('\n', j); continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  throw new Error('unbalanced braces reading ' + name);
}
const mkEl = (id, parent) => {
  const set = new Set();
  return {
    id: id, textContent: '', parentElement: parent || null, _set: set, style: {},
    classList: {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      contains: (c) => set.has(c),
      toggle: (c, on) => (on === undefined ? (set.has(c) ? set.delete(c) : set.add(c)) : on ? set.add(c) : set.delete(c)),
    },
  };
};
// THE LEDGER REGION, sliced verbatim out of index.html (the sticky flag, its stored writes,
// the live-cheat probe, the banking path and the panel mark).
const LEDGER_A = src.indexOf('let hi = 0;');
const LEDGER_B = src.indexOf('// ==================== 7-DAY LEVEL SYSTEM');
const ledgerCode = src.slice(LEDGER_A, LEDGER_B);
function makeDesk(o) {
  o = o || {};
  const store = Object.assign({}, o.store); // a SHARED store = the same browser, next visit
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const overLine = mkEl('over-score-line');
  const weekLine = mkEl('week-score-line');
  const routeLine = mkEl('route-score-line');
  const els = {
    hiscore2: mkEl('hiscore2', overLine),
    'over-cheat': mkEl('over-cheat'),
    'over-newhi': mkEl('over-newhi'),
    'week-hi': mkEl('week-hi', weekLine),
    'week-cheat': mkEl('week-cheat'),
    'week-newhi': mkEl('week-newhi'),
    hiscore3: mkEl('hiscore3', routeLine),
    'complete-cheat': mkEl('complete-cheat'),
  };
  const $ = (id) => (els[id] = els[id] || mkEl(id));
  const document = { getElementById: (id) => (id && els[id] ? els[id] : null) };
  const CHEAT = Object.assign({ infinite: false, invincible: false, runitup: false, startLevel: 1 }, o.cheat);
  const api = new Function(
    'localStorage', '$', 'document', 'weekScore', 'CHEAT', 'START_LEVEL', 'overLine', 'weekLine', 'routeLine', 'els',
    ledgerCode +
      '\nreturn {' +
      ' used: function () { return cheatUsed(); },' +
      ' live: function () { return cheatLive(); },' +
      ' markIt: function () { markCheatUsed(); return cheatUsed(); },' +
      ' clearIt: function () { clearCheatUsed(); return cheatUsed(); },' +
      ' commit: function () { return commitHighScore(); },' +
      ' mark: function (b, s, r) { return cheatMark(b, s, r); },' +
      ' sc: function (v) { weekScore = v; return weekScore; },' +
      ' line: function (w) { return w === "week" ? weekLine : w === "route" ? routeLine : overLine; },' +
      ' get hi() { return hi; }, set hi(v) { hi = v; },' +
      ' CHEAT: CHEAT,' +
      ' };',
  )(localStorage, $, document, o.weekScore || 0, CHEAT, o.START_LEVEL === undefined ? 1 : o.START_LEVEL, overLine, weekLine, routeLine, els);
  return { api: api, store: store, els: els };
}
console.log('');
console.log('[1] THE LEDGER - the real page code, extracted VERBATIM and run live');
check('the ledger region carries the flag, the probe, the banking path and the panel mark',
  ledgerCode.includes('function markCheatUsed()') &&
    ledgerCode.includes('function clearCheatUsed()') &&
    ledgerCode.includes('function cheatLive()') &&
    ledgerCode.includes('function commitHighScore()') &&
    ledgerCode.includes('function cheatMark(') &&
    !ledgerCode.includes('function updateCheatHud()'),
  'region=' + ledgerCode.length + ' chars');
{
  const d = makeDesk({ store: { dsnysweep_hi: '500' }, weekScore: 4200 });
  check('no cheat engaged -> the ledger is clean', d.api.used() === false && d.api.live() === false);
  d.api.mark('over-cheat', 'hiscore2', 'over-newhi');
  check('a clean week paints NO "NO CHEATING!" stamp, NO strike and keeps its ribbon alive',
    d.els['over-cheat']._set.has('hidden') && !d.api.line()._set.has('hi-cross') && !d.els['over-newhi']._set.has('hidden'));
  check('a CLEAN week banks its record (hi + dsnysweep_hi)',
    d.api.commit() === true && d.api.hi === 4200 && d.store['dsnysweep_hi'] === '4200',
    'hi=' + d.api.hi + ' store=' + d.store['dsnysweep_hi']);
  d.api.sc(100);
  check('a week below the record leaves the record alone',
    d.api.commit() === false && d.api.hi === 4200 && d.store['dsnysweep_hi'] === '4200');
}
{
  const d = makeDesk({ store: { dsnysweep_hi: '500' }, weekScore: 99000 });
  d.api.CHEAT.runitup = true;
  check('a trainer toggle ON is a LIVE cheat (cheatLive)', d.api.live() === true);
  check('engaging it flags the run', d.api.markIt() === true && d.api.used() === true);
  check('the flag is PERSISTED (a reload mid-shift stays flagged)', d.store['dsnysweep_cheat'] === '1');
  check('switching the cheat OFF later does NOT un-flag the week (too late)',
    (d.api.CHEAT.runitup = false, d.api.live() === false && d.api.used() === true));
  check('a CHEATED week NEVER banks its score (the record on disk stays the honest one)',
    d.api.commit() === false && d.api.hi === 500 && d.store['dsnysweep_hi'] === '500',
    'hi=' + d.api.hi + ' store=' + d.store['dsnysweep_hi']);
  check('THE MARK: the "NO CHEATING!" stamp is stamped on the SUSPENDED screen',
    d.api.mark('over-cheat', 'hiscore2', 'over-newhi') === true && !d.els['over-cheat']._set.has('hidden'));
  check('THE MARK: its HI-SCORE line is CROSSED OUT (.hi-cross on the .score line)', d.api.line()._set.has('hi-cross'));
  check('THE MARK: the NEW HIGH SCORE! ribbon is killed', d.els['over-newhi']._set.has('hidden'));
  check('THE MARK: YOU WIN carries the same law (stamp + struck BEST SHIFT line + dead ribbon)',
    (d.api.mark('week-cheat', 'week-hi', 'week-newhi'),
      !d.els['week-cheat']._set.has('hidden') && d.api.line('week')._set.has('hi-cross') && d.els['week-newhi']._set.has('hidden')));
  check('THE MARK: the ROUTE COMPLETE report carries it too (stamp + struck HI-SCORE line)',
    (d.api.mark('complete-cheat', 'hiscore3', null),
      !d.els['complete-cheat']._set.has('hidden') && d.api.line('route')._set.has('hi-cross')));
  check('a brand-new week RE-OPENS the ledger (the stored flag is wiped)',
    d.api.clearIt() === false && d.store['dsnysweep_cheat'] === undefined);
  check('the re-opened week is eligible again (it banks its record)',
    (d.api.sc(99000), d.api.commit() === true && d.store['dsnysweep_hi'] === '99000'));
}

{
  const first = makeDesk({ store: { dsnysweep_hi: '50' }, weekScore: 700 });
  first.api.CHEAT.invincible = true;
  first.api.markIt();
  const reload = makeDesk({ store: Object.assign({}, first.store), weekScore: 700 });
  check('A RELOAD mid-shift inherits the flag (a refresh cannot launder the score)',
    reload.api.used() === true && reload.api.commit() === false && reload.store['dsnysweep_hi'] === '50');
  check('A RELOAD mid-shift still paints the struck HI-SCORE line + the stamp',
    reload.api.mark('over-cheat', 'hiscore2', 'over-newhi') === true && reload.api.line()._set.has('hi-cross'));
  const panel = makeDesk({ weekScore: 1000, cheat: { startLevel: 8 }, START_LEVEL: 1 });
  check('a trainer STARTING LEVEL that is not the week start is a LIVE cheat', panel.api.live() === true);
  const plain = makeDesk({ weekScore: 1000, cheat: { startLevel: 1 }, START_LEVEL: 1 });
  check("the panel default (the real week start) is NOT a cheat - a plain week stays eligible",
    plain.api.live() === false && plain.api.commit() === true);
  const night = makeDesk({ weekScore: 1000, cheat: { startLevel: 8 }, START_LEVEL: 8 });
  check('a build configured to start at MIDNIGHT keeps that week eligible (the panel follows START_LEVEL)',
    night.api.live() === false);
}
console.log('');
console.log('[2] EVERY CHEAT PATH FLAGS THE RUN');
{
  const gb = src.indexOf('p.god = typeof CHEAT !== "undefined"');
  const ge = src.indexOf('markCheatUsed();', gb);
  check('the play frame flags the run when a trainer cheat is engaged', gb > 0 && ge > gb);
  const frame = src.slice(gb, ge + 'markCheatUsed();'.length).replace(/^\s*\/\/.*$/gm, '');
  let flagged = 0;
  const runFrame = new Function('p', 'CHEAT', 'POWERUP_IMMUNE_DUR', 'markCheatUsed', frame);
  const cheatFrame = (c) => {
    const p = { immuneT: 0, god: false, attackerT: 1 };
    runFrame(p, c, 12, () => { flagged++; });
    return p;
  };
  cheatFrame({ invincible: true, runitup: false, infinite: false });
  check('INFINITE HEALTH engaged -> the frame flags the run', flagged === 1, 'flagged=' + flagged);
  cheatFrame({ invincible: false, runitup: true, infinite: false });
  check('ALWAYS RUN IT UP engaged -> the frame flags the run', flagged === 2, 'flagged=' + flagged);
  cheatFrame({ invincible: false, runitup: false, infinite: true });
  check('INFINITE COMPLAINTS engaged -> the frame flags the run (all three toggles)', flagged === 3, 'flagged=' + flagged);
  const clean = cheatFrame({ invincible: false, runitup: false, infinite: false });
  check('no cheat engaged -> no flag, and the worker is hurt like anyone else',
    flagged === 3 && clean.god === false && clean.immuneT === 0, 'flagged=' + flagged + ' god=' + clean.god);
  check('the ledger hook sits BELOW the p.god / p.immuneT lines, so _cheat_god_chk.js keeps its verbatim block',
    src.slice(gb, src.indexOf('p.immuneT = POWERUP_IMMUNE_DUR;', gb)).indexOf('markCheatUsed') < 0);
  const wu = fnBody('applyRouteWriteUp');
  check('applyRouteWriteUp suspends the shift on the 3rd write-up - NO trainer bypass',
    /if \(n >= 3\) \{[\s\S]{0,400}gameOver\("writeup"\)/.test(wu) &&
      !/CHEAT\.infinite/.test(wu));
  const tc = fnBody('trainerChange'), ta = fnBody('trainerAction'), ts = fnBody('trainerStart');
  check('the panel row control (D-pad / gamepad / stick) flags the run it toggles', /cheatLive\(\)[\s\S]{0,60}markCheatUsed\(\);/.test(tc));
  check('the panel ACT key (Enter / Space) flags the run it toggles', /cheatLive\(\)[\s\S]{0,60}markCheatUsed\(\);/.test(ta));
  check('the panel START GAME flags the week it fires', /cheatLive\(\)[\s\S]{0,60}markCheatUsed\(\);/.test(ts));
  const sg = fnBody('startGame'), qg = fnBody('quitGame');
  check('startGame RE-OPENS the ledger (a brand-new week is eligible again)', /clearCheatUsed\(\);/.test(sg));
  check('startGame flags a panel level jump (the week that starts off the trainer is unranked)',
    /level !== START_LEVEL[\s\S]{0,120}markCheatUsed\(\);/.test(sg));
  check('quitGame re-opens the ledger (an abandoned week is over)', /clearCheatUsed\(\);/.test(qg));
  check('cheatLive() covers every toggle (infinite / invincible / runitup)',
    /CHEAT\.infinite === true \|\| CHEAT\.invincible === true \|\| CHEAT\.runitup === true/.test(ledgerCode));
}

console.log('');
console.log('[3] THE LEDGER IS THE ONLY PATH TO dsnysweep_hi (all three end screens)');
{
  check('every HI-SCORE write runs the ledger first (3 guarded sites)',
    count(/typeof commitHighScore === "function"\) commitHighScore\(\)/) === 3,
    'sites=' + count(/typeof commitHighScore === "function"\) commitHighScore\(\)/));
  check('commitHighScore guards the ledger before anything else',
    /function commitHighScore\(\) \{[\s\S]{0,80}if \(cheatUsed\(\)\) return false;/.test(src));
  check('dsnysweep_hi is written from exactly 4 places (the ledger + the 3 sandbox fallbacks)',
    count(/setItem\("dsnysweep_hi"/) === 4, 'writes=' + count(/setItem\("dsnysweep_hi"/));
  for (const fn of ['routeComplete', 'showWeekComplete', 'gameOver']) {
    const body = fnBody(fn);
    check(fn + '() banks through the ledger, and keeps the verbatim legacy path for the harnesses',
      /typeof commitHighScore === "function"\) commitHighScore\(\)/.test(body) &&
        /else if \(weekScore > hi\)/.test(body));
  }
  check('a cheated week never lights NEW HIGH SCORE! (both end screens gate it on !marked)',
    /const isRecord = !marked && weekScore > 0 && hi === weekScore/.test(fnBody('gameOver')) &&
      /const newHi = !marked && weekScore > 0 && hi === weekScore/.test(fnBody('showWeekComplete')));
  check('the HI-SCORE a cheated week shows is the stored HONEST record, never its own number',
    /fxStartTally\(\$\("hiscore2"\), hi\)/.test(fnBody('gameOver')) &&
      /fxStartTally\(\$\("week-hi"\), hi\)/.test(fnBody('showWeekComplete')) &&
      /setTxt\(\$\("hiscore3"\), pad\(hi\)\)/.test(fnBody('showDayStats')));
  check("the ledger's own stored keys are namespaced with the game's other keys (dsnysweep_*)",
    ledgerCode.includes('"dsnysweep_cheat"') && ledgerCode.includes('"dsnysweep_hi"'));
}
console.log('');
console.log('[4] THE MARK ON SCREEN (ONLY WHERE THE HI-SCORE IS PRINTED)');
{
  check('the stamp style (.no-cheat) and the strike style (.score.hi-cross) both ship',
    /\.no-cheat \{/.test(src) && /\.score\.hi-cross \{/.test(src));
  check('the strike is a REAL line-through (the HI-SCORE is crossed out, not recolored)',
    /\.score\.hi-cross \{[\s\S]{0,400}text-decoration: line-through/.test(src));
  check('the stamp carries the reason line, styled (.no-cheat span)',
    /\.no-cheat span \{[\s\S]{0,320}display: block/.test(src));
  // The three panels that print a HI-SCORE are the ONLY places the message may appear.
  for (const b of ['over-cheat', 'complete-cheat', 'week-cheat'])
    check('#' + b + ' is a hidden .no-cheat stamp reading "NO CHEATING!" + "CHEATS IN USE - HI-SCORE NOT SAVED"',
      new RegExp('<div class="no-cheat hidden" id="' + b + '">NO CHEATING!<span>CHEATS IN USE - HI-SCORE NOT SAVED</span></div>').test(src));
  check('NO stamp is printed on a panel without a HI-SCORE (the day card + shift report are clean)',
    !/id="day-intro-cheat"/.test(src) && !/id="day-stats-cheat"/.test(src));
  check('NO live HUD badge: the message never rides the shift, only the high-score screens',
    !/id="cheatbadge"/.test(src) && !/function updateCheatHud/.test(src));
  check('the SUSPENDED screen paints its mark (stamp + struck line + dead ribbon)',
    /cheatMark\("over-cheat", "hiscore2", "over-newhi"\)/.test(fnBody('gameOver')));
  check('the YOU WIN screen paints its mark',
    /cheatMark\("week-cheat", "week-hi", "week-newhi"\)/.test(fnBody('showWeekComplete')));
  check('the ROUTE COMPLETE HI-SCORE gets its mark, from the report that prints it',
    /cheatMark\("complete-cheat", "hiscore3", null\)/.test(fnBody('showDayStats')));
  check('the day card paints NO mark (the worker is told where the score shows, not before)',
    !/cheatMark\(/.test(fnBody('showDayIntro')));
  check('the suspension line itself says the score was not saved, on a cheated run',
    /HI-SCORE NOT SAVED \(CHEATS IN USE\)/.test(fnBody('gameOver')));
  check('a flag inherited from the last visit paints at boot (the strike shows before any play)',
    (function () {
      const at = src.indexOf('$("hiscore2").textContent = pad(hi);');
      const near = at >= 0 ? src.slice(at, at + 700) : '';
      return /cheatMark\("over-cheat", "hiscore2", "over-newhi"\)/.test(near);
    })());
  check('cheatMark toggles BOTH ways (a clean week un-marks its panel - no stuck stamp)',
    ledgerCode.includes('b.classList.toggle("hidden", !on)') && ledgerCode.includes('.classList.toggle("hi-cross", on)'));
}
console.log('');
console.log('[5] THE PLAYER IS TOLD (the trainer is a toy, not a scoring path)');
check('the main-menu doorway hint keeps its EXACT text (the version-display law is untouched)',
  new RegExp('<div class="menu-ver-hint" id="menu-ver-hint">tap above for hidden cheat menu!</div>').test(src));
check('the trainer hint row says the plain law: CHEATS IN USE - HI-SCORE NOT SAVED',
  /id="tr-hint-cheat">CHEATS IN USE - HI-SCORE NOT SAVED</.test(src));
check('the trainer marquee spells the law out (the scrolling warez-scene text)',
  /THE RULE OF THIS TRAINER: CHEATS IN USE MEANS THE HI-SCORE IS NOT SAVED/.test(src) &&
    /NO CHEATING! stamp saying HI-SCORE NOT SAVED/.test(src));
check('the marquee also states the 3 WRITE-UPS = GAME OVER law the trainer cannot beat',
  /3 WRITE-UPS END THE GAME/.test(src) &&
    /No trainer toggle buys a 4th strike and none removes one/.test(src));
check('the trainer rows keep their three cheats + the starting level (the law covers all four)',
  /label: "Infinite Complaints \(CHEAT ONLY\)"/.test(src) && /label: "Infinite Health"/.test(src) &&
    /label: "Always Run It Up!"/.test(src) && /label: "Starting Level"/.test(src));
console.log('');
console.log('[6] THE THREE-STRIKE LAW (3 WRITE-UPS = GAME OVER, and no 4/3 stamp is possible)');
{
  // addWriteUp() runs VERBATIM from the page: the strike meter is driven here, so the
  // ceiling is measured, not hoped for.
  const awu = fnBody('addWriteUp');
  const meter = (cheatOn) => {
    const flash = mkEl('flash');
    const els = { tr: mkEl('tr'), flash: flash };
    const $ = (id) => els[id] || mkEl(id);
    const SFX = { playComplaintSound: () => {} };
    const CHEAT = { infinite: cheatOn === true, invincible: false, runitup: false };
    const run = new Function('$', 'SFX', 'updateHUD', 'CHEAT', 'state',
      'let complaints = 0;\n' + awu + '\nreturn function () { return addWriteUp(); };')(
      $, SFX, () => {}, CHEAT, "play");
    const seq = [];
    for (let i = 0; i < 6; i++) seq.push(run());
    return seq;
  };
  const clean = meter(false);
  check('a clean week: a write-up lands on EVERY screw-up - 1, 2, 3, and the meter stops at 3 (never 4/3)',
    clean.join(',') === '1,2,3,3,3,3', clean.join(','));
  const cheated = meter(true);
  check('with INFINITE COMPLAINTS ON the strikes land exactly the same (1, 2, 3) - the trainer cannot dodge a write-up',
    cheated.join(',') === '1,2,3,3,3,3', cheated.join(','));
  check('addWriteUp reads NO trainer state at all (the strike law has no cheat hook)',
    !/CHEAT/.test(fnBody('addWriteUp')));
  check('the 3rd write-up from a WORKER DOWN hands over to the suspension (finishDying -> gameOver)',
    /const n = addWriteUp\(\);[\s\S]{0,200}if \(n >= 3\)[\s\S]{0,600}gameOver\("writeup"\)/.test(fnBody('finishDying')));
  check('the 3rd write-up from the END-OF-ROUTE INSPECTION hands over too (applyRouteWriteUp -> gameOver)',
    /const n = addWriteUp\(\);[\s\S]{0,700}if \(n >= 3\)[\s\S]{0,400}gameOver\("writeup"\)/.test(fnBody('applyRouteWriteUp')));
  check('the 3rd-strike stamp can only ever read "WRITTEN UP! 3/3" (the counter is capped)',
    /el.textContent = "WRITTEN UP! " \+ n \+ "\/3"/.test(fnBody('showWriteUpText')));
  check('a fresh week / a quit resets the strike record to zero (startGame + quitGame)',
    /complaints = 0;/.test(fnBody('startGame')) && /complaints = 0;/.test(fnBody('quitGame')));
  check('the day card states the law the game enforces: 3 WRITE-UPS = SUSPENDED',
    src.includes('3 WRITE-UPS = SUSPENDED') && src.includes('3 WRITE-UPS - SHIFT TERMINATED'));
}
console.log('');
console.log('[7] LIVE: THREE DIRTY ROUTES = THREE WRITE-UPS = GAME OVER (the real page functions)');
{
  // The report-inspection chain runs VERBATIM from index.html: routeCleanRatio (the 95% clean
  // bar) -> applyRouteWriteUp -> addWriteUp -> showWriteUpText -> gameOver. Only the page's
  // own state and the heavy DOM/SFX edges are stubbed.
  const real = ['routeCleanRatio', 'addWriteUp', 'showWriteUpText', 'dimShiftReport', 'applyRouteWriteUp']
    .map((f) => fnBody(f)).join('\n');
  const run = () => {
    const stamps = [], over = [];
    const pop = () => ({ className: '', textContent: '', style: {}, parentNode: null, appendChild() {}, offsetWidth: 1,
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} } });
  const document = {
      body: { appendChild() {}, removeChild() {} },
      createElement: (tag) => { const e = pop(); stamps.push(e); return e; },
      querySelectorAll: () => [],
      querySelector: () => pop(),
      getElementById: () => pop(),
    };
    const fns = new Function('dayStats', 'state', 'complaintsBox', 'SFX', 'updateHUD', '$', 'document', 'setTimeout', 'gameOver', 'writeupReason',
      'let complaints = 0, lastHitCause = "", routeWriteupLock = false, writeUpDimTimer = null;\n' +
      real + '\n' +
      'return { route: function () {\n' +
      '  var n = applyRouteWriteUp();\n' +
      '  return { n: n, lock: routeWriteupLock };\n' +
      '}, strikes: function () { return complaints; } };')
      ({ bags: { got: 1, total: 100 }, cans: { got: 1, total: 100 }, baskets: { got: 1, total: 100 }, debris: { got: 0, total: 0 } },
        'dayend', null, { playComplaintSound() {}, playSadTrombone() {} }, () => {}, () => pop(), document,
        (fn) => fn(), // setTimeout runs NOW: the 3rd-strike handover is synchronous for the test
        (why) => over.push(why), () => 'Failed to clean route. Work left out.');
    const seq = [];
    for (let i = 0; i < 4; i++) { fns.route(); seq.push(fns.strikes()); }
    return { seq, over, strikes: fns.strikes(), stamps };
  };
  const d = run();
  check('a route left dirty lands a WRITE-UP every time: 1, 2, 3 - and it stops at 3 (no 4th strike exists)',
    d.seq.join(',') === '1,2,3,3', d.seq.join(','));
  check('the 3rd write-up SUSPENDS the worker: gameOver("writeup") fires, exactly once',
    d.over.length === 1 && d.over[0] === 'writeup', JSON.stringify(d.over));
  check('the strike record ends on 3 (the GAME OVER number), never 4', d.strikes === 3, 'complaints=' + d.strikes);
  const seals = d.stamps.filter((e) => /^WRITTEN UP!/.test(e.textContent)).map((e) => e.textContent);
  check('the supervisor stamps exactly WRITTEN UP! 1/3, 2/3, 3/3 - no 4/3 seal is ever printed',
    seals.join(' | ') === 'WRITTEN UP! 1/3 | WRITTEN UP! 2/3 | WRITTEN UP! 3/3', seals.join(' | '));
  check('a route below the 95% clean bar is the write-up trigger (routeCleanRatio < 0.95 => routeFailed)',
    /routeFailed = routeCleanRatio\(\) < 0\.95/.test(src) && /if \(routeFailed\) applyRouteWriteUp\(\)/.test(src));
  check('the report panel is held while the 3rd-strike seal is read (routeWriteupLock blocks "next day")',
    /routeWriteupLock = true;[\s\S]{0,240}gameOver\("writeup"\)/.test(fnBody('applyRouteWriteUp')) &&
      /if \(routeWriteupLock\) return;/.test(src));
}
console.log('');
console.log(ok ? 'CHEAT LAW: ALL ' + n + ' CHECKS PASSED' : 'CHEAT LAW: ' + n + ' CHECKS - SOME FAILED');
process.exit(ok ? 0 : 1);

