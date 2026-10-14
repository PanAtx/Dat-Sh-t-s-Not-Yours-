// _slug_boss_chk.js — THE MIDNIGHT SLUG DEMON (the heart-window final boss).
//
// The haunted level's last thing is a SLUG THE SIZE OF A CAR with a toothed grin and TWO
// tentacle arms. It hurls SPECTRAL FIRE off the hooks of those arms, it is ARMOUR-bound the
// whole fight, and the ONLY thing the shovel ever lands on is the HEART hanging in its chest:
// the shell cracks (the tell), the flaps sleet apart, one swing in that window is one cut on
// the bar, and the wound slams the shell shut again. Every cut makes it meaner (the fire comes
// faster and in bigger volleys) and it only leaves its rise point after BOSS_FURY_HITS strikes.
//
// [1] the RIG, built with the shipped three.js (slug body, toothed maw, two arms, the heart)
// [2] the HEART WINDOW + the FURY RAMP (the live math, read straight out of the game)
// [3] the wiring the fight depends on (greps: the shovel contract, the bar, the phase HUD)
const fs = require("fs");
const path = require("path");
const THREE = require("./three_r128.min.js");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

let pass = 0,
  fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log("PASS  " + name);
  } else {
    fail++;
    failures.push(name + (extra === undefined ? "" : "  [" + extra + "]"));
    console.log("FAIL  " + name + (extra === undefined ? "" : "  [" + extra + "]"));
  }
}
function srcFn(name) {
  const idx = html.indexOf("function " + name + "(");
  if (idx < 0) throw new Error("function not found: " + name);
  let i = html.indexOf("{", idx),
    d = 0;
  for (; i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") {
      d--;
      if (!d) {
        i++;
        break;
      }
    }
  }
  return html.slice(idx, i);
}
function srcLiteral(name, open, close) {
  const marker = "const " + name + " = ";
  const idx = html.indexOf(marker);
  if (idx < 0) throw new Error("const not found: " + name);
  const s = html.indexOf(open, idx);
  let d = 0,
    i = s;
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === open) d++;
    else if (c === close) {
      d--;
      if (!d) {
        i++;
        break;
      }
    }
  }
  return html.slice(s, i);
}
function srcNum(name) {
  const m = html.match(new RegExp("const\\s+" + name + "\\s*=\\s*(-?[0-9.]+)"));
  if (!m) throw new Error("constant not found in index.html: " + name);
  return Number(m[1]);
}
function srcArr(name) {
  return eval("(" + srcLiteral(name, "[", "]") + ")");
}

const BOSS_MAX_HP = srcNum("BOSS_MAX_HP");
const BOSS_HEART_TELEGRAPH = srcNum("BOSS_HEART_TELEGRAPH");
const BOSS_HEART_OPEN_T = srcNum("BOSS_HEART_OPEN_T");
const BOSS_HEART_OPEN_MIN = srcNum("BOSS_HEART_OPEN_MIN");
const BOSS_HEART_RAGE = srcNum("BOSS_HEART_RAGE");
const BOSS_HEART_CD = srcArr("BOSS_HEART_CD");
const BOSS_HEART_CD_RAGE = srcNum("BOSS_HEART_CD_RAGE");
const BOSS_FURY_HITS = srcNum("BOSS_FURY_HITS");
const BOSS_FURY_MUL = srcNum("BOSS_FURY_MUL");
const BOSS_FIRE_CD = srcArr("BOSS_FIRE_CD");
const BOSS_FIRE_CD_FLOOR = srcNum("BOSS_FIRE_CD_FLOOR");
const BOSS_SHOTS = srcNum("BOSS_SHOTS");
const BOSS_SHOTS_RAGE = srcNum("BOSS_SHOTS_RAGE");
const BOSS_SHOTS_FURY = srcNum("BOSS_SHOTS_FURY");
const BOSS_ROAM_R = srcNum("BOSS_ROAM_R");
const BOSS_LUNGE_SP = srcNum("BOSS_LUNGE_SP");
const BOSS_LUNGE_SP_RAGE = srcNum("BOSS_LUNGE_SP_RAGE");
const BOSS_FIRE_TINTS = srcArr("BOSS_FIRE_TINTS");

// ---- the rig, built with the SHIPPED three.js (the same primitives the game builds with) ----
const M = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
const BX = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const CY = (r1, r2, h, m, s, hs) =>
  new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10, hs || 1), m);
