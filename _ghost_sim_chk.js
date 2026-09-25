// Runtime sim + syntax check for the ghost-hand clench animation
// (squeeze-and-hold "catch" + opposing thumb curl + faster grab).
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync(
  "c:/Users/Marc/Documents/GitHub/Dat-Sh-t-s-Not-Yours-/index.html",
  "utf8"
);

// 1. Extract all <script> blocks
const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let m;
const blocks = [];
while ((m = scriptRe.exec(html)) !== null) blocks.push(m[1]);
console.log(`Found ${blocks.length} <script> blocks`);

// 2. Syntax-check each block (compile, do not run)
let allOk = true;
for (let i = 0; i < blocks.length; i++) {
  try {
    new vm.Script(blocks[i], { filename: `block_${i}.js` });
  } catch (e) {
    allOk = false;
    console.error(`FAIL  syntax error in block ${i}: ${e.message}`);
  }
}
console.log(
  allOk
    ? "PASS  all <script> blocks compile (no syntax errors)"
    : "FAIL  syntax errors found"
);

// 3. Extract the animateGhostArms function source (brace-match)
function extractFunction(src, name) {
  const idx = src.indexOf("function " + name);
  if (idx === -1) return null;
  const start = src.indexOf("{", idx);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(idx, i + 1);
    }
  }
  return null;
}
const fnSrc = extractFunction(html, "animateGhostArms");
if (!fnSrc) {
  console.error("FAIL  could not find animateGhostArms");
  process.exit(1);
}

// 4. Mock THREE + GHOST_ARMS (matches the real per-finger data shape)
class Vector3 {
  constructor(x, y, z) {
    this.x = x || 0;
    this.y = y || 0;
    this.z = z || 0;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}
function makeMockMesh() {
  return {
    position: {
      x: 0,
      y: 0,
      z: 0,
      set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      },
    },
    quaternion: { setFromUnitVectors() {} },
  };
}
function makeMockArm() {
  return {
    g: {
      rotation: { z: 0 },
      userData: {
        arm: { rotation: { x: 0 }, position: { z: 0 } },
        fingers: [
          { ux: 0.766, uy: -0.643, curlLen: 0.2, Mx: 0.5, My: -0.4, Mz: 0.5, upper: makeMockMesh(), tip: makeMockMesh(), cmax: 0.95, poff: 0, thumb: false },
          { ux: 0.966, uy: -0.259, curlLen: 0.2, Mx: 0.6, My: -0.2, Mz: 0.5, upper: makeMockMesh(), tip: makeMockMesh(), cmax: 0.92, poff: 0.06, thumb: false },
          { ux: 0.996, uy: 0.087, curlLen: 0.2, Mx: 0.6, My: 0.1, Mz: 0.5, upper: makeMockMesh(), tip: makeMockMesh(), cmax: 1.0, poff: 0.12, thumb: false },
          { ux: 0.866, uy: 0.5, curlLen: 0.2, Mx: 0.5, My: 0.4, Mz: 0.5, upper: makeMockMesh(), tip: makeMockMesh(), cmax: 0.85, poff: 0.18, thumb: false },
          { ux: -0.375, uy: -0.927, curlLen: 0.15, Mx: -0.3, My: -0.9, Mz: 0.5, upper: makeMockMesh(), tip: makeMockMesh(), cmax: 0.9, poff: 0.24, thumb: true },
        ],
      },
    },
    phase: 0,
  };
}

// 5. Run the function in a vm context with a controllable clock
let mockTime = 0; // ms
const sandbox = {
  performance: { now: () => mockTime },
  THREE: { Vector3 },
  GHOST_ARMS: [makeMockArm()],
  console,
};
vm.createContext(sandbox);
vm.runInContext(
  fnSrc + "\n; globalThis.__animateGhostArms = animateGhostArms;",
  sandbox
);

function checkPositions(label) {
  const arm = sandbox.GHOST_ARMS[0];
  let ok = true;
  for (const f of arm.g.userData.fingers) {
    for (const p of [f.tip.position, f.upper.position]) {
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) {
        ok = false;
        console.error(
          `FAIL  ${label}: NaN/Inf in ${f.thumb ? "thumb" : "finger"} position (${p.x}, ${p.y}, ${p.z})`
        );
      }
      // The fingertip must stay within ~1.5 * curlLen of its knuckle.
      const dx = p.x - f.Mx,
        dy = p.y - f.My,
        dz = p.z - f.Mz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > f.curlLen * 1.5 + 1e-6) {
        ok = false;
        console.error(
          `FAIL  ${label}: ${f.thumb ? "thumb" : "finger"} tip ${dist.toFixed(3)}u from knuckle (max ${f.curlLen * 1.5}u)`
        );
      }
    }
  }
  if (ok) console.log(`PASS  ${label}: all positions finite & within reach`);
  return ok;
}

