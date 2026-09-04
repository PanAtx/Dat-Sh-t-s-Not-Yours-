// _npc_gender_chk.js — verify addCreature assigns the right speaking gender per NPC type
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

// --- stubs for everything addCreature touches ---
const R = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const SHIRTS = [0x111111], PANTS = [0x222222], HAIRS = [0x333333], DRESSES = [0x444444], CAR_COLORS = [0x555555];
const GZ = 0.3;
const creatures = [];
const dynamicGroup = { add(){} };
const dummyPerson = { g: { position: { set(){} }, userData: {} }, legL: {} };
global.makePerson = () => dummyPerson;
const dummy = () => ({ position: { set(){} }, userData: {} });
global.makeRat = global.makeRaccoon = global.makeSquirrel = global.makePigeon = global.makeTricycle =
global.makeDogWalker = global.makeRC = global.makeBicycle = global.makeMoto = global.makeCar = dummy;

eval(extract('addCreature'));

let pass = true;
const check = (n, c, e) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  [' + e + ']')); if (!c) pass = false; };

// deterministic genders
check('ped (man) -> male', addCreature('ped').gender === 'male');
check('lady (woman) -> female', addCreature('lady').gender === 'female');
check('breaker (man) -> male', addCreature('breaker').gender === 'male');
check('yeller (man) -> male', addCreature('yeller').gender === 'male');

// mixed: always a valid gender, both appear over many spawns
const mixed = new Set();
for (let i = 0; i < 200; i++) mixed.add(addCreature('dogwalker').gender);
check('dogwalker -> only male/female, both seen', mixed.has('male') && mixed.has('female') && mixed.size === 2, JSON.stringify([...mixed]));
const carG = new Set();
for (let i = 0; i < 200; i++) carG.add(addCreature('car').gender);
check('car driver -> only male/female, both seen', carG.has('male') && carG.has('female') && carG.size === 2, JSON.stringify([...carG]));

// animals: neutral (null)
check('rat -> neutral', addCreature('rat').gender === null);
check('raccoon -> neutral', addCreature('raccoon').gender === null);
check('squirrel -> neutral', addCreature('squirrel').gender === null);
check('pigeon -> neutral', addCreature('pigeon').gender === null);

console.log(pass ? '\nNPC GENDER ASSIGNMENT PASSED' : '\nNPC GENDER ASSIGNMENT FAILED');
process.exit(pass ? 0 : 1);