// _soccer_chk.js — verify the Flatbush SOCCER TEAM feature (index.html). 3 small
// kids in DIFFERENT shirts on ONE garbage block's NEAR SIDEWALK (wy 1.6..4.2,
// never on the asphalt) play with ONE shared ball:
//   1) wiring: constants, the addCreature case (distinct shirts, no boxW), the
//      REAL ball (12 pentagons at icosahedron vertices — not a dalmatian), the
//      team spawn (3 kids, 1 ball on the leader, chalk field), AVOID_TYPES,
//      write-ups.
//   2) the REAL case "soccer" body from updateCreatures, SIMULATED with the real
//      team state: the owner patrols the WHOLE block with the ball ALWAYS in
//      front of him; kicks rotate the ball (to a mate / long up the block for a
//      DIFFERENT kid to retrieve / at the worker when he's close); ownership
//      rotates; nobody leaves the sidewalk band or the block.
//   3) the REAL collideCreatures branches: bonking the BALL = minor whack +
//      "Hey dont do that!" + "GOAAAAL!" + the worker DEFLECTS it loose;
//      touching a KID = light hit + a panic line; both bounce the worker back.
//   4) the crowd routes around the soccer kids (AVOID_TYPES.soccer).
//   5) the bubble punch-ups: worker "OW!" lines get the POW! burst, bonus finds
//      slam in on the Bangers starburst (.pop-star).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let ok = true;
const check = (name, cond, detail) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); if (!cond) ok = false; };

// ---- (0) inline scripts still parse ----
const scripts = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let synOk = true;
scripts.forEach((code, i) => { try { new vm.Script(code, { filename: 'inline#' + i }); } catch (e) { synOk = false; console.log('  syntax fail inline#' + i + ': ' + e.message); } });
check('inline script(s) parse (' + scripts.length + ')', synOk);

// ---- (1) constants (mirror index.html) ----
const HP_HIT_SOCKER = 3, HP_HIT_SOCCERBALL = 2;
const HP_HIT_DRIVETRIC = 4, HP_HIT_VEHICLE = 8, HP_HIT_PANHANDLER = 1;
const SOCKER_LINES = ["Don't touch me!", 'Mommy!', 'Bad man!'];
const SOCCER_LEAD = 1.3, SOCCER_PICKUP = 1.3, SOCCER_WORKER_RANGE = 9;
const SOCCER_KICK_VZ = 3.2, SOCCER_WORKER_KICK_CD = 3.5, SOCCER_MARGIN = 5;
const BLOCK_W = 80; // mirrors index.html (10 houses x 8u)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const workerMaxY = () => 8.0; // Flatbush cap (mirrors index.html)
const WORKER_GENDER = 'male';
const pick = (a) => a[0]; // deterministic in tests (first line)
const R = (lo, hi) => lo; // deterministic in tests (low end)

console.log('[1] constants');
check('HP_HIT_SOCKER exists and is LIGHT (3)', src.indexOf('const HP_HIT_SOCKER = 3;') >= 0 && HP_HIT_SOCKER > HP_HIT_PANHANDLER && HP_HIT_SOCKER < HP_HIT_DRIVETRIC);
check('HP_HIT_SOCCERBALL exists and is MINOR (2)', src.indexOf('const HP_HIT_SOCCERBALL = 2;') >= 0 && HP_HIT_SOCCERBALL < HP_HIT_SOCKER && HP_HIT_SOCCERBALL < HP_HIT_VEHICLE);
check('SOCKER_LINES has exactly the 3 panic lines', /const SOCKER_LINES = \[[\s\S]*?"Don't touch me!"[\s\S]*?"Mommy!"[\s\S]*?"Bad man!"[\s\S]*?\];/.test(src));
check('team constants exist (lead 1.3 / pickup 1.3 / worker range 9 / lob 3.2 / kick cd 3.5 / margin 5)',
  src.indexOf('const SOCCER_LEAD = 1.3;') >= 0 && src.indexOf('const SOCCER_PICKUP = 1.3;') >= 0 &&
  src.indexOf('const SOCCER_WORKER_RANGE = 9;') >= 0 && src.indexOf('const SOCCER_KICK_VZ = 3.2;') >= 0 &&
  src.indexOf('const SOCCER_WORKER_KICK_CD = 3.5;') >= 0 && src.indexOf('const SOCCER_MARGIN = 5;') >= 0);
