// _si_carwash_chk.js — verify the Staten Island (New Dorp, day 5) CAR WASH in
// index.html — a parked sedan in a Block 2 driveway + the guy washing it with a
// hose who sprays the worker when he gets too close:
//   - parked car: car.glb template (traffic pipeline), ROTATED nose-to-street
//     (rotation.z = 0, NOT the PI/2 traffic rotation) and SCALED (0.9, a big sedan)
//     to fit the 3.0u-wide driveway slab; procedural box-sedan fallback; GLTF hot-swap
//   - parked spot: Block 2 (the second block), center driveway x = 96 + 8*5 = 136,
//     y 6.0 on the slab top, SI-gated only, driveway reserved from the doghouse
//     pool, SOLID push-out hazard (no walking through the car)
//   - carwasher NPC: static (stays put), makePerson + FIXED bucket/sponge (their own
//     group — they do not rotate with him) + THICK GREEN GARDEN HOSE from a loose
//     end lying on the front lawn (no spigot post), SNAKE-LIKE (gentle cubic S-bend +
//     droop + sway) and ending at a dark COUPLING collar parented to his fist (z -0.40,
//     at the back of the nozzle grip — the hose is always visibly in his hand; the jet
//     leaves the nozzle tip at z -0.66) + spray cone (apex at the nozzle, WIDE base
//     toward the worker); MALE gender
//   - a PUDDLE (translucent blue discs) sits on the sidewalk in front of the parked car
//   - spray: worker inside CARWASH_SPRAY_R of the washer -> HP_HIT_CARWASH +
//     knockback + hose SFX + blue splash + lines; MID-BLAST RAISES the arm at the
//     worker (rotation.y = -1.8, two-handed grip) with a CONTINUOUS water-jet
//     particle stream out of the nozzle (CD-gated, i-frame safe)
//     ("Don't touch the car!" / "Get away from the car!")
//   - bump: arcade bump (1HP) "Watch the hose!", collision radius 0.85,
//     flying-can hittable, pedestrians route around him (AVOID_TYPES)
//   - WRITTEN UP!: "Failed to clean the route or car"
//   - SFX.playHoseSplash + spawnWaterSplash + spawnWaterJet
'use strict';
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

// 1) all inline scripts still parse
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m,
  n = 0,
  ok = true;
while ((m = re.exec(src))) {
  n++;
  try {
    new vm.Script(m[1], { filename: "inline" + n + ".js" });
  } catch (e) {
    ok = false;
    console.log("SYNTAX FAIL script #" + n + ": " + e.message);
  }
}
console.log(
  "inline scripts checked: " + n + (ok ? " — ALL SYNTAX OK" : " — SYNTAX ERRORS"),
);

let pass = ok;
const check = (name, c, e) => {
  console.log((c ? "PASS" : "FAIL") + "  " + name + (c ? "" : "  [" + e + "]"));
  if (!c) pass = false;
};
const countLines = (i) => {
  const j = src.indexOf("];", i);
  return src
    .slice(i, j)
    .split("\n")
    .filter((l) => l.trim().startsWith('"')).length;
};

// ================= 1. LINE POOLS =================
check(
  "CARWASH_SPRAY_LINES: 5+ blasts fired when the worker gets sprayed",
  (() => {
    const i = src.indexOf("const CARWASH_SPRAY_LINES = [");
    return i >= 0 && countLines(i) >= 5;
  })()
);
check(
  'CARWASH_SPRAY_LINES: includes "Don\'t touch the car!" + "Get away from the car!"',
  (() => {
    const i = src.indexOf("const CARWASH_SPRAY_LINES = [");
    if (i < 0) return false;
    const seg = src.slice(i, i + 400);
    return (
      seg.indexOf("Don't touch the car!") >= 0 &&
      seg.indexOf("Get away from the car!") >= 0
    );
  })()
);
check(
  "CARWASH_WORKER_LINES: 4+ soaked yelps (worker side of the spray)",
  (() => {
    const i = src.indexOf("const CARWASH_WORKER_LINES = [");
    return i >= 0 && countLines(i) >= 4;
  })()
);
check(
  "CARWASH_LINES: 5+ idle car-talk lines (coupons, the 2008, the shine)",
  (() => {
    const i = src.indexOf("const CARWASH_LINES = [");
    if (i < 0) return false;
    const seg = src.slice(i, i + 600);
    return countLines(i) >= 5 && seg.indexOf("2008") >= 0;
  })()
);

