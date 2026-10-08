// _tree_bag_chk.js — tree silhouette + heavy-bag readability checks.
//   - makeTree (lawn tree): NO lollipop anymore — tall tapered trunk + a flat-shaded,
//     lopsided crown (icosahedron + 2 offset lobes), nothing casts a shadow.
//   - makeSidewalkTree (the trees standing next to curb bags): SAME 2.0u trunk height (the
//     leash chain ties off at z 1.5, the blue jay nest sits in the crown), but a flared
//     root, a dirt tree-pit, a faceted egg-shaped crown and a third leaf clump (the crown
//     normals are recomputed, because PolyhedronGeometry's own normals are spherical).
//   - HEAVY (green) bags read as PLASTIC, not foliage: deep cool bio-waste green, glossy
//     MeshStandardMaterial and a light twist-tie knot a tree never has.
//   - keepCurbBagsOffTree: a curb bag that lands under a crown is shoved clear of the
//     trunk, stays inside its own cell / sidewalk band, and the big Maspeth oak keeps its
//     left side (the acorn line) free.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
global.THREE = require(path.join(__dirname, '_three128.js'));
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let ok = true;
const check = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) ok = false;
};

// (a) inline scripts still parse
const scripts = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let synOk = true;
scripts.forEach((code, i) => { try { new vm.Script(code, { filename: 'inline#' + i }); } catch (e) { synOk = false; console.log('  syntax fail inline#' + i + ': ' + e.message); } });
check('inline script(s) parse (' + scripts.length + ')', synOk);

// ---- extract + run the REAL builders -------------------------------------------------
function extractFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error(name + ' not found');
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}
const M = (c, opt) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {}));
const MS = (c, opt) => new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {}));
const BX = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const CY = (r1, r2, h, m, s) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m);
const SP = (r, m, s) => new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m);
const R = (a, b) => a + Math.random() * (b - a);
const GZ = 0.3;
const spawnMaxY = () => 5.0;
eval(extractFn('makeTree'));
eval(extractFn('makeSidewalkTree'));
eval(extractFn('makeBag'));
eval(extractFn('keepCurbBagsOffTree'));

const meshes = g => { const a = []; g.traverse(c => { if (c.isMesh) a.push(c); }); return a; };
const lum = c => 0.2126 * ((c >> 16) & 0xff) + 0.7152 * ((c >> 8) & 0xff) + 0.0722 * (c & 0xff);
const rgb = x => [(x >> 16) & 0xff, (x >> 8) & 0xff, x & 0xff];
const hexes = g => meshes(g).map(m => m.material.color.getHex());
const ico = g => meshes(g).find(m => m.geometry.type === 'IcosahedronGeometry');
const cyl = (g, minH) => meshes(g).find(m => m.geometry.type === 'CylinderGeometry' && m.geometry.parameters.height >= (minH || 0));
// A geometry is FACETED when each triangle's three vertex normals are identical (flat
// faces) instead of the spherical normals PolyhedronGeometry ships with (a smooth ball).
const isFaceted = geo => {
  if (geo.index) return false;
  const n = geo.getAttribute('normal');
  for (let t = 0; t < Math.min(30, n.count / 3); t++) {
    const a = t * 3;
    const nx = n.getX(a), ny = n.getY(a), nz = n.getZ(a);
    for (let v = 1; v < 3; v++) {
      if (Math.abs(nx - n.getX(a + v)) > 1e-6 || Math.abs(ny - n.getY(a + v)) > 1e-6 || Math.abs(nz - n.getZ(a + v)) > 1e-6) return false;
    }
  }
  return true;
};

// ---- 1) lawn tree: tall trunk + faceted lopsided crown -------------------------------
check('makeTree builds a Group', (() => { const t = makeTree(); return t && t.isGroup && t.children.length >= 2; })());
check('makeTree trunk is TALL (>=1.9u) — no lollipop stick (old 1.3)', (() => {
  const tr = cyl(makeTree(), 1.0);
  return !!tr && tr.geometry.parameters.height >= 1.9;
})());
check('makeTree trunk tapers (thin top, thick base) and stands upright on +Z', (() => {
  const tr = cyl(makeTree(), 1.0);
  return !!tr && tr.geometry.parameters.radiusTop < tr.geometry.parameters.radiusBottom && Math.abs(Math.abs(tr.rotation.x) - Math.PI / 2) < 0.01;
})());
check('makeTree crown is a FACETED icosahedron (recomputed normals, not a smooth ball)', (() => {
  const cr = ico(makeTree());
  return !!cr && cr.material.isMeshLambertMaterial === true && isFaceted(cr.geometry);
})());
check('the faceting test discriminates (a RAW icosahedron is still a smooth ball)', isFaceted(new THREE.IcosahedronGeometry(1, 1)) === false);
check('makeTree crown carries 2 offset lobes and its top clears 3.0u', (() => {
  const cr = ico(makeTree());
  if (!cr || cr.children.length < 2) return false;
  return cr.position.z + cr.geometry.parameters.radius > 3.0 && cr.children.length === 2 && cr.children.every(c => c.isMesh && isFaceted(c.geometry));
})());
check('makeTree varies crown size + leaf green per tree (5 samples all differ)', (() => {
  const seen = new Set();
  for (let i = 0; i < 5; i++) {
    const cr = ico(makeTree());
    seen.add(cr.geometry.parameters.radius.toFixed(3) + ':' + cr.material.color.getHex());
  }
  return seen.size === 5;
})());
check('makeTree casts NO shadows (trunk flicker fix preserved)', meshes(makeTree()).every(m => m.castShadow === false));

