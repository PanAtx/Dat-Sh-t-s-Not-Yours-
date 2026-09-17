// _dogsize_fix_chk.js — regression check for "Uncaught ReferenceError: dogSize is not defined"
// (commit dc0636a added dogSize/dogCoat reads inside makeDog + makeHighPolyDog without
//  declaring the parameters). Verifies at RUNTIME (the _bronx_dog_chk.js checks are
//  static string checks and cannot catch this):
//   - makeDog() (dogwalker's pup) no longer throws — the user's exact crash path
//   - makeDogWalker() builds person + dog + leash cleanly
//   - makeHighPolyDog() (non-Bronx leashdog) no longer throws
//   - the 'large' size + DOG_PALETTES coat feature still works when wired in
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extract(name) {
  const m = new RegExp('function ' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error(name + ' not found');
  let i = src.indexOf('{', m.index), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(m.index, i + 1);
}
// --- minimal three.js / helper stubs (same pattern as _newnpc_chk.js) ---
const THREE = {
  Group: class {
    constructor() {
      this.children = [];
      this.position = { set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.rotation = { x: 0, y: 0, z: 0 };
      this.scale = { set(x, y, z) { this.x = x; this.y = y; this.z = z; }, setScalar(s) { this.x = this.y = this.z = s; } };
      this.userData = {};
    }
    add(o) { this.children.push(o); return o; }
  },
  Mesh: class { constructor(g, m) { Object.assign(this, new THREE.Group()); this.geometry = g; this.material = m; } },
  TorusGeometry: class { constructor(r, t, rs, ts) {} },
};
const M = c => ({ color: c });
const MS = c => ({ color: c, metalness: .95 });
function BX(w, h, d, m) { return new THREE.Mesh({ w, h, d }, m); }
function CY(r1, r2, h, m, s) { return new THREE.Mesh({ r1, r2, h }, m); }
function SPH(r, m, ws, hs) { return new THREE.Mesh({ r }, m); }
const pick = a => a[0];
const SHIRTS = [0x3d6ea5], PANTS = [0x2f3640], HAIRS = [0x2a2118];
const DOG_PALETTES = {
  yellow: { fur: 0xdcb45e, light: 0xf5e6c0, furD: 0xb89040 },
  darkbrown: { fur: 0x4a3020, light: 0x8a6a50, furD: 0x2a1810 },
  husky: { fur: 0xdcdce2, light: 0xfafafc, furD: 0x8f95a3 },
  spotted: { fur: 0xf2f0ec, light: 0xfaf8f4, furD: 0x222226 },
};
const makePerson = () => {
  const g = new THREE.Group();
  return { g, legL: new THREE.Group(), legR: new THREE.Group(), armL: new THREE.Group(), armR: new THREE.Group() };
};

eval(extract('makeDog'));
eval(extract('makeHighPolyDog'));
eval(extract('makeDogWalker'));

let pass = true;
const check = (n, c, e) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  [' + e + ']')); if (!c) pass = false; };

// 1. THE USER'S CRASH: makeDog() must not throw (called by makeDogWalker).
let pup = null, pupErr = null;
try { pup = makeDog(); } catch (e) { pupErr = e; }
check('makeDog() no longer throws ReferenceError (dogwalker pup)', !pupErr && !!pup, pupErr ? pupErr.message : 'returned falsy');
check('makeDog() default is medium (no scale-up applied)', pup && pup.scale.x === undefined && pup.scale.y === undefined && pup.scale.z === undefined, pup ? JSON.stringify(pup.scale) : 'n/a');
check('makeDog() exposes full dog pivot interface', pup && pup.userData.dog && !!pup.userData.dog.legFL && !!pup.userData.dog.tailPivot && pup.userData.dog.root === pup, pup ? JSON.stringify(Object.keys(pup.userData.dog || {})) : 'n/a');

// 2. makeDogWalker() must build cleanly (exact frame from the user's stack trace).
let walker = null, walkerErr = null;
try { walker = makeDogWalker(); } catch (e) { walkerErr = e; }
check('makeDogWalker() builds person + dog + leash', !walkerErr && !!walker.g && walker.g.userData.dog, walkerErr ? walkerErr.message : 'missing dog userData');

// 3. Non-Bronx leashdog path (addCreature else-branch) must not throw.
let hpd = null, hpdErr = null;
try { hpd = makeHighPolyDog(); } catch (e) { hpdErr = e; }
check('makeHighPolyDog() no longer throws (non-Bronx leashdog)', !hpdErr && !!hpd, hpdErr ? hpdErr.message : 'returned falsy');

// 4. Intended feature preserved: 'large' + coat palette works when wired in.
let lg = makeHighPolyDog('large', 'husky');
check('makeHighPolyDog("large","husky") uses husky coat', lg.children[0].material.color === DOG_PALETTES.husky.fur, 'got 0x' + (lg.children[0].material.color || 0).toString(16));
let big = makeDog('large');
check('makeDog("large") applies 1.35/1.4/1.35 scale', big.scale.x === 1.35 && big.scale.y === 1.4 && big.scale.z === 1.35, JSON.stringify(big.scale));

console.log(pass ? '\nDOGSIZE FIX CHECKS PASSED' : '\nDOGSIZE FIX CHECKS FAILED');
process.exit(pass ? 0 : 1);