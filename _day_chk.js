// _day_chk.js — validate the level system in index.html: the seven weekday shifts
// (Mon–Sun) PLUS the eighth level that comes after Sunday and belongs to no day at all
// ("MIDNIGHT" — the NIGHT SHIFT).
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function extractFn(name){
  const idx = html.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function not found: ' + name);
  const b = html.indexOf('{', idx); let d = 0, i = b;
  for (; i < html.length; i++){ if (html[i] === '{') d++; else if (html[i] === '}'){ d--; if (!d){ i++; break; } } }
  return html.slice(idx, i);
}
function extractLiteral(name, open, close){
  const marker = 'const ' + name + ' = ';
  const idx = html.indexOf(marker);
  if (idx < 0) throw new Error('const not found: ' + name);
  const s = html.indexOf(open, idx);
  let d = 0, i = s;
  for (; i < html.length; i++){ const c = html[i]; if (c === open) d++; else if (c === close){ d--; if (!d){ i++; break; } } }
  return html.slice(s, i);
}
let pass = 0, fail = 0;
function check(n, cond){ if (cond){ pass++; console.log('  ok   ' + n); } else { fail++; console.error('  FAIL ' + n); } }

// ---------- 1) the week: 7 weekdays + THE NIGHT SHIFT after Sunday ----------
const LEVEL_DAYS = eval(extractLiteral('LEVEL_DAYS', '[', ']'));
check('exactly 8 levels (Mon..Sun + the night shift after Sunday)', LEVEL_DAYS.length === 8);
const EXPECT = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];
check('level 1 = MONDAY, level 7 = SUNDAY', LEVEL_DAYS[0].day === 'MONDAY' && LEVEL_DAYS[6].day === 'SUNDAY');
check('the first 7 levels are Monday..Sunday in order', LEVEL_DAYS.slice(0, 7).map(d => d.day).join(',') === EXPECT.join(','));
check('every level has a borough + area', LEVEL_DAYS.every(d => d.borough && d.area));
// level 8: the haunted shift AFTER Sunday — a Brooklyn/Bed-Stuy night with NO weekday name
const NIGHT = LEVEL_DAYS[7];
check('level 8 = MIDNIGHT, flagged night:true, and it is a Bed-Stuy street', NIGHT.day === 'MIDNIGHT' && NIGHT.night === true && NIGHT.borough === 'BROOKLYN' && NIGHT.area === 'BED-STUY');
check('only level 8 is flagged night:true (Sunday stays an ordinary storm shift)', LEVEL_DAYS.filter(d => d.night).length === 1 && LEVEL_DAYS[6].night === undefined);

// ---------- 2) NPC difficulty ramps up every level (sparse Monday, busier each day) ----------
const BASE_NPC_COUNTS = eval('(' + extractLiteral('BASE_NPC_COUNTS', '{', '}') + ')');
const SCALING_NPC = eval('(' + extractLiteral('SCALING_NPC', '{', '}') + ')');
const GATED_NPC = eval('(' + extractLiteral('GATED_NPC', '{', '}') + ')');
const npcCounts = new Function('BASE_NPC_COUNTS','SCALING_NPC','GATED_NPC','LEVEL_DAYS',
  'var level;\n' + extractFn('isQueensLevel') + '\n' + extractFn('npcCounts') +
  '\n; return (day) => { level = day; return npcCounts(day); };')(BASE_NPC_COUNTS, SCALING_NPC, GATED_NPC, LEVEL_DAYS);
