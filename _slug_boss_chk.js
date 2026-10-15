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
// THE HEART'S BURN, mirrored out of index.html: the BRIGHT RED of an open, hittable heart, the
// dark of a shut shell, and how hard the open heart blazes
function hexLit(name) {
  const m = html.match(new RegExp("const\\s+" + name + "\\s*=\\s*(0x[0-9a-fA-F]+)"));
  if (!m) throw new Error("hex constant not found in index.html: " + name);
  return m[1];
}
const NK_HEART_HOT = parseInt(hexLit("BOSS_HEART_HOT"), 16);
const NK_HEART_DARK = parseInt(hexLit("BOSS_HEART_DARK"), 16);
const NK_HEART_EMISS = srcNum("BOSS_HEART_EMISS");
// THE DAMAGE THE BEAST DEALS (mirrored): cold fire, the crush, the lash — all MINOR now
const NK_HP_FIRE = srcNum("BOSS_HP_FIRE");
const NK_HP_WHIP = srcNum("BOSS_HP_WHIP");
const NK_HP_BODY = srcNum("BOSS_HP_BODY");

// ---- the rig, built with the SHIPPED three.js (the same primitives the game builds with) ----
const M = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
const BX = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const CY = (r1, r2, h, m, s, hs) =>
  new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10, hs || 1), m);
