// _truck_logic_chk.js — unit-test the canBackUp() + updateTruck() follow logic
// in isolation, against the user's rules:
//   1. Truck keeps its rear (hopper) near the worker; creeps forward slowly,
//      stops in a dead zone.
//   2. Back-up ONLY when worker is in the street (not sidewalk) AND laterally
//      left/right of the truck; forward ALWAYS allowed.
const assert = require('assert');

function makeWorld(p, truck) {
  const code = `
  const RUN_SPEED = 8.5;
  function canBackUp(){
    if (!p) return false;
    const lw = (truck.boxW != null) ? truck.boxW : 1.9;
    const inStreet  = p.wy > -10 && p.wy < -0.3;
    const leftSide  = p.wy < -4.5 - lw - 0.3;
    const rightSide = p.wy > -4.5 + lw + 0.3;
    return inStreet && (leftSide || rightSide);
  }
  function updateTruck(dt){
    const hopperOff = (truck.hopperOff != null) ? truck.hopperOff : -4.3;
    const rearX  = truck.wx + hopperOff;
    const target = 1.5;
    const err = rearX - (p.wx + target);
    const DEAD = 0.8;
    const MAXSP = RUN_SPEED;
    let sp = 0;
    if (Math.abs(err) > DEAD){
      const v = Math.min(MAXSP, (Math.abs(err) - DEAD) * 2.0);
      if (err < 0){ sp = v; }
      else if (canBackUp()){ sp = -v; }
    }
    truck.sp = sp;
    if (Math.abs(err) > 40){
      truck.wx = p.wx + target - hopperOff;
    } else {
      truck.wx += sp * dt;
    }
  }
  return { canBackUp, updateTruck };
  `;
  return new Function('p', 'truck', code)(p, truck);
}

let pass = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { console.error(' FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; }
}

const truck = { wx: 0, hopperOff: -4.3, boxW: 1.9, boxL: 4.0 };
const p = { wx: 0, wy: 0 };
const { canBackUp, updateTruck } = makeWorld(p, truck);
const rear = () => truck.wx + truck.hopperOff;
let t = 0;
function step(n = 100, dt = 0.05) { for (let i = 0; i < n; i++) { updateTruck(dt); } }

check('back-up gate: worker on sidewalk -> blocked', () => {
  truck.wx = 10; p.wx = 0; p.wy = 1; // rear ahead of worker, worker on sidewalk
  assert.strictEqual(canBackUp(), false, 'canBackUp should be false on sidewalk');
});
check('back-up gate: worker in truck lane -> blocked', () => {
  truck.wx = 10; p.wx = 0; p.wy = -4.5;
  assert.strictEqual(canBackUp(), false, 'worker directly in truck lane -> no back-up');
});
check('back-up gate: worker on street, near side -> allowed', () => {
  truck.wx = 10; p.wx = 0; p.wy = -1.8;
  assert.strictEqual(canBackUp(), true, 'worker left/right in street -> back-up allowed');
});
check('back-up gate: worker on street, far side -> allowed', () => {
  truck.wx = 10; p.wx = 0; p.wy = -8;
  assert.strictEqual(canBackUp(), true);
});
check('truck backs up only when allowed (street, left/right)', () => {
  truck.wx = 10; p.wx = 0; p.wy = -1.8; // rear ahead, back-up allowed
  step(10);
  assert.ok(rear() < 10 - 0.5, 'rear advanced backward: ' + rear());
});
check('truck HOLDS on sidewalk when rear is ahead (no back-up, no forward)', () => {
  truck.wx = 10; p.wx = 0; p.wy = 1; // rear ahead, back-up blocked
  const before = truck.wx;
  step(20);
  assert.strictEqual(truck.wx, before, 'truck must not move at all while back-up blocked');
});
check('truck ALWAYS drives forward when rear is behind worker (even on sidewalk)', () => {
  truck.wx = -12; p.wx = 0; p.wy = 1; // rear far behind
  step(50);
  assert.ok(rear() > -10, 'rear moved forward toward worker: ' + rear());
});
check('truck converges into dead zone and stops (worker idle on sidewalk)', () => {
  truck.wx = -12; p.wx = 0; p.wy = 0; // rear behind
  step(300);
  const g = truck.wx;
  step(300); // run more: should no longer move
  assert.ok(Math.abs(rear() - (p.wx + 1.5)) <= 0.8001, 'settled inside/at dead zone, rear=' + rear());
  const g2 = truck.wx;
  step(300);
  assert.strictEqual(truck.wx, g2, 'stopped inside dead zone (no more creep-forward)');
});
check('forward creep is not fast: speed capped + eases off', () => {
  truck.wx = -60; p.wx = 0; p.wy = 3;
  updateTruck(0.05);
  assert.ok(truck.sp <= 8.5, 'sp ' + truck.sp);
  truck.wx = 4.8; p.wx = 0; p.wy = 3; // close in: rear at +0.5, err = -1.0 (just outside dead zone)
  updateTruck(0.05);
  assert.ok(truck.sp < 2.0, 'creep eases off near target: sp=' + truck.sp);
});
console.log('\n' + pass + ' logic checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));
