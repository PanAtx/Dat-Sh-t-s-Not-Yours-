// _soccer_chk.js — verify the Flatbush SOCCER TEAMS feature (index.html). 3 small
// kids in DIFFERENT shirts on EVERY block's NEAR SIDEWALK (wy 1.6..4.2, never on
// the asphalt) really PLAY soccer with ONE shared ball per team:
//   1) wiring: constants, the addCreature case (distinct shirts, no boxW), the
//      REAL ball (12 pentagons at icosahedron vertices — not a dalmatian), the
//      team spawn (3 kids, 1 ball on the leader, chalk field + book-goal mouths),
//      AVOID_TYPES, write-ups.
//   2) the REAL case "soccer" body from updateCreatures, SIMULATED with the real
//      team state: the owner dribbles and SHOOTS goal-to-goal at the book goal
//      he's running toward, passes to the most-advanced mate, or boots the ball
//      at the worker when he's close; a ball into the goal mouth = GOOOOAL! +
//      celebration + kickoff by the scorer; the receiver SPRINTS for loose
//      balls; nobody stops, nobody sidesteps a bottle or a tree, nobody leaves
//      the block.
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
const SOCCER_SHOT_VZ = 4.4, SOCCER_SHOT_RANGE = 12, SOCCER_ROLL_SP = 8, SOCCER_PASS_MIN = 6;
const SOCCER_ROLL_ACCEL = 30, SOCCER_BALL_R = 0.22; // mirror index.html (kick acceleration + ball radius for the speed-based spin)
const SOCCER_GOAL_R = 1.1, SOCCER_GOAL_YR = 1.2, SOCCER_CELEBRATE = 1.6;
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
check('goal-play constants exist (shot range 12 / roll speed 8 / shot lob 4.4 / pass min 6 / mouth 1.1 x 1.2 / celebrate 1.6s)',
  src.indexOf('const SOCCER_SHOT_RANGE = 12;') >= 0 && src.indexOf('const SOCCER_ROLL_SP = 8;') >= 0 && src.indexOf('const SOCCER_SHOT_VZ = 4.4;') >= 0 &&
  src.indexOf('const SOCCER_PASS_MIN = 6;') >= 0 && src.indexOf('const SOCCER_GOAL_R = 1.1;') >= 0 &&
  src.indexOf('const SOCCER_GOAL_YR = 1.2;') >= 0 && src.indexOf('const SOCCER_CELEBRATE = 1.6;') >= 0);
check('team state is declared (soccerShirtQueue + soccerTeams)',
  src.indexOf('let soccerShirtQueue = []') >= 0 && src.indexOf('let soccerTeams = []') >= 0);
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
check('ball is a white sphere resting on the ground (core centered at 0.22 above the contact point)', ballFn.indexOf('SPH(R, M(0xf5f5f0))') >= 0 && ballFn.indexOf('core.position.z = R;') >= 0 && ballFn.indexOf('ball.position.z = R;') < 0);
check('ball has 12 black pentagons (icosahedron vertices — a real soccer ball, not a dalmatian)',
  ballFn.indexOf('PHI = (1 + Math.sqrt(5)) / 2') >= 0 &&
  (ballFn.match(/\[[^\[\]]+,\s*[^\[\]]+,\s*[^\[\]]+\]/g) || []).length >= 12 &&
  ballFn.indexOf('THREE.ShapeGeometry') >= 0 && ballFn.indexOf('pent.quaternion.setFromUnitVectors') >= 0);
check('pentagons + sphere live in a CORE group centered on the ball centre (exposed via userData) — spots ALL around',
  ballFn.indexOf('const core = new THREE.Group();') >= 0 &&
  ballFn.indexOf('core.add(pent)') >= 0 && ballFn.indexOf('g.add(core)') >= 0 &&
  ballFn.indexOf('g.userData.core = core') >= 0);
check('the roll spins the CORE (the ball centre), NOT the outer contact-point group (orbiting it dips the ball into the sidewalk)',
  src.indexOf('T.ballG.userData.core.rotation.y +=') >= 0 && src.indexOf('T.ballG.rotation.y +=') < 0);
