// _boss_recover_chk.js — THE WRITE-UP REBOUND (the Midnight final boss takes back its FULL
// strength when the sanitation worker is written up DURING the boss fight and the game goes on).
//
// The law under test: a LODI inside the Slug Demon's own ring — a write-up the shift carries on
// under (strike 1 of 3, or 2 of 3; the 3rd is the suspension) — FEEDS THE BEAST. Its bar goes
// straight back to the FULL maxHp (10 / 10: the whole fight from the top), the rage / fury /
// strike counts that ride on that bar reset with it, its shell seals over the gut, the ghost
// fire in the air is drawn back into the knit, and it is invulnerable while it knits. The climb
// back to 10 / 10 is ANIMATED both on the rig (the body swells off the graves in cold mint
// light, its own eyes relight one at a time, ecto sheets fly off it, the street shakes) and on
// the HUD (the fill walks back up in mint under a shine that sweeps the bar; the plate reads
// REGAINING STRENGTH!).
//
// [1] THE LAW, IN THE CODE (the rebound fires only from the write-up that continues the shift,
//     and only on Midnight; the HUD, the CSS, the rig and the shift teardown all know the beat)
// [2] THE REBOUND LIVE (the shipped bossRegainFullStrength, run on a wounded beast)
// [3] THE CLIMB LIVE (the rebound beat in the shipped updateNightBoss, frame by frame)
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
function srcHex(name) {
  const m = html.match(new RegExp("const\\s+" + name + "\\s*=\\s*(0x[0-9a-fA-F]+)"));
  if (!m) throw new Error("hex constant not found in index.html: " + name);
  return parseInt(m[1], 16);
}
function srcArr(name) {
  return eval("(" + srcLiteral(name, "[", "]") + ")");
}


// ---- the fight's own numbers, read straight out of the game ----
const BOSS_MAX_HP = srcNum("BOSS_MAX_HP");
const BOSS_BODY_R = srcNum("BOSS_BODY_R");
const BOSS_FURY_HITS = srcNum("BOSS_FURY_HITS");
const BOSS_SHOTS = srcNum("BOSS_SHOTS");
const BOSS_SHOTS_RAGE = srcNum("BOSS_SHOTS_RAGE");
const BOSS_SHOTS_FURY = srcNum("BOSS_SHOTS_FURY");
const BOSS_HEART_CD = srcArr("BOSS_HEART_CD");
const BOSS_HEART_CD_RAGE = srcNum("BOSS_HEART_CD_RAGE");
const BOSS_HEART_HOT = srcHex("BOSS_HEART_HOT");
const BOSS_HEART_DARK = srcHex("BOSS_HEART_DARK");
const BOSS_HEART_EMISS = srcNum("BOSS_HEART_EMISS");
const BOSS_WHIP_CD = srcArr("BOSS_WHIP_CD");
const BOSS_FIRE_CD = srcArr("BOSS_FIRE_CD");
const NIGHT_GRAVE_X = srcNum("NIGHT_GRAVE_X");
const RECOVER_T = srcNum("BOSS_RECOVER_T");
const RECOVER_SWELL = srcNum("BOSS_RECOVER_SWELL");
const RECOVER_LIFT = srcNum("BOSS_RECOVER_LIFT");
const RECOVER_GLOW = srcNum("BOSS_RECOVER_GLOW");
const RECOVER_MINT = srcHex("BOSS_RECOVER_MINT");
const RECOVER_INVULN = srcNum("BOSS_RECOVER_INVULN");
const RECOVER_INVULN_END = srcNum("BOSS_RECOVER_INVULN_END");
const RECOVER_LINES = srcArr("BOSS_RECOVER_LINES");
const RECOVER_WORKER_LINES = srcArr("BOSS_RECOVER_WORKER_LINES");
const RECOVER_LANDED_LINES = srcArr("BOSS_RECOVER_LANDED_LINES");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const R = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