const SP = (r, m, s) => new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m);
const SPH = (r, m, ws, hs) => new THREE.Mesh(new THREE.SphereGeometry(r, ws || 14, hs || 10), m);
const R = (a, b) => a + Math.random() * (b - a);
const makeBoss = new Function(
  "THREE", "M", "BX", "CY", "SP", "SPH", "R",
  srcFn("makeTentacleBoss") + "\nreturn makeTentacleBoss;",
)(THREE, M, BX, CY, SP, SPH, R);

console.log("[1] THE RIG: a slug the size of a car, a toothed grin, TWO arms, and a heart");
const g = makeBoss();
const t = g.userData.tent;
const bb = new THREE.Box3().setFromObject(g);
const size = bb.max.clone().sub(bb.min);
check("it is a SLUG, not a stack of tentacles: a mantle, a gut and a neck-hump on a big scale",
  !!t.body && !!t.belly && !!t.mantle && t.body.scale.x >= 1.6 && t.body.scale.y >= 1.1 &&
    t.body.scale.z >= 1.0,
  "mantle " + t.body.scale.toArray().map((v) => v.toFixed(2)).join(" x "));
check("IT IS BIG: " + size.x.toFixed(2) + "u long, " + size.z.toFixed(2) + "u tall over a 1.87u worker",
  size.x >= 5 && size.z >= 3,
  size.x.toFixed(2) + " x " + size.y.toFixed(2) + " x " + size.z.toFixed(2));
check("NINE eyes on stalks, every one its own scanning pivot",
  t.eyes.length === 9 && t.eyes.every((e) => e.children.length >= 3), "eyes=" + t.eyes.length);
check("TWO tentacle ARMS off the shoulders: pivot + two joints + a hooked tip + a fire-lit flame",
  t.tentacles.length === 2 &&
    t.tentacles.every((a) => a.sh && a.j1 && a.j2 && a.tip && a.flame && a.side !== 0) &&
    t.tentacles[0].side === -t.tentacles[1].side,
  "arms=" + t.tentacles.length);
check("SHARP TEETH in two rows: the upper row points DOWN into the grin, the lower points UP",
  t.teeth.length >= 20 &&
    t.teeth.filter((c) => c.rotation.x === 0).length >= 10 &&
    t.teeth.filter((c) => Math.abs(c.rotation.x - Math.PI) < 1e-9).length >= 10,
  "teeth=" + t.teeth.length);
check("THE GRIN FACES THE WORKER: the maw stands forward of the mantle and above the chest",
  t.maw.position.x > 1.2 && t.maw.position.z > 1.2 && !!t.jawT && !!t.jawB,
  "maw x=" + t.maw.position.x.toFixed(2) + " z=" + t.maw.position.z.toFixed(2));
check("THE HEART CAVITY: a spiked rim, a beating red heart, an aura, its own light, TWO skin flaps",
  !!t.heart && !!t.aura && !!t.light && !!t.spikes && !!t.flaps && t.flaps.length === 2 &&
    t.spikes.children.length >= 10 &&
    t.heartMats.every((m) => m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0),
  "spikes=" + t.spikes.children.length);
check("THE LIDS SLEET APART ON THE WINDOW: one flap rides up, one rides down off the shut line",
  t.flaps.every((f) => f.baseY !== 0 && f.side !== 0) &&
    t.flaps[0].side === -t.flaps[1].side &&
    t.flaps[0].position.y > 0 && t.flaps[1].position.y < 0,
  "lid y=" + t.flaps.map((f) => f.position.y.toFixed(2)).join(" / "));
check("THE CAVITY SITS ON THE FRONT OF THE GUT (the side the worker walks in on), under the grin",
  t.chest.position.x > 0.5 && t.chest.position.x < t.maw.position.x &&
    t.chest.position.z < t.maw.position.z,
  "chest x=" + t.chest.position.x.toFixed(2) + " z=" + t.chest.position.z.toFixed(2));