// ================= 2. DAMAGE + RANGE =================
check(
  "HP_HIT_CARWASH = 3 (a soaking, lighter than the 5HP hazard nick)",
  /const HP_HIT_CARWASH = 3;/.test(src)
);
check(
  "CARWASH_SPRAY_R: the hose reach constant (worker gets sprayed this close)",
  /const CARWASH_SPRAY_R = 3\.2;/.test(src)
);

// ================= 3. THE PARKED CAR MODEL =================
check(
  "makeParkedCar exists (the driveway car builder)",
  src.indexOf("function makeParkedCar(") >= 0
);
check(
  "CARWASH_CAR_SCALE = 0.9 — a big sedan (4.2u long x 1.88u wide) that fits the 3.0u-wide driveway slab",
  /const CARWASH_CAR_SCALE = 0\.9;/.test(src)
);
check(
  "GLTF path: cloned from CAR_TPL with unique Body paint (same as traffic cars)",
  (() => {
    const i = src.indexOf("function makeParkedCar(");
    if (i < 0) return false;
    const seg = src.slice(i, i + 1200);
    return (
      seg.indexOf("CAR_TPL.template.clone(true)") >= 0 &&
      seg.indexOf('o.material.name === "Body"') >= 0
    );
  })()
);
check(
  "GLTF path: ROTATED nose-to-street (rotation.z = 0, NOT the PI/2 traffic rotation)",
  (() => {
    const i = src.indexOf("function makeParkedCar(");
    if (i < 0) return false;
    const seg = src.slice(i, i + 900);
    return seg.indexOf("model.rotation.z = 0") >= 0;
  })()
);
check(
  "GLTF path: SCALED with CARWASH_CAR_SCALE",
  (() => {
    const i = src.indexOf("function makeParkedCar(");
    if (i < 0) return false;
    const seg = src.slice(i, i + 900);
    return seg.indexOf("model.scale.setScalar(CARWASH_CAR_SCALE)") >= 0;
  })()
);
check(
  "procedural fallback: box sedan lengthwise along Y (nose at -Y = street) with 4 wheels",
  (() => {
    const i = src.indexOf("function makeParkedCar(");
    if (i < 0) return false;
    const seg = src.slice(i, i + 3000);
    return (
      seg.indexOf("CylinderGeometry(0.24, 0.24, 0.2, 12)") >= 0 &&
      seg.indexOf("rounded nose toward the street") >= 0
    );
  })()
);
check(
  "rebuildCarsFromGltf hot-swaps the parked car when the GLTF arrives late",
  (() => {
    const i = src.indexOf("function rebuildCarsFromGltf(");
    if (i < 0) return false;
    const seg = src.slice(i, i + 4400);
    return (
      seg.indexOf("parkedCar && !parkedCar.gltf") >= 0 &&
      seg.indexOf("makeParkedCar(parkedCar.colorHex)") >= 0
    );
  })()
);

