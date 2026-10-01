// _oak_acorn_chk.js — verify the Maspeth (Queens, Thursday) OAK BLOCK:
// one big oak on one block (NOT the cemetery), acorns all over the sidewalk,
// the worker's marble-skid slip on a step (hurt + longer trip stun), and the
// squirrel courier that takes the acorn and runs off.

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let ok = true;
const check = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) ok = false;
};

function extractFn(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function not found: ' + name);
  const b = src.indexOf('{', idx);
  let d = 0, i = b;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) { i++; break; } }
  }
  return src.slice(idx, i);
}

function extractCase(label) {
  const idx = src.indexOf(label);
  if (idx < 0) throw new Error('case block not found: ' + label);
  const b = src.indexOf('{', idx);
  let d = 0, i = b;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) { i++; break; } }
  }
  return src.slice(idx, i);
}

// ================= 1. CONSTANTS =================
check('oak block constant: Block 3 (x=192)', /const QUEENS_OAK_BLOCK = 2;/.test(src));
check('oak block is NOT the cemetery block (2 !== 4)', src.indexOf('const QUEENS_OAK_BLOCK = 2;') >= 0 && src.indexOf('const QUEENS_CEMETERY_BLOCK = 4;') >= 0);
check('oak x derived from LEVEL_BLOCKS', /const QUEENS_OAK_X = LEVEL_BLOCKS\[QUEENS_OAK_BLOCK\]\.x;/.test(src));
check('trunk cell + acorn count constants', /const QUEENS_OAK_CELL = 3;/.test(src) && /const ACORN_COUNT = 14;/.test(src));

// ================= 2. HP + SLIP NUMBERS =================
check('HP_HIT_ACORN = 2 (a soft tumble)', /const HP_HIT_ACORN = 2;/.test(src));
check('acorn slip is LIGHTER than a hazard nick (2 < 5)', /const HP_HIT_ACORN = 2;/.test(src) && /const HP_HIT_HAZARD = 5;/.test(src));

// ================= 3. makeAcorn (runtime) =================
const shim =
  'var THREE = { Group: TGroup, Mesh: TMesh, SphereGeometry: function(){}, CylinderGeometry: function(){}, ConeGeometry: function(){} };' +
  'function TGroup(){this.children=[];this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;},setScalar:function(s){this.x=s;this.y=s;this.z=s;}};this.userData={};this.add=function(c){this.children.push(c);};}' +
  'function TMesh(){this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};}' +
  'function M(c){return{color:{getHex:function(){return c}}}}' +
  'function SPH(r,m){var o=new TMesh();o.material=m;o.r=r;return o}' +
  'function CY(r1,r2,h,m,s){var o=new TMesh();o.material=m;return o}' +
  'var R=function(a,b){return a+Math.random()*(b-a)};';

const makeAcorn = eval('(function(){' + shim + extractFn('makeAcorn') + 'return makeAcorn;})()');
const ac = makeAcorn();
check('makeAcorn builds 3 parts (nut + cap + stem)', ac.children.length === 3, 'n=' + ac.children.length);
const [nut, cap, stem] = ac.children;
check('nut is the light-tan (0xc79b5f) resting on the concrete (z ~0.085)', nut.material.color.getHex() === 0xc79b5f && Math.abs(nut.position.z - 0.085) < 1e-6, 'z=' + nut.position.z);
check('cap is the dark (0x5d3f22) riding ABOVE the nut', cap.material.color.getHex() === 0x5d3f22 && cap.position.z > nut.position.z, 'capZ=' + cap.position.z + ' nutZ=' + nut.position.z);
check('stem (0x3c2814) is above the cap (pointing up)', stem.material.color.getHex() === 0x3c2814 && stem.position.z > cap.position.z, 'stemZ=' + stem.position.z);