check("THE RIG ANIMATES CLEAN AND THE OPEN HEART GLOWS: lids slide, aura burns, its lamp comes on",
  (function () {
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const animate = new Function(
      "clamp", "bossFuryOf",
      srcFn("animateNightBoss") + "\nreturn animateNightBoss;",
    )(clamp, (b) => Math.max(0, Math.min(1, 1 - b.hp / b.maxHp)));
    const b = {
      g: g, phase: 0, hp: 6, maxHp: BOSS_MAX_HP, rage: 1, fury: 1, hits: 4, mawOpen: 0.8,
      armCharge: 1, armSide: 1, whipState: "idle", whipSide: 1, whipSwing: 0, heartOpen: 0, hurtT: 0,
    };
    const lidY = t.flaps[0].position.y, hs = t.heart.scale.x;
    animate(b, 1 / 60, "fight");
    const moved = t.flaps[0].position.y !== lidY || t.heart.scale.x !== hs;
    b.heartOpen = 1;
    const before = JSON.stringify([t.flaps[0].position.y, t.flaps[1].position.y,
      t.aura.material.opacity, t.light.intensity]);
    for (let i = 0; i < 20; i++) animate(b, 1 / 60, "fight");
    const after = JSON.stringify([t.flaps[0].position.y, t.flaps[1].position.y,
      t.aura.material.opacity, t.light.intensity]);
    return moved && before !== after && t.flaps[0].position.y > lidY &&
      t.light.intensity > 0 && t.aura.material.opacity > 0.2;
  })());

// ---- [2] THE HEART WINDOW + THE FURY RAMP (the pure math, run on mock bars) ----
console.log("\n[2] THE HEART WINDOW: armour, the bite, and the fury ramp");
const clampFn = (v, a, b) => Math.max(a, Math.min(b, v));
const FN = new Function(
  "clamp", "R", "BOSS_MAX_HP", "BOSS_HEART_TELEGRAPH", "BOSS_HEART_OPEN_T",
  "BOSS_HEART_OPEN_MIN", "BOSS_HEART_RAGE", "BOSS_HEART_CD", "BOSS_HEART_CD_RAGE",
  "BOSS_FURY_HITS", "BOSS_FURY_MUL", "BOSS_FIRE_CD", "BOSS_FIRE_CD_FLOOR",
  "BOSS_SHOTS", "BOSS_SHOTS_RAGE", "BOSS_SHOTS_FURY",
  srcFn("bossFuryOf") + srcFn("bossIsFurious") + srcFn("bossHeartOpenT") +
  srcFn("bossHeartCloseT") + srcFn("bossFireShots") + srcFn("bossFireGap") +
  "\nreturn { bossFuryOf, bossIsFurious, bossHeartOpenT, bossHeartCloseT," +
  " bossFireShots, bossFireGap };",
)(
  clampFn, R, BOSS_MAX_HP, BOSS_HEART_TELEGRAPH, BOSS_HEART_OPEN_T, BOSS_HEART_OPEN_MIN,
  BOSS_HEART_RAGE, BOSS_HEART_CD, BOSS_HEART_CD_RAGE, BOSS_FURY_HITS, BOSS_FURY_MUL,
  BOSS_FIRE_CD, BOSS_FIRE_CD_FLOOR, BOSS_SHOTS, BOSS_SHOTS_RAGE, BOSS_SHOTS_FURY,
);
const full = { hp: BOSS_MAX_HP, maxHp: BOSS_MAX_HP, awake: true, hooked: false, hits: 0 };
const half = { hp: Math.ceil(BOSS_MAX_HP / 2), maxHp: BOSS_MAX_HP, awake: true, hooked: false, hits: 5, rage: 1 };
const last = { hp: 1, maxHp: BOSS_MAX_HP, awake: true, hooked: false, hits: BOSS_MAX_HP - 1, rage: 1 };
check("FURY runs 0 \u2192 1 across the bar (the ANGER, counted in lost hearts)",
  Math.abs(FN.bossFuryOf(full)) < 1e-9 && FN.bossFuryOf(half) > 0.4 &&
    FN.bossFuryOf(last) > 0.85 && FN.bossFuryOf({ hp: 0, maxHp: 10 }) === 1);
check("THE FIRE GAPS COLLAPSE with the bar and never fall under the floor",
  (function () {
    const avg = (b) => {
      let s = 0;
      for (let i = 0; i < 200; i++) s += FN.bossFireGap(b);
      return s / 200;
    };
    const a = avg(full), h = avg(half), l = avg(last);
    return a > h && h > l && l >= BOSS_FIRE_CD_FLOOR - 1e-9;
  })(),
  "avg " + FN.bossFireGap(full).toFixed(2) + "/" + FN.bossFireGap(half).toFixed(2) + "/" + FN.bossFireGap(last).toFixed(2));
