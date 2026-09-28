// _cam_follow_chk.js - the SUBTLE LANE-FOLLOW camera (the "3D feel").
// Executes the REAL positionCamera() + _SNAP_* basis + CAM_* constants extracted
// from index.html against the REAL three.js from the repo, and proves:
//   * CAM_PIVOT_WORKER (default ON) = the orbit center + look point is the
//     worker's LIVE world position: he is EXACTLY the rotation point, sits at
//     exact screen center at every lane offset, and a worker jump moves the eye
//     by the exact c45 delta (the street swivels around him)
//   * the OLD smoothed follow point (0.35 lateral pan + forward lead/lag) is
//     preserved behind the toggle for A/B comparison (center-lane framing is
//     still byte-identical to the pre-follow camera)
//   * arm length is preserved at the tilt extremes (no zoom, no clip-plane drift)
//   * the yaw is hard-capped at 6deg (7.5deg with the smooth velocity lead at
//     full strafe), never any roll, so the fixed 45deg stick compensation, NPC
//     facing constants, and the truck off-screen test stay valid
//     (cos(7.5deg) = 0.991 << the test's +1.0u margin)
//   * the forward lead/lag STATE still trails the worker and settles under him
//     (capped 1.0u) -- it drives the camera only when the toggle is OFF
//   * the strafe-velocity yaw lead is SMOOTH: raw per-frame input flips are
//     averaged over ~125ms, so a rapid direction reversal has no per-frame step
//   * the worker stays inside the ortho frustum at BOTH lane extremes
//   * the smoothing is FROZEN while dying / routeend, and dt=0 is a no-op
//   * wiring: every call site passes dt/0, routeEnd reads the live pivot,
//     camFollow is declared once and reset in resetWorldState
const fs = require('fs');
const path = require('path');
const THREE = require(path.join(__dirname, 'three_r128.min.js'));
const h = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let pass = true;
const check = (n, c, e) => {
  console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  [' + e + ']'));
  if (!c) pass = false;
};
const grab = (a, b) => {
  const i = h.indexOf(a);
  if (i < 0) throw new Error('missing ' + a);
  return h.slice(i, h.indexOf(b, i) + b.length);
};

// ================= static wiring =================
check('positionCamera takes dt', h.indexOf('function positionCamera(dt) {') >= 0);
check('no bare positionCamera() call remains (all 3 call sites pass dt/0)', h.indexOf('positionCamera();') === -1);
check('pause + idle branches pass 0 (frozen frames)', (h.match(/positionCamera\(0\);/g) || []).length === 2);
check('live play path passes real dt', h.indexOf('positionCamera(dt);') >= 0);
check('routeEnd truck off-screen test reads the LIVE camFollowY (recomputed locally, never the CAM_Y constant)',
  (h.match(/CAM_Y \+ clamp\(camFollow \* CAM_LANE_FOLLOW, -CAM_PAN_MAX, CAM_PAN_MAX\)/g) || []).length >= 2 &&
  h.indexOf('const camX = Math.SQRT1_2 * (p.wx - camFollowY);') >= 0 &&
  h.indexOf('(p.wx - CAM_Y)') === -1);
check('camFollow declared ONCE + reset on shift start/quit (resetWorldState)',
  (h.match(/let camFollow = 0;/g) || []).length === 1 && h.indexOf('camFollow = 0; // fresh shift') >= 0);
check('old inline camera line is gone (no 1.4142 * ISO_A at the call site)', h.indexOf('camTY - 1.4142 * ISO_A') === -1);
const pcSrcRaw = grab('function positionCamera(dt) {', 'function loop(now) {');
const pcSrc = pcSrcRaw.slice(0, pcSrcRaw.lastIndexOf('function loop(now) {')); // drop the marker text
check('no per-frame allocations inside positionCamera (no new THREE.*)', pcSrc.indexOf('new THREE.') === -1);
check('pan + yaw are hard-capped (CAM_PAN_MAX / CAM_YAW_MAX, velocity lead added on top)',
  pcSrc.indexOf('clamp(camFollow * CAM_LANE_FOLLOW, -CAM_PAN_MAX, CAM_PAN_MAX)') >= 0 &&
  pcSrc.indexOf('clamp(-camFollow * CAM_YAW_PER_UNIT, -CAM_YAW_MAX, CAM_YAW_MAX) -') >= 0 &&
  pcSrc.indexOf('* CAM_YAW_PER_VEL;') >= 0);
check('forward lead/lag wired (CAM_FWD_SMOOTH chase + CAM_FWD_MAX cap)',
  pcSrc.indexOf('CAM_FWD_SMOOTH') >= 0 && pcSrc.indexOf('clamp(fwdLag, -CAM_FWD_MAX, CAM_FWD_MAX)') >= 0);
