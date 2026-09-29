// _hopper_burst_chk.js — smoke-test spawnHopperBurst(): it must emit a gross, varied
// shower (dust puffs, tumbling debris, maggots, hopper-juice, brown goo) that rides the
// dust-particle pipeline with an ELEVATED emitter (p.bz) so bits pop out of the hopper
// mouth and rain back down to the street.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extract(name){
  // brace-counted (indentation-proof)
  const idx = html.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  const brace = html.indexOf('{', idx);
  let depth = 0, i = brace;
  for (; i < html.length; i++){
    if (html[i] === '{') depth++;
    else if (html[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return html.slice(idx, i + 1);
}
const code =
  extract('spawnHopperBurst') +
  '\n' +
  extract('hopperWetSpray') +
  '\n' +
  extract('dropPickleDrips');

// --- minimal THREE / world stubs (enough to run the spawner and inspect its output) ---
let planeCount = 0, boxCount = 0, sphereCount = 0;
const THREE = {
  DoubleSide: 2,
  Group: class { constructor(){ this.children = []; this.position = { set(){} }; } add(c){ this.children.push(c); } },
  Mesh: class { constructor(g, m){ this.geometry = g; this.material = m; this.position = { set(){} }; } },
  PlaneGeometry: class { constructor(w, h){ this.kind = 'plane'; planeCount++; } },
  BoxGeometry: class { constructor(a, b, c){ this.kind = 'box'; boxCount++; } },
  SphereGeometry: class { constructor(r){ this.kind = 'sphere'; this.r = r; sphereCount++; } },
  MeshLambertMaterial: function(o){ this.color = o.color; this.transparent = !!o.transparent; this.opacity = o.opacity; this.side = o.side; },
  MeshBasicMaterial: function(o){ this.color = o.color; this.opacity = o.opacity; }
};
const dynamicGroup = { add(){} };
const pick = (arr) => arr[0];                       // deterministic — good enough for a smoke test
const R = (a, b) => a + (b - a) * 0.5;               // midpoint, always a finite number
const hopperTopZ = () => 2.4;
const GZ = 0.01;
const ROUTE_START_X = 0;
const ROUTE_FINISH_X = 650;
const sfxCalls = [];
const SFX = { playSpraySound(w){ sfxCalls.push(w); } };
const voiceRec = [];
const Voice = { say(text){ voiceRec.push(text); } };
const bubbles = [];
function spawnBubble(t, x, y, sp){ bubbles.push({ t: t, sp: sp }); }
const nearHopper = () => true; // the worker is standing by the hopper (cycle beat)
const WORKER_GENDER = 'male';
const worldGroup = { add(){} };
const HP_HIT_HOPPER = +html.match(/const HP_HIT_HOPPER = (\d+)/)[1];
const PICKLE_TRAIL_STEPS = +html.match(/const PICKLE_TRAIL_STEPS = (\d+)/)[1];
const DRENCH_LINES = eval(html.match(/const DRENCH_LINES = (\[[\s\S]*?\]);/)[1]);
const hurtRec = [];
function hurtNPC(amt, cause, noYelp, allowCinematic){ hurtRec.push({ amt: amt, cause: cause, noYelp: noYelp, allowCinematic: allowCinematic }); }
const stunRec = [];
function doStun(dur, type){ stunRec.push({ dur: dur, type: type }); }
const splatRec = [];
function splatJuice(){ splatRec.push(1); }
function makeSpawner(weather, p, bag, residueBag){
  const dustParticles = bag;
  const hopperResidue = residueBag;
  return new Function('THREE','dynamicGroup','dustParticles','pick','R','hopperTopZ','GZ','weather','p','ROUTE_START_X','ROUTE_FINISH_X','SFX','Voice','spawnBubble','nearHopper','WORKER_GENDER','worldGroup','hopperResidue','HP_HIT_HOPPER','PICKLE_TRAIL_STEPS','DRENCH_LINES','hurtNPC','doStun','splatJuice',
    code + '\n;return spawnHopperBurst;')(THREE, dynamicGroup, dustParticles, pick, R, hopperTopZ, GZ, weather, p, ROUTE_START_X, ROUTE_FINISH_X, SFX, Voice, spawnBubble, nearHopper, WORKER_GENDER, worldGroup, hopperResidue, HP_HIT_HOPPER, PICKLE_TRAIL_STEPS, DRENCH_LINES, hurtNPC, doStun, splatJuice);
}

// Fire a full-intensity burst plus the lighter start/trickle intensities used in the game.
const dustParticles = [];
const spawnHopperBurst = makeSpawner('sunny', { wx: 300, wy: -4.5 }, dustParticles, []);
spawnHopperBurst(-30, -4.5, 1.0);
spawnHopperBurst(-30, -4.5, 0.7);
spawnHopperBurst(-30, -4.5, 0.14);

let ok = true;
const check = (label, cond, info) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (cond ? '' : '  [' + info + ']')); if (!cond) ok = false; };

