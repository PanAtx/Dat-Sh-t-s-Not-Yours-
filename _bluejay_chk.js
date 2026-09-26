// _bluejay_chk.js — validates the STATEN ISLAND BLUE JAY (New Dorp, day 5) in index.html:
//   1) all inline scripts still parse
//   2) wiring: makeBlueJay (wings in userData) + makeBlueJayNest (babies in the nest),
//      addCreature case "bluejay", the SFX squawk/chirp/swoosh, the SI-gated spawn
//      (ONE random tree on ONE random garbage block, nest in the canopy, bird perched)
//   3) AI: nest -> WARNING CIRCLE (the tell) -> DIVE -> CLIMB, with the circle ALWAYS
//      before the strike; a hit = minor damage (hurtNPC(2, "bluejay")) + STUN +
//      "Damn bird!" / "I almost lost an eye!"
//   4) the bird never gets a generic bump collision and is exempt from the z=GZ clamp
//   5) WRITTEN UP!: "Feathered Aggression Non-Compliance"
'use strict';
const fs = require('fs');
const src = fs.readFileSync('index.html', 'utf8');
let pass = 0, fail = 0;
const check = (name, ok) => {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
  ok ? pass++ : fail++;
};

// ================= 1. all inline scripts parse =================
console.log('\n[1] syntax');
{
  const { execFileSync } = require('child_process');
  const scriptRe = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  const blocks = [];
  let m;
  while ((m = scriptRe.exec(src)) !== null) blocks.push(m[1]);
  const tmpFiles = [];
  let allOk = true, n = 0;
  try {
    for (const b of blocks) {
      if (!b.trim()) continue;
      n++;
      const f = '_chk_blk' + n + '.mjs';
      fs.writeFileSync(f, b);
      tmpFiles.push(f);
      try {
        // `node --check` on a .mjs properly validates MODULE syntax (new Function
        // can't — it would reject a top-level `export` and we'd wrongly skip it).
        execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
      } catch (e) {
        allOk = false;
        const out =
          (e.stderr && e.stderr.toString()) ||
          (e.stdout && e.stdout.toString()) ||
          e.message ||
          '';
        console.log(
          '  syntax error in block ' + n + ':\n  ' +
            out.split('\n').slice(0, 6).join('\n  '),
        );
      }
    }
  } finally {
    for (const f of tmpFiles) {
      try {
        fs.unlinkSync(f);
      } catch (_) {}
    }
  }
  check('all ' + n + ' inline script blocks parse (node --check)', allOk && n >= 2);
}

