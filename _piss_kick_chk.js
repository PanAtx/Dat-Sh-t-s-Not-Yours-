// _piss_kick_chk.js — the piss-bottle bump: the worker stumbles (existing trip) AND the
// bottle gets KICKED away (tumble + fade + despawn), leaving a piss STAIN on the
// pavement where it stood. Extracts the real kickPissBottle / spawnPissStain /
// updatePissKicks from index.html and runs them against real three.js objects.
const fs = require('fs');
const path = require('path');
const THREE = require(path.join(__dirname, 'three_r128.min.js'));
const h = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function check(n, c, e) {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (e && !c ? '  [' + e + ']' : ''));
  if (c) pass++; else fail++;
}
// extract the body of a function declared in index.html
function extractBody(name, stopName) {
  const s = h.indexOf('function ' + name + '(');
  if (s < 0) throw new Error('function not found: ' + name);
  const e = stopName ? h.indexOf('function ' + stopName + '(') : h.length;
  return h.slice(s, e);
}

// ---- static wiring ----------------------------------------------------------------
check('spawn: the piss bottle hazard keeps a reference to its 3D group (yb)',
  /yellow: true,\s*yb: yb/.test(h));
check('collideStatic: the yellow bump kicks the bottle (guarded so it only happens once)',
  h.indexOf('if (!hz.kicked) kickPissBottle(hz)') >= 0);
check('kickPissBottle: the trip hazard dies with the bottle (kicked flag + r = 0)',
  extractBody('kickPissBottle').indexOf('hz.kicked = true;') >= 0 &&
  extractBody('kickPissBottle').indexOf('hz.r = 0;') >= 0);
check('kickPissBottle: the stain is left at the bottle spot BEFORE it flies away',
  (function(){
    const s = extractBody('kickPissBottle');
    return s.indexOf('spawnPissStain(hz.wx, hz.wy, a)') < s.indexOf('pissKicks.push');
  })());
check('stain: it is PERMANENT (in dynamicGroup, not on the fading footprints schedule)',
  (function(){
    const s = extractBody('spawnPissStain', 'kickPissBottle');
    return s.indexOf('dynamicGroup.add(g)') >= 0 && s.indexOf('footprints.push') < 0;
  })());
check('stain: it sits on the pavement via groundZAt (slab-aware) + 0.02u above it',
  extractBody('spawnPissStain').indexOf('groundZAt(wx, wy) + 0.02') >= 0);
check('stain: it is a ROUND liquid splash (circle discs, no boxes)',
  (function(){
    const s = extractBody('spawnPissStain', 'kickPissBottle');
    return s.indexOf('THREE.CircleGeometry') >= 0 && s.indexOf('BoxGeometry') < 0;
  })());
check('main loop: updatePissKicks(dt) runs in the PLAY branch (right before collideStatic)',
  /updatePissKicks\(dt\);[\s\S]{0,120}collideStatic\(dt\);/.test(h));
check('kick: materials are CLONED so the fade never leaks into other bottles\' shared glass',
  extractBody('kickPissBottle').indexOf('o.material = o.material.clone()') >= 0);
check('PRANK POINTS: the cone knock awards +10 at the WORKER spot (bubble pops over him)',
  /SFX\.playConeKnock\(\);\s*awardPrankPoints\(10, p\.wx, p\.wy\)/.test(h));
check('PRANK POINTS: messing with the cat awards +10 at the WORKER spot (the "Hiss!" bubble keeps the cat\'s slot)',
  /c\.state = "chasing";[\s\S]{0,300}awardPrankPoints\(10, p\.wx, p\.wy\)/.test(h));
check('PRANK PAYOUT: awardPrankPoints pays STREET CASH via addStreetCash + pops a "+.. points" bubble (NOT score)',
  (function(){
    const s = h.slice(h.indexOf('function awardPrankPoints('), h.indexOf('function ', h.indexOf('function awardPrankPoints(') + 10));
    return s.indexOf('addStreetCash(n)') >= 0 && s.indexOf('addScore') < 0 && s.indexOf('spawnBubble("+" + v + " points", wx, wy, "score")') >= 0;
  })());
check('PRANK PAYOUT: addStreetCash feeds ONLY bonusTally (the street-cash tally), never the score',
  (function(){
    const s = h.slice(h.indexOf('function addStreetCash('), h.indexOf('function ', h.indexOf('function addStreetCash(') + 10));
    return s.indexOf('bonusTally += n * scoreMultiplier()') >= 0 && s.indexOf('score +=') < 0 && s.indexOf('dayScore') < 0 && s.indexOf('weekScore') < 0;
  })());
check('POWER-UP ECONOMY: every $5000 of street cash drops a healer (coffee/BEC) near the worker',
  h.indexOf('const POWERUP_CASH_STEP = 5000') >= 0 &&
  /if \(state === "play" && bonusTally >= healerNextAt\)[\s\S]{0,120}spawnHealerNearPlayer\(\);[\s\S]{0,60}healerNextAt \+= POWERUP_CASH_STEP;/.test(h) &&
  /function spawnHealerNearPlayer\(\)[\s\S]{0,300}"coffee" : "bec"/.test(h));
check('POWER-UP ECONOMY: Red Bull (Monster) is still SCORE-triggered at $30,000, healers at street cash',
  h.indexOf('const MONSTER_SCORE_STEP = 30000') >= 0 &&
  /if \(state === "play" && score >= monsterNextAt\)/.test(h));
check('PRANK POINTS: score bubbles get the green bub-score class and a 2-second life',
  h.indexOf('if (speaker === "score") cls = "bubble bub-score";') >= 0 &&
  /speaker === "score"\s*\?\s*2\.0/.test(h) &&
  h.indexOf('.bubble.bub-score') >= 0);

