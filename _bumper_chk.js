// _bumper_chk.js — validate the "arcade bump" pass in index.html:
//   - walking civilians (ped / lady / dogwalker / breaker / yeller / hooker /
//     skater / escooter) now deal VERY MINOR damage (HP_HIT_BUMPER = 1) when the
//     worker touches them, tagged to the NPC for the WRITTEN UP! stamp, and fire a
//     snarky speech bubble.
//   - the old "SOLID push" (shove the worker out of the way) is gone - the crowd is
//     a damage aura, not a wall.
//   - jacker keeps his own (heavier) damage action; crazy / panhandler / scholar
//     keep theirs.
//   - the EXCLUDED animals (raccoon / squirrel / rat) keep their old flee-and-trip
//     behavior and deal NO damage; static hazards (trees / hydrants / litter / piss
//     bottles) are untouched (collideStatic is a different function).
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

function extractFn(name) {
  const idx = html.indexOf("function " + name + "(");
  if (idx < 0) throw new Error("function not found: " + name);
  const b = html.indexOf("{", idx);
  let d = 0,
    i = b;
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
let pass = 0,
  fail = 0;
function check(n, cond) {
  if (cond) {
    pass++;
    console.log("  ok   " + n);
  } else {
    fail++;
    console.error("  FAIL " + n);
  }
}

console.log("[1] damage constant (very minor)");
check("HP_HIT_BUMPER exists and is VERY MINOR (1 HP)", /const HP_HIT_BUMPER = 1;/.test(html));
check(
  "HP_HIT_BUMPER is lighter than a hazard / vehicle",
  (function () {
    const m = html.match(/const HP_HIT_BUMPER = (\d+)/);
    const h = html.match(/const HP_HIT_HAZARD = (\d+)/);
    const v = html.match(/const HP_HIT_VEHICLE = (\d+)/);
    return m && h && v && +m[1] < +h[1] && +m[1] < +v[1];
  })(),
);

console.log("[2] arcade-bump branch in collideCreatures");
const marker = html.indexOf("// ARCADE BUMP:");
check("arcade-bump branch present in collideCreatures", marker >= 0);
const openIdx = html.lastIndexOf("if (", marker);
const b = html.indexOf("{", openIdx);
let depth = 0,
  i = b;
for (; i < html.length; i++) {
  if (html[i] === "{") depth++;
  else if (html[i] === "}") {
    depth--;
    if (!depth) {
      i++;
      break;
    }
  }
}
const branch = html.slice(openIdx, i);
check("branch covers all 8 walking civilians", branch.indexOf('c.type === "ped"') >= 0 && branch.indexOf('c.type === "escooter"') >= 0 && branch.indexOf('c.type === "lady"') >= 0);
check("branch deals very minor damage tagged to the NPC", branch.indexOf("hurtNPC(HP_HIT_BUMPER, c.type)") >= 0);
check("branch keeps the jacker's own damage action", branch.indexOf('hurtNPC(HP_HIT_JACKER, "jacker")') >= 0);
check("branch has a per-NPC cooldown (c.vcd)", branch.indexOf("c.vcd = 2.5") >= 0);
check("the CONTINUOUS SOLID push-out (pen-based) is GONE", branch.indexOf("p.wx += nx * (pen + 0.05)") < 0 && branch.indexOf("const pen = rad - d") < 0);
check("a DISCRETE bounce-back is present (fixed shove + trip)", branch.indexOf("p.wx += nx * 1.0") >= 0 && branch.indexOf('doStun(0.4, "trip")') >= 0);
check("ped bubble: 'Hey! Watch it!'", branch.indexOf('"Hey! Watch it!"') >= 0);
check("dogwalker bubble: the dog barks", branch.indexOf('"WOOF! WOOF! WOOF!"') >= 0);
check("hooker bubble: 'Conducting business, hon.'", branch.indexOf('"Conducting business, hon."') >= 0);
check("skater bubble: 'Whoa! Like, watch it, bro!'", branch.indexOf('"Whoa! Like, watch it, bro!"') >= 0);
check("escooter bubble: 'I'm calling a lawyer!'", branch.indexOf("I'm calling a lawyer!") >= 0);
check("yeller bubble: 'Damn fentanyl addicts!'", branch.indexOf('"Damn fentanyl addicts!"') >= 0);
check("breaker bubble: 'Dude! I was mid-set!'", branch.indexOf('"Dude! I was mid-set!"') >= 0);
check("lady bubble: 'Excuse me, sir!'", branch.indexOf('"Excuse me, sir!"') >= 0);

console.log("[3] the excluded animals still deal NO damage");
const animalIdx = html.indexOf('if (c.type === "rat")');
check("rat / squirrel / raccoon branch present (after the arcade block)", animalIdx > marker);
const animalBlock = html.slice(animalIdx, html.indexOf("} else {", animalIdx));
check("the animal branch does NOT call hurtNPC (no damage)", animalBlock.indexOf("hurtNPC") < 0);
check("raccoon keeps its flee + trip (unchanged)", animalBlock.indexOf("c.flee = 2.2") >= 0 && animalBlock.indexOf('doStun(0.7, "trip")') >= 0);
check("squirrel keeps its trip (unchanged)", animalBlock.indexOf('doStun(0.5, "trip")') >= 0);

console.log("[4] write-up reasons for the sidewalk crowd");
const wrS = html.indexOf("const WRITEUP_REASONS = {");
const wrE = html.indexOf("};", wrS);
const REASONS = eval(html.slice(wrS, wrE + 1).replace("const ", ""));
// the user's two explicit examples
check("dogwalker write-up cites 'Pestering the pets' (user example)", !!REASONS.dogwalker && REASONS.dogwalker.indexOf("Pestering the pets") >= 0);
check("hooker write-up cites 'Conducting non-city business while on city time' (user example)", !!REASONS.hooker && REASONS.hooker.indexOf("Conducting non-city business while on city time") >= 0);
["ped", "lady", "dogwalker", "hooker", "skater", "yeller", "breaker"].forEach((c) => {
  check("WRITEUP_REASONS." + c + " exists with >= 1 line", Array.isArray(REASONS[c]) && REASONS[c].length >= 1);
});
check("WRITEUP_REASONS.escooter is kept (sidewalk scooterist)", Array.isArray(REASONS.escooter) && REASONS.escooter.length >= 1);
const writeupReason = new Function("WRITEUP_REASONS", extractFn("writeupReason") + "\n;return writeupReason;")(REASONS);
["ped", "lady", "dogwalker", "hooker", "skater", "yeller", "breaker", "escooter"].forEach((c) => {
  const line = writeupReason(c);
  check("writeupReason('" + c + "') resolves to a real stamped line", !!REASONS[c] && REASONS[c].indexOf(line) >= 0);
});

console.log("[5] RUNTIME: the real arcade-bump branch deals damage + fires the bubble + bounces the worker");
const voices = [];
const Voice = { say: (t, v1, v2, wx, wy, g, type) => voices.push({ t, g, type }) };
const rec = { hurt: 0, dmg: 0, cause: null };
const hurtNPC = (a, cause) => {
  rec.hurt++;
  rec.dmg += a;
  rec.cause = cause;
};
const HP_HIT_JACKER = 2;
const HP_HIT_BUMPER = 1;
const WORKER_GENDER = "male";
// shims for the bounce-back (worker position shove + light trip)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const workerMaxY = () => 20;
let stunCalls = [];
const doStun = (d, t) => stunCalls.push({ d, t });
const runBump = new Function(
  "c",
  "p",
  "Voice",
  "hurtNPC",
  "HP_HIT_JACKER",
  "HP_HIT_BUMPER",
  "WORKER_GENDER",
  "clamp",
  "workerMaxY",
  "doStun",
  "d2",
  "dx",
  "dy",
  branch,
);
function makeC(type) {
  return { type: type, wx: 100, wy: 4, vcd: 0, gender: "male", bark: 0 };
}
const p = { wx: 100.5, wy: 4 };
// worker at p, NPC at c -> dx = c.wx - p.wx = -0.5, dy = 0, d2 = 0.25 (within bump radius)
const d2 = 0.25,
  dx = -0.5,
  dy = 0;
const reset = () => {
  rec.hurt = 0;
  rec.dmg = 0;
  rec.cause = null;
  voices.length = 0;
  stunCalls.length = 0;
  p.wx = 100.5;
  p.wy = 4;
};
// (a) pedestrian: very minor nick, tagged 'ped', snarky bubble, worker BOUNCES back
let c = makeC("ped");
reset();
const wx0 = p.wx;
runBump(c, p, Voice, hurtNPC, HP_HIT_JACKER, HP_HIT_BUMPER, WORKER_GENDER, clamp, workerMaxY, doStun, d2, dx, dy);
check("ped bump: VERY MINOR damage (exactly 1 HP)", rec.hurt === 1 && rec.dmg === 1);
check("ped bump: the offense is tagged to the pedestrian", rec.cause === "ped");
check("ped bump: a snarky bubble fired", voices.some((v) => v.t === "Hey! Watch it!" && v.type === "ped"));
check("ped bump: the worker IS bounced back (visible reaction)", Math.abs(p.wx - wx0) > 0.5);
check("ped bump: the worker trips a touch (doStun fired)", stunCalls.length === 1 && stunCalls[0].t === "trip" && stunCalls[0].d === 0.4);
// (b) cooldown: an immediate re-bump does nothing (no damage, no bounce)
const wx1 = p.wx;
runBump(c, p, Voice, hurtNPC, HP_HIT_JACKER, HP_HIT_BUMPER, WORKER_GENDER, clamp, workerMaxY, doStun, d2, dx, dy);
check("cooldown: an immediate re-bump does NOT re-damage (c.vcd armed)", rec.hurt === 1 && c.vcd > 2);
check("cooldown: an immediate re-bump does NOT re-bounce", p.wx === wx1);
// (c) each other walking civilian: 1 HP nick + its line, tagged to itself, bounces
[
  ["lady", "Excuse me, sir!"],
  ["hooker", "Conducting business, hon."],
  ["skater", "Whoa! Like, watch it, bro!"],
  ["escooter", "I'm calling a lawyer!"],
  ["yeller", "Damn fentanyl addicts!"],
  ["breaker", "Dude! I was mid-set!"],
].forEach(([type, line]) => {
  c = makeC(type);
  reset();
  const wx0c = p.wx;
  runBump(c, p, Voice, hurtNPC, HP_HIT_JACKER, HP_HIT_BUMPER, WORKER_GENDER, clamp, workerMaxY, doStun, d2, dx, dy);
  check(type + " bump: 1 HP nick tagged to '" + type + "'", rec.hurt === 1 && rec.dmg === 1 && rec.cause === type);
  check(type + " bump: fires '" + line + "'", voices.some((v) => v.t === line));
  check(type + " bump: worker bounces back + trips", Math.abs(p.wx - wx0c) > 0.5 && stunCalls.length === 1);
});
// (d) dogwalker: the dog barks (speaker 'dog'), 1 HP nick tagged to 'dogwalker', bounces
c = makeC("dogwalker");
reset();
const wx0d = p.wx;
runBump(c, p, Voice, hurtNPC, HP_HIT_JACKER, HP_HIT_BUMPER, WORKER_GENDER, clamp, workerMaxY, doStun, d2, dx, dy);
check("dogwalker bump: 1 HP nick tagged to 'dogwalker'", rec.hurt === 1 && rec.dmg === 1 && rec.cause === "dogwalker");
check("dogwalker bump: the dog barks (speaker 'dog')", voices.some((v) => v.t === "WOOF! WOOF! WOOF!" && v.type === "dog"));
check("dogwalker bump: the bark animation is armed", c.bark > 0);
check("dogwalker bump: worker bounces back + trips", Math.abs(p.wx - wx0d) > 0.5 && stunCalls.length === 1);
// (e) jacker KEEPS his own (heavier) damage action + both lines, and still bounces
c = makeC("jacker");
reset();
const wx0j = p.wx;
runBump(c, p, Voice, hurtNPC, HP_HIT_JACKER, HP_HIT_BUMPER, WORKER_GENDER, clamp, workerMaxY, doStun, d2, dx, dy);
check("jacker bump: keeps his own whack (2 HP, tagged 'jacker', not the bumper)", rec.hurt === 1 && rec.dmg === 2 && rec.cause === "jacker");
check("jacker bump: fires 'Don't mess with city progress!' for BOTH parties", voices.filter((v) => v.t === "Don't mess with city progress!").length === 2);
check("jacker bump: worker bounces back + trips (he's hurtful too)", Math.abs(p.wx - wx0j) > 0.5 && stunCalls.length === 1);

console.log("BUMP CHECKS: " + (pass + fail) + " run, " + pass + " ok, " + fail + " fail");
if (fail > 0) process.exit(1);