// ================= 4. SPAWN: BLOCK 2 (THE SECOND BLOCK), CENTER DRIVEWAY =================
check(
  "spawn: gated on isStatenIslandLevel() (Staten Island only)",
  (() => {
    const i = src.indexOf("The Staten Island CAR WASH (New Dorp, day 5)");
    if (i < 0) return false;
    const seg = src.slice(i, i + 4400);
    return seg.indexOf("if (isStatenIslandLevel())") >= 0;
  })()
);
check(
  "spawn: the car is parked in the SECOND block (LEVEL_BLOCKS[1] = Block 2, x 96)",
  (() => {
    const i = src.indexOf("The Staten Island CAR WASH (New Dorp, day 5)");
    if (i < 0) return false;
    const seg = src.slice(i, i + 4400);
    return seg.indexOf("LEVEL_BLOCKS[1].x + 8 * 5") >= 0;
  })()
);
check(
  "spawn: the driveway slab is RESERVED (spliced out of flatbushDriveways — no doghouse/tric collision)",
  (() => {
    const i = src.indexOf("The Staten Island CAR WASH (New Dorp, day 5)");
    if (i < 0) return false;
    const seg = src.slice(i, i + 4400);
    return (
      seg.indexOf("flatbushDriveways.indexOf(carwashDrivewayX)") >= 0 &&
      seg.indexOf("flatbushDriveways.splice(reserved, 1)") >= 0
    );
  })()
);
check(
  "spawn: the washer stands on the street side of the car (x - 1.7, y 4.5)",
  (() => {
    const i = src.indexOf("The Staten Island CAR WASH (New Dorp, day 5)");
    if (i < 0) return false;
    const seg = src.slice(i, i + 4400);
    return (
      seg.indexOf("cw.wx = carwashDrivewayX - 1.7") >= 0 &&
      seg.indexOf("cw.wy = 4.5") >= 0
    );
  })()
);
check(
  "spawn: the car sits centered on the slab top (y 6.0, GZ + 0.04)",
  (() => {
    const i = src.indexOf("The Staten Island CAR WASH (New Dorp, day 5)");
    if (i < 0) return false;
    const seg = src.slice(i, i + 4400);
    return (
      seg.indexOf("cwCar.position.set(carwashDrivewayX, 6.0, GZ + 0.04)") >= 0 &&
      seg.indexOf("dynamicGroup.add(cwCar)") >= 0
    );
  })()
);
check(
  "spawn: the sedan registers a SOLID 'parkedcar' hazard (push-out, r 2.3)",
  (() => {
    const i = src.indexOf("The Staten Island CAR WASH (New Dorp, day 5)");
    if (i < 0) return false;
    const seg = src.slice(i, i + 4400);
    return (
      seg.indexOf('type: "parkedcar"') >= 0 &&
      seg.indexOf("r: 2.3") >= 0 &&
      seg.indexOf("b2record.hazards.push") >= 0
    );
  })()
);
check(
  "spawn: the hose anchor is a GROUND POINT on the front lawn (no spigot post, cw.hose.anchor set)",
  (() => {
    const i = src.indexOf("The Staten Island CAR WASH (New Dorp, day 5)");
    if (i < 0) return false;
    const seg = src.slice(i, i + 4400);
    return (
      seg.indexOf("carwashDrivewayX - 2.0") >= 0 &&
      seg.indexOf("cw.hose.anchor = { x: cwFaucetX, y: cwFaucetY, z: 0.36 }") >= 0 &&
      seg.indexOf("fpipe") < 0
    );
  })()
);
check(
  "spawn: a PUDDLE on the sidewalk in front of the parked car (translucent blue, y 0.5..5.0)",
  (() => {
    const i = src.indexOf("The Staten Island CAR WASH (New Dorp, day 5)");
    if (i < 0) return false;
    const seg = src.slice(i, i + 4400);
    return (
      seg.indexOf("0x4d9fc9") >= 0 &&
      seg.indexOf("puddle.position.set(carwashDrivewayX, 3.0, 0.32)") >= 0 &&
      seg.indexOf("puddle2.position.set(carwashDrivewayX - 1.1, 2.2, 0.32)") >= 0
    );
  })()
);

