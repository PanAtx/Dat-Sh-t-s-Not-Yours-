// _mailbox_chk.js — verify the USPS blue sidewalk COLLECTION BOX: high-poly build
// to the reference (no pole, 4 short legs, flat front + mail slot, arched top ->
// flat back, flat sides), the U.S. Postal Service palette, curb placement at the
// FIRST CORNER of Block 2, walker-avoidance registration, and Node-safe (no DOM)
// construction.
const fs = require('fs');
const path = require('path');
global.THREE = require(path.join(__dirname, '_three128.js'));

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extract(name){
  // brace-counted (works for indented source)
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found');
  const brace = src.indexOf('{', idx);
  let depth = 0, i = brace;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}

function M(c, opt){ return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {})); }
function MS(c, opt){ return new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {})); }
function BX(w, h, d, m){ const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.castShadow = true; return q; }
function CY(r1, r2, h, m, s){ const q = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m); q.castShadow = true; return q; }
function SP(r, m, s){ const q = new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m); q.castShadow = true; return q; }
const GZ = 0.3;

eval(extract('makeUspsEagleTexture'));
eval(extract('makeCollectionTimesTexture'));
eval(extract('makeMailboxMesh'));
eval(extract('addMailbox'));
eval(extract('addManhole'));

let ok = true;
const check = (label, cond, extra) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (extra ? '  [' + extra + ']' : '')); if (!cond) ok = false; };

// ---- 1) builds without a DOM (Node smoke test) -------------------------------
const added = [];
const b = { worldX: 96, group: { add(x){ added.push(x); } }, hazards: [], trees: [] };
let threw = null, built = null;
try { addMailbox(b, 98.4, 1.5); } catch (e){ threw = e; }
built = added[0] || null;
check('addMailbox builds a Group without a DOM' + (threw ? '  [' + threw.message + ']' : ''), !threw && built && Array.isArray(built.children));

// ---- 2) placement: on the curb top, offset by the block's worldX -------------
check('rests ON the curb (GZ+0.05) and offset by worldX', built && Math.abs(built.position.z - (GZ + 0.05)) < 1e-6 && Math.abs(built.position.x - (98.4 - 96)) < 1e-6 && Math.abs(built.position.y - 1.5) < 1e-6);
check('registers a solid obstacle in b.trees (walkers route around)', b.trees.length === 1 && b.trees[0].wx === 98.4 && b.trees[0].wy === 1.5);
check('does NOT add a worker hazard (decorative, like a tree)', b.hazards.length === 0);

// ---- 3) high-poly + reference collection-box shape + USPS palette -------------
let tris = 0, meshes = 0;
const mats = new Set();
built && built.traverse(ch => {
  meshes++;
  if (ch.geometry) {
    const idx = ch.geometry.index;
    tris += idx ? idx.count / 3 : ch.geometry.attributes.position.count / 3;
  }
  if (ch.material) mats.add(ch.material);
});
check('high-poly build (>1500 triangles): got ' + Math.round(tris), tris > 1500);
check('detailed build (15+ meshes): got ' + meshes, meshes >= 15);
const has = (hex) => [...mats].some(m => m.color && m.color.getHex() === hex);
check('USPS ROYAL NAVY body (0x20388e)', has(0x20388e));
check('deep blue door + feet (0x1a2f78)', has(0x1a2f78));
check('dark seams / slot frame / rivets (0x121f52)', has(0x121f52));
check('near-black MAIL SLOT opening (0x0a0d14)', has(0x0a0d14));
check('white logo / times plates (0xf4f6f8)', has(0xf4f6f8));
check('brass keyhole escutcheon (Standard 0x9a7b2d)', [...mats].some(m => m.type === 'MeshStandardMaterial' && m.color && m.color.getHex() === 0x9a7b2d));
check('no red flag / chrome handle left over (matches reference)', !has(0xc8102e) && !has(0xd8dce0));
check('eagle + times canvas textures Node-guarded (null in Node)', makeUspsEagleTexture() === null && makeCollectionTimesTexture() === null);
// the reference shape: NO pole, four short legs, low tombstone box on feet
const geos = [];
built && built.traverse(ch => { if (ch.geometry) geos.push(ch.geometry); });
check('NO long pole: no tall cylinder (all cyl h <= 0.1)', geos.every(g => g.type !== 'CylinderGeometry' || (g.parameters && g.parameters.height <= 0.1)));
check('four FLANGED FEET (0.17 boxes): got ' + geos.filter(g => g.type === 'BoxGeometry' && g.parameters.width === 0.17).length, geos.filter(g => g.type === 'BoxGeometry' && g.parameters.width === 0.17).length === 4);
check('four short LEGS (0.09 boxes): got ' + geos.filter(g => g.type === 'BoxGeometry' && g.parameters.width === 0.09).length, geos.filter(g => g.type === 'BoxGeometry' && g.parameters.width === 0.09).length === 4);
check('26 RIVETS (spheres r=0.012): got ' + geos.filter(g => g.type === 'SphereGeometry' && g.parameters.radius === 0.012).length, geos.filter(g => g.type === 'SphereGeometry' && g.parameters.radius === 0.012).length === 26);
check('tombstone body: extruded 32-seg arch, 0.72 long along street', (() => { const ex = geos.find(g => g.type === 'ExtrudeGeometry'); const op = ex && ((ex.parameters && ex.parameters.options) || ex.parameters); return !!ex && op.curveSegments === 32 && op.depth === 0.72; })());
check('low box on legs: no child above 1.8u', built && built.children.every(ch => ch.position.z < 1.8));

// ---- 4) the level places it at the FIRST CORNER of Block 2 --------------------
check('gated to Block 2 house 0 (baseX === 96 && houseIdx === 0)', /baseX === 96 && houseIdx === 0\)\s*addMailbox\(b, baseX \+ 2\.4, 1\.5\)/.test(src));
check('the random sidewalk tree is suppressed on that house', /Math\.random\(\) < 0\.5 && !\(baseX === 96 && houseIdx === 0\)/.test(src));
check('mailbox world x=98.4 is inside Block 2 (96..176) and hugs its first corner', 98.4 > 96 && 98.4 < 102);
check('mailbox world y=1.5 is on the near sidewalk (curb 0.5 .. grass 5.0)', 1.5 > 0.5 && 1.5 < 5.0);
check('disposeObj frees canvas label textures (no GPU leak on level rebuild)', /if \(m\.map\) m\.map\.dispose\(\);/.test(src));

// ---- 5) addManhole survived the neighboring edit (regression: dropped `hole` line) ----
const added2 = [];
const b2 = { worldX: 100, group: { add(x){ added2.push(x); } }, hazards: [] };
let threw2 = null;
try { addManhole(b2, 105, -5); } catch (e){ threw2 = e; }
check('addManhole builds without throwing (hole declaration intact)' + (threw2 ? '  [' + threw2.message + ']' : ''), !threw2 && added2.length === 1);
check('manhole registers a trip hazard', b2.hazards.length === 1 && b2.hazards[0].type === 'trip');
check('manhole has the dark hole mesh (0x0a0c0e)', added2[0] && added2[0].children.some(ch => ch.material && ch.material.color && ch.material.color.getHex() === 0x0a0c0e));

console.log(ok ? 'MAILBOX ALL CHECKS PASS' : 'MAILBOX FAILURES');
process.exit(ok ? 0 : 1);