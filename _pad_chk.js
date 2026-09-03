// Harness: runs the EXACT virtual-pad code from index.html (extracted verbatim)
// and the EXACT updatePlayer input lines, with faked DOM/state.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// ---------- fakes ----------
function fakeEl(w){ return { style:{}, clientWidth:w, _h:{},
  addEventListener(ev, fn){ (this._h[ev] = this._h[ev] || []).push(fn); },
  fire(ev, e){ (this._h[ev] || []).forEach(fn => fn(e || { preventDefault(){} })); },
}; }
const joy = fakeEl(200);
joy.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 });
joy.setPointerCapture = () => {};
const joyStick = fakeEl(92);
const actBtn = fakeEl(120);
const pressed = { v: false };
actBtn.classList = { toggle(c, f){ if (c === 'pressed') pressed.v = f; } };
const els = { 'joy': joy, 'joy-stick': joyStick, 'actbtn': actBtn };
const $ = id => els[id];
const keys = {};
const gp = { left:false, right:false, fwd:false, back:false, act:false, pAct:false, pStart:false };
let state = 'play', interacts = 0;
function tryInteract(){ interacts++; }
function startGame(){}

// ---------- extract + run the real pad code ----------
const A = '// ==================== VIRTUAL PAD (MOBILE) ====================';
const B = '// ==================== END VIRTUAL PAD ====================';
const s = html.indexOf(A);
if (s < 0) throw new Error('pad block not found');
const code = html.slice(s, html.indexOf(B, s) + B.length);
const pad = new Function('$', 'keys', 'gp', 'state', 'tryInteract', 'startGame',
  code + '\n;return { vt, joyDirFromPoint, updateVirtualPad };')($, keys, gp, state, tryInteract, startGame);
const { vt, updateVirtualPad } = pad;

let pass = true;
function check(name, cond, extra){ console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (cond ? '' : '  [' + extra + ']')); if (!cond) pass = false; }

// ---------- 8-way snapping via real pointer handlers ----------
// Pad is rotated 45° CCW from the worker's directions, but the STICK shows the
// finger's own (raw) 8-way position. Finger positions (pad is 200x200 at 0,0):
const ev = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, preventDefault(){} });
const tap = (x, y) => joy.fire('pointerdown', ev(x, y));
const mv  = (x, y) => joy.fire('pointermove', ev(x, y));
const dir = () => ({ fwd: vt.fwd, back: vt.back, left: vt.left, right: vt.right });
const none = d => !d.fwd && !d.back && !d.left && !d.right;
const stick = () => joyStick.style.transform;
const T = {
  N:  'translate(calc(-50% + 0.0px), calc(-50% + -54.0px))',
  SE: 'translate(calc(-50% + 38.2px), calc(-50% + 38.2px))',
  W:  'translate(calc(-50% + -54.0px), calc(-50% + 0.0px))',
  C:  'translate(-50%, -50%)',
};

tap(100, 10);
check('N  (up)          = fwd+left (W+A)', vt.fwd && vt.left && !vt.back && !vt.right, dir());
updateVirtualPad();
check('stick VISUALLY points up (where the finger is)', stick() === T.N, stick());
mv(185, 15);   check('NE (up-right)    = fwd (W)',         vt.fwd && !vt.back && !vt.left && !vt.right, dir());
mv(190, 100);  check('E  (right)       = fwd+right (W+D)',vt.fwd && vt.right && !vt.back && !vt.left, dir());
mv(185, 185);  check('SE (down-right)  = right (D)',       vt.right && !vt.fwd && !vt.back && !vt.left, dir());
updateVirtualPad();
check('stick VISUALLY points down-right (where the finger is)', stick() === T.SE, stick());
mv(100, 190);  check('S  (down)        = back+right (S+D)',vt.back && vt.right && !vt.fwd && !vt.left, dir());
mv(15, 185);   check('SW (down-left)   = back (S)',        vt.back && !vt.fwd && !vt.left && !vt.right, dir());
mv(10, 100);   check('W  (left)        = back+left (S+A)', vt.back && vt.left && !vt.fwd && !vt.right, dir());
updateVirtualPad();
check('stick VISUALLY points left (where the finger is)', stick() === T.W, stick());
mv(15, 15);    check('NW (up-left)     = left (A)',        vt.left && !vt.fwd && !vt.back && !vt.right, dir());
mv(100, 100);  check('center deadzone  = no direction',    none(dir()), dir());
updateVirtualPad();
check('stick VISUALLY back to center in deadzone', stick() === T.C, stick());
joy.fire('pointerup', { pointerId: 1 });
check('release            = no direction', none(dir()), dir());
check('2nd pointer ignored after release', (() => { joy.fire('pointermove', { pointerId: 9, clientX: 190, clientY: 100 }); return none(dir()); })());
updateVirtualPad();
check('stick back to center after release', stick() === T.C, stick());