check('the old 6-patch dalmatian is gone', ballFn.indexOf('BX(0.08, 0.08, 0.03, patchM)') < 0);
// spawn: Flatbush only, EVERY block gets a team, 3 distinct shirts, chalk field
const spawnSrc = (function () {
  const i = src.indexOf('Flatbush soccer TEAMS: THREE small kids');
  if (i < 0) return '';
  let j = src.indexOf('if (isFlatbushLevel()) {', i);
  let k = src.indexOf('{', j), d = 0;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) break; } }
  return src.slice(i, k + 1);
})();
check('soccer spawn is Flatbush-only (isFlatbushLevel gate)', spawnSrc.indexOf('if (isFlatbushLevel()) {') >= 0);
check('EVERY block of the level gets its own team (one trio per block, old single-block pick is gone)', spawnSrc.indexOf('for (const sb of LEVEL_BLOCKS) {') >= 0 && spawnSrc.indexOf('LEVEL_BLOCKS.filter(b => b.garbage)') < 0);
check('3 kids get 3 DISTINCT shirt colors (the team look)', spawnSrc.indexOf('sShirts.length < 3') >= 0 && spawnSrc.indexOf('sShirts.indexOf(sCol) < 0') >= 0 && spawnSrc.indexOf('soccerShirtQueue = soccerShirtQueue.concat(sShirts)') >= 0);
check('3 kids are spread along the block on the NEAR SIDEWALK (wy 1.6..4.2)', spawnSrc.indexOf('sMinX + ((sMaxX - sMinX) * (si + 0.5)) / 3') >= 0 && spawnSrc.indexOf('sk.wy = R(1.6, 4.2)') >= 0);
check('the team patrols the WHOLE block (minX/maxX = block edge ± SOCCER_MARGIN)', spawnSrc.indexOf('sMinX = sb.x + SOCCER_MARGIN') >= 0 && spawnSrc.indexOf('sMaxX = sb.x + BLOCK_W - SOCCER_MARGIN') >= 0);
check('ONE shared ball: the leader carries c.ball/c.ballG, added to the world ONCE', spawnSrc.indexOf('sLeader.ball = sBall') >= 0 && spawnSrc.indexOf('sLeader.ballG = sBallG') >= 0 && spawnSrc.indexOf('dynamicGroup.add(sBallG)') >= 0);
check('each team is built (kids/leader/ball/owner/receiver + cooldowns), kids know their team, and it is pushed to soccerTeams', spawnSrc.indexOf('const sTeam = {') >= 0 && spawnSrc.indexOf('owner: sKids[1]') >= 0 && spawnSrc.indexOf('receiver: null') >= 0 && spawnSrc.indexOf('workerKickCd: 0') >= 0 && spawnSrc.indexOf('sk.team = sTeam') >= 0 && spawnSrc.indexOf('soccerTeams.push(sTeam)') >= 0);
check('the team state knows BOTH book-goal mouths (goalL/goalR just past the patrol ends)',
  spawnSrc.indexOf('goalL: { x: sMinX - 1.4, y: 3.0 }') >= 0 && spawnSrc.indexOf('goalR: { x: sMaxX + 1.4, y: 3.0 }') >= 0);
check('celebration state is declared (celebrateT / score / lastKicker / scorer)',
  spawnSrc.indexOf('celebrateT: 0') >= 0 && spawnSrc.indexOf('score: 0') >= 0 && spawnSrc.indexOf('lastKicker: null') >= 0 && spawnSrc.indexOf('scorer: null') >= 0);
check('the spawn says it: they really play soccer and NEVER stop (run right through the junk)',
  spawnSrc.indexOf('really playing soccer') >= 0 && spawnSrc.indexOf('NEVER stop') >= 0 && spawnSrc.indexOf('run right through') >= 0);
check('the chalk field is on their block (center circle + center line + book goals)', spawnSrc.indexOf('THREE.RingGeometry(1.1, 1.35, 40)') >= 0 && spawnSrc.indexOf('THREE.BoxGeometry(0.1, 3.2, 0.02)') >= 0 && spawnSrc.indexOf('sBookCols') >= 0 && spawnSrc.indexOf('groundGroup.add(sCircle)') >= 0);
check('soccer blocks are IN-ROUTE garbage blocks (6 of the 8 blocks carry garbage)', (function () {
  const m = src.match(/const LEVEL_BLOCKS = \[([\s\S]*?)\];/);
  if (!m) return false;
  const blocks = eval('[' + m[1] + ']');
  return blocks.filter(b => b.garbage).length === 6;
})());
check('AVOID_TYPES includes soccer (the crowd routes around the team)', /AVOID_TYPES = \{[\s\S]*?soccer:\s*1/.test(src));
check('WRITEUP_REASONS has a soccer entry (the supervisor\'s offense file)', /soccer:\s*\[[\s\S]*?"Failure to respect a sacred soccer ball"[\s\S]*?\]/.test(src));
// Flatbush stoop: the worker's ground height (stepTopAt) must use the stoop's REAL footprint
const brownstoneSrc = (function () {
  const i = src.indexOf('function makeBrownstone(storeOptions) {');
  if (i < 0) return '';
  let k = src.indexOf('{', i),
    d = 0;
  for (; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') {
      d--;
      if (d === 0) break;
    }
  }
  return src.slice(i, k + 1);
})();
check('Flatbush stoop collision = the REAL 4-step stoop (per-step regions, 2.5u wide) — a bonked worker can no longer stand on a phantom-wide band and float',
  brownstoneSrc.indexOf('g.userData.stairs') >= 0 && brownstoneSrc.indexOf('hw: 1.25') >= 0 && brownstoneSrc.indexOf('top: 0.3 + (sI + 1) * 0.17') >= 0 && brownstoneSrc.indexOf('w * 0.35') < 0);