check('shared-team state is declared (soccerShirtQueue + soccerTeam)',
  src.indexOf('let soccerShirtQueue = []') >= 0 && src.indexOf('let soccerTeam = null') >= 0);
check('the old single-kick constant is gone (no SOCCER_KICK_AHEAD left)', src.indexOf('SOCCER_KICK_AHEAD') < 0);

console.log('[2] wiring: models, team spawn, chalk field, avoidance, write-ups');
const addSrc = src.slice(src.indexOf('function addCreature('), src.indexOf('function updateCreatures('));
check('addCreature has case "soccer" with a distinct-shirt makeSoccerKid', addSrc.indexOf('case "soccer":') >= 0 && addSrc.indexOf('makeSoccerKid(soccerShirt)') >= 0 && addSrc.indexOf('soccerShirtQueue') >= 0);
check('the addCreature case creates NO per-kid ball (the team ball is shared)', (function () {
  const cs = addSrc.indexOf('case "soccer":');
  const ce = addSrc.indexOf('break;', cs);
  const body = addSrc.slice(cs, ce);
  return body.indexOf('c.ball =') < 0 && body.indexOf('c.ballG =') < 0;
})());
check('soccer kids get MIXED gender (like the other kid riders)', addSrc.indexOf('type === "soccer" ||') >= 0);
check('the soccer kid has NO boxW (not traffic: separation/truck systems skip it)', (function () {
  const cs = addSrc.indexOf('case "soccer":');
  const ce = addSrc.indexOf('break;', cs);
  return addSrc.slice(cs, ce).indexOf('c.boxW') < 0;
})());
check('makeSoccerKid accepts a shirt (distinct colors per kid) and scales a makePerson to 60%', /function makeSoccerKid\(shirt\)[\s\S]*?shirt: shirt \|\| pick\(SHIRTS\)[\s\S]*?kp\.g\.scale\.set\(0\.6, 0\.6, 0\.6\)/.test(src));
// the REAL ball: white sphere + 12 black pentagons at icosahedron vertices
const ballFn = (function () {
  const i = src.indexOf('function makeSoccerBall()');
  if (i < 0) return '';
  let b = src.indexOf('{', i), d = 0, k = b;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) break; } }
  return src.slice(i, k + 1);
})();
check('ball is a white sphere resting on the ground (center at 0.22)', ballFn.indexOf('SPH(R, M(0xf5f5f0))') >= 0 && ballFn.indexOf('ball.position.z = R;') >= 0);
check('ball has 12 black pentagons (icosahedron vertices — a real soccer ball, not a dalmatian)',
  ballFn.indexOf('PHI = (1 + Math.sqrt(5)) / 2') >= 0 &&
  (ballFn.match(/\[[^\[\]]+,\s*[^\[\]]+,\s*[^\[\]]+\]/g) || []).length >= 12 &&
  ballFn.indexOf('THREE.ShapeGeometry') >= 0 && ballFn.indexOf('pent.lookAt') >= 0);
