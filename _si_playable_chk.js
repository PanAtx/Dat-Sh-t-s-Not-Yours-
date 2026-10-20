const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let pass = 0, fail = 0;
const check = (name, ok) => {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name);
  ok ? pass++ : fail++;
};

console.log('\n[STATEN ISLAND / MIDNIGHT PLAYABILITY LAWS]');

// ================= [1] BLUE JAY: THE ONE-GOOD-BLOW LAW ==================
{
  const fnStart = html.indexOf('function updateCreatures(');
  const jStart = html.indexOf('case "bluejay": {', fnStart);
  const jEnd = html.indexOf('case "gator": {', jStart);
  const body = html.slice(jStart, jEnd);
  check('the blue jay case exists in updateCreatures', jStart >= 0 && jEnd > jStart);
  check('THE ONE-GOOD-BLOW LAW is documented in the case header',
    /ONE-GOOD-BLOW LAW/.test(body));
  check('the takeoff gate refuses to launch after a landed hit (c.struckOnce)',
    body.indexOf('!c.struckOnce') >= 0);
  check('the LANDING strike arms c.struckOnce',
    (() => {
      const hit = body.indexOf('miss < BLUEJAY_STRIKE_R');
      return hit >= 0 && body.slice(hit, hit + 900).indexOf('c.struckOnce = true') >= 0;
    })());
  const addStart = html.indexOf('case "bluejay":', html.indexOf('function addCreature('));
  const addBody = html.slice(addStart, addStart + 1400);
  check('addCreature seeds c.struckOnce = false at spawn',
    addBody.indexOf('c.struckOnce = false') >= 0);
}

// ================= [2] MAFIA GUY: THE FED-PARANOIA RESIDENCY LAW ===========
{
  const spStart = html.indexOf('const mafiaBlockX = LEVEL_BLOCKS[2]');
  const spBlock = spStart >= 0 ? html.slice(spStart - 800, spStart + 1500) : '';
  check('the spawn comment documents FED-PARANOIA RESIDENCY',
    /FED-PARANOIA RESIDENCY LAW/.test(spBlock));
  check('the spawn authors mg.blockMinX on the mafia block',
    /mg\.blockMinX = mafiaBlockX \+ NPC_BLOCK_INSET/.test(spBlock));
  check('the spawn authors mg.blockMaxX on the NEXT block (LEVEL_BLOCKS[3])',
    /mg\.blockMaxX = LEVEL_BLOCKS\[3\]\.x \+ routeBlockW\(\) - NPC_BLOCK_INSET/.test(spBlock));

  const fnStart = html.indexOf('function updateCreatures(', spStart);
  const uStart = html.indexOf('case "mafia": {', fnStart);
  const uEnd = html.indexOf('case "pimp": {', uStart);
  const uBody = html.slice(uStart, uEnd);
  check('the mafia AI case is present in updateCreatures', uStart >= 0 && uEnd > uStart);
  check('the mafia stalk CLAMPS c.wx to c.blockMinX..c.blockMaxX every frame',
    /c\.wx = clamp\(c\.wx, c\.blockMinX, c\.blockMaxX\)/.test(uBody));
  check('the mafia case documents the FED-PARANOIA RESIDENCY LAW',
    /FED-PARANOIA RESIDENCY LAW/.test(uBody));
  check('the mafia case NO LONGER claims he stalks the rest of the level',
    !/STALKS him up the rest of the level/.test(uBody) &&
    !/STALK: chase the worker up the rest of the level/.test(uBody));
}

// ================= [3] MIDNIGHT: THE HOOK SQUASHES THE COMPLAINTS =========
{
  const introStart = html.indexOf('function showDayIntro()');
  const introEnd = html.indexOf('function beginDay()', introStart);
  const intro = html.slice(introStart, introEnd);
  check('showDayIntro is present', introStart >= 0 && introEnd > introStart);
  check('showDayIntro RESETS complaints on the night card',
    /if \(d\.night && complaints > 0\) \{[\s\S]*?complaints = 0;/.test(intro));
  check('the reset repaints the HUD (the pips drop live on the card frame)',
    /updateHUD\(\)/.test(intro));
  check('the night card prints the SQUASHED line on its objective',
    /ALL COMPLAINTS SQUASHED BY YOUR HOOK/.test(intro));
  check('BEGIN of the day (night shift) speaks the hook-squash beat',
    (() => {
      const bStart = html.indexOf('function beginDay()');
      const bEnd = html.indexOf('function startBonusRound', bStart);
      const b = html.slice(bStart, bEnd);
      return /Hook squashed every complaint on me/.test(b);
    })());
}

// ================= [4] INSTRUCTIONS LINES ================================
{
  const siRow = (() => {
    const i = html.indexOf('FRIDAY &#183; STATEN ISLAND, NEW DORP');
    return i >= 0 ? html.slice(i, i + 1400) : '';
  })();
  check('SI instructions row names the mafia two-block residency',
    /HIS block and the NEXT ONE UP/i.test(siRow) && /Feds are watching/i.test(siRow));
  const ndStart = html.indexOf('NEW DORP REST OF IT');
  const ndRow = ndStart >= 0 ? html.slice(ndStart, ndStart + 1400) : '';
  check('Blue Jay instructions row states the ONE-GOOD-BLOW law',
    /One good blow per shift/i.test(ndRow));
  const wiStart = html.indexOf('THREE WRITE-UPS = SUSPENDED');
  const wiRow = wiStart >= 0 ? html.slice(wiStart, wiStart + 1400) : '';
  check('write-ups instructions row cites the MIDNIGHT squash exception',
    /MIDNIGHT shift is the exception/i.test(wiRow) && /squashed by your hook/i.test(wiRow));
  const midStart = html.indexOf('AND THEN &#183; MIDNIGHT');
  const midRow = midStart >= 0 ? html.slice(midStart, midStart + 2000) : '';
  check('MIDNIGHT instructions row states the CLOCK-IN GIFT (the pips wipe to 0/3)',
    /CLOCK-IN GIFT/i.test(midRow) && /0\/3/.test(midRow));
}

// ================= [5] VERSION ==========================================
check('the shipped app version is stamped at v1.0.602 (the playability build)',
  html.indexOf("const APP_VERSION = '1.0.602'") >= 0 &&
  html.indexOf('<div id="app-version" class="menu-version">v1.0.602</div>') >= 0);

console.log('\n' + (fail ? 'SI / MIDNIGHT PLAYABILITY CHECKS FAILED (' + fail + ')' : 'ALL SI / MIDNIGHT PLAYABILITY CHECKS PASSED (' + pass + ')'));
process.exit(fail ? 1 : 0);
