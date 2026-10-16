// run_checks.mjs - the "npm test" entry point: runs every check suite and prints a
// single PASS/FAIL banner.
//   1. _preload_gate_chk.js        - the "Getting Assets" gate + real preloadAssetsToCache
//   2. _compressed_models_chk.mjs  - truck + can decode via local GLTFLoader + DRACOLoader
//   3. _pickup_compressed_chk.mjs  - BEC / Red Bull / car / coffee cup + index.html wiring
//   4. _render_res_chk.js          - low-res retro render (RENDER_H 540/720/native) wiring
//   5. inline script syntax        - every <script> block in index.html still parses
//
// THE SUITES ARRAY IS THE SHORT LIST. The long tail of gates lives in
// _suites_extra.json (data, so adding a gate is one JSON line) - see the merge below.
// Every entry there was validated in a CLEAN CLONE of main by `node _suite_hunt.mjs`:
// the working tree carries gitignored scratch (three_r128.js, the _tex_* dumps,
// truck.fbx, node_modules) that a suite can lean on and pass here while dying in CI,
// so the clone is the only referee. Suites that fail there are reported by the hunt and
// deliberately NOT registered - a gate that is red on arrival only trains people to
// ignore red.

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
  ['prize persistence (street cash / hell notes / power-ups never evaporate behind the worker)', 'node', '_prize_keep_chk.js'],
  ['delivery cyclist + L1 tuning', 'node', '_delivery_cyclist_chk.js'],
  ['traffic negotiation (knot fix)', 'node', '_traffic_nego_chk.js'],
  ['slapstick + weather (squash-stretch / hat pop / bag cascade / rain)', 'node', '_slapstick_weather_chk.js'],
  ['punchback (retaliation vs the 12 attack NPCs)', 'node', '_punch_back_chk.js'],
  ['write-up stamp fits mobile (CSS invariants)', 'node', '_writeup_mobile_chk.js'],
  ['ending screens (arcade GAME OVER boot-in-shit + WEEK COMPLETE cash rain: transform/opacity-only loops, phone piece budget, tally + teardown)', 'node', '_ending_screens_chk.js'],
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
  ['THE MIDNIGHT FENCED LOTS (the chain-link over the five paved-over intersections: pipe poles standing Z-UP, one alpha-cut woven-weave panel per lot with NO side runs, recessed ON the building line y 7.25, a NO TRESPASSING tin on the wire, the wire as the worker\'s hard wall (no side, no squeeze) with its bump tell, and one Joss note per lot fenced behind the wire — shovel-only; THE CHAIN-LINK IS MIDNIGHT-ONLY: isNightShift-gated builder on the per-level groundGroup, never the scene root)', 'node', '_night_lot_fence_chk.js'],
  ['THE MIDNIGHT BLOCK PACKS (the hellhound tail rides the rump up-and-back; a DIFFERENT set of horrors on every block - gremlins, goblins, devils, fangspiders, eye crawlers, red-eyed skeletons, pitfiends)', 'node', '_night_packs_chk.js'],
  ['WEEK START (a fresh week boots on MONDAY / level 1; Midnight stays level 8 of 8, reachable by the panel and by clearing Sunday)', 'node', '_week_start_chk.js'],
  ['THE MIDNIGHT LOOK (moonlit darkness, street lamps, lit windows, retro-reflective hi-vis)', 'node', '_midnight_look_chk.js'],
  ['route-end cinematic walk-around path (no truck clipping) + THE MIDNIGHT DRIVE-OFF GATE (a blocked clock-out stays a no-op, never a null-sequencer crash)', 'node', '_routeend_path_chk.js'],
  ['hazard lights (the rear DSNY blink: 1s outer pair / 1s middle, and the midnight beacon in beat)', 'node', '_hazlights_chk.js'],
  ['radio station e2e (the weekday rotation excludes the midnight-only set; the night shift rotates its own four songs; offline cache)', 'node', '_radio_e2e.js'],
  ['THE MOBILE BUDGET (low-spec first-run profile: 320P/LO/30 with a chosen-key-wins law; THE RENDER GOVERNOR loans RENDER_H down the ladder and the frame cap 60->30 on sustained slow frames, then hands EVERYTHING back to the SETTINGS pick - cap first, rung by rung, up to NATIVE, repeatably, never writing a settings key; THE LIVE SCREENS are the shift AND THE TRAINER MENU (governed, its buffers follow the loan, the 2D marquee canvas drops to dpr 1); the FX tier halving the boss storm and widening the parry/heart windows for thumbs; and THE TRAINER TIER spending the same one rule in halves - 600 -> 300 balls in flight, 17 -> 9 marquee chars bent, 16 -> 8 ghost-trail arcs)', 'node', '_mobile_perf_chk.js'],
  ['THE PIXEL LOAN / THE RETURN LAW (the settings block + governor run LIVE on the real page code: no TDZ at boot, the ladder AND the frame cap are loaned on sustained EXPENSIVE frames (late for the cap AND a draw that eats its share of the budget), a clean stretch hands every lever back to the player\'s own SETTINGS pick - a NATIVE pick returns NATIVE - the rows + note tell the loan, no settings key is ever written, and the TRAINER gets the same loan + return with its buffers re-sized on every buffer step)', 'node', '_gov_return_chk.js'],
  ['THE TIER LADDER + THE MEASUREMENT FIX (v1.0.560, on the real page code: a verdict is a RATIO against the cap\'s own frame budget with the Draw Ledger\'s draw ms as the work half, measured against the PLAYER\'S budget; THE DEADLOCK REGRESSION - a 30 fps-capped, healthy stream walks the whole ladder back, which the old absolute 24/17.5 ms law made mathematically shut; the lever plan is BUILT FROM THE SETTINGS (rungs, cap, shadows LO, shadows OFF, CRT off, storm half + quarter) and reaches the real draw state (shadow map, shadow pass, overlays, storm draw range); rows keep naming the player\'s pick with an arrow, no settings key is written, and ?perf=1 turns on the renderer.info readout)', 'node', '_tier_ladder_chk.js'],
  ['THE TEXTURE BUDGET (v1.0.560: no embedded image above 1024px in any shipped GLB, the set inside 1.6MB of texture bytes / 96MB of GPU upload (the audit measured 4.41MB / ~213MB), the re-baked files proved STRUCTURALLY VALID GLBs (header, buffer length, every bufferView inside the BIN), index.html clamps every model at all 8 loader callbacks with the aspect kept + needsUpdate, the byte-accurate PRELOAD table matches the real bytes, and every re-baked asset carries a per-asset cache version so installed phones stop serving the old big-sheet bytes)', 'node', '_gltf_texture_budget_chk.mjs'],
  ['THE GPU SAFETY NET (v1.0.561, run live on the page block with a mock canvas: webglcontextlost PREVENTS THE DEFAULT + raises the loop gate + auto-pauses the shift + shows the #gpuLost card with the REBUILD reload path; webglcontextrestored rebuilds a NEW WebGLRenderer on the SAME canvas, re-applies the retro buffer + the player shadow rows, drops the dead shadow map, re-deploys the TIER LADDER, wipes the governor clocks and hides the card; a "restored" with nothing lost rebuilds nothing; the loop gates exactly once, right after the rAF re-arm; a phone backgrounded mid-shift comes back PAUSED and a throttled tab can never borrow a lever; the card ships hidden with its CSS)', 'node', '_ctx_recovery_chk.js'],
  ['THE DRAW-CALL WINDOW (v1.0.562: THE SHADOW-CASTER BUDGET - fbxInstance counts an instance\'s triangles, and above 60k the meshes opt OUT of the shadow pass and carry ONE colourWrite:false/depthWrite:false bounding-box proxy built from the model\'s own Box3, so the truck\'s 284k-triangle shadow pass becomes 12 triangles while small models keep casting their true silhouette and every mesh keeps RECEIVING; THE BLOCK WINDOW - applyBlockViewWindow rides updateBlocks every frame and hides the b.group of blocks more than 200u from the worker, short-circuiting whole subtrees of matrix updates, sphere tests and draw calls, writing the flag only on change, surviving a missing worker, running live in a sandbox on the real functions; and the ledger reports dc / tri so both wins are measurable in play)', 'node', '_drawcall_window_chk.js'],
  ['THE PAINT LAW + THE STORAGE LEASE (v1.0.563, running the REAL sw.js in a sandbox with a mock Cache API: a cached navigation is answered with the CACHED PAGE while the network revalidation runs BEHIND the paint and its bytes are put() for the next launch; a cache miss goes to the network; offline with no cache falls back to the precached ./index.html; models + radio stay pass-through; shell assets stay cache-first and fill in. THE LEASE: requestStoragePersist() runs once at boot, asks navigator.storage.persist, reads persisted(), survives a browser with no Storage API (granted=lease / refused=best-effort / absent=lease? proven live), and the perf line reports it)', 'node', '_paint_store_chk.js'],
  ['THE RAIN BANDING METER (the streak field keeps a dense height ladder and honest wall-clock time at 12/20/30/60fps — the mobile "horizontal white waves" fix)', 'node', '_rain_band_chk.js'],
  ['OFFLINE COVERAGE (every model + every MP3 — the Midnight songs and the trainer menu track — plus the shell/webfonts is cached for a no-network play)', 'node', '_offline_cache_chk.js'],
  ['THE STATION SHIP CHECK (manifest<->disk parity for Pages, the trainer-track convention, the ID3 credits, the 96 kbps size budget, a real MPEG frame at the audio start)', 'node', '_music_ship_chk.js'],
  ['THE GATE REGISTRY (every suite npm test names is tracked on main - no .gitignore may swallow a gate, no long-tail entry may duplicate or vanish)', 'node', '_gate_registry_chk.js'],
  ['THE VERSION NUMBER IS MAIN-SCREEN ONLY (#app-version, the clickable TRAINER trigger; the pause / game-over / route-complete / week-complete / day-intro / loading panels carry none, and the boot stamp can no longer leak one in)', 'node', '_ver_display_chk.js'],
];

