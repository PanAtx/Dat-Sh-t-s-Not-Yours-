// _queens_deli_chk.js — verify the Maspeth (Queens) Polish deli sign + the nice
// Polish boy (the ladies' brother) in index.html:
//   - makePolishDeliSign: cream panel + red trim + rods, in FRONT of the facade,
//     emblem is a PICKLE (green capsule + stem) or a PIEROGI (pale half-moon + pleat)
//   - makeQueensStore wires the sign ONLY for deli-named stores, centered at the door
//   - polishboy: addCreature case (makePerson, walker fallthrough), male voice,
//     polite "stop talking to my sister" RECOGNITION lines (proximity trigger,
//     no bump needed), bump gate, can-hittable, one per Queens level on a random
//     lady's block (her brother), written-up lines
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// 1) all inline scripts still parse
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m,
  n = 0,
  ok = true;
while ((m = re.exec(src))) {
  n++;
  try {
    new vm.Script(m[1], { filename: 'inline' + n + '.js' });
  } catch (e) {
    ok = false;
    console.log('SYNTAX FAIL script #' + n + ': ' + e.message);
  }
}
console.log('inline scripts checked: ' + n + (ok ? ' — ALL SYNTAX OK' : ' — SYNTAX ERRORS'));

let pass = ok;
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

// ================= 1. THE DELI SIGN BUILDER =================
const sign = (() => {
  try {
    return extract('makePolishDeliSign');
  } catch (e) {
    return '';
  }
})();
check('makePolishDeliSign builder exists', sign.length > 0);
check(
  'sign has a cream panel (0xf2ead8) with red trim (0x8a2d4e)',
  sign.indexOf('0xf2ead8') >= 0 && sign.indexOf('0x8a2d4e') >= 0
);
check(
  'poster-sized small rectangle (1.05u paper) with a red border — NO rods, NOT wide',
  sign.indexOf('BX(1.05, 0.03, 0.85') >= 0 &&
    sign.indexOf('0x8a2d4e') >= 0 &&
    sign.indexOf('rod') < 0
);
check(
  'pickle emblem: green capsule (0x7aa52a) + stem (0x4a7a1a)',
  sign.indexOf('pickle') >= 0 && sign.indexOf('0x7aa52a') >= 0 && sign.indexOf('0x4a7a1a') >= 0
);
check(
  'pierogi emblem: pale half-moon (0xe8d5a0) + crimped dough bumps (0xd8c08a)',
  sign.indexOf('pierogi') >= 0 && sign.indexOf('0xe8d5a0') >= 0 && sign.indexOf('0xd8c08a') >= 0
);
check('emblem is randomly pickle OR pierogi', sign.indexOf('food === "pierogi"') >= 0);