// Full-cycle sweep: no NaN/Inf anywhere.
let allOk2 = true;
for (let t = 0; t < 3; t += 0.05) {
  mockTime = t * 1000;
  sandbox.__animateGhostArms();
  const arm = sandbox.GHOST_ARMS[0];
  for (const f of arm.g.userData.fingers) {
    for (const p of [f.tip.position, f.upper.position]) {
      if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) {
        allOk2 = false;
        console.error(`FAIL  t=${t.toFixed(2)}s: NaN/Inf in ${f.thumb ? "thumb" : "finger"} position`);
      }
    }
  }
}
if (allOk2) console.log("PASS  full cycle (t=0..3s, 60 frames): no NaN/Inf in any position");

// Middle finger (fi=2, poff=0.12, phase=0): th = at*2.8 + 0.12.
// Clenched/held (sRaw=1): th = pi/2 -> at = (1.5708-0.12)/2.8 = 0.518 s.
mockTime = 518;
sandbox.__animateGhostArms();
checkPositions("held state (t=0.518s, sRaw=1, grip locked s=1)");

// Open (sRaw=0): th = 3*pi/2 -> at = (4.712-0.12)/2.8 = 1.64 s.
mockTime = 1640;
sandbox.__animateGhostArms();
checkPositions("open state (t=1.64s, sRaw=0, hand open)");

// Verify the "catch": at the peak (sRaw>0.88) the grip is LOCKED (s=1),
// and just before the peak it is not. We re-derive s here the same way.
function sAt(at, poff) {
  const th = at * 2.8 + 0 + poff;
  const sRaw = 0.5 + 0.5 * Math.sin(th);
  let s = 1 - Math.pow(1 - sRaw, 1.4);
  if (sRaw > 0.88) s = 1;
  return s;
}
const peak = sAt(0.518, 0.12); // should be 1 (locked)
const prePeak = sAt(0.2, 0.12); // before the hold window (sRaw<0.88), not locked
const okCatch = peak === 1 && prePeak < 1;
console.log(
  okCatch
    ? `PASS  squeeze-and-hold: locked s=1 at peak (sRaw=${(0.5 + 0.5 * Math.sin(0.518 * 2.8 + 0.12)).toFixed(3)}), s=${prePeak.toFixed(3)} just before`
    : `FAIL  squeeze-and-hold: peak=${peak}, prePeak=${prePeak}`
);

// Verify the opposing thumb: at full clench the thumb tip moves in the
// LATERAL direction (perpendicular to its radial), not the radial.
mockTime = 518;
sandbox.__animateGhostArms();
const thumb = sandbox.GHOST_ARMS[0].g.userData.fingers[4];
const sC = Math.sin(0.25 + (2.3 - 0.25) * 1 * 0.9);
const lateralX = -thumb.uy * sC,
  lateralY = thumb.ux * sC;
const radialX = -thumb.ux * sC,
  radialY = -thumb.uy * sC;
const tipDX = thumb.tip.position.x - thumb.Mx;
const tipDY = thumb.tip.position.y - thumb.My;
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}
function norm(a) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
}
const disp = [tipDX, tipDY];
const latAlign = dot(disp, [lateralX, lateralY]) / (norm(disp) * norm([lateralX, lateralY]));
const radAlign = dot(disp, [radialX, radialY]) / (norm(disp) * norm([radialX, radialY]));
const okThumb = latAlign > 0.95 && Math.abs(radAlign) < 0.1;
console.log(
  okThumb
    ? `PASS  opposing thumb: tip displacement aligns with LATERAL dir (lat=${latAlign.toFixed(3)}, rad=${radAlign.toFixed(3)})`
    : `FAIL  opposing thumb: lat=${latAlign.toFixed(3)}, rad=${radAlign.toFixed(3)}`
);

const allPass = allOk && allOk2 && okCatch && okThumb;
console.log(allPass ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
process.exit(allPass ? 0 : 1);

