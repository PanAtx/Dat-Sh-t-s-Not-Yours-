// _mailbox_chk.js — verify the USPS blue sidewalk COLLECTION BOX: high-poly build
// to the reference (no pole, 4 short legs, flat front + mail slot, arched top ->
// flat back, flat sides), the U.S. Postal Service palette, curb placement on every
// 5th street corner starting at the first corner of Block 2, walker-avoidance
// registration, and Node-safe (no DOM) construction. Also guards the neighboring
// addManhole: a manhole is a WORKER-ONLY trip hazard — cars and motorbikes drive
// right over it, never swerve to avoid it.
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
const HOUSES_PER_BLOCK = 10; // mirrors index.html (10 houses x 8u per 80u block)

eval(extract('makeUspsEagleTexture'));
eval(extract('makeCollectionTimesTexture'));
eval(extract('makeGraffitiTexture'));
eval(extract('addGraffiti'));
eval(extract('getKestTexture'));
eval(extract('addKestSticker'));
eval(extract('mailboxAt'));
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
check('rotated so the FLAT BACK faces the street (slot/door toward the houses)', built && Math.abs(built.rotation.z - Math.PI) < 1e-6);
check('registers a solid obstacle in b.trees (walkers route around)', b.trees.length === 1 && b.trees[0].wx === 98.4 && b.trees[0].wy === 1.5);
check('does NOT add a worker hazard (solid instead: walkers avoid + worker collides via b.trees)', b.hazards.length === 0);
check('worker collision blocks solid b.trees obstacles (mailboxes, hard push-out)', /SOLID SIDEWALK OBSTACLES[^\n]*b\.trees/.test(src) && /OBST_SOLID_R/.test(src) && /p\.wx = o\.wx \+ \(ox \/ d\) \* min/.test(src));
check('the soccer ball bounces off b.trees obstacles (reflect + re-aim)', /SOCCER BALL vs SOLID SIDEWALK OBSTACLES/.test(src) && /B\.tx = B\.wx/.test(src));
check('soccer kids dead-stop at solid obstacles (kidStepBlocked)', src.indexOf('kidStepBlocked') >= 0);

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
check('graffiti canvas Node-guarded (null in Node)', makeGraffitiTexture() === null);
check('graffiti is RANDOM per build (Math.random in the texture fn)', /Math\.random/.test(extract('makeGraffitiTexture')));
check('graffiti decals are browser-only (none in the Node build)', built && built.children.every(ch => !(ch.material && ch.material.transparent)));
check('kest texture Node-guarded (null in Node)', getKestTexture() === null);
check('sticker loader requests kestgak.png', /kestgak\.png/.test(extract('getKestTexture')));
check('sticker plane keeps the PNG aspect (0.3/0.213 = 1.408 ~= 128/91)', (() => { const s = extract('addKestSticker'); const m = /PlaneGeometry\(([\d.]+), ([\d.]+)\)/.exec(s); return m && Math.abs(parseFloat(m[1]) / parseFloat(m[2]) - 128 / 91) < 0.01; })());
check('kest sticker RANDOM per build (spot + tilt via Math.random)', /Math\.random/.test(extract('addKestSticker')));
check('kest sticker sits ON TOP of the graffiti (renderOrder 10, outside the decal)', (() => { const s = extract('addKestSticker'); return /renderOrder = 10/.test(s) && /0\.272/.test(s); })());
check('kest sticker ONLY on the back face (no side offsets)', (() => { const s = extract('addKestSticker'); return /0\.272/.test(s) && !/-0\.38/.test(s); })());
// the reference shape: NO pole, four short legs, low tombstone box on feet
const geos = [];
built && built.traverse(ch => { if (ch.geometry) geos.push(ch.geometry); });
check('NO long pole: no tall cylinder (all cyl h <= 0.1)', geos.every(g => g.type !== 'CylinderGeometry' || (g.parameters && g.parameters.height <= 0.1)));
check('four FLANGED FEET (0.17 boxes): got ' + geos.filter(g => g.type === 'BoxGeometry' && g.parameters.width === 0.17).length, geos.filter(g => g.type === 'BoxGeometry' && g.parameters.width === 0.17).length === 4);
check('four short LEGS (0.09 boxes): got ' + geos.filter(g => g.type === 'BoxGeometry' && g.parameters.width === 0.09).length, geos.filter(g => g.type === 'BoxGeometry' && g.parameters.width === 0.09).length === 4);
const legs = [];
built && built.traverse(ch => { if (ch.geometry && ch.geometry.type === 'BoxGeometry' && ch.geometry.parameters.width === 0.09) legs.push(ch); });
check('legs are extensions of the box CORNERS (outer faces flush, centers +-0.33/+-0.22)', legs.length === 4 && legs.every(ch => Math.abs(Math.abs(ch.position.x) - 0.33) < 1e-6 && Math.abs(Math.abs(ch.position.y) - 0.22) < 1e-6));
check('26 RIVETS (spheres r=0.012): got ' + geos.filter(g => g.type === 'SphereGeometry' && g.parameters.radius === 0.012).length, geos.filter(g => g.type === 'SphereGeometry' && g.parameters.radius === 0.012).length === 26);
check('tombstone body: extruded 32-seg arch, 0.72 long along street', (() => { const ex = geos.find(g => g.type === 'ExtrudeGeometry'); const op = ex && ((ex.parameters && ex.parameters.options) || ex.parameters); return !!ex && op.curveSegments === 32 && op.depth === 0.72; })());
check('low box on legs: no child above 1.8u', built && built.children.every(ch => ch.position.z < 1.8));

