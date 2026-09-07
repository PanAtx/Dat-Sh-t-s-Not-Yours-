// _hopper_burst_chk.js — smoke-test spawnHopperBurst(): it must emit a gross, varied
// shower (dust puffs, tumbling debris, maggots, hopper-juice, brown goo) that rides the
// dust-particle pipeline with an ELEVATED emitter (p.bz) so bits pop out of the hopper
// mouth and rain back down to the street.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const s = html.indexOf('function spawnHopperBurst');
if (s < 0) throw new Error('spawnHopperBurst not found in index.html');
const e = html.indexOf('\nfunction ', s + 1);
if (e < 0) throw new Error('end of spawnHopperBurst not found');
const code = html.slice(s, e);

// --- minimal THREE / world stubs (enough to run the spawner and inspect its output) ---
let planeCount = 0, boxCount = 0, sphereCount = 0;
const THREE = {
  DoubleSide: 2,
  Group: class { constructor(){ this.children = []; this.position = { set(){} }; } add(c){ this.children.push(c); } },
  Mesh: class { constructor(g, m){ this.geometry = g; this.material = m; } },
  PlaneGeometry: class { constructor(w, h){ this.kind = 'plane'; planeCount++; } },
  BoxGeometry: class { constructor(a, b, c){ this.kind = 'box'; boxCount++; } },
  SphereGeometry: class { constructor(r){ this.kind = 'sphere'; sphereCount++; } },
  MeshLambertMaterial: function(o){ this.color = o.color; this.transparent = !!o.transparent; this.opacity = o.opacity; this.side = o.side; }
};
const dynamicGroup = { add(){} };
const dustParticles = [];
const pick = (arr) => arr[0];                       // deterministic — good enough for a smoke test
const R = (a, b) => a + (b - a) * 0.5;               // midpoint, always a finite number
const hopperTopZ = () => 2.4;
const GZ = 0.01;

const spawnHopperBurst = new Function('THREE', 'dynamicGroup', 'dustParticles', 'pick', 'R', 'hopperTopZ', 'GZ',
  code + '\n;return spawnHopperBurst;')(THREE, dynamicGroup, dustParticles, pick, R, hopperTopZ, GZ);

// Fire a full-intensity burst plus the lighter start/trickle intensities used in the game.
spawnHopperBurst(-30, -4.5, 1.0);
spawnHopperBurst(-30, -4.5, 0.7);
spawnHopperBurst(-30, -4.5, 0.14);

let ok = true;
const check = (label, cond, info) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (cond ? '' : '  [' + info + ']')); if (!cond) ok = false; };

check('spawner runs and pushes bits into the dust pipeline', dustParticles.length > 0, 'count=' + dustParticles.length);
check('every bit uses an ELEVATED emitter (p.bz set)', dustParticles.every(p => p.bz != null), 'some bit missing bz');
check('emitter is above the street (bz > GZ)', dustParticles.every(p => p.bz > GZ), 'a bit sits at/below the street');
check('bits start near the hopper mouth (wx/wy finite)', dustParticles.every(p => isFinite(p.wx) && isFinite(p.wy)), 'non-finite x/y');
check('has AIR/DUST puffs (translucent planes)', planeCount > 0, 'planeCount=' + planeCount);
check('has tumbling DEBRIS (boxes)', boxCount > 0, 'boxCount=' + boxCount);
check('has JUICE/GOO drops (spheres)', sphereCount > 0, 'sphereCount=' + sphereCount);
check('every bit has full motion state (vx,vy,vz,life,decay,rotSpeed)', dustParticles.every(p =>
  isFinite(p.vx) && isFinite(p.vy) && isFinite(p.vz) && isFinite(p.life) && isFinite(p.decay) && isFinite(p.rotSpeed) && p.life > 0), 'incomplete record');
check('pop-out starts upward (vz > 0 on at least half the bits)', dustParticles.filter(p => p.vz > 0).length >= dustParticles.length / 2, 'too few upward');

console.log(ok ? '\nHOPPER BURST ALL CHECKS PASS (' + dustParticles.length + ' bits: ' + planeCount + ' dust, ' + boxCount + ' debris, ' + sphereCount + ' goo)'
               : '\nHOPPER BURST FAILURES');
process.exit(ok ? 0 : 1);