check('spawner runs and pushes bits into the dust pipeline', dustParticles.length > 0, 'count=' + dustParticles.length);
check('every bit uses an ELEVATED emitter (p.bz set)', dustParticles.every(p => p.bz != null), 'some bit missing bz');
check('emitter is above the street (bz > GZ)', dustParticles.every(p => p.bz > GZ), 'a bit sits at/below the street');
check('bits start near the hopper mouth (wx/wy finite)', dustParticles.every(p => isFinite(p.wx) && isFinite(p.wy)), 'non-finite x/y');
check('has AIR/DUST puffs (translucent planes)', planeCount > 0, 'planeCount=' + planeCount);
check('has tumbling DEBRIS (boxes)', boxCount > 0, 'boxCount=' + boxCount);
check('has JUICE/GOO drops (spheres)', sphereCount > 0, 'sphereCount=' + sphereCount);
check('every bit has full motion state (vx,vy,vz,life,decay,rotSpeed)', dustParticles.every(p =>
  isFinite(p.vx) && isFinite(p.vy) && isFinite(p.vz) && isFinite(p.life) && isFinite(p.decay) && isFinite(p.rotSpeed) && p.life > 0), 'incomplete record');
check('pop-out starts upward (vz > 0 on at least half the bits)', dustParticles.filter(p => p.vz > 0).length >= dustParticles.length / 2, 'too few upward');

// ---- 2) RAINY HOPPER: wet spray out of the SIDE seams, gushing with level progress ----
check('static: wet spray only fires on rainy shifts', html.indexOf('if (weather !== "rain") return;') >= 0);
check('sunny burst: NO water spray (dry load never squirts)', dustParticles.every(x => !x.water));
const rainBagEarly = [];
const residueEarly = [];
const spEarly = makeSpawner('rain', { wx: ROUTE_START_X, wy: -4.5 }, rainBagEarly, residueEarly); // level START
spEarly(-30, -4.5, 1.0);
const earlyWet = rainBagEarly.filter(x => x.water);
check('rain + level START: only a bit of water (a few dribbles)', earlyWet.length > 0 && earlyWet.length < 12, 'n=' + earlyWet.length);
check('rain spray comes from the hopper SIDE seams (|wy offset| >= 0.45, not the mouth)', earlyWet.length > 0 && earlyWet.every(x => Math.abs(x.wy - -4.5) >= 0.45));
check('rain spray jets REAR/-X like the debris (all vx < 0)', earlyWet.length > 0 && earlyWet.every(x => x.vx < 0));
check('rain spray is water-flagged (widening plume pipeline) with a life', earlyWet.length > 0 && earlyWet.every(x => x.water === true && x.maxLife > 0));
const rainBagLate = [];
const residueLate = [];
const pLate = { wx: ROUTE_FINISH_X, wy: -4.5 };
const spLate = makeSpawner('rain', pLate, rainBagLate, residueLate); // level END
spLate(-30, -4.5, 1.0);
const lateWet = rainBagLate.filter(x => x.water);
const avgSpeed = arr => arr.reduce((a, x) => a + Math.abs(x.vx), 0) / Math.max(1, arr.length);
check('rain + level END: the gush is MUCH bigger (more bits, faster jet)', lateWet.length > earlyWet.length * 3 && avgSpeed(lateWet) > avgSpeed(earlyWet) * 1.5, 'early=' + earlyWet.length + '@' + avgSpeed(earlyWet).toFixed(2) + ' late=' + lateWet.length + '@' + avgSpeed(lateWet).toFixed(2));
check('the end-of-level gush throws BIG globs (radius >= 0.05)', lateWet.some(x => x.g.children.length > 0 && x.g.children[0].geometry && x.g.children[0].geometry.r >= 0.05));
check('no globs at the level START (the gush builds)', earlyWet.every(x => x.g.children.length === 0 || x.g.children[0].geometry.r < 0.05));

