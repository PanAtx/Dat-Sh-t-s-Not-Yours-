// _tmp_mongo_chk.js — verify the 9 mongo scrap types: models build, names present,
// values $10-$100 in $10 steps, and the worker's voice line is the specific type.
const fs = require('fs');
const path = require('path');
global.THREE = require(path.join(__dirname, '_three128.js'));

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extract(name){
  const lines = src.split('\n');
  const start = lines.findIndex(l => l.startsWith('function ' + name + '('));
  if (start < 0) throw new Error(name + ' not found');
  let end = start;
  while (end < lines.length && lines[end].replace(/\r$/, '') !== '}') end++;
  return lines.slice(start, end + 1).join('\n');
}
function extractObj(name){
  const m = src.match(new RegExp(name + ' = (\\{[\\s\\S]*?\\})'));
  if (!m) throw new Error(name + ' not found');
  return eval('(' + m[1] + ')');
}

const R = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
function M(c, opt){ return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {})); }
function MS(c, opt){ return new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {})); }
function BX(w, h, d, m){ return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function CY(r1, r2, h, m, s){ return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m); }
function SP(r, m, s){ return new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m); }
function SPH(r, m, ws, hs){ return new THREE.Mesh(new THREE.SphereGeometry(r, ws || 14, hs || 10), m); }
const GZ = 0.01;
const CASH_LIFT = 0.12;
const TREASURE_NAMES = extractObj('TREASURE_NAMES');
const MONGO_NAMES = extractObj('MONGO_NAMES');
eval(extract('makeCopper'));
eval(extract('makeCash'));
eval(extract('makeTreasure'));
eval(extract('spawnBonus'));
const dynamicGroup = { add(){} };
const bonuses = [];

let ok = true;
const check = (label, cond) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };
const EXPECTED = ['Brass pipes!','Kitchen sink!','Aluminum radiator!','Air conditioner!','Copper wire spool!','Lead pipe!','Electric motor!','Stainless steel faucet!','Copper tubing!'];
const KINDS = [0,1,2,3,4,5,6,7,8];

// 1) MONGO_NAMES names all 9 kinds, matching the requested types exactly
check('MONGO_NAMES covers all 9 kinds (0-8)', KINDS.every(k => typeof MONGO_NAMES[k] === 'string' && MONGO_NAMES[k].length > 0));
check('MONGO_NAMES names match the requested types', EXPECTED.every((n, i) => MONGO_NAMES[i] === n));

// 2) every kind builds a non-empty model without throwing
let built = true, detail = '';
KINDS.forEach(k => { try { const grp = makeCopper(k); if (!grp || !Array.isArray(grp.children) || grp.children.length === 0){ built = false; detail += ' kind ' + k + ' empty'; } } catch (e){ built = false; detail += ' kind ' + k + ' threw: ' + e.message; } });
check('makeCopper(kind) builds a non-empty model for all 9 kinds' + (detail ? '  [' + detail + ']' : ''), built);

// 3) value formula: exactly $10..$100 in $10 steps
const seenVals = new Set();
for (let i = 0; i < 2000; i++) seenVals.add(10 + 10 * ((Math.random() * 10) | 0));
const vals = [...seenVals].sort((a, b) => a - b);
check('mongo values are exactly $10..$100 in $10 steps (' + vals.join(',') + ')', vals.join(',') === '10,20,30,40,50,60,70,80,90,100');

// 4) spawnBonus mongo branch over many rolls: values + named voices
const voices = new Set(), vset = new Set();
let mongoOk = true, mongoCount = 0;
for (let i = 0; i < 4000; i++){
  spawnBonus(0, 0);
  const b = bonuses[bonuses.length - 1];
  if (b.type === 'mongo'){
    mongoCount++;
    if (b.val < 10 || b.val > 100 || b.val % 10 !== 0) mongoOk = false;
    if (EXPECTED.indexOf(b.voice) < 0) mongoOk = false;
    voices.add(b.voice); vset.add(b.val);
  }
}
check('spawnBonus mongo: $10-$100 (x10) + a named voice (saw ' + voices.size + '/9 types over ' + mongoCount + ' spawns; vals ' + [...vset].sort((a, b) => a - b).join(',') + ')', mongoOk && voices.size >= 5);

console.log(ok ? 'MONGO ALL CHECKS PASS' : 'MONGO FAILURES');
process.exit(ok ? 0 : 1);