// ==================== [1] THE LAW, IN THE CODE ====================
console.log("\n[1] THE WRITE-UP REBOUND: the law as it is wired");
check(
  "THE FULL STRENGTH IS THE FULL BAR — maxHp " +
    BOSS_MAX_HP +
    ", and the rebound's kit exists (" +
    RECOVER_T +
    "s knit, " +
    RECOVER_INVULN +
    "s knitting hide, knit light 0x" +
    RECOVER_MINT.toString(16) +
    ")",
  BOSS_MAX_HP === 10 &&
    RECOVER_T > 1 &&
    RECOVER_SWELL > 0 &&
    RECOVER_LIFT > 0 &&
    RECOVER_GLOW > 0 &&
    RECOVER_MINT > 0 &&
    RECOVER_INVULN > RECOVER_T &&
    RECOVER_INVULN_END > 0 &&
    RECOVER_LINES.length >= 2 &&
    RECOVER_WORKER_LINES.length >= 2 &&
    RECOVER_LANDED_LINES.length >= 2,
  "T=" + RECOVER_T + " invuln=" + RECOVER_INVULN,
);
const fd = srcFn("finishDying");
const guardIdx = fd.indexOf("bossRegainFullStrength");
const thirdIdx = fd.indexOf("if (n >= 3)");
check(
  "A WRITE-UP WITH THE SHIFT GOING ON FIRES THE REBOUND (the LODI hand-off is the ONLY caller)",
  guardIdx > 0 &&
    fd.includes('typeof bossRegainFullStrength === "function"') &&
    fd.includes("bossFightOn") &&
    fd.includes("isNightShift()"),
);
check(
  "THE 3rd WRITE-UP NEVER FEEDS THE BEAST: the suspension returns first, and the rebound rides only the get-up path",
  thirdIdx > 0 &&
    guardIdx > thirdIdx &&
    fd.slice(thirdIdx, guardIdx).includes("health = maxHealth;") &&
    fd.slice(thirdIdx, thirdIdx + 560).includes("return;"),
  "third@" + thirdIdx + " guard@" + guardIdx,
);
check(
  "THE REBOUND IS MIDNIGHT'S OWN LAW, AND HARNESS-SAFE (every global at the call site is typeof-guarded)",
  /typeof bossRegainFullStrength === "function" &&[\s\S]{0,240}typeof bossFightOn === "boolean" &&[\s\S]{0,240}typeof isNightShift !== "function" \|\| isNightShift\(\)/.test(fd),
);
const rec = srcFn("bossRegainFullStrength");
check(
  "THE BEAST IS ONLY FED INSIDE ITS OWN FIGHT: a cleared yard, an asleep beast, a burst beast, a dead bar, a WEEKDAY and a full bar are every one refused",
  rec.includes("if (!bossFightOn) return false;") &&
    rec.includes("if (!b || !b.awake || b.hooked || b.hp <= 0) return false;") &&
    rec.includes('if (typeof isNightShift === "function" && !isNightShift()) return false;') &&
    rec.includes("if (from >= b.maxHp && b.recoverT <= 0) return false;"),
);
check(
  "THE BAR GOES BACK TO THE TOP AND THE FURY PACKAGE GOES WITH IT: 10 / 10, the rage out, the strikes re-counted from zero, the shell slammed shut, the scurry off, the fire and the lash both waited, the ghost fire drawn in",
  rec.includes("b.hp = b.maxHp;") &&
    rec.includes("b.recoverT = BOSS_RECOVER_T;") &&
    rec.includes("b.dispHp = from;") &&
    rec.includes("b.rage = 0;") &&
    rec.includes("b.fury = 0;") &&
    rec.includes("b.hits = 0;") &&
    rec.includes('b.heartState = "shut";') &&
    rec.includes("b.invulnT = Math.max(b.invulnT, BOSS_RECOVER_INVULN);") &&
    rec.includes("b.recoilT = 0;") &&
    rec.includes("bossFireballs.length = 0;"),
);
check(
  "THE REBOUND IS LOUD: thunder, the banshee, the wet knitting tear, an ecto burst, and BOTH sides get a line",
  rec.includes("SFX.playThunder();") &&
    rec.includes("SFX.playBansheeWail();") &&
    rec.includes("SFX.playZombieGrab();") &&
    rec.includes("spawnEctoBurst(") &&
    rec.includes("pick(BOSS_RECOVER_LINES)") &&
    rec.includes("pick(BOSS_RECOVER_WORKER_LINES)"),
);
const upd = srcFn("updateNightBoss");
const beatSrc = upd.slice(
  upd.indexOf("if (b.recoverT > 0) {"),
  upd.indexOf("b.dispHp = b.hp;"),
);
check(
  "THE CLIMB IS ANIMATED ON THE RIG: the knit beat swells the body, rears it UP off the graves, burns the mint knit-light, sheds ecto, shakes the street and churns it CALM",
  beatSrc.length > 400 &&
    beatSrc.includes("b.g.scale.setScalar(1 + BOSS_RECOVER_SWELL * knit);") &&
    beatSrc.includes("knRig.light.color.setHex(BOSS_RECOVER_MINT);") &&
    beatSrc.includes("knit * BOSS_RECOVER_GLOW") &&
    beatSrc.includes("GZ + knK * BOSS_RECOVER_LIFT") &&
    beatSrc.includes('animateNightBoss(b, dt, "calm");') &&
    beatSrc.includes("spawnEctoSplat(knX, knY, 0.5);") &&
    beatSrc.includes("p.shake = Math.max(p.shake || 0, 0.3 + knit * 0.5);"),
  "beat len=" + beatSrc.length,
);

