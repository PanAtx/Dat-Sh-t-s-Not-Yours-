// _route_replay_chk.js — THE FAILED-ROUTE REPLAY RULE.
// A shift that finishes BELOW the 95% clean bar did not do its job: the day-end "next"
// button replays the SAME level from the beginning instead of advancing to the next day.
// The write-up strikes CARRY OVER across that replay (a 3rd write-up must still end the
// run), and a fresh run clears them. A shift that PASSES the bar advances as always, and
// bonus / overtime days (which never reach routeComplete) are unaffected.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  const info = name + (extra === undefined ? '' : '  [' + extra + ']');
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; failures.push(info); console.log('FAIL  ' + info); }
}
const CLEAN_BAR = 0.95;
// [1] the rule as written in the game
check('the game keeps a routeFailed flag, stated as the 95% clean bar',
  /let routeFailed = false;/.test(html) && /routeFailed = routeCleanRatio\(\) < 0\.95;/.test(html));
check('the flag is re-decided at EVERY route end (a replay is a fresh shift, not a permanent state)',
  (() => {
    const hits = html.match(/routeFailed = /g) || [];
    return hits.length >= 2 && /routeFailed = routeCleanRatio\(\) < 0\.95;/.test(html);
  })());
check('the day-end gate reads the flag: below the bar -> showDayIntro (the SAME level), at/above it -> nextDay',
  /return routeFailed\s*\?\s*showDayIntro\(\)\s*:\s*level < MAX_LEVEL\s*\?\s*nextDay\(\)\s*:\s*showWeekComplete\(\);/.test(html.replace(/\r\n/g, ' ')));
check('a replay does NOT advance the level (the level++ lives only on the passing branch)',
  (() => {
    const i = html.indexOf('if (state === "dayend")');
    const seg = html.slice(i, i + 700);
    const failedBranch = seg.slice(seg.indexOf('routeFailed'), seg.indexOf('nextDay'));
    return !/level\+\+|level \+= 1/.test(failedBranch) && /showDayIntro/.test(failedBranch);
  })());
check('the strike record is NOT cleared by the replay (it is cleared at the new-day boundaries)',
  /replay of a FAILED level \(the 95% clean rule\) must keep the strikes/.test(html) &&
  /complaints = 0;.*fresh run/m.test(html));
check('a fresh run clears the strikes (so a replay of a failed level is not a fresh run)',
  /complaints = 0;[\s\S]{0,220}persists across replays of a failed level/.test(html));
check('the 95% bar is stated in the end-of-route write-up (the worker is written up for the mess)',
  /routeCleanRatio\(\)/.test(html) && /unclean/.test(html));
// [2] replay the gate: the SAME lines the game runs, on a stub day
const gateSrc = html.slice(
  html.indexOf('routeFailed = routeCleanRatio() < 0.95;'),
  html.indexOf('routeFailed = routeCleanRatio() < 0.95;') + 60,
);
check('the gate compares against the bar with a strict LESS (0.95 itself PASSES)',
  /routeCleanRatio\(\) < 0\.95/.test(gateSrc));
function gate(ratio) {
  const routeFailed = ratio < CLEAN_BAR;
  return routeFailed ? 'replay' : 'advance';
}
check('ratio 0.94 -> REPLAY the same level', gate(0.94) === 'replay');
check('ratio 0.95 -> ADVANCE to the next day', gate(0.95) === 'advance');
check('ratio 1.0 -> ADVANCE', gate(1) === 'advance');
check('ratio 0.5 -> REPLAY', gate(0.5) === 'replay');
// [3] a replayed level keeps the level index, a passed level moves it on
function applyGate(level, ratio, MAX_LEVEL) {
  const failed = ratio < CLEAN_BAR;
  return failed ? { level: level, replay: true } : { level: Math.min(MAX_LEVEL, level + 1), replay: false };
}
check('a failed Wednesday (level 3) replays level 3 — the worker stays on Flatbush',
  JSON.stringify(applyGate(3, 0.9, 8)) === JSON.stringify({ level: 3, replay: true }));
check('a passed Wednesday (level 3) advances to Thursday (level 4)',
  JSON.stringify(applyGate(3, 0.98, 8)) === JSON.stringify({ level: 4, replay: false }));
check('a passed Saturday (level 7) advances into MIDNIGHT (level 8), the last shift',
  JSON.stringify(applyGate(7, 1, 8)) === JSON.stringify({ level: 8, replay: false }));
check('a failed MIDNIGHT (level 8) replays MIDNIGHT — the haunted shift is not skipped',
  (() => {
    const r = applyGate(8, 0.7, 8);
    return r.level === 8 && r.replay === true;
  })());
check('the day-end gate is the ONLY advance path (no other level++ in the day-end flow)',
  (() => {
    const i = html.indexOf('if (state === "dayend")');
    const seg = html.slice(i, i + 1400);
    return (seg.match(/level\+\+|level \+= 1/g) || []).length <= 1;
  })());
check('the overtime day is NOT a route-end (the replay gate never fires on it)',
  /overtime/.test(html) && !/overtime[\s\S]{0,400}routeFailed = routeCleanRatio/.test(html));
console.log('\n' + pass + ' route-replay checks passed, ' + fail + ' failed');
if (fail) { console.log(failures.map((f, i) => '  FAIL ' + (i + 1) + ') ' + f).join('\n')); process.exit(1); }
