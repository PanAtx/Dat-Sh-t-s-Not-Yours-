// _cam_follow_chk.js - the SUBTLE LANE-FOLLOW camera (the "3D feel").
// Executes the REAL positionCamera() + _SNAP_* basis + CAM_* constants extracted
// from index.html against the REAL three.js from the repo, and proves:
//   * the smoothed follow point (0.35 lateral pan + forward lead/lag) is the
//     orbit center (CAM_PIVOT_WORKER = false -- the preferred camera); the
//     worker-pivot branch is kept behind the toggle
//   * center-lane framing is byte-identical to the pre-follow camera (zero change
//     for the typical play position)
//   * the BASE ORBIT ANGLE (CAM_ANGLE_OFFSET = 0deg, i.e. NO rotation (pure 45deg isometric axis),
//     scene counter-clockwise on screen) rotates the eye offset, and the analog
//     stick compensation + the truck off-screen test rotate by the SAME angle
//   * arm length is preserved at the tilt extremes (no zoom, no clip-plane drift)
//   * the yaw is hard-capped at 0 (rotation is OFF; the pan + hopper zoom carry the feel
//     ; the yaw must stay 0, never any roll, so the
//     screen-aligned stick compensation and the truck off-screen test stay valid
//   * the forward lead/lag trails the worker and settles under him (capped 1.0u)
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
check('lane follow is FROZEN while dying / routeend (LODI + truck drive-off; the FORWARD follow is now exempt for the walk-to-cab)',
  pcSrc.indexOf('state !== "dying" && state !== "routeend"') >= 0);
check('route-end: WALK progress drives the wide frame (lands on 1.3 exactly at the door)',
  /const CAM_ZOOM_END = 1\.3;/.test(h) &&
  pcSrc.indexOf('routeEnd.pts') >= 0 &&
  pcSrc.indexOf('reProg') >= 0 &&
  pcSrc.indexOf('(CAM_ZOOM_END - CAM_ZOOM_OUT) * reProg') >= 0);
check('route-end: the CYCLE beat (compactor at the hopper) holds the walk-progress frame',
  pcSrc.indexOf('routeEnd.phase === "walk" || routeEnd.phase === "cycle"') >= 0);
check('route-end: BOARD/DRIVE settles on the cab door (CAM_ZOOM_DOOR = 1.15 push-in)',
  /const CAM_ZOOM_DOOR = 1\.15;/.test(h) &&
  pcSrc.indexOf(': CAM_ZOOM_DOOR;') >= 0);
check('route-end: the pull-back eases on the SLOW time-constant (CAM_ZOOM_END_SMOOTH, no snap)',
  /const CAM_ZOOM_END_SMOOTH = 0\.8;/.test(h) &&
  pcSrc.indexOf('kZoom = CAM_ZOOM_END_SMOOTH') >= 0);
check('route-end: the forward lead/lag stays ACTIVE (only dying freezes it -- the walk-to-cab scrolls on screen)',
  pcSrc.indexOf('if (state !== "dying") {') >= 0 &&
  pcSrc.indexOf('if (state !== "dying") {') < pcSrc.indexOf('camFollowX +='));
check('CAM_PIVOT_WORKER toggle exists and defaults to FALSE (the smoothed follow camera is active)',
  /const CAM_PIVOT_WORKER = false;/.test(h));
check('worker-pivot branch preserved behind the toggle (orbits + looks at the LIVE worker world position)',
  pcSrc.indexOf('if (CAM_PIVOT_WORKER) {') >= 0 &&
  pcSrc.indexOf('camera.position.set(plWx + ARM_D * si - camXOff, plWy - ARM_D * co, eyeZ);') >= 0 &&
  pcSrc.indexOf('camera.lookAt(plWx, plWy, 0);') >= 0);
check('follow-point branch is the active path (pan + lead/lag around the lagged position)',
  pcSrc.indexOf('c45 * (camFollowX - camFollowY)') >= 0 &&
  pcSrc.indexOf('c45 * (camFollowX + camFollowY)') >= 0);