// ================= 5. ADDCREATURE CASE =================
check(
  'addCreature: case "carwasher" is STATIC (c.sp = 0, guards his driveway)',
  (() => {
    const i = src.indexOf('case "carwasher":');
    if (i < 0) return false;
    const seg = src.slice(i, i + 1400);
    return seg.indexOf("c.sp = 0") >= 0;
  })()
);
check(
  "addCreature: makePerson work-tee model + FIXED bucket group (not parented to his body)",
  (() => {
    const i = src.indexOf('case "carwasher":');
    if (i < 0) return false;
    const seg = src.slice(i, i + 5800);
    return (
      seg.indexOf("makePerson({") >= 0 &&
      seg.indexOf("CylinderGeometry(0.2, 0.16, 0.3, 10)") >= 0 &&
      seg.indexOf("const bucketG = new THREE.Group()") >= 0 &&
      seg.indexOf("bucketG.add(bucket)") >= 0 &&
      seg.indexOf("dynamicGroup.add(bucketG)") >= 0
    );
  })()
);
check(
  "addCreature: THICK GREEN GARDEN HOSE (10 unit segments, 0x2f7a3d) from the lawn spigot to his hand",
  (() => {
    const i = src.indexOf('case "carwasher":');
    if (i < 0) return false;
    const seg = src.slice(i, i + 5200);
    return (
      seg.indexOf("CylinderGeometry(0.055, 0.055, 1, 6)") >= 0 &&
      seg.indexOf("0x2f7a3d") >= 0 &&
      seg.indexOf("c.hose = { segs: [], anchor: null }") >= 0 &&
      seg.indexOf("c.hose.segs.push(hseg)") >= 0
    );
  })()
);
check(
  "addCreature: NO torus coil (the hose is a rope from the house, not a ring)",
  (() => {
    const i = src.indexOf('case "carwasher":');
    if (i < 0) return false;
    const seg = src.slice(i, i + 5200);
    const j = seg.indexOf("case \"crazy\":");
    return seg.indexOf("TorusGeometry") < 0 || (j >= 0 && seg.indexOf("TorusGeometry") > j);
  })()
);
check(
  "addCreature: nozzle in the right hand + spray cone (apex at the nozzle, WIDE base toward the worker)",
  (() => {
    const i = src.indexOf('case "carwasher":');
    if (i < 0) return false;
    const seg = src.slice(i, i + 6600);
    return (
      seg.indexOf("d.armR.add(nozzle)") >= 0 &&
      seg.indexOf("CylinderGeometry(0.065, 0.065, 0.12, 8)") >= 0 &&
      seg.indexOf("hosePt.position.set(0, -0.02, -0.4)") >= 0 &&
      seg.indexOf("jetPt.position.set(0, -0.02, -0.66)") >= 0 &&
      seg.indexOf("c.hosePt = hosePt") >= 0 &&
      seg.indexOf("c.jetPt = jetPt") >= 0 &&
      seg.indexOf("ConeGeometry(0.5, 1.6, 8, 1, true)") >= 0 &&
      seg.indexOf("d.armR.add(spray)") >= 0 &&
      seg.indexOf("c.spray = spray") >= 0 &&
      seg.indexOf("c.nozzle = nozzle") >= 0 &&
      seg.indexOf("spray.rotation.x = Math.PI / 2") >= 0 &&
      seg.indexOf("spray.position.set(0, -0.02, -1.3)") >= 0 &&
      seg.indexOf("spray.visible = false") >= 0
    );
  })()
);
check(
  "gender: carwasher is on the MALE voice list",
  (() => {
    const i = src.indexOf('type === "polishboy" ||');
    if (i < 0) return false;
    const seg = src.slice(i, i + 200);
    return seg.indexOf('type === "carwasher"') >= 0;
  })()
);

