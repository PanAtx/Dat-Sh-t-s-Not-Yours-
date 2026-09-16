// _pizza_rat_chk.js — verify the Manhattan PIZZA RAT:
//   - a pizza-carrying rat has a 25% chance on Manhattan levels (isManhattanLevel)
//   - the slice is a COMICALLY BIG triangular wedge held at the mouth (tip at
//     the nose, x=0.42), extending forward (+X)
//   - the slice is FLAT (horizontal X-Y plane, thickness straight up) and NO
//     part of it dips below world z = 0.318, so it can never clip into the
//     sidewalk/street (the ground strips top out at exactly z = 0.30, and the
//     creature group origin sits on the road at GZ = 0.30)
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let ok = true;
const check = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) ok = false;
};

function extractFn(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function not found: ' + name);
  const b = src.indexOf('{', idx);
  let d = 0,
    i = b;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') {
      d--;
      if (!d) {
        i++;
        break;
      }
    }
  }
  return src.slice(idx, i);
}

// ---- 1) Spawn: Manhattan levels get a pizza-carrying rat with 25% probability --
const spawnIdx = src.indexOf('Manhattan Pizza Rat');
check('Manhattan pizza rat spawn block exists', spawnIdx >= 0);
const spawnBlock = spawnIdx >= 0 ? src.slice(spawnIdx, spawnIdx + 1200) : '';
check('spawn block is Manhattan-gated with 25% chance', spawnBlock.indexOf('isManhattanLevel() && Math.random() < 0.25') >= 0);
check('spawn block builds the pizza rat with makeRat(true)', spawnBlock.indexOf('makeRat(true)') >= 0);
check('pizza model is re-attached to the creature (remove + swap + add)', spawnBlock.indexOf('dynamicGroup.remove(pizzaRat.g)') >= 0 && spawnBlock.indexOf('pizzaRat.g = pizzaModel') >= 0 && spawnBlock.indexOf('dynamicGroup.add(pizzaRat.g)') >= 0);
check('pizza rat spawns on the sidewalk near the player path (wy 2.0-3.5)', /pizzaRat\.wy = R\(2\.0, 3\.5\)/.test(spawnBlock));

// ---- 2) Slice: big, flat, at the mouth, clear of the ground ----------------
const ratSrc = extractFn('makeRat');
check('makeRat still takes the pizza flag', ratSrc.indexOf('function makeRat(pizza)') === 0);
check('slice built from flat extruded wedges (Shape + ExtrudeGeometry)', ratSrc.indexOf('new THREE.Shape()') >= 0 && ratSrc.indexOf('new THREE.ExtrudeGeometry(') >= 0);
check('wedges are NOT rotated up/tilted (flat, thickness straight up)', !/dough\.rotation\.[xyz]\s*=/.test(ratSrc) && !/cheese\.rotation\.[xyz]\s*=/.test(ratSrc));
check('crust is a SOLID thin box (raised rim, not a hollow torus ring)', /crustThick\s*=\s*0\.03/.test(ratSrc) && /BoxGeometry\(crustThick, sliceW \* 2, crustHeight\)/.test(ratSrc));

const num = (re) => {
  const m = ratSrc.match(re);
  return m ? parseFloat(m[1]) : NaN;
};
const tipX = num(/tipX = ([0-9.]+)/);
const sliceL = num(/sliceL = ([0-9.]+)/);
const sliceW = num(/sliceW = ([0-9.]+)/);
const zBase = num(/zBase = ([0-9.]+)/);
const crustLift = num(/crust\.position\.set\(tipX \+ sliceL, 0, zBase \+ ([0-9.]+)\)/);
check('tip starts at the mouth (nose is at x=0.42)', tipX >= 0.4 && tipX <= 0.46, 'tipX=' + tipX);
check('slice is COMICALLY BIG (length >= 0.3, ~2x the rat body)', sliceL >= 0.3, 'sliceL=' + sliceL);
check('slice is wide at the crust (half-width >= 0.12)', sliceW >= 0.12, 'sliceW=' + sliceW);
check(
  'lowest slice point clears the road top (zBase >= 0.018 -> world >= 0.318 > 0.30)',
  isFinite(zBase) && zBase >= 0.018,
  'floor=' + zBase,
);

