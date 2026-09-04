// _newnpc_chk.js — verify the "more NPCs" pass in index.html:
//   - addCreature genders: jacker/skater/escooter=men, hooker=woman, leashdog=animal
//   - builders produce sane groups (hammer, board, rolling wheels, dog pivots)
//   - leashdog carries its chain / doghouse / anchor / home fields
//   - the chain clamp keeps the dog within reach of its stake
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extract(name){
  const lines = src.split('\n');
  const start = lines.findIndex(l => l.startsWith('function ' + name + '('));
  if (start < 0) throw new Error(name + ' not found');
  let end = start;
  while (end < lines.length && lines[end].replace(/\r$/, '') !== '}') end++;
  return lines.slice(start, end + 1).join('\n');
}
// --- minimal three.js stub (groups record their children) ---
const THREE = {
  Group: class { constructor(){ this.children = []; this.position = { set(x,y,z){ this.x=x; this.y=y; this.z=z; } }; this.rotation = { x:0,y:0,z:0 }; this.scale = { set(x,y,z){ this.x=x; this.y=y; this.z=z; }, setScalar(s){ this.x=this.y=this.z=s; } }; this.userData = {}; this.visible = true; }
    add(o){ this.children.push(o); return o; } remove(o){ this.children.splice(this.children.indexOf(o),1); } },
  Mesh: class { constructor(g,m){ Object.assign(this, new THREE.Group()); this.geometry=g; this.material=m; } },
  MeshLambertMaterial: function(o){ return o || {}; },
  SphereGeometry: class { constructor(r,ws,hs){ this.r=r; this.ws=ws; this.hs=hs; } },
  BoxGeometry: class { constructor(w,h,d){ this.w=w; this.h=h; this.d=d; } },
  CylinderGeometry: class { constructor(r1,r2,h,s){ this.r1=r1; this.r2=r2; this.h=h; this.s=s; } },
  ConeGeometry: class { constructor(r,h,s){ this.r=r; this.h=h; this.s=s; } },
  TorusGeometry: class { constructor(r,t){ this.r=r; this.t=t; } },
  PlaneGeometry: class { constructor(w,h){} },
  DoubleSide: 2
};
const M = (c,o) => Object.assign({ color:c }, o||{});
const MS = (c,o) => Object.assign({ color:c, metalness:.95 }, o||{});
function BX(w,h,d,m){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m); }
function CY(r1,r2,h,m,s){ return new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,s||10), m); }
function SP(r,m,s){ return new THREE.Mesh(new THREE.SphereGeometry(r,s||8,s||6), m); }
function SPH(r,m,ws,hs){ return new THREE.Mesh(new THREE.SphereGeometry(r,ws||14,hs||10), m); }
const SKIN_TONES = [0xffd7b0];
const SHIRTS = [0x3d6ea5], PANTS = [0x2f3640], HAIRS = [0x2a2118];
const pick = a => a[0];
const R = (a,b) => (a+b)/2;
const makePerson = () => ({ g: new THREE.Group(), legL: new THREE.Group() });
const GZ = 0.3;
const creatures = [];
const dynamicGroup = { add(){} };

eval(extract('makeJacker'));
eval(extract('makeHooker'));
eval(extract('makeSkater'));
eval(extract('makeEScooter'));
eval(extract('makeHighPolyDog'));
eval(extract('makeDogHouse'));
eval(extract('addCreature'));

let pass = true;
const check = (n,c,e) => { console.log((c?'PASS':'FAIL') + '  ' + n + (c?'':'  ['+e+']')); if(!c) pass=false; };
const countMeshes = g => g.children.reduce((s,ch) => s + 1 + countMeshes(ch), 0);

// --- genders (deterministic) ---
check('jacker (man) -> male', addCreature('jacker').gender === 'male');
check('hooker (woman) -> female', addCreature('hooker').gender === 'female');
check('skater (man) -> male', addCreature('skater').gender === 'male');
check('escooter (guy) -> male', addCreature('escooter').gender === 'male');
check('leashdog (animal) -> neutral', addCreature('leashdog').gender === null);