check('base orbit angle constant exists (CAM_ANGLE_OFFSET_DEG = 0, no camera rotation)',
  /const CAM_ANGLE_OFFSET_DEG = 0;/.test(h) &&
  /const CAM_ANGLE_OFFSET = \(CAM_ANGLE_OFFSET_DEG \* Math\.PI\) \/ 180;/.test(h));
check('positionCamera adds the base orbit to the yaw (ang = yaw + CAM_ANGLE_OFFSET) and uses it for the eye offset',
  pcSrc.indexOf('const ang = yaw + CAM_ANGLE_OFFSET;') >= 0 &&
  pcSrc.indexOf('const co = Math.cos(ang),') >= 0 && pcSrc.indexOf('Math.sin(ang);') >= 0);
check('analog stick compensation rotates by the SAME base angle (screen-aligned movement at 0deg)',
  h.indexOf('const ct = Math.cos(CAM_ANGLE_OFFSET),') >= 0 &&
  h.indexOf('const rf = c * ((ct - st) * f - (ct + st) * l);') >= 0 &&
  h.indexOf('const rl = c * ((ct + st) * f + (ct - st) * l);') >= 0);
check('routeEnd truck off-screen test projects onto the rotated screen axis (cos/sin of CAM_ANGLE_OFFSET)',
  h.indexOf('(rearWx - camX) * Math.cos(CAM_ANGLE_OFFSET) + (rearWy - camY) * Math.sin(CAM_ANGLE_OFFSET)') >= 0);
check('hopper zoom: constants present (0.86 in, 1.06 out, 10u fade, 2.5 ease + 12% lift / 8% dip + 1.0u drift @ 1.5 ease + 10u sun dip)',
  /const CAM_ZOOM_IN = 0\.86;/.test(h) && /const CAM_ZOOM_OUT = 1\.06;/.test(h) && /const CAM_ZOOM_END = 1\.3;/.test(h) && /const CAM_ZOOM_DOOR = 1\.15;/.test(h) && /const CAM_ZOOM_END_SMOOTH = 0\.8;/.test(h) && /const CAM_ZOOM_DIST = 10;/.test(h) && /const CAM_ZOOM_SMOOTH = 2\.5;/.test(h) && /const CAM_H_LIFT = 0\.12;/.test(h) && /const CAM_H_DIP = 0\.08;/.test(h) && /const CAM_X_LIFT = 1\.0;/.test(h) && /const CAM_X_SMOOTH = 1\.5;/.test(h) && /const SUN_DIP = 10;/.test(h));
check('hopper zoom: base frustum captured on init + resize (zoom scales FROM the un-zoomed frustum)',
  (h.match(/_baseFrustum = f;/g) || []).length >= 2);
check('hopper zoom: positionCamera measures the worker->hopper distance and scales the ortho frustum',
  pcSrc.indexOf('hopperAimX()') >= 0 && pcSrc.indexOf('hopperWorldY()') >= 0 &&
  pcSrc.indexOf('_baseFrustum.l * camZoom') >= 0 && pcSrc.indexOf('camera.updateProjectionMatrix();') >= 0);
check('hopper angle: eye height rides the eased zoom factor (lifts far / dips close, base ARM_H without a truck)',
  pcSrc.indexOf('CAM_ZOOM_OUT - CAM_ZOOM_IN') >= 0 &&
  pcSrc.indexOf('CAM_H_DIP') >= 0 && pcSrc.indexOf('CAM_H_LIFT') >= 0 &&
  pcSrc.indexOf('camera.position.set(camTX + ARM_D * si - camXOff, camTY - ARM_D * co, eyeZ);') >= 0);
check('hopper drift: the eye slides left with the lift (CAM_X_LIFT * zt in BOTH branches, no-truck = 0)',
  pcSrc.indexOf('CAM_X_LIFT * zt') >= 0 &&
  (pcSrc.match(/- camXOff, /g) || []).length === 2);
