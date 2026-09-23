// _queens_polish_chk.js — verify the Maspeth (Queens) pass in index.html:
//   - no hookers spawn on Queens (day 4); the Polish women replace them
//   - makePolishGirl: caucasian skin ONLY, blond-or-black hair, random-color dress,
//     hooker-class body (mini dress + stilettos), expensive gold purse in hand
//   - addCreature("polish"): female voice, builds without throwing
//   - AI: poised idle (subtle sway), off-screen recycle ahead of the worker (42u >> 15u)
//   - bump: gate includes polish + all 5 snark lines, speaker "polish" (bub-polish)
//   - spawn: exactly ONE per active block, sidewalk or front lawn, safe 10..70 x-window
//   - dog count scaled by week score: $5000+ = 4 dogs, else 2
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
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
// --- minimal three.js stub (same as _newnpc_chk.js) ---
const THREE = {
  Group: class {
    constructor() {
      this.children = [];
      this.position = { set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.rotation = { x: 0, y: 0, z: 0 };
      this.scale = { set(x, y, z) { this.x = x; this.y = y; this.z = z; }, setScalar(s) { this.x = this.y = this.z = s; } };
      this.userData = {};
      this.visible = true;
    }
    add(o) { this.children.push(o); return o; }
    remove(o) { this.children.splice(this.children.indexOf(o), 1); }
  },
  Mesh: class { constructor(g, m) { Object.assign(this, new THREE.Group()); this.geometry = g; this.material = m; } },
  MeshLambertMaterial: function (o) { return o || {}; },
  SphereGeometry: class { constructor(r, ws, hs) {} },
  BoxGeometry: class { constructor(w, h, d) {} },
  CylinderGeometry: class { constructor(r1, r2, h, s) {} },
  ConeGeometry: class { constructor(r, h, s) {} },
  TorusGeometry: class { constructor(r, t) {} },
  PlaneGeometry: class { constructor(w, h) {} },
  DoubleSide: 2,
};
const M = (c, o) => Object.assign({ color: c }, o || {});
const MS = (c, o) => Object.assign({ color: c, metalness: .95 }, o || {});
function BX(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function CY(r1, r2, h, m, s) { return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m); }
function SP(r, m, s) { return new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m); }
function SPH(r, m, ws, hs) { return new THREE.Mesh(new THREE.SphereGeometry(r, ws || 14, hs || 10), m); }
const pick = (a, n) => a[n || 0];
// Maspeth palettes (top-level in the game; the builder references them):
const POLISH_SKIN = [0xf7d9bc, 0xf3c6a5, 0xe8b48c];
const POLISH_HAIR = [0xe8c877, 0xd9b36c, 0xc9a35a, 0x111111, 0x1c1c1e];
const POLISH_DRESSES = [0x3a5f8a, 0x7a2d5c, 0x2d6b4f, 0x8a2d4e, 0x4a4a7a, 0xb08a3e];

let pass = true;
const check = (n, c, e) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  [' + e + ']')); if (!c) pass = false; };

// ================= 1. THE MODEL (makePolishGirl) =================
eval(extract('makePolishGirl'));
const mk = extract('makePolishGirl');
// caucasian skin ONLY — no SKIN_TONES, and every skin hex is a fair tone
const FAIR = [/0xf7d9bc/, /0xf3c6a5/, /0xe8b48c/, /0xf5d7bd/, /0xffe0bd/, /0xffd7b0/];
const skinLine = (src.match(/const POLISH_SKIN = \[[^\]]*\]/) || [''])[0];
const skinHexes = skinLine.match(/0x[0-9a-f]{6}/gi) || [];
check('polish girl: skin palette exists and is caucasian-only (no SKIN_TONES)',
  skinHexes.length >= 2 && mk.indexOf('SKIN_TONES') < 0, 'skinLine=' + skinLine);