check("THE VOLLEYS GROW: " + BOSS_SHOTS + " \u2192 " + BOSS_SHOTS_RAGE + " at half the bar \u2192 " + BOSS_SHOTS_FURY + " in the last third",
  FN.bossFireShots(full) === BOSS_SHOTS && FN.bossFireShots(half) === BOSS_SHOTS_RAGE &&
    FN.bossFireShots(last) === BOSS_SHOTS_FURY,
  FN.bossFireShots(full) + "/" + FN.bossFireShots(half) + "/" + FN.bossFireShots(last));
check("THE OPEN WINDOW SHORTENS as it weakens (never under " + BOSS_HEART_OPEN_MIN + "s)",
  Math.abs(FN.bossHeartOpenT(full) - BOSS_HEART_OPEN_T) < 1e-9 &&
    FN.bossHeartOpenT(last) < FN.bossHeartOpenT(full) &&
    FN.bossHeartOpenT(last) >= BOSS_HEART_OPEN_MIN - 1e-9);
check("THE ARMOUR GAP SHRINKS as it weakens (from " + BOSS_HEART_CD[0] + "s down toward " + BOSS_HEART_CD_RAGE + "s)",
  (() => {
    const loFull = Math.min(...Array.from({ length: 200 }, () => FN.bossHeartCloseT(full)));
    const loLast = Math.min(...Array.from({ length: 200 }, () => FN.bossHeartCloseT(last)));
    return loFull >= BOSS_HEART_CD[0] - 1e-9 && loLast < loFull && loLast >= BOSS_HEART_CD_RAGE - 1e-9;
  })());
check("THE TELEGRAPH SITS BETWEEN THE CRACK AND THE BITE (a tell the player can read)",
  BOSS_HEART_TELEGRAPH > 0.3 && BOSS_HEART_TELEGRAPH < BOSS_HEART_OPEN_T &&
    BOSS_HEART_RAGE > 0 && BOSS_HEART_RAGE < 1);
check("IT HOLDS ITS GRAVE UNTIL FURY: no walking before " + BOSS_FURY_HITS + " strikes on the heart",
  FN.bossIsFurious({ ...full, hits: BOSS_FURY_HITS - 1 }) === false &&
    FN.bossIsFurious({ ...full, hits: BOSS_FURY_HITS }) === true &&
    FN.bossIsFurious({ hp: 5, maxHp: 10, awake: true, hooked: true, hits: 9 }) === false &&
    FN.bossIsFurious({ hp: 0, maxHp: 10, awake: true, hooked: false, hits: 9 }) === false);
check("THE HEART WINDOW IS THE ONLY TARGET: a shut (or cracking) shell is never shovelable",
  (function () {
    const mk = (state, extra) =>
      new Function(
        "nightBoss",
        srcFn("bossHeartOpen") + "\nreturn bossHeartOpen();",
      )(Object.assign({ hp: 5, maxHp: 10, awake: true, hooked: false, hits: 4, heartState: state }, extra || {}));
    const got = [mk("open"), mk("shut"), mk("crack"), mk("open", { hp: 0 }), mk("open", { hooked: true })];
    return got[0] === true && got[1] === false && got[2] === false && got[3] === false && got[4] === false;
  })());
check("IT RUNS FASTER THE MEANER IT IS, and its run reaches across the block",
  BOSS_LUNGE_SP_RAGE > BOSS_LUNGE_SP && BOSS_ROAM_R > BOSS_LUNGE_SP && BOSS_FURY_MUL > 1);
check("THE SPECTRAL FIRE rides " + BOSS_FIRE_TINTS.length + " grave-fire colours (halo / core / emissive)",
  BOSS_FIRE_TINTS.length >= 3 &&
    BOSS_FIRE_TINTS.every((tr) => tr.length === 3 && tr.every((c) => typeof c === "number")));