// ---- 3) the gush HISSES + SOAKS the worker + leaves a wet trail -------------------------
check('static: playSpraySound is bandpassed spray noise, called with the wetness', html.indexOf('playSpraySound(wet) {') >= 0 && html.indexOf('SFX.playSpraySound(wet);') >= 0);
check('the gush HISSES: spray SFX fires with the wetness (0 at start, 1 at end)', sfxCalls.length === 2 && sfxCalls[0] === 0 && sfxCalls[1] === 1, JSON.stringify(sfxCalls));
check('sunny compactions are SILENT (no spray hiss)', dustParticles.length > 0 && sfxCalls.length === 2);
check('no wet trail at the level START (the gush builds)', residueEarly.length === 0, 'n=' + residueEarly.length);
check('the gush peak leaves dark wet streaks on the pavement (3 per gush)', residueLate.length === 3, 'n=' + residueLate.length);
check('static: the trail fades + dries out in updateHopperTrash', html.indexOf('the trail dries out') >= 0 && html.indexOf('function clearHopperResidue()') >= 0);
check('the first drench line is the ORIGINAL river line (+ juice + pickle-water boots)', voiceRec.length >= 1 && voiceRec[0] === DRENCH_LINES[0] && DRENCH_LINES[0].indexOf('whole river in there') >= 0 && DRENCH_LINES[0].toLowerCase().indexOf('juice') >= 0 && DRENCH_LINES[0].toLowerCase().indexOf('pickle') >= 0 && pLate.drenched === true, JSON.stringify(voiceRec));
check('every drench line is about hopper juice / pickle-water boots', DRENCH_LINES.length === 3 && DRENCH_LINES.every(t => t.toLowerCase().indexOf('juice') >= 0 && t.toLowerCase().indexOf('pickle') >= 0));
check('the soak pops a STAINED GROSS! bubble (speaker "gross")', bubbles.some(b => b.t === "GROSS!" && b.sp === "gross"), JSON.stringify(bubbles));
check('the gush splash DRAINS health: hurtNPC(HP_HIT_HOPPER, "hopper", noYelp, allowCinematic)', hurtRec.length === 1 && hurtRec[0].amt === HP_HIT_HOPPER && hurtRec[0].cause === 'hopper' && hurtRec[0].noYelp === true && hurtRec[0].allowCinematic === true, JSON.stringify(hurtRec));
check('static: hurtNPC honors the cinematic exception (route-end gush lands, other hits stay frozen)', html.indexOf('function hurtNPC(amount, cause, noYelp, allowCinematic)') >= 0 && html.indexOf('state !== "play" && !allowCinematic') >= 0);
check('static: the drench no longer depends on nearHopper (the truck-hidden route-end bug)', code.indexOf('nearHopper') < 0);
check('static: HP_HIT_HOPPER is a light splash (<= a vehicle run-over)', html.indexOf('const HP_HIT_HOPPER = 4;') >= 0 && HP_HIT_HOPPER <= 8);
check('the juice splash TRIPS him (modest doStun "trip")', stunRec.length === 1 && stunRec[0].type === 'trip' && stunRec[0].dur >= 0.5, JSON.stringify(stunRec));
check('the soak splashes water ON the worker (droplets near p.wx)', rainBagLate.some(x => x.water && Math.abs(x.wx - ROUTE_FINISH_X) < 1));
spLate(-30, -4.5, 1.0); // the NEXT burst of the SAME compaction (the POP after the kick-in)
check('the juice line does NOT repeat mid-compaction (the armed flag is consumed)', voiceRec.length === 1);
check('static: the reaction is armed PER-COMPACTION (light spew re-arms, the gush consumes)', html.indexOf('if (intensity < 0.5) p.hopperGushArmed = true;') >= 0 && html.indexOf('if (wet >= 0.5 && intensity >= 0.5 && p.hopperGushArmed !== false)') >= 0);
spLate(-30, -4.5, 0.14); // the continuous spew eases off: the flag RE-ARMS
spLate(-30, -4.5, 1.0); // the NEXT compaction
check('the NEXT compaction CATCHES him AGAIN: full reaction every gush (hurt + line + splat)', hurtRec.length === 2 && voiceRec.length === 2 && splatRec.length === 2 && stunRec.length === 2, 'hurt=' + hurtRec.length + ' voice=' + voiceRec.length + ' splat=' + splatRec.length + ' stun=' + stunRec.length);
check('the juice line ROTATES on the 2nd gush (not a repeat)', voiceRec.length === 2 && voiceRec[1] === DRENCH_LINES[1], JSON.stringify(voiceRec));
{
  const wrS = html.indexOf('const WRITEUP_REASONS = {');
  const REASONS = eval(html.slice(wrS, html.indexOf('};', wrS) + 1).replace('const ', ''));
  check('WRITEUP_REASONS.hopper: "Bathing in public without permission" (the exact stamp)', REASONS.hopper && REASONS.hopper.indexOf('Bathing in public without permission') >= 0, JSON.stringify(REASONS.hopper));
}
check('static: p.drenched resets per shift + juice line rotates per shift + trails cleared at day end', html.indexOf('p.drenched = false;') >= 0 && html.indexOf('p.drenchCount = 0;') >= 0 && html.indexOf('clearHopperResidue();') >= 0);