check(
  "THE BEAST DOES NOT FIGHT WHILE IT KNITS: the beat takes no swing, fires no ghost fire, lashes nobody, stuns nobody and owns the frame",
  beatSrc.includes("return;") &&
    !beatSrc.includes("bossWhipStrike(") &&
    !beatSrc.includes("spawnBossFireball(") &&
    !beatSrc.includes("hurtNPC(") &&
    !beatSrc.includes("doStun("),
);
check(
  "THE KNIT LANDS A WHOLE BEAST: a FULL bar, the drawn count caught up, the swell settled, the knit clock cleared, a FRESH full armour gap, a beat of hard hide, the shine taken off the HUD and the heart's own red back on the rig's light",
  beatSrc.includes("b.hp = b.maxHp;") &&
    beatSrc.includes("b.dispHp = b.maxHp;") &&
    beatSrc.includes("b.g.scale.setScalar(1);") &&
    beatSrc.includes("b.heartT = bossHeartCloseT(b);") &&
    beatSrc.includes("b.invulnT = Math.max(b.invulnT, BOSS_RECOVER_INVULN_END);") &&
    beatSrc.includes("knRig.light.color.setHex(") &&
    beatSrc.includes('bar.classList.remove("recover");') &&
    beatSrc.includes("pick(BOSS_RECOVER_LANDED_LINES)"),
);
const anim = srcFn("animateNightBoss");
check(
  "THE DRAWN COUNT DRIVES THE BEAST'S OWN EYE BAR, AND THE NEWEST EYE FLARES AS IT COMES BACK",
  anim.includes("const knKnit = b.recoverT > 0") &&
    anim.includes("const knHp = knKnit > 0 && b.dispHp > 0 ? b.dispHp : b.hp;") &&
    anim.includes("const lit = Math.max(0, Math.ceil((knHp / b.maxHp) * t.eyes.length));") &&
    anim.includes("t.eyes[i].scale.setScalar(i === lit - 1 ? knPop : 1);"),
);
check(
  "THE HUD BAR CLIMBS ON THE DRAWN COUNT, THE PLATE READS REGAINING STRENGTH! AND THE EYE TALLY READS REGAINING (the shipped width line stays the beast's real bar)",
  html.includes("const rec = b.recoverT > 0;") &&
    html.includes("const dispHp = rec && b.dispHp > 0 ? b.dispHp : b.hp;") &&
    html.includes('const wDraw = rec ? ((dispHp / b.maxHp) * 100).toFixed(1) + "%" : w;') &&
    html.includes('bossPanel.classList.toggle("recover", rec);') &&
    html.includes('"  REGAINING STRENGTH!"') &&
    html.includes('"  REGAINING"') &&
    html.includes('const w = ((b.hp / b.maxHp) * 100).toFixed(1) + "%";'),
);
check(
  "THE CSS ANIMATES THE CLIMB: a mint fill with its own width transition, a mint frame under a shine that sweeps the whole bar, a flickering plate",
  html.includes("#boss-goal.recover #boss-hpfill {") &&
    /#boss-goal\.recover #boss-hpfill \{[^}]*transition: width[^}]*\}/.test(html) &&
    html.includes("#boss-goal.recover #boss-hpbar::after {") &&
    html.includes("animation: bossHealSweep 0.8s linear infinite;") &&
    html.includes("animation: bossHealName 0.6s infinite;") &&
    html.includes("@keyframes bossHealSweep") &&
    html.includes("@keyframes bossHealName"),
);
check(
  "THE BEAST RECORD CARRIES THE CLIMB, AND A FRESH SHIFT CLEARS THE SHINE (no mint bar riding into the next night)",
  srcFn("spawnNightBoss").includes("recoverT: 0,") &&
    srcFn("spawnNightBoss").includes("recoverT0: 0,") &&
    srcFn("spawnNightBoss").includes("recoverFrom: 0,") &&
    srcFn("spawnNightBoss").includes("dispHp: BOSS_MAX_HP,") &&
    srcFn("clearNightBoss").includes('bar.classList.remove("recover");') &&
    srcFn("clearNightBoss").includes('bar.classList.remove("heart");'),
);
check(
  "HR HAS AN OFFENSE FOR THE RING: a LODI to the Slug Demon is stamped as a BEAST write-up (the stamp the rebound rides on)",
  /beast: \[\s*"Failure to shovel a licensed community demon",/.test(html) &&
    html.includes('hurtNPC(BOSS_HP_FIRE, "beast", false, false);'),
);

// ============ THE LIVE HARNESS: the SHIPPED functions, run for real on a real rig =========
// The DOM, SFX, Voice and effects the fight reaches for are spies, and the beast is the real
// Slug Demon — built with the shipped three.js and the shipped makeTentacleBoss.
const domEls = {};
const classLog = [];
function $(id) {
  if (!domEls[id])
    domEls[id] = {
      id: id,
      style: {},
      _set: new Set(),
      classList: {
        add: (c) => {
          domEls[id]._set.add(c);
          classLog.push(id + " +" + c);
        },
        remove: (c) => {
          domEls[id]._set.delete(c);
          classLog.push(id + " -" + c);
        },
        toggle: (c, on) => {
          if (on) domEls[id]._set.add(c);
          else domEls[id]._set.delete(c);
          classLog.push(id + (on ? " +" : " -") + c);
        },
        contains: (c) => domEls[id]._set.has(c),
      },
    };
  return domEls[id];
}
const sfxSpy = [];
const SFX = {};
[
  "playThunder",
  "playBansheeWail",
  "playZombieGrab",
  "playZombieGroan",
  "playSqueal",
  "playSquelch",
  "playSwoosh",
  "playGustSound",
  "playBeastSting",
  "playComplaintSound",
].forEach((k) => {
  SFX[k] = () => sfxSpy.push(k);
});
const voiceSpy = [];
const Voice = {
  say: (line, a, b, wx, wy, g, who) => voiceSpy.push({ line: line, who: who }),
};
const splatSpy = [];
const burstSpy = [];
const hurtSpy = [];
const culledSpy = [];
const p = { wx: 20, wy: 0, shake: 0, nightHitT: 0, invuln: 0 };
const GZ = 0.3;
const night = { on: true };
const sealFaceX = () => 90; // the ghost iron: the ring's ceiling, deep uphill of the graves
const M = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
const BX = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const CY = (r1, r2, h, m, s, hs) =>
  new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10, hs || 1), m);