const sum = c => Object.keys(c).reduce((a, k) => a + c[k], 0);
// Monday (Manhattan Uptown): gated types (moto/ebike/rc) are absent, the skater + raccoon +
// tric (street tricycle) drops apply, the Manhattan +1 escooter boost is capped back to 1,
// the TRAFFIC CAP v2 kills the +1 bike, and the CROWD CUT thins peds to 1 and drops the
// breaker + lady. Also +1 crazy homeless guy on Manhattan days.
const mon = {}; for (const k in BASE_NPC_COUNTS) mon[k] = GATED_NPC[k] ? 0 : BASE_NPC_COUNTS[k];
mon.skater = 0; mon.raccoon = 0; mon.tric = 0;
mon.squirrel = 0;
mon.crazy = 0;  // spawned separately, not via npcCounts
mon.cat = 0;    // 4 bodega cats spawned separately on Manhattan days
mon.ped = 1; mon.lady = 0; mon.breaker = 0;  // CROWD CUT
mon.bike = 0; mon.escooter = 1;              // TRAFFIC CAP v2
check('level 1 (Monday) is the baseline with the Manhattan drops (skater/raccoon/tric/squirrel) + CROWD CUT (ped 1, no lady/breaker) + traffic cap v2 (no bike)', JSON.stringify(npcCounts(1)) === JSON.stringify(mon));
check('Monday roster is genuinely small (<= 20 NPCs)', sum(npcCounts(1)) <= 20);
check('the main crowd (car) stays at its light baseline all week, peds capped at 1, breakers + ladies gone (CROWD CUT)',
  [1,2,3,4,5,6,7].every(l => npcCounts(l).car === BASE_NPC_COUNTS.car && npcCounts(l).ped <= 1 && npcCounts(l).breaker === 0 && npcCounts(l).lady === 0));
check('traffic cap v2: 0 bikes + 0 rc everywhere, 0 moto / 0 e-bike EXCEPT the level-specific Bronx (d2) swap',
  [1,2,3,4,5,6,7].every(l => npcCounts(l).bike === 0 && npcCounts(l).rc === 0 && npcCounts(l).moto <= 1 && npcCounts(l).ebike <= 1) &&
  npcCounts(1).moto === 0 && npcCounts(1).ebike === 0 &&
  npcCounts(2).moto === 1 && npcCounts(2).ebike === 1 &&
  [3,4,5,6,7].every(l => npcCounts(l).moto === 0 && npcCounts(l).ebike === 0));
check('Bronx (d2): no street tricycle, but 1 moto + 1 e-bike on the street',
  npcCounts(2).tric === 0 && npcCounts(2).moto === 1 && npcCounts(2).ebike === 1);
check('old weekly traffic ramp is flattened: d4-d7 used to run 2-5 moto + 2-5 ebike + 1-3 rc, now 0 / 0 / 0 (quiet street)',
  [4,5,6,7].every(l => npcCounts(l).moto === 0 && npcCounts(l).ebike === 0 && npcCounts(l).rc === 0));
check('non-gated, non-scaling types stay at their Monday count (per-day overrides aside)',
  Object.keys(BASE_NPC_COUNTS).filter(k => !SCALING_NPC[k] && !GATED_NPC[k]
    && !['escooter','bike','tric','yeller','hooker','skater','raccoon','crazy','squirrel','breaker','ped','lady'].includes(k))
    .every(k => [1,2,3,4,5,6,7].every(l => npcCounts(l)[k] === BASE_NPC_COUNTS[k])));
check('calmer, lighter street: the week still trends busier by Sunday, but at a light level (was ~39, now <= 30)', sum(npcCounts(7)) > sum(npcCounts(1)) && sum(npcCounts(7)) <= 30);
console.log('   roster: day1 (Mon) = ' + sum(npcCounts(1)) + ' NPCs   ->   day7 (Sun) = ' + sum(npcCounts(7)) + ' NPCs');

// ---------- 3) recordDayGot bumps only the requested counter ----------
const stats0 = { bags:{got:0,total:5}, cans:{got:0,total:3}, baskets:{got:0,total:3}, mongo:{got:0,total:2}, treasure:{got:0,total:1}, cash:{got:0,total:1} };
const recordDayGot = new Function('dayStats', extractFn('recordDayGot') + '\n; return recordDayGot;')(stats0);
recordDayGot('bags'); recordDayGot('cans'); recordDayGot('cans'); recordDayGot('mongo');
check('recordDayGot increments only the right counter', stats0.bags.got === 1 && stats0.cans.got === 2 && stats0.mongo.got === 1 && stats0.baskets.got === 0 && stats0.cash.got === 0);

