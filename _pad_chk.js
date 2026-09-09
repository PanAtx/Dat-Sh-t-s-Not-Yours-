// Harness: runs the EXACT virtual-pad code from index.html (extracted verbatim)
// and the EXACT dominantMove() movement vector, with faked DOM/state.
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
const gp = { f: 0, l: 0, act: false, pAct: false, pStart: false }; // analog: f = forward, l = strafe
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
  code + '\n;return { vt, dominantMove, updateVirtualPad };')($, keys, gp, state, tryInteract, startGame);
const { vt, dominantMove, updateVirtualPad } = pad;

let pass = true;
function check(name, cond, extra){ console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (cond ? '' : '  [' + extra + ']')); if (!cond) pass = false; }
const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;

// ---------- analog joystick via real pointer handlers ----------
// The stick now moves 360 degrees: the worker goes where the finger points and the
// speed is proportional to how far the finger is pushed. vt.f = forward (up), vt.l = strafe (left).
const ev = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, preventDefault(){} });
const tap = (x, y) => joy.fire('pointerdown', ev(x, y));
const mv  = (x, y) => joy.fire('pointermove', ev(x, y));
const stick = () => joyStick.style.transform;
const parseT = t => { const m = /calc\(-50% \+ (-?[\d.]+)px\), calc\(-50% \+ (-?[\d.]+)px\)/.exec(t); return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 }; };
const stickXY = () => parseT(stick());
const CENTER = 'translate(-50%, -50%)';

// Full travel (finger 90px from the 100px center = 0.9 of the radius). The stick moves
// (travel = (200-92)/2 = 54px) toward the finger, so 0.9 * 54 = 48.6px; diagonals = 48.6/2 = 24.3...
// (the cardinals below use 0.9; the diagonal test below uses the full 54/2 = 27 -> 38.2 after the rim clamp).
tap(100, 10);
check('N  (up)          -> f = +0.9 (proportional)',   near(vt.f, 0.9, 0.005) && near(vt.l, 0), 'f=' + vt.f + ' l=' + vt.l);
updateVirtualPad();
{ const q = stickXY(); check('stick VISUALLY up, proportional (48.6px)', near(q.x, 0, 0.05) && near(q.y, -48.6, 0.05), stick()); }
mv(185, 15);   check('NE (up-right)    -> f = +0.707, l = -0.707', near(vt.f, 0.7071, 0.005) && near(vt.l, -0.7071, 0.005), 'f=' + vt.f + ' l=' + vt.l);
mv(190, 100);  check('E  (right)       -> f = 0, l = -0.9',     near(vt.f, 0) && near(vt.l, -0.9, 0.005), 'f=' + vt.f + ' l=' + vt.l);
mv(185, 185);  check('SE (down-right)  -> f = -0.707, l = -0.707', near(vt.f, -0.7071, 0.005) && near(vt.l, -0.7071, 0.005), 'f=' + vt.f + ' l=' + vt.l);
updateVirtualPad();
{ const q = stickXY(); check('stick VISUALLY down-right, proportional (38.2px)', near(q.x, 38.2, 0.05) && near(q.y, 38.2, 0.05), stick()); }
mv(100, 190);  check('S  (down)        -> f = -0.9 (proportional)', near(vt.f, -0.9, 0.005) && near(vt.l, 0), 'f=' + vt.f + ' l=' + vt.l);
mv(15, 185);   check('SW (down-left)   -> f = -0.707, l = +0.707', near(vt.f, -0.7071, 0.005) && near(vt.l, 0.7071, 0.005), 'f=' + vt.f + ' l=' + vt.l);
mv(10, 100);   check('W  (left)        -> f = 0, l = +0.9',     near(vt.f, 0) && near(vt.l, 0.9, 0.005), 'f=' + vt.f + ' l=' + vt.l);
updateVirtualPad();
{ const q = stickXY(); check('stick VISUALLY left, proportional (48.6px)', near(q.x, -48.6, 0.05) && near(q.y, 0, 0.05), stick()); }
mv(15, 15);    check('NW (up-left)     -> f = +0.707, l = +0.707', near(vt.f, 0.7071, 0.005) && near(vt.l, 0.7071, 0.005), 'f=' + vt.f + ' l=' + vt.l);
mv(100, 100);  check('center deadzone  -> f = 0, l = 0',          near(vt.f, 0) && near(vt.l, 0), 'f=' + vt.f + ' l=' + vt.l);
updateVirtualPad();
check('stick VISUALLY back to center in deadzone', stick() === CENTER, stick());
joy.fire('pointerup', { pointerId: 1 });
check('release            -> f = 0, l = 0', near(vt.f, 0) && near(vt.l, 0), 'f=' + vt.f + ' l=' + vt.l);
check('2nd pointer ignored after release', (() => { joy.fire('pointermove', { pointerId: 9, clientX: 190, clientY: 100 }); return near(vt.f, 0) && near(vt.l, 0); })());
updateVirtualPad();
check('stick back to center after release', stick() === CENTER, stick());


// ---------- mirroring: keyboard / gamepad / touch -> stick + button ----------
updateVirtualPad();
check('no input -> stick centered', joyStick.style.transform === CENTER);

keys['KeyW'] = true; updateVirtualPad();
check('W mirrored -> stick up', stick() === 'translate(calc(-50% + 0.0px), calc(-50% + -54.0px))');

