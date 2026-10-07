// Kick-a-rat check: the worker's OTHER job. When his hands are FREE and a rat is
// right in front, the Act button KICKS the rat (a squeal + a fling across the
// street, then it scrambles up and scurries off). Hands FULL = Act is for dumping
// trash, so a kick only happens when the worker is free.
//
// Runs the REAL tryKickRat / kickRat (extracted from index.html) in a sandbox,
// plus the REAL "rat" AI case to confirm the fling -> get-up -> scurry-off.
const fs = require('fs');
const src = fs.readFileSync('index.html', 'utf8');

let pass = true,
  failed = 0;
const check = (name, c, e) => {
  console.log((c ? 'PASS' : 'FAIL') + '  ' + name + (c ? '' : '  [' + e + ']'));
  if (!c) {
    pass = false;
    failed++;
  }
};

function extract(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found');
  const brace = src.indexOf('{', idx);
  let depth = 0,
    i = brace;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(idx, i + 1);
}

console.log('[1] source wiring');
{
  check('tryKickRat + kickRat are defined', src.indexOf('function tryKickRat()') >= 0 && src.indexOf('function kickRat(c)') >= 0);
  check(
    'tryInteract gates the kick on FREE hands, after the punchback gate, before the dump logic',
    /if \(p\.attackerT > 0 && tryPunchBack\(\)\) return;[\s\S]{0,400}?if \(carry === "none" && typeof tryKickRat === "function" && tryKickRat\(\)\) return;/.test(src),
  );
  check('the worker yells "Take that rat!" or "Yeet!"', src.indexOf('Take that rat!') >= 0 && src.indexOf('Yeet!') >= 0);
  check('SFX.playSqueal exists (the rat squeal)', /playSqueal\(\) \{/.test(src));
  check('the kicked rat sets its own z (excluded from the generic GZ sync)', /c\.type !== "rat" \/\/ the kicked rat sets its own z/.test(src));
  const ratCase = (() => {
    const i = src.indexOf('case "rat": {');
    if (i < 0) return '';
    return src.slice(i, i + 1700);
  })();
  check(
    'the rat AI case handles the fling (kickT) + arc (kickZ) + get-up (getUpT) + scurry-off (flee)',
    ratCase.indexOf('c.kickT > 0') >= 0 &&
      ratCase.indexOf('c.kickZ = Math.sin(kt * Math.PI) * 0.9') >= 0 &&
      ratCase.indexOf('c.getUpT = 0.32') >= 0 &&
      ratCase.indexOf('c.flee = 2.4') >= 0 &&
      ratCase.indexOf('c.g.position.z = GZ + (c.kickZ || 0)') >= 0,
    'rat case segment: ' + ratCase.slice(0, 120),
  );
}

console.log('');
console.log('[2] tryKickRat / kickRat — the real functions in a sandbox');
{
  const tryKickSrc = extract('tryKickRat');
  const kickSrc = extract('kickRat');
  function mkScen(opts) {
    opts = opts || {};
    const p = opts.p || { wx: 0, wy: 0, stunT: 0, facing: 0, kickT: 0 };
    const creatures = opts.rats || [];
    const carry = opts.carry !== undefined ? opts.carry : 'none';
    const state = opts.state !== undefined ? opts.state : 'play';
    const sfxLog = [],
      voiceLog = [];
    const dist = (x, y) => Math.hypot(x - p.wx, y - p.wy);
    const pick = (a) => a[0];
    const SFX = { playSqueal() { sfxLog.push('squeal'); } };
    const Voice = { say(t) { voiceLog.push(t); } };
    const WORKER_GENDER = 'male';
    const fn = new Function(
      'state', 'p', 'carry', 'creatures', 'dist', 'pick', 'SFX', 'Voice', 'WORKER_GENDER',
      'const RAT_KICK_RANGE = 2.6, RAT_KICK_FLING = 8;\n' + tryKickSrc + '\n' + kickSrc + '\nreturn { tryKickRat };',
    );
    return { api: fn(state, p, carry, creatures, dist, pick, SFX, Voice, WORKER_GENDER), p, creatures, sfxLog, voiceLog };
  }

  // (a) rat in range + free hands -> KICK
  let s = mkScen({ rats: [{ type: 'rat', wx: 1.5, wy: 0 }] });
  const ok = s.api.tryKickRat();
  check('rat in range + free hands -> kick (worker whips a kick, rat is flung)',
    ok === true && s.p.kickT === 0.3 && s.creatures[0].kickT === 0.55,
    JSON.stringify({ ok, kickT: s.p.kickT, ratKickT: s.creatures[0].kickT }));
  check('the kick plays the squeal AND a "Take that rat!" / "Yeet!" line',
    s.sfxLog.length === 1 && (s.voiceLog[0] === 'Take that rat!' || s.voiceLog[0] === 'Yeet!'),
    JSON.stringify({ sfx: s.sfxLog, voice: s.voiceLog }));
  check('the rat is flung AWAY along the kick line (worker -> rat direction)',
    s.creatures[0].kickVx === 8 && s.creatures[0].kickVy === 0,
    JSON.stringify({ kickVx: s.creatures[0].kickVx, kickVy: s.creatures[0].kickVy }));
  check('the worker faces the rat (p.facing snapped)', Math.abs(s.p.facing - 0) < 1e-9, 'facing=' + s.p.facing);

  // (b) rat in range + hands FULL -> NO kick (Act is for dumping trash)
  s = mkScen({ carry: 'bag', rats: [{ type: 'rat', wx: 1.5, wy: 0 }] });
  const okB = s.api.tryKickRat();
  check('rat in range + hands FULL -> NO kick (falls to the dump handling)',
    okB === false && s.p.kickT === 0 && s.sfxLog.length === 0 && s.voiceLog.length === 0,
    JSON.stringify({ ok: okB, kickT: s.p.kickT }));

  // (c) rat OUT of range -> no kick (falls through to the normal Act)
  s = mkScen({ rats: [{ type: 'rat', wx: 10, wy: 0 }] });
  const okC = s.api.tryKickRat();
  check('rat OUT of range -> no kick (falls through to pickup/throw)', okC === false && s.p.kickT === 0, JSON.stringify({ ok: okC }));

  // (d) stunned worker -> no kick
  s = mkScen({ p: { wx: 0, wy: 0, stunT: 0.5, facing: 0, kickT: 0 }, rats: [{ type: 'rat', wx: 1.5, wy: 0 }] });
  const okD = s.api.tryKickRat();
  check('stunned worker -> no kick', okD === false && s.p.kickT === 0, JSON.stringify({ ok: okD }));

  // (e) a rat already mid-fling / getting up is not re-kicked
  s = mkScen({ rats: [{ type: 'rat', wx: 1.5, wy: 0, kickT: 0.2 }] });
  const okE = s.api.tryKickRat();
  check('a rat already mid-fling is skipped (no double kick)', okE === false, JSON.stringify({ ok: okE }));

  // (f) with TWO rats in range, the NEAREST is kicked
  s = mkScen({ rats: [{ type: 'rat', wx: 2.0, wy: 0 }, { type: 'rat', wx: 1.0, wy: 0 }] });
  const okF = s.api.tryKickRat();
  check('with two rats in range, the NEAREST is the one kicked',
    okF === true && s.creatures[1].kickT === 0.55 && s.creatures[0].kickT === undefined,
    JSON.stringify({ ok: okF, r0: s.creatures[0].kickT, r1: s.creatures[1].kickT }));

  // (g) a rat straight to the side -> worker faces it and the fling is along that line
  s = mkScen({ rats: [{ type: 'rat', wx: 0, wy: 2 }] });
  s.api.tryKickRat();
  check('a rat to the side -> worker faces it (facing ~ PI/2), fling along that line',
    Math.abs(s.p.facing - Math.PI / 2) < 1e-9 && s.creatures[0].kickVx === 0 && s.creatures[0].kickVy === 4,
    JSON.stringify({ facing: s.p.facing, kickVx: s.creatures[0].kickVx, kickVy: s.creatures[0].kickVy }));
}

console.log('');
console.log('[3] the "rat" AI case: fling -> get up -> scurry off (real case, simulated)');
{
  function extractCase(type) {
    const updStart = src.indexOf('function updateCreatures(dt) {');
    if (updStart < 0) throw new Error('updateCreatures not found');
    const s = src.indexOf('case "' + type + '":', updStart);
    if (s < 0) throw new Error('case not found');
    let i = src.indexOf('{', s),
      d = 0;
    for (; i < src.length; i++) {
      if (src[i] === '{') d++;
      else if (src[i] === '}') {
        d--;
        if (d === 0) break;
      }
    }
    return src.slice(s, i + 1);
  }
  const caseText = extractCase('rat');
  const runner = new Function(
    'c', 'p', 'dt', 'tx', 'R', 'clamp', 'animParts', 'npcRoadRules', 'CEM_FENCE_Y', 'CEM_BACK_Y', 'GZ', 'state',
    'switch (c.type) { ' + caseText + ' }',
  );
  const GZ = 0.3;
  const R = (a, b) => (a + b) / 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const c = {
    type: 'rat', wx: 0, wy: 0, dir: 1, sp: 5, flee: 0,
    kickT: 0.55, kickDur: 0.55, kickVx: 8, kickVy: 0, kickZ: 0,
    g: { position: { z: GZ }, rotation: { x: 0, y: 0, z: 0 } },
  };
  const p = { wx: -2, wy: 0 };
  let sawHop = false,
    landZok = true,
    sawGetUp = false,
    endFlee = 0,
    endWx = 0;
  for (let f = 0; f < 60; f++) {
    const tx = c.wx - p.wx;
    runner(c, p, 0.05, tx, R, clamp, () => {}, () => 0, 8, 10, GZ, 'play');
    if (c.kickZ > 0.3) sawHop = true;
    if (c.g.position.z < GZ - 1e-6) landZok = false;
    if (c.getUpT > 0) sawGetUp = true;
    if (c.flee > 0 && c.kickT <= 0 && c.getUpT <= 0) {
      endFlee = c.flee;
      endWx = c.wx;
    }
  }
  check('the rat arcs UP off the ground while flung (a visible hop)', sawHop, 'sawHop=' + sawHop);
  check('the rat never sinks below the ground (z stays >= GZ)', landZok, 'landZok=' + landZok);
  check('the rat GETS UP (a settle beat) after landing', sawGetUp, 'sawGetUp=' + sawGetUp);
  check('the rat then SCURRIES OFF (flee armed) and has moved along its fling line', endFlee > 0 && endWx > 1, 'endFlee=' + endFlee + ' endWx=' + endWx);
}

console.log('');
console.log(pass ? 'KICK-A-RAT CHECKS PASSED' : 'KICK-A-RAT CHECKS FAILED (' + failed + ' failed)');
process.exitCode = pass ? 0 : 1;