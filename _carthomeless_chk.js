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
  ["HP_HIT_BIRDPOOP", "const HP_HIT_BIRDPOOP = 4"],
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
  ["roost state over worker", 'b.state === "roost"'],
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
console.log(allOk && !bad ? "ALL OK" : "CHECK ABOVE");