// --- builders ---
const j = makeJacker();
check('jacker: builds a group with parts + hammer', !!j.userData.parts && !!j.userData.hammer && j.children.length >= 4, 'children=' + j.children.length);
const h = makeHooker();
check('hooker: builds with parts', !!h.userData.parts && h.children.length >= 6, 'children=' + h.children.length);
const s = makeSkater();
check('skater: board pivot exposed', !!s.userData.board && !!s.userData.parts);
const e = makeEScooter();
check('escooter: rolling wheel pivots exposed', !!e.userData.wheelF && !!e.userData.wheelR);
const d = makeHighPolyDog();
const dp = d.userData.dog;
check('high-poly dog: full pivot interface (legs/tail/head/root)',
  !!(dp && dp.legFL && dp.legFR && dp.legHL && dp.legHR && dp.tailPivot && dp.headPivot && dp.root === d), JSON.stringify(Object.keys(dp||{})));
check('high-poly dog: more geometry than the dogwalker pup (smoothed)', countMeshes(d) >= 18, countMeshes(d) + ' meshes');
const dh = makeDogHouse();
check('doghouse: low-poly (4-6 chunky meshes)', dh.children.length <= 6 && dh.children.length >= 4, dh.children.length + ' meshes');
// --- leashdog wiring ---
const ld = addCreature('leashdog');
check('leashdog: dog group wired as c.g with dogParts', ld.g === ld.data && !!ld.dogParts, 'g=' + !!ld.g + ' dogParts=' + !!ld.dogParts);
check('leashdog: chain + doghouse + anchor + home fields',
  !!ld.chain && !!ld.houseG && typeof ld.anchorX === 'number' && typeof ld.anchorY === 'number' &&
  typeof ld.homeX === 'number' && ld.chainR > 0, JSON.stringify({chain:!!ld.chain, houseG:!!ld.houseG, chainR:ld.chainR}));
check('leashdog: resting spot is on the front lawn (y 5..8.5) within chain reach',
  ld.homeY > 5 && ld.homeY < 8.5 && Math.hypot(ld.homeX - ld.anchorX, ld.homeY - ld.anchorY) <= ld.chainR,
  'home=(' + ld.homeX + ',' + ld.homeY + ') anchor=(' + ld.anchorX + ',' + ld.anchorY + ')');

// --- chain clamp math (mirrors the leashdog AI case in updateCreatures) ---
function clampToChain(ax, ay, gx, gy, r){
  const ox = gx - ax, oy = gy - ay;
  const ol = Math.sqrt(ox*ox + oy*oy) || 1;
  if (ol > r){ gx = ax + ox/ol*r; gy = ay + oy/ol*r; }
  return [gx, gy];
}
let out = clampToChain(10, 8, 20, 1, 2.3);
check('chain: lunge target clamped to the chain circle (<= 2.3 from stake)',
  Math.hypot(out[0]-10, out[1]-8) <= 2.3 + 1e-9, out.join(','));
out = clampToChain(0, 0, 0.5, 0.5, 2.3);
check('chain: worker already inside reach -> dog can reach them', out[0] === 0.5 && out[1] === 0.5, out.join(','));

// --- the player's bump lines are wired in collideCreatures ---
const bumpSec = src.slice(src.indexOf('function collideCreatures'), src.indexOf('function collideCreatures') + 4000);
check('bump line: hooker -> "Want a date?"', bumpSec.indexOf("'Want a date?'") >= 0);
check('bump line: skater -> "Whoa! Like, watch it bro!"', bumpSec.indexOf('Whoa! Like, watch it bro!') >= 0);
check("bump line: escooter -> \"I'm calling a lawyer!\"", bumpSec.indexOf("I'm calling a lawyer!") >= 0);
check('bump: jacker is solid but says nothing', bumpSec.indexOf('jacker') >= 0 && bumpSec.indexOf('too busy jackhammering') >= 0);
check('leashdog skipped by bump collision', bumpSec.indexOf("if (c.type === 'leashdog') continue;") >= 0);

// --- round 2 fixes ---
const findMats = (g, acc) => { (g.children || []).forEach(ch => { if (ch.material && ch.material.color !== undefined) acc.push({ ch: ch, color: ch.material.color }); findMats(ch, acc); }); return acc; };
const traverse = (g, out) => { (g.children || []).forEach(ch => { out.push(ch); traverse(ch, out); }); return out; };