const SP = (r, m, s) => new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m);
const SPH = (r, m, ws, hs) => new THREE.Mesh(new THREE.SphereGeometry(r, ws || 14, hs || 10), m);
const NK = new Function(
  "clamp",
  "R",
  "pick",
  "THREE",
  "M",
  "BX",
  "CY",
  "SP",
  "SPH",
  "GZ",
  "NIGHT_GRAVE_X",
  "BOSS_BODY_R",
  "BOSS_FURY_HITS",
  "BOSS_HEART_HOT",
  "BOSS_HEART_DARK",
  "BOSS_HEART_EMISS",
  "BOSS_HEART_CD",
  "BOSS_HEART_CD_RAGE",
  "BOSS_WHIP_CD",
  "BOSS_FIRE_CD",
  "BOSS_SHOTS",
  "BOSS_SHOTS_RAGE",
  "BOSS_SHOTS_FURY",
  "BOSS_RECOVER_T",
  "BOSS_RECOVER_SWELL",
  "BOSS_RECOVER_LIFT",
  "BOSS_RECOVER_GLOW",
  "BOSS_RECOVER_MINT",
  "BOSS_RECOVER_INVULN",
  "BOSS_RECOVER_INVULN_END",
  "BOSS_RECOVER_LINES",
  "BOSS_RECOVER_WORKER_LINES",
  "BOSS_RECOVER_LANDED_LINES",
  "WORKER_GENDER",
  "p",
  "SFX",
  "Voice",
  "$",
  "spawnEctoSplat",
  "spawnEctoBurst",
  "disposeObj",
  "nightSayOk",
  "nightPopOk",
  "announcePower",
  "sealFaceX",
  "isNightShift",
  "hurtNPC",
  srcFn("makeTentacleBoss") +
    srcFn("bossFuryOf") +
    srcFn("bossIsFurious") +
    srcFn("bossFireShots") +
    srcFn("bossHeartCloseT") +
    srcFn("killBossFireball") +
    srcFn("animateNightBoss") +
    srcFn("bossRegainFullStrength") +
    srcFn("updateNightBoss") +
    "\nlet nightBoss = null, bossFightOn = false, bossFireballs = [];" +
    "\nreturn { makeRig: makeTentacleBoss, regain: bossRegainFullStrength, update: updateNightBoss," +
    " furyOf: bossFuryOf, furious: bossIsFurious, shots: bossFireShots," +
    " getBoss: () => nightBoss, setBoss: (v) => { nightBoss = v; }," +
    " getFight: () => bossFightOn, setFight: (v) => { bossFightOn = v; }," +
    " getFire: () => bossFireballs, setFire: (v) => { bossFireballs = v; } };",
)(
  clamp,
  R,
  pick,
  THREE,
  M,
  BX,
  CY,
  SP,
  SPH,
  GZ,
  NIGHT_GRAVE_X,
  BOSS_BODY_R,
  BOSS_FURY_HITS,
  BOSS_HEART_HOT,
  BOSS_HEART_DARK,
  BOSS_HEART_EMISS,
  BOSS_HEART_CD,
  BOSS_HEART_CD_RAGE,
  BOSS_WHIP_CD,
  BOSS_FIRE_CD,
  BOSS_SHOTS,
  BOSS_SHOTS_RAGE,
  BOSS_SHOTS_FURY,
  RECOVER_T,
  RECOVER_SWELL,
  RECOVER_LIFT,
  RECOVER_GLOW,
  RECOVER_MINT,
  RECOVER_INVULN,
  RECOVER_INVULN_END,
  RECOVER_LINES,
  RECOVER_WORKER_LINES,
  RECOVER_LANDED_LINES,
  "male",
  p,
  SFX,
  Voice,
  $,
  (wx, wy, s) => splatSpy.push(s),
  (wx, wy, s) => burstSpy.push(s),
  (g) => culledSpy.push(g),
  () => true,
  () => true,
  (t) => sfxSpy.push("POP:" + t),
  sealFaceX,
  () => night.on,
  (hp, cause) => hurtSpy.push(cause),
);


