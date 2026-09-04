// _bonus_voice_chk.js — verify the worker's pickup line: the easel painting (treasure kind 2)
// must be announced as Picasso / Rembrandt / Michelangelo / Thomas Kinkaid (random),
// while every other bonus keeps its original line.
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

const R = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
function M(c, opt){ return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {})); }
function MS(c, opt){ return new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {})); }
function BX(w, h, d, m){ return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function CY(r1, r2, h, m, s){ return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m); }
function SP(r, m, s){ return new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m); }
function SPH(r, m, ws, hs){ return new THREE.Mesh(new THREE.SphereGeometry(r, ws || 14, hs || 10), m); }
const GZ = 0.01;
const dynamicGroup = { add(){} };
const bonuses = [];

eval(extract('makeCopper'));
eval(extract('makeCash'));
eval(extract('makeTreasure'));
eval(extract('spawnBonus'));

const PAINTERS = new Set(['Picasso!', 'Rembrandt!', 'Michelangelo!', 'Thomas Kinkaid!']);
let ok = true;
const seen = { painting: new Set(), otherTreasure: new Set(), mongo: new Set(), cash: new Set() };
const N = 600;
for (let i = 0; i < N; i++){
  const before = bonuses.length;
  spawnBonus(0, 0);
  const b = bonuses[bonuses.length - 1];
  if (bonuses.length !== before + 1){ ok = false; console.log('FAIL  bonus not recorded'); break; }
  if (b.type === 'treasure' && b.voice !== 'Treasure!' && PAINTERS.has(b.voice)) seen.painting.add(b.voice);
  else if (b.type === 'treasure') seen.otherTreasure.add(b.voice);
  else if (b.type === 'mongo') seen.mongo.add(b.voice);
  else if (b.type === 'cash') seen.cash.add(b.voice);
  else { ok = false; console.log('FAIL  unexpected bonus', b.type, b.voice); }
  if (!PAINTERS.has(b.voice) && b.type === 'treasure' && b.voice !== 'Treasure!'){ ok = false; console.log('FAIL  bad treasure voice:', b.voice); }
}
const check = (label, cond) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };
check('painting pickups announced with a famous painter name: ' + [...seen.painting].join(' | '), seen.painting.size >= 3);   // all 4 in 600 rolls is overwhelming odds
check('other treasures still say Treasure! only', [...seen.otherTreasure].every(v => v === 'Treasure!') && seen.otherTreasure.size === 1);
check('mongo line intact', [...seen.mongo].every(v => v === 'Mongo!') && seen.mongo.size === 1);
check('cash line intact', [...seen.cash].every(v => v === 'Street cash!') && seen.cash.size === 1);
console.log(ok ? 'BONUS VOICE ALL CHECKS PASS' : 'BONUS VOICE FAILURES');
process.exit(ok ? 0 : 1);