// ---------- 4) computeDayTotals snapshots the whole street ----------
const newDayStats = new Function(extractFn('newDayStats') + '\n; return newDayStats;')();
const blocks = [ { house: { bags: [{state:'curb'},{state:'dumped'}], can: {state:'curb'} } }, { house: { bags: [{state:'curb'}], can: null } } ];
const litterBaskets = [{}, {state:'dumped'}, {}, {}];
const bonuses = [{type:'mongo'},{type:'treasure'},{type:'cash'},{type:'mongo'}];
const computeDayTotals = new Function('blocks','litterBaskets','bonuses','newDayStats', extractFn('computeDayTotals') + '\n; return computeDayTotals;')(blocks, litterBaskets, bonuses, newDayStats);
global.dayStats = null; global.dayBonusGot = null;
computeDayTotals();
const s = global.dayStats;
check('computeDayTotals: bags total = 3 (got 0)', s.bags.total === 3 && s.bags.got === 0);
check('computeDayTotals: cans total = 1', s.cans.total === 1);
check('computeDayTotals: baskets total = 4', s.baskets.total === 4);
check('computeDayTotals: mongo 2 / treasure 1 / cash 1', s.mongo.total === 2 && s.treasure.total === 1 && s.cash.total === 1);
check('computeDayTotals resets the bonus-got counters', global.dayBonusGot.mongo === 0 && global.dayBonusGot.cash === 0);