// ---------- mirroring: keyboard / gamepad / touch -> stick + button ----------
updateVirtualPad();
check('no input -> stick centered', joyStick.style.transform === 'translate(-50%, -50%)');

keys['KeyW'] = true; updateVirtualPad();
check('W mirrored -> stick up', joyStick.style.transform === 'translate(calc(-50% + 0.0px), calc(-50% + -54.0px))');

keys['KeyW'] = false; keys['ArrowRight'] = true; updateVirtualPad();
check('ArrowRight mirrored -> stick right', joyStick.style.transform === 'translate(calc(-50% + 54.0px), calc(-50% + 0.0px))');
keys['ArrowRight'] = false;

gp.fwd = true; gp.left = true; updateVirtualPad();
const diagOk = joyStick.style.transform === 'translate(calc(-50% + -38.2px), calc(-50% + -38.2px))';
check('gamepad fwd+left -> stick NW (54/√2 = 38.2)', diagOk);
gp.fwd = false; gp.left = false; updateVirtualPad();

keys['Space'] = true; updateVirtualPad();
check('Space held -> action button pressed', pressed.v === true);
keys['Space'] = false; updateVirtualPad();
check('Space up -> action button unpressed', pressed.v === false);

vt.act = true; updateVirtualPad();
check('touch act held -> action button pressed', pressed.v === true);

// ---------- action button = SPACE ----------
const before = interacts;
actBtn.fire('pointerdown', { pointerId: 2, preventDefault(){} });
check('ACT press in play -> tryInteract()', interacts === before + 1 && vt.act === true);
actBtn.fire('pointerup', {});
check('ACT release -> vt.act cleared', vt.act === false);

// ---------- updatePlayer input lines (extracted verbatim) ----------
const m0 = html.indexOf('let fwd  = !!');
const m1 = html.indexOf('lat = -1;', m0);
const lines = html.slice(m0, m1 + 'lat = -1;'.length);
const move = new Function('keys', 'gp', 'vt', lines + '\n;return { fwd, back, lat };');
let r = move(keys, gp, Object.assign({}, vt, { back: true }));
check('touch SE (S) -> back (movement)', r.back === true && !r.fwd);
r = move(keys, gp, Object.assign({}, vt, { fwd: true, left: true }));
check('touch N (W+A) -> fwd + lat +1 (movement)', r.fwd === true && r.lat === 1 && r.back === false);
r = move({ KeyA: true }, gp, vt);
check('KeyA -> lat +1 (movement)', r.lat === 1 && !r.fwd && !r.back);
r = move({}, { back: true }, vt);
check('gamepad back -> back (movement)', r.back === true);
r = move({}, gp, vt);
check('no input -> stands still', !r.fwd && !r.back && r.lat === 0);

console.log(pass ? '\nALL VIRTUAL PAD TESTS PASSED' : '\nSOME TESTS FAILED');
process.exit(pass ? 0 : 1);
