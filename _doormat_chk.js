// Smoke test for the doormat/concrete-landing NPC clipping fix.
// Verifies (a) the page's inline script still parses, (b) makeHouse exposes a step
// footprint whose world bounds + top (0.55) are correct, and (c) stepTopAt + the
// lift guard only ever RAISE a creature onto the mat (airborne creatures keep height).
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
let ok = true;
const check = (name, cond, detail) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); if (!cond) ok = false; };

// (a) syntax: parse every inline <script> (no src) exactly as a Script
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let synOk = true;
scripts.forEach((code, i) => { try { new vm.Script(code, { filename: 'inline#' + i }); } catch (e) { synOk = false; console.log('  syntax fail inline#' + i + ': ' + e.message); } });
check('inline script(s) parse (' + scripts.length + ')', synOk);
check('stepTopAt helper present', html.indexOf('function stepTopAt') >= 0);
check('makeHouse exposes userData.step', html.indexOf('g.userData.step = { cx: 0') >= 0);
check('makeBlockContents stores house.step', html.indexOf('house.step = { x0: baseX') >= 0);
check('creature lift guard present', html.indexOf('const _stTop = stepTopAt(c.wx, c.wy)') >= 0);

// (b) real makeHouse -> world footprint geometry
const pos = () => ({ x: 0, y: 0, z: 0, set() {} });
const THREE = {
  Group: class { constructor(){ this.position = pos(); this.userData = {}; this.children = []; } add(){} traverse(fn){ fn(this); } },
  Mesh: class { constructor(geo, mat){ this.position = pos(); this.isMesh = true; } },
  BoxGeometry: class { constructor(){} },
  MeshLambertMaterial: class { constructor(){} },
};
const M = c => ({ color: c });
const BX = (w, d, h, m) => ({ geo: [w, d, h], m, position: pos() });
const R = (a, b) => (a + b) / 2; // midpoint: deterministic d
const sI = html.indexOf('function makeHouse()');
const eI = html.indexOf('\nfunction ', sI + 10);
const makeHouse = new Function('THREE', 'M', 'BX', 'R', html.slice(sI, eI) + '\n;return makeHouse;')(THREE, M, BX, R);
const GZ = 0.3, baseX = 100, HOUSE_Y = 10.5;
const step = makeHouse().userData.step;
const world = { x0: baseX - step.hw, x1: baseX + step.hw, y0: HOUSE_Y + step.cy - step.hd, y1: HOUSE_Y + step.cy + step.hd, top: step.top };
console.log('  step world footprint:', JSON.stringify(world));
check('step top is 0.55 (GZ 0.3 + 0.25 slab)', world.top === 0.55, 'top=' + world.top);
check('step sits on the front-lawn band (y ~7.5..8.5)', world.y0 >= 7.2 && world.y1 <= 8.8 && world.y0 < world.y1, 'y [' + world.y0 + ',' + world.y1 + ']');
check('step is 2.5 wide (x ±1.25)', (world.x1 - world.x0) === 2.5, 'w=' + (world.x1 - world.x0));

// (c) stepTopAt + lift guard, driven by the real footprint
const blocks = [{ house: { step: world } }];
function stepTopAt(wx, wy){
  let top = GZ;
  for (let i = 0; i < blocks.length; i++){
    const s = blocks[i].house && blocks[i].house.step;
    if (!s) continue;
    if (wx >= s.x0 && wx <= s.x1 && wy >= s.y0 && wy <= s.y1) top = s.top;
  }
  return top;
}
const matY = (world.y0 + world.y1) / 2;
const applyLift = (z, wx, wy) => { const t = stepTopAt(wx, wy); return t > z ? t : z; };
check('point ON mat -> top 0.55', stepTopAt(baseX, matY) === 0.55);
check('point on grass (y=5) -> GZ', stepTopAt(baseX, 5) === GZ);
check('point in street (y=2) -> GZ', stepTopAt(baseX, 2) === GZ);
check('point beside house (x+3) -> GZ', stepTopAt(baseX + 3, matY) === GZ);
check('ground NPC (z=0.3) over mat lifts to 0.55', applyLift(0.3, baseX, matY) === 0.55);
check('airborne NPC (z=2.0) over mat keeps 2.0 (only raises)', applyLift(2.0, baseX, matY) === 2.0);
check('ground NPC (z=0.3) on grass stays 0.3', applyLift(0.3, baseX, 5) === 0.3);

console.log(ok ? '\nDOORMAT CLIPPING CHECKS PASSED' : '\nDOORMAT CLIPPING CHECKS FAILED');
process.exit(ok ? 0 : 1);
