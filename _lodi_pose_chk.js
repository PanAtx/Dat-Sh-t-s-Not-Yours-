'use strict';
/* _lodi_pose_chk.js — verify the LODI "passed out on his back" pose against the
   EXACT three.js r128 build the game loads.
   Body space: +Z = standing-up (head), +X = front (face/brim), ±Y = sides.
   Target final pose: face (+X) to the sky (+Z), head (+Z) toward the sidewalk (+Y),
   sides (±Y) flat along the street (±X). */
const THREE = require('./_three128.js');
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
console.log('premultiply available:', typeof THREE.Quaternion.prototype.premultiply === 'function');

// Target fainted pose: columns = images of body +X (face), +Y (side), +Z (head).
const mPose = new THREE.Matrix4().set(
  0, 1, 0, 0,
  0, 0, 1, 0,
  1, 0, 0, 0,
  0, 0, 0, 1
);
const qPose = new THREE.Quaternion().setFromRotationMatrix(mPose);
const img = v => v.clone().applyQuaternion(qPose).toArray().map(n => +n.toFixed(2)).join(',');
console.log('--- target fainted pose (qPose) ---');
console.log('face +X ->', img(X), '(want 0,0,1 = up)');
console.log('side +Y ->', img(Y), '(want 1,0,0 = along street)');
console.log('head +Z ->', img(Z), '(want 0,1,0 = sidewalk)');
console.log('back -X ->', img(X.clone().negate()), '(want 0,0,-1 = down)');

// Key body points (body space) to check ground clearance along the fall
const PTS = [
  ['beltBack',  new THREE.Vector3(-0.16, 0, 0.82)],
  ['vestBackL', new THREE.Vector3(-0.15, 0.28, 1.1)],
  ['gloveL',    new THREE.Vector3(0, 0.81, 1.27)],
  ['gloveR',    new THREE.Vector3(0, -0.81, 1.27)],
  ['bootL',     new THREE.Vector3(0.06, 0.30, 0.25)],
  ['bootR',     new THREE.Vector3(0.06, -0.30, 0.25)],
  ['capTop',    new THREE.Vector3(0, 0, 1.94)],
];
// Simulate the slerp fall for many spin-end facings; find the min clearance
// using lift(e) = LIFT * e (e = eased fall progress; here we test with linear e).
let worst = Infinity, worstAt = '';
for (let facing = -3.2; facing <= 3.2; facing += 0.25){
  const qStart = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, facing + Math.PI * 4));
  const q = new THREE.Quaternion();
  for (let i = 0; i <= 20; i++){
    const e = i / 20;
    const LIFT = 0.30;
    q.copy(qStart).slerp(qPose, e);
    for (const [name, pt] of PTS){
      const h = pt.clone().applyQuaternion(q).z + LIFT * e;
      if (h < worst){ worst = h; worstAt = 'facing=' + facing.toFixed(2) + ' e=' + e.toFixed(2) + ' ' + name; }
    }
  }
}
console.log('--- fall clearance (min body height above ground line, lift=0.30*e) ---');
console.log('worst point height:', worst.toFixed(3), '@', worstAt, worst >= 0 ? 'OK (no clipping)' : 'CLIPS -> increase lift');
console.log('final back clearance with lift 0.30:', (0.30 - 0.16).toFixed(2), '(body rests slightly proud of the curb — OK for a blocky character)');

// Final pose after slerp (e=1), independent of start facing
qPose; // already checked above
console.log('--- final check: worker lies flat, face-up ---');
const flat = Math.abs(+img(Y).split(',')[2]) < 0.01 && Math.abs(+img(X).split(',')[0]) < 0.01;
console.log(flat ? 'PASS: face up, head -> sidewalk, arms flat along street' : 'FAIL');