// run_checks.mjs - the "npm test" entry point: runs every check suite and prints a
// single PASS/FAIL banner.
//   1. _preload_gate_chk.js        - the "Getting Assets" gate + real preloadAssetsToCache
//   2. _compressed_models_chk.mjs  - truck + can decode via local GLTFLoader + DRACOLoader
//   3. _pickup_compressed_chk.mjs  - BEC / Red Bull / car / coffee cup + index.html wiring
//   4. _render_res_chk.js          - low-res retro render (RENDER_H 540/720/native) wiring
//   5. inline script syntax        - every <script> block in index.html still parses
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
const DIR = import.meta.dirname;

const suites = [
  ['preload gate', 'node', '_preload_gate_chk.js'],
  ['truck + can compressed', 'node', '_compressed_models_chk.mjs'],
  ['pickups compressed (BEC / Red Bull / car / coffee)', 'node', '_pickup_compressed_chk.mjs'],
  ['render resolution (retro low-res)', 'node', '_render_res_chk.js'],
  ['camera lane follow (subtle 3D)', 'node', '_cam_follow_chk.js'],
  ['piss bottle kick + stain', 'node', '_piss_kick_chk.js'],
  ['powerup spawn ahead (visible + reachable)', 'node', '_powerup_spawn_chk.js'],
  ['delivery cyclist + L1 tuning', 'node', '_delivery_cyclist_chk.js'],
  ['traffic negotiation (knot fix)', 'node', '_traffic_nego_chk.js'],
  ['slapstick + weather (squash-stretch / hat pop / bag cascade / rain)', 'node', '_slapstick_weather_chk.js'],
  ['punchback (retaliation vs the 12 attack NPCs)', 'node', '_punch_back_chk.js'],
  ['write-up stamp fits mobile (CSS invariants)', 'node', '_writeup_mobile_chk.js'],
  ['health carry-over (no refill at level start - street-cash healer / write-up restores)', 'node', '_health_carryover_chk.js'],
  ['danger zone POW! + 1980s arcade voice ("San Man Needs Food Badly")', 'node', '_danger_pow_chk.js'],
  ['25 new street treasures (kinds 43-67 + spawnBonus draw)', 'node', '_treasures25_chk.js'],
  ['pigeon flocks stay around the worker + scare payout (+10 street cash)', 'node', '_pigeon_chk.js'],
  ['per-day NPC roster + traffic cap v2 (Maspeth d4 two-wheeler scene)', 'node', '_roster_chk.js'],
  ['litter baskets (pickup / carry / dump / return-flight / bones)', 'node', '_litterbasket_chk.js'],
  ['overtime win condition (win fires the instant the last basket is emptied)', 'node', '_bonus_win_chk.js'],
  ['overtime WIN celebration (hop -> spin -> dance -> settle)', 'node', '_bonus_dance_chk.js'],
  ['overtime reward (Red Bull actually spawns on Thursday after a win)', 'node', '_redbull_reward_chk.js'],
  ['overtime reward is a GHOSTLY arm+hand holding the Red Bull (spectral aura, non-damaging)', 'node', '_ghostbull_chk.js'],
  ['overtime store row is a continuous wall (no slip-through the gaps/sides)', 'node', '_overtime_storewall_chk.js'],
  ['overtime street critters (randomized curb trees + rats/pizza rat + bodega cats)', 'node', '_overtime_critters_chk.js'],
  ['failed-route REPLAY (below 95% -> replay the SAME level, not the next day)', 'node', '_route_replay_chk.js'],
  ['pedestrians flee the cop/robber crossfire line (bed-stuy shootout)', 'node', '_crossfire_chk.js'],
  ['kick a rat (free-handed Act -> squeal + fling + scurry off)', 'node', '_kick_rat_chk.js'],
  ['Flatbush driveway tricycle kid is impossible to miss (route thirds + walk-edge apron + approach yell)', 'node', '_tric_route_chk.js'],
  ['soccer + tee-ball kids route AROUND sidewalk trees/boxes (never stuck behind one)', 'node', '_soccer_avoid_chk.js'],
  ['worker free-handed Act kicks the soccer ball (Golazo! + not-fair + $5)', 'node', '_soccer_kick_chk.js'],
  ['trainer Infinite Health = can\'t-be-hurt ONLY (no speed/sparkle; Run It Up keeps its own package)', 'node', '_cheat_god_chk.js'],
  ['standing NPCs never spawned in leaf shade + flush heavy-bag twist-tie', 'node', '_npc_sight_chk.js'],
  ['guaranteed-clear stand: no hooker/jacker/panhandler keeps a spot under a crown', 'node', '_npc_clear_chk.js'],
  ['THE NIGHT SHIFT (the haunted level after Sunday: emptied street, shovel, ecoplasm hopper, the DEAD-END CEMETERY and THE SLUG DEMON — the heart-window final boss)', 'node', '_nightshift_chk.js'],
  ['THE SLUG DEMON (the final boss rig: slug body, sharp-grin, two tentacle arms, the exposed HEART as the only shovel target, the fury ramp and the roam gate)', 'node', '_slug_boss_chk.js'],
  ['THE WRITE-UP REBOUND (a LODI written up DURING the final boss fight, shift continuing, hands the Slug Demon back its FULL 10/10 bar — with the animated climb back)', 'node', '_boss_recover_chk.js'],
  ['STRAY-LINE GUARD (the "b is not defined at load" class: a function-body line stranded at top level parses fine and stops the game booting)', 'node', '_stray_line_chk.js'],
  ['THE MIDNIGHT DEAD END (one cross-street + one corner store at the TOP of the level; the last block is St Basuras Cemetery - no buildings, wrought-iron fence the length of the street, the plaque, the worker iron wall)', 'node', '_night_deadend_chk.js'],
  ['THE MIDNIGHT FENCED LOTS (the chain-link over the five paved-over intersections: every pipe pole stands Z-UP, one street-facing panel per lot with NO side runs, the panel recessed ON the building line y 7.25 so it never sticks out past the houses)', 'node', '_night_lot_fence_chk.js'],
  ['THE MIDNIGHT BLOCK PACKS (the hellhound tail rides the rump up-and-back; a DIFFERENT set of horrors on every block - gremlins, goblins, devils, fangspiders, eye crawlers, red-eyed skeletons, pitfiends)', 'node', '_night_packs_chk.js'],
  ['MIDNIGHT BOOT (the playtest build starts on the haunted shift with NO trainer menu)', 'node', '_midnight_boot_chk.js'],
  ['THE MIDNIGHT LOOK (moonlit darkness, street lamps, lit windows, retro-reflective hi-vis)', 'node', '_midnight_look_chk.js'],
  ['route-end cinematic walk-around path (no truck clipping) + THE MIDNIGHT DRIVE-OFF GATE (a blocked clock-out stays a no-op, never a null-sequencer crash)', 'node', '_routeend_path_chk.js'],
  ['hazard lights (the rear DSNY blink: 1s outer pair / 1s middle, and the midnight beacon in beat)', 'node', '_hazlights_chk.js'],
  ['radio station e2e (the weekday rotation excludes the midnight-only set; the night shift rotates its own four songs; offline cache)', 'node', '_radio_e2e.js'],
  ['THE MOBILE BUDGET (low-spec first-run profile: 320P/LO/30 with a chosen-key-wins law; the render governor stepping RENDER_H on frame time with hysteresis; the FX tier halving the boss storm and widening the parry/heart windows for thumbs)', 'node', '_mobile_perf_chk.js'],
];

let allPass = true;
for (const [name, cmd, arg] of suites) {
  const r = spawnSync(cmd, [arg], { cwd: DIR, stdio: 'inherit' });
  const passed = r.status === 0;
  allPass = allPass && passed;
  console.log('\n===== [' + (passed ? 'PASS' : 'FAIL') + '] ' + name + ' =====');
}

// ---- 4: index.html inline scripts still parse ----
let synOk = true;
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((code, i) => {
  try { new vm.Script(code, { filename: 'inline#' + i }); }
  catch (e) { synOk = false; console.log('  syntax fail inline#' + i + ': ' + e.message); }
});
console.log('\n===== [' + (synOk ? 'PASS' : 'FAIL') + '] index.html inline script syntax (' + scripts.length + ' blocks) =====');
allPass = allPass && synOk;

console.log('\n==========================================');
console.log(allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
console.log('==========================================');
process.exit(allPass ? 0 : 1);