check('polish girl: every skin hex is a fair tone', skinHexes.every((h) => FAIR.some((r) => r.test(h))), JSON.stringify(skinHexes));
// blond or black hair
const hairLine = (src.match(/const POLISH_HAIR = \[[^\]]*\]/) || [''])[0];
const hairHexes = hairLine.match(/0x[0-9a-f]{6}/gi) || [];
const isBlond = (h) => {
  const n = parseInt(h.slice(2), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r > 150 && g > 120 && b < 140;
};
const isBlack = (h) => {
  const n = parseInt(h.slice(2), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r < 60 && g < 60 && b < 60;
};
check('polish girl: hair palette has blond AND black', hairHexes.length >= 2 && hairHexes.some(isBlond) && hairHexes.some(isBlack), JSON.stringify(hairHexes));
// random-color dress (4+ distinct colors)
const dressLine = (src.match(/const POLISH_DRESSES = \[[^\]]*\]/s) || [''])[0];
const dressHexes = dressLine.match(/0x[0-9a-f]{6}/gi) || [];
check('polish girl: dress palette has 4+ distinct colors (unique per block)', new Set(dressHexes).size >= 4, JSON.stringify(dressHexes));
// unique dress per block: builder takes dressColor, queue feeds one per lady
check('makePolishGirl takes a dressColor param (overrides the random pick)',
  src.indexOf('function makePolishGirl(dressColor)') >= 0 &&
  src.indexOf('dressColor != null ? dressColor : pick(POLISH_DRESSES)') >= 0);
// hooker-class body: cone mini-skirt + stiletto spikes
check('polish girl: wears the hooker-class dress (cone mini-skirt)', mk.indexOf('ConeGeometry(0.27, 0.55, 12') >= 0);
check('polish girl: stiletto heels', mk.indexOf('stiletto') >= 0 && mk.indexOf('spike') >= 0);
// expensive gold purse
const bag = makePolishGirl();
check('polish girl: builds with parts + exposed purse', !!bag.userData.parts && !!bag.userData.bag);
check('polish girl: purse is shiny gold (MS 0xd4af37) with clasp + handle',
  mk.indexOf('MS(0xd4af37)') >= 0 && mk.indexOf('clasp') >= 0 && mk.indexOf('TorusGeometry') >= 0);
check('polish girl: 6+ top-level body parts', bag.children.length >= 6, 'children=' + bag.children.length);

// ================= 2. SPAWN ROSTER (npcCounts) =================
check('npcCounts: hookers are zeroed on Queens (day 4)',
  /if\s*\(\s*day\s*===\s*4\s*&&\s*t\s*===\s*"hooker"\s*\)\s*base\s*=\s*0\s*;/.test(src));
check('npcCounts: polish is base 0 (spawned by the dedicated block, like crazy/dealer)',
  /polish:\s*0\s*,/.test(src.slice(src.indexOf('const BASE_NPC_COUNTS'), src.indexOf('const SCALING_NPC'))));

// ================= 3. addCreature WIRING =================
const addSec = extract('addCreature');
check('addCreature: case "polish" builds makePolishGirl',
  /case\s+"polish":/.test(addSec) && /makePolishGirl\(pdress\)/.test(addSec));
check('addCreature: polish voice gender is female',
  /type\s*===\s*"lady"\s*\|\|\s*type\s*===\s*"hooker"\s*\|\|\s*type\s*===\s*"polish"/.test(addSec));

// ================= 4. AI (updateCreatures) =================
const aiCase = (() => {
  const i = src.indexOf('case "polish": {');
  if (i < 0) return '';
  return src.slice(i, i + 900);
})();
check('AI: case "polish" exists with a subtle (poised) sway',
  aiCase.indexOf('c.swayT += dt') >= 0 && /Math\.sin\(c\.swayT \* 0\.7\) \* 0\.04/.test(aiCase));
check('AI: NEVER recycles — each block keeps its own lady (no tx < -55 teleport)',
  aiCase.indexOf('NEVER recycles') >= 0 && aiCase.indexOf('tx < -55') < 0 && aiCase.indexOf('p.wx + 42') < 0);

// ================= 5. BUMP LINES (collideCreatures) =================
const bumpSec = src.slice(src.indexOf('function collideCreatures'), src.indexOf('function collideCreatures') + 16000);
check('bump GATE includes polish (so she actually says something)',
  /c\.type === "jacker" \|\|[\s\S]{0,120}c\.type === "polish" \|\|/.test(bumpSec));
[
  "You're not Polish!",
  'I\'m looking for a nice Polish boy',
  'Not interested.',
  'Nie lubię Amerykanów.',
  'Go away!',
].forEach((line) => {
  check('bump line present: "' + line + '"', bumpSec.indexOf('"' + line + '"') >= 0);
});
check('bump: speaks with the "polish" speaker id (female voice)',
  /c\.type === "polish"\)\s*\n\s*Voice\.say\([\s\S]{0,500}"polish",/.test(bumpSec) && bumpSec.indexOf('c.gender') >= 0);

// ================= 6. BUBBLE STYLE =================
check('bubble CSS: .bub-polish defined', /bubble\.bub-polish/.test(src));
check('bubble mapping: speaker "polish" -> bub-polish',
  /speaker === "polish"\) cls = "bubble bub-polish"/.test(src));

