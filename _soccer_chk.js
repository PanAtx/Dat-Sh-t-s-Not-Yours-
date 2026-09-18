// _soccer_chk.js — verify the Flatbush street-soccer feature (index.html):
//   1) wiring: constants, addCreature case, kid/ball models, Flatbush-only spawn
//      of 3 kids on 3 DISTINCT in-route blocks, AVOID_TYPES, write-ups.
//   2) the REAL case "soccer" body from updateCreatures: the kid runs the WHOLE
//      block back and forth (clamped to minX/maxX, flipping at cross-streets),
//      the ball bounces ahead with real physics and the kid chases it back —
//      and it NEVER recycles off-screen (a fixed fixture).
//   3) the REAL collideCreatures branches: bonking the BALL = minor whack +
//      "Hey dont do that!" (worker) + "GOAAAAL!" (kid); touching the KID =
//      light hit + one of the kid's panic lines; both bounce the worker back.
//   4) the crowd routes around the soccer kids (AVOID_TYPES.soccer).
//   5) the bubble punch-ups: worker "OW!" lines get the POW! burst (bub-burst),
//      and the bonus finds slam in on the Bangers starburst (.pop-star).
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
const SOCCER_LEAD = 1.3, SOCCER_KICK_AHEAD = 3.4, SOCCER_KICK_VZ = 3.2, SOCCER_MARGIN = 5;
const BLOCK_W = 80; // mirrors index.html (10 houses x 8u)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const workerMaxY = () => 8.0; // Flatbush cap (mirrors index.html)
const WORKER_GENDER = 'male';
const pick = (a) => a[0]; // deterministic in tests (first line)

console.log('[1] constants');
check('HP_HIT_SOCKER exists and is LIGHT (3 — heavier than the stink, lighter than a driveway lunge)', src.indexOf('const HP_HIT_SOCKER = 3;') >= 0 && HP_HIT_SOCKER > HP_HIT_PANHANDLER && HP_HIT_SOCKER < HP_HIT_DRIVETRIC);
check('HP_HIT_SOCCERBALL exists and is MINOR (2 — lighter than touching the kid)', src.indexOf('const HP_HIT_SOCCERBALL = 2;') >= 0 && HP_HIT_SOCCERBALL < HP_HIT_SOCKER && HP_HIT_SOCCERBALL < HP_HIT_VEHICLE);
check('SOCKER_LINES has exactly the 3 panic lines', /const SOCKER_LINES = \[[\s\S]*?"Don't touch me!"[\s\S]*?"Mommy!"[\s\S]*?"Bad man!"[\s\S]*?\];/.test(src));
check('ball physics constants exist (lead 1.3 / kick-ahead 3.4 / lob 3.2 / margin 5)',
  src.indexOf('const SOCCER_LEAD = 1.3;') >= 0 && src.indexOf('const SOCCER_KICK_AHEAD = 3.4;') >= 0 &&
  src.indexOf('const SOCCER_KICK_VZ = 3.2;') >= 0 && src.indexOf('const SOCCER_MARGIN = 5;') >= 0);