check('the Flatbush driveway center line is the sidewalk dark-gray (0x79818a), not white', src.indexOf('BX(0.15, 7.0, 0.005, M(0x79818a))') >= 0 && src.indexOf('BX(0.15, 7.0, 0.005, M(0xffffff))') < 0);

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
check('only the LEADER simulates its team (the other 2 kids\' ticks no-op)', soccerCase.indexOf('c.team.leader !== c') >= 0);
check('GOAL? ball into a book-goal mouth is checked BEFORE pickup (inMouth + z gate)', soccerCase.indexOf('inMouth(B.wx, B.wy)') >= 0 && soccerCase.indexOf('B.z < 1.0') >= 0 && soccerCase.indexOf('!T.owner') >= 0);
check('a goal arms the celebration + score + scorer (lastKicker)', soccerCase.indexOf('T.celebrateT = SOCCER_CELEBRATE') >= 0 && soccerCase.indexOf('T.score = (T.score || 0) + 1;') >= 0 && soccerCase.indexOf('T.scorer = T.lastKicker') >= 0);
check('the "GOOOOAL!" bubble is spoken by a kid', soccerCase.indexOf('Voice.say("GOOOOAL!"') >= 0 && soccerCase.indexOf('"kid"') >= 0);
check('kickoff: the ball STAYS in the net — the nearest kid runs to it and kicks it a small distance toward the OTHER goal (the ball never kicks itself)',
  soccerCase.indexOf('T.kickoffDir = B.wx >= T.midX ? -1 : 1') >= 0 &&
  soccerCase.indexOf('o.wx + T.kickoffDir * R(3.0, 5.0)') >= 0 &&
  soccerCase.indexOf('B.wx = T.midX') < 0 && soccerCase.indexOf('B.vz = 1.4') < 0);
check('no double goal: a ball resting in the net during the kickoff restart does not re-score',
  soccerCase.indexOf('!T.owner && !T.kickoffDir && B.z < 1.0 && inMouth(B.wx, B.wy))') >= 0);
check('the receiver may SPRINT for a ball resting in the net (kickoff restart)',
  soccerCase.indexOf('!inMouth(B.wx, B.wy) || T.kickoffDir') >= 0);