// ---- [3] the wiring the fight depends on ----
console.log("\n[3] THE WIRING: the shovel, the shell and the bar");
check("THE BAR TELLS THE BEAT: HEART — SHOVEL IT! / SHELL CRACKING / ARMOUR UP, and it pulses on the window",
  srcFn("updateHUD").includes('"  HEART — SHOVEL IT!"') &&
    srcFn("updateHUD").includes('"  SHELL CRACKING"') &&
    srcFn("updateHUD").includes('"  ARMOUR UP"') &&
    srcFn("updateHUD").includes('bossPanel.classList.toggle("heart", heartUp)') &&
    /#boss-goal\.heart #boss-hpbar \{/.test(html) &&
    /#boss-goal\.heart #boss-goal-name \{/.test(html));
check("THE SHOVEL CONTRACT: the open heart is a bite, a shut shell is a spent CLANG",
  srcFn("tryShovelSwing").includes("bossHeartOpen() && bossTakeShovelSwing(charged)") &&
    srcFn("tryShovelSwing").includes("bossTakeArmourSwing(charged)") &&
    srcFn("shovelDeliverStrike").includes("if (pend.bossArmour) {") &&
    srcFn("shovelDeliverStrike").includes("bossArmourBite();"));
check("A CUT ON THE HEART SLAMS THE SHELL SHUT and counts the strike the fury rides on",
  srcFn("bossShovelHit").includes("if (!bossHeartOpen()) {") &&
    srcFn("bossShovelHit").includes("b.hits++;") &&
    srcFn("bossShovelHit").includes('b.heartState = "shut";') &&
    srcFn("bossShovelHit").includes("b.heartT = bossHeartCloseT(b);") &&
    srcFn("bossShovelHit").includes("b.hits >= BOSS_FURY_HITS"));
check("THE SHOT IS SPENT ON THE CLANG: an armour swing sets the cooldown and never cuts the bar",
  srcFn("bossTakeArmourSwing").includes("p.shovelCd = SHOVEL_COOLDOWN;") &&
    srcFn("bossTakeArmourSwing").includes("bossHeartOpen()) return false;") &&
    !srcFn("bossArmourBite").includes("b.hp =") &&
    !srcFn("bossArmourBite").includes("hp -"));
check("THE FIGHT LOOP RUNS THE HEART CYCLE (shut \u2192 crack \u2192 open) and the arm-launched volley",
  srcFn("updateNightBoss").includes('b.heartState === "shut"') &&
    srcFn("updateNightBoss").includes('b.heartState = "crack";') &&
    srcFn("updateNightBoss").includes('b.heartState = "open";') &&
    srcFn("updateNightBoss").includes("bossHeartOpenT(b)") &&
    srcFn("updateNightBoss").includes("bossFireGap(b)") &&
    srcFn("updateNightBoss").includes("bossFireShots(b)") &&
    srcFn("spawnBossFireball").includes("bossArmMuzzle(b, side)"));
check("THE BEAST ONLY LEAVES ITS RISE POINT ONCE FURIOUS, and never runs out of its block",
  srcFn("updateNightBoss").includes("const furious = bossIsFurious(b);") &&
    srcFn("updateNightBoss").includes("if (furious)") &&
    srcFn("updateNightBoss").includes("clamp(b.wx, NIGHT_GRAVE_X - 6, NIGHT_SEAL_X - 2)"));
check("THE HUD NAME IS THE SLUG DEMON, and the goal card says SHOVEL OUT ITS HEART",
  html.includes("THE SLUG DEMON<span") &&
    /SHOVEL OUT THE <b>SLUG DEMON'S HEART<\/b>/.test(html) &&
    srcFn("clearNightBoss").includes('bar.classList.remove("heart")'));
check("THE WAKE TEACHES THE RULE before the first swing",
  srcFn("startBossFight").includes("THE SHOVEL ONLY BITES THE HEART! WATCH THE CHEST!") &&
    srcFn("startBossFight").includes('announcePower("THE SLUG DEMON!", "pop-power")') &&
    srcFn("spawnNightBoss").includes('heartState: "shut"') &&
    srcFn("spawnNightBoss").includes("hits: 0"));
check("THE FIGHT STAYS NIGHT-ONLY: the weekdays never see the beast, the shell or its fire",
  srcFn("updateNightBossFight").includes("if (!isNightShift()) return;") &&
    srcFn("bossShovelTargetable").includes("b.awake && !b.hooked && b.hp > 0"));

// ---- [4] THE BOSS RING: the rig parks at the iron, the ghost fence closes the street ----
console.log(
  "\n[4] THE BOSS RING: the rig stops where the first cemetery fence begins, and the ghost iron seals the street",
);
const NK_SEAL_X = srcNum("NIGHT_SEAL_X");
const NK_SEAL_STOP = srcNum("NIGHT_SEAL_STOP");
const NK_NOSE = srcNum("NIGHT_TRUCK_NOSE_L");
const NK_RISE_T = srcNum("NIGHT_SEAL_RISE_T");
const NK_TOP_X = srcNum("NIGHT_TOP_X"), NK_TRAIL = srcNum("NIGHT_TRAIL_X");
const NK_FENCE = srcNum("NIGHT_FENCE_X"), NK_STANDOFF = srcNum("NIGHT_FENCE_STANDOFF");
const NK_BOSS_X = srcNum("NIGHT_BOSS_X"), NK_GRAVE = srcNum("NIGHT_GRAVE_X");
const NK_GATE_FADE = srcNum("NIGHT_GATE_FADE"), NK_GATE_LIFT = srcNum("NIGHT_GATE_LIFT");
const NK_PANELS = srcNum("NIGHT_WARD_PANELS"), NK_BAND = srcNum("NIGHT_WARD_DEATH_BAND");
const NK_GRAVE_BLOCK = srcNum("NIGHT_GRAVE_BLOCK_X");
const NK_BLOCK_W = 80; // BW * HOUSES_PER_BLOCK — the pitch the cemetery fence row is laid on
const sealSrc = (n) => srcFn(n).replace(/\bnightSeal\b/g, "S.seal");
const GZ = 0.3; // mirrors index.html
const MS = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c }, o || {}));
const pick = (a) => a[0]; // deterministic in the suites
const said4 = [], disposed4 = [], bursts4 = [];
const p4 = { wx: 449, wy: 2.5, shake: 0, sealT: 0 };
const dyn4 = {
  children: [],
  add(o) { this.children.push(o); o.parent = this; },
  remove(o) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); o.parent = null; },
};
const S4 = { seal: null };
let night4 = true;
const RING = new Function(
  "S", "p", "isNightShift", "THREE", "M", "BX", "CY", "SP", "SPH", "R", "pick", "clamp", "GZ",
  "dynamicGroup", "disposeObj", "spawnEctoBurst", "Voice", "SFX", "WORKER_GENDER",
  "NIGHT_SEAL_X", "NIGHT_SEAL_STOP", "NIGHT_TRUCK_NOSE_L", "NIGHT_SEAL_RISE_T", "NIGHT_SEAL_LINES",
  "NIGHT_TOP_X", "NIGHT_TRAIL_X", "ROUTE_END_X", "NIGHT_GATE_FADE", "NIGHT_GATE_LIFT",
  "NIGHT_WARD_PANELS", "NIGHT_WARD_SPAN_R", "NIGHT_WARD_SPAN_L", "NIGHT_WARD_DEATH_BAND",
  "makeCemeteryFence",
  sealSrc("nightSealClosed") + sealSrc("workerCeilX") + sealSrc("truckFenceFloorX") +
    srcFn("makeGhostIronFence") + sealSrc("buildNightSeal") + sealSrc("nightSealClear") +
    sealSrc("nightSealArm") + sealSrc("nightSealClose") + sealSrc("nightSealDrop") +
    sealSrc("nightSealSay") + sealSrc("updateNightSeal") +
    "\nreturn { nightSealClosed, workerCeilX, truckFenceFloorX, makeGhostIronFence, buildNightSeal, nightSealArm," +
    " nightSealClose, nightSealDrop, updateNightSeal, nightSealClear };",
)(
  S4, p4, () => night4, THREE, M, BX, CY, SP, SPH, R, pick, clampFn, GZ,
  dyn4, (o) => disposed4.push(o), (x, y, s) => bursts4.push({ x, y, s }),
  { say: (t) => said4.push(t) }, { playThunder() {} }, "male",
  NK_SEAL_X, NK_SEAL_STOP, NK_NOSE, NK_RISE_T, ["THE FENCE'S UP — NO WAY BACK UP THE STREET!"],
  NK_TOP_X, NK_TRAIL, 560, NK_GATE_FADE, NK_GATE_LIFT,
  NK_PANELS, srcNum("NIGHT_WARD_SPAN_R"), srcNum("NIGHT_WARD_SPAN_L"), NK_BAND,
  new Function(
    "THREE", "BX", "CY", "SP", "R", "M", "GZ", "MS",
    srcFn("makeCemeteryFence") + "\nreturn makeCemeteryFence;",
  )(THREE, BX, CY, SP, R, M, GZ, MS),
);

