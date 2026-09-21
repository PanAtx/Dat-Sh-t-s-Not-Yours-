// _cat_spawn_chk.js — verify the bodega cat spawn (Manhattan + Bronx + Flatbush +
// Queens): exactly 4 cats on 4 different active blocks, sitting on the sidewalk in
// front of the store (Manhattan/Queens: bl.x + 3.0 / the corner-store door, wy 4.5) —
// or perched ON the store mat at the door (Bronx: bl.x - 2.6, wy 6.7; Flatbush: the
// left corner store's mat at bl.x + 0.65, wy 7.6) — one of each coat (tuxedo / grey /
// orange / tabby, with the Bronx-only white & grey "mott" and the Queens-only
// three-patch "calico" replacing plain grey on their levels), and that the old debug
// cat modes are fully gone (per-block "easy visibility" loop, magenta glow,
// debugNoFlee flag).

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let ok = true;
const check = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) ok = false;
};

// ---- extract the bodega-cat spawn block from spawnWorld (Manhattan + Bronx + Flatbush) ----
const spIdx = src.indexOf('// Bodega cats: Manhattan + Bronx + Flatbush only.');
if (spIdx < 0) { console.error('bodega cat spawn block not found'); process.exit(1); }
const spEnd = src.indexOf('spawnPowerups(', spIdx);
const spawnBlock = src.slice(spIdx, spEnd);

// ---- 1) source: spawn count + placement ----
check('exactly 4 cats per cat level (loop runs i < 4)', /for \(let i = 0; i < 4; i\+\+\)/.test(spawnBlock));
check('no per-block "easy visibility" debug loop remains', spawnBlock.indexOf('for easy visibility') < 0 && spawnBlock.indexOf('LEVEL_BLOCKS.length') < 0);
check('cats spread over 4 DIFFERENT active shift blocks (indices 1-5)', /const active = \[1, 2, 3, 4, 5\]/.test(spawnBlock) && /const catBlocks = active\.slice\(0, 4\)/.test(spawnBlock));
check('cats sit in front of the store door on the block (bl.x + 3.0)', /bc\.wx = bl\.x \+ 3\.0/.test(spawnBlock));
check('cats sit on the sidewalk in front of the store (wy = 4.5)', /bc\.wy = 4\.5/.test(spawnBlock));
check('Manhattan + Bronx + Flatbush gate applies', /if \(isManhattanLevel\(\) \|\| isBronxLevel\(\) \|\| isFlatbushArea\)/.test(spawnBlock));
check('gate is NOT applied to other boroughs (no bare isManhattanLevel gate)', spawnBlock.indexOf('if (isManhattanLevel())') < 0);
check('Flatbush gate is area-gated (Bed-Stuy, also BROOKLYN, stays cat-free)',
  spawnBlock.indexOf('const isFlatbushArea = borough === "BROOKLYN" && area === "FLATBUSH";') >= 0);
check('Bronx cats can perch ON the store mat at the door (bl.x - 2.6, wy 6.7)',
  /isBronxLevel\(\) \|\| isFlatbushArea\) && Math\.random\(\) < 0\.5/.test(spawnBlock) &&
  /bc\.wx = bl\.x - 2\.6/.test(spawnBlock) && /bc\.wy = 6\.7/.test(spawnBlock));
check('Flatbush cats perch ON the left corner store mat (bl.x + 0.65, wy 7.6)',
  /bc\.wx = bl\.x \+ 0\.65/.test(spawnBlock) && /bc\.wy = 7\.6/.test(spawnBlock));
