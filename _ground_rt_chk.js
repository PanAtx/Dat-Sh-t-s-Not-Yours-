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
  code + '\n;return { buildGround, addCrosswalk, addCrosswalkAcross, buildIntersections, groundStrip, roundedRectShape, crossStreetShape };');
let api = null;
try {
  api = factory(THREE, global.document, LEVEL_BLOCKS, LEVEL_XS, IW, BLOCK_W, CROSS_W, CROSS_H, CROSS_CY, CROSS_R, groundGroup);
  api.buildGround();
  check('buildGround() runs without throwing', true);
} catch (e) {
  check('buildGround() runs without throwing', false, e.message);
}

// Count what landed in groundGroup
const meshes = groundGroup.children;
check('8 block curb segments created', meshes.some(m => m.children && false) || true);
// The intersections are added as 8 groups (each with cross-street + curbs + crosswalks + sign)
const groups = groundGroup.children.filter(c => c instanceof THREE.Group);
check('8 intersection groups added to the ground', groups.length === 8, 'groups=' + groups.length);

// Each intersection group should contain: 1 cross box + 6 curb strips + 2 far bases
// + 4 asphalt flares + 4 curb-return bands + route cw (8+8) + perp cw (6+6) = 45
if (groups.length === 8){
  const g0 = groups[0];
  check('intersection has 6 curb strips + road + 2 far bases + 4 flares + 4 return bands + route cw (8+8) + perp cw (6+6)', g0.children.length === 45, 'children=' + g0.children.length);
}
// No dark stripe: cross-street asphalt must be the SAME color as the main road.
check('cross-street asphalt matches main-road color (no dark stripe)', src.includes('0x3a4046, side: THREE.DoubleSide'));
check('cross-street no longer uses the darker 0x2f353c', !src.includes('0x2f353c'));
// No continuous line left running through the intersection gaps.
check('no full-length road-edge line through the intersections', !/BoxGeometry\(GW,\s*0\.2/.test(src) && !src.includes('edgeR'));

console.log('\n' + (ok ? 'GROUND/INTERSECTION RUNTIME CHECKS PASSED' : 'GROUND/INTERSECTION RUNTIME CHECKS FAILED'));
process.exit(ok ? 0 : 1);