check('strafe lead is a SMOOTH velocity term (no discrete kick -- anti-jitter)',
  pcSrc.indexOf('laneVel') >= 0 && pcSrc.indexOf('CAM_YAW_PER_VEL') >= 0 &&
  pcSrc.indexOf('yawKick') === -1 && h.indexOf('CAM_YAW_KICK') === -1);
check('raw per-frame strafe is clamped + exponentially smoothed (LANE_VEL_MAX / LANE_VEL_SMOOTH)',
  pcSrc.indexOf('LANE_VEL_MAX,') >= 0 && pcSrc.indexOf('Math.exp(-LANE_VEL_SMOOTH * dt)') >= 0);
check('forward lag + velocity reset with the worker (resetWorldState)',
  h.indexOf('camFollowX = p.wx; laneVel = 0; _lanePrevWy = p.wy;') >= 0);
check('lane follow is FROZEN while dying / routeend (LODI + truck drive-off)',
  pcSrc.indexOf('state !== "dying" && state !== "routeend"') >= 0);
check('CAM_PIVOT_WORKER toggle exists and defaults to true (the worker is the rotation point)',
  /const CAM_PIVOT_WORKER = true;/.test(h));
check('worker-pivot branch orbits + looks at the LIVE worker world position (plWx/plWy)',
  pcSrc.indexOf('if (CAM_PIVOT_WORKER) {') >= 0 &&
  pcSrc.indexOf('camera.position.set(plWx + ARM_D * si, plWy - ARM_D * co, ARM_H);') >= 0 &&
  pcSrc.indexOf('camera.lookAt(plWx, plWy, 0);') >= 0);
check('follow-point branch preserved for A/B (pan + lead/lag path behind the toggle)',
  pcSrc.indexOf('c45 * (camFollowX - camFollowY)') >= 0 &&
  pcSrc.indexOf('c45 * (camFollowX + camFollowY)') >= 0);

// ================= run the real code with real three =================
const snapCode = grab('const _SNAP_FWD = new THREE.Vector3', 'const _SNAP_TEXEL_U = 48 / 4096;');
const camConsts = grab('const ARM_D = 1.4142 * ISO_A;', 'let _lanePrevWy = 0;');
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 1, 400); // s = 4.5, 16:9 (makeFrustum)
const dirLight = new THREE.DirectionalLight();
const groundGroup = new THREE.Group();
const p = { wx: 0, wy: 2.0 };
const api = new Function(
  'THREE', 'camera', 'dirLight', 'groundGroup', 'p', 'clamp', 'ISO_A', 'CAM_Y',
  'let state = "play";\n' + snapCode + '\n' + camConsts + '\n' + pcSrc +
  '\nreturn { positionCamera, getCamFollow: () => camFollow, setCamFollow: v => { camFollow = v; }, ' +
  'getCamFollowX: () => camFollowX, getLaneVel: () => laneVel, ' +
  'resetFollow: () => { camFollowX = p.wx; laneVel = 0; _lanePrevWy = p.wy; }, ' +
  'setState: s => { state = s; } };',
)(THREE, camera, dirLight, groundGroup, p, (v, lo, hi) => Math.min(hi, Math.max(lo, v)), 26, 2.0);

const C45 = Math.SQRT1_2;
const ARM = Math.sqrt(1.4142 * 26 * (1.4142 * 26) + 26 * 26); // 45.033, the eye->target arm
const armLen = () => {
  // worker-pivot (CAM_PIVOT_WORKER = true): target = the worker's own world position
  // (plWx/plWy inside positionCamera)
  const t = new THREE.Vector3(C45 * (p.wx - p.wy), C45 * (p.wx + p.wy), 0);
  return camera.position.clone().sub(t).length();
};
const workerNDC = () =>
  new THREE.Vector3(C45 * (p.wx - p.wy), C45 * (p.wx + p.wy), 0.3).project(camera);
const screenRight = () => { camera.updateMatrixWorld(); // r128 lookAt leaves matrixWorld one quaternion stale -- sync before reading
  return new THREE.Vector3(camera.matrixWorld.elements[0], camera.matrixWorld.elements[1], camera.matrixWorld.elements[2]); };
const onScreen = (v) => Math.abs(v.x) < 0.98 && Math.abs(v.y) < 0.98;
const settle = (n) => { for (let i = 0; i < n; i++) api.positionCamera(1 / 60); };
// ---- Test C: center lane = the EXACT pre-follow camera (zero behavior change) ----
api.setState('play');
api.setCamFollow(0);
p.wx = 0; p.wy = 2.0;
api.resetFollow(); // mirrors resetWorldState() in the game (fresh shift: no stale velocity)
settle(10);
check('center lane: camFollow stays 0', Math.abs(api.getCamFollow()) < 1e-9, String(api.getCamFollow()));
check('center lane: camera identical to the old locked camera (eye at camTY - ARM_D, z = ARM_H)',
  Math.abs(camera.position.x - C45 * (0 - 2.0)) < 1e-9 &&
  Math.abs(camera.position.y - (C45 * (0 + 2.0) - 1.4142 * 26)) < 1e-6 &&
  Math.abs(camera.position.z - 26) < 1e-9,
  camera.position.toArray().map(n => n.toFixed(4)).join(','));
