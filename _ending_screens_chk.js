// THE ENDING SCREENS (the arcade GAME OVER + WEEK COMPLETE menus):
//   The player must KNOW in one glance whether he won or lost, on an ANIMATED menu
//   that is FUN (Nintendo / SEGA era): GAME OVER = a boot stomping a pile of dog
//   shit (splat + stink cloud + flies + "EWWWW!") under a flickering red banner, a
//   rain of brown drips and a panel jolt; WEEK COMPLETE = $100 bills raining like
//   confetti over a spinning gold sunburst with a bouncing money bag, orbiting
//   coins, a "KA-CHING!" ribbon, an arcade score tally and a rank crown.
//   It must also FIT phones and be near-free on CPU/GPU: transform/opacity only,
//   no per-frame JS, tiny viewport-aware piece counts, everything off when hidden.
// Statically asserts the CSS / HTML / JS invariants, then runs the FX module in a
// fake DOM to prove the mobile budget + the teardown.
const fs = require('fs');
const src = fs.readFileSync('index.html', 'utf8');

let pass = true;
const check = (name, c, e) => {
  console.log((c ? 'PASS' : 'FAIL') + '  ' + name + (c ? '' : '  [' + e + ']'));
  if (!c) pass = false;
};
function braceBlock(from, open, close) {
  const i = src.indexOf(from);
  if (i < 0) return '';
  const a = src.indexOf(open, i);
  let d = 0, j = a;
  for (; j < src.length; j++) {
    if (src[j] === open) d++;
    else if (src[j] === close) { d--; if (d === 0) break; }
  }
  return src.slice(i, j + 1);
}
const cssBlock = (sel) => braceBlock(sel + ' {', '{', '}');
const keyframes = (n) => (src.indexOf('@keyframes ' + n) < 0 ? '' : braceBlock('@keyframes ' + n, '{', '}'));
const extractFn = (n) => (src.indexOf('function ' + n + '(') < 0 ? '' : braceBlock('function ' + n + '(', '{', '}'));
// an HTML region between two markers (markup has no brace-nesting to walk)
function htmlRegion(a, b) {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  return i < 0 || j < 0 ? '' : src.slice(i, j);
}

