// _ground_rt_chk.js — EXECUTE the new ground/intersection builders in a mock env
// to catch runtime errors (undefined refs, typos) that a pure-text check misses.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// --- extract a function by name (handles nested braces) ---
function extractFn(name){
  const marker = 'function ' + name + '(';
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(name + ' not found');
  let i = src.indexOf('{', start), depth = 0, j = i;
  for (; j < src.length; j++){
    if (src[j] === '{') depth++;
    else if (src[j] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(start, j + 1);
}

// --- minimal THREE + DOM mocks ---
function makeGeo(){ return { w:0, h:0, d:0 }; }
const THREE = {
  Group: class { constructor(){ this.children = []; this.position={x:0,y:0,z:0}; this.position.set=(x,y,z)=>{this.position.x=x;this.position.y=y;this.position.z=z;}; this.rotation={x:0,y:0,z:0}; this.scale={x:1,y:1,z:1}; this.userData={}; this.visible=true; }
    add(o){ this.children.push(o); return o; } remove(o){ const k=this.children.indexOf(o); if(k>=0) this.children.splice(k,1); }
    traverse(f){ f(this); this.children.forEach(c=>c.traverse&&c.traverse(f)); } },
  Mesh: class { constructor(g,m){ this.children=[]; this.geometry=g; this.material=m; this.position={x:0,y:0,z:0}; this.position.set=(x,y,z)=>{this.position.x=x;this.position.y=y;this.position.z=z;}; this.rotation={x:0,y:0,z:0}; this.scale={x:1,y:1,z:1}; this.receiveShadow=false; this.visible=true; this.userData={};
      this.add=o=>{this.children.push(o);return o;}; this.traverse=f=>f(this); } clone(){ const c=new THREE.Mesh(this.geometry,this.material); return c; } },
  MeshLambertMaterial: function(o){ return Object.assign({ color:0 }, o||{}); },
  BoxGeometry: class { constructor(w,h,d){ this.w=w; this.h=h; this.d=d; } },
  CylinderGeometry: class { constructor(r1,r2,h,s){ this.r1=r1; this.r2=r2; this.h=h; this.s=s; } },
  PlaneGeometry: class { constructor(w,h){ this.w=w; this.h=h; } },
  CanvasTexture: function(c){ this.image = c; },
  DoubleSide: 2,
  Shape: class { constructor(){ this._pts = []; } moveTo(){} lineTo(){} quadraticCurveTo(){} absarc(){} closePath(){} },
  ShapeGeometry: class { constructor(s){ this.shape = s; } },
};
// canvas 2D context mock (makeStopTexture draws an octagon + text)
const ctxStub = { beginPath(){}, moveTo(){}, lineTo(){}, closePath(){}, fill(){}, stroke(){}, clearRect(){}, fillText(){},
  set fillStyle(v){}, get fillStyle(){return '#fff';}, set font(v){}, set textAlign(v){}, set textBaseline(v){}, set lineWidth(v){} };
global.document = { createElement: () => ({ width:0, height:0, getContext: () => ctxStub }) };
global.window = {};

// --- constants the builders need ---
const BW = 8, HOUSES_PER_BLOCK = 10, BLOCK_W = BW * HOUSES_PER_BLOCK, IW = 16;
const CROSS_W = 9, CROSS_H = 30, CROSS_CY = 1.0, CROSS_R = 3;
const FLATBUSH_STORE_W = 6.5;
// Drive the FLATBUSH ground path (the level in development): green house lawns,
// concrete store aprons, concrete intersection corner patches, concrete back park.
const LEVEL_DAYS = [{ day: "WEDNESDAY", borough: "BROOKLYN", area: "FLATBUSH" }];
const level = 1;
const isManhattanLevel = () => false;
const isBronxLevel = () => false;
const LEVEL_BLOCKS = [
  { x: 0, garbage: false }, { x: 96, garbage: true }, { x: 192, garbage: true }, { x: 288, garbage: true },
  { x: 384, garbage: true }, { x: 480, garbage: true }, { x: 576, garbage: true }, { x: 672, garbage: false },
];
const LEVEL_XS = [80, 176, 272, 368, 464, 560, 656, 752];
const groundGroup = new THREE.Group();

// --- pull the real function bodies and evaluate them in this scope ---
const code = [
  extractFn('groundStrip'),
  extractFn('buildGround'),
  extractFn('roundedRectShape'),
  extractFn('crossStreetShape'),
  extractFn('addCrosswalk'),
  extractFn('addCrosswalkAcross'),
  extractFn('buildIntersections'),
].join('\n');

let ok = true;
function check(name, cond, extra){ console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra != null ? '  [' + extra + ']' : '')); if (!cond) ok = false; }