check('center lane: worker on screen', onScreen(workerNDC()), JSON.stringify(workerNDC()));

// ---- Test A: suburban up-lane extreme (workerMaxY = 8.0) ----
p.wx = 0; p.wy = 8.0;
settle(600); // 10s at 60fps -- fully settled (200ms time constant)
check('up-lane: camFollow settles to lane offset (8.0 - 2.0 = 6.0)', Math.abs(api.getCamFollow() - 6.0) < 1e-3, String(api.getCamFollow()));
check('up-lane: yaw hits the 6deg cap in the head-turn direction (eye swings sideways, z pinned at ARM_H, pivot = live worker)',
  Math.abs(camera.position.z - 26) < 1e-9 &&
  Math.abs(camera.position.x - (C45 * (0 - 8.0) - 1.4142 * 26 * Math.sin(0.1047))) < 0.01 &&
  Math.abs(camera.position.y - (C45 * (0 + 8.0) - 1.4142 * 26 * Math.cos(0.1047))) < 0.01,
  camera.position.toArray().map(n => n.toFixed(4)).join(','));
check('up-lane: worker-pivot — the worker sits at EXACT screen center (NDC ~ 0, no pan needed)',
  Math.abs(workerNDC().x) < 0.01 && Math.abs(workerNDC().y) < 0.08, JSON.stringify(workerNDC()));
check('up-lane: arm length preserved (no zoom / no clip-plane drift)', Math.abs(armLen() - ARM) < 0.01, String(armLen()));
check('up-lane: screen-right rotated by exactly the yaw (6deg), with NO roll (z = 0)',
  Math.abs(screenRight().z) < 1e-9 && Math.abs(Math.atan2(screenRight().y, screenRight().x) + 0.1047) < 1e-6,
  screenRight().toArray().map(n => n.toExponential(3)).join(','));
check('up-lane: worker still inside the frustum', onScreen(workerNDC()), JSON.stringify(workerNDC()));

// ---- Test B: street-lane extreme (p.wy = -9.4, the clamp floor) ----
p.wx = 100; p.wy = -9.4;
settle(600);
check('street lane: pivot = the LIVE worker at the lane extreme (eye anchored on him, no pan cap)',
  Math.abs(camera.position.y - (C45 * (100 + (-9.4)) - 1.4142 * 26 * Math.cos(0.1047))) < 0.01,
  camera.position.toArray().map(n => n.toFixed(4)).join(','));
check('street lane: yaw at the +6deg cap, opposite direction, SAME magnitude as up-lane (symmetry, eye z pinned at ARM_H)',
  Math.abs(camera.position.z - 26) < 1e-9 &&
  Math.abs(camera.position.x - (C45 * (100 - (-9.4)) + 1.4142 * 26 * Math.sin(0.1047))) < 0.01,
  camera.position.toArray().map(n => n.toFixed(4)).join(','));
check('street lane: arm length preserved', Math.abs(armLen() - ARM) < 0.01, String(armLen()));
check('street lane: worker still inside the frustum', onScreen(workerNDC()), JSON.stringify(workerNDC()));

// ---- Test P: worker-pivot (the rotation point IS the sanitation worker) ----
api.setState('play');
p.wx = 30; p.wy = 5.0;
settle(600); // fully settled: yaw at the smoothed cap, pivot = live worker
check('worker-pivot: camera is PINNED to the worker — a 10u jump moves the eye by EXACTLY c45*10 in both axes',
  (() => {
    const before = camera.position.clone();
    p.wx += 10;
    api.positionCamera(1 / 60);
    const dx = camera.position.x - before.x, dy = camera.position.y - before.y;
    return Math.abs(dx - C45 * 10) < 1e-6 && Math.abs(dy - C45 * 10) < 1e-6;
  })(), 'eye delta != c45*10');
settle(600);
check('worker-pivot: worker at EXACT screen center at a mid-lane offset (NDC ~ 0)',
  Math.abs(workerNDC().x) < 0.01 && Math.abs(workerNDC().y) < 0.08, JSON.stringify(workerNDC()));

// ---- Test F: forward lead/lag (camera trails a half-step, settles when he stops) ----
api.setState('play');
p.wx = 0; p.wy = 2.0;
settle(600); // camFollowX settles to 0
p.wx = 5;
api.positionCamera(1 / 60); // one frame: camera must TRAIL between old (0) and new (5)
check('lead/lag: one frame after a 5u jump the camera trails behind the worker',
  api.getCamFollowX() > 0 && api.getCamFollowX() < 5, String(api.getCamFollowX()));
