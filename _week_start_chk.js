// _week_start_chk.js — THE WEEK START LAW: a fresh week BOOTS ON MONDAY (level 1), the
// haunted shift stays the level AFTER Sunday (level 8), and the playtest doorway is still
// ONE line.
//
// The suite reads the real declarations out of index.html (LEVEL_DAYS / MAX_LEVEL /
// NIGHT_LEVEL / START_LEVEL / the CHEAT panel default / TRAINER_DAYS) and replays exactly
// the lines the game runs on a title-screen START, a trainer-panel START and a QUIT:
//   * startGame():  level = START_LEVEL; ... then the CHEAT.startLevel guard
//   * quitGame():   level = START_LEVEL
//   * playtest flip: a panel CHOICE of NIGHT_LEVEL still lands on the haunted shift, and
//     flipping START_LEVEL to NIGHT_LEVEL is the only change a playtest build needs.
// The night-shift identity + its radio set are asserted too, so the release boot cannot
// silently un-wire MIDNIGHT (the shift stays reachable, level 8 of 8).
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync('index.html', 'utf8');
let pass = 0, fail = 0;
function check(name, cond, extra) {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra != null ? '  [' + extra + ']' : ''));
  if (cond) pass++; else fail++;
}
function lit(re, label) {
  const m = html.match(re);
  if (!m) { console.error('FAILED: could not extract ' + label + ' from index.html'); process.exit(2); }
  return m[1];
}

// ---- the shipped level table (8 shifts: Mon..Sun + the haunted one) ----
const LEVEL_DAYS = eval('(' + lit(/const LEVEL_DAYS = (\[[\s\S]*?\n\s*\]);/, 'LEVEL_DAYS') + ')');
const MAX_LEVEL = LEVEL_DAYS.length;
const NIGHT_LEVEL = LEVEL_DAYS.findIndex((d) => !!d.night) + 1;

// ---- the week-start switch: ONE line decides where a fresh week begins ----
const startExpr = lit(/const START_LEVEL = ([^;]+);/, 'START_LEVEL');
const START_LEVEL = new Function('NIGHT_LEVEL', 'MAX_LEVEL', 'return (' + startExpr + ');')(NIGHT_LEVEL, MAX_LEVEL);

// ---- the trainer default + the panel rows, exactly as index.html declares them ----
const cheatInit = lit(/var CHEAT = (\{[^}]*\});/, 'CHEAT');
const cheatExpr = cheatInit.match(/startLevel:\s*([^,}]+)/)[1].trim();
const CHEAT_START = new Function('START_LEVEL', 'return (' + cheatExpr + ');')(START_LEVEL);
const TRAINER_DAYS = eval('(' + lit(/var TRAINER_DAYS = (\[[\s\S]*?\n\s*\]);/, 'TRAINER_DAYS') + ')');

// ---- replay startGame()'s level resolution (a plain START, or a CHOSEN panel level) ----
const guard = /if \(typeof CHEAT !== "undefined" && CHEAT\.startLevel >= 1 && CHEAT\.startLevel <= MAX_LEVEL\)\s*\r?\n\s*level = CHEAT\.startLevel;/.test(html);
function bootLevel(chosenLevel) {
  let level = START_LEVEL;                    // startGame(): level = START_LEVEL
  const pick = chosenLevel === undefined ? CHEAT_START : chosenLevel;
  if (guard && pick >= 1 && pick <= MAX_LEVEL) level = pick;
  return level;
}
const PLAIN = bootLevel();            // the player presses START on the title card
const PANEL = bootLevel(CHEAT_START); // ...and the panel default is the same week start
const CHOSEN = bootLevel(NIGHT_LEVEL); // the playtest CHOICE: boot the haunted shift
const dayOf = (l) => {
  const d = LEVEL_DAYS[l - 1] || {};
  return [(d.day || '?'), (d.borough || '?'), (d.area || '?')].join(' · ');
};

console.log('\n[1] THE SHIP: the week-start switch');
check('the week starts on MONDAY: START_LEVEL = ' + startExpr.trim() + ' = level ' + START_LEVEL,
  START_LEVEL === 1, 'START_LEVEL=' + START_LEVEL + ' NIGHT_LEVEL=' + NIGHT_LEVEL);
check('the declaration says it out loud on its own line (1 = MONDAY, NIGHT_LEVEL = 8 is the playtest flip)',
  /const START_LEVEL = 1;\s*\/\/[^;\r\n]*MONDAY[^;\r\n]*NIGHT_LEVEL = 8/.test(html));
check('NO playtest flip left in the ship (no START_LEVEL = NIGHT_LEVEL, no TEMP TEST BUILD flag)',
  !/const START_LEVEL = NIGHT_LEVEL;/.test(html) && !/TEMP TEST BUILD/.test(html));
check('startGame() arms the week off START_LEVEL, then honors a CHOSEN panel level (1..MAX_LEVEL)',
  /level = START_LEVEL;[\s\S]{0,240}if \(typeof CHEAT !== "undefined" && CHEAT\.startLevel >= 1 && CHEAT\.startLevel <= MAX_LEVEL\)/.test(html));
check('QUIT back to the menu re-arms the same week start (level = START_LEVEL)',
  /function quitGame\([\s\S]{0,900}?level = START_LEVEL;/.test(html));
check('the trainer panel default FOLLOWS the week start (a START_LEVEL flip is honoured, never silently overridden)',
  /var CHEAT = \{[^}]*startLevel: START_LEVEL \}/.test(html) && CHEAT_START === START_LEVEL,
  'CHEAT.startLevel=' + CHEAT_START + ' START_LEVEL=' + START_LEVEL);

