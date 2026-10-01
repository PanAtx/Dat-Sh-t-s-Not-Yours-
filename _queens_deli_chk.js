// _queens_deli_chk.js — verify the GUTTED "Polish deli" feature is fully
// removed from index.html (the boy was redesigned: ONE PER LADY on HER block,
// bump-gated bout, 12s temper, counter-punch exit — see _polish_advances_chk.js):
//   - no makePolishDeliSign builder, no /DELI/i store wiring
//   - no queensStoreSpots collection
//   - no proximity aggro / "recognized" recognition lines (the bump gate is the
//     only trigger; the boy's lines are POLISH_CURSES spat in the bout)
//   - no store/deli spawn (the boy spawns per lady, on her block)
//   - all inline scripts still parse
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

// ================= 1. DELI FEATURE REMOVED =================
const count = (t) => src.split(t).length - 1;
const has = (t) => src.indexOf(t) >= 0;
check('makePolishDeliSign builder REMOVED (count = 0)', count('makePolishDeliSign') === 0);
check('the /DELI/i store-name -> poster wiring REMOVED (count = 0)', count('/DELI/i') === 0);
check('deliSign poster reference REMOVED (count = 0)', count('deliSign') === 0);
check('queensStoreSpots (reserved store spots) REMOVED (count = 0)', count('queensStoreSpots') === 0);
check('c.recognized (old proximity aggro) REMOVED (count = 0)', count('c.recognized') === 0);
check('the old 14s aggro temper REMOVED (count = 0)', count('aggroT = 14') === 0);
check('the old 18s bump temper REMOVED (count = 0)', count('aggroT = 18') === 0);
check('the old 11u proximity aggro gate REMOVED (count = 0)', count('pd < 11') === 0 && count('adist < 11') === 0);
// delis still exist as STORE NAMES (just names, no feature) — the name pool still lists delis
check('deli store names still present in the name pool (word-boundary)', (src.match(/DELI\b/g) || []).length >= 3);

// ================= 2. BUMP-GATED LITTLE-BROTHER AGGRO WIRED IN =================
// One boy per Polish lady (spawned on HER block), armed ONLY by the worker's
// arcade BUMP on his sister (collideCreatures), 12s temper, counter-punch exit.
check('one boy per lady: polishLadies[] drives the spawn loop', has('polishLadies') && has('for (const pl of polishLadies)'));
check('the boy is parented to his sister (pb.sis = pl.pw)', has('pb.sis = pl.pw'));
check('the boy loiters on his sister\'s block (pb.loiter)', has('pb.loiter'));
check('BUMP gate: the collide branch re-arms the bumped lady\'s brother (boy.aggro = true)', has('boy.aggro = true') && has('boy.hot = true'));
check('BUMP gate sets the 12s temper (boy.aggroT = 12)', has('boy.aggroT = 12'));
check('a NEW bump cancels a mid-flee scare (boy.scareT = 0; boy.scared = false)', has('boy.scareT = 0') && has('boy.scared = false'));
check('the counter-punch exit sets c.scared = true + c.scaredT = 6 in landPunch', has('c.scared = true') && has('c.scaredT = 6'));
check('the scared-leash preempts the AI (if (c.scared))', has('if (c.scared)'));
check('the temper expiry cools the bout (c.aggroT -= dt)', has('c.aggroT -= dt'));
// written-up offense lines (unchanged by the redesign)
check(
  'WRITTEN UP!: polishboy has its own offense lines',
  /polishboy:\s*\[[\s\S]{0,200}Failure to respect a concerned younger brother/.test(src)
);

// flying cans can hit him too (unchanged by the redesign)
check(
  'flying cans: polishboy is a hittable civilian',
  src.indexOf('c.type === "polishboy"') >= 0
);

console.log(
  pass ? '\nQUEENS DELI REMOVAL + BUMP-GATE WIRING: ALL PASS' : '\nQUEENS DELI REMOVAL + BUMP-GATE WIRING: FAILURES ABOVE'
);
process.exit(pass ? 0 : 1);