settle(600);
check('lead/lag: settles exactly under the worker once he stops', Math.abs(api.getCamFollowX() - 5) < 1e-3, String(api.getCamFollowX()));
p.wx = 15;
api.positionCamera(1 / 60); // 10u forward jump: lag must cap at CAM_FWD_MAX = 1.0
check('lead/lag: forward lag is hard-capped at 1.0u', Math.abs(api.getCamFollowX() - (15 - 1.0)) < 1e-9, String(api.getCamFollowX()));
p.wx = 5;
api.positionCamera(1 / 60); // backward jump: lag caps on the other side (camera leads by 1.0)
check('lead/lag: backward lag caps at +1.0u (camera leads while reversing)', Math.abs(api.getCamFollowX() - (5 + 1.0)) < 1e-9, String(api.getCamFollowX()));
settle(600);

// ---- Test G: smooth strafe-velocity yaw lead (the anti-jitter behavior) ----
p.wx = 20; p.wy = 2.0;
settle(600); // idle: laneVel = 0
for (let i = 0; i < 90; i++) { p.wy += 4 / 60; api.positionCamera(1 / 60); } // constant 4 u/s up-lane strafe
check('vel lead: constant strafe adds a smooth lead on top of the 6deg cap (4 u/s * 0.005 = 0.02)',
  Math.abs(Math.atan2(screenRight().y, screenRight().x) + (0.1047 + 0.02)) < 0.005,
  String(Math.atan2(screenRight().y, screenRight().x)));
settle(90); // he stops: the lead eases back to the pure cap
check('vel lead: eases back to the 6deg cap once he stops',
  Math.abs(Math.atan2(screenRight().y, screenRight().x) + 0.1047) < 0.005,
  String(Math.atan2(screenRight().y, screenRight().x)));
// RAPID REVERSAL: the anti-jitter guarantee -- no per-frame step > 0.01 rad
// (the old discrete kick was 0.0262 rad in a single frame, ~2.6x this bound)
let maxStep = 0;
let prevA = Math.atan2(screenRight().y, screenRight().x);
for (let i = 0; i < 90; i++) {
  p.wy -= 4 / 60; // straight back down to the center lane (8.0 -> 2.0)
  api.positionCamera(1 / 60);
  const a = Math.atan2(screenRight().y, screenRight().x);
  maxStep = Math.max(maxStep, Math.abs(a - prevA));
  prevA = a;
}
check('vel lead: rapid direction reversal is a smooth S-curve (max per-frame step < 0.01 rad)',
  maxStep < 0.01, String(maxStep));
settle(60);
check('vel lead: settles back at 0 yaw in the center lane', Math.abs(Math.atan2(screenRight().y, screenRight().x)) < 0.005,
  String(Math.atan2(screenRight().y, screenRight().x)));

// ---- Test D: frozen while dying (LODI animates p.wy -- the camera must NOT fall over) ----
api.setState('dying');
api.setCamFollow(6.0);
p.wx = 50; p.wy = 1.0;
api.positionCamera(1 / 60);
const angAtDying = Math.atan2(screenRight().y, screenRight().x);
p.wy = 5.0; api.positionCamera(1 / 60);
p.wy = 1.0; api.positionCamera(1 / 60);
check('dying: velocity lead is frozen too (no sway during the LODI)',
  Math.abs(Math.atan2(screenRight().y, screenRight().x) - angAtDying) < 1e-6,
  String(Math.atan2(screenRight().y, screenRight().x)));
p.wx = 50; p.wy = 2.0;
settle(300);
check('dying: camFollow frozen at 6.0 while p.wy swings back to 2.0', Math.abs(api.getCamFollow() - 6.0) < 1e-9, String(api.getCamFollow()));
api.setState('routeend');
settle(300);
check('routeend: camFollow still frozen (truck drive-off)', Math.abs(api.getCamFollow() - 6.0) < 1e-9, String(api.getCamFollow()));

// ---- Test E: dt = 0 is a no-op (menu / pause branches) ----
api.setState('play');
api.setCamFollow(3.0);
p.wx = 10; p.wy = 8.0;
api.positionCamera(0); // re-center on the worker's NEW forward position first
const before = camera.position.clone();
api.positionCamera(0);
check('dt=0: camera holds perfectly still AND camFollow does not settle',
  camera.position.distanceTo(before) === 0 && api.getCamFollow() === 3.0,
  camera.position.toArray().map(n => n.toFixed(4)).join(','));

console.log(pass ? '\nCAMERA LANE-FOLLOW OK' : '\nCAMERA LANE-FOLLOW BROKEN');
process.exit(pass ? 0 : 1);