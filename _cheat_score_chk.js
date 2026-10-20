// THE CHEAT LAW - the HI-SCORE is the honest run's medal. Run: node _cheat_score_chk.js
/* ============================================================================
   Every cheat lives in the hidden TRAINER (tap the build number on the menu). The law:
     1) THE LEDGER: engaging any trainer cheat flags THE RUNNING GAME. The flag lives in the
        page's own memory and is NEVER written to localStorage: a brand-new week (startGame),
        quitting to the menu (quitGame) or ANY MANUAL REFRESH OF THE PAGE wipes it. A reload
        reboots the trainer with every row at its default, so no cheat is in use any more and
        the week that follows is eligible for the HI-SCORE again — until the trainer is opened
        and a cheat is engaged afresh. (The main menu merely RE-APPEARING is not a refresh:
        quitGame keeps the panel's rows where the player left them.)
     2) A flagged game NEVER writes dsnysweep_hi: commitHighScore() is the single banking path
        and all three end screens (routeComplete / showWeekComplete / gameOver) use it, with
        the verbatim legacy path in the `else` branch for the harnesses that execute those
        functions with only the score module in scope (_ending_screens_chk.js).
     3) A flagged game prints its HI-SCORE line CROSSED OUT (.score.hi-cross) under a
        "NO CHEATING! - CHEATS IN USE - HI-SCORE NOT SAVED" stamp (.no-cheat: #over-cheat /
        #complete-cheat / #week-cheat) and never lights NEW HIGH SCORE!. The mark appears
        ONLY on a panel that prints a HI-SCORE - never on the day card, the shift report
        grid, or the HUD.
     4) THE THREE-STRIKE LAW IS THE STREET'S OWN: every screw-up is a WRITE-UP - a worker DOWN
        in the street AND a route left dirty at the end-of-shift inspection. The meter counts
        1, 2, 3 and the 3rd write-up is GAME OVER, capped at 3 (no "4/3" seal exists).
        THE ONE ROW THAT TOUCHES THE METER IS "INFINITE COMPLAINTS" AND IT MEANS
        EXACTLY WHAT IT SAYS: with it ON, the write-up still happens - the sound, the HUD stamp,
        the seal and its offense line, the whole worker-DOWN beat - but the complaint never
        STICKS: the meter does not climb, so the 3rd strike never arrives and the shift is never
        suspended (addWriteUp is the only place a strike is counted, so the gate sites need no
        test of their own). It clears no strike already on the record, and with the row OFF no
        row buys a 4th. It is a CHEAT: engaging it voids the HI-SCORE like every other row.
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
  check('engaging it flags the running game', d.api.markIt() === true && d.api.used() === true);
  check('THE FLAG IS NEVER WRITTEN TO STORAGE (a cheat flag lives in the page only)',
    d.store['dsnysweep_cheat'] === undefined && !/setItem\("dsnysweep_cheat"/.test(ledgerCode),
    'store=' + JSON.stringify(d.store));
  check('THE FLAG IS NEVER READ BACK AT BOOT (a refresh inherits nothing)',
    !/getItem\("dsnysweep_cheat"/.test(ledgerCode));
  check('switching the cheat OFF later does NOT un-flag the running game (too late)',
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
  check('a brand-new week RE-OPENS the ledger (the in-page flag is cleared, and nothing was ever stored)',
    d.api.clearIt() === false && d.store['dsnysweep_cheat'] === undefined);
  check('the re-opened week is eligible again (it banks its record)',
    (d.api.sc(99000), d.api.commit() === true && d.store['dsnysweep_hi'] === '99000'));
}

{
  const first = makeDesk({ store: { dsnysweep_hi: '50' }, weekScore: 700 });
  first.api.CHEAT.invincible = true;
  first.api.markIt();
  check('a cheated game is marked and never banks its 700 (the record on disk stays the honest 50)',
    first.api.used() === true && first.api.commit() === false && first.store['dsnysweep_hi'] === '50');
  const reload = makeDesk({ store: Object.assign({}, first.store), weekScore: 700 });
  check('A MANUAL REFRESH STARTS CLEAN - the reloaded page carries NO flag and NO live cheat',
    reload.api.used() === false && reload.api.live() === false,
    'used=' + reload.api.used() + ' live=' + reload.api.live());
  check('A REFRESH LEAVES EVERY PANEL ROW AT ITS DEFAULT (the trainer is never remembered across it)',
    reload.api.CHEAT.invincible === false && reload.api.CHEAT.infinite === false &&
      reload.api.CHEAT.runitup === false && reload.api.CHEAT.startLevel === 1);
  check('THE PAGE BOARDS THE PANEL AT ITS DEFAULTS ITSELF (var CHEAT = rows off, start = START_LEVEL)',
    /var CHEAT = \{ infinite: false, invincible: false, runitup: false, startLevel: START_LEVEL \}/.test(src));
  check('the reloaded, un-cheated week IS ELIGIBLE: it banks the score the cheated game could not',
    reload.api.commit() === true && reload.store['dsnysweep_hi'] === '700',
    'store=' + reload.store['dsnysweep_hi']);
  check('the reloaded week paints NO "NO CHEATING!" stamp, NO struck line, and its ribbon stays alive',
    (reload.api.mark('over-cheat', 'hiscore2', 'over-newhi') === false,
      reload.els['over-cheat']._set.has('hidden') && !reload.api.line()._set.has('hi-cross') &&
      !reload.els['over-newhi']._set.has('hidden')));
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
  check('the SUSPENDED panel is run through the mark at boot (a clean boot un-marks it; the call is there for a flagged session)',
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
check('the marquee states the 3 WRITE-UPS = GAME OVER law AND names the ONE row that touches it',
  /3 WRITE-UPS END THE GAME/.test(src) &&
    /with it ON the complaints never stack, the seal prints and the strike does not/.test(src) &&
    /No row clears a strike already on the record, and no row buys a 4th strike/.test(src));
check('the marquee states the REFRESH law (a reload hands back a clean, eligible panel)',
  /REFRESH THE GAME AND THE PANEL IS CLEAN/.test(src) &&
    /with no cheat in use, so the week that follows is eligible for a HI-SCORE again/.test(src));
check('the trainer rows keep their three cheats + the starting level (the law covers all four)',
  /label: "Infinite Complaints"/.test(src) && /label: "Infinite Health"/.test(src) &&
    /label: "Always Run It Up!"/.test(src) && /label: "Starting Level"/.test(src));
console.log('');
console.log('[6] THE THREE-STRIKE LAW (3 WRITE-UPS = GAME OVER, and no 4/3 stamp is possible)');
{
  // addWriteUp() runs VERBATIM from the page: the strike meter is driven here, so the
  // ceiling is measured, not hoped for.
  const awu = fnBody('addWriteUp');
  const meterBoard = () => {
    const els = { tr: mkEl('tr'), flash: mkEl('flash') };
    const $ = (id) => els[id] || mkEl(id);
    const SFX = { playComplaintSound: () => {} };
    const CHEAT = { infinite: false, invincible: false, runitup: false };
    const run = new Function('$', 'SFX', 'updateHUD', 'CHEAT', 'state',
      'let complaints = 0;\n' + awu + '\nreturn function () { return addWriteUp(); };')(
      $, SFX, () => {}, CHEAT, "play");
    return { run: run, CHEAT: CHEAT };
  };
  const walk = (b, n) => { const s = []; for (let i = 0; i < n; i++) s.push(b.run()); return s; };
  const clean = walk(meterBoard(), 6);
  check('a CLEAN run (no row ON): a write-up lands on EVERY screw-up - 1, 2, 3, and the meter stops at 3 (never 4/3)',
    clean.join(',') === '1,2,3,3,3,3', clean.join(','));
  const bIn = meterBoard(); bIn.CHEAT.infinite = true;
  const infinite = walk(bIn, 6);
  check('INFINITE COMPLAINTS ON = the row means EXACTLY what it says: the write-up lands and the COMPLAINTS ISSUED meter never climbs (0,0,0,0,0,0) - no 3rd strike, so the shift is never suspended',
    infinite.join(',') === '0,0,0,0,0,0', infinite.join(','));
  const bFlip = meterBoard();
  const flipped = walk(bFlip, 2);
  bFlip.CHEAT.infinite = true;
  const frozen = walk(bFlip, 4);
  check('flipping it ON mid-week never clears the strikes already on the record (1, 2, then the meter FREEZES - it never climbs and never drops)',
    flipped.concat(frozen).join(',') === '1,2,2,2,2,2', flipped.concat(frozen).join(','));
  const bOther = meterBoard(); bOther.CHEAT.invincible = true; bOther.CHEAT.runitup = true;
  const other = walk(bOther, 6);
  check('every OTHER row leaves the strike law whole (Infinite Health + Always Run It Up: 1, 2, 3, capped at 3)',
    other.join(',') === '1,2,3,3,3,3', other.join(','));
  const awuCode = awu.replace(/^\s*\/\/.*$/gm, '');
  check('the meter has ONE cheat hook (in addWriteUp, the only place a strike is counted), read through a typeof guard so the VERBATIM harnesses that never define CHEAT keep running',
    (awuCode.match(/CHEAT/g) || []).length === 3 &&
      /typeof CHEAT !== "undefined"/.test(awuCode) && !/CHEAT\./.test(fnBody('applyRouteWriteUp')));
  check('the seal says out loud when a complaint did not stick (NO STRIKE RECORDED line + its .writeup-nostrike CSS)',
    /NO STRIKE RECORDED - INFINITE COMPLAINTS IS ON \(HI-SCORE VOIDED\)/.test(fnBody('showWriteUpText')) &&
      /\.pop-writeup \.writeup-nostrike \{/.test(src));
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
  const run = (cheatOn) => {
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
    const fns = new Function('dayStats', 'state', 'complaintsBox', 'SFX', 'updateHUD', '$', 'document', 'setTimeout', 'gameOver', 'writeupReason', 'CHEAT',
      'let complaints = 0, lastHitCause = "", routeWriteupLock = false, writeUpDimTimer = null;\n' +
      real + '\n' +
      'return { route: function () {\n' +
      '  var n = applyRouteWriteUp();\n' +
      '  return { n: n, lock: routeWriteupLock };\n' +
      '}, strikes: function () { return complaints; } };')
      ({ bags: { got: 1, total: 100 }, cans: { got: 1, total: 100 }, baskets: { got: 1, total: 100 }, debris: { got: 0, total: 0 } },
        'dayend', null, { playComplaintSound() {}, playSadTrombone() {} }, () => {}, () => pop(), document,
        (fn) => fn(), // setTimeout runs NOW: the 3rd-strike handover is synchronous for the test
        (why) => over.push(why), () => 'Failed to clean route. Work left out.',
        { infinite: cheatOn === true, invincible: false, runitup: false });
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
  const inf = run(true);
  check('INFINITE COMPLAINTS ON - LIVE CHAIN: four dirty routes land four write-ups and the meter never moves (0, 0, 0, 0)',
    inf.seq.join(',') === '0,0,0,0', inf.seq.join(','));
  check('INFINITE COMPLAINTS ON - LIVE CHAIN: the 3rd-strike suspension NEVER fires (no write-up game over)',
    inf.over.length === 0, JSON.stringify(inf.over));
  check('INFINITE COMPLAINTS ON - LIVE CHAIN: every write-up still stamps, and each seal carries the NO STRIKE line under it',
    inf.stamps.filter((e) => /^WRITTEN UP!/.test(e.textContent)).length === 4 &&
      inf.stamps.filter((e) => /NO STRIKE RECORDED/.test(e.textContent)).length === 4,
    'seals=' + inf.stamps.filter((e) => /^WRITTEN UP!/.test(e.textContent)).length +
      ' nostrike=' + inf.stamps.filter((e) => /NO STRIKE RECORDED/.test(e.textContent)).length);
}
console.log('');
console.log(ok ? 'CHEAT LAW: ALL ' + n + ' CHECKS PASSED' : 'CHEAT LAW: ' + n + ' CHECKS - SOME FAILED');
process.exit(ok ? 0 : 1);