// ================= 7. SPAWN BLOCK: ONE PER ACTIVE BLOCK =================
const spawnSec = (() => {
  const i = src.indexOf('Maspeth Polish women');
  if (i < 0) return '';
  return src.slice(i, i + 1400);
})();
check('spawn block: gated to Queens', spawnSec.indexOf('if (isQueensLevel())') >= 0);
check('spawn block: one per ACTIVE block (garbage === true, x 96..576)',
  spawnSec.indexOf('b.garbage === true') >= 0 && spawnSec.indexOf('b.x >= 96') >= 0 && spawnSec.indexOf('b.x <= 576') >= 0);
check('spawn block: x kept in the safe 10..70 window (no corner-store frontage)',
  spawnSec.indexOf('bl.x + 10 + R(0, 60)') >= 0);
check('spawn block: sidewalk OR front lawn (50/50)',
  spawnSec.indexOf('onLawn') >= 0 && spawnSec.indexOf('R(5.0, 7.0)') >= 0 && spawnSec.indexOf('R(1.4, 4.2)') >= 0);
check('spawn block: faces the street (-PI/2, like the hooker)',
  spawnSec.indexOf('pw.g.rotation.z = -Math.PI / 2') >= 0);
check('spawn block: dresses UNIQUE per block (palette shuffled into polishDressQueue)',
  spawnSec.indexOf('polishDressQueue') >= 0 &&
  spawnSec.indexOf('POLISH_DRESSES.slice().sort(() => Math.random() - 0.5)') >= 0 &&
  src.indexOf('let polishDressQueue = []') >= 0 &&
  addSec.indexOf('polishDressQueue.shift()') >= 0 &&
  addSec.indexOf('makePolishGirl(pdress)') >= 0);
check('spawn: one nice Polish boy per Queens level, loitering in front of a corner store (her brother)',
  src.indexOf('addCreature("polishboy")') >= 0 &&
  src.indexOf('queensStoreSpots') >= 0 &&
  src.indexOf('pb.loiter') >= 0);

// ================= 8. DOG COUNT SCALED BY SCORE =================
const dogSec = (() => {
  const i = src.indexOf('const dogCount = (isFlatbushLevel() || isStatenIslandLevel())');
  if (i < 0) return '';
  return src.slice(i, i + 380);
})();
check('Maspeth dogs: 4 on hard routes (weekScore >= 5000), 2 on easy routes',
  /isQueensLevel\(\)\s*\?\s*weekScore\s*>=\s*5000\s*\?\s*4\b/.test(dogSec) && /:\s*2\b/.test(dogSec));

// ================= 9. WRITTEN-UP STAMP =================
check('WRITTEN UP!: polish has its own offense lines',
  /polish:\s*\[[\s\S]{0,200}Failure to present valid Polish documentation/.test(src));

// ================= 10. FLYING CANS CAN HIT HER =================
const canSec = extract('checkFlyingCanNpcHit');
check('flying cans: polish is a hittable civilian', canSec.indexOf('c.type === "polish"') >= 0);
check('flying cans: polishboy is a hittable civilian too', canSec.indexOf('c.type === "polishboy"') >= 0);

console.log(pass ? '\nQUEENS POLISH CHECK: ALL PASS' : '\nQUEENS POLISH CHECK: FAILURES ABOVE');
process.exit(pass ? 0 : 1);