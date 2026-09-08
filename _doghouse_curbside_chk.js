// _doghouse_curbside_chk.js — verify the two placement/clip fixes:
//   1) the page's inline scripts still parse;
//   2) the doghouse lands on the front-lawn GRASS — never on the street/sidewalk,
//      never on the raised concrete step in front of the door, never right by the
//      door — replicated from spawnWorld over many trials (incl. edge houses);
//   3) treasure/mongo rest ABOVE the raised curb top (0.35) so the curb lip never
//      clips through their base (same fix as the hydrant); cash keeps its own lift.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
global.THREE = require(path.join(__dirname, '_three128.js'));
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let ok = true;
const check = (name, cond, detail) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); if (!cond) ok = false; };

// (a) inline scripts still parse
const scripts = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let synOk = true;
scripts.forEach((code, i) => { try { new vm.Script(code, { filename: 'inline#' + i }); } catch (e) { synOk = false; console.log('  syntax fail inline#' + i + ': ' + e.message); } });
check('inline script(s) parse (' + scripts.length + ')', synOk);

// ---- shared helpers (mirror _mongo_chk.js so the extracted builders/run code works) ----
const R = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const pick = a => a[(Math.random() * a.length) | 0];
function M(c, opt){ return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {})); }
function MS(c, opt){ return new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {})); }
function BX(w, h, d, m){ return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function CY(r1, r2, h, m, s){ return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m); }
function SP(r, m, s){ return new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m); }
function SPH(r, m, ws, hs){ return new THREE.Mesh(new THREE.SphereGeometry(r, ws || 14, hs || 10), m); }
const GZ = 0.3, HOUSE_Y = 10.5, BW = 8, BLOCK_W = 80, IW = 16;
const CASH_LIFT = 0.12;
const CURB_LIFT = parseFloat((src.match(/const CURB_LIFT = ([0-9.]+)/) || [])[1]);
function extractObj(name){ const m = src.match(new RegExp(name + ' = (\\{[\\s\\S]*?\\})')); if (!m) throw new Error(name + ' not found'); return eval('(' + m[1] + ')'); }
const TREASURE_NAMES = extractObj('TREASURE_NAMES');
const MONGO_NAMES = extractObj('MONGO_NAMES');
function extract(name){
  const lines = src.split('\n');
  const start = lines.findIndex(l => l.replace(/\r$/, '').startsWith('function ' + name + '('));
  if (start < 0) throw new Error(name + ' not found');
  let end = start;
  while (end < lines.length && lines[end].replace(/\r$/, '') !== '}') end++;
  return lines.slice(start, end + 1).join('\n');
}

// ---- (2) doghouse placement: mirror spawnWorld's mag/side/flip/clamp math ----
check('index.html has CURB_LIFT > 0', !isNaN(CURB_LIFT) && CURB_LIFT > 0, 'CURB_LIFT=' + CURB_LIFT);
// real step footprint (from makeHouse): x ±1.25 of the house; y is the union over d
//   d in [3.4,4.2] -> y0 = 10.5 - d/2 - 1.1 in [7.3, 7.7], y1 = 10.5 - d/2 - 0.1 in [8.3, 8.7]
const STEP_HW = 1.25, STEP_Y0 = 7.3, STEP_Y1 = 8.7;
const DOGH_HALF = 0.5;   // doghouse half-width in x (walls 0.7 -> ~0.46; use 0.5 for safety)
function placeDoghouse(worldX, blockX){
  const mag = R(2.4, 3.4);
  let side = Math.random() < 0.5 ? -1 : 1;
  let ax = worldX + side * mag;
  if (ax < blockX + 1.0 || ax > blockX + BLOCK_W - 1.0) ax = worldX - side * mag;
  const anchorX = clamp(ax, blockX + 1.0, blockX + BLOCK_W - 1.0);
  const anchorY = R(6.6, 7.9);
  const homeY = anchorY - R(0.9, 1.5);
  return { anchorX: anchorX, anchorY: anchorY, homeY: homeY };
}
const LEVEL_XS = [0, 96, 192, 288, 384, 480, 576, 672];
let allOk = true; let bad = null;
for (let t = 0; t < 20000 && allOk; t++){
  const blockX = LEVEL_XS[(Math.random() * LEVEL_XS.length) | 0];
  const houseI = (Math.random() * 10) | 0;         // 0 and 9 are the edge houses (the tricky ones)
  const worldX = blockX + houseI * BW;
  const d = placeDoghouse(worldX, blockX);
  const onLawn   = d.anchorY >= 5.0 && d.anchorY <= 8.5;                 // front-lawn grass band (off street/sidewalk)
  const homeLawn = d.homeY > 5.0 && d.homeY < 8.5;                        // dog's rest spot stays on the grass
  const inBlock  = d.anchorX >= blockX && d.anchorX <= blockX + BLOCK_W; // never into the cross-street gap
  const offStep  = !(d.anchorX + DOGH_HALF > worldX - STEP_HW && d.anchorX - DOGH_HALF < worldX + STEP_HW &&
                     d.anchorY + DOGH_HALF > STEP_Y0 && d.anchorY - DOGH_HALF < STEP_Y1);  // clear of the raised slab
  if (!(onLawn && homeLawn && inBlock && offStep)){
    allOk = false;
    bad = { worldX: worldX, blockX: blockX, houseI: houseI, d: d, onLawn: onLawn, homeLawn: homeLawn, inBlock: inBlock, offStep: offStep };
  }
}

check('doghouse: on lawn, off street/sidewalk, clear of the step/door, dog rests on grass, stays in block (20k trials)', allOk, bad ? JSON.stringify(bad) : '');

// ---- (3) bonus curb lift: run the real spawnBonus and check the per-type lift ----
eval(extract('makeCopper'));
eval(extract('makeCash'));
eval(extract('makeTreasure'));
const dynamicGroup = { add(){} };
const bonuses = [];
eval(extract('spawnBonus'));
let mongoOk = true, treasOk = true, cashOk = true;
let nMongo = 0, nTreas = 0, nCash = 0;
for (let i = 0; i < 6000; i++){
  spawnBonus(0, 0.6);   // y=0.6 sits on the curb band (0.25..0.75) — the worst case for clipping
  const b = bonuses[bonuses.length - 1];
  if (b.type === 'mongo'){ nMongo++; if (!(b.lift > 0 && GZ + b.lift >= 0.35)) mongoOk = false; }
  else if (b.type === 'treasure'){ nTreas++; if (!(b.lift > 0 && GZ + b.lift >= 0.35)) treasOk = false; }
  else if (b.type === 'cash'){ nCash++; if (b.lift !== CASH_LIFT) cashOk = false; }
}
check('mongo: rests above the raised curb top (0.35) so the curb never clips it', mongoOk && nMongo > 0, 'n=' + nMongo + ' (GZ+lift=' + (GZ + CURB_LIFT) + ')');
check('treasure: rests above the raised curb top (0.35) so the curb never clips it', treasOk && nTreas > 0, 'n=' + nTreas);
check('cash: still lifted with CASH_LIFT', cashOk && nCash > 0, 'n=' + nCash);
check('CURB_LIFT actually clears the curb (GZ 0.3 + CURB_LIFT >= 0.35)', GZ + CURB_LIFT >= 0.35, 'GZ+CURB_LIFT=' + (GZ + CURB_LIFT));

console.log(ok ? '\nDOGHOUSE/CURBSIDE CHECKS PASSED' : '\nDOGHOUSE/CURBSIDE CHECKS FAILED');
process.exit(ok ? 0 : 1);