check('the old 6-patch dalmatian is gone', ballFn.indexOf('BX(0.08, 0.08, 0.03, patchM)') < 0);
// spawn: Flatbush only, ONE garbage block, 3 distinct shirts, chalk field
const spawnSrc = (function () {
  const i = src.indexOf('Flatbush soccer team: THREE small kids');
  if (i < 0) return '';
  let j = src.indexOf('if (isFlatbushLevel()) {', i);
  let k = src.indexOf('{', j), d = 0;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) break; } }
  return src.slice(i, k + 1);
})();
check('soccer spawn is Flatbush-only (isFlatbushLevel gate)', spawnSrc.indexOf('if (isFlatbushLevel()) {') >= 0);
check('the team plays on ONE garbage block (not 3 blocks anymore)', spawnSrc.indexOf('LEVEL_BLOCKS.filter(b => b.garbage)') >= 0 && spawnSrc.indexOf('soccerBlocks[(Math.random() * soccerBlocks.length) | 0]') >= 0);
check('3 kids get 3 DISTINCT shirt colors (the team look)', spawnSrc.indexOf('sShirts.length < 3') >= 0 && spawnSrc.indexOf('sShirts.indexOf(sCol) < 0') >= 0 && spawnSrc.indexOf('soccerShirtQueue = sShirts.slice()') >= 0);
check('3 kids are spread along the block on the NEAR SIDEWALK (wy 1.6..4.2)', spawnSrc.indexOf('sMinX + ((sMaxX - sMinX) * (si + 0.5)) / 3') >= 0 && spawnSrc.indexOf('sk.wy = R(1.6, 4.2)') >= 0);
check('the team patrols the WHOLE block (minX/maxX = block edge ± SOCCER_MARGIN)', spawnSrc.indexOf('sMinX = sb.x + SOCCER_MARGIN') >= 0 && spawnSrc.indexOf('sMaxX = sb.x + BLOCK_W - SOCCER_MARGIN') >= 0);
check('ONE shared ball: the leader carries c.ball/c.ballG, added to the world ONCE', spawnSrc.indexOf('sLeader.ball = sBall') >= 0 && spawnSrc.indexOf('sLeader.ballG = sBallG') >= 0 && spawnSrc.indexOf('dynamicGroup.add(sBallG)') >= 0);
check('soccerTeam is built (kids/leader/ball/owner/receiver + cooldowns)', spawnSrc.indexOf('soccerTeam = {') >= 0 && spawnSrc.indexOf('owner: sKids[1]') >= 0 && spawnSrc.indexOf('receiver: null') >= 0 && spawnSrc.indexOf('workerKickCd: 0') >= 0);
check('the chalk field is on their block (center circle + center line + book goals)', spawnSrc.indexOf('THREE.RingGeometry(1.1, 1.35, 40)') >= 0 && spawnSrc.indexOf('THREE.BoxGeometry(0.1, 3.2, 0.02)') >= 0 && spawnSrc.indexOf('sBookCols') >= 0 && spawnSrc.indexOf('groundGroup.add(sCircle)') >= 0);
check('soccer blocks are IN-ROUTE garbage blocks (6 of the 8 blocks carry garbage)', (function () {
  const m = src.match(/const LEVEL_BLOCKS = \[([\s\S]*?)\];/);
  if (!m) return false;
  const blocks = eval('[' + m[1] + ']');
  return blocks.filter(b => b.garbage).length === 6;
})());
check('AVOID_TYPES includes soccer (the crowd routes around the team)', /AVOID_TYPES = \{[\s\S]*?soccer:\s*1/.test(src));
check('WRITEUP_REASONS has a soccer entry (the supervisor\'s offense file)', /soccer:\s*\[[\s\S]*?"Failure to respect a sacred soccer ball"[\s\S]*?\]/.test(src));

console.log('[3] case "soccer" in updateCreatures — the REAL team AI, simulated');
function extractCase() {
  const fnStart = src.indexOf('function updateCreatures(dt) {');
  if (fnStart < 0) throw new Error('updateCreatures not found');
  const start = src.indexOf('case "soccer": {', fnStart);
  if (start < 0) throw new Error('case "soccer" not found in updateCreatures');
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) break; } }
  return src.slice(start, i + 1);
}
const soccerCase = extractCase();
check('only the LEADER simulates the team (the other 2 kids\' ticks no-op)', soccerCase.indexOf('soccerTeam.leader !== c') >= 0);
check('loose-ball pickup: closest kid within SOCCER_PICKUP, ball low, grabCd respected', soccerCase.indexOf('SOCCER_PICKUP') >= 0 && soccerCase.indexOf('B.z < 0.8') >= 0 && soccerCase.indexOf('T.grabCd <= 0') >= 0);
check('kick at the worker when he\'s close (SOCCER_WORKER_RANGE, target = p.wx/p.wy)', soccerCase.indexOf('SOCCER_WORKER_RANGE') >= 0 && soccerCase.indexOf('tx = p.wx') >= 0 && soccerCase.indexOf('ty = p.wy') >= 0);
check('kick cooldown for worker-aimed kicks (no spam)', soccerCase.indexOf('SOCCER_WORKER_KICK_CD') >= 0 && soccerCase.indexOf('T.workerKickCd') >= 0);
check('pass to a teammate / long kick up the block (a DIFFERENT kid retrieves)', soccerCase.indexOf('tx = mate.wx') >= 0 && soccerCase.indexOf('o.dir * R(12, 24)') >= 0 && soccerCase.indexOf('T.receiver = rec') >= 0);
check('the ball is ALWAYS in front of the carrying kid (hard clamp at SOCCER_LEAD)', soccerCase.indexOf('(B.wx - T.owner.wx) * T.owner.dir < 0.5') >= 0 && soccerCase.indexOf('B.wx = T.owner.wx + T.owner.dir * SOCCER_LEAD') >= 0);
check('ball has gravity + damped bounce (vz -= 12*dt, bounce * 0.55)', soccerCase.indexOf('B.vz -= 12 * dt') >= 0 && soccerCase.indexOf('B.vz = Math.abs(B.vz) * 0.55') >= 0);
check('kids stay clamped to the block (minX/maxX flips)', soccerCase.indexOf('k.wx >= T.maxX') >= 0 && soccerCase.indexOf('k.wx <= T.minX') >= 0 && soccerCase.indexOf('k.dir = -1') >= 0 && soccerCase.indexOf('k.dir = 1') >= 0);
check('the receiver SPRINTS to the ball (1.25x) and the idle kids block the worker', soccerCase.indexOf('sp * 1.25 * dt') >= 0 && soccerCase.indexOf('block the worker') >= 0);
check('no off-screen recycling (a fixed fixture of the block)', soccerCase.indexOf('break; // a fixed fixture: never recycles off-screen') >= 0);
function makeTeam() {
  const mkKid = (wx) => ({
    type: 'soccer', wx: wx, wy: 3, dir: 1, sp: 4, kidCd: 0, ballCd: 0, phase: 0,
    parts: { upper: { position: { z: 0.62 } } }, g: { rotation: { z: 0 } },
  });
  const kids = [mkKid(100), mkKid(120), mkKid(140)];
  const ball = { wx: 120, wy: 3, z: 0, vz: 0, tx: 120, ty: 3 };
  const ballG = { position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, rotation: { z: 0 } };
  return {
    kids: kids, leader: kids[0], ball: ball, ballG: ballG,
    minX: 90, maxX: 150, midX: 120,
    owner: kids[1], receiver: null, ownerKickT: 0.6, workerKickCd: 0, grabCd: 0,
  };
}
const animParts = (c, dp) => { c.phase += dp; };
const runCase = new Function(
  'c', 'dt', 'R', 'GZ', 'state', 'p', 'soccerTeam',
  'SOCCER_LEAD', 'SOCCER_PICKUP', 'SOCCER_WORKER_RANGE', 'SOCCER_KICK_VZ', 'SOCCER_WORKER_KICK_CD',
  'animParts',
  'switch (c.type) {' + soccerCase + '}',
);
let T = makeTeam();
const p = { wx: 999, wy: 3 }; // far away during the warm sim (no worker kicks yet)
let simOk = true, simDetail = '', ownerChanges = 0, sawReceiver = false, behind = 0, bandBad = 0;
let lastOwner = T.owner;
try {
  for (let t = 0; t < 6000; t++) {
    runCase(T.leader, 0.016, R, 0.3, 'play', p, T, SOCCER_LEAD, SOCCER_PICKUP, SOCCER_WORKER_RANGE, SOCCER_KICK_VZ, SOCCER_WORKER_KICK_CD, animParts);
    for (const k of T.kids) if (k.wx < T.minX - 1e-9 || k.wx > T.maxX + 1e-9) { simOk = false; simDetail = 'kid out of band at t=' + t + ' wx=' + k.wx.toFixed(2); break; }
    if (T.ball.wy < 0.5 || T.ball.wy > 5.2) bandBad++;
    if (T.owner && (T.ball.wx - T.owner.wx) * T.owner.dir < -0.05) behind++;
    if (T.owner !== lastOwner) { if (lastOwner !== null) ownerChanges++; lastOwner = T.owner; }
    if (T.receiver !== null && T.owner === null) sawReceiver = true;
  }
} catch (e) { simOk = false; simDetail = e.message; }
check('the team stays INSIDE its block for 6000 frames (~96s)', simOk, simDetail);
check('the ball stays on the walkable sidewalk band (wy ~0.5..5.0)', simOk && bandBad === 0, 'off-band frames=' + bandBad);
check('the ball is NEVER behind the carrying kid (always in front when moving)', simOk && behind === 0, 'behind frames=' + behind);
check('the ball keeps changing hands (ownership rotates between the kids)', simOk && ownerChanges >= 3, 'owner changes=' + ownerChanges);
check('kicks send the ball loose for a DIFFERENT kid to chase (receiver assigned)', simOk && sawReceiver, 'saw receiver=' + sawReceiver);
// scenario W: worker in range -> the ball is kicked AT him
(function () {
  T = makeTeam();
  const o = T.owner;
  p.wx = o.wx + 5; p.wy = 3; // within SOCCER_WORKER_RANGE (5 < 9)
  T.workerKickCd = 0;
  T.ownerKickT = 0.01; // force the kick this frame
  const kicker = T.owner;
  runCase(T.leader, 0.016, R, 0.3, 'play', p, T, SOCCER_LEAD, SOCCER_PICKUP, SOCCER_WORKER_RANGE, SOCCER_KICK_VZ, SOCCER_WORKER_KICK_CD, animParts);
  check('W: worker in range -> ball is kicked AT him (target = p.wx/p.wy)', T.ball.tx === p.wx && T.ball.ty === p.wy, 'target=(' + T.ball.tx + ',' + T.ball.ty + ') worker=(' + p.wx + ',' + p.wy + ')');
  check('W: kick goes loose, a DIFFERENT kid is assigned to retrieve, cd armed', T.owner === null && T.receiver !== null && T.receiver !== kicker && T.workerKickCd === SOCCER_WORKER_KICK_CD, 'recIdx=' + T.kids.indexOf(T.receiver) + ' kickerIdx=' + T.kids.indexOf(kicker) + ' cd=' + T.workerKickCd);
})();
// scenario L: mates close + worker far -> long kick up the block
(function () {
  T = makeTeam();
  const o = T.owner; // at 120, dir 1
  const oX = o.wx;
  for (const k of T.kids) if (k !== o) k.wx = o.wx + 2; // mates within 9u
  p.wx = 999; p.wy = 3;
  T.workerKickCd = 0;
  T.ownerKickT = 0.01;
  runCase(T.leader, 0.016, R, 0.3, 'play', p, T, SOCCER_LEAD, SOCCER_PICKUP, SOCCER_WORKER_RANGE, SOCCER_KICK_VZ, SOCCER_WORKER_KICK_CD, animParts);
  check('L: long kick up the block (12u ahead in the run direction)', T.ball.tx === oX + o.dir * 12 && T.ball.ty === o.wy, 'tx=' + T.ball.tx + ' ownerX=' + oX + ' dir=' + o.dir);
  check('L: a DIFFERENT kid sprints for the long ball', T.owner === null && T.receiver !== null && T.receiver !== o, 'recIdx=' + T.kids.indexOf(T.receiver));
})();
// scenario P: a mate >9u away gets the PASS
(function () {
  T = makeTeam();
  const o = T.owner; // at 120; mates at 100 and 140 (both >9u away)
  const mate0 = T.kids[0];
  const mateX = mate0.wx;
  p.wx = 999; p.wy = 3;
  T.workerKickCd = SOCCER_WORKER_KICK_CD; // ensure only the mate branch can fire
  T.ownerKickT = 0.01;
  const origRandom = Math.random;
  Math.random = () => 0.1; // < 0.55 -> pass branch; mates[0] = kids[0]
  let passOk = true, err = '';
  try {
    runCase(T.leader, 0.016, R, 0.3, 'play', p, T, SOCCER_LEAD, SOCCER_PICKUP, SOCCER_WORKER_RANGE, SOCCER_KICK_VZ, SOCCER_WORKER_KICK_CD, animParts);
  } catch (e) { passOk = false; err = e.message; }
  Math.random = origRandom;
  check('P: a mate >9u away gets the PASS (target = mate.wx)', passOk && T.ball.tx === mateX && T.ball.ty === o.wy, 'tx=' + T.ball.tx + ' mate0.wx=' + mateX);
  check('P: the passed mate is the receiver (a DIFFERENT kid goes to get it and kick it back)', passOk && T.receiver === mate0, 'recIdx=' + T.kids.indexOf(T.receiver));
})();
// scenario S: a DIFFERENT kid retrieves the loose ball and takes ownership
(function () {
  T = makeTeam();
  const o = T.owner;
  for (const k of T.kids) if (k !== o) k.wx = o.wx + 2;
  p.wx = 999; p.wy = 3;
  T.workerKickCd = SOCCER_WORKER_KICK_CD;
  T.ownerKickT = 0.01;
  const origRandom = Math.random;
  Math.random = () => 0.9; // > 0.55 -> long kick
  runCase(T.leader, 0.016, R, 0.3, 'play', p, T, SOCCER_LEAD, SOCCER_PICKUP, SOCCER_WORKER_RANGE, SOCCER_KICK_VZ, SOCCER_WORKER_KICK_CD, animParts);
  Math.random = origRandom;
  check('S: the receiver (a DIFFERENT kid) sprints for the loose ball', T.receiver !== null && T.receiver !== o, 'recIdx=' + T.kids.indexOf(T.receiver));
  let grabbed = false;
  for (let t = 0; t < 400 && !grabbed; t++) {
    runCase(T.leader, 0.016, R, 0.3, 'play', p, T, SOCCER_LEAD, SOCCER_PICKUP, SOCCER_WORKER_RANGE, SOCCER_KICK_VZ, SOCCER_WORKER_KICK_CD, animParts);
    if (T.owner && T.owner !== o) grabbed = true;
  }
  check('S: a DIFFERENT kid grabs the loose ball and ownership transfers', grabbed, 'new owner idx=' + (T.owner ? T.kids.indexOf(T.owner) : -1));
})();