// ================= 4. PLACEMENT (static) =================
const plantStart = src.indexOf('// Maspeth OAK BLOCK (the 3rd block');
const plantEnd = src.indexOf('// USPS blue collection boxes', plantStart);
const plant = plantStart >= 0 && plantEnd > plantStart ? src.slice(plantStart, plantEnd) : '';
check('oak planting gated on the oak cell (blockX === QUEENS_OAK_X && houseIdx === QUEENS_OAK_CELL)', plant.indexOf('b.blockX === QUEENS_OAK_X') >= 0 && plant.indexOf('houseIdx === QUEENS_OAK_CELL') >= 0);
check('oak is a scaled-up sidewalk tree (makeSidewalkTree + setScalar 1.65)', plant.indexOf('makeSidewalkTree()') >= 0 && plant.indexOf('oak.scale.setScalar(1.65)') >= 0);
check('oak registered as a SOLID b.trees obstacle (workers/walkers route around)', plant.indexOf('b.trees.push(') >= 0 && plant.indexOf('wx: baseX + oakX') >= 0);
check('acorns loop plants ACORN_COUNT meshes on the sidewalk (y 0.6..4.6)', plant.indexOf('a < ACORN_COUNT') >= 0 && plant.indexOf('ay = R(0.6, 4.6)') >= 0 && plant.indexOf('groundGroup.add(ac)') >= 0);
check('acorns register as "acorn" hazards with their mesh attached', plant.indexOf('type: "acorn"') >= 0 && plant.indexOf('g: ac') >= 0);
check('acorns kept clear of the trunk (min 1.6u, retry loop)', plant.indexOf('(ax - oakX) * (ax - oakX) + (ay - oakY) * (ay - oakY) < 1.6 * 1.6') >= 0 && plant.indexOf('tries < 24') >= 0);
const oakGateCount = src.split('b.blockX === QUEENS_OAK_X &&').length - 1;
check('the oak cell suppresses the regular tree AND plants the oak (gate used twice)', oakGateCount >= 2, 'n=' + oakGateCount);

// ================= 5. SLIP HAZARD (collideStatic) =================
const litterIdx = src.indexOf('} else if (hz.litter) {');
const acornIdx = src.indexOf('} else if (hz.type === "acorn") {');
check('the acorn branch sits in collideStatic (after litter, before the generic trip else)', litterIdx >= 0 && acornIdx > litterIdx);
const slipEnd = acornIdx >= 0 ? src.indexOf('} else {\n              doStun(0.8, "trip")', acornIdx) : -1;
const slip = acornIdx >= 0 && slipEnd > acornIdx ? src.slice(acornIdx, slipEnd) : '';
check('step-on: hurtNPC(HP_HIT_ACORN, "acorn") — the write-up cause is "acorn"', slip.indexOf('hurtNPC(HP_HIT_ACORN, "acorn")') >= 0);
check('step-on: doStun(1.1, "trip") — a LONGER fall than the normal 0.8 trip', slip.indexOf('doStun(1.1, "trip")') >= 0);
check('step-on: a slip voice line (Whoa! Slipping! / Acorns! My boots! / Marbles on this sidewalk!)', slip.indexOf('Whoa! Slipping!') >= 0 && slip.indexOf('Acorns! My boots!') >= 0 && slip.indexOf('Marbles on this sidewalk!') >= 0);
check('step-on: one squirrel per acorn (hz.got gate + queueAcornSquirrel)', slip.indexOf('if (!hz.got)') >= 0 && slip.indexOf('hz.got = true') >= 0 && slip.indexOf('queueAcornSquirrel(hz)') >= 0);
check('the generic trip hazards (0.8 stun) are untouched after the acorn branch', slipEnd > acornIdx && src.slice(slipEnd, slipEnd + 200).indexOf('doStun(0.8, "trip")') >= 0);

// ================= 6. SQUIRREL COURIER (queueAcornSquirrel, runtime) =================
const q = eval(
  '(function(){' +
    shim +
    'var acornSquirrelCd = 0, queens = true;' +
    'function isQueensLevel(){return queens}' +
    'var spawned = [];' +
    'function addCreature(t, o){var c={type:t};if(o){for(var k in o)c[k]=o[k]}spawned.push(c);return c}' +
    extractFn('queueAcornSquirrel') +
    'return { queue: queueAcornSquirrel, cd: function(){return acornSquirrelCd}, spawned: spawned, setQueens: function(v){queens=v} };' +
  '})()'
);
const hz1 = { wx: 200, wy: 3, got: false };
q.queue(hz1);
check('a slip queues exactly ONE courier squirrel', q.spawned.length === 1, 'n=' + q.spawned.length);
const sq0 = q.spawned[0] || {};
check('courier is a "squirrel" with the acornHunt mission + a sprint (sp = 7)', sq0.type === 'squirrel' && sq0.acornHunt === hz1 && sq0.sp === 7);
check('courier spawns 9-16u off the nut (either side)', Math.abs(sq0.wx - 200) >= 9 && Math.abs(sq0.wx - 200) <= 16, 'dx=' + (sq0.wx - 200).toFixed(2));
check('the 6s cooldown blocks a second courier', q.cd() === 6);
const hz2 = { wx: 230, wy: 3, got: false };
q.queue(hz2);
check('no second spawn while the cooldown is running', q.spawned.length === 1, 'n=' + q.spawned.length);
check('the gate is level-scoped (never on non-Queens levels)', (function () { q.setQueens(false); q.queue(hz2); return q.spawned.length === 1; })());