// ================= 6. UPDATE: THE SPRAY MECHANIC =================
const UMARK = "case \"carwasher\": {"; // updateCreatures case (the { distinguishes it from the addCreature case)
check(
  'updateCreatures: case "carwasher" turns to face the worker (atan2)',
  (() => {
    const i = src.indexOf(UMARK);
    if (i < 0) return false;
    const seg = src.slice(i, i + 2000);
    return seg.indexOf("c.g.rotation.z = Math.atan2(cdy, cdx)") >= 0;
  })()
);
check(
  "update: SCRUB animation — the hose arm sweeps over the panel when idle",
  (() => {
    const i = src.indexOf(UMARK);
    if (i < 0) return false;
    const seg = src.slice(i, i + 2600);
    return seg.indexOf("Math.sin(c.scrubT * 2.2)") >= 0;
  })()
);
check(
  "update: spray fires only in play, CD-gated, inside CARWASH_SPRAY_R, i-frame safe",
  (() => {
    const i = src.indexOf(UMARK);
    if (i < 0) return false;
    const seg = src.slice(i, i + 6300);
    return (
      seg.indexOf('state === "play"') >= 0 &&
      seg.indexOf("c.sprayCd <= 0") >= 0 &&
      seg.indexOf("cdist < CARWASH_SPRAY_R") >= 0 &&
      seg.indexOf("p.invuln <= 0") >= 0 &&
      seg.indexOf("p.immuneT <= 0") >= 0
    );
  })()
);
check(
  "update: the blast deals HP_HIT_CARWASH tagged 'carwasher' + light stun",
  (() => {
    const i = src.indexOf(UMARK);
    if (i < 0) return false;
    const seg = src.slice(i, i + 6500);
    return (
      seg.indexOf('hurtNPC(HP_HIT_CARWASH, "carwasher")') >= 0 &&
      seg.indexOf('doStun(0.3, "hit")') >= 0
    );
  })()
);
check(
  "update: the blast plays the hose SFX + splashes blue droplets + fires the WATER JET from the nozzle",
  (() => {
    const i = src.indexOf(UMARK);
    if (i < 0) return false;
    const seg = src.slice(i, i + 6800);
    return (
      seg.indexOf("SFX.playHoseSplash()") >= 0 &&
      seg.indexOf("spawnWaterSplash(p.wx, p.wy)") >= 0 &&
      seg.indexOf("spawnWaterJet(jp.x, jp.y, p.wx, p.wy)") >= 0
    );
  })()
);
check(
  "update: the blast knocks the worker back (clamped to the street floor)",
  (() => {
    const i = src.indexOf(UMARK);
    if (i < 0) return false;
    const seg = src.slice(i, i + 7600);
    return (
      seg.indexOf("p.wx += (cdx / kd) * 1.0") >= 0 &&
      seg.indexOf("clamp(p.wy + (cdy / kd) * 0.8, -9.4, workerMaxY())") >= 0
    );
  })()
);
check(
  "update: the spray cone is visible mid-blast, hidden while scrubbing",
  (() => {
    const i = src.indexOf(UMARK);
    if (i < 0) return false;
    const seg = src.slice(i, i + 2800);
    return (
      seg.indexOf("c.spray.visible = true") >= 0 &&
      seg.indexOf("c.spray.visible = false") >= 0
    );
  })()
);
check(
  "update: MID-BLAST raises the arm at the worker (rotation.y = -1.8) + continuous jet from the nozzle",
  (() => {
    const i = src.indexOf(UMARK);
    if (i < 0) return false;
    const seg = src.slice(i, i + 2400);
    return (
      seg.indexOf("c.parts.armR.rotation.y = -1.8") >= 0 &&
      seg.indexOf("c.parts.armL.rotation.y = -1.2") >= 0 &&
      seg.indexOf("spawnWaterJet(js.x, js.y, p.wx, p.wy, 2, js.z)") >= 0
    );
  })()
);
check(
  "update: the GARDEN HOSE is re-laid EVERY frame — gentle SNAKE cubic (S-bend + droop + sway) from the lawn INTO the coupling in his fist (floor kept above ground)",
  (() => {
    const i = src.indexOf(UMARK);
    if (i < 0) return false;
    const seg = src.slice(i, i + 5800);
    return (
      seg.indexOf("c.hose.anchor") >= 0 &&
      seg.indexOf("c.hosePt.getWorldPosition(hw)") >= 0 &&
      seg.indexOf("const sag = 0.2 + md * 0.3") >= 0 &&
      seg.indexOf("pdx * sAmp") >= 0 &&
      seg.indexOf("3 * u * t * t * B2") >= 0 &&
      seg.indexOf("Math.max(0.36, az - sag * 0.85)") >= 0 &&
      seg.indexOf("sg.quaternion.setFromUnitVectors(") >= 0 &&
      seg.indexOf("HOS_UP") >= 0
    );
  })()
);
check(
  "update: idle car talk in earshot (cdist < 14, 6-11s cooldown)",
  (() => {
    const i = src.indexOf(UMARK);
    if (i < 0) return false;
    const seg = src.slice(i, i + 7800);
    return (
      seg.indexOf("cdist < 14") >= 0 &&
      seg.indexOf("c.sayCd = R(6, 11)") >= 0 &&
      seg.indexOf("pick(CARWASH_LINES)") >= 0
    );
  })()
);