console.log('[4] collideCreatures — the REAL bump exchanges');
check('soccer kid collision radius registered (rad 0.9 — a small kid)', /else if \(c\.type === "soccer"\)\s*\n\s*rad = 0\.9;/.test(src));
function extractIfBlock(openLine) {
  const fnStart = src.indexOf('function collideCreatures() {');
  if (fnStart < 0) throw new Error('collideCreatures not found');
  const start = src.indexOf(openLine, fnStart);
  if (start < 0) throw new Error(openLine + ' not found in collideCreatures');
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) break; } }
  return src.slice(start, i + 1);
}
// (a) the ball bonk — checked BEFORE the generic kid-radius gate
const ballBlock = extractIfBlock('if (c.type === "soccer" && c.ball) {');
check('ball bonk: minor whack tagged "soccer" + stun', ballBlock.indexOf('hurtNPC(HP_HIT_SOCCERBALL, "soccer")') >= 0 && ballBlock.indexOf('doStun(0.5, "hit")') >= 0);
check('ball bonk: worker "Hey dont do that!" (burst) + kid "GOAAAAL!"', ballBlock.indexOf('"Hey dont do that!"') >= 0 && ballBlock.indexOf('"GOAAAAL!"') >= 0);
check('ball bonk: the worker DEFLECTS the ball loose (owner released, grabCd, new target + receiver)', ballBlock.indexOf('soccerTeam.owner = null') >= 0 && ballBlock.indexOf('soccerTeam.grabCd = 0.8') >= 0 && ballBlock.indexOf('defBall.tx = R(soccerTeam.minX + 2, soccerTeam.maxX - 2)') >= 0 && ballBlock.indexOf('soccerTeam.receiver =') >= 0);
check('ball bonk has a cooldown (no spam)', ballBlock.indexOf('c.ballCd = 2.5') >= 0 && ballBlock.indexOf('c.ballCd <= 0') >= 0);
// (b) the kid contact
const kidBlock = extractIfBlock('if (c.type === "soccer") {');
check('kid bump: light damage tagged "soccer"', kidBlock.indexOf('hurtNPC(HP_HIT_SOCKER, "soccer")') >= 0);
check('kid bump: kid fires one of the 3 panic lines', kidBlock.indexOf('pick(SOCKER_LINES)') >= 0);
check('kid bump: worker bounces back + light stun', kidBlock.indexOf('p.wx -= (dx / d) * 1.1') >= 0 && kidBlock.indexOf('doStun(0.6, "hit")') >= 0);
check('kid bump has a cooldown (no spam)', kidBlock.indexOf('c.kidCd = 2.5') >= 0 && kidBlock.indexOf('c.kidCd <= 0') >= 0);
// ---- run the REAL branches ----
function makeRecorder() {
  const rec = { hits: [], stuns: [], lines: [] };
  const hurtNPC = (amt, cause) => rec.hits.push({ amt: amt, cause: cause });
  const doStun = (d, t) => rec.stuns.push({ d: d, t: t });
  const Voice = { say: (...a) => rec.lines.push({ text: a[0], speaker: a[6], style: a[7] }) };
  return { rec: rec, hurtNPC: hurtNPC, doStun: doStun, Voice: Voice };
}
const runBallBlock = new Function('c', 'p', 'hurtNPC', 'doStun', 'Voice', 'WORKER_GENDER', 'clamp', 'workerMaxY', 'HP_HIT_SOCCERBALL', 'soccerTeam', 'R', ballBlock);
const runKidBlock = new Function('c', 'p', 'dx', 'dy', 'd2', 'hurtNPC', 'doStun', 'Voice', 'WORKER_GENDER', 'pick', 'SOCKER_LINES', 'HP_HIT_SOCKER', 'clamp', 'workerMaxY', kidBlock);
// scenario A: worker bonks the ball (kid 2.5u behind it — outside the kid's own radius)
(function () {
  const { rec, hurtNPC, doStun, Voice } = makeRecorder();
  const B = { wx: 0.4, wy: 3, z: 0.1, vz: 0.5, tx: 0.4, ty: 3 };
  const Tt = {
    owner: { wx: 3, wy: 3 }, grabCd: 0, minX: 5, maxX: 40,
    ball: B, kids: [{ wx: 3 }, { wx: 10 }, { wx: 20 }], receiver: null,
  };
  const c = { type: 'soccer', wx: 2.5, wy: 3, gender: 'male', ballCd: 0, ball: B };
  const pw = { wx: 0, wy: 3 };
  runBallBlock(c, pw, hurtNPC, doStun, Voice, WORKER_GENDER, clamp, workerMaxY, HP_HIT_SOCCERBALL, Tt, R);
  check('A: ball bonk deals the MINOR whack (2) tagged "soccer"', rec.hits.length === 1 && rec.hits[0].amt === 2 && rec.hits[0].cause === 'soccer', JSON.stringify(rec.hits));
  check('A: worker "Hey dont do that!" (burst) + kid "GOAAAAL!"', rec.lines.some(l => l.text === 'Hey dont do that!' && l.speaker === 'worker' && l.style === 'burst') && rec.lines.some(l => l.text === 'GOAAAAL!' && l.speaker === 'kid'), JSON.stringify(rec.lines));
  check('A: worker bounces back off the ball', pw.wx < 0, 'p.wx=' + pw.wx.toFixed(3));
  check('A: the bonk DEFLECTS the ball — owner released, receiver assigned, target on the sidewalk band', Tt.owner === null && Tt.grabCd === 0.8 && Tt.receiver !== null && B.tx >= 5 && B.tx <= 40 && B.ty >= 1.6 && B.ty <= 4.2 && B.vz >= 1.8, 'tx=' + B.tx + ' ty=' + B.ty + ' vz=' + B.vz + ' recIdx=' + Tt.kids.indexOf(Tt.receiver));
  rec.hits.length = 0;
  runBallBlock(c, pw, hurtNPC, doStun, Voice, WORKER_GENDER, clamp, workerMaxY, HP_HIT_SOCCERBALL, Tt, R);
  check('A: ball bonk cooldown blocks an instant second whack', rec.hits.length === 0, JSON.stringify(rec.hits));
})();
// scenario B: worker touches the kid (ball far away)
(function () {
  const { rec, hurtNPC, doStun, Voice } = makeRecorder();
  const c = { type: 'soccer', wx: 0.5, wy: 3, gender: 'male', kidCd: 0, ballCd: 0, ball: { wx: 20, wy: 3 } };
  const pw = { wx: 0, wy: 3 };
  const dx = c.wx - pw.wx, dy = c.wy - pw.wy, d2 = dx * dx + dy * dy;
  runKidBlock(c, pw, dx, dy, d2, hurtNPC, doStun, Voice, WORKER_GENDER, pick, SOCKER_LINES, HP_HIT_SOCKER, clamp, workerMaxY);
  check('B: kid bump deals the light hit (3) tagged "soccer"', rec.hits.length === 1 && rec.hits[0].amt === 3 && rec.hits[0].cause === 'soccer', JSON.stringify(rec.hits));
  check('B: kid fires a panic line ("Don\'t touch me!"/"Mommy!"/"Bad man!")', rec.lines.some(l => l.speaker === 'kid' && SOCKER_LINES.indexOf(l.text) >= 0), JSON.stringify(rec.lines));
  check('B: worker is bounced back off the kid', pw.wx < 0, 'p.wx=' + pw.wx.toFixed(3));
  rec.hits.length = 0;
  runKidBlock(c, pw, dx, dy, d2, hurtNPC, doStun, Voice, WORKER_GENDER, pick, SOCKER_LINES, HP_HIT_SOCKER, clamp, workerMaxY);
  check('B: kid-bump cooldown blocks an instant second hit', rec.hits.length === 0, JSON.stringify(rec.hits));
})();

