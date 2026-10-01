// _piss_kick_chk.js — the piss-bottle bump: the worker does NOT stumble — the bottle
// gets KICKED away (tumble + fade + despawn), leaving a piss STAIN on the pavement
// where it stood. Same for the sidewalk LITTER cluster: the bottles just SCATTER, no
// trip. Extracts the real kickPissBottle / scatterLitter / spawnPissStain /
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
check('spawn: the litter hazard keeps a reference to its 3D cluster (litter)',
  /type: "trip",\s*drop: 0,\s*cd: 0,\s*litter: g,/.test(h));
check('collideStatic: the yellow (piss bottle) branch has NO doStun — kick, no stumble',
  (function(){
    const i = h.indexOf('} else if (hz.yellow) {');
    const j = h.indexOf('} else if (hz.litter) {', i);
    return i >= 0 && j > i && h.slice(i, j).indexOf('doStun') < 0;
  })());
check('collideStatic: the litter branch has NO doStun — the bottles just scatter',
  (function(){
    const i = h.indexOf('} else if (hz.litter) {');
    const j = h.indexOf('} else if (hz.type === "acorn") {', i); // the branch that follows the litter branch (Maspeth oak-block acorns)
    return i >= 0 && j > i &&
      h.slice(i, j).indexOf('doStun') < 0 &&
      h.slice(i, j).indexOf('scatterLitter(hz, Math.atan2(hz.wy - p.wy, hz.wx - p.wx))') >= 0;
  })());
check('collideStatic: OTHER trip hazards (cans, cones...) STILL stumble the worker',
  (function(){
    const j = h.indexOf('doStun(0.8, "trip")', h.indexOf('} else if (hz.litter) {'));
    return j > 0 && h.slice(j, j + 200).indexOf('dropCarried()') >= 0;
  })());
check('scatterLitter: the trip hazard dies with the bottles (scattered flag + r = 0)',
  extractBody('scatterLitter').indexOf('hz.scattered = true;') >= 0 &&
  extractBody('scatterLitter').indexOf('hz.r = 0;') >= 0);
check('scatterLitter: materials are CLONED so the fade never leaks into the shared glass',
  extractBody('scatterLitter').indexOf('o.material = o.material.clone()') >= 0);
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
    '\nreturn { kickPissBottle, spawnPissStain, updatePissKicks, scatterLitter, kicks: () => pissKicks };';
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

  // ---- live: the sidewalk LITTER cluster SCATTERS (no stumble, no stain) ----
  const glassM2 = new THREE.MeshLambertMaterial({ color: 0xa9c9dd, transparent: true, opacity: 0.38 });
  const capM2 = new THREE.MeshLambertMaterial({ color: 0xf5f0e8 });
  const cluster = new THREE.Group();
  const bts = [];
  for (let i = 0; i < 3; i++) {
    const bt = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), glassM2);
    bt.add(m);
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), capM2);
    c.position.y = 0.25;
    bt.add(c);
    bt.position.set(i - 1, i % 2 ? 0.25 : -0.25, 0.09);
    cluster.add(bt);
    bts.push(bt);
  }
  cluster.position.set(20 - 16, 2.0, GZ); // block-local (block worldX = 16)
  blockGroup.add(cluster);
  const hz2 = { wx: 20, wy: 2.0, r: 1.0, litter: cluster };

  api.scatterLitter(hz2, 0);
  check('scatter: the hazard is dead (scattered flag + radius zeroed)',
    hz2.scattered === true && hz2.r === 0, 'r=' + hz2.r);
  check('scatter: every bottle left the street block and joined the live world',
    bts.every((bt) => bt.parent === dynamicGroup));
  check('scatter: each bottle is at its own WORLD position (cluster center + offset)',
    Math.abs(bts[0].position.x - 19) < 1e-6 && Math.abs(bts[0].position.y - 1.75) < 1e-6 &&
    Math.abs(bts[1].position.x - 20) < 1e-6 && Math.abs(bts[1].position.y - 2.25) < 1e-6 &&
    Math.abs(bts[2].position.x - 21) < 1e-6 && Math.abs(bts[2].position.y - 1.75) < 1e-6,
    'b0=(' + bts[0].position.x + ',' + bts[0].position.y + ')');
  check('scatter: the materials are cloned (the fade cannot leak into the shared glass)',
    bts[0].children[0].material !== glassM2 && bts[0].children[1].material !== capM2);
  check('scatter: NO stain and NO prank points for plain litter (only the 3 bottles are new)',
    dynamicGroup.children.length === 4 && prankAwards.length === 1,
    'dyn=' + dynamicGroup.children.length + ' awards=' + prankAwards.length);

  const starts = bts.map((bt) => [bt.position.x, bt.position.y]);
  for (let i = 0; i < 20; i++) api.updatePissKicks(1 / 60);
  const moved = bts.map((bt, i) =>
    Math.hypot(bt.position.x - starts[i][0], bt.position.y - starts[i][1]));
  check('scatter: every bottle tumbles AWAY (each moved > 0.3u in 20 frames)',
    moved.every((m) => m > 0.3), 'moved=' + moved.map((m) => m.toFixed(2)).join(','));
  check('scatter: the SHARED glass of the other clusters is untouched',
    glassM2.opacity === 0.38 && capM2.opacity === 1, 'glass=' + glassM2.opacity);

  for (let i = 0; i < 40; i++) api.updatePissKicks(1 / 60);
  check('scatter: after ~1s every bottle is despawned (removed + disposed, queue empty)',
    bts.every((bt) => bt.parent === null && disposed.indexOf(bt) >= 0) && api.kicks().length === 0,
    'queue=' + api.kicks().length);
  check('scatter: the stain from the PISS kick is the only thing left on the pavement',
    dynamicGroup.children.length === 1 && dynamicGroup.children[0] !== hz.yb);
  check('scatter: a second bump of the same (scattered) hazard cannot re-scatter it',
    hz2.scattered === true && api.kicks().length === 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);