check('hopper drift: dolly trail uses its OWN slower time constant (CAM_X_SMOOTH exp ease, frozen at dt=0)',
  pcSrc.indexOf('Math.exp(-CAM_X_SMOOTH * (dt || 0))') >= 0 &&
  h.indexOf('let camXSmooth = 0;') >= 0);
check('shadow light: the sun dips with the same factor (SUN_Z0 - SUN_DIP * zt; sunny default SUN_Z0 = 58)',
  pcSrc.indexOf('SUN_Z0 - SUN_DIP * zt') >= 0 && h.indexOf('SUN_Z0 = 58') >= 0);
check('hopper zoom: guarded so the sandbox / menu (no truck) skips it (typeof truck)',
  pcSrc.indexOf('typeof truck !== "undefined"') >= 0);
check('hopper zoom: reset on a fresh shift (starts zoomed in at the truck + drift reset)',
  h.indexOf('camZoom = CAM_ZOOM_IN; _camZoomApplied = 0; camXSmooth = 0;') >= 0);

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
const CAM_ANGLE_OFFSET = 0; // mirrors index.html's CAM_ANGLE_OFFSET (the 0 literal is asserted above)
const ARM = Math.sqrt(1.4142 * 26 * (1.4142 * 26) + 26 * 26); // 45.033, the eye->target arm
const armLen = () => {
  // follow-point (CAM_PIVOT_WORKER = false): target = (c45*(wx - camFollowY), c45*(wx + camFollowY), 0);
  // recompute camFollowY like positionCamera does
  const camFollowY = 2.0 + Math.min(3.5, Math.max(-3.5, api.getCamFollow() * 0.35));
  const t = new THREE.Vector3(C45 * (p.wx - camFollowY), C45 * (p.wx + camFollowY), 0);
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
check('center lane: base orbit applied (eye offset rotated by 0deg (pure isometric: camTX + ARM_D*sin(0)=0, camTY - ARM_D, z = ARM_H))',
  Math.abs(camera.position.x - (C45 * (0 - 2.0) + 1.4142 * 26 * Math.sin(CAM_ANGLE_OFFSET))) < 1e-6 &&
  Math.abs(camera.position.y - (C45 * (0 + 2.0) - 1.4142 * 26 * Math.cos(CAM_ANGLE_OFFSET))) < 1e-6 &&
  Math.abs(camera.position.z - 26) < 1e-9 &&
  Math.abs(Math.atan2(screenRight().y, screenRight().x) - CAM_ANGLE_OFFSET) < 1e-6,
  camera.position.toArray().map(n => n.toFixed(4)).join(','));
check('center lane: worker on screen', onScreen(workerNDC()), JSON.stringify(workerNDC()));

// ---- Test A: suburban up-lane extreme (workerMaxY = 8.0) ----
p.wx = 0; p.wy = 8.0;
settle(600); // 10s at 60fps -- fully settled (200ms time constant)
check('up-lane: camFollow settles to lane offset (8.0 - 2.0 = 6.0)', Math.abs(api.getCamFollow() - 6.0) < 1e-3, String(api.getCamFollow()));
const angA = CAM_ANGLE_OFFSET; // up-lane: rotation OFF -- yaw stays 0 on top of the 0deg base orbit
check('up-lane: yaw stays 0 (rotation OFF) on top of the base orbit (eye swings sideways, z pinned at ARM_H)',
  Math.abs(camera.position.z - 26) < 1e-9 &&
  Math.abs(camera.position.x - (C45 * (0 - 4.1) + 1.4142 * 26 * Math.sin(angA))) < 0.01 &&
  Math.abs(camera.position.y - (C45 * (0 + 4.1) - 1.4142 * 26 * Math.cos(angA))) < 0.01,
  camera.position.toArray().map(n => n.toFixed(4)).join(','));
check('up-lane: pan applied (camera center moves with the lane, camFollowY = 4.1)', Math.abs(api.getCamFollow() * 0.35 - 2.1) < 1e-3, String(api.getCamFollow()));
check('up-lane: arm length preserved (no zoom / no clip-plane drift)', Math.abs(armLen() - ARM) < 0.01, String(armLen()));
check('up-lane: screen-right rotated by exactly the total orbit angle (0 yaw + base orbit), with NO roll (z = 0)',
  Math.abs(screenRight().z) < 1e-9 && Math.abs(Math.atan2(screenRight().y, screenRight().x) - angA) < 1e-6,
  screenRight().toArray().map(n => n.toExponential(3)).join(','));
check('up-lane: worker still inside the frustum', onScreen(workerNDC()), JSON.stringify(workerNDC()));

// ---- Test B: street-lane extreme (p.wy = -9.4, the clamp floor) ----
p.wx = 100; p.wy = -9.4;
settle(600);
const angB = CAM_ANGLE_OFFSET; // street lane: rotation OFF -- yaw stays 0 (symmetry)
check('street lane: pan is hard-capped at 3.5u (camFollowY = -1.5, checked via the un-panned y axis)',
  Math.abs(camera.position.y - (C45 * (100 - 1.5) - 1.4142 * 26 * Math.cos(angB))) < 0.01,
  camera.position.toArray().map(n => n.toFixed(4)).join(','));
check('street lane: yaw stays 0, same as up-lane (rotation OFF, symmetric) (symmetry, eye z pinned at ARM_H)',
  Math.abs(camera.position.z - 26) < 1e-9 &&
  Math.abs(camera.position.x - (C45 * (100 + 1.5) + 1.4142 * 26 * Math.sin(angB))) < 0.01,
  camera.position.toArray().map(n => n.toFixed(4)).join(','));
check('street lane: arm length preserved', Math.abs(armLen() - ARM) < 0.01, String(armLen()));
check('street lane: worker still inside the frustum', onScreen(workerNDC()), JSON.stringify(workerNDC()));

// ---- Test P: follow-point pivot (CAM_PIVOT_WORKER = false — the preferred camera) ----
api.setState('play');
p.wx = 30; p.wy = 5.0;
settle(600); // fully settled: yaw at the smoothed cap, pivot = lagged follow point
check('follow mode: a 10u worker jump does NOT move the eye fully (forward lead/lag trails, capped by CAM_FWD_MAX)',
  (() => {
    const before = camera.position.clone();
    p.wx += 10;
    api.positionCamera(1 / 60);
    const dx = camera.position.x - before.x, dy = camera.position.y - before.y;
    return dx > 0 && dx < C45 * 10 && dy > 0 && dy < C45 * 10;
  })(), 'eye delta should trail between 0 and c45*10');
settle(600);
check('follow mode: worker stays on screen at a mid-lane offset', onScreen(workerNDC()), JSON.stringify(workerNDC()));

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
check('vel lead: rotation OFF -- constant strafe adds no yaw lead (4 u/s * 0 = 0)',
  Math.abs(Math.atan2(screenRight().y, screenRight().x) - (CAM_ANGLE_OFFSET)) < 0.005,
  String(Math.atan2(screenRight().y, screenRight().x)));
settle(90); // he stops: the lead eases back to the pure cap
check('vel lead: yaw stays 0 once he stops',
  Math.abs(Math.atan2(screenRight().y, screenRight().x) - (CAM_ANGLE_OFFSET)) < 0.005,
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
check('vel lead: settles back at 0 yaw in the center lane (base orbit only)', Math.abs(Math.atan2(screenRight().y, screenRight().x) - CAM_ANGLE_OFFSET) < 0.005,
  String(Math.atan2(screenRight().y, screenRight().x)));

// ---- Base orbit: the REAL analog stick compensation keeps "push up = up on screen" ----
// Extract the actual rotation block from updatePlayer and run it against the mirror
// of CAM_ANGLE_OFFSET. l is SCREEN-LEFT positive (pushing the stick right gives l < 0),
// so stick RIGHT is (f = 0, l = -1).
const rotSrc = grab('if (mv.analog) {', 'l = rl;');
const rotateStick = (sf, sl) =>
  new Function('mv', 'CAM_ANGLE_OFFSET',
    'let f = ' + sf + ', l = ' + sl + ';\n' + rotSrc + '\n}\nreturn { f: f, l: l };')({ analog: true }, CAM_ANGLE_OFFSET);
{
  const r = rotateStick(1, 0); // stick UP
  const expF = C45 * (Math.cos(CAM_ANGLE_OFFSET) - Math.sin(CAM_ANGLE_OFFSET));
  const expL = C45 * (Math.cos(CAM_ANGLE_OFFSET) + Math.sin(CAM_ANGLE_OFFSET));
  check('stick UP moves the worker SCREEN-UP at the 0deg orbit (route dir f=' + expF.toFixed(3) + ', l=' + expL.toFixed(3) + ')',
    Math.abs(r.f - expF) < 1e-9 && Math.abs(r.l - expL) < 1e-9, 'f=' + r.f + ' l=' + r.l);
}
{
  const r = rotateStick(0, -1); // stick RIGHT
  const expF = C45 * (Math.cos(CAM_ANGLE_OFFSET) + Math.sin(CAM_ANGLE_OFFSET));
  const expL = C45 * (-Math.cos(CAM_ANGLE_OFFSET) + Math.sin(CAM_ANGLE_OFFSET));
  check('stick RIGHT moves the worker SCREEN-RIGHT at the 0deg orbit (route dir f=' + expF.toFixed(3) + ', l=' + expL.toFixed(3) + ')',
    Math.abs(r.f - expF) < 1e-9 && Math.abs(r.l - expL) < 1e-9, 'f=' + r.f + ' l=' + r.l);
}

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

// ---- Test H: HOPPER ZOOM (subtle frustum tighten near the back of the truck) ----
// Isolated sandbox: the 50 checks above run positionCamera with NO truck (the zoom
// block is skipped, so the position/arm-length results are byte-identical). Here we
// inject a truck + hopper fns and prove the frustum scales DOWN (zoom in) at the
// hopper and eases back OUT (past base, CAM_ZOOM_OUT) far away, and the eye
// HEIGHT rides the same factor (rises far / dips close). The scale is read as
// camera.top / baseTop and the angle as camera.position.z.
{
  const baseF = { l: -8, r: 8, t: 4.5, b: -4.5 }; // the 16:9 s=4.5 base frustum (matches the sandbox camera)
  const truck2 = { wx: 40, hopperAimOff: -4.3, hopperOff: -4.3, hopperY: 0 };
  const routeEndFake = { t: 0, phase: 'walk', pt: 0, walkT: 0, pts: [{ x: 30, y: 2 }, { x: 34, y: -2 }, { x: 35.7, y: -4.5 }] };
  const zoomApi = new Function(
    'THREE', 'camera', 'dirLight', 'groundGroup', 'p', 'clamp', 'ISO_A', 'CAM_Y',
    'truck', 'hopperAimX', 'hopperWorldY', 'routeEnd',
    'let state = "play";\n' + snapCode + '\n' + camConsts + '\n' + pcSrc +
    '\nreturn { positionCamera, setBaseFrustum: f => { _baseFrustum = f; }, getCamXSmooth: () => camXSmooth, getCamZoom: () => camZoom, getCamFollowX: () => camFollowX, setState: s => { state = s; } };',
  )(THREE, camera, dirLight, groundGroup, p, (v, lo, hi) => Math.min(hi, Math.max(lo, v)), 26, 2.0,
    truck2,
    () => truck2.wx + (truck2.hopperAimOff != null ? truck2.hopperAimOff : -4.3),
    () => -4.5 + (truck2.hopperY != null ? truck2.hopperY : 0),
    routeEndFake);
  zoomApi.setBaseFrustum(baseF);
  p.wx = 40; p.wy = 30; // ~35u from the hopper -> fully zoomed out
  for (let i = 0; i < 300; i++) zoomApi.positionCamera(1 / 60);
  const farScale = camera.top / baseF.t;
  const farEyeZ = camera.position.z;
  check('hopper zoom: far from the truck the frustum eases out to ~CAM_ZOOM_OUT (1.06, a bit wider than base)',
    Math.abs(farScale - 1.06) < 0.01, String(farScale));
  check('hopper angle: far from the truck the eye RISES to ARM_H * 1.12 (29.12, more top-down)',
    Math.abs(farEyeZ - 26 * 1.12) < 0.05, String(farEyeZ));
  check('hopper drift: far the eye is shifted LEFT by CAM_X_LIFT (baseline x = c45*(40 - 5.5))',
    Math.abs(camera.position.x - (Math.SQRT1_2 * (40 - 5.5) - 1.0)) < 0.05, String(camera.position.x));
  check('shadow light: far the sun DIPS to z = 58 - SUN_DIP (48 -> longer shadows)',
    Math.abs(dirLight.position.z - 48) < 0.05, String(dirLight.position.z));
  p.wx = truck2.wx - 4.3; p.wy = -4.5; // right at the back of the truck (the hopper)
  for (let i = 0; i < 300; i++) zoomApi.positionCamera(1 / 60);
  const nearScale = camera.top / baseF.t;
  const nearEyeZ = camera.position.z;
  check('hopper zoom: at the back of the truck the frustum tightens to ~CAM_ZOOM_IN (0.86)',
    Math.abs(nearScale - 0.86) < 0.01, String(nearScale));
  check('hopper angle: at the hopper the eye DIPS to ARM_H * 0.92 (23.92, a lower angle)',
    Math.abs(nearEyeZ - 26 * 0.92) < 0.05, String(nearEyeZ));
  check('hopper drift: at the hopper the eye is back at baseline x (slides right as it lowers)',
    Math.abs(camera.position.x - Math.SQRT1_2 * (35.7 - -0.275)) < 0.05, String(camera.position.x));
  check('shadow light: at the hopper the sun is back at base z = 58 (short shadows)',
    Math.abs(dirLight.position.z - 58) < 0.05, String(dirLight.position.z));
  // DOLLY TRAIL: from the settled dip, jump far -- the height factor (zt) reacts
  // this frame while the x-slide (camXSmooth, slower ease) must clearly lag it.
  p.wx = 40; p.wy = 30;
  zoomApi.positionCamera(1 / 60);
  const zt1 = (zoomApi.getCamZoom() - 0.86) / (1.06 - 0.86);
  const x1 = zoomApi.getCamXSmooth();
  check('hopper drift: DOLLY TRAIL -- one frame after the jump the height factor moved >4x the x-slide',
    zt1 > 0.02 && x1 > 0 && zt1 > 4 * x1, 'zt=' + zt1.toFixed(3) + ' x=' + x1.toFixed(3));
  for (let i = 0; i < 300; i++) zoomApi.positionCamera(1 / 60); // re-settle far
  check('hopper drift: the x-slide CATCHES UP to full CAM_X_LIFT once settled',
    Math.abs(zoomApi.getCamXSmooth() - 1.0) < 0.01, String(zoomApi.getCamXSmooth()));
  // ROUTE-END (two beats): WALK progress drives the wide frame; BOARD/DRIVE settle on the door
  zoomApi.setState('routeend');
  routeEndFake.phase = 'walk'; routeEndFake.pt = 0;
  p.wx = 30; p.wy = 2; // walk start (pts[0])
  for (let i = 0; i < 300; i++) zoomApi.positionCamera(1 / 60);
  check('route-end: at walk start the frame holds the base wide (1.06) -- it grows WITH the walk',
    Math.abs(camera.top / baseF.t - 1.06) < 0.01, String(camera.top / baseF.t));
  routeEndFake.pt = 1; p.wx = 34; p.wy = -2; // mid-walk (progress ~= 0.65)
  for (let i = 0; i < 10; i++) zoomApi.positionCamera(1 / 60);
  const endEarly = camera.top / baseF.t;
  check('route-end: the pull-back is SLOW (10 frames into the mid-walk target it has barely left 1.06)',
    endEarly < 1.12, String(endEarly));
  for (let i = 0; i < 300; i++) zoomApi.positionCamera(1 / 60);
  check('route-end: mid-walk the frame tracks the walk progress (1.06 + 0.24 * 0.652 ~= 1.216)',
    Math.abs(camera.top / baseF.t - 1.216) < 0.02, String(camera.top / baseF.t));
  // CYCLE beat: he stands at the hopper (same position/progress) while the compactor runs
  routeEndFake.phase = 'cycle';
  for (let i = 0; i < 300; i++) zoomApi.positionCamera(1 / 60);
  check('route-end: the CYCLE phase HOLDS the mid-walk frame (he stands at the hopper)',
    Math.abs(camera.top / baseF.t - 1.216) < 0.02, String(camera.top / baseF.t));
  routeEndFake.phase = 'walk';
  routeEndFake.pt = 2; p.wx = 35.7; p.wy = -4.5; // at the cab door
  for (let i = 0; i < 300; i++) zoomApi.positionCamera(1 / 60);
  check('route-end: at the door the frame lands on the WIDE 1.3 (pace tied to the walk)',
    Math.abs(camera.top / baseF.t - 1.3) < 0.01, String(camera.top / baseF.t));
  routeEndFake.phase = 'board';
  for (let i = 0; i < 300; i++) zoomApi.positionCamera(1 / 60);
  check('route-end: BOARD settles the frame on the cab door (1.15 push-in)',
    Math.abs(camera.top / baseF.t - 1.15) < 0.01, String(camera.top / baseF.t));
  routeEndFake.phase = 'drive';
  for (let i = 0; i < 300; i++) zoomApi.positionCamera(1 / 60);
  check('route-end: DRIVE keeps the door frame (1.15)',
    Math.abs(camera.top / baseF.t - 1.15) < 0.01, String(camera.top / baseF.t));
  // ...and the forward follow stays LIVE during the walk
  const fx0 = zoomApi.getCamFollowX();
  p.wx += 8; // the cinematic walks the worker forward
  for (let i = 0; i < 300; i++) zoomApi.positionCamera(1 / 60);
  check('route-end: the forward follow stays LIVE (camera scrolls with the walk and settles under the worker)',
    Math.abs(zoomApi.getCamFollowX() - (fx0 + 8)) < 0.05,
    'before=' + fx0.toFixed(2) + ' after=' + zoomApi.getCamFollowX().toFixed(2));
  zoomApi.setState('dying');
  const fx1 = zoomApi.getCamFollowX();
  p.wx += 8;
  for (let i = 0; i < 300; i++) zoomApi.positionCamera(1 / 60);
  check('dying: the forward follow is FROZEN (the LODI does not drag the view)',
    Math.abs(zoomApi.getCamFollowX() - fx1) < 1e-9, String(zoomApi.getCamFollowX()));
  zoomApi.setState('play');
  check('hopper zoom: near the hopper is strictly tighter than far away (a real push-in)',
    nearScale < farScale - 0.05, 'near=' + nearScale + ' far=' + farScale);
  check('hopper angle: the far eye is strictly HIGHER than the near eye (rise out / dip in)',
    farEyeZ > nearEyeZ + 1, 'far=' + farEyeZ + ' near=' + nearEyeZ);
  camera.left = -8; camera.right = 8; camera.top = 4.5; camera.bottom = -4.5; camera.updateProjectionMatrix(); // restore
}

console.log(pass ? '\nCAMERA LANE-FOLLOW OK' : '\nCAMERA LANE-FOLLOW BROKEN');
process.exit(pass ? 0 : 1);