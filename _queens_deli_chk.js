// _queens_deli_chk.js — verify the Maspeth (Queens) Polish deli sign + the nice
// Polish boy (the ladies' brother) in index.html:
//   - makePolishDeliSign: cream panel + red trim + rods, in FRONT of the facade,
//     emblem is a PICKLE (green capsule + stem) or a PIEROGI (pale half-moon + pleat)
//   - makeQueensStore wires the sign ONLY for deli-named stores, centered at the door
//   - polishboy: addCreature case (makePerson, walker fallthrough), male voice,
//     polite "stop talking to my sister" bump lines, bump gate, can-hittable,
//     one per Queens level on a random lady's block (her brother), written-up lines
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
  'sign mounts on rods in FRONT of the facade (panel floats at y -2.54)',
  sign.indexOf('panel.position.set(0, -2.54, 2.2)') >= 0 && sign.indexOf('rod') >= 0
);
check(
  'pickle emblem: green capsule (0x5a8a3a) + stem (0x3a5a1a)',
  sign.indexOf('pickle') >= 0 && sign.indexOf('0x5a8a3a') >= 0 && sign.indexOf('0x3a5a1a') >= 0
);
check(
  'pierogi emblem: pale half-moon (0xe8d5a0) + pinched pleat (0xc9b07a)',
  sign.indexOf('pierogi') >= 0 && sign.indexOf('0xe8d5a0') >= 0 && sign.indexOf('0xc9b07a') >= 0
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
  'deli sign hangs at the door (position.x = doorX) in front of the deli',
  qStore.indexOf('deliSign.position.x = doorX') >= 0 && qStore.indexOf('makePolishDeliSign(') >= 0
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
  'addCreature has case "polishboy" (makePerson walker, male)',
  addSec.indexOf('case "polishboy":') >= 0 &&
    addSec.indexOf('makePerson(') >= 0 &&
    addSec.indexOf('type === "polishboy"') >= 0
);
const aiSec = (() => {
  const u = src.indexOf('function updateCreatures(');
  const i = src.indexOf('case "polishboy":', u);
  if (i < 0) return '';
  return src.slice(i, i + 600);
})();
check(
  'polishboy falls through to the shared walker case (ped/lady/dogwalker behavior)',
  /case "polishboy":\s*\/\/[\s\S]{0,600}case "ped":/.test(aiSec) &&
    aiSec.indexOf('makePerson') < 0 // NO per-frame rebuild (construction lives in addCreature)
);
check(
  'polishboy is male (gender list)',
  /type === "escooter" \|\|\s*\n\s*type === "polishboy"/.test(src)
);

// bump lines: polite asks to stop bothering his SISTER
const bumpSec = (() => {
  const i = src.indexOf('function collideCreatures');
  if (i < 0) return '';
  return src.slice(i, i + 22000);
})();
check('bump GATE includes polishboy', bumpSec.indexOf('c.type === "polishboy"') >= 0);
[
  'Hey, please stop talking to my sister.',
  "She's my sister — please leave her be.",
  'My sister asked me to tell you to back off.',
].forEach((line) => {
  check('bump line present: "' + line + '"', bumpSec.indexOf(line) >= 0);
});
check(
  'bump: every line is about his SISTER and he never mentions a mother',
  (() => {
    const i = bumpSec.lastIndexOf('c.type === "polishboy"'); // the Voice.say branch (after the gate)
    if (i < 0) return false;
    const seg = bumpSec.slice(i, i + 400);
    return (
      /sister/i.test(seg) &&
      seg.toLowerCase().indexOf('mother') < 0 &&
      bumpSec.toLowerCase().indexOf('mother') < 0
    );
  })()
);

// spawn: exactly one per Queens level, on a random lady's block (her brother)
const spawnSec = (() => {
  const i = src.indexOf('The nice Polish boy: his SISTER');
  if (i < 0) return '';
  return src.slice(i, i + 500);
})();
check(
  'spawn: polishboy spawns (addCreature("polishboy"))',
  spawnSec.indexOf('addCreature("polishboy")') >= 0
);
check(
  'spawn: he stands on the block of a random lady (her sister is one of them)',
  spawnSec.indexOf('polishBlocks[(Math.random() * polishBlocks.length) | 0]') >= 0
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

