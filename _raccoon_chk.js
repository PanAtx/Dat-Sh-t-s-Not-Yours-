// _raccoon_chk.js — verify that bumping a raccoon scares the sanitation worker:
// the worker screams "Rabies!" and trips (stun), while a squirrel bump stays the
// old quiet trip (no line) and the rat still yells "Eeek!".
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ---- robust function extractor (brace-counted, works for one- and multi-line fns) ----
function extractFn(name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  let brace = src.indexOf('{', idx);
  let depth = 0, i = brace;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}

// ---- mutable game state the extracted functions close over ----
let state = 'play';
const p = { wx: 88, wy: 2.5, stunT: 0, invuln: 0, immuneT: 0, facing: 0 };
const creatures = [];
let carry = 'none', carried = null;
let drops = 0;
function dropCarried(){ drops++; carry = 'none'; carried = null; }
const voice = [];
const Voice = { say(text, gap, pitch, bx, by, gender){ voice.push({ text: text, pitch: pitch, bx: bx, by: by, gender: gender }); } };
const WORKER_GENDER = 'male';
const sfx = [];
const SFX = { playStun(){ sfx.push('stun'); }, playTripSound(){ sfx.push('trip'); } };
function hurtNPC(amount){ throw new Error('raccoon should NOT drain health, got hurtNPC(' + amount + ')'); }

// ---- pull the REAL functions out of index.html (eval at module scope so they stay) ----
eval(extractFn('doStun'));
eval(extractFn('collideCreatures'));

// ---- assertion helper ----
let ok = true;
const check = function(label, cond, extra){
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (cond || extra === undefined ? '' : '  [' + extra + ']'));
  if (!cond) ok = false;
};
const reset = function(){
  state = 'play';
  p.wx = 88; p.wy = 2.5; p.stunT = 0; p.invuln = 0; p.immuneT = 0;
  creatures.length = 0; carry = 'none'; carried = null; drops = 0; voice.length = 0;
};
const nearCreature = function(type, wx, wy){
  const c = { type: type, wx: wx, wy: wy, vcd: 0, g: { rotation: { z: 0 } }, flee: 0, dir: 1 };
  creatures.push(c);
  return c;
};

// ===== 1) bumping a RACCOON scares the worker: he screams "Rabies!" and trips =====
reset();
const rac = nearCreature('raccoon', p.wx + 0.3, p.wy); // inside the raccoon's 1.0 radius
collideCreatures();
const racLine = voice.find(function(v){ return v.text === 'Rabies!'; });
check('raccoon bump -> worker says "Rabies!"', !!racLine);
check('raccoon "Rabies!" is spoken BY the worker (gender = WORKER_GENDER)', racLine && racLine.gender === WORKER_GENDER, JSON.stringify(racLine || null));
check('raccoon "Rabies!" is a SCREAM (pitch 1.5, same as the rat\'s "Eeek!")', racLine && racLine.pitch === 1.5, racLine ? 'pitch=' + racLine.pitch : 'no line');
check('raccoon "Rabies!" is located at the WORKER, not the raccoon', racLine && Math.abs(racLine.bx - p.wx) < 1e-9 && Math.abs(racLine.by - p.wy) < 1e-9, racLine ? JSON.stringify({ bx: racLine.bx, by: racLine.by }) : 'no line');
check('raccoon bump -> worker trips (stunned > 0)', p.stunT > 0, 'stunT=' + p.stunT);
check('raccoon scare stun is a real trip (>= 0.5s)', p.stunT >= 0.5, 'stunT=' + p.stunT);
check('raccoon flees from the worker', rac.flee > 0, 'flee=' + rac.flee);
check('racing the raccoon does NOT drain worker health', true); // hurtNPC() would have thrown

// ===== 2) the squirrel keeps the old quiet trip (no "Rabies!") =====
reset();
const sq = nearCreature('squirrel', p.wx + 0.3, p.wy);
collideCreatures();
check('squirrel bump -> worker trips (stunned > 0)', p.stunT > 0, 'stunT=' + p.stunT);
check('squirrel bump -> worker says NOTHING (no "Rabies!")', voice.length === 0, JSON.stringify(voice));
check('squirrel still flees', sq.flee > 0, 'flee=' + sq.flee);

// ===== 3) the rat still yells "Eeek!" (regression) =====
reset();
const rat = nearCreature('rat', p.wx + 0.3, p.wy);
collideCreatures();
check('rat bump -> worker yells "Eeek!"', voice.length === 1 && voice[0].text === 'Eeek!', JSON.stringify(voice));
check('rat bump -> worker trips', p.stunT > 0, 'stunT=' + p.stunT);

// ===== 4) a raccoon far away does nothing =====
reset();
nearCreature('raccoon', p.wx + 50, p.wy);
collideCreatures();
check('raccoon out of range -> no line, no stun', voice.length === 0 && p.stunT === 0);

console.log(ok ? '\nRACCOON ALL CHECKS PASS' : '\nRACCOON FAILURES');
process.exit(ok ? 0 : 1);