// A wounded beast on its own ring, with some ghost fire still in the air
function wounded(hpLeft) {
  const g = NK.makeRig();
  g.visible = true;
  const b = {
    type: "boss",
    bossEntity: true,
    g: g,
    wx: NIGHT_GRAVE_X,
    wy: 1.4,
    facing: -Math.PI / 2,
    hp: hpLeft,
    maxHp: BOSS_MAX_HP,
    awake: true,
    hooked: false,
    invulnT: 0,
    rage: hpLeft <= Math.ceil(BOSS_MAX_HP / 2) ? 1 : 0,
    fury: 0,
    hits: 0,
    heartState: "shut",
    heartT: 1.2,
    heartOpen: 0,
    armCharge: 0,
    armSide: 1,
    shotIdx: 0,
    phase: 0,
    riseT: 0,
    whipT: 1.2,
    whipState: "idle",
    whipSide: 0,
    whipSwing: 0,
    fireT: 1.5,
    mawOpen: 0,
    bodyCd: 0,
    suckT: 0,
    recoilT: 0,
    recoilDir: -1,
    fx0: 0,
    fy0: 0,
    fz0: 0,
    hurtT: 0,
    recoverT: 0,
    recoverT0: 0,
    recoverFrom: 0,
    dispHp: hpLeft,
  };
  NK.setBoss(b);
  NK.setFight(true);
  NK.setFire(
    [0, 1].map(() => ({
      g: { parent: { remove: (x) => culledSpy.push(x) }, position: { set() {} } },
      wx: 30,
      wy: 0,
      z: 1,
    })),
  );
  sfxSpy.length = 0;
  voiceSpy.length = 0;
  splatSpy.length = 0;
  burstSpy.length = 0;
  hurtSpy.length = 0;
  culledSpy.length = 0;
  classLog.length = 0;
  p.wx = NIGHT_GRAVE_X - 8; // the man standing off it, inside the ring
  p.wy = 0;
  p.shake = 0;
  night.on = true;
  return b;
}