// ---- THE LONG TAIL (_suites_extra.json, written by node _suite_hunt.mjs) ----
// Entries are merged only if their file is tracked here, so a suite deleted from main
// disappears from npm test on its own. Names are deduped against the short list.
const EXTRA_FILE = path.join(DIR, '_suites_extra.json');
let extra = { suites: [] };
if (fs.existsSync(EXTRA_FILE)) {
  try { extra = JSON.parse(fs.readFileSync(EXTRA_FILE, 'utf8')); }
  catch (e) { console.log('WARNING: _suites_extra.json unreadable, long-tail gates skipped: ' + e.message); }
} else {
  console.log('note: _suites_extra.json not found - running the short list only');
}

const queue = [];
const seen = new Set();
const dropped = [];
for (const entry of suites.concat(extra.suites || [])) {
  const [name, cmd, file] = entry;
  if (!file || seen.has(file)) continue;
  if (!fs.existsSync(path.join(DIR, file))) { dropped.push(file); continue; }
  seen.add(file);
  queue.push([name, cmd, file]);
}
for (const f of dropped) console.log('note: ' + f + ' is not in the repo - its gate is skipped');

let allPass = true;
for (const [name, cmd, arg] of queue) {
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
console.log((allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED') +
  '  (' + queue.length + ' suites: ' + suites.length + ' listed + ' + (queue.length - suites.length) + ' from _suites_extra.json)');
console.log('==========================================');
process.exit(allPass ? 0 : 1);