check('Queens (Maspeth) cats: dedicated Manhattan-style block gated on isQueensLevel()',
  spawnBlock.indexOf('Maspeth bodega cats') >= 0 && /if \(isQueensLevel\(\)\) \{/.test(spawnBlock));
check('Queens cats face their block corner store door (frozen corner: bl.x + 0.65 left / bl.x + 79.35 right) on the sidewalk (wy 4.5)',
  /QUEENS_STORE_CORNERS\[catBlocks\[i\]\] \? 0\.65 : 79\.35/.test(spawnBlock) &&
  /bc\.wy = 4\.5; \/\/ on the sidewalk in front of the storefront/.test(spawnBlock));
check('Queens levels swap in the three-patch "calico" coat (replaces plain grey, like the Bronx mott)',
  spawnBlock.indexOf('["calico", "tuxedo", "orange", "tabby"]') >= 0);
check('every cat gets a chase ceiling (yMax) so mat cats never snap to the street',
  /bc\.yMax = Math\.max\(4\.5, bc\.wy\)/.test(spawnBlock) &&
  /c\.yMax = 4\.5/.test(src) &&
  /clamp\(c\.wy \+ \(p\.wy - c\.wy\) \* dt \* 3, 0\.5, c\.yMax\)/.test(src));

// ---- 2) source: coats wired through the spawn chain ----
check('CAT_PALETTES defines all coats (tuxedo/grey/orange/tabby + Bronx-only mott + Queens-only calico)',
  ['tuxedo', 'grey', 'orange', 'tabby', 'mott', 'calico'].every(k => spawnBlock.indexOf(k) >= 0 || (function () { const i = src.indexOf('const CAT_PALETTES = {'); return i >= 0 && src.slice(i, src.indexOf('};', i)).indexOf(k + ':') >= 0; })()));
check('Bronx levels swap in the white & grey "mott" coat; Manhattan + Flatbush keep their four',
  /const coats = isBronxLevel\(\)/.test(spawnBlock) &&
  /\["mott", "tuxedo", "orange", "tabby"\]/.test(spawnBlock) &&
  /\["tuxedo", "grey", "orange", "tabby"\]/.test(spawnBlock));
check('addCreature receives the palette (opts object)', /addCreature\("cat", \{ palette: coats\[i\] \}\)/.test(spawnBlock));
check('addCreature(type, opts) merges per-spawn overrides into the creature', /function addCreature\(type, opts\)/.test(src) && /if \(opts\) for \(const k in opts\) c\[k\] = opts\[k\]/.test(src));
check('case "cat" builds the model from c.palette', /c\.palette = c\.palette \|\| "orange"/.test(src) && /c\.data = makeCat\(c\.palette\)/.test(src));
check('cats still spawned outside npcCounts (BASE_NPC_COUNTS cat: 0)', /cat: 0,/.test(src));

// ---- 3) source: all debug cat modes are fully removed ----
check('no debugNoFlee flag left anywhere in the cat AI or spawn', src.indexOf('debugNoFlee') < 0);
check('no magenta debug glow (0xff00ff) left anywhere (the truck debug box was removed)', src.indexOf('0xff00ff') < 0);
check('no DEBUG cat comments left in the spawn code', spawnBlock.indexOf('DEBUG') < 0);
// ---- 4) behavioral: the REAL makeCat builds all 4 coats with their colors ----
function extractBlock(openText, closeText) {
  const idx = src.indexOf(openText);
  if (idx < 0) throw new Error('not found: ' + openText);
  const end = src.indexOf(closeText, idx);
  if (end < 0) throw new Error('no close for: ' + openText);
  return src.slice(idx, end + closeText.length);
}
const palettesSrc = extractBlock('const CAT_PALETTES = {', '};');
function extractFn(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function not found: ' + name);
  const b = src.indexOf('{', idx); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(idx, i);
}
// Material shim that records the color it was made with, so we can assert
// each coat's real hex values reach the model.
const MATLOG = [];
const factory = new Function('M',
  palettesSrc + '\n' + extractFn('makeCat') + '\nreturn { CAT_PALETTES, makeCat };');
const { CAT_PALETTES } = factory(function (c) { MATLOG.push(c); return { color: { getHex: () => c } }; });
const factory2 = new Function('M',
  'function TGroup(){this.children=[];this.rotation={x:0,y:0,z:0,set:function(){}};this.position={x:0,y:0,z:0,set:function(){}};this.scale={x:1,y:1,z:1,set:function(){}};this.userData={};this.add=function(c){this.children.push(c);};}' +
  'function TMesh(){this.rotation={x:0,y:0,z:0,set:function(){}};this.position={x:0,y:0,z:0,set:function(){}};this.scale={x:1,y:1,z:1,set:function(){}};}' +
  'var THREE={Group:TGroup};' +
  palettesSrc + '\n' + extractFn('makeCat') +
  '\nfunction SPH(r, m){var o=new TMesh();o.material=m;return o}\nfunction BX(w,h,d,m){var o=new TMesh();o.material=m;return o}\n' +
  'function CY(rT,rB,h,m,s){var o=new TMesh();o.material=m;return o}\nfunction CONE(r,h,m,s){var o=new TMesh();o.material=m;return o}\n' +
  'function pick(a){return a[0]}\nfunction R(a,b){return a}\n' +
  'return makeCat;');
const makeCatLive = factory2(function (c) { MATLOG.push(c); return { color: { getHex: () => c } }; });

const names = Object.keys(CAT_PALETTES);
check('6 coat palettes defined in index.html (4 standard + Bronx-only mott + Queens-only calico)', names.length === 6, JSON.stringify(names));
const furColors = [];
let allBuild = true;
for (const n of names) {
  MATLOG.length = 0;
  let built = false;
  try {
    const cat = makeCatLive(n);
    built = !!cat && cat.userData && cat.userData.cat && cat.userData.cat.headPivot;
  } catch (e) { /* logged below */ }
  const pal = CAT_PALETTES[n];
  const has = (c) => MATLOG.indexOf(c) >= 0;
  const coatOk = has(pal.fur) && has(pal.light) && has(pal.furD) && has(pal.eye);
  furColors.push(pal.fur);
  check('makeCat("' + n + '") builds and uses its ' + n + ' coat colors', built && coatOk,
    'fur=' + pal.fur.toString(16) + ' light=' + pal.light.toString(16) + ' furD=' + pal.furD.toString(16) + ' eye=' + pal.eye.toString(16));
  allBuild = allBuild && built && coatOk;
}
check('all 6 fur colors are visually distinct', new Set(furColors).size === 6, furColors.map(c => '0x' + c.toString(16)).join(', '));

// Default (no arg) must still build the original orange cat
MATLOG.length = 0;
try { makeCatLive(); } catch (e) { }
check('makeCat() with no palette still builds the original orange cat',
  MATLOG.indexOf(CAT_PALETTES.orange.fur) >= 0);

console.log(ok ? '\nALL CAT-SPAWN CHECKS PASSED' : '\nCAT-SPAWN CHECKS FAILED');
process.exit(ok ? 0 : 1);

