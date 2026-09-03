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
function frame(wx, wy){
  const c45 = Math.SQRT1_2, ISO_A = 26, CAM_Y = 2.0;
  const camTX = c45 * (wx - CAM_Y), camTY = c45 * (wx + CAM_Y);
  camera.position.set(camTX, camTY - 1.4142 * ISO_A, ISO_A);
  camera.up.set(0, 0, 1);
  camera.lookAt(camTX, camTY, 0);
  scene.updateMatrixWorld();
}

let pass = true;
const check = (n, c, e) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  [' + e + ']')); if (!c) pass = false; };

// worker stands at local (0, 2.5) and yells (the 'dog shit!' call site)
frame(0, 2.5);
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
// worker walks on; the bubble stays anchored at the world spot where it was spoken
const x1 = parseFloat(bub.el.style.left);
frame(10, 2.5);
api.updateBubbles(0.016);
const x2 = parseFloat(bub.el.style.left);
check('bubble re-projects as world moves (spoke-spot anchor)', Math.abs((x1 - x2) - 56.57 * 10) < 15, x1 + ' -> ' + x2);
console.log(pass ? '\nBUBBLE CHAIN OK' : '\nBUBBLE CHAIN BROKEN');
process.exit(pass ? 0 : 1);