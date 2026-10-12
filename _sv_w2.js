// _sv_w2.js — THE LEGS, oriented the way every other level orients them.
//
// The rig (buildWorker, the one worker used by ALL levels): the legs hang at pivots
// (0, side*0.13, 0.78) — the feet are separated along local Y, so local Y is his SIDEWAYS and
// local X is his FORWARD. Which makes, in that rig:
//     leg.rotation.y  ->  the FORE/AFTER stride (what the walk cycle uses on every level:
//                         legL.rotation.y = s, legR.rotation.y = -s, amp up to 0.7 rad)
//     leg.rotation.x  ->  a SIDEWAYS tip: the foot leaves the stride plane and goes out to the
//                         side. Two legs, opposite signs = a SPLIT.
// The shovel swing had been built on rotation.x (my previous pass wrote the stride "sagittal"
// and, in this axis layout, put it on the sideways-tilt axis — that is the split the player is
// looking at). It also sank worker.group straight into the world, which is a lift, not a
// weight shift.
//
// Now: the swing adds ONLY fore/aft stride on rotation.y — the leading leg (the same
// sin(p.phase) sign the gait uses) reaches farther forward, the trailing leg farther back,
// amplitude 0.46 / -0.34 over the peak — the weight shifts FORWARD along local +x, and the
// chest tips over the blade. No leg ever touches rotation.x while swinging, the legs stay in
// the street's plane, and the group's z (the ground) is never rewritten by the swing.
const fs = require('fs');
const P = 'index.html';
let html = fs.readFileSync(P, 'utf8');
const EOL = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const nl = (s) => s.replace(/\r?\n/g, EOL);
function edit(name, needle, repl) {
  const a = nl(needle), b = nl(repl);
  const n = html.split(a).length - 1;
  if (n !== 1) throw new Error(name + ': anchor matched ' + n + ' times');
  html = html.replace(a, b);
  console.log('patched: ' + name);
}

const OLD = nl(`        // THE BODY DOES THE WORK, and it works in the SAGITTAL plane. A shovel swing is not
        // a wrist flick: his front leg REACHES FORWARD into the throw, his back leg trails
        // behind it with the toe pushed off the ground, his hips sink into the plant and his
        // chest tips over the blade. Everything the swing adds to the legs is therefore a
        // FORE/AFTER tilt (rotation.x) and NEVER a sideways yaw (rotation.y) — in this rig a
        // leg's rotation.y swings the foot out to his side, so a swing built on it reads as a
        // SPLIT with the legs thrown 26 degrees apart, not a stride. The walk cycle keeps its
        // own strut on the yaw axis (that is a gait, and it is alternated per leg); the swing
        // leaves it alone. Runs off the same amplitude the arms are posed on (set the previous
        // frame), so arms, legs and the tool are always in the same part of the swing.
        if (shovelGroup && shovelStride > 0) {
          wparts.legL.rotation.x += 0.34 * shovelStride; // front leg: foot forward, heel down
          wparts.legR.rotation.x -= 0.3 * shovelStride; // back leg: trails, toe on the asphalt
          if (p.stunT <= 0 && shovelLean > 0)
            worker.group.rotation.x = -shovelLean; // chest over the blade, on the hit
          worker.group.position.z -= 0.07 * shovelStride; // ...and the weight sinks with it
        }`);
const NEW = nl(`        // THE BODY DOES THE WORK, on the SAME axes every other level's gait uses. This rig
        // hangs its legs at pivots (0, side*0.13, 0.78): the feet are separated along LOCAL Y,
        // so local Y is his SIDEWAYS and local X is his FORWARD — which makes rotation.y the
        // FORE/AFT STRIDE (that is what the walk cycle drives: legL.rotation.y = s,
        // legR.rotation.y = -s), and rotation.x a SIDEWAYS TIP (the foot leaving the stride
        // plane). A swing built on rotation.x throws one foot out to each side in opposite
        // directions and reads as a SPLIT, so the swing adds stride on rotation.y ONLY: the
        // same leading-leg sign the gait is already running (sin(p.phase) > 0 -> left leg
        // forward) reaches farther into the throw, the trailing leg trails farther behind, the
        // weight shifts FORWARD (local +x) onto that planted foot, and the chest tips over the
        // blade. Legs stay in the plane of the street; the ground (worker.group z) is never
        // rewritten here, and a leg pivot is never tilted sideways while swinging.
        if (shovelGroup && shovelStride > 0) {
          const swS = shovelStride;
          const lead = Math.sin(p.phase) > 0 ? wparts.legL : wparts.legR;
          const trail = lead === wparts.legL ? wparts.legR : wparts.legL;
          lead.rotation.y += 0.46 * swS; // the front foot reaches forward into the throw
          trail.rotation.y -= 0.34 * swS; // ...the back foot trails, toe pushing off the asphalt
          wparts.group.position.x += 0.06 * swS; // the weight goes onto the front foot (+x = forward)
          if (p.stunT <= 0 && shovelLean > 0)
            worker.group.rotation.x = -shovelLean; // chest over the blade, on the hit
        }`);
if (!html.includes(OLD)) throw new Error('the shipped swing block does not match the anchor');
html = html.replace(OLD, NEW);
fs.writeFileSync(P, html, 'utf8');
console.log('INDEX WRITTEN');