// ---- 3) Build the rat and measure every part's local position ---------------
function buildRat(withPizza) {
  const parts = [];
  function makeV3() {
    const v = { x: 0, y: 0, z: 0 };
    v.set = function (x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      parts.push({ x: x, y: y, z: z });
      return this;
    };
    return v;
  }
  const Mesh = function () {
    this.position = makeV3();
    this.scale = { x: 1, y: 1, z: 1, set: function () { return this; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.castShadow = false;
  };
  const Group = function () {
    this.children = [];
    this.add = (c) => this.children.push(c);
  };
  const THREE = {
    Group: Group,
    Mesh: Mesh,
    Shape: function () {
      this.moveTo = () => {};
      this.lineTo = () => {};
      this.absarc = () => {};
      this.closePath = () => {};
    },
    ExtrudeGeometry: function () {},
    TorusGeometry: function (r, t) {
      this.r = r;
      this.t = t;
    },
    SphereGeometry: function () {},
    BoxGeometry: function () {},
    CylinderGeometry: function () {},
    ConeGeometry: function () {},
    TubeGeometry: function () {},
    CatmullRomCurve3: function (pts) {
      this.pts = pts;
    },
    Vector3: function (x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    },
  };
  const M = (c) => ({ color: c });
  const SPH = (r, m) => new Mesh();
  const BX = (w, h, d, m) => new Mesh();
  const CY = (a, b, h, m) => new Mesh();
  const factory = new Function('THREE', 'M', 'SPH', 'BX', 'CY', ratSrc + '\nreturn makeRat;');
  parts.length = 0;
  const g = factory(THREE, M, SPH, BX, CY)(withPizza);
  return { g: g, parts: parts.slice() };
}

// ---- REAL-SLICE checks: correct colors + a SOLID body (no see-through) ------
// The slice must be built from a SOLID full-footprint base wedge (inset 1.0).
// That one closed solid is what makes the slice opaque, so you can NEVER see
// through it to the sidewalk (the old three thin near-co-planar caps did).
check('solid full-footprint base body exists (wedge inset 1.0) -> opaque, not see-through', /wedge\(1\.0,/.test(ratSrc));
check('sauce is a red inset cap (0xc0392b)', /0xc0392b/.test(ratSrc));
check('cheese is YELLOW (0xf1c243) — melted golden, not white', /0xf1c243/.test(ratSrc));
check('brown cheese BITS are present (0xb5773a)', /0xb5773a/.test(ratSrc));
check('crust/base is TAN (0xc49a4a)', /0xc49a4a/.test(ratSrc));
check('pepperoni is BROWN (0x6b4423)', /0x6b4423/.test(ratSrc));
check('the old WHITE cheese (0xf7f4ea) and old RED pepperoni (0xb83a2a) are gone', !/0xf7f4ea/.test(ratSrc) && !/0xb83a2a/.test(ratSrc));

const plain = buildRat(false);
const pz = buildRat(true);
check('plain rat builds (15 parts, no slice)', plain.g.children.length === 15, 'children=' + plain.g.children.length);
check('pizza rat carries a slice (19 extra parts: base, sauce, cheese, crust, 6 pepperoni, 9 brown bits)', pz.g.children.length === 15 + 19, 'children=' + pz.g.children.length);

// Every part (rat + slice) must sit at/above the local ground-clearance floor
// (0.018 above the group origin = 0.318 world > 0.30 road top).
const offenders = pz.parts.filter((p) => p.z < 0.018);
check('no slice part clips below the sidewalk/street top (all z >= 0.018)', offenders.length === 0, 'offenders=' + JSON.stringify(offenders));

// The slice must reach far FORWARD of the mouth (comically long, not a sliver).
// The CRUST arc is the single part furthest forward (centre at x = tipX+sliceL).
const furthest = pz.parts.reduce((a, b) => (b.x > a.x ? b : a), pz.parts[0]);
check('crust sits far ahead of the mouth (x >= 0.8 -> slice ~2x rat length)', furthest.x >= 0.8, 'crust x=' + furthest.x);
// Toppings = 6 pepperoni (z=0.07) + 9 brown bits (z=0.076) — the last 15 parts,
// all resting on the yellow cheese top (z in the 0.06..0.08 band).
const tops = pz.parts.slice(-15);
check('pepperoni + brown bits rest on the cheese top (last 15 parts, z in 0.06..0.08 band)', tops.length === 15 && tops.every((p) => p.z >= 0.06 && p.z <= 0.08), 'top z=' + JSON.stringify(tops.map((p) => +p.z.toFixed(3))));

console.log(ok ? '\nPIZZA RAT CHECKS PASSED' : '\nPIZZA RAT CHECKS FAILED');
process.exit(ok ? 0 : 1);

check(
  'lowest slice point clears the road top (zBase - crust sag >= 0.018 -> world >= 0.318 > 0.30)',
  isFinite(zBase) && Math.min(zBase, zBase + crustLift - crustTube) >= 0.018,
  'floor=' + (zBase + crustLift - crustTube),
);
