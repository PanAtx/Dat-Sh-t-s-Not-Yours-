// Driveway dog-shit check:
//   1) dog-shit piles spawn ON the driveway slabs (Flatbush + Staten Island levels),
//   2) the worker's poop trigger fires ONLY when the worker steps in the pile
//      (standard r-circle, like the other hazards) — merely walking near the pile
//      (curb, sidewalk, or on the slab) does NOT start the brown trail,
//   3) ground dressing (piles, brown footprint trail, blood smears) lifts to the slab
//      top (GZ + 0.04) so it is visible on the concrete, not buried inside it,
//   4) stepping in the pile: a wet procedural SQUELCH SFX + a burst of brown flecks
//      (gravity + bounce + fade), the first 3 trail steps still "pop" too, and the
//      worker takes a TINY visual stagger (0.45s, no stun / no damage).
// Runs the REAL collideStatic + groundZAt extracted from index.html in a harness.
const fs = require('fs');
const src = fs.readFileSync('index.html', 'utf8');

let pass = true;
const check = (name, c, e) => {
  console.log((c ? 'PASS' : 'FAIL') + '  ' + name + (c ? '' : '  [' + e + ']'));
  if (!c) pass = false;
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

console.log('[1] groundZAt — ground dressing height per surface');
{
  const gza = extract('groundZAt');
  check(
    'groundZAt exists and lifts to the slab top (GZ + 0.04) only on the slab (wy 5..13, within 1.5u of a block boundary)',
    /GZ \+ 0\.04/.test(gza) && /wy >= 5 && wy <= 13/.test(gza) && /d <= 1\.5/.test(gza),
  );
  const gzaFn = new Function('BW', 'GZ', gza + '\n return groundZAt;')(8, 0.3);
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  check('groundZAt(152, 6.5) = GZ + 0.04 (slab center at the block boundary)', near(gzaFn(152, 6.5), 0.34));
  check('groundZAt(150.6, 6.5) = GZ + 0.04 (front half of the slab, in the previous cell)', near(gzaFn(150.6, 6.5), 0.34));
  check('groundZAt(153.4, 6.5) = GZ + 0.04 (back half of the slab, in the next cell)', near(gzaFn(153.4, 6.5), 0.34));
  check('groundZAt(148, 2) = GZ (sidewalk)', near(gzaFn(148, 2), 0.3));
  check('groundZAt(152, 4.9) = GZ (just in front of the slab edge)', near(gzaFn(152, 4.9), 0.3));
  check('groundZAt(153.6, 6.5) = GZ (past the slab edge)', near(gzaFn(153.6, 6.5), 0.3));
  check('groundZAt(152, 13.4) = GZ (past the slab back edge)', near(gzaFn(152, 13.4), 0.3));
}

console.log('');
console.log('[2] piles + trigger + trails in the source');
{
  const addDs = extract('addDogShit');
  check(
    'addDogShit: piles sit at the slab top via groundZAt (no more burying)',
    /const z = wy < 0\.8 \? GZ \+ 0\.05 : groundZAt\(wx, wy\);/.test(addDs),
  );
  check(
    'driveway slab builder: spawns dog-shit piles on the slab (0.25 chance per driveway — rate cut from 0.4)',
    /if \(Math\.random\(\) < 0\.25\) \{[\s\S]*?addDogShit\(b, b\.worldX \+ ds, R\(5\.4, 7\.5\)\);/.test(src),
  );
  check(
    'driveway piles: off the doghouse center (8.0, 6.5) and inside the worker reach (wy <= 7.5 < 8.0)',
    /const ds = Math\.random\(\) < 0\.5 \? R\(6\.7, 7\.6\) : R\(8\.4, 9\.3\);/.test(src),
  );
  const csSrc = extract('collideStatic');
  check(
    'poop trigger: fires ONLY when the worker steps in the pile (standard r-circle)',
    /const inRange = d2 <= hz\.r \* hz\.r;/.test(csSrc),
  );
  check(
    'poop trigger: the old wide "walk past it" triggers are gone (no x-band 1.1, no wy <= 5.5 band)',
    !/p\.wy <= 5\.5/.test(csSrc) && !/Math\.abs\(hz\.wx - p\.wx\) < 1\.1/.test(csSrc) && !/Math\.abs\(p\.wy - hz\.wy\) < 1\.1/.test(csSrc),
  );
  const df = extract('dropFootprint');
  check(
    'brown footprint trail: lifts to the slab top (groundZAt) so it shows on the driveway',
    /const footZ = \(p\.wy < 0\.8 \? GZ \+ 0\.05 : groundZAt\(p\.wx, p\.wy\)\) \+ 0\.02;/.test(df),
  );
  const dbs = extract('dropBloodSplatter');
  check(
    'blood smears: lift to the slab top too (leash-dog bites happen on the slabs)',
    /const baseZ = wy < 0\.8 \? GZ \+ 0\.05 : groundZAt\(wx, wy\);/.test(dbs),
  );
  const sqi = src.indexOf('playSquelch() {');
  const sq = src.slice(sqi, sqi + 700);
  check(
    'squelch SFX: a wet lowpassed noise gurgle + a low descending bloop + a second deeper squish (procedural)',
    /this\.noise\(0\.16, "lowpass", 320, 0\.85\);/.test(sq) && /this\.tone\("sine", 150, 42, 0\.2, 0\.7, 0\.01\);/.test(sq) && /this\.noise\(0\.12, "lowpass", 190, 0\.5, 0\.1\);/.test(sq),
  );
  check(
    'trigger: fires the squelch + a brown fleck burst + the 0.45s tiny slip + 3 popping trail steps (no stun / no damage)',
    /SFX\.playSquelch\(\);/.test(csSrc) && /dropPooFlecks\(p\.wx, p\.wy\);/.test(csSrc) && /p\.fleckSteps = 3;/.test(csSrc) && /p\.slipT = 0\.45;/.test(csSrc),
  );
  check(
    'trail: the FIRST 3 trail steps (p.fleckSteps) each pop a brown fleck burst',
    /if \(p\.fleckSteps > 0\) \{\s*dropPooFlecks\(p\.wx, p\.wy\);[\s\S]*?p\.fleckSteps--;/.test(src),
  );
  const uf = extract('updateFlecks');
  check(
    'flecks: arc under gravity, bounce a little, and fade before despawn',
    /f\.vz -= 12 \* dt;/.test(uf) && /f\.vz = -f\.vz \* 0\.35;/.test(uf) && /f\.mat\.opacity = Math\.max\(0, f\.life \/ 0\.3\) \* f\.baseOp;/.test(uf),
  );
  check(
    'resetWorldState: clears the flecks array + p.fleckSteps + p.slipT per shift',
    src.includes('flecks.length = 0;') && src.includes('p.fleckSteps = 0;') && src.includes('p.slipT = 0;'),
  );
  check(
    'slip: a TINY visual stagger only — decays over 0.45s and yields to a real stun',
    /if \(p\.slipT > 0\) \{[\s\S]{0,400}?if \(p\.stunT <= 0\) \{[\s\S]{0,400}?worker\.group\.rotation\.x = -0\.28 \* k/.test(src),
  );
}

console.log('');
console.log('[3] functional — the REAL collideStatic, run in a harness');
{
  const csSrc = extract('collideStatic');
  const runHazard = (wx, wy, pX, pY) => {
    const said = [];
    const rec = { hurt: 0, dmg: 0, cause: null, stuns: 0, squelches: 0, flecks: 0 };
    const p = { wx: pX, wy: pY, invuln: 0, stunT: 0, immuneT: 0, poopSteps: 0, fleckSteps: 0, slipT: 0 };
    const blocks = [{ hazards: [{ wx: wx, wy: wy, r: 0.65, type: 'poop', drop: 0, cd: 0 }] }];
    const Voice = { say: (t) => said.push(t) };
    const hurtNPC = (a, cause) => {
      rec.hurt++;
      rec.dmg += a;
      rec.cause = cause;
    };
    const doStun = (d, type) => {
      rec.stuns++;
    };
    const SFX = { playSquelch: () => rec.squelches++ };
    const dropPooFlecks = () => rec.flecks++;
    const fn = new Function(
      'state',
      'p',
      'blocks',
      'Voice',
      'hurtNPC',
      'doStun',
      'SFX',
      'dropPooFlecks',
      'WORKER_GENDER',
      'HP_HIT_GHOSTARM',
      'HP_HIT_HAZARD',
      'footDist',
      'dropCarried',
      'carry',
      'dt',
      csSrc + '\n collideStatic(dt);',
    );
    fn('play', p, blocks, Voice, hurtNPC, doStun, SFX, dropPooFlecks, 'male', 4, 5, 0, function () {}, 'none', 0.016);
    return { said: said, rec: rec, p: p };
  };

  // The worker rides up the slab to the doghouses: a pile on the slab at (152, 6.5)
  // (block boundary 152 = slab center, wy 6.5 = on the slab near the doghouse).
  const onPile = runHazard(152, 6.5, 152, 6.5);
  check(
    'slab pile: worker on the pile -> "dog shit!" + 16-step brown trail, no damage/stun',
    onPile.said.indexOf('dog shit!') >= 0 && onPile.p.poopSteps === 16 && onPile.rec.hurt === 0 && onPile.rec.stuns === 0,
  );
  const steppedIn = runHazard(152, 6.5, 152.5, 6.5);
  check(
    'slab pile: worker 0.5u off (stepping in it, < r 0.65) -> triggers',
    steppedIn.said.indexOf('dog shit!') >= 0 && steppedIn.p.poopSteps === 16,
  );
  const beside = runHazard(152, 6.5, 152.9, 6.5);
  check('slab pile: worker 0.9u off in x (still on the slab) -> does NOT trigger (no more wide x trigger)', beside.p.poopSteps === 0 && beside.said.length === 0);
  check(
    'on the pile: SQUELCH SFX + a brown fleck burst + 0.45s tiny slip + 3 popping trail steps',
    onPile.rec.squelches === 1 && onPile.rec.flecks >= 1 && onPile.p.slipT === 0.45 && onPile.p.fleckSteps === 3,
  );
  check(
    'walking past (0.9u off): NO squelch, NO flecks, NO slip',
    beside.rec.squelches === 0 && beside.rec.flecks === 0 && beside.p.slipT === 0 && beside.p.fleckSteps === 0,
  );
  check(
    'stepping in (0.5u off): squelch + flecks fire too',
    steppedIn.rec.squelches === 1 && steppedIn.rec.flecks >= 1 && steppedIn.p.slipT === 0.45,
  );
  const deep = runHazard(152, 6.5, 152, 7.9);
  check(
    'slab pile: worker 1.4u BEHIND the pile (deeper on the slab) -> does NOT trigger',
    deep.p.poopSteps === 0 && deep.said.length === 0,
  );
  const nearEdge = runHazard(152, 6.5, 152, 5.6);
  check('slab pile: worker 0.9u in FRONT of the pile (at the slab edge) -> does NOT trigger', nearEdge.p.poopSteps === 0 && nearEdge.said.length === 0);
  const offSlabX = runHazard(152, 6.5, 150.8, 6.5);
  check('slab pile: worker 1.2u off in x -> does NOT trigger', offSlabX.p.poopSteps === 0);

  // Realism: merely being NEAR a pile (curb or sidewalk) must NOT start the trail.
  const walk = runHazard(146, 0.2, 146, 4.5);
  check(
    'sidewalk pile: worker walks past at wy 4.5 (4.3u laterally away) -> does NOT trigger (no more wide trigger)',
    walk.p.poopSteps === 0 && walk.said.length === 0,
  );
  const stepSidewalk = runHazard(146, 0.2, 146.4, 0.4);
  check(
    'sidewalk pile: worker STEPS IN it (0.45u off) -> "dog shit!" + 16-step trail',
    stepSidewalk.said.indexOf('dog shit!') >= 0 && stepSidewalk.p.poopSteps === 16,
  );
  const curb = runHazard(146, 0.5, 146.8, 0.6);
  check('curb pile: worker next to it (0.8u off) -> does NOT trigger (no more wide trigger)', curb.p.poopSteps === 0 && curb.said.length === 0);
  const stepCurb = runHazard(146, 0.5, 146.4, 0.55);
  check('curb pile: worker STEPS IN it (0.4u off) -> 16-step trail', stepCurb.p.poopSteps === 16);
}

console.log('');
console.log(pass ? 'DRIVEWAY DOG-SHIT CHECKS PASSED' : 'DRIVEWAY DOG-SHIT CHECKS FAILED');
process.exit(pass ? 0 : 1);