// ---- dynamic: run the REAL functions against real three.js objects ----------------
{
  const GZ = 0.3;
  const R = (lo, hi) => lo + Math.random() * (hi - lo);
  const groundZAt = () => GZ; // plain street
  const dynamicGroup = new THREE.Group();
  const blockGroup = new THREE.Group(); // the street block the bottle is built into
  const disposed = [];
  const disposeObj = (o) => disposed.push(o);
  const prankAwards = [];
  const awardPrankPointsSpy = (n, wx, wy) => prankAwards.push([n, wx, wy]);
  const src =
    'let pissKicks = [];\n' +
    extractBody('spawnPissStain', 'kickPissBottle') + '\n' +
    extractBody('kickPissBottle', 'updatePissKicks') + '\n' +
    extractBody('updatePissKicks', 'addWrapper') +
    '\nreturn { kickPissBottle, spawnPissStain, updatePissKicks, kicks: () => pissKicks };';
  const api = new Function('THREE', 'R', 'GZ', 'groundZAt', 'dynamicGroup', 'disposeObj', 'awardPrankPoints', src)(
    THREE, R, GZ, groundZAt, dynamicGroup, disposeObj, awardPrankPointsSpy);

  // build a real piss bottle: 3 meshes SHARING one glass material + a cap of its own
  const glassM = new THREE.MeshLambertMaterial({ color: 0xa9c9dd, transparent: true, opacity: 0.38 });
  const capM = new THREE.MeshLambertMaterial({ color: 0x8a9096 });
  const bottle = new THREE.Group();
  const mkMesh = (m) => { const ms = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), m); bottle.add(ms); return ms; };
  const m1 = mkMesh(glassM), m2 = mkMesh(glassM), m3 = mkMesh(glassM);
  const mCap = mkMesh(capM);
  bottle.position.set(10 - 8, -1.2, GZ); // block-local (block worldX = 8)
  blockGroup.add(bottle);
  const hz = { wx: 10, wy: -1.2, r: 0.9, yellow: true, yb: bottle };

  api.kickPissBottle(hz);
  check('kick: the hazard is dead (kicked flag + radius zeroed)', hz.kicked === true && hz.r === 0, 'r=' + hz.r);
  check('kick: the bottle leaves the street block and joins the live world',
    bottle.parent === dynamicGroup, 'parent=' + (bottle.parent === dynamicGroup ? 'dynamicGroup' : bottle.parent === blockGroup ? 'blockGroup' : 'none'));
  check('kick: the bottle starts at its WORLD position (not block-local)',
    Math.abs(bottle.position.x - 10) < 1e-6 && Math.abs(bottle.position.y - -1.2) < 1e-6,
    'pos=(' + bottle.position.x + ',' + bottle.position.y + ')');
  check('kick: a +10 points award fires at the bottle spot (score bubble source)',
    prankAwards.length === 1 && prankAwards[0][0] === 10 &&
    prankAwards[0][1] === hz.wx && prankAwards[0][2] === hz.wy,
    JSON.stringify(prankAwards));
  check('kick: the materials are cloned (the fade cannot leak into the shared glass)',
    m1.material !== glassM && m2.material !== glassM && mCap.material !== capM);
  check('kick: a piss STAIN (round splash discs) was left at the bottle spot on the pavement',
    (function(){
      const stain = dynamicGroup.children.find((c) => c !== bottle);
      return !!stain && Math.abs(stain.position.x - 10) < 1e-6 && Math.abs(stain.position.y - -1.2) < 1e-6 &&
        Math.abs(stain.position.z - (GZ + 0.02)) < 1e-6 && stain.children.length >= 6 &&
        stain.children.every((c) => c.geometry && c.geometry.type === 'CircleGeometry');
    })(), 'dynamicGroup children=' + dynamicGroup.children.length);

  // animate: 20 frames in, the bottle has flown and started fading, shared glass untouched
  const x0 = bottle.position.x, y0 = bottle.position.y;
  for (let i = 0; i < 20; i++) api.updatePissKicks(1 / 60);
  const flew = Math.hypot(bottle.position.x - x0, bottle.position.y - y0);
  check('kick: the bottle tumbles AWAY (moved > 0.3u in 20 frames)', flew > 0.3, 'moved=' + flew.toFixed(2) + 'u');
  check('kick: the bottle is fading out (cloned opacity below its base)',
    m1.material.opacity < m1.material.userData.baseOp - 0.05, 'op=' + m1.material.opacity.toFixed(3) + ' base=' + m1.material.userData.baseOp);
  check('kick: the SHARED glass of the other bottles is untouched',
    glassM.opacity === 0.38 && capM.opacity === 1, 'glass=' + glassM.opacity);

  // run past the 0.45s duration: despawned + disposed, the stain survives
  for (let i = 0; i < 40; i++) api.updatePissKicks(1 / 60);
  check('kick: after ~0.5s the bottle is despawned (removed + disposed, queue empty)',
    bottle.parent === null && disposed.indexOf(bottle) >= 0 && api.kicks().length === 0,
    'parent=' + bottle.parent + ' disposed=' + (disposed.indexOf(bottle) >= 0) + ' queue=' + api.kicks().length);
  check('kick: the stain STAYS on the pavement after the bottle is gone',
    dynamicGroup.children.length === 1 && dynamicGroup.children[0] !== bottle);
  check('kick: a second bump of the same (kicked) hazard cannot re-kick it',
    hz.kicked === true && api.kicks().length === 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);