// ---- 2) sidewalk tree: still a valid leash / nest fixture ---------------------------
check('makeSidewalkTree trunk height unchanged at 2.0u (chain tie-off z1.5 stays on the trunk)', (() => {
  const tr = cyl(makeSidewalkTree(), 1.0);
  return !!tr && tr.geometry.parameters.height === 2.0;
})());
check('makeSidewalkTree trunk flares at the ROOT (rotation.x = -90deg tips radiusTop DOWN)', (() => {
  const tr = cyl(makeSidewalkTree(), 1.0);
  return !!tr && tr.geometry.parameters.radiusTop > tr.geometry.parameters.radiusBottom;
})());
check('makeSidewalkTree keeps the brown trunk colour 0x4a3520 (manhattan fixture anchor)', hexes(makeSidewalkTree()).includes(0x4a3520));
check('makeSidewalkTree crown is FACETED, egg-shaped (scale z > 1) and has 2 leaf clumps', (() => {
  const cr = ico(makeSidewalkTree());
  return !!cr && isFaceted(cr.geometry) && cr.scale.z > 1.0 && cr.children.length >= 2 && cr.children.every(c => c.isMesh && isFaceted(c.geometry));
})());
check('makeSidewalkTree crown is off-centre (lopsided, never dead-on the stick)', (() => {
  const cr = ico(makeSidewalkTree());
  return !!cr && (cr.position.x !== 0 || cr.position.y !== 0);
})());
check('makeSidewalkTree canopy still casts its (broad) contact shadow', (() => {
  const cr = ico(makeSidewalkTree());
  return !!cr && cr.castShadow === true;
})());
check('makeSidewalkTree has a flat dirt tree-pit disc at the trunk foot (no shadow)', (() => {
  const pit = meshes(makeSidewalkTree()).find(m => m.geometry.type === 'CylinderGeometry' && m.geometry.parameters.height < 0.1);
  return !!pit && pit.castShadow === false && pit.position.z > 0 && pit.position.z < 0.1;
})());
check('makeSidewalkTree canopy stays GREEN-dominant (the leafy crown anchor colour)', (() => {
  const c = rgb(ico(makeSidewalkTree()).material.color.getHex());
  return c[1] > c[0] && c[1] > c[2] && c[2] < 80;
})());

// ---- 3) HEAVY bag vs the trees ------------------------------------------------------
const hb = makeBag('heavy'), nb = makeBag('normal');
check('heavy bag is scaled up AND carries the twist-tie (5 parts vs the normal 4)', hb.scale.x > 1.0 && nb.children.length === 4 && hb.children.length === 5);
check('heavy bag body: deep bio-waste green 0x0d3a1c / 0x072411', hexes(hb).includes(0x0d3a1c) && hexes(hb).includes(0x072411));
check('heavy bag plastic is GLOSSY MeshStandardMaterial (tree leaves stay matte Lambert)', (() => {
  const body = meshes(hb).find(m => m.geometry.type === 'SphereGeometry' && m.geometry.parameters.radius === 0.4);
  const leaf = ico(makeSidewalkTree()).material;
  return body.material.isMeshStandardMaterial === true && body.material.roughness <= 0.5 && body.material.metalness >= 0.1 && leaf.isMeshLambertMaterial === true;
})());
check('heavy green reads DARKER + COOLER than the tree leaf green', (() => {
  const bag = 0x0d3a1c, leaf = ico(makeSidewalkTree()).material.color.getHex();
  const b = rgb(bag), l = rgb(leaf);
  return lum(bag) < lum(leaf) && b[2] / b[0] > l[2] / l[0];
})());
check('heavy bag has a LIGHT twist-tie cinching the neck — a tree has no knot', (() => {
  const tie = meshes(hb).find(m => m.geometry.type === 'CylinderGeometry' && lum(m.material.color.getHex()) > 150);
  return !!tie && Math.abs(Math.abs(tie.rotation.x) - Math.PI / 2) < 0.01 && tie.position.z > 0.9;
})());
check('normal bag keeps the matte 4-part look (no tie, no bio-green)', (() => {
  return nb.children.length === 4 && meshes(nb).every(m => m.material.isMeshLambertMaterial === true) && !hexes(nb).includes(0x0d3a1c);
})());

