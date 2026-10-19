// _soccer_goal_repro.js — REPRO: what the trio does in the ~4 seconds AFTER a ball drops
// into the book goal. Prints the pile: how many frames every kid spends parked at the goal
// mouth, how many frames the WHOLE trio is frozen, and how long the ball sits in the net.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const SOCCER_LEAD = 1.3, SOCCER_PICKUP = 1.3, SOCCER_WORKER_RANGE = 9;
const SOCCER_KICK_VZ = 3.2, SOCCER_WORKER_KICK_CD = 3.5;
const SOCCER_SHOT_VZ = 4.4, SOCCER_SHOT_RANGE = 12, SOCCER_ROLL_SP = 8, SOCCER_PASS_MIN = 6;
const SOCCER_ROLL_ACCEL = 30, SOCCER_BALL_R = 0.22, SOCCER_GOAL_R = 1.1, SOCCER_GOAL_YR = 1.2, SOCCER_CELEBRATE = 1.6;
const SOCCER_KICKOFF_RUN = 9, SOCCER_KICKOFF_TAKE_R = 2.6, SOCCER_KICKOFF_WATCHDOG = 4.5, SOCCER_KICKOFF_RESCUE = 7.0;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const R = (lo) => lo; // deterministic
const pick = (a) => a[0];
const animParts = (c, dp) => { c.phase += dp; };
const Voice = { say() {} };
function extractCase() {
  const fnStart = src.indexOf('function updateCreatures() {');
  const start = src.indexOf('case "soccer": {', fnStart);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) break; } }
  return src.slice(start, i + 1);
}
const soccerCase = extractCase();
const runCase = new Function(
  'c', 'dt', 'R', 'GZ', 'state', 'p', 'blocks',
  'SOCCER_LEAD', 'SOCCER_PICKUP', 'SOCCER_WORKER_RANGE', 'SOCCER_KICK_VZ', 'SOCCER_WORKER_KICK_CD',
  'SOCCER_SHOT_RANGE', 'SOCCER_SHOT_VZ', 'SOCCER_ROLL_SP', 'SOCCER_PASS_MIN', 'SOCCER_GOAL_R', 'SOCCER_GOAL_YR', 'SOCCER_CELEBRATE',
  'SOCCER_ROLL_ACCEL', 'SOCCER_BALL_R', 'SOCCER_KICKOFF_RUN', 'SOCCER_KICKOFF_TAKE_R', 'SOCCER_KICKOFF_WATCHDOG', 'SOCCER_KICKOFF_RESCUE',
  'clamp', 'Voice', 'animParts',
  'switch (c.type) {' + soccerCase + '}',
);
function makeTeam() {
  const mkKid = (wx, dir) => ({
    type: 'soccer', wx: wx, wy: 3, dir: dir, sp: 4, kidCd: 0, ballCd: 0, phase: 0,
    parts: { upper: { position: { z: 0.62 } } }, g: { rotation: { z: 0 } },
  });
  const kids = [mkKid(100, 1), mkKid(140, 1), mkKid(118, -1)];
  const ball = { wx: 141.3, wy: 3, z: 0, vz: 0, vx: 0, vy: 0, tx: 141.3, ty: 3 };
  const ballG = { position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, rotation: { z: 0 }, userData: { core: { rotation: { y: 0 } } } };
  const team = {
    kids: kids, leader: kids[0], ball: ball, ballG: ballG,
    minX: 90, maxX: 150, midX: 120,
    goalL: { x: 88.6, y: 3.0 }, goalR: { x: 151.4, y: 3.0 },
    owner: kids[1], receiver: null, ownerKickT: 0.01, workerKickCd: 0, grabCd: 0, kickoffDir: 0,
    celebrateT: 0, score: 0, lastKicker: null, scorer: null,
  };
  for (const k of kids) k.team = team;
  return team;
}
const T = makeTeam();
const p = { wx: 999, wy: 3 }; // worker far away
const boxes = []; // an OPEN sidewalk — the pure goal case (no boxes to blame)
const step = () => runCase(T.leader, 0.016, R, 0.3, 'play', p, boxes, SOCCER_LEAD, SOCCER_PICKUP, SOCCER_WORKER_RANGE, SOCCER_KICK_VZ, SOCCER_WORKER_KICK_CD, SOCCER_SHOT_RANGE, SOCCER_SHOT_VZ, SOCCER_ROLL_SP, SOCCER_PASS_MIN, SOCCER_GOAL_R, SOCCER_GOAL_YR, SOCCER_CELEBRATE, SOCCER_ROLL_ACCEL, SOCCER_BALL_R, SOCCER_KICKOFF_RUN, SOCCER_KICKOFF_TAKE_R, SOCCER_KICKOFF_WATCHDOG, SOCCER_KICKOFF_RESCUE, clamp, Voice, animParts);
// ---- event trace: the life of a goal from the shot to the kickoff ----
let prevScore = 0, prevCeleb = 0, prevOwner = T.owner, prevKickDir = 0, prevBall = { x: T.ball.wx, tx: T.ball.tx };
const trace = [];
const kidDx = (k) => Math.abs(k.wx - T.goalR.x).toFixed(2);
let goalFrames = 0, pile = 0, frozen = 0, overlap = 0, ballInNet = 0, kickT = -1;
const inGoalZone = (k) => Math.abs(k.wx - T.goalR.x) < 2.6;
for (let t = 0; t < 900; t++) {
  const pos0 = T.kids.map((k) => [k.wx, k.wy]);
  step();
  const ball = T.ball;
  if (T.score > prevScore) {
    trace.push(`t=${t} GOAL #${T.score}: ball rests in net (${ball.wx.toFixed(2)},${ball.wy.toFixed(2)}) kickoffDir=${T.kickoffDir} kids dx-goal=[${T.kids.map(kidDx).join(',')}]`);
    prevScore = T.score;
  }
  if (prevCeleb > 0 && T.celebrateT <= 0)
    trace.push(`t=${t} hops over: receiver=kid${T.kids.indexOf(T.receiver)} kickoffDir=${T.kickoffDir} ballInNet=${(Math.abs(ball.wx - T.goalR.x) < 0.05).toString()}`);
  prevCeleb = T.celebrateT;
  if (T.owner && T.owner !== prevOwner) {
    trace.push(`t=${t} kid${T.kids.indexOf(T.owner)} takes the ball (d=${Math.hypot(ball.wx - T.owner.wx, ball.wy - T.owner.wy).toFixed(2)})`);
    prevOwner = T.owner;
  }
  if (!T.owner && prevOwner) {
    trace.push(`t=${t} KICK by kid${T.kids.indexOf(T.lastKicker)}: ball ${prevBall.x.toFixed(2)} -> tx ${ball.tx.toFixed(2)} kickoffDir=${T.kickoffDir}`);
    prevOwner = null;
  }
  if (Math.abs(ball.wx - T.goalR.x) < 0.05 && Math.abs(ball.wy - T.goalR.y) < 0.05) ballInNet++;
  if (T.score >= 1 && kickT < 0 && ball.wx < T.goalR.x - 0.5) kickT = t;
  if (T.score >= 1) {
    goalFrames++;
    let atGoal = 0, stall = 0;
    for (let ki = 0; ki < 3; ki++) {
      if (inGoalZone(T.kids[ki])) atGoal++;
      if (T.celebrateT <= 0 && Math.hypot(T.kids[ki].wx - pos0[ki][0], T.kids[ki].wy - pos0[ki][1]) < 0.004) stall++;
    }
    if (atGoal >= 2 && T.celebrateT <= 0) pile++;
    if (T.celebrateT <= 0 && stall === 3) frozen++;
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++)
      if (Math.hypot(T.kids[b].wx - T.kids[a].wx, T.kids[b].wy - T.kids[a].wy) < 0.85) overlap++;
  }
  prevBall = { x: ball.wx, tx: ball.tx };
}
console.log(trace.slice(0, 30).join('\n'));
console.log('frames after goal:', goalFrames, '| ball resting in net frames:', ballInNet);
console.log('frames with 2+ kids parked at the goal mouth:', pile);
console.log('frames the WHOLE trio is frozen (post-celebration):', frozen);
console.log('kid-pair overlap frames (<0.85u apart):', overlap);
console.log('kickoff kick frame:', kickT, '| ball tx now:', T.ball.tx.toFixed(2), '| kickoffDir:', T.kickoffDir);
console.log('kid positions now:', T.kids.map((k) => `(${k.wx.toFixed(1)},${k.wy.toFixed(1)}) dGoal=${Math.abs(k.wx - T.goalR.x).toFixed(2)}`).join(' '));