// ================= 2. wiring =================
console.log('\n[2] wiring');
{
  const addSec = (() => {
    const u = src.indexOf('function addCreature(');
    const i = src.indexOf('case "bluejay":', u);
    if (i < 0) return '';
    return src.slice(i, i + 1800);
  })();
  check('addCreature has case "bluejay"', addSec.indexOf('case "bluejay":') >= 0);
  check('addCreature: blue jay built with makeBlueJay + wing pivots', addSec.indexOf('makeBlueJay()') >= 0 && addSec.indexOf('c.wingL = c.data.userData.wingL') >= 0);

  const mkSec = (() => {
    const i = src.indexOf('function makeBlueJay(');
    if (i < 0) return '';
    return src.slice(i, src.indexOf('function makeRat(', i));
  })();
  check('makeBlueJay: blue body + black neck-collar + crest + white wingtips',
    mkSec.indexOf('0x2f6fd0') >= 0 && mkSec.indexOf('TorusGeometry(0.05, 0.015') >= 0 && mkSec.indexOf('ConeGeometry(0.022, 0.09') >= 0 && mkSec.indexOf('white wingtip') >= 0);
  check('makeBlueJay: wings exposed in userData (wingL/wingR)', mkSec.indexOf('g.userData.wingL = wingL') >= 0 && mkSec.indexOf('g.userData.wingR = wingR') >= 0);
  check('makeBlueJayNest: bowl + rim + twigs + BABIES (3-4) with open beaks',
    mkSec.indexOf('function makeBlueJayNest()') >= 0 && mkSec.indexOf('IcosahedronGeometry(0.42') >= 0 && mkSec.indexOf('babyN = 3 + ((Math.random() * 2) | 0)') >= 0 && mkSec.indexOf('open beak') >= 0);

  const sfxSec = (() => {
    const i = src.indexOf('const SFX = {');
    if (i < 0) return '';
    return src.slice(i, i + 12000);
  })();
  check('SFX: playSquawk (double-scream) + playChirp (babies) + playSwoosh (swoop)',
    sfxSec.indexOf('playSquawk(loud)') >= 0 && sfxSec.indexOf('playChirp()') >= 0 && sfxSec.indexOf('playSwoosh()') >= 0);

  const spawnSec = (() => {
    // anchor on the SPAWN marker — the blue-jay comment sitting right above the
    // NEST_Z constant — NOT the first "Staten Island BLUE JAY" hit (that's the
    // makeBlueJayNest doc comment far earlier in the file)
    const anchor = src.indexOf('NEST_Z = 3.0');
    if (anchor < 0) return '';
    const marker = 'The Staten Island BLUE JAY (New Dorp, day 5)';
    const start = Math.max(0, src.lastIndexOf(marker, anchor));
    return src.slice(start, anchor + 1500);
  })();
  check('spawn comment block present', spawnSec.length > 500);
  check('spawn: gated on isStatenIslandLevel()', spawnSec.indexOf('if (isStatenIslandLevel())') >= 0);
  check('spawn: ONE random GARBAGE block that has a tree', spawnSec.indexOf('b.garbage && b.trees && b.trees.length > 0') >= 0 && spawnSec.indexOf('(Math.random() * bjBlocks.length) | 0') >= 0 && spawnSec.indexOf('(Math.random() * bjBlock.trees.length) | 0') >= 0);
  check('spawn: nest in the canopy (z 3.0) added to dynamicGroup (world object, no recycling)',
    spawnSec.indexOf('NEST_Z = 3.0') >= 0 && spawnSec.indexOf('dynamicGroup.add(nestG)') >= 0);
  check('spawn: exactly ONE bluejay creature, perched on the nest rim (c.nest + nestZ)',
    (spawnSec.match(/addCreature\("bluejay"\)/g) || []).length === 1 && spawnSec.indexOf('bj.nest = { wx: bjTree.wx, wy: bjTree.wy }') >= 0 && spawnSec.indexOf('bj.nestZ = NEST_Z + 0.14') >= 0);

  const ccSrc = src.slice(src.indexOf('function collideCreatures()'), src.indexOf('function collideCreatures()') + 900);
  check('collideCreatures: the bird is AIRBORNE — no generic bump collision', ccSrc.indexOf('if (c.type === "bluejay") continue;') >= 0);

  const zGate = src.indexOf('c.type !== "raven"');
  check('z-sync: bluejay is exempt from the c.g.position.z = GZ clamp (like pigeons)',
    zGate >= 0 && src.slice(Math.max(0, zGate - 400), zGate).indexOf('c.type !== "bluejay"') >= 0);
}