console.log('[5] the crowd routes around the soccer kids');
(function () {
  // extract the REAL npcWalkAroundObstacles and prove a walker detours around a soccer kid
  function extractFn(name) {
    const idx = src.indexOf('function ' + name + '(');
    if (idx < 0) throw new Error(name + ' not found');
    let brace = src.indexOf('{', idx), depth = 0, i = brace;
    for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) break; } }
    return src.slice(idx, i + 1);
  }
  global.WALKER_R = 0.5;
  global.AVOID_TYPES = { ped: 1, lady: 1, dogwalker: 1, scholar: 1, dealer: 1, panhandler: 1, dog: 1, cat: 1, raccoon: 1, squirrel: 1, leashdog: 1, soccer: 1 };
  global.AVOID_AHEAD = 6.0;
  global.blocks = [];
  global.creatures = [{ type: 'soccer', wx: 11, wy: 1.5 }]; // the soccer kid ahead, in the lane
  global.litterBaskets = [];
  eval(extractFn('npcWalkAroundObstacles'));
  const c = { type: 'ped', wx: 8, wy: 2.0, dir: 1, __yMin: 0.8, __yMax: 5.0 };
  const startWy = c.wy;
  for (let i = 0; i < 200; i++) npcWalkAroundObstacles(c, 0.016, c.__yMin, c.__yMax);
  check('walker STEPS AROUND a soccer kid (wy changed) and stays on the walkable band', Math.abs(c.wy - startWy) > 0.4 && c.wy >= c.__yMin - 1e-9 && c.wy <= c.__yMax + 1e-9, 'wy ' + startWy + ' -> ' + c.wy.toFixed(2));
})();