// ---- SCENARIO K: the clean kickoff window (one goal, one boot, every role measured) ----
(function () {
  const TK = makeTeam(); // owner kids[1] at 140 facing goalR, ball at the lead point
  const sK = () => runCase(TK.leader, 0.016, R, 0.3, 'play', { wx: 999, wy: 3 }, [], SOCCER_LEAD, SOCCER_PICKUP, SOCCER_WORKER_RANGE, SOCCER_KICK_VZ, SOCCER_WORKER_KICK_CD, SOCCER_SHOT_RANGE, SOCCER_SHOT_VZ, SOCCER_ROLL_SP, SOCCER_PASS_MIN, SOCCER_GOAL_R, SOCCER_GOAL_YR, SOCCER_CELEBRATE, SOCCER_ROLL_ACCEL, SOCCER_BALL_R, SOCCER_KICKOFF_RUN, SOCCER_KICKOFF_TAKE_R, SOCCER_KICKOFF_WATCHDOG, SOCCER_KICKOFF_RESCUE, clamp, Voice, animParts);
  let goalT = -1, hopsT = -1, takeT = -1, bootT = -1, pile = 0, stalls = 0;
  let runner = null, keeper = null, runnerStartX = 0, runnerMove = 0, goalDir = 0;
  for (let t = 0; t < 500 && bootT < 0; t++) {
    const pos0 = TK.kids.map((k) => [k.wx, k.wy]);
    sK();
    if (goalT < 0 && TK.score >= 1) {
      goalT = t;
      runner = TK.kickoffReady; // the kid who must walk the OTHER way, in anticipation
      runnerStartX = runner ? runner.wx : 0;
      goalDir = TK.kickoffDir;
    }
    if (goalT >= 0) {
      if (hopsT < 0 && TK.celebrateT <= 0) hopsT = t;
      if (hopsT >= 0 && TK.owner && takeT < 0) takeT = t;
      if (hopsT >= 0) {
        let atGoal = 0, stall = 0;
        for (let ki = 0; ki < 3; ki++) {
          if (Math.abs(TK.kids[ki].wx - TK.goalR.x) < 2.6) atGoal++;
          if (Math.hypot(TK.kids[ki].wx - pos0[ki][0], TK.kids[ki].wy - pos0[ki][1]) < 0.004) stall++;
        }
        if (atGoal >= 2) pile++;
        stalls += stall;
      }
      if (takeT >= 0 && !TK.owner && TK.ball.wx < TK.goalR.x - 0.5) {
        bootT = t;
        runnerMove = runner ? (runner.wx - runnerStartX) * goalDir : 0;
      }
    }
  }
  console.log('\nK: GOAL at t=' + goalT + ', hops over t=' + hopsT + ', keeper takes it t=' + takeT + ', BOOT t=' + bootT);
  console.log('K: kickoff takes ' + ((bootT - hopsT) * 0.016).toFixed(2) + 's from the end of the hops (' + ((bootT - goalT) * 0.016).toFixed(2) + 's from the goal)');
  console.log('K: frames with 2+ kids inside the goal mouth after the hops: ' + pile);
  console.log('K: per-kid stall frames in that window: ' + stalls);
  console.log('K: roles = keeper kid' + TK.kids.indexOf(TK.kickoffFetch) + ' / runner kid' + TK.kids.indexOf(TK.kickoffReady) + ' / runX ' + TK.kickoffRunX.toFixed(1));
  console.log('K: kid spread at the boot:', TK.kids.map((k, i) => `kid${i}(${k.wx.toFixed(1)},${k.wy.toFixed(1)})`).join(' '));
})();