check('loose-ball pickup: closest kid within SOCCER_PICKUP, ball low, grabCd respected', soccerCase.indexOf('SOCCER_PICKUP') >= 0 && soccerCase.indexOf('B.z < 0.8') >= 0 && soccerCase.indexOf('T.grabCd <= 0') >= 0);
check('kick priority 1: the worker when he\'s close (SOCCER_WORKER_RANGE, target = p.wx/p.wy)', soccerCase.indexOf('SOCCER_WORKER_RANGE') >= 0 && soccerCase.indexOf('tx = p.wx') >= 0 && soccerCase.indexOf('ty = p.wy') >= 0);
check('kick cooldown for worker-aimed kicks (no spam)', soccerCase.indexOf('SOCCER_WORKER_KICK_CD') >= 0 && soccerCase.indexOf('T.workerKickCd') >= 0);
check('kick priority 2: GOAL-TO-GOAL shot at the book goal he\'s facing (SOCCER_SHOT_RANGE, hard SOCCER_SHOT_VZ lob)', soccerCase.indexOf('goalAhead = o.dir > 0 ? T.goalR : T.goalL') >= 0 && soccerCase.indexOf('Math.abs(goalAhead.x - o.wx) < SOCCER_SHOT_RANGE') >= 0 && soccerCase.indexOf('tx = goalAhead.x') >= 0 && soccerCase.indexOf('vz = SOCCER_SHOT_VZ') >= 0);
check('in shot range the owner\'s kick wait is cut (no dawdling at the goal)', soccerCase.indexOf('Math.min(T.ownerKickT || 1, 0.35)') >= 0);
check('kick priority 3: pass to the most-advanced mate (SOCCER_PASS_MIN), else a long clear', soccerCase.indexOf('bestAdv = SOCCER_PASS_MIN') >= 0 && soccerCase.indexOf('tx = bestMate.wx') >= 0 && soccerCase.indexOf('o.dir * R(12, 24)') >= 0);
check('every kick goes loose and a DIFFERENT kid sprints for it (T.receiver = rec)', soccerCase.indexOf('T.receiver = rec') >= 0 && soccerCase.indexOf('T.lastKicker = o') >= 0);
check('the ball is ALWAYS in front of the carrying kid (hard clamp at SOCCER_LEAD)', soccerCase.indexOf('(B.wx - T.owner.wx) * T.owner.dir < 0.5') >= 0 && soccerCase.indexOf('B.wx = T.owner.wx + T.owner.dir * SOCCER_LEAD') >= 0);
check('ball has gravity + damped bounce (vz -= 12*dt, bounce * 0.55)', soccerCase.indexOf('B.vz -= 12 * dt') >= 0 && soccerCase.indexOf('B.vz = Math.abs(B.vz) * 0.55') >= 0);
check('a kick is SMOOTH: the ball ACCELERATES to rolling speed (SOCCER_ROLL_ACCEL) and brakes to rest at its target — no one-frame jump to full speed',
  soccerCase.indexOf('SOCCER_ROLL_ACCEL') >= 0 && soccerCase.indexOf('stopDist') >= 0 && soccerCase.indexOf('B.z = Math.max(B.z, 0.15)') < 0);
check('the roll spin is SPEED-based (rotation rate = ground speed / ball radius — a fast kick spins fast, a still ball does not spin)',
  soccerCase.indexOf('T.ballG.userData.core.rotation.y += (svx / SOCCER_BALL_R) * dt') >= 0 && soccerCase.indexOf('* dt * 8') < 0);
check('kids stay clamped to the block (hiX/loX flips)', soccerCase.indexOf('k.wx >= hiX') >= 0 && soccerCase.indexOf('k.wx <= loX') >= 0 && soccerCase.indexOf('k.dir = -1') >= 0 && soccerCase.indexOf('k.dir = 1') >= 0);
check('the receiver SPRINTS 2D (1.6x) and the mates jog in — nobody idles', soccerCase.indexOf('k.sp * 1.6 * dt') >= 0 && soccerCase.indexOf('k.sp * 0.95 * dt') >= 0 && soccerCase.indexOf('k.sp * 1.15 * dt') >= 0);
check('the case references NO obstacle system (bottles/cans/trees are not in their path)', soccerCase.indexOf('npcWalkAroundObstacles') < 0 && soccerCase.indexOf('hazards') < 0 && soccerCase.indexOf('b.trees') < 0 && soccerCase.indexOf('c.stop') < 0 && soccerCase.indexOf('yieldLane') < 0);
check('no off-screen recycling (a fixed fixture of the block)', soccerCase.indexOf('break; // a fixed fixture: never recycles off-screen') >= 0);
function makeTeam() {
  const mkKid = (wx) => ({
    type: 'soccer', wx: wx, wy: 3, dir: 1, sp: 4, kidCd: 0, ballCd: 0, phase: 0,
    parts: { upper: { position: { z: 0.62 } } }, g: { rotation: { z: 0 } },
  });
  const kids = [mkKid(100), mkKid(120), mkKid(140)];
  const ball = { wx: 120, wy: 3, z: 0, vz: 0, vx: 0, vy: 0, tx: 120, ty: 3 };
  const ballG = { position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, rotation: { z: 0 }, userData: { core: { rotation: { y: 0 } } } };
  const team = {
    kids: kids, leader: kids[0], ball: ball, ballG: ballG,
    minX: 90, maxX: 150, midX: 120,
    goalL: { x: 88.6, y: 3.0 }, goalR: { x: 151.4, y: 3.0 }, // book-goal mouths at the block ends
    owner: kids[1], receiver: null, ownerKickT: 0.6, workerKickCd: 0, grabCd: 0, kickoffDir: 0,
    celebrateT: 0, score: 0, lastKicker: null, scorer: null,
  };
  for (const k of kids) k.team = team; // the case body simulates via c.team
  return team;
}
const animParts = (c, dp) => { c.phase += dp; };
const voiceCalls = [];
const Voice = { say(text, gap, pitch, bx, by, gender, speaker, style) { voiceCalls.push({ text: text, speaker: speaker, style: style }); } };
const runCase = new Function(
  'c', 'dt', 'R', 'GZ', 'state', 'p', 'soccerTeam',
  'SOCCER_LEAD', 'SOCCER_PICKUP', 'SOCCER_WORKER_RANGE', 'SOCCER_KICK_VZ', 'SOCCER_WORKER_KICK_CD',
  'SOCCER_SHOT_RANGE', 'SOCCER_SHOT_VZ', 'SOCCER_ROLL_SP', 'SOCCER_PASS_MIN', 'SOCCER_GOAL_R', 'SOCCER_GOAL_YR', 'SOCCER_CELEBRATE',
  'SOCCER_ROLL_ACCEL', 'SOCCER_BALL_R', 'clamp',
  'Voice', 'animParts',
  'switch (c.type) {' + soccerCase + '}',
);
let T = makeTeam();
const p = { wx: 999, wy: 3 }; // far away during the warm sim (no worker kicks yet)
const step = (pw) =>
  runCase(T.leader, 0.016, R, 0.3, 'play', pw, T, SOCCER_LEAD, SOCCER_PICKUP, SOCCER_WORKER_RANGE, SOCCER_KICK_VZ, SOCCER_WORKER_KICK_CD, SOCCER_SHOT_RANGE, SOCCER_SHOT_VZ, SOCCER_ROLL_SP, SOCCER_PASS_MIN, SOCCER_GOAL_R, SOCCER_GOAL_YR, SOCCER_CELEBRATE, SOCCER_ROLL_ACCEL, SOCCER_BALL_R, clamp, Voice, animParts);