// ================= 7. SQUIRREL MISSION (case "squirrel", runtime) =================
const sqCase = extractCase('case "squirrel": {');
check('case "squirrel" carries the acornHunt mission branch', sqCase.indexOf('c.acornHunt') >= 0);
check('the mission grabs (hz.dead = true + parent.remove) and BOLTS (c.flee = 2.6)', sqCase.indexOf('hz.dead = true') >= 0 && sqCase.indexOf('hz.g.parent.remove(hz.g)') >= 0 && sqCase.indexOf('c.flee = 2.6') >= 0);

const stepSquirrel = eval(
  '(function(){' +
    shim +
    'var GZ = 0.3, p = { wx: 0 }, tx = 0;' +
    extractFn('animSquirrel') +
    'return function(dt, cc, txv){ p.wx = txv; tx = txv; ' +
    '(function(){ var c = cc; switch("squirrel") { ' + sqCase + ' } })(); return cc; };})()'
);
function stubSquirrel(wx, wy) {
  const mkPos = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } });
  const mk = () => ({ rotation: { x: 0, y: 0, z: 0 }, position: mkPos() });
  return {
    g: {
      userData: {
        squirrel: {
          legFL: mk(), legFR: mk(), legHL: mk(), legHR: mk(),
          tailPivot: mk(), headPivot: mk(),
          acorn: { position: mkPos() },
        },
      },
      scale: { set: () => {}, setScalar: () => {} },
      rotation: { x: 0, y: 0, z: 0 },
      position: { x: 0, y: 0, z: 0 },
    },
    phase: 0, sp: 7, dir: 1, flee: 0, pauseT: 0, pauseIn: 10,
    wx: wx, wy: wy, hop: 0, settle: 0,
  };
}
const DT = 0.1;
let removedMesh = null;
const hzLive = {
  wx: 103, wy: 3.2, dead: false,
  g: { parent: { remove: (o) => { removedMesh = o; } } },
};
const sq3 = stubSquirrel(100, 2); // ~3.4u from the nut
sq3.acornHunt = hzLive;
let guard = 0;
while (guard++ < 300 && sq3.acornHunt) {
  stepSquirrel(DT, sq3, 150); // worker far away — no tx re-join clamp interference
}
check('mission: the squirrel SPRINTS to the acorn and grabs it', !sq3.acornHunt && hzLive.dead === true, 'steps=' + guard);
check('mission: the ground acorn mesh is REMOVED on the grab', removedMesh === hzLive.g);
check('mission: the squirrel BOLTS off with the nut (c.flee armed, dir = heading)', sq3.flee >= 2.0 && sq3.dir === 1, 'flee=' + sq3.flee.toFixed(2) + ' dir=' + sq3.dir);
stepSquirrel(DT, sq3, 150); // the next frame runs the FLEE branch
check('mission: the bolt actually moves it (flee branch, +x heading)', sq3.wx > 103.3 && sq3.flee < 2.6, 'wx=' + sq3.wx.toFixed(2));

// ================= 8. WIRING =================
const ucIdx = src.indexOf('function updateCreatures(dt)');
check('updateCreatures ticks the courier cooldown', ucIdx >= 0 && src.slice(ucIdx, ucIdx + 200).indexOf('acornSquirrelCd -= dt') >= 0);
check('queueAcornSquirrel is declared once and referenced by the slip branch', src.split('function queueAcornSquirrel').length - 1 === 1 && src.indexOf('queueAcornSquirrel(hz)') >= 0);

console.log(ok ? '\nOAK ACORN ALL CHECKS PASS' : '\nOAK ACORN CHECKS FAILED');
process.exit(ok ? 0 : 1);