console.log('[2] wiring: models, spawn, avoidance, write-ups');
const addSrc = src.slice(src.indexOf('function addCreature('), src.indexOf('function updateCreatures('));
check('addCreature has case "soccer" (kid + ball state + ball mesh)', addSrc.indexOf('case "soccer":') >= 0 && addSrc.indexOf('makeSoccerKid()') >= 0 && addSrc.indexOf('makeSoccerBall()') >= 0);
check('soccer kids get MIXED gender (like the other kid riders)', addSrc.indexOf('type === "soccer" ||') >= 0);
check('the soccer kid has NO boxW (not traffic: separation/truck systems skip it)', (function () {
  const cs = addSrc.indexOf('case "soccer":');
  const ce = addSrc.indexOf('break;', cs);
  return addSrc.slice(cs, ce).indexOf('c.boxW') < 0;
})());
check('makeSoccerKid scales a makePerson to 60% (a child chasing a ball)', /function makeSoccerKid\(\)[\s\S]*?kp\.g\.scale\.set\(0\.6, 0\.6, 0\.6\)/.test(src));
check('makeSoccerBall builds a ball resting on the ground (center at 0.22)', /function makeSoccerBall\(\)[\s\S]*?ball\.position\.z = 0\.22;/.test(src));
check('ball mesh is added to the world in addCreature\'s common tail', src.indexOf('if (c.ballG) dynamicGroup.add(c.ballG);') >= 0);
// spawn: Flatbush only, 3 distinct garbage blocks, full-block patrol band
const spawnSrc = (function () {
  const i = src.indexOf('Flatbush street soccer: THREE small kids');
  if (i < 0) return '';
  let j = src.indexOf('if (isFlatbushLevel()) {', i);
  let k = src.indexOf('{', j), d = 0;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) break; } }
  return src.slice(i, k + 1);
})();
check('soccer spawn is Flatbush-only (isFlatbushLevel gate)', spawnSrc.indexOf('if (isFlatbushLevel()) {') >= 0);
check('soccer spawn picks 3 DISTINCT in-route (garbage) blocks', spawnSrc.indexOf('LEVEL_BLOCKS.filter(b => b.garbage)') >= 0 && spawnSrc.indexOf('pickedBlocks.length < 3') >= 0 && spawnSrc.indexOf('pickedBlocks.indexOf(sb) < 0') >= 0);
check('soccer kids patrol the WHOLE block (minX/maxX = block edge ± SOCCER_MARGIN)', spawnSrc.indexOf('sk.minX = sb.x + SOCCER_MARGIN') >= 0 && spawnSrc.indexOf('sk.maxX = sb.x + BLOCK_W - SOCCER_MARGIN') >= 0);
check('soccer kids start on the street (wy between -2.5 and -6.5)', spawnSrc.indexOf('sk.wy = R(-2.5, -6.5)') >= 0);
check('soccer blocks are IN-ROUTE garbage blocks (6 of the 8 blocks carry garbage)', (function () {
  const m = src.match(/const LEVEL_BLOCKS = \[([\s\S]*?)\];/);
  if (!m) return false;
  const blocks = eval('[' + m[1] + ']');
  return blocks.filter(b => b.garbage).length === 6;
})());
check('AVOID_TYPES includes soccer (the crowd routes around the kids)', /AVOID_TYPES = \{[\s\S]*?soccer:\s*1/.test(src));
check('WRITEUP_REASONS has a soccer entry (the supervisor\'s offense file)', /soccer:\s*\[[\s\S]*?"Failure to respect a sacred soccer ball"[\s\S]*?\]/.test(src));

console.log('[3] case "soccer" in updateCreatures — the real AI body');
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
check('kid patrols between minX/maxX (full-block, edge to edge)', soccerCase.indexOf('c.wx >= c.maxX') >= 0 && soccerCase.indexOf('c.wx <= c.minX') >= 0);
check('kid flips direction at the block edges', soccerCase.indexOf('c.dir = -1;') >= 0 && soccerCase.indexOf('c.dir = 1;') >= 0);
check('ball has gravity + damped bounce (vz -= 12*dt, bounce * 0.55)', soccerCase.indexOf('b.vz -= 12 * dt') >= 0 && soccerCase.indexOf('b.vz = Math.abs(b.vz) * 0.55') >= 0);
check('kid kicks the ball ahead and chases it back (SOCCER_KICK_AHEAD + ease to SOCCER_LEAD)', soccerCase.indexOf('SOCCER_KICK_AHEAD') >= 0 && soccerCase.indexOf('SOCCER_LEAD') >= 0);
check('kid does NOT care about obstacles (no npcRoadRules / no walk-around CALL in its case)', soccerCase.indexOf('npcRoadRules(') < 0 && soccerCase.indexOf('npcWalkAroundObstacles(') < 0);
check('kid NEVER recycles off-screen (no tx teleport in its case)', soccerCase.indexOf('tx >') < 0 && soccerCase.indexOf('tx <') < 0);
check('kid animates a run cycle (animParts + faces travel direction)', soccerCase.indexOf('animParts(') >= 0 && soccerCase.indexOf('c.g.rotation.z = c.dir >= 0 ? 0 : Math.PI') >= 0);

// ---- run the REAL case body ----
const R = (a, b) => a + Math.random() * (b - a);
function makeSoccerKidSim() {
  return {
    type: 'soccer', dir: 1, wx: 110, wy: -4, sp: 4,
    minX: 96 + SOCCER_MARGIN, maxX: 96 + BLOCK_W - SOCCER_MARGIN,
    kickT: 0.2, kickBoost: 0, kidCd: 0, ballCd: 0, phase: 0,
    ball: { wx: 110 + SOCCER_LEAD, wy: -4, z: 0, vz: 0 },
    ballG: { position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, rotation: { z: 0 } },
    parts: { upper: { position: { z: 0.62 } } },
    g: { rotation: { z: 0 } },
  };
}
const runCase = new Function('c', 'dt', 'R', 'GZ', 'SOCCER_LEAD', 'SOCCER_KICK_AHEAD', 'SOCCER_KICK_VZ', 'animParts',
  'switch (c.type){' + soccerCase + '}');
const animParts = (c, dp) => { c.phase += dp; };
let simOk = true, simDetail = '', sawFlip = 0, zMax = 0, zMin = Infinity, maxLead = 0;
try {
  const c = makeSoccerKidSim();
  for (let t = 0; t < 4000; t++) {
    const prevDir = c.dir;
    runCase(c, 0.016, R, 0.3, SOCCER_LEAD, SOCCER_KICK_AHEAD, SOCCER_KICK_VZ, animParts);
    if (c.wx < c.minX - 1e-9 || c.wx > c.maxX + 1e-9) { simOk = false; simDetail = 'out of band at t=' + t + ' wx=' + c.wx.toFixed(2); break; }
    if (c.dir !== prevDir) sawFlip++;
    if (c.ball.z < -1e-9) { simOk = false; simDetail = 'ball z went negative: ' + c.ball.z; break; }
    zMax = Math.max(zMax, c.ball.z); zMin = Math.min(zMin, c.ball.z);
    maxLead = Math.max(maxLead, Math.abs(c.ball.wx - c.wx));
  }
} catch (e) { simOk = false; simDetail = e.message; }
check('kid stays INSIDE its block for 4000 frames (~64s)', simOk, simDetail);
check('kid flips direction (runs up and down the block)', simOk && sawFlip >= 2, 'flips=' + sawFlip);
check('ball stays at or above the asphalt (z >= 0) with a real lob apex (~0.43)', simOk && zMin >= -1e-9 && zMax > 0.3 && zMax < 0.6, 'z [' + zMin.toFixed(3) + ', ' + zMax.toFixed(3) + ']');
check('ball leads the kid (kick ahead) but the chase keeps it close (< 4u)', simOk && maxLead > SOCCER_LEAD && maxLead < 4.0, 'maxLead=' + maxLead.toFixed(2));
console.log('[4] collideCreatures — the real bump exchanges');
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
check('ball bonk block lives BEFORE the generic dx/dy radius gate', src.indexOf('if (c.type === "soccer" && c.ball) {') < src.indexOf('const dx = c.wx - p.wx,', src.indexOf('function collideCreatures() {')));
check('ball bonk: minor damage tagged "soccer"', ballBlock.indexOf('hurtNPC(HP_HIT_SOCCERBALL, "soccer")') >= 0);
check('ball bonk: worker snaps "Hey dont do that!" (burst-styled)', ballBlock.indexOf('"Hey dont do that!"') >= 0 && ballBlock.indexOf('"burst"') >= 0);
check('ball bonk: the kicking kid celebrates "GOAAAAL!"', ballBlock.indexOf('"GOAAAAL!"') >= 0);
check('ball bonk: worker bounces back + light stun', ballBlock.indexOf('p.wx -= (bdx / bd) * 0.7') >= 0 && ballBlock.indexOf('doStun(0.5, "hit")') >= 0);
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
  const hurtNPC = (amt, cause) => rec.hits.push({ amt, cause });
  const doStun = (d, t) => rec.stuns.push({ d, t });
  const Voice = { say: (...a) => rec.lines.push({ text: a[0], speaker: a[6], style: a[7] }) };
  return { rec, hurtNPC, doStun, Voice };
}
const runBallBlock = new Function('c', 'p', 'hurtNPC', 'doStun', 'Voice', 'WORKER_GENDER', 'clamp', 'workerMaxY', 'HP_HIT_SOCCERBALL', ballBlock);
const runKidBlock = new Function('c', 'p', 'dx', 'dy', 'd2', 'hurtNPC', 'doStun', 'Voice', 'WORKER_GENDER', 'pick', 'SOCKER_LINES', 'HP_HIT_SOCKER', 'clamp', 'workerMaxY', kidBlock);
// scenario A: worker bonks the ball (kid 2.5u behind it — outside the kid's own radius)
(function () {
  const { rec, hurtNPC, doStun, Voice } = makeRecorder();
  const c = { type: 'soccer', wx: 2.5, wy: -3, gender: 'male', ballCd: 0, ball: { wx: 0.4, wy: -3 } };
  const p = { wx: 0, wy: -3 };
  runBallBlock(c, p, hurtNPC, doStun, Voice, WORKER_GENDER, clamp, workerMaxY, HP_HIT_SOCCERBALL);
  check('A: ball bonk deals the MINOR whack (2) tagged "soccer"', rec.hits.length === 1 && rec.hits[0].amt === 2 && rec.hits[0].cause === 'soccer', JSON.stringify(rec.hits));
  check('A: worker says "Hey dont do that!" (burst) and the kid says "GOAAAAL!"', rec.lines.some(l => l.text === 'Hey dont do that!' && l.speaker === 'worker' && l.style === 'burst') && rec.lines.some(l => l.text === 'GOAAAAL!' && l.speaker === 'kid'), JSON.stringify(rec.lines));
  check('A: worker bounces back off the ball', p.wx < 0, 'p.wx=' + p.wx.toFixed(3));
  rec.hits.length = 0;
  runBallBlock(c, p, hurtNPC, doStun, Voice, WORKER_GENDER, clamp, workerMaxY, HP_HIT_SOCCERBALL);
  check('A: ball bonk cooldown blocks an instant second whack', rec.hits.length === 0, JSON.stringify(rec.hits));
})();
// scenario B: worker touches the kid (ball far away)
(function () {
  const { rec, hurtNPC, doStun, Voice } = makeRecorder();
  const c = { type: 'soccer', wx: 0.5, wy: -3, gender: 'male', kidCd: 0, ballCd: 0, ball: { wx: 20, wy: -3 } };
  const p = { wx: 0, wy: -3 };
  const dx = c.wx - p.wx, dy = c.wy - p.wy, d2 = dx * dx + dy * dy;
  runKidBlock(c, p, dx, dy, d2, hurtNPC, doStun, Voice, WORKER_GENDER, pick, SOCKER_LINES, HP_HIT_SOCKER, clamp, workerMaxY);
  check('B: kid bump deals the light hit (3) tagged "soccer"', rec.hits.length === 1 && rec.hits[0].amt === 3 && rec.hits[0].cause === 'soccer', JSON.stringify(rec.hits));
  check('B: kid fires a panic line ("Don\'t touch me!"/"Mommy!"/"Bad man!")', rec.lines.some(l => l.speaker === 'kid' && SOCKER_LINES.indexOf(l.text) >= 0), JSON.stringify(rec.lines));
  check('B: worker is bounced back off the kid', p.wx < 0, 'p.wx=' + p.wx.toFixed(3));
  rec.hits.length = 0;
  runKidBlock(c, p, dx, dy, d2, hurtNPC, doStun, Voice, WORKER_GENDER, pick, SOCKER_LINES, HP_HIT_SOCKER, clamp, workerMaxY);
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

console.log(ok ? '\nSOCCER KIDS CHECKS PASSED' : '\nSOCCER KIDS CHECKS FAILED');
process.exit(ok ? 0 : 1);