// ================= 7. SOLID CAR (collideStatic) =================
check(
  "collideStatic: 'parkedcar' is SOLID (continuous push-out from any side, no damage)",
  (() => {
    const i = src.indexOf('hz.type === "parkedcar"');
    if (i < 0) return false;
    const seg = src.slice(i, i + 1400);
    return seg.indexOf("const push = hz.r - d") >= 0 && seg.indexOf("continue") >= 0;
  })()
);
check(
  'collideStatic: clipping the parked car gets a "parked car" yelp (CD-gated)',
  (() => {
    const i = src.indexOf('hz.type === "parkedcar"');
    if (i < 0) return false;
    const seg = src.slice(i, i + 1400);
    return seg.indexOf("That's a parked car, pal!") >= 0;
  })()
);

// ================= 8. BUMP / FLYING CAN / AVOID =================
check(
  "collideCreatures: carwasher collision radius 0.85",
  /c\.type === "carwasher"\) rad = 0\.85;/.test(src)
);
check(
  "collideCreatures: carwasher is in the ARCADE BUMP civilian list",
  (() => {
    const i = src.indexOf("ARCADE BUMP");
    if (i < 0) return false;
    const seg = src.slice(i - 700, i);
    return seg.indexOf('c.type === "carwasher"') >= 0;
  })()
);
check(
  'collideCreatures: bumping him -> "Hey! Watch the hose!" + worker "Sorry, buddy!"',
  (() => {
    const i = src.indexOf("else if (c.type === \"carwasher\") {");
    if (i < 0) return false;
    const seg = src.slice(i, i + 1200);
    return seg.indexOf("Hey! Watch the hose!") >= 0 && seg.indexOf("Sorry, buddy!") >= 0;
  })()
);
check(
  "flying cans can bonk the carwasher (checkFlyingCanNpcHit list)",
  (() => {
    const i = src.indexOf("function checkFlyingCanNpcHit(");
    if (i < 0) return false;
    const seg = src.slice(i, i + 900);
    return seg.indexOf('c.type === "carwasher"') >= 0;
  })()
);
check(
  "AVOID_TYPES: pedestrians slip around the carwasher",
  /carwasher: 1,/.test(src)
);

// ================= 9. WRITTEN UP! =================
check(
  'WRITTEN UP!: "Failed to clean the route or car" (the car washer)',
  (() => {
    const i = src.indexOf("const WRITEUP_REASONS = {");
    if (i < 0) return false;
    const seg = src.slice(i, i + 9000);
    const j = seg.indexOf("carwasher: [");
    return (
      j >= 0 &&
      seg.indexOf("Failed to clean the route or car", j) >= 0
    );
  })()
);

// ================= 10. SFX + SPLASH =================
check(
  "SFX.playHoseSplash: highpass noise hiss + wet whoomp",
  (() => {
    const i = src.indexOf("playHoseSplash()");
    if (i < 0) return false;
    const seg = src.slice(i, i + 900);
    return seg.indexOf('this.noise(0.42, "highpass", 1600, 0.55)') >= 0;
  })()
);
check(
  "spawnWaterSplash: blue droplets riding the dust-particle lifecycle",
  (() => {
    const i = src.indexOf("function spawnWaterSplash(");
    if (i < 0) return false;
    const seg = src.slice(i, i + 1400);
    return seg.indexOf("0x9fd8ff") >= 0 && seg.indexOf("dustParticles.push") >= 0;
  })()
);
check(
  "spawnWaterJet: staggered droplet stream from the nozzle to the worker (launch height = nozzle z)",
  (() => {
    const i = src.indexOf("function spawnWaterJet(");
    if (i < 0) return false;
    const seg = src.slice(i, i + 1600);
    return (
      seg.indexOf("0x9fd8ff") >= 0 &&
      seg.indexOf("dustParticles.push") >= 0 &&
      seg.indexOf("nzz || 0.62") >= 0
    );
  })()
);
check(
  "parkedCar global declared (the car-wash scene handle)",
  /let parkedCar = null;/.test(src)
);

console.log(pass ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
process.exit(pass ? 0 : 1);