// ================= 2. WIRING INTO makeQueensStore =================
const qStore = (() => {
  try {
    return extract('makeQueensStore');
  } catch (e) {
    return '';
  }
})();
check('makeQueensStore exists', qStore.length > 0);
check(
  'deli sign is attached ONLY for deli-named stores (/DELI/i test on storeName)',
  qStore.indexOf('/DELI/i.test(storeOptions.storeName)') >= 0
);
check(
  'deli poster sits IN the display window (off the divider, away from the door)',
  qStore.indexOf('deliSign.position.x = storeOptions.isLeft ? 0.95 : -0.95') >= 0 &&
    sign.indexOf('paper.position.set(0, -2.54, 1.45)') >= 0
);
check(
  'pickle/pierogi chosen at random per store (Math.random() < 0.5)',
  qStore.indexOf('Math.random() < 0.5 ? "pickle" : "pierogi"') >= 0
);
check(
  'only QUEENS stores get this (exactly one call site, in makeQueensStore)',
  src.indexOf('makePolishDeliSign') ===
    src.indexOf('function makePolishDeliSign(') + 'function '.length &&
    (src.match(/makePolishDeliSign\(/g) || []).length === 2
);

// ================= 3. THE NICE POLISH BOY =================
const addSec = (() => {
  const i = src.indexOf('function addCreature(');
  if (i < 0) return '';
  const j = src.indexOf('function updateCreatures(');
  return src.slice(i, j > i ? j : i + 9000);
})();
check(
  'addCreature has case "polishboy" (makePerson, CAUCASIAN skin only, male)',
  addSec.indexOf('case "polishboy":') >= 0 &&
    addSec.indexOf('makePerson(') >= 0 &&
    addSec.indexOf('skin: pick(POLISH_SKIN)') >= 0 &&
    addSec.indexOf('type === "polishboy"') >= 0
);
const aiSec = (() => {
  const u = src.indexOf('function updateCreatures(');
  const i = src.indexOf('case "polishboy":', u);
  if (i < 0) return '';
  return src.slice(i, i + 3600);
})();
check(
  'AI: polishboy is his OWN case (no per-frame rebuild, no street-ped fallthrough)',
  /case "polishboy": \{/.test(aiSec) && aiSec.indexOf('makePerson') < 0
);
check(
  'AI: loiters in front of the corner store (c.loiter, ±4u pace, turns around)',
  aiSec.indexOf('c.loiter') >= 0 &&
    aiSec.indexOf('L.minX') >= 0 &&
    aiSec.indexOf('L.maxX') >= 0
);
check(
  'AI: aggro FOLLOWS the worker, cursing in Polish, ends at the corner (45u) or 14s',
  aiSec.indexOf('c.aggro') >= 0 &&
    aiSec.indexOf('POLISH_BOY_CURSES') >= 0 &&
    aiSec.indexOf('dx > 45') >= 0 &&
    src.indexOf('c.aggroT = 14') >= 0
);
check(
  'polishboy is male (gender list)',
  /type === "escooter" \|\|\s*\n\s*type === "polishboy"/.test(src)
);

// recognition lines: polite asks to stop bothering his SISTER (proximity trigger)
const bumpSec = (() => {
  const i = src.indexOf('function collideCreatures');
  if (i < 0) return '';
  return src.slice(i, i + 22000);
})();
check('bump GATE includes polishboy (still a hittable civilian)', bumpSec.indexOf('c.type === "polishboy"') >= 0);
check(
  'aggro TRIGGERS on PROXIMITY alone (within 11u, temper 14s) — NOT on a bump',
  aiSec.indexOf('Math.hypot(p.wx - c.wx, p.wy - c.wy)') >= 0 &&
    aiSec.indexOf('pd < 11') >= 0 &&
    aiSec.indexOf('c.aggro = true;') >= 0 &&
    aiSec.indexOf('c.aggroT = 14;') >= 0 &&
    bumpSec.indexOf('c.aggro = true;') < 0
);
check(
  'recognition line lands only the FIRST time (c.recognized flag), re-aggro just resumes curses',
  aiSec.indexOf('c.recognized = true') >= 0 &&
    aiSec.indexOf('!c.recognized') >= 0
);
[
  'Hey, please stop talking to my sister.',
  "She's my sister — please leave her be.",
  'My sister asked me to tell you to back off.',
].forEach((line) => {
  check('recognition line present: "' + line + '"', aiSec.indexOf(line) >= 0);
});
check(
  'recognition: every line is about his SISTER and he never mentions a mother',
  (() => {
    const i = aiSec.indexOf('!c.recognized');
    if (i < 0) return false;
    const seg = aiSec.slice(i, i + 500);
    return (
      /sister/i.test(seg) &&
      seg.toLowerCase().indexOf('mother') < 0 &&
      aiSec.toLowerCase().indexOf('mother') < 0
    );
  })()
);

check(
  '6 Polish curses/threats in POLISH_BOY_CURSES (protecting his sister)',
  (() => {
    const i = src.indexOf('const POLISH_BOY_CURSES = [');
    if (i < 0) return false;
    const seg = src.slice(i, src.indexOf('];', i));
    const lines = seg
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('"'));
    return (
      lines.length >= 6 &&
      lines.every((l) => /siostr|spokoju|ostrz|matka|rogu/i.test(l))
    );
  })()
);
check(
  'corner store spots are collected during block build (isQueensStore, deli flag)',
  src.indexOf('queensStoreSpots.push(') >= 0 &&
    src.indexOf('deli: /DELI/i.test(storeOptions.storeName)') >= 0
);
const spawnSec = (() => {
  const i = src.indexOf('The nice Polish boy: he hangs around the corner store');
  if (i < 0) return '';
  return src.slice(i, i + 900);
})();
check(
  'spawn: the boy hangs around the deli (preferred) else a random corner store',
  spawnSec.indexOf('queensStoreSpots.find((s) => s.deli)') >= 0 &&
    spawnSec.indexOf('addCreature("polishboy")') >= 0 &&
    spawnSec.indexOf('deliSpot.x + R(-2.5, 2.5)') >= 0
);
check(
  'spawn: loiter range is ±4u around the store, aggro starts off',
  spawnSec.indexOf('minX: deliSpot.x - 4') >= 0 &&
    spawnSec.indexOf('maxX: deliSpot.x + 4') >= 0 &&
    spawnSec.indexOf('pb.aggro = false') >= 0
);

// written-up offense lines
check(
  'WRITTEN UP!: polishboy has its own offense lines',
  /polishboy:\s*\[[\s\S]{0,200}Failure to respect a concerned younger brother/.test(src)
);

// flying cans can hit him too
const canSec = (() => {
  try {
    return extract('checkFlyingCanNpcHit');
  } catch (e) {
    return '';
  }
})();
check(
  'flying cans: polishboy is a hittable civilian',
  canSec.indexOf('c.type === "polishboy"') >= 0
);

console.log(
  pass ? '\nQUEENS DELI + POLISH BOY: ALL PASS' : '\nQUEENS DELI + POLISH BOY: FAILURES ABOVE'
);
process.exit(pass ? 0 : 1);