// ==================== [2] THE REBOUND LIVE ====================
console.log("\n[2] THE REBOUND LIVE: the write-up lands IN the ring and the shift carries on");
{
  const b = wounded(4);
  b.hits = BOSS_FURY_HITS + 1;
  b.fury = 1;
  b.rage = 1;
  b.heartState = "open";
  b.heartOpen = 1;
  b.recoilT = 0.5;
  b.hurtT = 0.4;
  const got = NK.regain();
  check(
    "THE STAMP FEEDS THE BEAST: the rebound fires and the bar is back at a FULL " +
      BOSS_MAX_HP +
      " / " +
      BOSS_MAX_HP +
      " — every eye the shovel knocked out",
    got === true && b.hp === BOSS_MAX_HP && b.maxHp === BOSS_MAX_HP,
    "hp=" + b.hp + "/" + b.maxHp,
  );
  check(
    "THE CLIMB IS ARMED: the knit clock, the eye count it starts from, and the count the bar DRAWs (4 on a 4-of-10 beast)",
    b.recoverT === RECOVER_T && b.recoverT0 === RECOVER_T && b.recoverFrom === 4 && b.dispHp === 4,
    "recoverT=" + b.recoverT + " dispHp=" + b.dispHp,
  );
  check(
    "THE FULL-BAR FIGHT COMES BACK WITH THE BAR: no rage, no fury, the strikes re-counted from zero, the shell slammed shut, the scurry off, the lashing and the volley both waited",
    b.rage === 0 &&
      b.fury === 0 &&
      b.hits === 0 &&
      b.heartState === "shut" &&
      b.heartOpen === 0 &&
      b.recoilT === 0 &&
      b.hurtT === 0 &&
      b.whipState === "idle" &&
      b.whipT >= BOSS_WHIP_CD[0] &&
      b.fireT >= BOSS_FIRE_CD[0] &&
      NK.furyOf(b) === 0 &&
      NK.furious(b) === false,
    "hits=" + b.hits + " fury=" + b.fury + " rage=" + b.rage,
  );
  check(
    "THE KNITTING HIDE IS HARD (the rebound cannot be clawed back with a lucky swing in its first frame)",
    b.invulnT >= RECOVER_INVULN,
    "invulnT=" + b.invulnT,
  );
  check(
    "THE GHOST FIRE IN THE AIR IS DRAWN BACK INTO THE KNIT: the shot list is emptied and its meshes culled",
    NK.getFire().length === 0 && culledSpy.length >= 2,
    "culled=" + culledSpy.length,
  );
  check(
    "THE HUD BAR GOES MINT THE FRAME THE STAMP LANDS (.recover lights the climb)",
    !!domEls["boss-goal"] && domEls["boss-goal"].classList.contains("recover"),
  );
  check(
    "THE BEAT IS HEARD: thunder, the banshee and the wet knitting tear, with an ecto burst blown off the graves",
    sfxSpy.indexOf("playThunder") >= 0 &&
      sfxSpy.indexOf("playBansheeWail") >= 0 &&
      sfxSpy.indexOf("playZombieGrab") >= 0 &&
      burstSpy.length >= 1,
    sfxSpy.join(","),
  );
  check(
    "THE STREET TALKS ABOUT IT: the beast gloats and the worker says it OUT LOUD — the bar is back at " +
      BOSS_MAX_HP +
      " out of 10",
    voiceSpy.filter((v) => v.who === "ghost").length >= 1 &&
      voiceSpy.filter((v) => v.who === "worker").length >= 1 &&
      RECOVER_LINES.concat(RECOVER_WORKER_LINES).some((l) => voiceSpy.some((v) => v.line === l)) &&
      voiceSpy.some((v) => /EYE|WHOLE|TEN OUT OF TEN/.test(v.line)),
    voiceSpy.map((v) => v.line).join(" | "),
  );
  check("THE STREET SHAKES ON THE KNIT", p.shake >= 1.0, "shake=" + p.shake);
  check("THE BEAT COSTS THE WORKER NOTHING: no beast contact, no stun, his own ground", hurtSpy.length === 0);
  NK.setBoss(null);
  NK.setFight(false);
}