// ============================== [1] the CSS law ==============================
console.log('[1] the ending FX CSS exists and obeys the mobile / GPU law');
{
  const fx = src.slice(src.indexOf('END-OF-RUN ARCADE SCREENS'), src.indexOf('===== MOBILE: keep the level-complete'));
  check('the END-OF-RUN ARCADE SCREENS CSS block is present', fx.length > 2000, 'block missing/truncated');
  check('the block has NO "//" comments (CSS has none - a "//" note once swallowed an animation)', !/^\s*\/\//m.test(fx), 'found a // comment in the CSS');
  check('the panel rides ABOVE its own rain layer (#over/#week-complete .panel z-index 2)', /#over \.panel,\s*#week-complete \.panel\s*\{[^}]*z-index:\s*2/.test(fx), 'no z-index 2 on the panels');
  check('the rain layer is a contained compositor layer (contain + pointer-events none)', /\.fx-layer \{[^}]*contain: layout style paint/.test(fx) && /\.fx-layer \{[^}]*pointer-events: none/.test(fx), 'fx-layer not contained/transparent');
  const bill = cssBlock('.fx-bill'), drip = cssBlock('.fx-drip'), kfBill = keyframes('fxBill'), kfDrip = keyframes('fxDrip');
  check('the falling bill + drip pieces ride infinite fx loops', /animation:\s*fxBill[^;]*infinite/.test(bill) && /animation:\s*fxDrip[^;]*infinite/.test(drip), 'no infinite fx loops on the pieces');
  const kfLoop = [kfBill, kfDrip, keyframes('goStomp'), keyframes('goPoop'), keyframes('goSplat'), keyframes('goStink'), keyframes('goBuzz'), keyframes('goBubble'), keyframes('winRaySpin'), keyframes('winBag'), keyframes('winCoin'), keyframes('winChing'), keyframes('fxVeilBreath'), keyframes('fxLoseFlicker'), keyframes('winBannerShine'), keyframes('pressBlink'), keyframes('newHiPulse'), keyframes('rankPop'), keyframes('fxPanelShake')];
  const layoutProp = /(?:^|[{;])(?:top|right|bottom|left|width|height|margin|padding|border-width|font-size|background-position|filter|box-shadow|inset)\s*:/m;
  const missing = kfLoop.filter((k) => !k).length;
  const offending = kfLoop.filter((kf) => kf && layoutProp.test(kf));
  check('every ending keyframe exists (' + kfLoop.length + ' loops)', missing === 0, missing + ' keyframe block(s) missing');
  check('EVERY ending loop animates transform/opacity ONLY (no layout-property = no thrash)', offending.length === 0, offending.length + ' loop(s) animate layout props');
  check('the piece loops are driven by CSS custom properties (--dur/--dl/--dx/--rz)', /var\(--dur/.test(bill) && /var\(--dl/.test(bill) && /var\(--dx/.test(kfBill) && /var\(--rz/.test(kfBill), 'pieces not var-driven');
  const mobile = fx.slice(fx.indexOf('@media (max-width: 640px), (max-height: 500px)'));
  check('the mobile fit block shrinks the scenes + the pieces for phones', /\.go-scene,/.test(mobile) && /height:\s*clamp\(54px/.test(mobile) && /\.fx-bill \{[^}]*width:\s*20px/.test(mobile), 'no phone sizing for scenes/pieces');
  const rm = fx.slice(fx.indexOf('@media (prefers-reduced-motion: reduce)'));
  check('prefers-reduced-motion kills every ending loop (rain, scenes, banners, shake)', rm.length > 40 && /\.fx-bill/.test(rm) && /\.fx-drip/.test(rm) && /\.go-scene \*/.test(rm) && /\.win-scene \*/.test(rm) && /#over\.fx-shake \.panel/.test(rm) && /animation: none/.test(rm), 'reduced-motion not covered');
  check('the splat keeps a static visible pose for a reduced-motion screen', /opacity:\s*0\.72/.test(cssBlock('.go-splat')), 'no static splat pose');
  check('the rain falls the WHOLE screen (118vh bill / 116vh drip travel)', /118vh/.test(kfBill) && /116vh/.test(kfDrip), 'rain travel too short');
}
// ============================== [2] the markup ==============================
console.log('');
console.log('[2] the two menus carry the win / lose scenes (and keep every ID the JS uses)');
{
  const over = htmlRegion('<div id="over"', '<div id="complete"');
  const week = htmlRegion('<div id="week-complete"', '<script src=');
  check('#over markup found', over.length > 300, 'region not found');
  check('#week-complete markup found', week.length > 300, 'region not found');
  check('#over has the drip layer + the sour veil + the animated panel', /fx-layer fx-lost/.test(over) && /fx-veil/.test(over) && /class="panel"/.test(over), 'layer/veil missing');
  check('the GAME OVER cartoon strip is built (boot / poop / splat / stink / flies / bubble)', /go-scene/.test(over) && /go-boot/.test(over) && /go-poop/.test(over) && /go-splat/.test(over) && /go-stink/.test(over) && /go-fly f3/.test(over) && /go-bubble/.test(over), 'scene pieces missing');
  check('the boot is a BOOT (U+1F462 = boot emoji entity)', /go-boot">\s*&#128098;/.test(over), 'no boot entity');
  check('the poop pile is stacked from three CSS blobs', /go-poop"><i class="p1"><\/i><i class="p2"><\/i><i class="p3">/.test(over), 'poop pile not built');
  check('#over keeps the IDs the JS writes: over-title / over-tag / finalscore / hiscore2 / btnRestart', /over-title/.test(over) && /over-tag/.test(over) && /id="finalscore"/.test(over) && /id="hiscore2"/.test(over) && /id="btnRestart"/.test(over), 'ID lost');
  check('#over shouts GAME OVER, offers PRESS START and carries the NEW HIGH SCORE ribbon', /arcade-banner go-banner/.test(over) && /Game Over/.test(over) && /press-start/.test(over) && /id="over-newhi"/.test(over), 'banner/press-start/newhi missing');
  check('#week-complete has the cash-rain layer inside the modal', /fx-layer fx-won/.test(week), 'fx-won layer missing');
  check('the WIN stage is built (rays / 3 coins / money bag / KA-CHING)', /win-rays/.test(week) && /win-coin c3/.test(week) && /win-bag/.test(week) && /win-ching/.test(week), 'win stage pieces missing');
  check('the money bag is the MONEY BAG (U+1F4B0)', /win-bag">\s*&#128176;/.test(week), 'no money bag entity');
  check('#week-complete keeps its IDs: week-title / week-tag / week-score / week-hi / btnWeekRestart', /week-title/.test(week) && /week-tag/.test(week) && /id="week-score"/.test(week) && /id="week-hi"/.test(week) && /id="btnWeekRestart"/.test(week), 'ID lost');
  check('#week-complete shouts YOU WIN + rank crown + PRESS START + NEW HIGH SCORE', /arcade-banner win-banner/.test(week) && /You Win!/.test(week) && /id="week-rank"/.test(week) && /press-start/.test(week) && /id="week-newhi"/.test(week), 'win extras missing');
}

// ============================== [3] the JS wiring ==============================
console.log('');
console.log('[3] the menus are armed on the win / lose beats and torn down on leave');
{
  const go = extractFn('gameOver'), wk = extractFn('showWeekComplete'), sdi = extractFn('showDayIntro'), quit = extractFn('quitGame');
  check('gameOver() found + arms the LOSING fx', go.length > 100 && /startEndingFx\("over"\)/.test(go), 'not armed in gameOver');
  check('gameOver() tallies the score + lights the NEW HIGH SCORE ribbon', /fxStartTally\(\$\("finalscore"\)/.test(go) && /fxStartTally\(\$\("hiscore2"\)/.test(go) && /fxShowEl\("over-newhi"/.test(go), 'tally/newhi missing');
  check('showWeekComplete() found + arms the WINNING fx', wk.length > 100 && /startEndingFx\("win"\)/.test(wk), 'not armed in showWeekComplete');
  check('showWeekComplete() crowns the rank + tallies + lights NEW HIGH SCORE', /weekRankOf\(weekScore\)/.test(wk) && /fxStartTally\(\$\("week-score"\)/.test(wk) && /fxShowEl\("week-newhi"/.test(wk), 'rank/tally/newhi missing');
  check('showDayIntro() tears the ending fx down (no rain alive on a day card)', /stopEndingFx\(\)/.test(sdi), 'no teardown in showDayIntro');
  check('quitGame() tears the ending fx down too', /stopEndingFx\(\)/.test(quit), 'no teardown in quitGame');
  const fxMod = src.slice(src.indexOf('const FX_LAW ='), src.indexOf('function gameOver('));
  check('the FX module exists between the law + gameOver', fxMod.length > 3000, 'module missing');
  check('the FX module runs NO per-frame loop (no rAF, no canvas, no three.js mesh)', !/requestAnimationFrame|THREE\.|new THREE/.test(fxMod) && !/const confettiParts/.test(fxMod), 'a per-frame loop leaked into the fx module');
  check('the module carries TWO arcade jingles (the boot splat + the cash rain)', /playBootSplat\s*\(\)\s*\{/.test(src) && /playCashRain\s*\(\)\s*\{/.test(src), 'a jingle is missing');
  check('every starting fx call is typeof-guarded (test harnesses stub these screens)', (go.match(/typeof startEndingFx === "function"/g) || []).length >= 1 && (wk.match(/typeof startEndingFx === "function"/g) || []).length >= 1, 'unguarded fx call');
  check('the tally timers are tracked + cleared (fxStopTallies clears every setInterval)', /fxTallyTimers/.test(fxMod) && /clearInterval/.test(extractFn('fxStopTallies')), 'no tally teardown');
  check('the piece builder only sets left + the loop vars (no inline top/width = CSS owns the motion)', (() => { const b = extractFn('fxBuildRain'); return /style\.left/.test(b) && /--dur/.test(b) && /--dl/.test(b) && /--dx/.test(b) && /--rz/.test(b) && !/style\.(top|width|height)/.test(b); })(), 'builder touches layout styles');
  check('the phone budget is written into the LAW (bills 11 / drips 4 vs 20 / 8 desktop)', /billsPhone:\s*11/.test(fxMod) && /billsDesktop:\s*20/.test(fxMod) && /dripsPhone:\s*4/.test(fxMod) && /dripsDesktop:\s*8/.test(fxMod), 'budget law missing');
}
// ============================== [4] behavioral: the FX module in a fake DOM =======
console.log('');
console.log('[4] behavioral: the piece budget, the shake, the tally + the teardown');
{
  const mkEl = (id, tag) => {
    const el = {
      id: id || '', tagName: tag || 'div', className: '', textContent: '',
      children: [], styleVars: {}, offsetWidth: 1, __frag: false, style: null,
    };
    el.style = { setProperty(k, v) { el.styleVars[k] = v; }, left: '', top: '', width: '', height: '' };
    const set = new Set();
    el.classList = {
      add: (c) => set.add(c), remove: (c) => set.delete(c),
      toggle: (c, on) => (on ? set.add(c) : set.delete(c)),
      contains: (c) => set.has(c),
    };
    Object.defineProperty(el, 'firstChild', { get: () => el.children[0] || null });
    el.appendChild = (c) => { if (c && c.__frag) c.children.forEach((x) => el.children.push(x)); else el.children.push(c); return c; };
    el.removeChild = (c) => { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); return c; };
    return el;
  };
  function run(mk, W, H, LOW, reduced) {
    const els = {}, created = [], timers = [], timeouts = [], fxLog = [];
    const $ = (id) => (els[id] = els[id] || mkEl(id));
    const document = {
      createElement: (t) => { const e = mkEl('dyn' + created.length, t); created.push(e); return e; },
      createDocumentFragment: () => { const f = mkEl('frag', '#fragment'); f.__frag = true; return f; },
    };
    const api = mk(
      document, W, H, LOW,
      () => ({ matches: !!reduced }),
      $,
      { playCashRain: () => fxLog.push('cash'), playBootSplat: () => fxLog.push('splat') },
      (el, v) => { if (el) el.textContent = v; },
      (n) => String(Math.max(0, Math.floor(n))).padStart(6, '0'),
      (fn, ms) => { const id = timers.length + 1; timers.push({ id, fn, ms, cleared: false }); return id; },
      (id) => { const t = timers.find((x) => x.id === id); if (t) t.cleared = true; },
      (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
    );
    const flushIntervals = (n) => { for (let k = 0; k < n; k++) for (const t of timers.slice()) if (!t.cleared) t.fn(); };
    const flushTimeouts = () => timeouts.splice(0, timeouts.length).forEach((t) => t.fn());
    return { api, $, els, timers, fxLog, created, flushIntervals, flushTimeouts };
  }
  const fxSrc = [
    (src.match(/const FX_LAW = \{[\s\S]*?\};/) || [''])[0],
    extractFn('fxIsSmallScreen'), extractFn('fxRainCount'), extractFn('fxReducedMotion'),
    extractFn('fxSetVar'), extractFn('fxBuildRain'), extractFn('fxClearLayer'),
    'const fxTallyTimers = [];',
    extractFn('fxStopTallies'), extractFn('fxStartTally'),
    (src.match(/const WEEK_RANKS = \[[\s\S]*?\];/) || [''])[0],
    extractFn('weekRankOf'), extractFn('fxShowEl'), extractFn('startEndingFx'), extractFn('stopEndingFx'),
  ].join('\n');
  check('every fx function is extractable (module intact)', fxSrc.indexOf('function startEndingFx(') > 0 && fxSrc.indexOf('function stopEndingFx(') > 0 && /const FX_LAW = \{/.test(fxSrc) && /const WEEK_RANKS = \[/.test(fxSrc), 'fx source not found in index.html');
  const mk = new Function('document', 'innerWidth', 'innerHeight', 'MOBILE_LOW_PROFILE', 'matchMedia', '$', 'SFX', 'setTxt', 'pad', 'setInterval', 'clearInterval', 'setTimeout', fxSrc + '\nreturn { fxIsSmallScreen, fxRainCount, fxBuildRain, fxClearLayer, fxStartTally, fxStopTallies, fxTallyTimers, weekRankOf, startEndingFx, stopEndingFx };');
  const phone = run(mk, 390, 844, false, false);
  const desk = run(mk, 1440, 900, false, false);
  check('a 390px phone pays the phone budget (11 bills + 4 drips)', phone.api.fxRainCount('win', true) === 11 && phone.api.fxRainCount('lose', true) === 4, 'phone counts wrong');
  check('a desktop gets the full field (20 bills + 8 drips)', desk.api.fxRainCount('win', false) === 20 && desk.api.fxRainCount('lose', false) === 8, 'desktop counts wrong');
  check('a landscape phone (812x375) pays the phone budget too', run(mk, 812, 375, false, false).api.fxIsSmallScreen(812, 375) === true, 'short-viewport case missed');
  check('the low-spec profile marks a big window as small as well', run(mk, 1440, 900, true, false).api.fxIsSmallScreen(1440, 900) === true, 'MOBILE_LOW_PROFILE not honored');
  const winFx = phone.api.startEndingFx('win');
  const wonLayer = phone.els['fx-won'];
  check('the WIN screen arms 11 falling bills on a phone (one build, no loop)', winFx === 11 && wonLayer.children.length === 11, 'bills: ' + winFx + '/' + wonLayer.children.length);
  check('every bill rides the CSS .fx-bill with its own timing vars', wonLayer.children.every((c) => c.className === 'fx-bill' && c.styleVars['--dur'] && c.styleVars['--dl'] && c.styleVars['--dx'] && c.styleVars['--rz'] && parseFloat(c.style.left) <= 98), 'bill setup incomplete');
  check('the loops are staggered IN (negative --dl) so the rain is on-screen at once', wonLayer.children.every((c) => parseFloat(c.styleVars['--dl']) <= 0), 'no negative start offsets');
  phone.api.startEndingFx('over');
  const drips = phone.els['fx-lost'].children;
  check('the LOSE screen arms 4 brown drips (the phone budget) on a re-arm', drips.length === 4 && drips.every((c) => c.className === 'fx-drip'), 'drips: ' + drips.length);
  check('re-arming does NOT stack rain (the layer is cleared first)', phone.api.startEndingFx('over') === 4 && phone.els['fx-lost'].children.length === 4, 'pieces stacked on re-arm');
  check('the GAME OVER panel gets the fx-shake jolt class', phone.els['over'].classList.contains('fx-shake'), 'no shake class');
  check('the WIN screen never shakes the panel (it celebrates)', (phone.api.startEndingFx('win'), !phone.els['over'].classList.contains('fx-shake')), 'shake leaked onto the win');
  phone.flushTimeouts();
  check('the jingle rides the beat: cash rain -> CH-CHING, lose -> BOOT SPLAT', phone.fxLog.indexOf('cash') >= 0 && (phone.api.startEndingFx('over'), phone.flushTimeouts(), phone.fxLog.indexOf('splat') >= 0), 'jingles not queued');
  check('the same call on a desktop fills the screen with 20 bills', desk.api.startEndingFx('win') === 20 && desk.els['fx-won'].children.length === 20, 'desktop field wrong');
  check('reduced-motion asks for ZERO animated pieces (the scene stays posed)', run(mk, 1440, 900, false, true).api.startEndingFx('win') === 0, 'reduced motion still spawns rain');
  const scoreEl = desk.$('finalscore');
  desk.api.fxStartTally(scoreEl, 1234);
  const startText = scoreEl.textContent;
  desk.flushIntervals(60);
  check('the arcade tally spins from zero onto the real number', startText === '000000' && scoreEl.textContent === '001234', 'tally: ' + startText + ' -> ' + scoreEl.textContent);
  check('the finished tally timer clears itself (no runaway interval)', desk.timers.every((t) => t.cleared), 'a tally timer is still armed');
  desk.api.fxStartTally(desk.$('week-hi'), 500);
  desk.$('over').classList.add('fx-shake');
  desk.api.stopEndingFx();
  check('stopEndingFx() tears the rain down + disarms every tally', desk.els['fx-won'].children.length === 0 && desk.els['fx-lost'].children.length === 0 && desk.timers.every((t) => t.cleared) && !desk.els['over'].classList.contains('fx-shake'), 'teardown incomplete');
  check('the rank ladder crowns every score band', [0, 45000, 85000, 150000, 250000, 400000].map((v) => desk.api.weekRankOf(v)).join('|') === 'ROOKIE ON THE BLOCK|STEADY SWEEPER|CURB CRUSHER|LITTER LEGEND|BOROUGH BOSS|STREET LEGEND', 'rank bands wrong');
  check('a negative / NaN week score still crowns (no crash, lowest rank)', desk.api.weekRankOf(-5) === 'ROOKIE ON THE BLOCK' && desk.api.weekRankOf(NaN) === 'ROOKIE ON THE BLOCK', 'rank guard missing');
  check('the fx builder never touches layout styles (CSS owns all the motion)', desk.created.every((e) => e.style.top === '' && e.style.width === '' && e.style.height === ''), 'builder wrote layout styles');
}

console.log('');
console.log(pass ? 'ALL ENDING-SCREEN CHECKS PASSED' : 'SOME ENDING-SCREEN CHECKS FAILED');
process.exit(pass ? 0 : 1);