console.log('\n[2] THE BOOT (replaying startGame / the panel / a full week advance)');
check('A PLAIN START (no trainer menu) BOOTS ON MONDAY: level ' + PLAIN + ' = ' + dayOf(PLAIN),
  PLAIN === 1 && LEVEL_DAYS[PLAIN - 1].day === 'MONDAY' && LEVEL_DAYS[PLAIN - 1].night !== true);
check('Monday is the MANHATTAN / GRAMMERCY PARK street (the shipped first shift, EDP warning and all)',
  LEVEL_DAYS[0].borough === 'MANHATTAN' && LEVEL_DAYS[0].area === 'GRAMMERCY PARK' && !!LEVEL_DAYS[0].warning,
  dayOf(PLAIN));
check('a START through the trainer panel lands on the SAME Monday shift (the panel default is the week start)',
  PANEL === 1, 'level=' + PANEL);
check('the trainer panel OPENS showing MONDAY as the starting shift',
  TRAINER_DAYS[CHEAT_START - 1] === 'MONDAY', 'label=' + TRAINER_DAYS[CHEAT_START - 1] + ' of ' + TRAINER_DAYS.length + ' rows');
check('the playtest doorway is intact: a panel CHOICE of level ' + NIGHT_LEVEL + ' boots straight into MIDNIGHT',
  CHOSEN === NIGHT_LEVEL && LEVEL_DAYS[CHOSEN - 1].night === true && LEVEL_DAYS[CHOSEN - 1].day === 'MIDNIGHT',
  'level=' + CHOSEN + ' = ' + dayOf(CHOSEN));
check('the haunted shift keeps its DEAD END card on the playtest boot (the banner the night is known by)',
  LEVEL_DAYS[CHOSEN - 1].special === 'THE DEAD END. WHO YOU GONNA CALL?' && LEVEL_DAYS[CHOSEN - 1].place === 'DEAD END');
check('the night resolver points at the LAST day (8 of 8), so clearing Sunday rolls into MIDNIGHT',
  NIGHT_LEVEL === MAX_LEVEL && MAX_LEVEL === 8 && LEVEL_DAYS[7].day === 'MIDNIGHT' && !!LEVEL_DAYS[7].night,
  'NIGHT_LEVEL=' + NIGHT_LEVEL + ' MAX_LEVEL=' + MAX_LEVEL);
check('a cleared shift advances the week (level < MAX_LEVEL -> nextDay) — the route to Midnight is the week itself',
  /level < MAX_LEVEL[\s\S]{0,80}nextDay\(\)/.test(html));
check('the day card / stats / HUD all resolve through LEVEL_DAYS (no 7-day clamp to hide level 8)',
  /const d = LEVEL_DAYS\[Math\.min\(level, MAX_LEVEL\) - 1\]/.test(html) &&
    /level < MAX_LEVEL[\s\S]{0,80}nextDay\(\)/.test(html));

console.log('\n[3] THE NIGHT SET rides the LEVEL, not the boot (MIDNIGHT stays fully wired)');
check('MIDNIGHT MENAGERIE is the night shift\'s theme and the file is on the shelf',
  /const NIGHT_MUSIC_TRACK = "Midnight Menagerie\.mp3";/.test(html) &&
    fs.existsSync(path.join(__dirname, 'music', 'Midnight Menagerie.mp3')) &&
    JSON.parse(fs.readFileSync(path.join(__dirname, 'music', 'manifest.json'), 'utf8'))
      .includes('Midnight Menagerie.mp3'));
check('the station LOCKS ONTO THE MIDNIGHT SET and rotates it (a locked-pool bag, the short 700ms night gap, and no state/setter key collision)',
  /radioLock: null,/.test(html) && /radioLockPool: null,/.test(html) && /radioSticky\(name\) \{/.test(html) &&
    /this\.radioLockPool = pool;/.test(html) &&
    /this\.radioLockPool\.slice\(\)/.test(html) &&
    /this\.radioLock \? 700 : 2000/.test(html) &&
    !/this\.radioSticky/.test(html));
check('the night shift owns FOUR songs (the theme + the three midnight-only tracks), all on the shelf',
  /const NIGHT_MUSIC_TRACKS = \[/.test(html) &&
    ['Midnight Menagerie.mp3', 'Dead-End Sweep.mp3', 'Midnight Route.mp3', 'Midnight Sanitation Strike.mp3'].every(
      (n) => fs.existsSync(path.join(__dirname, 'music', n)) &&
        JSON.parse(fs.readFileSync(path.join(__dirname, 'music', 'manifest.json'), 'utf8')).includes(n)));
check('the night entry point arms the MIDNIGHT SET (and a weekday hands the rotation back) — so Monday gets the weekday station',
  /function applyMidnightMusic\(on\)/.test(html) &&
    /applyMidnightMusic\(on\);/.test(html) &&
    /SFX\.radioSticky\(!!on \? NIGHT_MUSIC_TRACKS : null\)/.test(html));

console.log('\n' + pass + ' week-start checks passed' + (fail ? ' — ' + fail + ' FAILED' : ' — all OK'));
if (fail) process.exit(1);
console.log('>>> RELEASE ENTRY: press START on the title card — the first shift is ' + dayOf(PLAIN) + '.');

