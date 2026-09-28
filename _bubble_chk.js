// Harness: end-to-end test of the comic speech-bubble chain using the REAL three.js
// from the repo: exact frustum + camera-follow math from the game loop + the exact
// Voice/bubble code extracted from index.html. Proves whether a spawned bubble lands
// on-screen over the worker.
const fs = require('fs');
const THREE = require(process.env.TEMP + '\\three_r128.min.js');
const html = fs.readFileSync('index.html', 'utf8');
const grab = (a, b) => { const i = html.indexOf(a); if (i < 0) throw new Error('missing ' + a); return html.slice(i, html.indexOf(b, i) + b.length); };
const voiceCode = grab('const Voice = {', 'PRIMITIVE HELPERS');
const bubbleCode = grab('let speechBubbles = [];', 'GAME FLOW');

// ---- minimal DOM ----
const created = [];
const docEl = () => {
  const el = { tag: 'div', style: {}, className: '', textContent: '', _parent: null,
    remove(){ if (this._parent) this._parent.children = this._parent.children.filter(c => c !== this); this._parent = null; } };
  created.push(el); return el;
};
global.document = { createElement: docEl, body: { children: [], appendChild: el => { el._parent = global.document.body; global.document.body.children.push(el); } } };
global.window = global;
global.innerWidth = 1280; global.innerHeight = 720;
const spokes = [];
global.SpeechSynthesisUtterance = function(t){ this.text = t; this.volume = 1; this.pitch = 1; this.rate = 1; this.onend = null; this.onerror = null; spokes.push(this); };
global.speechSynthesis = { getVoices: () => [{ lang: 'en-US' }], speak: () => {}, cancel: () => {} };
global.SFX = { radioEl: null, radioMuted: false };

// ---- run the exact game code ----
new Function('THREE', 'performance', 'GZ', voiceCode + '\n' + bubbleCode + '\n;return { Voice, spawnBubble, updateBubbles, worldToScreen, speechBubbles: () => speechBubbles };')(THREE, performance, 0.3);
// expose the functions (function declarations inside Function scope are not global) — re-eval with return values
const api = new Function('THREE', 'performance', 'GZ', voiceCode + '\n' + bubbleCode + '\n;return { Voice, spawnBubble, updateBubbles, worldToScreen, speechBubbles };')(THREE, performance, 0.3);

// ---- exact three setup from initThree() + camera follow from loop() ----
const a = innerWidth / innerHeight, s = 4.5;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-s * a, s * a, s, -s, 1, 400);
camera.up.set(0, 0, 1);
const worldGroup = new THREE.Group();
worldGroup.rotation.z = Math.PI / 4;
scene.add(worldGroup); scene.add(camera);
// make worldToScreen see these: it reads globals `camera`/`worldGroup`
global.camera = camera; global.worldGroup = worldGroup;
function frame(wx, wy, dt){
  // Mirrors positionCamera() in index.html (ISO_A/CAM_Y + the CAM_* lane-follow
  // block). dt optional: with dt the smoothed lane offset settles exactly as in
  // the game (the bubble harness walks the worker along one lane, so camFollow
  // settles to ~0 and the framing stays identical to the pre-follow camera).
  const c45 = Math.SQRT1_2, ISO_A = 26, CAM_Y = 2.0;
  const ARM_D = 1.4142 * ISO_A, ARM_H = ISO_A;
  const CAM_LANE_FOLLOW = 0.35, CAM_PAN_MAX = 3.5, CAM_YAW_PER_UNIT = 0.025,
        CAM_YAW_MAX = 0, CAM_FOLLOW_SMOOTH = 5.0;
  const CAM_PIVOT_WORKER = false; // mirrors index.html: the smoothed follow camera is active
  const CAM_ANGLE_OFFSET = 0; // mirrors index.html: rotation OFF (pure isometric axis)
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  if (dt) { const k = 1 - Math.exp(-CAM_FOLLOW_SMOOTH * dt); camFollow += (wy - CAM_Y - camFollow) * k; }
  // worker-pivot: orbit center + look point = the worker's LIVE local (wx, wy);
  // the old smoothed pan is kept behind the toggle.
  const camFollowY = CAM_PIVOT_WORKER
    ? wy
    : CAM_Y + clamp(camFollow * CAM_LANE_FOLLOW, -CAM_PAN_MAX, CAM_PAN_MAX);
  const yaw = clamp(-camFollow * CAM_YAW_PER_UNIT, -CAM_YAW_MAX, CAM_YAW_MAX);
  const camTX = c45 * (wx - camFollowY), camTY = c45 * (wx + camFollowY);
  const ang = yaw + CAM_ANGLE_OFFSET;
  const co = Math.cos(ang), si = Math.sin(ang);
  camera.position.set(camTX + ARM_D * si, camTY - ARM_D * co, ARM_H);
  camera.up.set(0, 0, 1);
  camera.lookAt(camTX, camTY, 0);
  scene.updateMatrixWorld();
}
let camFollow = 0;

let pass = true;
const check = (n, c, e) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  [' + e + ']')); if (!c) pass = false; };

// worker stands at local (0, 2.5) and yells (the 'dog shit!' call site)
frame(0, 2.5, 0.016);
api.Voice.say('dog shit!', 2.5, 0.9, 0, 2.5);
api.updateBubbles(0.016);
const bub = api.speechBubbles[0];
check('bubble element created', !!bub && !!bub.el, JSON.stringify(api.speechBubbles.map(b => b && b.wx)));
check('bubble got screen coords', bub && bub.el.style.left !== undefined && bub.el.style.top !== undefined, bub && JSON.stringify(bub.el.style));
if (bub && bub.el.style.left !== undefined){
  const x = parseFloat(bub.el.style.left), y = parseFloat(bub.el.style.top);
  check('bubble X on screen (0..1280)', x > 0 && x < 1280, String(x));
  check('bubble Y on screen (0..720)', y > 0 && y < 720, String(y));
  // worker at local (0,2.5) projects to screen center; head+2.35 -> above center
  check('bubble near worker (center X)', Math.abs(x - 640) < 250, String(x));
  check('bubble above screen center (Y < 360)', y < 360, String(y));
}
// worker walks on; the bubble stays FROZEN at the spawn screen spot (findFreeSpot
// collision avoidance -- re-projection was intentionally removed, we only fade)
const x1 = parseFloat(bub.el.style.left);
const o1 = parseFloat(bub.el.style.opacity);
frame(10, 2.5, 0.016);
api.updateBubbles(0.016);
const x2 = parseFloat(bub.el.style.left);
const o2 = parseFloat(bub.el.style.opacity);
check('bubble stays frozen at its spawn spot while the world moves (only the fade advances)',
  x1 === x2 && o2 > o1, x1 + ' -> ' + x2 + ' (opacity ' + o1 + ' -> ' + o2 + ')');
console.log(pass ? '\nBUBBLE CHAIN OK' : '\nBUBBLE CHAIN BROKEN');
process.exit(pass ? 0 : 1);