let simOk = true, simDetail = '', ownerChanges = 0, sawReceiver = false, behind = 0, ballBandBad = 0, nanFrames = 0;
let lastOwner = T.owner;
try {
  for (let t = 0; t < 6000; t++) {
    step(p);
    for (const k of T.kids) {
      // a NaN position paints the mesh at nothing — the kid "disappears". Never allow it.
      if (!isFinite(k.wx) || !isFinite(k.wy)) { simOk = false; simDetail = 'kid position not finite at t=' + t + ' wx=' + k.wx + ' wy=' + k.wy; nanFrames++; }
      // the RECEIVER may chase a ball past the block end; the other kids stay inside
      if (k === T.receiver) {
        if (k.wx < T.minX - 2.0 || k.wx > T.maxX + 2.0) { simOk = false; simDetail = 'receiver out of reach band at t=' + t + ' wx=' + k.wx.toFixed(2); }
      } else if (k.wx < T.minX - 1e-9 || k.wx > T.maxX + 1e-9) { simOk = false; simDetail = 'kid out of band at t=' + t + ' wx=' + k.wx.toFixed(2); }
      if (k.wy < 1.4 || k.wy > 4.4) { simOk = false; simDetail = 'kid wy off the sidewalk at t=' + t + ' wy=' + k.wy.toFixed(2); }
    }
    if (!isFinite(T.ball.wx) || !isFinite(T.ball.wy) || !isFinite(T.ball.z)) { simOk = false; simDetail = 'ball position not finite at t=' + t; nanFrames++; }
    if (T.ball.wy < 0.5 || T.ball.wy > 5.2) ballBandBad++;
    if (T.owner && (T.ball.wx - T.owner.wx) * T.owner.dir < -0.05) behind++;
    if (T.owner !== lastOwner) { if (lastOwner !== null) ownerChanges++; lastOwner = T.owner; }
    if (T.receiver !== null && T.owner === null) sawReceiver = true;
  }
} catch (e) { simOk = false; simDetail = e.message; }
check('the team stays INSIDE its block for 6000 frames (~96s) (receiver may chase a ball past the end)', simOk, simDetail);
check('no kid/ball position ever goes NaN (a NaN mesh position = the kid "disappears")', simOk && nanFrames === 0, 'nan frames=' + nanFrames);
check('the ball stays on the walkable band (wy ~0.5..5.0)', simOk && ballBandBad === 0, 'off-band frames=' + ballBandBad);
check('the ball is NEVER behind the carrying kid (always in front when moving)', simOk && behind === 0, 'behind frames=' + behind);
check('the ball keeps changing hands (ownership rotates between the kids)', simOk && ownerChanges >= 3, 'owner changes=' + ownerChanges);
check('kicks send the ball loose for a DIFFERENT kid to chase (receiver assigned)', simOk && sawReceiver, 'saw receiver=' + sawReceiver);
check('they actually SCORE: a ball drops into a book goal (T.score >= 1)', simOk && T.score >= 1, 'score=' + T.score);
check('the "GOOOOAL!" celebration bubble was spoken by a kid', simOk && voiceCalls.some(l => l.text === 'GOOOOAL!' && l.speaker === 'kid'), 'calls=' + voiceCalls.length);
// scenario W: worker in range (AND in shot range) -> the worker kick wins
(function () {
  T = makeTeam();
  const o = T.owner; // kids[1]
  o.wx = 140; o.dir = 1; // inside SOCCER_SHOT_RANGE of goalR (11.4 < 12)
  p.wx = o.wx + 6; p.wy = 3; // within SOCCER_WORKER_RANGE (6 < 9) — closer than the goal
  T.workerKickCd = 0;
  T.ownerKickT = 0.01; // force the kick this frame
  const kicker = T.owner;
  const b0x = T.ball.wx; // the ball's spot the moment before the kick
  step(p);
  check('W: worker in range -> ball is kicked AT him (target = p.wx/p.wy), not the goal', T.ball.tx === p.wx && T.ball.ty === p.wy && T.ball.tx !== T.goalR.x, 'target=(' + T.ball.tx + ',' + T.ball.ty + ') worker=(' + p.wx + ',' + p.wy + ')');
  check('W: kick goes loose, a DIFFERENT kid is assigned to retrieve, cd armed', T.owner === null && T.receiver !== null && T.receiver !== kicker && T.workerKickCd === SOCCER_WORKER_KICK_CD, 'recIdx=' + T.kids.indexOf(T.receiver) + ' kickerIdx=' + T.kids.indexOf(kicker) + ' cd=' + T.workerKickCd);
  check('W: the kick is a SMOOTH acceleration — first-frame travel is a fraction of full rolling speed (no forward jump)', Math.abs(T.ball.wx - b0x) < 0.05, 'first frame ' + Math.abs(T.ball.wx - b0x).toFixed(4) + 'u vs ' + (SOCCER_ROLL_SP * 0.016).toFixed(3) + 'u at full speed');
})();
// scenario L: no mate advanced + no shot range -> long kick up the block
(function () {
  T = makeTeam();
  const o = T.owner; // at 120, dir 1
  const oX = o.wx;
  for (const k of T.kids) if (k !== o) k.wx = o.wx + 2; // both mates close (no one advanced)
  p.wx = 999; p.wy = 3;
  T.workerKickCd = 0;
  T.ownerKickT = 0.01;
  step(p);
  check('L: long kick up the block (12u ahead in the run direction)', T.ball.tx === oX + o.dir * 12 && T.ball.ty === o.wy, 'tx=' + T.ball.tx + ' ownerX=' + oX + ' dir=' + o.dir);
  check('L: a DIFFERENT kid sprints for the long ball', T.owner === null && T.receiver !== null && T.receiver !== o, 'recIdx=' + T.kids.indexOf(T.receiver));
})();
// scenario P: a mate more advanced toward the goal gets the PASS
(function () {
  T = makeTeam();
  const o = T.owner; // at 120; mates at 100 and 140
  const advanced = T.kids[2]; // at 140 — most advanced toward goalR
  const mateX = advanced.wx; // capture BEFORE the tick (the mate drifts after the pass)
  p.wx = 999; p.wy = 3;
  T.workerKickCd = SOCCER_WORKER_KICK_CD;
  T.ownerKickT = 0.01;
  step(p);
  check('P: the PASS goes to the most-advanced mate (target = 140, not the goal)', T.ball.tx === mateX && T.ball.ty === o.wy, 'tx=' + T.ball.tx + ' mateX=' + mateX + ' goalR=' + T.goalR.x);
  check('P: the passed mate is the receiver (a DIFFERENT kid goes to get it)', T.receiver === advanced, 'recIdx=' + T.kids.indexOf(T.receiver));
})();
// scenario S: a DIFFERENT kid retrieves the loose ball and takes ownership
(function () {
  T = makeTeam();
  const o = T.owner;
  for (const k of T.kids) if (k !== o) k.wx = o.wx + 2; // both mates at 122
  p.wx = 999; p.wy = 3;
  T.workerKickCd = SOCCER_WORKER_KICK_CD;
  T.ownerKickT = 0.01;
  step(p);
  check('S: the receiver (a DIFFERENT kid) sprints for the loose ball', T.receiver !== null && T.receiver !== o, 'recIdx=' + T.kids.indexOf(T.receiver));
  let grabbed = false;
  for (let t = 0; t < 400 && !grabbed; t++) {
    step(p);
    if (T.owner && T.owner !== o) grabbed = true;
  }
  check('S: a DIFFERENT kid grabs the loose ball and ownership transfers', grabbed, 'new owner idx=' + (T.owner ? T.kids.indexOf(T.owner) : -1));
})();
// scenario G: shot into the book goal -> GOOOOAL! -> celebration -> kickoff by the scorer
(function () {
  T = makeTeam();
  const o = T.owner; // kids[1]
  o.wx = 140; o.dir = 1; // inside SOCCER_SHOT_RANGE of goalR (11.4 < 12)
  T.ball.wx = 141.3; T.ball.wy = 3; // the ball is at the dribble lead point, in front of the kicker (as in real play)
  T.kids[0].wx = 100; T.kids[2].wx = 130; // mates are spread out (nobody stands on the kicker at the moment of the shot)
  T.lastKicker = null; T.score = 0; T.scorer = null;
  p.wx = 999; p.wy = 3;
  T.workerKickCd = 0;
  T.ownerKickT = 0.01;
  voiceCalls.length = 0;
  step(p);
  check('G: in shot range the owner SHOOTS the book goal (tx=goalR.x, hard lob — a gravity tick already damped it)', T.ball.tx === T.goalR.x && T.ball.ty === T.goalR.y && T.ball.vz > SOCCER_KICK_VZ && Math.abs(T.ball.vz - SOCCER_SHOT_VZ) <= 12 * 0.016 + 0.001, 'tx=' + T.ball.tx + ' ty=' + T.ball.ty + ' vz=' + T.ball.vz);
  let scored = false;
  for (let t = 0; t < 400 && !scored; t++) {
    step(p);
    if (T.celebrateT > 0) scored = true;
  }
  check('G: the ball drops into the mouth = GOOOOAL! (celebration armed, score +1, scorer = kicker)', scored && T.score === 1 && T.scorer === o, 'score=' + T.score + ' scorerIdx=' + (T.scorer ? T.kids.indexOf(T.scorer) : -1) + ' kickerIdx=' + T.kids.indexOf(o));
  check('G: the ball rests in the "net" (at the goal mouth)', scored && T.ball.wx === T.goalR.x && T.ball.wy === T.goalR.y, 'ball=(' + T.ball.wx + ',' + T.ball.wy + ') goal=(' + T.goalR.x + ',' + T.goalR.y + ')');
  check('G: the "GOOOOAL!" bubble is spoken by a kid', voiceCalls.some(l => l.text === 'GOOOOAL!' && l.speaker === 'kid'), JSON.stringify(voiceCalls.slice(0, 3)));
  let picked = false, selfMoved = false, kicked = false;
  for (let t = 0; t < 600 && !kicked; t++) {
    const bx = T.ball.wx; // position before this step
    step(p);
    if (!picked) {
      if (T.owner === null && Math.abs(T.ball.wx - bx) > 0.001) selfMoved = true; // the ball moved while LOOSE (no owner) = it kicked itself (the old center-spot teleport)
      if (T.owner !== null) picked = true; // a kid reached it (any ball motion on that frame is the owner's dribble)
    } else if (T.owner === null && Math.abs(T.ball.wx - T.goalR.x) > 0.5) {
      kicked = true; // the ball left the net BY A KID'S KICK
    }
  }
  check('G: after the hops the ball STAYS in the net — it never kicks itself / teleports to the center spot', !selfMoved, 'ball=' + T.ball.wx.toFixed(2));
  check('G: a kid RUNS to the ball and KICKS it a small distance toward the OTHER goal (kickoffDir cleared)',
    kicked && picked && T.kickoffDir === 0 && T.ball.tx < T.goalR.x - 1 && T.ball.tx > T.goalR.x - 6,
    'tx=' + T.ball.wx.toFixed(2) + ' target=' + T.ball.tx.toFixed(2) + ' kickoffDir=' + T.kickoffDir);
})();
// scenario E: kids NEVER stop and plow straight through sidewalk junk
(function () {
  T = makeTeam();
  const o = T.owner;
  o.wx = 118; o.dir = 1;
  T.kids[0].wx = 100; T.kids[2].wx = 126;
  p.wx = 999; p.wy = 3;
  T.workerKickCd = 0;
  // a hydrant sits right at x=130 on the walk — the kids don't even know it's there
  global.blocks = [{ hazards: [{ wx: 130, wy: 3, r: 0.75, type: 'hit' }], house: { bags: [], can: null } }];
  let crossed = false, stillFrames = 0;
  for (let t = 0; t < 200; t++) {
    const before = T.kids.map(k => k.wx).join(',');
    step(p);
    if (T.kids.some(k => k.wx > 130)) crossed = true;
    const after = T.kids.map(k => k.wx).join(',');
    if (T.celebrateT <= 0 && before === after) stillFrames++;
  }
  check('E: the kids RUN THROUGH the hydrant (sidewalk junk is not in their path)', crossed, 'maxKidX=' + Math.max.apply(null, T.kids.map(k => k.wx)).toFixed(2));
  check('E: nobody comes to a full stop (kids with endless energy)', stillFrames === 0, 'still frames=' + stillFrames);
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
check('ball bonk: the worker DEFLECTS the ball loose (owner released, grabCd, new target + receiver)', ballBlock.indexOf('c.team.owner = null') >= 0 && ballBlock.indexOf('c.team.grabCd = 0.8') >= 0 && ballBlock.indexOf('defBall.tx = R(c.team.minX + 2, c.team.maxX - 2)') >= 0 && ballBlock.indexOf('c.team.receiver =') >= 0);
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
const runBallBlock = new Function('c', 'p', 'hurtNPC', 'doStun', 'Voice', 'WORKER_GENDER', 'clamp', 'workerMaxY', 'HP_HIT_SOCCERBALL', 'R', ballBlock);
const runKidBlock = new Function('c', 'p', 'dx', 'dy', 'd2', 'hurtNPC', 'doStun', 'Voice', 'WORKER_GENDER', 'pick', 'SOCKER_LINES', 'HP_HIT_SOCKER', 'clamp', 'workerMaxY', kidBlock);
// scenario A: worker bonks the ball (kid 2.5u behind it — outside the kid's own radius)
(function () {
  const { rec, hurtNPC, doStun, Voice } = makeRecorder();
  const B = { wx: 0.4, wy: 3, z: 0.1, vz: 0.5, tx: 0.4, ty: 3 };
  const Tt = {
    owner: { wx: 3, wy: 3 }, grabCd: 0, minX: 5, maxX: 40,
    ball: B, kids: [{ wx: 3 }, { wx: 10 }, { wx: 20 }], receiver: null,
  };
  const c = { type: 'soccer', wx: 2.5, wy: 3, gender: 'male', ballCd: 0, ball: B, team: Tt };
  const pw = { wx: 0, wy: 3 };
  runBallBlock(c, pw, hurtNPC, doStun, Voice, WORKER_GENDER, clamp, workerMaxY, HP_HIT_SOCCERBALL, R);
  check('A: ball bonk deals the MINOR whack (2) tagged "soccer"', rec.hits.length === 1 && rec.hits[0].amt === 2 && rec.hits[0].cause === 'soccer', JSON.stringify(rec.hits));
  check('A: worker "Hey dont do that!" (burst) + kid "GOAAAAL!"', rec.lines.some(l => l.text === 'Hey dont do that!' && l.speaker === 'worker' && l.style === 'burst') && rec.lines.some(l => l.text === 'GOAAAAL!' && l.speaker === 'kid'), JSON.stringify(rec.lines));
  check('A: worker bounces back off the ball', pw.wx < 0, 'p.wx=' + pw.wx.toFixed(3));
  check('A: the bonk DEFLECTS the ball — owner released, receiver assigned, target on the sidewalk band', Tt.owner === null && Tt.grabCd === 0.8 && Tt.receiver !== null && B.tx >= 5 && B.tx <= 40 && B.ty >= 1.6 && B.ty <= 4.2 && B.vz >= 1.8, 'tx=' + B.tx + ' ty=' + B.ty + ' vz=' + B.vz + ' recIdx=' + Tt.kids.indexOf(Tt.receiver));
  rec.hits.length = 0;
  runBallBlock(c, pw, hurtNPC, doStun, Voice, WORKER_GENDER, clamp, workerMaxY, HP_HIT_SOCCERBALL, R);
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