// ================= 3. AI: the state machine (runtime simulation) =================
console.log('\n[3] AI: nest -> warning CIRCLE (the tell) -> DIVE -> climb, simulated');
{
  // extract the REAL "bluejay" case body from updateCreatures (brace-counted)
  const fnStart = src.indexOf('function updateCreatures(');
  const start = src.indexOf('case "bluejay": {', fnStart);
  check('case "bluejay" exists in updateCreatures', start >= 0);
  let i = src.indexOf('{', start), d = 0, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (d === 0) { end = i + 1; break; } }
  }
  // slice THROUGH the case's closing brace (end = i+1, so `end` is inclusive)
  const body = src.slice(start + 'case "bluejay": '.length, end);
  const BLUEJAY_TERRITORY = 26, BLUEJAY_TRIGGER_R = 18, BLUEJAY_CIRCLE_R = 4.6,
    BLUEJAY_CIRCLE_T = 1.7, BLUEJAY_DIVE_T = 0.28, BLUEJAY_STRIKE_R = 2.4;
  const BLUEJAY_LINES = ['SQUAWK!', 'JAY! JAY JAY!'];
  const BLUEJAY_WORKER_LINES = ['Damn bird!', 'I almost lost an eye!'];
  const HP_HIT_BLUEJAY = 2;
  const GZ = 0.3, WORKER_GENDER = 'male';
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  let state = 'play';
  const calls = { voice: [], sfx: [], hurt: [], stun: [] };
  const Voice = { say: (...a) => calls.voice.push({ text: a[0], speaker: a[6], style: a[7] }) };
  const SFX = { playSquawk: () => calls.sfx.push('squawk'), playChirp: () => calls.sfx.push('chirp'), playSwoosh: () => calls.sfx.push('swoosh') };
  const hurtNPC = (amt, cause, noYelp) => { calls.hurt.push({ amt, cause, noYelp }); };
  const doStun = (d, t) => { calls.stun.push({ d, t }); };
  // wrap in a switch so the trailing `break;` in the case body is legal JS;
  // eval (not new Function) keeps p/state/R/Voice/SFX/etc. in scope
  const runTick = eval('(function(c, dt){ switch(1){ default: ' + body + ' } })');
  const mkBird = () => ({
    state: 'nest', cd: 0, squawkCd: 0, nest: { wx: 100, wy: 2 }, nestZ: 3.14,
    gz: 3.14, wx: 100, wy: 2, circleT: 0, circleAng: 0, circleDir: 1,
    diveT: 0, climbT: 0, peckPhase: 1,
    wingL: { rotation: { x: 0 } }, wingR: { rotation: { x: 0 } },
    g: { rotation: { x: 0, y: 0, z: 0 }, position: { z: 0 } },
  });
  const p = { wx: 104, wy: 2.5 }; // on her street, ~4.7u from the nest
  const dt = 1 / 60;
  const tick = (n) => { for (let t = 0; t < n; t++) runTick(bird, dt); };
  const bird = mkBird();

  // (a) worker on her block -> she takes off and CIRCLES first (the tell)
  tick(30);
  check('worker in range: the bird takes off into the WARNING CIRCLE (not an instant dive)', bird.state === 'circle');
  check('takeoff: she squawks AND the babies chirp', calls.sfx.indexOf('squawk') >= 0 && calls.sfx.indexOf('chirp') >= 0);

  // (b) during the circle she holds ~BLUEJAY_CIRCLE_R from the worker and ROTATES around him
  //     (only SAMPLE while she is actually circling — the moment she dives her
  //     position is on the dive path, not on the ring)
  let radiusOk = true, rotated = 0, lastAng = null, cTicks = 0;
  while (bird.state === 'circle' && cTicks < 300) {
    runTick(bird, dt);
    cTicks++;
    if (bird.state !== 'circle') break; // she dove — stop judging the ring
    const rr = Math.hypot(bird.wx - p.wx, bird.wy - p.wy);
    if (Math.abs(rr - BLUEJAY_CIRCLE_R) > 0.01) radiusOk = false;
    const a = Math.atan2(bird.wy - p.wy, bird.wx - p.wx);
    if (lastAng !== null) {
      let da = a - lastAng;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      rotated += Math.abs(da);
    }
    lastAng = a;
  }
  check('circle: she holds ~4.6u radius the WHOLE lap (a visible, avoidable ring)', radiusOk && cTicks > 5);
  check('circle: she visibly ROTATES around the worker (the tell)', rotated > 1.5);
  check('circle: she squawks mid-lap (the audible tell)', calls.sfx.filter((s) => s === 'squawk').length >= 2);

  // (c) the lap ends -> DIVE hits: minor damage + stun + the worker lines
  const before = { hurt: calls.hurt.length, stun: calls.stun.length, voice: calls.voice.length };
  for (let t = 0; t < 200 && bird.state === 'dive'; t++) runTick(bird, dt);
  check('circle -> DIVE -> strike lands (the circle ALWAYS precedes the swoop)', bird.state === 'climb' || bird.state === 'nest');
  check('hit: MINOR damage — hurtNPC(2, "bluejay", noYelp)', calls.hurt.length === before.hurt + 1 && calls.hurt[before.hurt].amt === 2 && calls.hurt[before.hurt].cause === 'bluejay' && calls.hurt[before.hurt].noYelp === true);
  check('hit: the worker gets STUNNED (doStun "hit")', calls.stun.length === before.stun + 1 && calls.stun[before.stun].t === 'hit');
  const workerLine = calls.voice.slice(before.voice).find((v) => v.speaker === 'worker');
  check('hit: the worker yells "Damn bird!" / "I almost lost an eye!" (burst)',
    !!workerLine && BLUEJAY_WORKER_LINES.indexOf(workerLine.text) >= 0 && workerLine.style === 'burst');

  // (d) she climbs BACK to the nest (always lands home) and cools down
  for (let t = 0; t < 300 && bird.state === 'climb'; t++) runTick(bird, dt);
  check('climb: she lands back in the nest', bird.state === 'nest' && Math.hypot(bird.nest.wx - bird.wx, bird.nest.wy - bird.wy) < 0.01 && Math.abs(bird.gz - bird.nestZ) < 0.01);
  check('climb: she takes a breather (cd re-armed) before the next run', bird.cd > 0);

  // (e) worker still around -> the harassment REPEATS
  const before2 = calls.hurt.length;
  tick(600); // wait out the cd
  check('repeat: she harasses again while he is still in the territory', bird.state === 'circle' || bird.state === 'dive' || bird.state === 'climb' || calls.hurt.length > before2);

  // (f) WHIFF: if he runs the dive down, no damage
  const bird3 = mkBird();
  const runTick3 = eval('(function(c, dt){ switch(1){ default: ' + body + ' } })');
  for (let t = 0; t < 40; t++) runTick3(bird3, dt); // trigger + part of the circle
  const hurtBefore = calls.hurt.length;
  let whiffOk = false;
  for (let t = 0; t < 400; t++) {
    runTick3(bird3, dt);
    if (bird3.state === 'dive') { p.wx += 25; p.wy += 10; } // he RUNS the moment she dives (the strike re-checks his spot)
    if (bird3.state === 'climb') { whiffOk = true; break; }
  }
  check('whiff: if the worker runs the dive, she misses (no damage)', whiffOk && calls.hurt.length === hurtBefore);
  p.wx -= 25; p.wy -= 10; // put the worker back (courtesy; nothing else reads it)
}

// ================= 4. WRITTEN UP! =================
console.log('\n[4] WRITTEN UP!');
{
  const wrS = src.indexOf('const WRITEUP_REASONS = {');
  const objStart = src.indexOf('{', wrS);
  const wrE = src.indexOf('};', wrS);
  // slice just the object literal ({ ... }) so eval returns the object
  const REASONS = eval('(' + src.slice(objStart, wrE + 1) + ')');
  check('WRITEUP_REASONS.bluejay: "Feathered Aggression Non-Compliance" (the exact line)',
    Array.isArray(REASONS.bluejay) && REASONS.bluejay.indexOf('Feathered Aggression Non-Compliance') >= 0);
  const reason = src.slice(wrS, wrS + 9000);
  check('bluejay is a first-class write-up key (next to the other Staten Island causes)',
    reason.indexOf('bluejay: [') >= 0 && src.indexOf('function writeupReason(cause)') >= 0);
}

console.log('\n' + (fail ? 'BLUE JAY CHECKS FAILED (' + fail + ' failed)' : 'ALL BLUE JAY CHECKS PASSED (' + pass + ' checks)'));
process.exit(fail ? 1 : 0);