console.log('[6] bubble punch-ups (POW! bursts + bonus starbursts)');
check('.bubble.bub-burst CSS exists (jagged clip-path star, red, Bangers lettering via .bubble base)', /\.bubble\.bub-burst \{[\s\S]*?clip-path: polygon\([\s\S]*?\)[\s\S]*?\}/.test(src));
check('burst hides the speech tail', /\.bubble\.bub-burst::after \{\s*display: none;/.test(src));
check('burst pop-in animation (burstPop keyframes)', src.indexOf('@keyframes burstPop') >= 0);
check('spawnBubble auto-bursts the worker\'s "OW!" hit lines', /style === "burst" \|\|[\s\S]*?speaker === "worker" && \/\^ow\/i\.test\(String\(text\)\.trim\(\)\)/.test(src));
check('Voice.say forwards the burst style to spawnBubble', /say\(text, gap, pitch, bx, by, gender, speaker, style\)/.test(src) && src.indexOf('spawnBubble(text, bx, by, speaker, style)') >= 0);
check('.popup .pop-star CSS (Bangers + star clip-path for the bonus finds)', /\.popup \.pop-star \{[\s\S]*?Bangers[\s\S]*?clip-path: polygon\(/.test(src));
check('each reward keeps its own star color (mongo orange / cash green / treasure gold)', src.indexOf('.popup.pop-mongo .pop-star') >= 0 && src.indexOf('.popup.pop-cash .pop-star') >= 0 && src.indexOf('.popup.pop-treasure .pop-star') >= 0);
check('showPopup wraps the reward word in the star', src.indexOf('let html = \'<span class="pop-star">\' + cfg.text + "</span>";') >= 0);
check('WRITTEN UP / LODI / POWER UP popups are NOT star-wrapped (only bonus finds)', (function () {
  const w = src.slice(src.indexOf('function showWriteUpText('), src.indexOf('function announcePower('));
  const a = src.slice(src.indexOf('function announcePower('), src.indexOf('function showDownText('));
  const d = src.slice(src.indexOf('function showDownText('), src.indexOf('function spawnZZZ('));
  return w.indexOf('pop-star') < 0 && a.indexOf('pop-star') < 0 && d.indexOf('pop-star') < 0;
})());

console.log(ok ? '\nSOCCER TEAM CHECKS PASSED' : '\nSOCCER TEAM CHECKS FAILED');
process.exit(ok ? 0 : 1);