check(
  "THE SEAL LINE IS THE LINE WHERE THE FIRST CEMETERY FENCE BEGINS (the graves block's near edge: " +
    NK_GRAVE_BLOCK + " + " + NK_BLOCK_W + " = " + NK_SEAL_X + "u)",
  NK_SEAL_X === NK_GRAVE_BLOCK + NK_BLOCK_W,
  "seal=" + NK_SEAL_X,
);
check(
  "THE RIG STANDS ON THE LINE AND NEVER PAST IT: the floor answers " +
    RING.truckFenceFloorX() +
    "u (the line + the " + NK_NOSE + "u collision nose), so its nose is ON the fence line and its open scoop rests UP-street of it",
  (function () {
    const f = RING.truckFenceFloorX();
    const bodyLow = f - NK_NOSE, scoop = f - 4.3; // the cab-side body edge / the open hopper
    return (
      Math.abs(bodyLow - NK_SEAL_X) < 1e-9 && // the rig's downhill body edge stands ON the line
      scoop < NK_SEAL_X && // ...and its scoop rests at the line, on the ring side, ready for the gargoyle
      f < NK_TOP_X // ...and inside the cul-de-sac wall (it never noses through the dead end)
    );
  })(),
  "floor=" + RING.truckFenceFloorX() + " ceil=" + RING.workerCeilX(),
);
check(
  "A DAY SHIFT NEVER SEES THE RING: no ghost iron, no ceiling clamp, no fence floor for the driver",
  (function () {
    night4 = false;
    const dayCeil = RING.workerCeilX();
    const r = RING.nightSealClosed() === false && dayCeil === 560 && RING.truckFenceFloorX() === null;
    night4 = true;
    return r;
  })(),
);
check(
  "THE GHOST IRON IS BUILT ACROSS THE WHOLE STREET ON THE LINE: the real wrought-iron recipe from the far gutter to past the grave grass, the ward's full light panel run, two side returns, all transparent, laid INVISIBLE",
  (function () {
    // measure the fence on its own (no mock parent): the geometry the game lays on the line
    const raw = RING.makeGhostIronFence();
    const bb = new THREE.Box3().setFromObject(raw);
    const wide = bb.max.y - bb.min.y;
    const ward = raw.userData.ward;
    RING.buildNightSeal();
    const s = S4.seal;
    if (!s || !s.g) return false;
    return (
      s.x === NK_SEAL_X &&
      wide >= 18 &&
      raw.children.length >= 20 && // the iron, its panels, rails, beads, lintel, bleed, haze, glow
      ward.panels.length === NK_PANELS &&
      ward.mats.length > ward.panels.length &&
      ward.mats.every((m) => m.transparent === true && m.depthWrite === false) &&
      s.g.visible === false &&
      s.armed === false &&
      s.closed === false
    );
  })(),
);
check(
  "WAKING THE BEAST ARMS THE LINE, AND THE FENCE ONLY SHUTS WHEN HE WALKS BELOW IT",
  (function () {
    p4.wx = 449;
    RING.nightSealArm();
    const armedAbove = S4.seal.armed === true && S4.seal.closed === false && RING.nightSealClosed() === false;
    p4.wx = 85;
    const closed = RING.nightSealClose();
    return (
      armedAbove &&
      closed === true &&
      RING.nightSealClosed() === true &&
      S4.seal.g.visible === true &&
      said4.length > 0
    );
  })(),
);
check(
  "THE SEALED CEILING IS THE GHOST IRON (line + a body-width of respect), and the ring it closes is a real fighting ring",
  (function () {
    const ceil = RING.workerCeilX();
    const floor = NK_FENCE + NK_STANDOFF; // the bottom cemetery fence: his shipped floor
    return (
      Math.abs(ceil - (NK_SEAL_X + NK_SEAL_STOP)) < 1e-9 &&
      ceil > floor + 20 &&
      ceil < RING.truckFenceFloorX() && // he is sealed BELOW the parked rig, at the graves
      NK_BOSS_X > floor && NK_BOSS_X < NK_SEAL_X && // the beast rises inside the ring
      NK_GRAVE > floor && NK_GRAVE < NK_SEAL_X // ...and its treasure lands inside the ring
    );
  })(),
  "ceil=" + RING.workerCeilX() + " floor=" + (NK_FENCE + NK_STANDOFF),
);

