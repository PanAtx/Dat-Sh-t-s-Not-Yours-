// _truck_logic_chk.js — unit-test the canBackUp() + updateTruck() follow logic
// in isolation, against the user's rules:
//   1. Truck keeps its rear (hopper) near the worker; creeps forward slowly,
//      stops in a dead zone.
//   2. Back-up ONLY when worker is in the street (not sidewalk) AND laterally
//      left/right of the truck; forward ALWAYS allowed.
const assert = require('assert');

function makeWorld(p, truck) {
  const code = `
  const PLAYER_SPEED = 10;
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
    const target = 4.1; // carry state (game: 3.6 empty-handed / 4.1 carrying)
    const backTarget = 1.5; // back-up rest position ("just ahead of the worker")
    const DEAD = 0.8;
    const MAXSP = PLAYER_SPEED;
    if (truck._mode == null) truck._mode = "follow";
    let sp = 0;
    if (truck._mode === "close"){
      const backErr = rearX - (p.wx + backTarget);
      if (backErr > DEAD){ if (canBackUp()){ sp = -Math.min(MAXSP, (backErr - DEAD) * 2.0); } }
      else if (backErr < -DEAD){ sp = Math.min(MAXSP, (-backErr - DEAD) * 2.0); truck._mode = "follow"; }
    } else {
      const fwdErr = rearX - (p.wx + target);
      if (fwdErr < -DEAD){ sp = Math.min(MAXSP, (-fwdErr - DEAD) * 2.0); }
      else if (fwdErr > DEAD && canBackUp()){ sp = -Math.min(MAXSP, (fwdErr - DEAD) * 2.0); truck._mode = "close"; }
    }
    truck.sp = sp;
    if (p.wx + backTarget - rearX > 40){
      truck.wx = p.wx + target - hopperOff;
      truck._mode = "follow";
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
  truck._mode = 'follow';
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
  truck._mode = 'follow';
  step(300);
  const g = truck.wx;
  step(300); // run more: should no longer move
  assert.ok(Math.abs(rear() - (p.wx + 4.1)) <= 0.8001, 'settled inside/at dead zone, rear=' + rear());
  const g2 = truck.wx;
  step(300);
  assert.strictEqual(truck.wx, g2, 'stopped inside dead zone (no more creep-forward)');
});
check('forward creep is not fast: speed capped + eases off', () => {
  truck.wx = -60; p.wx = 0; p.wy = 3;
  updateTruck(0.05);
  assert.ok(truck.sp <= 10, 'sp ' + truck.sp);
  truck.wx = 7.4; p.wx = 0; p.wy = 3; // close in: rear at +3.1, err = -1.0 (just outside dead zone)
  updateTruck(0.05);
  assert.ok(truck.sp < 2.0, 'creep eases off near target: sp=' + truck.sp);
});
check('back-up stops JUST AHEAD of the worker (not at the forward target)', () => {
  truck.wx = 20; p.wx = 0; p.wy = -1.8; // rear far ahead, worker in street -> back-up allowed
  truck._mode = 'follow';
  step(500);
  assert.ok(rear() <= p.wx + 1.5 + 0.8001 && rear() > p.wx + 1.5 - 0.01, 'stopped just ahead of worker: rear=' + rear());
  assert.ok(rear() < p.wx + 3.0, 'did NOT stop at the forward target (4.1): rear=' + rear());
  const g = truck.wx;
  step(200);
  assert.strictEqual(truck.wx, g, 'stopped at the back-up rest position (no more creep)');
});
check('forward rest position HOLDS (no spurious back-up on its own)', () => {
  truck.wx = 8.4; p.wx = 0; p.wy = -1.8; // rear at +4.1 (the forward target), worker in street
  truck._mode = 'follow';
  const before = truck.wx;
  step(100);
  assert.strictEqual(truck.wx, before, 'truck must hold at the forward rest position');
});
check('close rest position HOLDS (rear just ahead, worker in street)', () => {
  truck.wx = 6.6; p.wx = 0; p.wy = -1.8; // rear at +2.3 (backTarget + dead zone edge)
  truck._mode = 'close';
  const before = truck.wx;
  step(100);
  assert.strictEqual(truck.wx, before, 'truck must hold at the "just ahead" rest position');
});
check('after a back-up, worker pulls ahead -> FULL forward gap restored (not the tight close gap)', () => {
  truck.wx = 6.6; p.wx = 0; p.wy = -1.8; // rear at +2.3, close mode (fresh off a back-up)
  truck._mode = 'close';
  p.wx = 10; // worker walks ahead to grab the next bag
  step(500);
  assert.ok(truck._mode === 'follow', 'mode must return to follow: ' + truck._mode);
  assert.ok(Math.abs(rear() - (p.wx + 4.1)) <= 0.8001, 'rear restored to the full forward gap: rear=' + rear());
});
console.log('\n' + pass + ' logic checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));