// ---- the splash window: MID-route -> end (the player sees it happen) -----------------
check('static: the splash window starts MID-route (wet >= 0.5, not just the 0.8 peak)', html.indexOf('wet >= 0.5 &&') >= 0);
check('hat drips fall from head height (bz ~1.55, drifting DOWN, near p.wx)', rainBagLate.some(x => x.water && x.bz >= 1.4 && x.vz < 0 && Math.abs(x.wx - ROUTE_FINISH_X) < 1));
check('static: the GROSS! bubble is stained (bub-gross CSS + spawnBubble maps the speaker)', html.indexOf('.bubble.bub-gross') >= 0 && html.indexOf('speaker === "gross") cls = "bubble bub-gross"') >= 0);
check('static: green pickle prints + trail priority + 1 HP self-bump line', html.indexOf('isPickle ? 0x4a7a2e') >= 0 && html.indexOf('p.pickleSteps > 0 ? p.pickleSteps : p.poopSteps') >= 0 && html.indexOf("I'm walking in MY pickle water!") >= 0 && html.indexOf('hurtNPC(1, "hopper", true)') >= 0);
check('static: the pickle trail + self-bump flag reset per shift', html.indexOf('p.pickleSteps = 0;') >= 0 && html.indexOf('p.pickleBump = false;') >= 0);
const midBag = [];
const residueMid = [];
const pMid = { wx: ROUTE_FINISH_X / 2, wy: -4.5 };
const spMid = makeSpawner('rain', pMid, midBag, residueMid);
spMid(-30, -4.5, 1.0);
check('a MID-route (50%) compaction CATCHES the worker (hurt + juice line + GROSS)', hurtRec.length === 3 && hurtRec[2].cause === 'hopper' && voiceRec.length === 3 && pMid.drenched === true && bubbles.some(b => b.t === "GROSS!" && b.sp === "gross"));
check('the mid-route splash arms the pickle boots (full green trail, self-bump pending) + NO residue before the peak', pMid.pickleSteps === PICKLE_TRAIL_STEPS && pMid.pickleBump === false && residueMid.length === 0, 'pickleSteps=' + pMid.pickleSteps + ' residue=' + residueMid.length);

// ---- 4) the SPLASH REACTION: the worker visibly staggers + the screen SPLATS -----
check('static: the #splat olive-brine overlay exists (DOM + CSS flash + animation)', html.indexOf('<div id="splat"></div>') >= 0 && html.indexOf('#splat') >= 0 && html.indexOf('@keyframes splatFlash') >= 0);
check('static: the drench block fires splatJuice (the screen splash is unmistakable)', html.indexOf('if (typeof splatJuice === "function") splatJuice();') >= 0);
check('the drench SPLATS the screen every compaction (splatJuice fired 3x: late, next compaction, mid route)', splatRec.length === 3, 'n=' + splatRec.length);
check('static: the route-end loop ticks p.stunT + updateGag (the trip/stun gag animates inside the cinematic)', html.indexOf('if (p.stunT > 0) p.stunT -= dt;') >= 0 && html.indexOf('updateGag(dt);') >= 0);
check('static: the compactor cycle YIELDS to the soaked stagger while p.stunT > 0', html.indexOf('SOAKED STAGGER') >= 0 && html.indexOf('SOAKED MID-WALK-IN') >= 0);

console.log(ok ? '\nHOPPER BURST ALL CHECKS PASS (' + dustParticles.length + ' bits: ' + planeCount + ' dust, ' + boxCount + ' debris, ' + sphereCount + ' goo)'
               : '\nHOPPER BURST FAILURES');
process.exit(ok ? 0 : 1);