// ---------- 5) statRow HTML ----------
const statRow = new Function(extractFn('statRow') + '\n; return statRow;')();
check('statRow shows "got / total"', /15/.test(statRow('GARBAGE BAGS',15,20,false)) && /\//.test(statRow('GARBAGE BAGS',15,20,false)));
check('statRow flags a perfect run (got >= total)', statRow('TREASURES',5,5,true).indexOf('perfect') >= 0);
check('statRow applies bonus styling', statRow('MONGO',1,2,true).indexOf('bonus') >= 0);

// ---------- 6) showDayStats renders all six breakdown rows ----------
const els = {};
const fakeEl = id => ({ id, textContent:'', innerHTML:'', style:{ setProperty(){} }, querySelector: () => fakeEl(id + '-panel'), querySelectorAll: () => [], classList:{ add(){}, remove(){}, toggle(){} } });
const $ = id => (els[id] || (els[id] = fakeEl(id)));
const setTxt = (el, v) => { if (el) el.textContent = v; };
const pad = n => String(Math.max(0, Math.floor(n))).padStart(6, '0');
const dayStatsMock = { bags:{got:15,total:20}, cans:{got:10,total:12}, baskets:{got:14,total:14}, mongo:{got:3,total:5}, treasure:{got:4,total:6}, cash:{got:2,total:4}, spooks:{got:9,total:14} };
// THE LEVEL'S OWN NAME HELPER, lifted straight out of the game (the night shift's report
// is titled by levelName(d), so the sandbox has to carry it exactly like the page does).
const levelName = new Function(extractFn('levelName') + '\n; return levelName;')();
check('levelName: a weekday is its plain day, and the haunted shift is named by its own field',
  levelName(LEVEL_DAYS[0]) === 'MONDAY' && levelName(LEVEL_DAYS[7]) === 'MIDNIGHT * DEAD END');
const makeShowDayStats = lv => new Function('$','LEVEL_DAYS','level','MAX_LEVEL','dayStats','dayScore','weekScore','pad','setTxt','statRow','newDayStats','routeFailed','clearTimeout','writeUpDimTimer','clearAdvancePressed','levelName','cashName',
  extractFn('showDayStats') + '\n; return showDayStats;')($, LEVEL_DAYS, lv, LEVEL_DAYS.length, dayStatsMock, 1234, 9999, pad, setTxt, statRow, newDayStats, false, () => 0, 0, () => {}, levelName,
  // THE LEVEL'S OWN WORD FOR THE CASH TALLY (the game reads isNightShift() at report time):
  // Midnight banks HELL NOTES, the seven weekdays bank STREET CASH.
  () => (lv === LEVEL_DAYS.length ? 'HELL NOTES' : 'STREET CASH'));
makeShowDayStats(3)();
check('showDayStats titles the day (WEDNESDAY)', els['day-stats-title'].textContent.indexOf('WEDNESDAY') >= 0);
makeShowDayStats(8)();
check('...and titles the haunted shift by its LEVEL NAME — "MIDNIGHT * DEAD END", not a long street caption',
  els['day-stats-title'].textContent.indexOf('MIDNIGHT * DEAD END') >= 0,
  els['day-stats-title'].textContent);
check('on Midnight the report calls the money HELL NOTES, while the weekdays keep STREET CASH',
  (els['day-stats-grid'] || {}).innerHTML.indexOf('HELL NOTES') >= 0 &&
    (makeShowDayStats(3)(), (els['day-stats-grid'] || {}).innerHTML.indexOf('STREET CASH') >= 0 &&
      (els['day-stats-grid'] || {}).innerHTML.indexOf('HELL NOTES') < 0),
  ((els['day-stats-grid'] || {}).innerHTML || '').slice(0, 160));
makeShowDayStats(3)();
const grid = els['day-stats-grid'].innerHTML;
check('showDayStats renders all 6 breakdown rows', ['GARBAGE BAGS','GARBAGE CANS','LITTER BASKETS','MONGO HAULED','TREASURES','STREET CASH'].every(l => grid.indexOf(l) >= 0));
check('showDayStats shows bags "15 / 20"', grid.indexOf('15') >= 0 && grid.indexOf('/ 20') >= 0);
check('showDayStats flags a perfect run (baskets 14/14)', grid.indexOf('perfect') >= 0);
check('showDayStats shows the SPOOKS SHOBELED row when a spook tally exists', grid.indexOf('SPOOKS SHOBELED') >= 0 && grid.indexOf('/ 14') >= 0);
check('showDayStats sets day + week score', els['day-stats-score'].textContent.indexOf('1234') >= 0 && els['day-stats-week'].textContent.indexOf('9999') >= 0);
check('mid-week -> "NEXT DAY" button', els['btnNextDay'].textContent.indexOf('NEXT DAY') >= 0);
makeShowDayStats(7)();
check('Sunday is NO LONGER the last shift -> "NEXT DAY" (the night shift follows it)', els['btnNextDay'].textContent.indexOf('NEXT DAY') >= 0);
els['day-stats-title'].textContent = '';
makeShowDayStats(8)();
check('the last title reads MIDNIGHT (the shift after Sunday)', els['day-stats-title'].textContent.indexOf('MIDNIGHT') >= 0);
check('the night shift (last) -> "FINISH WEEK" button', els['btnNextDay'].textContent.indexOf('FINISH WEEK') >= 0);

// ---------- 7) advanceGame routes by state ----------
const calls = [];
const stubs = { beginDay(){ calls.push('beginDay'); }, nextDay(){ calls.push('nextDay'); }, showWeekComplete(){ calls.push('weekComplete'); }, startGame(){ calls.push('startGame'); } };
const mkAdv = (stateNow, lv, failed) => new Function('state','routeFailed','level','MAX_LEVEL','beginDay','nextDay','showWeekComplete','startGame','showDayIntro','_preloading','routeWriteupLock',
  extractFn('advanceGame') + '\n; return advanceGame;')(stateNow, !!failed, lv, LEVEL_DAYS.length, stubs.beginDay, stubs.nextDay, stubs.showWeekComplete, stubs.startGame, () => calls.push('showDayIntro'), false, false);
check('advanceGame: intro -> begin the day', (calls.length = 0, mkAdv('intro', 3)(), calls.length === 1 && calls[0] === 'beginDay'));
check('advanceGame: dayend (mid-week) -> next day', (calls.length = 0, mkAdv('dayend', 3)(), calls.length === 1 && calls[0] === 'nextDay'));
check('advanceGame: dayend (Sunday) -> still advances (the night shift is next)', (calls.length = 0, mkAdv('dayend', 7)(), calls.length === 1 && calls[0] === 'nextDay'));
check('advanceGame: dayend (the night shift = last) -> week complete', (calls.length = 0, mkAdv('dayend', 8)(), calls.length === 1 && calls[0] === 'weekComplete'));
check('advanceGame: menu -> start a fresh week', (calls.length = 0, mkAdv('menu', 1)(), calls.length === 1 && calls[0] === 'startGame'));
check('advanceGame: game over -> start a fresh week', (calls.length = 0, mkAdv('over', 1)(), calls.length === 1 && calls[0] === 'startGame'));
check('advanceGame: never restarts mid-shift', (calls.length = 0, mkAdv('play', 3)(), calls.length === 0));
check('advanceGame: never skips the level-complete cinematic', (calls.length = 0, mkAdv('routeend', 3)(), calls.length === 0));
check('advanceGame: never skips the down sequence', (calls.length = 0, mkAdv('dying', 3)(), calls.length === 0));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);