const SP = (r, m, s) => new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m);
const SPH = (r, m, ws, hs) => new THREE.Mesh(new THREE.SphereGeometry(r, ws || 14, hs || 10), m);
const R = (a, b) => a + Math.random() * (b - a);
const makeBoss = new Function(
  "THREE", "M", "BX", "CY", "SP", "SPH", "R", "BOSS_HEART_HOT", "BOSS_HEART_DARK",
  srcFn("makeTentacleBoss") + "\nreturn makeTentacleBoss;",
)(THREE, M, BX, CY, SP, SPH, R, NK_HEART_HOT, NK_HEART_DARK);

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
check("THE HEART CAVITY: a spiked rim, the heart HIDDEN in a shut shell, an aura, its own light, TWO skin flaps",
  !!t.heart && !!t.aura && !!t.light && !!t.spikes && !!t.flaps && t.flaps.length === 2 &&
    t.spikes.children.length >= 10 &&
    t.heart.visible === false && // a shut shell shows NO heart to hit
    t.heartMats.every((m) => m.emissive && m.emissive.getHex() === NK_HEART_HOT &&
      m.emissiveIntensity === 0) && // ...and it burns DARK until the shell opens
    t.aura.material.emissiveIntensity === 0 && t.aura.material.opacity === 0 &&
    t.light.intensity === 0,
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
check("THE RIG ANIMATES CLEAN, AND THE HEART ONLY EXISTS TO BE SEEN WHEN IT CAN BE HIT",
  (function () {
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const animate = new Function(
      "clamp", "bossFuryOf", "BOSS_HEART_HOT", "BOSS_HEART_DARK", "BOSS_HEART_EMISS",
      srcFn("animateNightBoss") + "\nreturn animateNightBoss;",
    )(clamp, (b) => Math.max(0, Math.min(1, 1 - b.hp / b.maxHp)),
      NK_HEART_HOT, NK_HEART_DARK, NK_HEART_EMISS);
    const b = {
      g: g, phase: 0, hp: 6, maxHp: BOSS_MAX_HP, rage: 1, fury: 1, hits: 4, mawOpen: 0.8,
      armCharge: 1, armSide: 1, whipState: "idle", whipSide: 1, whipSwing: 0, heartOpen: 0, hurtT: 0,
      heartState: "shut",
    };
    const lidY = t.flaps[0].position.y, hs = t.heart.scale.x;
    animate(b, 1 / 60, "fight");
    const moved = t.flaps[0].position.y !== lidY || t.heart.scale.x !== hs;
    // SHUT: the heart is off the screen and dark
    const shutVis = t.heart.visible, shutEmit = t.heartMats[0].emissiveIntensity, shutLamp = t.light.intensity;
    // OPEN: bright red, lit, and grown out of the cavity
    b.heartState = "open";
    b.heartOpen = 1;
    const before = JSON.stringify([t.flaps[0].position.y, t.flaps[1].position.y,
      t.aura.material.opacity, t.light.intensity]);
    for (let i = 0; i < 20; i++) animate(b, 1 / 60, "fight");
    const after = JSON.stringify([t.flaps[0].position.y, t.flaps[1].position.y,
      t.aura.material.opacity, t.light.intensity]);
    const openEmit = Math.max.apply(null, t.heartMats.map((m) => m.emissiveIntensity));
    return moved && before !== after && t.flaps[0].position.y > lidY &&
      shutVis === false && shutEmit <= 0.1 && shutLamp === 0 &&
      t.heart.visible === true && openEmit >= 2.5 &&
      t.heartMats.every((m) => m.color.getHex() === NK_HEART_HOT &&
        m.emissive.getHex() === NK_HEART_HOT) &&
      t.light.intensity > 1.5 && t.aura.material.opacity > 0.3 && t.heart.scale.x > 0.7;
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
check("THE BEAST ONLY LEAVES ITS RISE POINT ONCE FURIOUS, and never runs out of its block (its ceiling is the ghost iron's FACE minus its body)",
  srcFn("updateNightBoss").includes("const furious = bossIsFurious(b);") &&
    srcFn("updateNightBoss").includes("if (furious && !scurrying)") &&
    srcFn("updateNightBoss").includes("clamp(b.wx, NIGHT_GRAVE_X - 6, sealFaceX() - BOSS_BODY_R)"));
check("THE HUD NAME IS THE SLUG DEMON, and the goal card says SHOVEL OUT ITS HEART",
  html.includes("THE SLUG DEMON<span") &&
    /SHOVEL OUT THE <b>SLUG DEMON'S HEART<\/b>/.test(html) &&
    srcFn("clearNightBoss").includes('bar.classList.remove("heart")'));
check("THE WAKE TEACHES THE RULE before the first swing",
  srcFn("startBossFight").includes("THE HEART GLOWS RED — SHOVEL IT WHEN IT GLOWS!") &&
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
const NK_SEAL_INNER = srcNum("NIGHT_SEAL_INNER");
const NK_TRUCK_NOSE = srcNum("NIGHT_TRUCK_NOSE_L");
const NK_NOSE = NK_TRUCK_NOSE; // the sandbox injection's short name
const NK_TRUCK_CLEAR = srcNum("NIGHT_TRUCK_SEAL_CLEAR");
const NK_RISE_T = srcNum("NIGHT_SEAL_RISE_T");
const NK_HOLD_T = srcNum("NIGHT_SEAL_HOLD_T");
// THE FENCE'S OWN GEOMETRY (measured off makeGhostIronFence): its ghost pool / light sheet mesh
// reaches 1.55u down the road from the fence line and 1.05u up it. A worker centre inside this
// band is standing IN the wall.
const NK_MESH_DN = srcNum("NIGHT_SEAL_MESH_DOWN"), NK_MESH_UP = srcNum("NIGHT_SEAL_MESH_UP");
const NK_MESH_LO = srcNum("NIGHT_SEAL_X") - NK_MESH_DN, NK_MESH_HI = srcNum("NIGHT_SEAL_X") + NK_MESH_UP;
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
  "NIGHT_SEAL_X", "NIGHT_SEAL_STOP", "NIGHT_SEAL_INNER", "NIGHT_TRUCK_NOSE_L",
  "NIGHT_TRUCK_SEAL_CLEAR", "NIGHT_SEAL_RISE_T", "NIGHT_SEAL_HOLD_T", "NIGHT_SEAL_LINES",
  "NIGHT_SEAL_MESH_DOWN", "NIGHT_SEAL_MESH_UP",
  "NIGHT_TOP_X", "NIGHT_TRAIL_X", "ROUTE_END_X", "NIGHT_GATE_FADE", "NIGHT_GATE_LIFT",
  "NIGHT_WARD_PANELS", "NIGHT_WARD_SPAN_R", "NIGHT_WARD_SPAN_L", "NIGHT_WARD_DEATH_BAND",
  "makeCemeteryFence", "state",
  sealSrc("nightSealClosed") + sealSrc("sealFaceX") + sealSrc("sealStandX") +
    sealSrc("workerCeilX") + sealSrc("truckFenceFloorX") +
    srcFn("makeGhostIronFence") + sealSrc("buildNightSeal") + sealSrc("nightSealClear") +
    sealSrc("nightSealArm") + sealSrc("nightSealClose") + sealSrc("nightSealDrop") +
    sealSrc("nightSealSay") + sealSrc("updateNightSeal") +
    "\nreturn { nightSealClosed, sealFaceX, sealStandX, workerCeilX, truckFenceFloorX, makeGhostIronFence, buildNightSeal, nightSealArm," +
    " nightSealClose, nightSealDrop, updateNightSeal, nightSealClear };",
)(
  S4, p4, () => night4, THREE, M, BX, CY, SP, SPH, R, pick, clampFn, GZ,
  dyn4, (o) => disposed4.push(o), (x, y, s) => bursts4.push({ x, y, s }),
  { say: (t) => said4.push(t) }, { playThunder() {} }, "male",
  NK_SEAL_X, NK_SEAL_STOP, NK_SEAL_INNER, NK_NOSE, NK_TRUCK_CLEAR, NK_RISE_T, NK_HOLD_T,
  ["THE FENCE'S UP — NO WAY BACK UP THE STREET!"],
  NK_MESH_DN, NK_MESH_UP,
  NK_TOP_X, NK_TRAIL, 560, NK_GATE_FADE, NK_GATE_LIFT,
  NK_PANELS, srcNum("NIGHT_WARD_SPAN_R"), srcNum("NIGHT_WARD_SPAN_L"), NK_BAND,
  new Function(
    "THREE", "BX", "CY", "SP", "R", "M", "GZ", "MS",
    srcFn("makeCemeteryFence") + "\nreturn makeCemeteryFence;",
  )(THREE, BX, CY, SP, R, M, GZ, MS),
  "play",
);

check(
  "THE SEAL LINE IS THE LINE WHERE THE FIRST CEMETERY FENCE BEGINS (the graves block's near edge: " +
    NK_GRAVE_BLOCK + " + " + NK_BLOCK_W + " = " + NK_SEAL_X + "u)",
  NK_SEAL_X === NK_GRAVE_BLOCK + NK_BLOCK_W,
  "seal=" + NK_SEAL_X,
);
check(
  "THE RIG PARKS FURTHER UP THE STREET THAN THE GHOST FENCE — THE HOPPER NEVER CLIPS IT: the floor answers " +
    RING.truckFenceFloorX() +
    "u (the line + the " + NK_NOSE + "u collision nose + " + NK_TRUCK_CLEAR + "u of clearance), so its whole body and its open scoop rest UP-street of the spectral iron",
  (function () {
    const f = RING.truckFenceFloorX();
    const bodyLow = f - NK_NOSE, scoop = f - 4.3; // the cab-side body edge / the open hopper
    return (
      bodyLow > NK_SEAL_X + 1 && // the rig's downhill body edge stands CLEAR of the iron
      scoop > NK_SEAL_X + 1 && // ...and so does its open hopper mouth (no hopper-in-the-fence)
      scoop - NK_SEAL_X >= NK_TRUCK_CLEAR - 1.5 && // ...by the full clearance the law promises
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
  "WAKING THE BEAST ARMS THE LINE, AND THE FENCE SHUTS ON THE FRAME HE CROSSES THE IRON'S FACE",
  (function () {
    p4.wx = 449;
    RING.buildNightSeal();
    RING.nightSealArm();
    const armedAbove = S4.seal.armed === true && S4.seal.closed === false && RING.nightSealClosed() === false;
    RING.updateNightSeal(1 / 60); // the armed line shows itself low on the road
    const armedMesh =
      S4.seal.g.visible === true && S4.seal.g.scale.z < 1 && S4.seal.g.userData.ward.mats[0].opacity > 0; // the armed line shows itself
    S4.seal.rise = 0;
    S4.seal.holdT = 0; // the rise-hold has run out: the wall is rising
    p4.wx = 70; // he is fully below the iron's face: the crossing closes the ring in the fight zone
    const closed = RING.nightSealClose();
    return (
      armedAbove &&
      armedMesh &&
      closed === true &&
      RING.nightSealClosed() === true &&
      S4.seal.g.visible === true &&
      S4.seal.prevWx === 70 && // the seal's own history rides the crossing frame
      said4.length > 0 &&
      bursts4.some((b) => b.x === NK_SEAL_X)
    );
  })(),
);
check(
  "THE SEALED CEILING IS A BODY-WIDTH BELOW THE IRON'S FACE (sealStandX = line - inner - stop), and the ring it closes is a real fighting ring",
  (function () {
    const ceil = RING.workerCeilX();
    const floor = NK_FENCE + NK_STANDOFF; // the bottom cemetery fence: his shipped floor
    const face = RING.sealFaceX();
    return (
      Math.abs(ceil - (NK_SEAL_X - NK_SEAL_INNER - NK_SEAL_STOP)) < 1e-9 &&
      Math.abs(ceil - RING.sealStandX()) < 1e-9 &&
      ceil < face && // the standing point is DOWN the road of the iron: never inside the wall
      ceil < NK_MESH_LO && // ...and clean out of the fence mesh's own footprint
      NK_MESH_LO - ceil <= NK_SEAL_STOP + 0.05 && // ...by barely a body — the wall IS his cover
      ceil > floor + 30 && // ...with real street under him to fight on
      ceil < RING.truckFenceFloorX() && // he is sealed BELOW the parked rig, at the graves
      NK_BOSS_X > floor && NK_BOSS_X < ceil && // the beast rises inside the ring, below the wall
      NK_GRAVE > floor && NK_GRAVE < ceil // ...and its treasure lands inside the ring
    );
  })(),
  "ceil=" + RING.workerCeilX() + " face=" + RING.sealFaceX() + " floor=" + (NK_FENCE + NK_STANDOFF),
);

check(
  "THE RISE IS AN ANIMATION, NOT A SNAP: " + NK_RISE_T + "s out of the asphalt, its light ramping in as it comes up, ending square on the road",
  (function () {
    S4.seal.rise = 0;
    S4.seal.holdT = NK_HOLD_T; // the hold budget the close hands the rise
    const z0 = S4.seal.g.position.z;
    const inMesh = (RING.sealStandX() + NK_SEAL_STOP + 2.4) >= 0; // readability: the stand is BELOW the mesh
    // STANDING IN THE FENCE'S MESH FOOTPRINT (the old bug's shape — the wall coming up on a body
    // inside it): the iron must NOT rise. It glows low at the asphalt and the crossing re-arms.
    p4.wx = NK_SEAL_X - 0.5; // a centre squarely inside the mesh band
    for (let i = 0; i < 8; i++) RING.updateNightSeal(1 / 60);
    const heldRise = S4.seal.rise, heldZ = S4.seal.g.position.z, heldWx = S4.seal.prevWx;
    // Fully clear BELOW the iron's face: the same frames now bring the wall up.
    p4.wx = RING.sealStandX() - 2;
    const zStep = S4.seal.g.position.z;
    const o1 = S4.seal.g.userData.ward.mats[0].opacity;
    for (let i = 0; i < Math.ceil(NK_RISE_T * 60) + 1; i++) RING.updateNightSeal(1 / 60);
    const ward = S4.seal.g.userData.ward;
    global.__riseDbg = { heldRise, heldZ, heldWx, face: RING.sealFaceX(), rise: S4.seal.rise };
    return (
      inMesh &&
      heldRise === 0 && // the wall waited for the body to clear its own mesh
      Math.abs(heldZ - (GZ - 3.1)) < 1e-9 && // it showed itself low at the asphalt line
      heldWx >= RING.sealFaceX() && // and the crossing re-armed while it waited
      zStep < z0 && // it starts BELOW the road and rises into frame
      S4.seal.rise === 1 &&
      o1 > 0 &&
      S4.seal.g.position.z === GZ &&
      S4.seal.g.scale.z === 1 &&
      ward.mats.every((m, i) => m.opacity > 0.2 * ward.base[i])
    );
  })(),
  JSON.stringify(global.__riseDbg || {}),
);
check(
  "THE RIG PARKS AHEAD OF THE GHOST IRON, NEVER IN IT: its fence floor sets the collision nose and the OPEN SCOOP up-street of the line, clear of the iron's own glow footprint, and clear of the worker's sealed ceiling (a sealed worker standing at the iron is never standing in the truck's collision box)",
  (function () {
    const floor = RING.truckFenceFloorX(); // the rig's centre floor
    const nose = floor - NK_TRUCK_NOSE; // its collision box edge (down-street, truck.boxL)
    const scoop = floor - 4.3; // its open hopper mouth
    const ceil = RING.sealStandX(); // the worker's sealed ceiling: below the iron's face
    return (
      floor === NK_SEAL_X + NK_TRUCK_NOSE + NK_TRUCK_CLEAR &&
      scoop > NK_SEAL_X + 1 && // the hopper stands CLEAR of the ghost fence
      nose > ceil + 1 && // ...and the rig's box never overlaps the sealed worker's line
      floor < NK_TOP_X - NK_TRAIL // ...while still sitting ON the street
    );
  })(),
  "floor=" + RING.truckFenceFloorX() + " nose=" + (RING.truckFenceFloorX() - 4),
);
check(
  "THE GHOST FENCE IS A WALL AT ITS OWN FACE: updatePlayer closes the seal on the frame his centre crosses sealFaceX (measured on the SEAL'S OWN history, never the ward's p.gatePrev), and its hard stop puts him at sealStandX — out of the iron, in the fight zone",
  (function () {
    const src = srcFn("updatePlayer");
    return (
      src.includes("nightSeal.prevWx == null ? p.wx : nightSeal.prevWx") &&
      src.includes("if (prevSeal >= sealFaceX() && p.wx < sealFaceX()) nightSealClose();") &&
      src.includes("if (nightSealClosed() && p.wx > sealStandX() && state === \"play\")") &&
      src.includes("p.wx = sealStandX();") &&
      src.includes("spawnEctoBurst(sealFaceX(), p.wy, 0.6)") &&
      src.includes("const prevSeal = nightSeal.prevWx == null ? p.wx : nightSeal.prevWx")
    );
  })(),
);
check(
  "THE WALL IS NOT WALKABLE AND NOT HABITABLE (LIVE): walking down from the boss trigger, the seal closes ON the crossing frame of the iron's face with his centre in the RING; no frame stands him inside the fence mesh; pressing uphill pins him at the sealed ceiling and he can never end past it",
  (function () {
    const face = RING.sealFaceX(), stand = RING.sealStandX();
    const meshIn = (x) => x >= NK_MESH_LO - 0.45 && x <= NK_MESH_HI + 0.45;
    RING.buildNightSeal();
    p4.wx = 115; p4.wy = 2.5; p4.shake = 0; p4.sealT = 0;
    RING.nightSealArm();
    if (!(S4.seal.armed === true && S4.seal.closed === false)) return false;
    const step = 8.5 * (1 / 60) * 0.75; // his real downhill pace
    let closedAt = -1, closedWx = 0, walkThrough = 0, stuck = 0, prevWx = p4.wx;
    for (let i = 0; i < 420; i++) {
      p4.wx -= step;
      if (p4.wx < 39.6) p4.wx = 39.6;
      const ceil = RING.nightSealClosed() ? Math.min(NK_TOP_X - NK_TRAIL, stand) : NK_TOP_X - NK_TRAIL;
      if (p4.wx > ceil) p4.wx = ceil;
      if (S4.seal.armed && !S4.seal.closed && prevWx >= face && p4.wx < face) RING.nightSealClose();
      if (RING.nightSealClosed() && p4.wx > stand) p4.wx = stand;
      RING.updateNightSeal(1 / 60);
      prevWx = p4.wx;
      if (meshIn(p4.wx) && !RING.nightSealClosed()) walkThrough++;
      if (meshIn(p4.wx) && RING.nightSealClosed()) stuck++;
      if (closedAt < 0 && RING.nightSealClosed()) { closedAt = i; closedWx = p4.wx; }
      if (closedAt >= 0 && i > closedAt + 90) break;
    }
    global.__wallDbg = { face, stand, closedAt, closedWx, walkThrough, stuck, end: p4.wx };
    return (
      closedAt >= 0 && closedWx < face && closedWx <= stand + 1e-6 && // sealed on the crossing, IN the ring
      stuck === 0 && // he never stands inside the standing wall
      RING.nightSealClosed() === true
    );
  })(),
  JSON.stringify(global.__wallDbg || {}),
);
check(
  "HE CANNOT BE TRAPPED OUTSIDE THE FIGHT ZONE (LIVE): from the middle of the ring he walks UPHILL into the standing iron — pinned at the sealed ceiling, a body-width below the iron's face, NEVER past the wall, never inside its mesh, with the beast's rise point reachable from where he stands",
  (function () {
    const face = RING.sealFaceX(), stand = RING.sealStandX();
    const meshIn = (x) => x >= NK_MESH_LO - 0.45 && x <= NK_MESH_HI + 0.45;
    p4.wx = 60; p4.wy = 0; p4.sealT = 0;
    RING.buildNightSeal();
    RING.nightSealArm(); // the wake happened with him inside the ring: sealed on the spot
    if (!RING.nightSealClosed()) return false;
    const step = 8.5 / 60; // his real uphill pace
    let pinned = 0, over = 0, stuck = 0, maxWx = 0;
    for (let i = 0; i < 420; i++) {
      p4.wx += step;
      if (RING.nightSealClosed() && p4.wx > stand) p4.wx = stand;
      RING.updateNightSeal(1 / 60);
      maxWx = Math.max(maxWx, p4.wx);
      if (Math.abs(p4.wx - stand) < 1e-6) pinned++;
      if (p4.wx > stand + 1e-6) over++;
      if (meshIn(p4.wx)) stuck++;
    }
    for (let i = 0; i < Math.ceil(NK_RISE_T * 60) + 2; i++) RING.updateNightSeal(1 / 60);
    global.__wallUpDbg = { face, stand, pinned, over, stuck, maxWx: +maxWx.toFixed(3), rise: S4.seal.rise };
    return pinned > 200 && over === 0 && stuck === 0 && maxWx <= stand + 1e-6 && S4.seal.rise === 1;
  })(),
  JSON.stringify(global.__wallUpDbg || {}),
);
check(
  "A FAT LAG FRAME CANNOT SLIP HIM THROUGH: a 21-frame step past the iron's face still closes the seal, and the hard stop lands him at the wall's fight-side point (the close is measured on the travelled segment, so a skipped crossing frame is a CLOSED frame)",
  (function () {
    const face = RING.sealFaceX(), stand = RING.sealStandX();
    p4.wx = 100; p4.sealT = 0;
    RING.buildNightSeal();
    RING.nightSealArm();
    let prevWx = p4.wx, closed = false, pos = [];
    for (let i = 0; i < 400; i++) {
      p4.wx -= 8.5 * (i % 40 === 0 ? 21 : 1) * (1 / 60) * 0.75;
      if (p4.wx < 39.6) p4.wx = 39.6;
      const ceil = RING.nightSealClosed() ? Math.min(NK_TOP_X - NK_TRAIL, stand) : NK_TOP_X - NK_TRAIL;
      if (p4.wx > ceil) p4.wx = ceil;
      if (!closed && prevWx >= face && p4.wx < face) { RING.nightSealClose(); closed = true; }
      if (RING.nightSealClosed() && p4.wx > stand) p4.wx = stand;
      prevWx = p4.wx;
      if (closed) pos.push(+p4.wx.toFixed(2)); // the street is SHUT from the crossing frame on
    }
    global.__wallSpikeDbg = { closed, end: p4.wx, max: pos.length ? Math.max.apply(null, pos) : -1, stand, frames: pos.length };
    return closed && pos.length > 120 && Math.max.apply(null, pos) <= stand + 1e-6;
  })(),
  JSON.stringify(global.__wallSpikeDbg || {}),
);
check(
  "NO BEAST HIT SHOVES ANYBODY THROUGH A FENCE: the ghost fire, the lash and the crushing body all re-seat the worker through bossRingClamp (the ring's own walls, floor to ghost iron) and NO knock-back carries the +2 leash past the iron",
  srcFn("bossRingClamp").includes("clamp(wx, workerEndHardX(), workerCeilX())") &&
    srcFn("updateBossFireballs").includes("bossRingClamp(p.wx, p.wy)") &&
    srcFn("bossWhipStrike").includes("bossRingClamp(") &&
    srcFn("updateNightBoss").includes("const crowd = bossRingClamp(") &&
    !srcFn("updateBossFireballs").includes("workerCeilX() + 2") &&
    !srcFn("bossWhipStrike").includes("workerCeilX() + 2") &&
    (html.match(/workerCeilX\(\) \+ 2/g) || []).length === 0,
);
check(
  "THE FIREBALL AND THE LASH DO NOT MOVE HIM AT ALL — the burst keeps his exact ground",
  srcFn("updateBossFireballs").includes("const fireSeat = bossRingClamp(p.wx, p.wy);") &&
    srcFn("updateBossFireballs").includes("p.wx = fireSeat.x;") &&
    srcFn("updateBossFireballs").includes("p.wy = fireSeat.y;") &&
    !/p\.wx \+= \(\(p\.wx - f\.wx\)/.test(srcFn("updateBossFireballs")) &&
    srcFn("bossWhipStrike").includes("const lashSeat = bossRingClamp(") &&
    srcFn("bossWhipStrike").includes("p.wx = lashSeat.x;"),
);
check(
  "EVERY BEAST HIT IS MINOR ON THE 100-POINT POOL: a fireball " + NK_HP_FIRE + ", a crush " + NK_HP_BODY +
    ", a lash " + NK_HP_WHIP + " (was 11 / 12 / 14) — the fire is a frostburn, not a killer",
  NK_HP_FIRE >= 1 && NK_HP_FIRE <= 4 && NK_HP_BODY <= 6 && NK_HP_WHIP <= 7 &&
    NK_HP_FIRE + NK_HP_BODY + NK_HP_WHIP <= 20,
  'fire=' + NK_HP_FIRE + ' crush=' + NK_HP_BODY + ' lash=' + NK_HP_WHIP,
);
check(
  "THE GOAL CARD AND THE WAKE BOTH TEACH THE RED WINDOW",
  /IT GLOWS <b>RED<\/b> WHEN IT IS OPEN/.test(html) &&
    srcFn("startBossFight").includes("THE HEART GLOWS RED"),
);
check(
  "THE BEAST IS WALLED INTO THE RING — AND OUT OF THE GHOST FENCE: its roam clamp runs the graves gate up to the iron's FACE minus its own body radius (NEITHER beast nor man may stand inside the wall), and the gate line stays above the bottom fence",
  (function () {
    const bodyR = srcNum("BOSS_BODY_R");
    return (
      srcFn("updateNightBoss").includes("clamp(b.wx, NIGHT_GRAVE_X - 6, sealFaceX() - BOSS_BODY_R)") &&
      NK_GRAVE - 6 > NK_FENCE + NK_STANDOFF &&
      NK_SEAL_X - NK_SEAL_INNER - bodyR < NK_SEAL_X - NK_SEAL_INNER && // its ceiling is BELOW the iron's face
      NK_SEAL_X - NK_SEAL_INNER - bodyR > NK_FENCE + NK_STANDOFF + 20 // ...and deep inside the ring
    );
  })(),
  "beast ceiling=" + (NK_SEAL_X - NK_SEAL_INNER - srcNum("BOSS_BODY_R")),
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
      ceilSealed === RING.sealStandX() &&
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
  "THE RING IS WIRED INTO THE FIGHT: the wake arms it, the crossing closes it, the BLOW-UP opens it, the shift clears it, the frame hook runs it",
  srcFn("startBossFight").includes("nightSealArm();") &&
    srcFn("bossBlownUp").includes("nightSealDrop();") &&
    srcFn("clearNightBoss").includes("nightSealClear();") &&
    srcFn("updateNightBossFight").includes("updateNightSeal(dt);") &&
    srcFn("updatePlayer").includes("p.wx > workerCeilX()") &&
    srcFn("updatePlayer").includes("nightSealClose()") &&
    srcFn("updatePlayer").includes("p.wx = sealStandX();") &&
    srcFn("updateTruck").includes("truckFenceFloorX()") &&
    srcFn("nightSealClose").includes("spawnEctoBurst(NIGHT_SEAL_X, p.wy") &&
    srcFn("nightSealArm").includes("buildNightSeal()") &&
    srcFn("updateNightSeal").includes("nightSeal.prevWx = p.wx;"),
);
check(
  "EVERY GHOST-FIRE SHOT CULLS AT THE IRON, AND NO KNOCK-BACK CARRIES A BODY PAST IT",
  srcFn("updateBossFireballs").includes("f.wx > workerCeilX() + 8") &&
    (html.match(/workerCeilX\(\) \+ 2/g) || []).length === 0 &&
    srcFn("bossRingClamp").includes("workerCeilX()"),
);
check(
  "STANDING AT THE WALL IS FIGHTING GROUND, NOT A PUNISHING NOOK: from the sealed ceiling the beast's rise point is inside lash reach, its roam ceiling keeps its bulk below the ghost fence, and the ring below him is his floor — the fight is winnable from where the wall stops him",
  (function () {
    const stand = RING.sealStandX();
    const bodyR = srcNum("BOSS_BODY_R");
    const lashR = srcNum("BOSS_WHIP_R");
    const beastCeil = NK_SEAL_X - NK_SEAL_INNER - bodyR;
    return (
      NK_BOSS_X < stand && // the beast rises DOWN the road of the wall: inside the ring with him
      Math.abs(stand - NK_BOSS_X) <= lashR && // ...close enough to trade from the wall
      beastCeil < NK_SEAL_X - NK_MESH_DN && // its bulk never stands in the fence's light
      beastCeil > NK_FENCE + NK_STANDOFF && // ...and never runs out of its yard
      NK_FENCE + NK_STANDOFF < stand && // his floor is under him: the ring, not a pocket
      // THE WALL IS COVER, NOT A SENTENCE: he can stand in the iron's light, a body off the
      // mesh, and the beast's bulk stops a full body SHORT of where he is standing.
      NK_MESH_LO - stand <= NK_SEAL_STOP + 0.05 && // he is in the ghost light at the fence
      NK_MESH_LO - beastCeil >= bodyR - 1e-9 // the beast's bulk stops AT the wall face, never through it
    );
  })(),
  "stand=" + RING.sealStandX() + " boss=" + NK_BOSS_X + " beastCeil=" + (NK_SEAL_X - NK_SEAL_INNER - srcNum("BOSS_BODY_R")),
);
// --- THE SCURRY, THE BOOM, THE SLIME AND THE WIN BEAT (the fight's last three beats) ---
check(
  "A HEART STRIKE SCURRIES IT OFF THE BLADE: the wound arms the run, cuts the lash, slams the shell, and says so",
  srcFn("bossShovelHit").includes("b.recoilT = Math.max(BOSS_SCURRY_T, BOSS_SCURRY_MIN / (BOSS_SCURRY_SP * 0.7))") &&
    srcFn("bossShovelHit").includes("b.recoilDir = scurryDir") &&
    srcFn("bossShovelHit").includes('b.heartState = "shut"') &&
    srcFn("bossShovelHit").includes("BOSS_SCURRY_LINES") &&
    srcFn("spawnNightBoss").includes("recoilT: 0") &&
    srcFn("updateNightBoss").includes("const scurrying = b.recoilT > 0;"),
);
check(
  "THE SCURRY IS ITS OWN GAIT: the run is applied on the beast only, the rig scuddes and hops on it, and the furious chase is suspended for the beat",
  srcFn("updateNightBoss").includes("b.wx += b.recoilDir * sp * dt") &&
    srcFn("updateNightBoss").includes("const scurryRoll = b.recoilT > 0") &&
    srcFn("updateNightBoss").includes('animateNightBoss(b, dt, scurryRoll ? "scurry" : "fight")') &&
    srcFn("animateNightBoss").includes('mode === "scurry" ? 2.15 : 0.45') &&
    srcFn("updateNightBoss").includes("if (furious && !scurrying)"),
);
check(
  "THE KILL IS A BLOW-UP, NOT A RIDE: the dying frame inflates the body on the spot it died on and the boom beat runs to the burst — no suction, no hopper ride",
  srcFn("killNightBoss").includes("THE BOOM") &&
    srcFn("killNightBoss").includes("b.hooked = true") &&
    srcFn("killNightBoss").includes("nightBossBanished = true") &&
    !srcFn("killNightBoss").includes("hopperDeposit") &&
    srcFn("updateNightBoss").includes("b.g.scale.setScalar(1 + k * (BOSS_BOOM_ROAR - 1))") &&
    srcFn("updateNightBoss").includes("bossBlownUp(b)") &&
    srcFn("updateNightBoss").includes("bossLandedInHopper") === false,
);
check(
  "THE BURST COATS EVERYTHING IN ECTOPLASMIC SLUG SLIME: pools on the street, drapes on the props, curtains, the ghost iron and the worker, and the goop rides out with him",
  srcFn("bossBlownUp").includes("spawnBossSlime(b.wx, b.wy, BOSS_BOOM_R)") &&
    srcFn("bossBlownUp").includes("coatInSlime(hz.g, 0.7)") &&
    srcFn("bossBlownUp").includes("coatInSlime(wd.g, 1.1)") &&
    srcFn("bossBlownUp").includes("coatInSlime(nightSeal.g, 1.1)") &&
    srcFn("bossBlownUp").includes("coatInSlime(worker && worker.group, 1.15)") &&
    srcFn("bossBlownUp").includes("p.slimeT = 1") &&
    srcFn("bossBlownUp").includes("p.pickleSteps = Math.max(p.pickleSteps || 0, BOSS_BOOM_SLIME_KEEP)") &&
    srcFn("nightSlimeBlob").includes("emissive: 0x1ec98f") &&
    srcFn("nightSlimeBlob").includes("g.scale.set(1, 0.74, 0.22)") &&
    srcFn("nightSlimeBlob").includes("nightBossSlime.push(g)") &&
    srcFn("nightSlimeClear").includes("nightBossSlime.length = 0") &&
    srcFn("clearNightBoss").includes("nightSlimeClear()"),
);
check(
  "THE SLUG DEMON DOES NOT RESPAWN: the banished flag is raised on the kill, the cross-street's wake runs past it, and a new shift (spawnNightBoss / clearNightBoss) resets it",
  srcFn("updatePlayer").includes("!bossFightOn && !nightBossBanished && p.wx <= NIGHT_BOSS_TRIGGER_X") &&
    srcFn("clearNightBoss").includes("nightBossBanished = false") &&
    srcFn("spawnNightBoss").includes("nightBossBanished = false") &&
    srcFn("bossBlownUp").includes("nightBoss = null"),
);
check(
  "THE GARGOYLE LANDS BESIDE THE WORKER, NEVER ON HIM: it spawns off his own position, downhill of him and off his lane, and the clamp keeps it inside the ring",
  srcFn("bossBlownUp").includes("spawnBossGargoyle(p.wx, p.wy)") &&
    srcFn("spawnBossGargoyle").includes("function spawnBossGargoyle(nearX, nearY)") &&
    srcFn("spawnBossGargoyle").includes("nearX - 5.5") &&
    srcFn("spawnBossGargoyle").includes("clamp(nearX - 5.5, workerEndLimitX() + 2, workerCeilX() - 2)") &&
    srcFn("spawnBossGargoyle").includes("nearY - 1.6") &&
    srcFn("spawnBossGargoyle").includes("clamp(nearY - 1.6, -4.2, 4.2)") &&
    srcFn("spawnBossGargoyle").includes("IT'S RIGHT BESIDE YOU"),
);
check(
  "THE WIN BEAT IS THE CELEBRATION: the grab arms the hop, tears the ghost fence, and hands off to the drive-off (which is the week's report)",
  srcFn("grabBossGargoyle").includes("bossWinT = BOSS_WIN_JUMP_T") &&
    srcFn("grabBossGargoyle").includes("p.winJumpT = BOSS_WIN_JUMP_T") &&
    srcFn("grabBossGargoyle").includes("nightSealDrop();") &&
    srcFn("grabBossGargoyle").includes("I'M WALKIN' TO MY TRUCK") &&
    srcFn("updateNightBossFight").includes("startRouteEnd();") &&
    srcFn("updatePlayer").includes("let winHop = 0;") &&
    srcFn("updatePlayer").includes("if (p.winJumpT > 0)") &&
    srcFn("updatePlayer").includes("wparts.armR.rotation.set(-2.26, 0, 0.3 * _sg);") &&
    srcFn("updatePlayer").includes("GZ) + winHop,"),
  (() => {
    const g = srcFn("grabBossGargoyle"), u = srcFn("updatePlayer");
    return [
      "bossWinT " + g.includes("bossWinT = BOSS_WIN_JUMP_T"),
      "winJumpT " + g.includes("p.winJumpT = BOSS_WIN_JUMP_T"),
      "seal " + g.includes("nightSealDrop();"),
      "line " + g.includes("I'M WALKIN' TO MY TRUCK"),
      "route " + srcFn("updateNightBossFight").includes("startRouteEnd();"),
      "hop " + u.includes("let winHop = 0;"),
      "arm " + u.includes("wparts.armR.rotation.set(-2.26, 0, 0.3 * _sg);"),
      "z " + u.includes("GZ + winHop,"),
    ].join(" | ");
  })(),
);
check(
  "THE SLIME AND THE SCURRY ARE SLUG-DEMON LAW ONLY (the weekday never sees a goblin)",
  srcFn("killNightBoss").includes("nightBossBanished") &&
    srcFn("bossBlownUp").includes("nightSealDrop") &&
    srcFn("spawnBossSlime").includes("BOSS_BOOM_SPLATS") &&
    srcFn("coatInSlime").includes("o.add(g)"),
);

console.log("\n" + pass + " slug-demon checks passed" + (fail ? ", " + fail + " FAILED" : " \u2014 all OK"));
if (fail) {
  console.log(failures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