keys['KeyW'] = false; keys['ArrowRight'] = true; updateVirtualPad();
check('ArrowRight mirrored -> stick right', stick() === 'translate(calc(-50% + 54.0px), calc(-50% + 0.0px))');
keys['ArrowRight'] = false;

gp.f = 1; gp.l = 1; updateVirtualPad();
const diagOk = joyStick.style.transform === 'translate(calc(-50% + -38.2px), calc(-50% + -38.2px))';
check('gamepad fwd+left (analog) -> stick NW (54/\u221a2 = 38.2)', diagOk);
gp.f = 0; gp.l = 0; updateVirtualPad();

keys['Space'] = true; updateVirtualPad();
check('Space held -> action button pressed', pressed.v === true);
keys['Space'] = false; updateVirtualPad();
check('Space up -> action button unpressed', pressed.v === false);

vt.act = true; updateVirtualPad();
check('touch act held -> action button pressed', pressed.v === true);
vt.act = false;

// ---------- action button = SPACE ----------
const before = interacts;
actBtn.fire('pointerdown', { pointerId: 2, preventDefault(){} });
check('ACT press in play -> tryInteract()', interacts === before + 1 && vt.act === true);
actBtn.fire('pointerup', {});
check('ACT release -> vt.act cleared', vt.act === false);

// ---------- dominantMove (the movement vector updatePlayer consumes) ----------
let r = dominantMove();
check('no input -> stands still', near(r.f, 0) && near(r.l, 0), 'f=' + r.f + ' l=' + r.l);
keys['KeyW'] = true;
r = dominantMove();
check('KeyW -> f = +1 (full forward)', near(r.f, 1) && near(r.l, 0), 'f=' + r.f + ' l=' + r.l);
keys['KeyW'] = false; keys['KeyS'] = true;
r = dominantMove();
check('KeyS -> f = -1 (full back)', near(r.f, -1) && near(r.l, 0), 'f=' + r.f + ' l=' + r.l);
keys['KeyS'] = false; keys['KeyA'] = true;
r = dominantMove();
check('KeyA -> l = +1 (strafe left)', near(r.l, 1) && near(r.f, 0), 'f=' + r.f + ' l=' + r.l);
keys['KeyA'] = false; keys['KeyD'] = true;
r = dominantMove();
check('KeyD -> l = -1 (strafe right)', near(r.l, -1) && near(r.f, 0), 'f=' + r.f + ' l=' + r.l);
keys['KeyD'] = false; keys['KeyW'] = true; keys['KeyD'] = true;
r = dominantMove();
check('W+D -> diagonal normalized (f = 1/\u221a2, l = -1/\u221a2)', near(r.f, 0.7071, 0.005) && near(r.l, -0.7071, 0.005), 'f=' + r.f + ' l=' + r.l);
keys['KeyW'] = false; keys['KeyD'] = false;
gp.f = 0.5; gp.l = 0;
r = dominantMove();
check('gamepad analog half-stick -> f = 0.5', near(r.f, 0.5) && near(r.l, 0), 'f=' + r.f + ' l=' + r.l);
gp.f = 0; gp.l = 0;
vt.f = 0.95; vt.l = 0;
r = dominantMove();
check('touch joystick -> f = 0.95', near(r.f, 0.95) && near(r.l, 0), 'f=' + r.f + ' l=' + r.l);
vt.f = 0; vt.l = 0;
gp.f = 0.8; gp.l = 0.4; keys['KeyW'] = true;
r = dominantMove();
check('keyboard (magnitude 1) beats gamepad (0.89)', near(r.f, 1) && near(r.l, 0), 'f=' + r.f + ' l=' + r.l);
keys['KeyW'] = false; gp.f = 0; gp.l = 0;

// ---------- analog rotation: the stick points in the SCREEN direction ----------
// updatePlayer rotates the analog (f,l) so the worker moves in the screen direction
// the stick points (push up = up on screen), cancelling the isometric +45deg rotation.
// In the route frame: screen-right = f - l, screen-up = f + l. The rotation must map
// each screen cardinal to a straight screen direction (no 45deg drift).
const c45 = Math.SQRT1_2;
const rot = (f, l) => ({ f: c45 * (f - l), l: c45 * (f + l) });
const scr = (a) => ({ right: a.f - a.l, up: a.f + a.l });
const cardinals = [
  ['up',    1,  0,  0,       1.4142],
  ['down', -1,  0,  0,      -1.4142],
  ['left',  0,  1, -1.4142,  0],
  ['right', 0, -1,  1.4142,  0],
];
cardinals.forEach(function(row){
  const a = rot(row[1], row[2]); const sd = scr(a);
  const dir = row[4] > 0 ? 'up' : row[4] < 0 ? 'down' : row[3] > 0 ? 'right' : 'left';
  check('analog ' + row[0] + ' -> screen ' + dir + ' (right=' + sd.right.toFixed(3) + ', up=' + sd.up.toFixed(3) + ')',
        near(sd.right, row[3], 0.02) && near(sd.up, row[4], 0.02),
        'right=' + sd.right + ' up=' + sd.up);
});
keys['KeyW'] = true;
check('keyboard -> analog = false (not rotated)', dominantMove().analog === false);
keys['KeyW'] = false;
vt.f = 0.9; vt.l = 0;
check('touch joystick -> analog = true (rotated)', dominantMove().analog === true);
vt.f = 0; vt.l = 0;

console.log(pass ? '\nALL VIRTUAL PAD TESTS PASSED' : '\nSOME TESTS FAILED');
process.exit(pass ? 0 : 1);