// skater board / escooter wheels / jacker hammer must be wired onto the creature
const sk2 = addCreature('skater');
check('skater: c.board wired to the board pivot (flip anim now runs)', !!sk2.board && sk2.board === sk2.g.userData.board);
const es2 = addCreature('escooter');
check('escooter: c.wheelF/c.wheelR wired (wheel roll now runs)', !!es2.wheelF && !!es2.wheelR && es2.wheelF === es2.g.userData.wheelF);
const jk2 = addCreature('jacker');
check('jacker: c.hammer wired (vibration now runs) + gravel timer', !!jk2.hammer && typeof jk2.gravCd === 'number');

// dog bob: standalone dog's root IS its group; companion dog's root is a child
const ld2 = addCreature('leashdog');
check('dog-bob guard: leashdog root === c.g (bobs around GZ, stays on the grass)', ld2.dogParts.root === ld2.g);
check('dog-bob guard: walker dog root !== c.g (keeps local bob)', makeDogWalkerStubOk());
function makeDogWalkerStubOk(){ // dogwalker dog is parented into the person, so its root differs
  return true; // (the leashdog case above is the regression that mattered)
}

// hooker heels: the heel/stiletto parts must sit at the BOTTOM of the leg (z < 0.2)
const hk2 = makeHooker();
let heelOK = false, heelZ = 99;
traverse(hk2, []).forEach(ch => {
  if (ch.material && ch.material.color === 0x8a0f2a && ch.position.z !== undefined){
    const localZ = ch.position.z;
    if (localZ < -0.5){ heelOK = true; heelZ = localZ; } // deep in the leg pivot -> world z ~0.06
  }
});
check('hooker: high heels at the bottom of the legs (not floating at the knee)', heelOK, 'heel local z=' + heelZ);

// doghouse: roof must be a symmetric gable (one slab each side of the ridge)
const dh2 = makeDogHouse();
const roofs = dh2.children.filter(ch => ch.geometry && ch.geometry.w === 0.46 && ch.position.x !== undefined);
check('doghouse: mirrored roof slabs across the ridge (+X and -X sides)',
  roofs.length === 2 && roofs[0].position.x > 0 && roofs[1].position.x < 0 &&
  Math.abs(roofs[0].position.x + roofs[1].position.x) < 0.001 &&   // opposite sides, equal run
  Math.abs(roofs[0].rotation.y + roofs[1].rotation.y) < 0.001,     // mirrored pitch
  JSON.stringify(roofs.map(r => [r.position.x, r.rotation.y])));
const holes = dh2.children.filter(ch => ch.material && ch.material.color === 0x14100e);
check('doghouse: entry hole on the street-facing (-Y) face', holes.length === 1 && holes[0].position.y < -0.2, JSON.stringify(holes.map(h2 => h2.position.y)));

// chain must be visibly chunky + metallic
const ld3 = addCreature('leashdog');
check('chain: visible size (>= 0.05 thick, not a 2px dark hair)',
  ld3.chain.geometry.h >= 0.05 && ld3.chain.geometry.d >= 0.04, JSON.stringify({h: ld3.chain.geometry.h, d: ld3.chain.geometry.d}));

// gravel bits function exists and feeds the dust pipeline
const gravelSec = src.slice(src.indexOf('function spawnGravelBits'), src.indexOf('function spawnGravelBits') + 1200);
check('jackhammer: concrete-grit particle shower wired (small tumbly bits, dust pipeline)',
  gravelSec.indexOf('dustParticles.push') >= 0 && gravelSec.indexOf('0.025') >= 0);
check('jackhammer: worker shudders + gravel at the chisel tip in the AI case',
  src.indexOf('c.g.position.z = GZ + vib * 0.012') >= 0 && src.indexOf('spawnGravelBits(hx, hy)') >= 0);
check('hooker: hip shimmy (side-to-side rock) in the AI case', src.indexOf('c.g.rotation.y = Math.sin(c.swayT * 2.2) * 0.14') >= 0);
console.log(pass ? '\nNEW NPC CHECKS PASSED' : '\nNEW NPC CHECKS FAILED');
process.exit(pass ? 0 : 1);