{
  // Every door into the rebound, and every door that must stay SHUT
  const A = wounded(3);
  A.hp = BOSS_MAX_HP;
  const fullBar = NK.regain();
  night.on = true;
  const B = wounded(2);
  night.on = false; // the WEEKDAY never has a beast, and never runs this code
  const weekday = NK.regain();
  night.on = true;
  const C = wounded(2);
  NK.setFight(false);
  const clearedYard = NK.regain();
  const D = wounded(2);
  D.awake = false;
  const asleep = NK.regain();
  const E = wounded(2);
  E.hooked = true;
  const bursting = NK.regain();
  const F = wounded(0);
  const deadBar = NK.regain();
  check(
    "NOTHING IS FED WHEN THERE IS NOTHING TO FEED: a full bar, a WEEKDAY, a cleared yard, an asleep beast, a bursting beast and a dead bar are every one refused, and no bar moves",
    fullBar === false &&
      weekday === false &&
      clearedYard === false &&
      asleep === false &&
      bursting === false &&
      deadBar === false &&
      B.hp === 2 &&
      C.hp === 2 &&
      D.hp === 2 &&
      E.hp === 2 &&
      F.hp === 0,
    "full=" + fullBar + " wk=" + weekday + " yard=" + clearedYard + " asleep=" + asleep + " burst=" + bursting + " dead=" + deadBar,
  );
}

