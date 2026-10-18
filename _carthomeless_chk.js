// _carthomeless_chk.js — the Harlem BIRD-SEED HOMELESS MAN (shopping cart).
// Syntax + static wiring touchpoints (same style as _bball_chk.js).
const fs = require("fs");
const h = fs.readFileSync("index.html", "utf8");
const m = [...h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
let bad = 0;
m.forEach((s, i) => {
  try {
    new Function(s[1]);
  } catch (e) {
    bad++;
    console.log("script " + i + ": " + e.message);
  }
});
console.log(bad ? "SYNTAX FAIL" : "SYNTAX OK (" + m.length + " scripts)");
const has = (s) => h.includes(s);
const checks = [
  ["HP_HIT_BIRDPOOP", "const HP_HIT_BIRDPOOP = 3"], // de-nerfed: 3 HP, and no DAMAGE_SCALE on a splat train
  ["FAIR FLOCK: roost radius is a named constant", "const BIRD_ROOST_RAD = 2.6;"],
  ["FAIR FLOCK: the wheel is high (a long, dodgeable fall)", "const BIRD_ROOST_ALT = 3.6;"],
  ["FAIR FLOCK: droppings are spaced out", "const BIRD_DROP_CD_MIN = 1.7;"],
  ["FAIR FLOCK: no wall of droppings at once", "const BIRD_POOP_MAX = 3;"],
  ["FAIR FLOCK: the splash is a patch, not a net", "const BIRD_POOP_HIT_R = 0.75;"],
  ["FAIR FLOCK: the splat lies on the pavement as inert mess", "const BIRD_MESS_T = 7;"],
  ["CART_HOMELESS_LINES", "const CART_HOMELESS_LINES = ["],
  ["CART_SEED_THROW_LINES", "const CART_SEED_THROW_LINES = ["],
  ["worker line 1", "That bird shit on me!"],
  ["worker line 2", "That's good luck?!"],
  ["worker line 3", "Hey bird, come back here and clean that up!"],
  ["makeShoppingCart", "function makeShoppingCart()"],
  ["makeCartHomeless", "function makeCartHomeless()"],
  ["cart is a child of the group", "d.g.add(makeShoppingCart())"],
  ["case cartHomeless", 'case "cartHomeless":'],
  ["spawn call", 'addCreature("cartHomeless")'],
  ["owns seeds", "c.seeds = [];"],
  ["owns birds", "c.birds = [];"],
  ["owns poops", "c.poops = [];"],
  ["owns bags", "c.bags = [];"],
  ["block clamp min", "ch.blockMinX = chB.x + 4"],
  ["block clamp max", "ch.blockMaxX = chB.x + BLOCK_W - 4"],
  ["excludes crazy+bball+pimp", "i !== harlemCrazyIdx && i !== bbIdx"],
  ["no-bump skip", 'if (c.type === "cartHomeless") continue;'],
  ["updateSeedFlock", "function updateSeedFlock(c, dt)"],
  ["throwBirdSeed", "function throwBirdSeed(c, tx, ty)"],
  ["aim at worker current spot", "throwBirdSeed(c, p.wx, p.wy)"],
  ["update drives flock", "updateSeedFlock(c, dt)"],
  ["offscreen purge", "clearSeedFlock(c)"],
  ["poop hit -> birdSeed", 'hurtNPC(HP_HIT_BIRDPOOP, "birdSeed", true)'],
  ["writeup reason", 'birdSeed: ["Failure to maintain a clean uniform"]'],
  ["bubble class homeless", 'speaker === "homeless"'],
  ["bubble color css", "bub-homeless"],
  ["roost state", 'b.state === "roost"'],
  ["THE FLOCK ROOSTS OVER ITS SEED (not over the worker)", "b.wx = b.pileX + Math.cos(b.orbit) * rad;"],
  ["THE BIRD OWNS ITS PATCH (pile coords are carried on the bird)", "pileX: pile.wx,"],
  ["DROPS FALL ON THE SEED PATCH (not aimed at the worker)", "const px = b.pileX + R(-BIRD_POOP_SCATTER, BIRD_POOP_SCATTER);"],
  ["NO droppings are ever aimed at the worker's spot", !h.includes("const px = p.wx + R(")],
  ["flyIn state", 'b.state === "flyIn"'],
  ["peck state", 'b.state === "peck"'],
  // de-affiliation guard: the basketball player's swish holler must be DISTANCE-GATED
  // (it used to fire on every shot, so "SWISH!" bubbles bled across the block and got
  // mistaken for the cart guy's lines). Assert the ungated one-liner is gone and the
  // gated form (wDist < 20 before the swish Voice.say) is present.
  ["bball swish NOT ungated anymore", !h.includes("c.swishT = 0.5;\n                    Voice.say(pick(BBALL_SWISH_LINES)")],
  ["bball swish distance-gated", /wDist < 20\)?\s*\n\s*Voice\.say\(\s*\n?\s*pick\(BBALL_SWISH_LINES\)/.test(h)],
];
let allOk = true;
for (const [label, needle] of checks) {
  const ok = has(needle);
  if (!ok) allOk = false;
  console.log((ok ? "PASS " : "MISS ") + label);
}

// ============ RUNTIME: THE FAIR FLOCK ============
// Run the REAL seed subsystem (throwBirdSeed -> spawnSeedPile -> spawnSeedBirds ->
// updateSeedFlock) for a full flock and measure where the droppings fall and who they
// can touch. The law: the flock roosts and fouls ITS SEED. A worker who steps out of the
// seed patch must never be splashed; a worker standing in the patch must feel it.
{
  const extract = (name) => {
    const i = h.indexOf("function " + name + "(");
    let d = 0, j = h.indexOf("{", i);
    for (; j < h.length; j++) {
      if (h[j] === "{") d++;
      else if (h[j] === "}") { d--; if (!d) { j++; break; } }
    }
    return h.slice(i, j);
  };
  const src = ["birdFlap", "throwBirdSeed", "spawnSeedPile", "spawnSeedBirds", "updateSeedFlock", "clearSeedFlock"]
    .map(extract)
    .join("\n");
  const CONSTS = {};
  for (const k of ["HP_HIT_BIRDPOOP", "BIRD_ROOST_RAD", "BIRD_ROOST_Y_RAD", "BIRD_ROOST_ALT", "BIRD_DROP_CD_MIN", "BIRD_DROP_CD_MAX", "BIRD_POOP_MAX", "BIRD_POOP_SCATTER", "BIRD_POOP_HIT_R", "BIRD_MESS_T", "SEED_RANGE"]) {
    const m = h.match(new RegExp("const " + k + " = ([\\d.]+);"));
    CONSTS[k] = Number(m[1]);
  }
  const G = {
    GZ: 0.3,
    state: "play",
    nightBirdsBanned: () => false,
    SFX: { playPlopSound() {} },
    dynamicGroup: { add() {}, remove() {} },
    makeSeedScatter: () => ({ position: { set() {} } }),
    makePigeon: () => ({ position: { set() {} }, rotation: {}, userData: { wingL: { rotation: {} }, wingR: { rotation: {} } } }),
    makeSeedBagMesh: () => ({ position: { set() {} }, rotation: { x: 0 } }),
    makeBirdPoopMesh: () => ({ position: { set() {} } }),
    spawnDustEffect: () => {},
    Voice: { say() {} },
    pick: (a) => a[0],
    BIRD_WORKER_LINES: ["That bird shit on me!"],
    WORKER_GENDER: "male",
    R: (a, b) => a + Math.random() * (b - a),
    hurtNPC: (amt, cause) => HITLOG.push({ amt, cause }),
    ...CONSTS,
  };
  let HITLOG = [];
  const names = Object.keys(G);
  const body =
    src +
    "\nreturn { throwBirdSeed, spawnSeedPile, spawnSeedBirds, updateSeedFlock, spawnSeedBirdsRef: spawnSeedBirds };";
  // The worker's position is a live binding the flock reads.
  const p = { wx: 112, wy: 2.2 };
  G.p = p;
  names.push("p");
  const api = new Function(...names, body)(...names.map((k) => G[k]));
  const runFlock = (workerStandsInPatch) => {
    const c = { wx: 100, wy: 3, g: { position: { set() {} }, rotation: {} }, seeds: [], birds: [], poops: [], bags: [] };
    HITLOG = [];
    const hitsOf = () => HITLOG;
    p.wx = workerStandsInPatch ? 101 : 101; // both start where the seed will land
    p.wy = 2.2;
    api.throwBirdSeed(c, p.wx, p.wy); // the seed lands on the worker's spot
    const drops = [];
    let maxFalling = 0;
    for (let step = 0; step < 60 * 30; step++) {
      if (!workerStandsInPatch) p.wx = Math.min(128, p.wx + 0.1); // he steps clear (~6 u/s) and stops
      api.updateSeedFlock(c, 1 / 60);
      maxFalling = Math.max(maxFalling, c.poops.length);
      if (c.poops.length === 0 && c.birds.length === 0 && c.bags.length === 0 && step > 60 * 12) break;
      // record landings as they touch down
      for (const q of c.poops) if (q.z <= 0.02 && q.landT > 0 && !q.counted) { q.counted = true; drops.push({ x: q.wx, y: q.wy }); }
    }
    const pile = c.seeds[0] || { wx: p.wx, wy: p.wy };
    return { hits: hitsOf(), drops, pile, c, maxFalling };
  };
  const nearHits = [];
  let nearDrops = 0, nearWorst = 0, nearMaxFalling = 0;
  const nearPileR = (dsts, pile) => Math.max(0, ...dsts.map((d) => Math.hypot(d.x - pile.wx, d.y - pile.wy)));
  const trials = [];
  for (let t = 0; t < 12; t++) trials.push(runFlock(true)); // standing in the patch
  trials.forEach((r) => {
    nearHits.push(...r.hits);
    nearDrops += r.drops.length;
    nearWorst = Math.max(nearWorst, r.drops.length ? nearPileR(r.drops, r.pile) : 0);
    nearMaxFalling = Math.max(nearMaxFalling, r.maxFalling);
  });
  const far = runFlock(false);
  const farTrials = [];
  for (let t = 0; t < 6; t++) farTrials.push(runFlock(false));
  const farHits = farTrials.reduce((s, r) => s + r.hits.length, 0);
  const farDrops = farTrials.reduce((s, r) => s + r.drops.length, 0);
  const farMaxFalling = farTrials.reduce((m, r) => Math.max(m, r.maxFalling), 0);
  const near = trials[0];
  const radius = nearPileR;
  console.log("");
  console.log("[3] RUNTIME: where the droppings land, and who they can touch");
  const okPatch = nearDrops > 0 && nearWorst <= CONSTS.BIRD_ROOST_RAD + CONSTS.BIRD_POOP_SCATTER + 0.6;
  console.log((okPatch ? "PASS " : "MISS ") + "every dropping lands on the SEED PATCH (" + nearDrops + " landings over 12 flocks, worst " + nearWorst.toFixed(2) + "u from the pile, allowed " + (CONSTS.BIRD_ROOST_RAD + CONSTS.BIRD_POOP_SCATTER).toFixed(2) + "u + the fall drift)");
  const farDropsN = farTrials.reduce((s, r) => s + r.drops.length, 0);
  console.log((farHits === 0 && farDropsN > 0 ? "PASS " : "MISS ") + "a worker who walks out of the seed patch is NEVER splashed (" + farHits + " hits over " + farDropsN + " drops in 6 flocks — the flock is alive and dropping, just not on him)");
  console.log((nearHits.length > 0 ? "PASS " : "MISS ") + "a worker standing IN the seed patch still feels it (" + nearHits.length + " hits over " + nearDrops + " drops)");
  console.log(((nearMaxFalling <= CONSTS.BIRD_POOP_MAX && farMaxFalling <= CONSTS.BIRD_POOP_MAX) ? "PASS " : "MISS ") + "never more than " + CONSTS.BIRD_POOP_MAX + " droppings falling at once (worst " + Math.max(nearMaxFalling, farMaxFalling) + ")");
  const fairDamage = nearHits.every((x) => x.amt <= 3);
  console.log((fairDamage ? "PASS " : "MISS ") + "the splat is minor damage (<= 3 HP raw, cause birdSeed)");
  if (!(okPatch && farHits === 0 && nearHits.length > 0 && nearMaxFalling <= CONSTS.BIRD_POOP_MAX && fairDamage)) allOk = false;
}
console.log(allOk && !bad ? "ALL OK" : "CHECK ABOVE");
