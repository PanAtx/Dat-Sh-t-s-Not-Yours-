// Driveway dog-shit check:
//   1) dog-shit piles spawn ON the driveway slabs (Flatbush + Staten Island levels),
//   2) the worker's poop trigger covers slab piles (wy > 4.8) via the pile's depth band,
//      while sidewalk piles keep the wide lateral trigger (regression),
//   3) ground dressing (piles, brown footprint trail, blood smears) lifts to the slab
//      top (GZ + 0.04) so it is visible on the concrete, not buried inside it.
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
    'driveway slab builder: spawns dog-shit piles on the slab (0.4 chance per driveway)',
    /if \(Math\.random\(\) < 0\.4\) \{[\s\S]*?addDogShit\(b, b\.worldX \+ ds, R\(5\.4, 7\.5\)\);/.test(src),
  );
  check(
    'driveway piles: off the doghouse center (8.0, 6.5) and inside the worker reach (wy <= 7.5 < 8.0)',
    /const ds = Math\.random\(\) < 0\.5 \? R\(6\.7, 7\.6\) : R\(8\.4, 9\.3\);/.test(src),
  );
  const csSrc = extract('collideStatic');
  check(
    'poop trigger: sidewalk/curb piles keep the wide lateral trigger (p.wy <= 5.5)',
    /hz\.wy <= 4\.8\s*\?\s*p\.wy <= 5\.5/.test(csSrc),
  );
  check(
    'poop trigger: slab piles (wy > 4.8) fire on the pile depth band (|p.wy - hz.wy| < 1.1)',
    /Math\.abs\(p\.wy - hz\.wy\) < 1\.1/.test(csSrc),
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
}

console.log('');
console.log('[3] functional — the REAL collideStatic, run in a harness');
{
  const csSrc = extract('collideStatic');
  const runHazard = (wx, wy, pX, pY) => {
    const said = [];
    const rec = { hurt: 0, dmg: 0, cause: null, stuns: 0 };
    const p = { wx: pX, wy: pY, invuln: 0, stunT: 0, immuneT: 0, poopSteps: 0 };
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
    const fn = new Function(
      'state',
      'p',
      'blocks',
      'Voice',
      'hurtNPC',
      'doStun',
      'WORKER_GENDER',
      'HP_HIT_GHOSTARM',
      'HP_HIT_HAZARD',
      'footDist',
      'dropCarried',
      'carry',
      'dt',
      csSrc + '\n collideStatic(dt);',
    );
    fn('play', p, blocks, Voice, hurtNPC, doStun, 'male', 4, 5, 0, function () {}, 'none', 0.016);
    return { said: said, rec: rec, p: p };
  };

  // The worker rides up the slab to the doghouses: a pile on the slab at (152, 6.5)
  // (block boundary 152 = slab center, wy 6.5 = on the slab near the doghouse).
  const onPile = runHazard(152, 6.5, 152, 6.5);
  check(
    'slab pile: worker on the pile -> "dog shit!" + 16-step brown trail, no damage/stun',
    onPile.said.indexOf('dog shit!') >= 0 && onPile.p.poopSteps === 16 && onPile.rec.hurt === 0 && onPile.rec.stuns === 0,
  );
  const beside = runHazard(152, 6.5, 152.9, 6.5);
  check('slab pile: worker 0.9u off in x (still on the slab) -> triggers (wide x trigger)', beside.p.poopSteps === 16);
  const deep = runHazard(152, 6.5, 152, 7.9);
  check(
    'slab pile: worker 1.4u BEHIND the pile (deeper on the slab) -> does NOT trigger',
    deep.p.poopSteps === 0 && deep.said.length === 0,
  );
  const nearEdge = runHazard(152, 6.5, 152, 5.6);
  check('slab pile: worker 0.9u in FRONT of the pile (at the slab edge) -> triggers', nearEdge.p.poopSteps === 16);
  const offSlabX = runHazard(152, 6.5, 150.8, 6.5);
  check('slab pile: worker 1.2u off in x -> does NOT trigger', offSlabX.p.poopSteps === 0);

  // Regression: sidewalk piles keep the wide trigger.
  const walk = runHazard(146, 0.2, 146, 4.5);
  check(
    'sidewalk pile: worker walks over its x at wy 4.5 -> triggers (wide trigger unchanged)',
    walk.said.indexOf('dog shit!') >= 0 && walk.p.poopSteps === 16,
  );
  const curb = runHazard(146, 0.5, 146.8, 0.6);
  check('curb pile: worker next to it -> triggers (wide trigger unchanged)', curb.p.poopSteps === 16);
}

console.log('');
console.log(pass ? 'DRIVEWAY DOG-SHIT CHECKS PASSED' : 'DRIVEWAY DOG-SHIT CHECKS FAILED');
process.exit(pass ? 0 : 1);