// =============== [3] THE CLIMB LIVE (the rebound beat in updateNightBoss) ================
console.log("\n[3] THE CLIMB: the rebound beat, animated on the rig and on the bar");
{
  const b = wounded(3);
  b.hits = 5;
  b.fury = 1;
  b.rage = 1;
  b.heartState = "open";
  b.heartOpen = 1;
  const rig = b.g,
    tent = rig.userData.tent;
  const startColor = tent.light.color.getHex();
  const eyesN = tent.eyes.length;
  const pwx0 = p.wx,
    pwy0 = p.wy;
  sfxSpy.length = 0;
  classLog.length = 0;
  splatSpy.length = 0;
  NK.regain(); // the stamp lands: the knit beat starts, the shine lights with it
  let prev = b.dispHp,
    monotone = true,
    steps = 0,
    maxScale = rig.scale.x,
    mintSeen = false,
    liftSeen = 0,
    flareSeen = 0;
  const hpTrack = [],
    dispTrack = [],
    eyeCounts = [];
  while (b.recoverT > 0 && steps < 600) {
    NK.update(b, 1 / 60);
    steps++;
    if (b.dispHp < prev) monotone = false;
    prev = b.dispHp;
    dispTrack.push(b.dispHp);
    hpTrack.push(b.hp);
    maxScale = Math.max(maxScale, rig.scale.x);
    liftSeen = Math.max(liftSeen, rig.position.z - GZ);
    flareSeen = Math.max(flareSeen, tent.light.intensity);
    if (tent.light.color.getHex() === RECOVER_MINT) mintSeen = true;
    eyeCounts.push(tent.eyes.filter((e) => e.visible).length);
  }
  const litFirst = eyeCounts[0],
    litLast = eyeCounts[eyeCounts.length - 1];
  const distinctLit = eyeCounts.filter((n, i) => i === 0 || eyeCounts[i - 1] !== n);
  const dispSteps = dispTrack.filter((v, i) => i === 0 || v !== dispTrack[i - 1]).length;


  check(
    "THE BAR WALKS BACK UP IN MINT: " +
      dispTrack[0] +
      " -> " +
      dispTrack[dispTrack.length - 1] +
      " of " +
      BOSS_MAX_HP +
      ", one knot at a time and never a step back down",
    monotone && dispTrack[dispTrack.length - 1] === BOSS_MAX_HP && dispSteps >= 5,
    dispTrack.join("->"),
  );
  check(
    "THE FIGHT IS AT FULL STRENGTH FROM THE FIRST FRAME OF THE CLIMB (the real bar never dips — the climb is the DRAWN bar)",
    hpTrack.length > 20 && hpTrack.every((v) => v === BOSS_MAX_HP),
    "frames=" + hpTrack.length,
  );
  check(
    "THE CLIMB RUNS THE WHOLE KNIT BEAT (" +
      RECOVER_T +
      "s): the bar takes " +
      (steps / 60).toFixed(2) +
      "s to walk home, then the beat hands the fight back",
    Math.abs(steps / 60 - RECOVER_T) < 0.12 && b.recoverT === 0,
    "frames=" + steps,
  );
  check(
    "THE BEAST'S OWN EYES RELIGHT ONE AT A TIME ON THE CLIMB (" +
      litFirst +
      " lit, walking up to " +
      litLast +
      " of " +
      eyesN +
      ")",
    litFirst < litLast && litLast === eyesN && distinctLit.length >= 4,
    "lit=" + distinctLit.join(","),
  );
  check(
    "THE BODY SWELLS WITH THE KNIT, REARS UP OFF ITS GRAVES IN COLD MINT LIGHT AND SETTLES BACK ON THE BAR",
    maxScale > 1.05 &&
      Math.abs(rig.scale.x - 1) < 1e-9 &&
      liftSeen > 0.05 &&
      flareSeen > 1 &&
      mintSeen &&
      tent.light.color.getHex() === startColor,
    "swell=" + maxScale.toFixed(3) + " lift=" + liftSeen.toFixed(3) + " glow=" + flareSeen.toFixed(2) + " mint=" + mintSeen,
  );
  check(
    "SHEETS OF COLD LIGHT COME OFF THE KNIT (ecto splats across its own graves, every one a thin wet mark)",
    splatSpy.length >= 2 && splatSpy.every((s) => s > 0 && s <= 0.75),
    "splats=" + splatSpy.length,
  );
  check(
    "THE BEAST FIRES NOTHING AND TOUCHES NOBODY WHILE IT KNITS: no ghost-fire volley, no lash, no crush — and the worker keeps his exact ground",
    sfxSpy.indexOf("playGustSound") < 0 &&
      sfxSpy.indexOf("playSwoosh") < 0 &&
      hurtSpy.length === 0 &&
      p.wx === pwx0 &&
      p.wy === pwy0,
    "sfx=" + sfxSpy.join(","),
  );
  check(
    "THE KNIT LANDS WHOLE: 10 / 10 drawn AND real, the swell down, the knit clocks cleared, a beat of hard hide left on it, the shell sealed with a FRESH full armour gap",
    b.hp === BOSS_MAX_HP &&
      b.dispHp === BOSS_MAX_HP &&
      b.recoverT === 0 &&
      b.recoverT0 === 0 &&
      b.invulnT >= RECOVER_INVULN_END &&
      b.heartState === "shut" &&
      b.heartT > 1.0 &&
      b.heartOpen === 0,
    "heartT=" + b.heartT.toFixed(2) + " invuln=" + b.invulnT.toFixed(2),
  );
  check(
    "THE SHINE GOES OUT WITH THE CLIMB (the HUD's .recover rides the beat and comes off the frame the bar lands)",
    classLog.some((c) => /\+recover/.test(c)) &&
      classLog.some((c) => /-recover/.test(c)) &&
      !domEls["boss-goal"].classList.contains("recover"),
    classLog.join(" | "),
  );
  check(
    "THE FIGHT RESUMES AT THE TOP OF THE BAR: fury 0, the fury gate shut, ONE ball per volley again — the same " +
      BOSS_MAX_HP +
      " swings the fight began with",
    NK.furyOf(b) === 0 && NK.furious(b) === false && NK.shots(b) === BOSS_SHOTS,
    "shots=" + NK.shots(b),
  );
  check(
    "ONE STAMP, ONE REBOUND: a full bar after the climb takes back nothing (a rebound never stacks a second climb)",
    NK.regain() === false && b.hp === BOSS_MAX_HP && b.recoverT === 0,
  );
  NK.setBoss(null);
  NK.setFight(false);
}

// ==================== SUMMARY ======================================
console.log("\n" + "=".repeat(52));
if (fail) {
  console.log(fail + " WRITE-UP REBOUND check(s) FAILED:");
  failures.forEach((f) => console.log("  - " + f));
  console.log(pass + " passed, " + fail + " failed");
  process.exit(1);
}
console.log(pass + " write-up rebound checks passed — all OK");
process.exit(0);

