// _delivery_cyclist_chk.js — Gramercy Park (day 1): the delivery-courier mascot +
// the Level 1 tuning pass (bike spawn spread, knife-maniac stalk speed).
const fs = require('fs');
const path = require('path');
const h = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let pass = 0, fail = 0;
function check(n, c, e) {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (e && !c ? '  [' + e + ']' : ''));
  if (c) pass++; else fail++;
}

// ---- the courier's look: makeBicycle(eBike, isDelivery) + red pizza bag ----------
check('makeBicycle accepts an isDelivery flag (red courier jersey)',
  /function makeBicycle\(eBike, isDelivery\)/.test(h) &&
  /shirt: isDelivery \? 0xe8752a :/.test(h));
check('makeBicycle mounts a red pizza bag + rack + white logo on the delivery build',
  (function(){
    const s = h.indexOf('function makeBicycle(');
    const e = h.indexOf('function makeMoto()', s);
    const body = h.slice(s, e);
    return /if \(isDelivery\) \{/.test(body) && /M\(0xd4342a\)/.test(body) && /0xffffff/.test(body);
  })());

// ---- spawn: Level 1 ONLY ---------------------------------------------------------
check('delivery courier spawns on day 1 (level === 1) as a flagged bike',
  /if \(level === 1\) \{\s*const dv = addCreature\("bike", \{ isDelivery: true \}\);/.test(h));
check('normal bikes are SPREAD along the street (nBikes * 24), no more pack bunching',
  /const nBikes = creatures\.filter\(\(o\) => o\.type === "bike"\)\.length;\s*c\.wx = p\.wx \+ nBikes \* 24 \+ R\(0, 10\);/.test(h));
check('the courier gets a longer hitbox for the pizza bag',
  /if \(c\.isDelivery\) c\.boxL = 0\.8;/.test(h));

// ---- the mascot behavior: throttle + bell ----------------------------------------
check('courier slams the throttle (2.2x) only when the worker is within 12u',
  /if \(c\.isDelivery\) \{\s*const dxD = p\.wx - c\.wx;[\s\S]{0,220}dxD \* dxD \+ dyD \* dyD < 144[\s\S]{0,120}spBe = Math\.max\(spBe, c\.sp \* 2\.2\)/.test(h));
check('courier bells "Order up!" (12s cooldown, not a machine gun)',
  /Voice\.say\("Order up!", 1\.2, 1\.25, c\.wx, c\.wy, "male", "bike"\)/.test(h) &&
  /c\._orderCd = 12;/.test(h));

// ---- the write-up: "delivery" offense --------------------------------------------
check('vehicle hit records the "delivery" cause for the courier (not generic bike)',
  /hurtNPC\(HP_HIT_VEHICLE, c\.isDelivery \? "delivery" : c\.type\)/.test(h));
check('courier says "Pizza!" when you clip him',
  /else if \(c\.isDelivery\)\s*Voice\.say\("Pizza!", 1\.0, 1\.4, c\.wx, c\.wy, "male", "bike"\);/.test(h));
check('WRITEUP_REASONS has a "delivery" entry (courier lines)',
  /delivery: \[\s*"Failure to yield to a licensed pizza courier",\s*"The 30-minute window was violated",\s*\],/.test(h));

// ---- dynamic: the REAL writeupReason + npcCounts from index.html ------------------
{
  const s0 = h.indexOf('const WRITEUP_REASONS =');
  const e0 = h.indexOf('};', s0) + 2;
  const s1 = h.indexOf('function writeupReason(');
  const e1 = h.indexOf('function ', s1 + 10);
  eval(h.slice(s0, e0).replace('const', 'var') + '\n' + h.slice(s1, e1));
  const lines = WRITEUP_REASONS.delivery;
  check('dynamic: writeupReason("delivery") always picks a courier line',
    lines && lines.length === 2 &&
    Array.from({ length: 50 }, () => writeupReason('delivery')).every(
      (l) => l === "Failure to yield to a licensed pizza courier" || l === "The 30-minute window was violated",
    ));
  check('dynamic: regular bike write-ups are untouched (bike lane lines)',
    WRITEUP_REASONS.bike.includes("Failure to give access to bike lane"));
}
{
  const grab = (name) => { const s = h.indexOf('const ' + name + ' ='); return h.slice(s, h.indexOf('};', s) + 2); };
  const fn = h.slice(
    h.indexOf('function npcCounts('),
    h.indexOf('}\r\n', h.indexOf('return c;', h.indexOf('function npcCounts('))) + 3,
  );
  eval(
    grab('BASE_NPC_COUNTS').replace('const', 'var') + ';' +
    grab('SCALING_NPC').replace('const', 'var') + ';' +
    grab('GATED_NPC').replace('const', 'var') +
    '; var level = 1; function isQueensLevel(){return false}; ' + fn +
    '; var _r1 = npcCounts(1), _r6 = npcCounts(6);',
  );
  check('dynamic: day 1 (Gramercy) keeps its 3 cyclists', _r1.bike === 3);
  check('dynamic: day 6 (Harlem) has no cyclists + no delivery', _r6.bike === 0);
}

// ---- L1 tuning: the knife maniac ---------------------------------------------------
check('CRAZY_STALK_MIN/MAX constants exist (2.6 / 4.3)',
  /const CRAZY_STALK_MIN = 2\.6;/.test(h) && /const CRAZY_STALK_MAX = 4\.3;/.test(h));
check('the stalk behavior uses the new constants',
  /c\.crazySpeed = R\(CRAZY_STALK_MIN, CRAZY_STALK_MAX\);/.test(h));
check('forward walks push harder (2.0-3.8) and the back-off run is 2.2',
  /c\.crazySpeed = R\(2\.0, 3\.8\); \/\/ L1 tuning: forward walks push harder/.test(h) &&
  /const runSp = 2\.2;/.test(h));

console.log(fail === 0 ? '\nDELIVERY CYCLIST + L1 TUNING CHECKS PASSED' : '\nDELIVERY CYCLIST + L1 TUNING CHECKS FAILED');
process.exit(fail === 0 ? 0 : 1);
