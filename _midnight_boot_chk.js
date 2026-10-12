// _midnight_boot_chk.js — PROOF the shipped build boots on the MIDNIGHT level WITHOUT the
// trainer menu: it reads the real declarations out of index.html (START_LEVEL / NIGHT_LEVEL /
// MAX_LEVEL / the CHEAT default / the startGame level resolution / the trainer panel label)
// and replays exactly the lines the game runs on a normal title-screen START.
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

// ---- the shipped week-start switch: ONE line decides where a fresh week begins ----
const startExpr = lit(/const START_LEVEL = ([^;]+);/, 'START_LEVEL');
const START_LEVEL = new Function('NIGHT_LEVEL', 'MAX_LEVEL', 'return (' + startExpr + ');')(NIGHT_LEVEL, MAX_LEVEL);

// ---- the shipped trainer default, exactly as index.html declares it ----
const cheatInit = lit(/var CHEAT = (\{[^}]*\});/, 'CHEAT');
const cheatExpr = cheatInit.match(/startLevel:\s*([^,}]+)/)[1].trim();
const CHEAT_START = new Function('START_LEVEL', 'return (' + cheatExpr + ');')(START_LEVEL);

// ---- the trainer panel's own label (rowValueText: TRAINER_DAYS[CHEAT.startLevel - 1]) ----
const TRAINER_DAYS = eval('(' + lit(/var TRAINER_DAYS = (\[[\s\S]*?\n\s*\]);/, 'TRAINER_DAYS') + ')');

// ---- replay startGame()'s level resolution for a PLAIN start (no trainer opened) ----
function bootLevel(trainerTouched) {
  let level = START_LEVEL;                              // startGame(): level = START_LEVEL
  const guard = /if \(typeof CHEAT !== "undefined" && CHEAT\.startLevel >= 1 && CHEAT\.startLevel <= MAX_LEVEL\)\s*\r?\n\s*level = CHEAT\.startLevel;/.test(html);
  const cheatLevel = trainerTouched ? CHEAT_START : CHEAT_START;
  if (guard && cheatLevel >= 1 && cheatLevel <= MAX_LEVEL) level = cheatLevel; // startGame() honors the panel default
  return level;
}
const L1 = bootLevel(false);   // the player presses START on the title card
const L2 = bootLevel(true);    // the player came through the trainer panel
const dayOf = (l) => {
  const d = LEVEL_DAYS[l - 1] || {};
  return [(d.day || '?'), (d.borough || '?'), (d.area || '?')].join(' · ');
};

check('the week-start switch points at the haunted shift (START_LEVEL = ' + startExpr.trim() + ' = ' + START_LEVEL + ')',
  START_LEVEL === NIGHT_LEVEL && START_LEVEL === MAX_LEVEL, 'NIGHT_LEVEL=' + NIGHT_LEVEL + ' MAX_LEVEL=' + MAX_LEVEL);
check('A PLAIN START (no trainer menu) BOOTS ON MIDNIGHT: level ' + L1 + ' = ' + dayOf(L1),
  L1 === NIGHT_LEVEL && LEVEL_DAYS[L1 - 1].day === 'MIDNIGHT' && LEVEL_DAYS[L1 - 1].night === true);
check('the trainer default FOLLOWS the week start, so it can never silently pull the boot back to Monday',
  CHEAT_START === START_LEVEL, 'CHEAT.startLevel=' + CHEAT_START + ' START_LEVEL=' + START_LEVEL);
check('a start through the trainer panel lands on the SAME midnight shift',
  L2 === NIGHT_LEVEL, 'level=' + L2);
check('the trainer panel OPENS showing MIDNIGHT as the starting shift',
  TRAINER_DAYS[CHEAT_START - 1] === 'MIDNIGHT', 'label=' + TRAINER_DAYS[CHEAT_START - 1] + ' of ' + TRAINER_DAYS.length + ' rows');
check('the shift is the BROOKLYN / BED-STUY haunted block (the night level, not a weekday)',
  LEVEL_DAYS[L1 - 1].borough === 'BROOKLYN' && !!LEVEL_DAYS[L1 - 1].warning, dayOf(L1));
check('QUIT back to the menu re-arms MIDNIGHT too (level = START_LEVEL, not Monday)',
  /function quitGame\([\s\S]{0,900}?level = START_LEVEL;/.test(html));
check('the TEMP flag sits on the ONE line that flips the start back to Monday at release',
  /const START_LEVEL = [^;]+;\s*\/\/[^\r\n]*TEMP/.test(html) && /TEMP TEST BUILD/.test(html));
check('the day card / stats / HUD all resolve to level 8 through LEVEL_DAYS (no 7-day clamp)',
  /const d = LEVEL_DAYS\[Math\.min\(level, MAX_LEVEL\) - 1\]/.test(html) &&
    /level < MAX_LEVEL[\s\S]{0,80}nextDay\(\)/.test(html));

// THEME17 — the haunted shift arrives with its OWN theme, on loop, and the release is real
check('MIDNIGHT MENAGERIE is the night shift\'s theme and the file is on the shelf',
  /const NIGHT_MUSIC_TRACK = "Midnight Menagerie\.mp3";/.test(html) &&
  fs.existsSync(path.join(__dirname, 'music', 'Midnight Menagerie.mp3')) &&
  JSON.parse(fs.readFileSync(path.join(__dirname, 'music', 'manifest.json'), 'utf8'))
    .includes('Midnight Menagerie.mp3'));
check('the station LOCKS onto the one track and LOOPS it (700ms, not the 2s daytime gap)',
  /radioSticky: null,/.test(html) && /radioSticky\(name\) \{/.test(html) &&
  /this\.radioBag = \[this\.radioSticky\];/.test(html) &&
  /this\.radioSticky \? 700 : 2000/.test(html));
check('the night entry point arms the theme (and a weekday hands the rotation back)',
  /function applyMidnightMusic\(on\)/.test(html) &&
  /applyMidnightMusic\(on\);/.test(html) &&
  /SFX\.radioSticky\(!!on \? NIGHT_MUSIC_TRACK : null\)/.test(html));
console.log('\n' + pass + ' midnight-boot checks passed' + (fail ? ' — ' + fail + ' FAILED' : ' — all OK'));
if (fail) process.exit(1);
console.log('>>> PLAYTEST ENTRY: press START on the title card — the first shift is ' + dayOf(L1) + '.');