// ---- 4) keepCurbBagsOffTree --------------------------------------------------------
const mkBag = (wx, wy, state) => ({ kind: 'bag', state: state || 'curb', wx, wy, g: { position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } } } });
const dist = (wx, tx, wy, ty) => Math.hypot(wx - tx, wy - ty);
check('a bag sitting ON the trunk is shoved out to the keep-out radius', (() => {
  const house = { bags: [mkBag(30, 1.2)] };
  keepCurbBagsOffTree(house, 30, 1.2, 20, 40, 1.7, false);
  return dist(house.bags[0].wx, 30, house.bags[0].wy, 1.2) >= 1.7 - 1e-9;
})());
check('the shove is RADIAL (same bearing, just further out)', (() => {
  const house = { bags: [mkBag(30.5, 1.6)] };
  keepCurbBagsOffTree(house, 30, 1.2, 20, 40, 1.7, false);
  const b = house.bags[0];
  const before = Math.atan2(1.6 - 1.2, 30.5 - 30), after = Math.atan2(b.wy - 1.2, b.wx - 30);
  return Math.abs(before - after) < 1e-9 && dist(b.wx, 30, b.wy, 1.2) > 1.6;
})());
check('an already-clear bag stays EXACTLY where it was', (() => {
  const house = { bags: [mkBag(34, 3.9)] };
  keepCurbBagsOffTree(house, 30, 1.2, 20, 40, 1.7, false);
  return house.bags[0].wx === 34 && house.bags[0].wy === 3.9;
})());
check('a shoved bag stays inside its own cell and on the sidewalk band (clamped)', (() => {
  const house = { bags: [mkBag(20.2, 4.95)] };
  keepCurbBagsOffTree(house, 21.0, 4.4, 20.0, 26.0, 1.7, false);
  const b = house.bags[0];
  return (b.wx !== 20.2 || b.wy !== 4.95) && b.wx >= 20.0 && b.wx <= 26.0 && b.wy >= 0.5 && b.wy <= 5.0;
})());
check('the bag MESH moves with the hazard record (wx/wy == mesh x/y at GZ)', (() => {
  const house = { bags: [mkBag(30.1, 1.25)] };
  keepCurbBagsOffTree(house, 30, 1.2, 20, 40, 1.7, false);
  const b = house.bags[0];
  return b.g.position.x === b.wx && b.g.position.y === b.wy && b.g.position.z === 0.3;
})());
check('oak variant keeps bags RIGHT of the trunk so the acorn line stays free', (() => {
  const house = { bags: [mkBag(29.4, 1.1)] };
  keepCurbBagsOffTree(house, 30, 1.2, 20, 40, 2.6, true);
  const b = house.bags[0];
  return b.wx > 30 && dist(b.wx, 30, b.wy, 1.2) >= 2.6 - 1e-9;
})());
check('dumped bags, a null house and a house without bags are all ignored', (() => {
  const house = { bags: [mkBag(30, 1.2, 'dumped')] };
  keepCurbBagsOffTree(house, 30, 1.2, 20, 40, 1.7, false);
  keepCurbBagsOffTree(null, 30, 1.2, 20, 40, 1.7, false);
  keepCurbBagsOffTree({}, 30, 1.2, 20, 40, 1.7, false);
  return house.bags[0].wx === 30 && house.bags[0].wy === 1.2;
})());

// ---- 5) wiring: every planted tree clears this cell's bags -------------------------
const segStart = src.indexOf('function makeBlockContents(');
const seg = src.slice(segStart, src.indexOf('\n      function ', segStart + 10));
check('makeBlockContents clears bags after BOTH tree sites (normal tree + the oak)', (seg.match(/keepCurbBagsOffTree\(/g) || []).length === 2);
check('each clear-out runs right after that tree is registered in b.trees', (() => {
  const i = seg.indexOf('b.trees.push({ wx: baseX + tx, wy: ty });');
  const j = seg.indexOf('keepCurbBagsOffTree(', i);
  const k = seg.indexOf('wx: baseX + oakX');
  const l = seg.indexOf('keepCurbBagsOffTree(', k);
  return i > 0 && j > i && j - i < 400 && k > 0 && l > k && l - k < 400;
})());
check('the oak uses the bigger keep-out radius (1.65x crown) and keeps bags right of the trunk', /keepCurbBagsOffTree\(\s*house,\s*baseX \+ oakX,[\s\S]{0,240}?2\.6,\s*true,\s*\)/.test(seg));
check('sidewalk trees use a tighter keep-out than lawn trees (bags sit closer to the curb)', seg.includes('isSidewalkTree ? 1.7 : 1.9'));
check('the lawn/sidewalk tree placement itself is unchanged (fixture regexes still hold)', /const isSidewalkTree =[\s\S]*?isQueensBlock;[\s\S]*?const t = isSidewalkTree \? makeSidewalkTree\(\) : makeTree\(\);[\s\S]*?ty = isSidewalkTree \? R\(0\.8, 1\.8\) : R\(6, 7\.5\);/.test(seg));

console.log(ok ? '\nALL TREE/BAG CHECKS PASSED' : '\nSOME CHECKS FAILED');
if (!ok) process.exitCode = 1;