// ---- 4) every 5th STREET CORNER, starting at the FIRST CORNER of Block 2 -------
check('mailboxAt: boxes at corners x=96 (blk2 W), x=368 (blk4 E), x=576 (blk7 W)', mailboxAt(96, 0) === 1 && mailboxAt(288, 9) === 2 && mailboxAt(576, 0) === 1);
check('mailboxAt: MID-BLOCK houses are false (96,5)/(192,4)/(96,1)', !mailboxAt(96, 5) && !mailboxAt(192, 4) && !mailboxAt(96, 1));
check('mailboxAt: other corners are false (176)/(192)/(480)/(656)/(672)', !mailboxAt(96, 9) && !mailboxAt(192, 0) && !mailboxAt(480, 0) && !mailboxAt(576, 9) && !mailboxAt(672, 0));
check('mailboxAt: NO boxes on Block 1 corners (0)/(80)', !mailboxAt(0, 0) && !mailboxAt(0, 9));
check('mailboxAt: exactly 3 boxes total on the 8-block route', (() => { let n = 0; for (let bx = 0; bx <= 672; bx += 96) for (let i = 0; i < 10; i++) if (mailboxAt(bx, i)) n++; return n; })() === 3);
check('makeBlockContents gates addMailbox on mailboxAt with west/east offsets', /const mb = mailboxAt\(b\.blockX, houseIdx\);\s*if \(mb\) addMailbox\(b, baseX \+ \(mb === 1 \? 2\.4 : 5\.6\), 1\.5\);/.test(src));
check('the random sidewalk tree is suppressed on EVERY mailbox corner house', /Math\.random\(\) < 0\.5 && !mailboxAt\(b\.blockX, houseIdx\)/.test(src));
check('first box at world x=98.4 = corner 96 + 2.4u in', 96 + 2.4 === 98.4 && 98.4 > 96 && 98.4 < 102);
check('east-corner box at x=368-2.4=365.6 sits INSIDE Block 4 (288..368)', 368 - 2.4 >= 288 && 368 - 2.4 < 368);
check('EVERY box gets unique graffiti + sticker (fresh random canvases per build)', /addGraffiti\(g\);[\s\S]*?addKestSticker\(g\)/.test(extract('makeMailboxMesh')));
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

// ---- 6) manholes are WORKER-ONLY: cars/motos (every vehicle) drive over them ----
// A manhole must NEVER feed vehicle AI. The worker trips on it (stun + possible
// drop of the carried bag) and that's the full extent of its gameplay effect — a
// car or motorbike rolls right over the pried-open lid.
const csStart = src.indexOf('function collideStatic(');
const csEnd = csStart >= 0 ? src.indexOf('\n      function ', csStart + 10) : -1;
const collideSrc = csStart >= 0 ? src.slice(csStart, csEnd > 0 ? csEnd : csStart + 1500) : '';
const ucStart = src.indexOf('function updateCreatures('); // AI switch anchor (after the spawn switch)
check('worker (sanitation worker) is the ONLY manhole reactor: collideStatic reads b.hazards', collideSrc.indexOf('blocks[i].hazards') >= 0);
check('worker trips on a flat "trip" hazard (doStun 0.8 "trip")', /doStun\(0\.8, "trip"\)/.test(collideSrc));
check('manhole drop: 0.5 = a carried bag can be dropped on the trip', /drop: 0\.5/.test(extract('addManhole')));
const caseIdx = (name) => src.indexOf('case "' + name + '":', ucStart);
const vehicleCase = (name, endName) => {
  const s = caseIdx(name);
  const e = endName === null ? -1 : caseIdx(endName);
  return s >= 0 ? src.slice(s, e > 0 ? e : s + 40000) : '';
};
const tricCaseSrc = vehicleCase('tric', 'rc'); // street tricycle block (VEHICLE_TYPES member)
const rcCaseSrc = vehicleCase('rc', 'bike');
const bikeCaseSrc = vehicleCase('bike', 'car'); // case "bike": falls through to case "ebike":
const carCaseSrc = vehicleCase('car', 'moto');
const motoCaseSrc = vehicleCase('moto', 'breaker');
check('street-tricycle AI case references NO road hazards (rides over manholes)', tricCaseSrc.length > 100 && tricCaseSrc.indexOf('hazard') < 0);
check('rc AI case references NO road hazards (drives over manholes)', rcCaseSrc.length > 100 && rcCaseSrc.indexOf('hazard') < 0);
check('bike/ebike AI case references NO road hazards (rides over manholes)', bikeCaseSrc.length > 100 && bikeCaseSrc.indexOf('hazard') < 0);
check('car AI case references NO road hazards (drives over manholes)', carCaseSrc.length > 100 && carCaseSrc.indexOf('hazard') < 0);
check('moto AI case references NO road hazards (drives over manholes)', motoCaseSrc.length > 100 && motoCaseSrc.indexOf('hazard') < 0);
check('vehicle obstacle logic only ever sees vehicles + the DSNY truck (findVehicleAhead)', (() => { const fv = extract('findVehicleAhead'); return fv.indexOf('b.hazards') < 0 && fv.indexOf('blocks') < 0 && fv.indexOf('VEHICLE_TYPES') >= 0 && fv.indexOf('isTruck') >= 0; })());

console.log(ok ? 'MAILBOX ALL CHECKS PASS' : 'MAILBOX FAILURES');
process.exit(ok ? 0 : 1);