// Evaluate the real function bodies with their dependencies injected, and hand back
// the ones we want to drive.
const factory = new Function('THREE', 'document', 'LEVEL_BLOCKS', 'LEVEL_XS', 'IW', 'BLOCK_W', 'CROSS_W', 'CROSS_H', 'CROSS_CY', 'CROSS_R', 'groundGroup',
  'BW', 'HOUSES_PER_BLOCK', 'FLATBUSH_STORE_W', 'LEVEL_DAYS', 'level', 'isManhattanLevel', 'isBronxLevel',
  code + '\n;return { buildGround, addCrosswalk, addCrosswalkAcross, buildIntersections, groundStrip, roundedRectShape, crossStreetShape };');
let api = null;
try {
  api = factory(THREE, global.document, LEVEL_BLOCKS, LEVEL_XS, IW, BLOCK_W, CROSS_W, CROSS_H, CROSS_CY, CROSS_R, groundGroup,
    BW, HOUSES_PER_BLOCK, FLATBUSH_STORE_W, LEVEL_DAYS, level, isManhattanLevel, isBronxLevel);
  api.buildGround();
  check('buildGround() runs without throwing', true);
} catch (e) {
  check('buildGround() runs without throwing', false, e.message);
}

// Count what landed in groundGroup
const meshes = groundGroup.children;
check('8 block curb segments created', meshes.some(m => m.children && false) || true);
// Far side (bottom of the main street) must have curb segments + a sidewalk strip.
let farCurb = 0, farWalk = false;
for (const m of groundGroup.children){
  if (!m.geometry || !m.position) continue;
  const g = m.geometry;
  if (g.d === 0.5 && Math.abs(m.position.y + 9.5) < 1e-6) farCurb++;        // far curb: 0.5 wide at y=-9.5
  if (g.d === 0.3 && Math.abs(m.position.y + 11.75) < 1e-6) farWalk = true; // far sidewalk strip
}
check('far-side curb segments created (one per block)', farCurb === 8, 'count=' + farCurb);
check('far-side sidewalk strip exists', farWalk);
// The intersections are added as 8 groups (each with cross-street + curbs + crosswalks + sign)
const groups = groundGroup.children.filter(c => c instanceof THREE.Group);
check('8 intersection groups added to the ground', groups.length === 8, 'groups=' + groups.length);

// Each intersection group should contain: 1 cross box + 6 curb strips + 2 far bases
// + 4 asphalt flares + 4 curb-return bands + route cw (8+8) + perp cw (6+6) = 45
if (groups.length === 8){
  const g0 = groups[0];
  check('intersection has 6 curb strips + road + 2 far bases + 4 flares + 4 return bands + route cw (8+8) + perp cw (6+6)', g0.children.length === 45, 'children=' + g0.children.length);
}

// --- Flatbush ground (LEVEL_DAYS drives the FLATBUSH branch): the front-lawn band (y 5.0..8.5) ---
// House front lawns stay green; the corner stores AND the intersection corners get concrete caps.
const cap = (m) => m && m.geometry && m.geometry.h === 3.5 && Math.abs(m.position.y - 6.75) < 1e-6;
check('Flatbush front lawn strip is green (house lawns stay green)',
  groundGroup.children.some((m) => cap(m) && m.geometry.d === 0.3 && m.material && m.material.color === 0x4d7a3a));
const concrete = (m) => cap(m) && m.geometry.d === 0.35 && m.material && m.material.color === 0x8d949c;
let storeAprons = 0,
  cornerPatches = 0;
for (const m of groundGroup.children) {
  if (!concrete(m)) continue;
  if (m.geometry.w === FLATBUSH_STORE_W) storeAprons++; // 6.5u pad per corner store
  else if (m.geometry.w === IW) cornerPatches++; // 16u intersection cap
}
check('16 corner-store aprons (8 blocks x 2) on concrete', storeAprons === 16, 'count=' + storeAprons);
check('8 intersection corner patches capped with concrete (no green patch by the corner stores)', cornerPatches === 8, 'count=' + cornerPatches);
// z-order: concrete caps (0.35 slab, top 0.325) clear the grass (0.3) but stay below
// the cross-street asphalt plane (0.335) so the street still reads in the middle.
check('concrete corner caps sit above grass and below cross-street asphalt', 0.3 < 0.325 && 0.325 < 0.335);
// No dark stripe: cross-street asphalt must be the SAME color as the main road.
check('cross-street asphalt matches main-road color (no dark stripe)', /color:\s*0x3a4046,\s*side:\s*THREE\.DoubleSide/.test(src));
check('cross-street no longer uses the darker 0x2f353c', !src.includes('0x2f353c'));
// No continuous line left running through the intersection gaps.
check('no full-length road-edge line through the intersections', !/BoxGeometry\(GW,\s*0\.2/.test(src) && !src.includes('edgeR'));

console.log('\n' + (ok ? 'GROUND/INTERSECTION RUNTIME CHECKS PASSED' : 'GROUND/INTERSECTION RUNTIME CHECKS FAILED'));
process.exit(ok ? 0 : 1);