check(
  "THE RISE IS AN ANIMATION, NOT A SNAP: " + NK_RISE_T + "s out of the asphalt, its light ramping in as it comes up, ending square on the road",
  (function () {
    S4.seal.rise = 0;
    const z0 = S4.seal.g.position.z;
    RING.updateNightSeal(1 / 60);
    const zStep = S4.seal.g.position.z, o1 = S4.seal.g.userData.ward.mats[0].opacity;
    for (let i = 0; i < Math.ceil(NK_RISE_T * 60) + 1; i++) RING.updateNightSeal(1 / 60);
    const ward = S4.seal.g.userData.ward;
    return (
      S4.seal.rise === 1 &&
      zStep < z0 && // it starts BELOW the road and rises into frame
      o1 > 0 &&
      S4.seal.g.position.z === GZ &&
      S4.seal.g.scale.z === 1 &&
      ward.mats.every((m, i) => m.opacity > 0.2 * ward.base[i])
    );
  })(),
);
check(
  "THE BEAST IS WALLED INTO THE RING: its roam clamp runs the graves gate up to just below the ghost iron",
  srcFn("updateNightBoss").includes("clamp(b.wx, NIGHT_GRAVE_X - 6, NIGHT_SEAL_X - 2)") &&
    NK_GRAVE - 6 > NK_FENCE + NK_STANDOFF &&
    NK_SEAL_X - 2 < NK_SEAL_X + NK_SEAL_STOP,
);
check(
  "THE BANISH TEARS THE IRON DOWN: the ward's own gutter-first sweep over " + NK_GATE_FADE + "s, lifting off the road, and the street's ceiling opens back up to the cul-de-sac wall",
  (function () {
    const ward = S4.seal.g.userData.ward;
    const op0 = ward.panels.map((m) => m.opacity);
    const visBefore = S4.seal.g.visible;
    const zSealed = S4.seal.g.position.z;
    const ceilSealed = RING.workerCeilX(); // the iron is his ceiling right up to the banish
    RING.nightSealDrop();
    let maxLift = zSealed, sawDim = false;
    for (let i = 0; i < Math.ceil((NK_GATE_FADE + 0.15) * 60); i++) {
      RING.updateNightSeal(1 / 60);
      maxLift = Math.max(maxLift, S4.seal.g.position.z);
      if (ward.panels.some((m, k) => m.opacity !== op0[k])) sawDim = true;
    }
    global.__ringDbg = {
      visBefore, ceilSealed, closedAfter: RING.nightSealClosed(),
      ceilAfter: RING.workerCeilX(), visAfter: S4.seal.g.visible,
      drop: S4.seal.drop, zSealed, maxLift, after: S4.seal.g.position.z, sawDim,
    };
    return (
      visBefore === true &&
      ceilSealed === NK_SEAL_X + NK_SEAL_STOP &&
      RING.nightSealClosed() === false &&
      RING.workerCeilX() === NK_TOP_X - NK_TRAIL && // the street is HIS again
      S4.seal.g.visible === false &&
      maxLift > zSealed && // ...it LIFTED off the asphalt on the way out
      sawDim // and the panels tore at different rates (gutter-first)
    );
  })(),
  JSON.stringify(global.__ringDbg || {}),
);
check(
  "THE RING IS WIRED INTO THE FIGHT: the wake arms it, the crossing closes it, the hopper opens it, the shift clears it, the frame hook runs it",
  srcFn("startBossFight").includes("nightSealArm();") &&
    srcFn("bossLandedInHopper").includes("nightSealDrop();") &&
    srcFn("clearNightBoss").includes("nightSealClear();") &&
    srcFn("updateNightBossFight").includes("updateNightSeal(dt);") &&
    srcFn("updatePlayer").includes("p.wx > workerCeilX()") &&
    srcFn("updatePlayer").includes("nightSealClose()") &&
    srcFn("updatePlayer").includes("NIGHT_SEAL_X + NIGHT_SEAL_STOP") &&
    srcFn("updateTruck").includes("truckFenceFloorX()") &&
    srcFn("nightSealClose").includes("spawnEctoBurst(NIGHT_SEAL_X, p.wy") &&
    srcFn("nightSealArm").includes("buildNightSeal()"),
);
check(
  "EVERY KNOCK-BACK AND EVERY GHOST-FIRE SHOT STOPS AT THE IRON (a flung body never lands past the seal)",
  srcFn("updateBossFireballs").includes("f.wx > workerCeilX() + 8") &&
    (html.match(/workerCeilX\(\) \+ 2/g) || []).length >= 2,
);

console.log("\n" + pass + " slug-demon checks passed" + (fail ? ", " + fail + " FAILED" : " \u2014 all OK"));
if (fail) {
  console.log(failures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
