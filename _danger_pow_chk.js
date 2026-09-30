// _danger_pow_chk.js — verify the full-screen FIRE ALARM for "San Man needs food
// badly!" extracted verbatim from index.html: the first hit that drops the worker
// to the danger threshold (<= DANGER_HP, still standing) slams in a giant
// center-screen banner in large letters, a hard red screen flash, DING DING DING,
// then a continuous fire alarm (stream of dings + pulsing red glow) that runs
// until health recovers above the threshold (heal), he goes down, or a fresh
// shift / week re-arms the warning.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ---- robust function extractor (brace-counted, works for one- and multi-line fns) ----
function extractFn(name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  let brace = src.indexOf('{', idx), depth = 0, i = brace;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}
let ok = true;
const check = function(label, cond, detail){
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label);
  if (!cond){ ok = false; if (detail !== undefined) console.log('        ' + detail); }
};

console.log('');
console.log('[1] static wiring: the old arcade-voice stack is GONE, the fire alarm is wired');
{
  check('DANGER_HP is 10% of max health (the red-zone threshold)', src.indexOf('const DANGER_HP = Math.ceil(maxHealth * 0.10);') >= 0);
  check('the once-per-dangerous-stretch flag (dangerWarned) is declared', src.indexOf('let dangerWarned = false;') >= 0);
  ['arcadeSay', 'voiceBus', 'bub-danger', 'dangerBurst'].forEach(function(g){
    check('old stack removed: no ' + g + ' left in the file', src.indexOf(g) < 0);
  });
  check('old stack removed: no formant voice engine left in the file', src.toLowerCase().indexOf('formant') < 0 && src.toLowerCase().indexOf('phoneme') < 0);
  const hn = extractFn('hurtNPC');
  check('hurtNPC: the warning gate (health > 0 && health <= DANGER_HP && !dangerWarned)', hn.indexOf('if (health > 0 && health <= DANGER_HP && !dangerWarned)') >= 0);
  check('hurtNPC: fires the FULL alarm — dingDingDing + dangerBanner + dangerFlash + dangerAlarmOn',
    hn.indexOf('SFX.dingDingDing();') >= 0 && hn.indexOf('dangerBanner();') >= 0 && hn.indexOf('dangerFlash();') >= 0 && hn.indexOf('dangerAlarmOn();') >= 0);
  check('hurtNPC: going down (health <= 0) clears the alarm, THEN plays the down sequence',
    hn.indexOf('if (health <= 0)') >= 0 && hn.indexOf('dangerAlarmOff();') >= 0 && hn.indexOf('startDyingSequence();') >= 0 && hn.indexOf('dangerAlarmOff();') < hn.indexOf('startDyingSequence();'));
  const hl = extractFn('heal');
  check('heal: crossing back above DANGER_HP re-arms the warning AND clears the fire alarm',
    hl.indexOf('if (health > DANGER_HP)') >= 0 && hl.indexOf('dangerWarned = false;') >= 0 && hl.indexOf('dangerAlarmOff();') >= 0);
  check('resetWorldState (fresh shift) clears a stale fire alarm', extractFn('resetWorldState').indexOf('dangerAlarmOff();') >= 0);
  check('startGame (fresh week) clears a stale fire alarm', extractFn('startGame').indexOf('dangerAlarmOff();') >= 0);
  check('the danger functions are defined (banner / flash / alarm on / alarm off)',
    ['dangerBanner', 'dangerFlash', 'dangerAlarmOn', 'dangerAlarmOff'].every(function(n){ return src.indexOf('function ' + n + '(') >= 0; }));
  check('the DOM has both overlays (#dangerBanner with the line, #dangerFlash)',
    src.indexOf('<div id="dangerBanner">SAN MAN NEEDS FOOD BADLY!</div>') >= 0 && src.indexOf('<div id="dangerFlash"></div>') >= 0);
  check('the banner is dead-center, ONE line, LARGE letters (fixed + 50%/50% + nowrap + clamp font)',
    /#dangerBanner \{[\s\S]{0,700}?position: fixed[\s\S]{0,700}?left: 50%[\s\S]{0,700}?top: 50%[\s\S]{0,700}?white-space: nowrap[\s\S]{0,700}?font-size: clamp\(/.test(src));
  check('the banner slams in, throbs, then bursts away (2.6s .on animation + keyframes)',
    src.indexOf('#dangerBanner.on') >= 0 && src.indexOf('@keyframes dangerBanner') >= 0 && src.indexOf('dangerBanner 2.6s') >= 0);
  check('the red flash is a hard triple pulse (#dangerFlash.on + dangerFlashPulse keyframes)',
    src.indexOf('#dangerFlash.on') >= 0 && src.indexOf('@keyframes dangerFlashPulse') >= 0);
  check('the fire-alarm glow pulses on the SAME period as the ding stream (0.45s infinite, setInterval 450)',
    src.indexOf('#dangerFlash.alarm') >= 0 && /dangerAlarmGlow 0\.45s[^\n]*infinite/.test(src) && src.indexOf('@keyframes dangerAlarmGlow') >= 0 && src.indexOf('setInterval(tick, 450)') >= 0);
  check('SFX: a metallic DING (C6 2093 fundamental + 3136 bright partial + 4186 strike transient)',
    src.indexOf('ding(when, vol)') >= 0 && src.indexOf('2093, 2093') >= 0 && src.indexOf('3136, 3136') >= 0 && src.indexOf('4186, 4186') >= 0);
  check('SFX: DING DING DING — three fast dings, the 3rd hits harder (1.05 > 0.85)',
    src.indexOf('dingDingDing()') >= 0 && src.indexOf('this.ding(0, 0.85)') >= 0 && src.indexOf('this.ding(0.18, 0.85)') >= 0 && src.indexOf('this.ding(0.36, 1.05)') >= 0);
  check('SFX: the fire alarm is a continuous 450ms stream, one at a time (re-fire no-op), stop is clean',
    src.indexOf('fireAlarmStart()') >= 0 && src.indexOf('if (this._alarmTimer) return;') >= 0 && src.indexOf('clearInterval(this._alarmTimer)') >= 0);
  check('SFX.ensure(): a suspended AudioContext is resumed (the alarm cannot die on autoplay policy)',
    /if \(this\.ctx\.state === "suspended"\)\s*this\.ctx\.resume\(\);/.test(src));
}

console.log('');
console.log('[2] behavioral: the REAL hurtNPC / heal / danger functions in a harness');
{
  const DANGER_HP = 10; // 10% of the 100 hp pool (the real game: Math.ceil(maxHealth * 0.10))
  let health = 100, maxHealth = 100;
  let dangerWarned = false;
  let state = 'play';
  let lastHitCause = 'route';
  const p = { wx: 88, wy: 2.5, invuln: 0, immuneT: 0 };
  const domEls = {};
  function $(id){
    if (!domEls[id])
      domEls[id] = {
        id: id,
        style: {},
        classList: {
          _set: new Set(),
          add(c) { this._set.add(c); },
          remove(c) { this._set.delete(c); },
          contains(c) { return this._set.has(c); }
        }
      };
    return domEls[id];
  }
  const sfx = [];
  const SFX = {
    playHurtSound(){ sfx.push('hurt'); },
    dingDingDing(){ sfx.push('ding3'); },
    fireAlarmStart(){ sfx.push('alarmOn'); },
    fireAlarmStop(){ sfx.push('alarmOff'); }
  };
  const Voice = { say(){} };
  const WORKER_GENDER = 'male';
  const PUNCHBACK_CAUSES = []; // harness: only "route" hits, so no punchback arms
  function markPunchback(){}
  const died = [];
  function startDyingSequence(){ died.push(1); }
  // pull the REAL functions out (eval at module scope so they stay)
  eval(extractFn('heal'));
  eval(extractFn('hurtNPC'));
  eval(extractFn('dangerFlash'));
  eval(extractFn('dangerBanner'));
  eval(extractFn('dangerAlarmOn'));
  eval(extractFn('dangerAlarmOff'));
  function resetWorld(){
    health = 100; dangerWarned = false; p.invuln = 0; p.immuneT = 0;
    sfx.length = 0; died.length = 0;
    for (const k in domEls) delete domEls[k];
  }
  const has = (id, cls) => !!(domEls[id] && domEls[id].classList.contains(cls));
  const count = (tag) => sfx.filter((s) => s === tag).length;

  resetWorld();
  health = 100;
  hurtNPC(8, 'route');
  check('a hit at 92 (above the red zone): NO alarm — no dings, no banner, no flash, no fire alarm',
    count('ding3') === 0 && count('alarmOn') === 0 && !has('dangerBanner', 'on') && !has('dangerFlash', 'on') && !has('dangerFlash', 'alarm'), JSON.stringify(sfx));

  resetWorld();
  health = 15;
  hurtNPC(10, 'route'); // 15 -> 5: first drop into the red
  check('the first hit that drops him to 5 (<= ' + DANGER_HP + '): DING DING DING + banner + red flash + fire alarm ALL fire',
    count('ding3') === 1 && has('dangerBanner', 'on') && has('dangerFlash', 'on') && has('dangerFlash', 'alarm') && count('alarmOn') === 1, JSON.stringify(sfx));

  resetWorld();
  health = 15;
  hurtNPC(10, 'route'); // 15 -> 5
  hurtNPC(2, 'route');   // 5 -> 3: still in the red
  check('a SECOND hit while still in the red (5 -> 3): NO repeat alarm (once per dangerous stretch)',
    count('ding3') === 1 && count('alarmOn') === 1, JSON.stringify(sfx));

  resetWorld();
  health = 15;
  hurtNPC(10, 'route'); // 15 -> 5: alarm on
  heal(50);             // 5 -> 55: back above the threshold
  check('the healer power-up (5 -> 55) clears the fire alarm AND re-arms the warning',
    count('alarmOff') === 1 && !has('dangerFlash', 'alarm') && dangerWarned === false, JSON.stringify(sfx));
  hurtNPC(50, 'route'); // 55 -> 5: back in the red
  check('the NEXT drop back into the red (55 -> 5): the FULL alarm fires again',
    count('ding3') === 2 && count('alarmOn') === 2 && has('dangerBanner', 'on') && has('dangerFlash', 'alarm'), JSON.stringify(sfx));

  resetWorld();
  health = 15;
  hurtNPC(10, 'route'); // 15 -> 5: alarm on
  heal(5);              // 5 -> 10: still in the red (not > DANGER_HP)
  check('a heal that stays in the red (5 -> 10, not > ' + DANGER_HP + '): the fire alarm KEEPS running',
    count('alarmOff') === 0 && has('dangerFlash', 'alarm'), JSON.stringify(sfx));

  resetWorld();
  health = 25;
  hurtNPC(25, 'route'); // 25 -> 0: down
  check('a hit straight to 0: NO warning — the alarm clears and the down sequence plays',
    count('ding3') === 0 && count('alarmOff') === 1 && died.length === 1, JSON.stringify(sfx) + ' died=' + died.length);

  resetWorld();
  health = 15;
  hurtNPC(10, 'route'); // 15 -> 5: alarm on
  dangerWarned = false; // simulate a fresh shift / fresh week re-arm
  hurtNPC(2, 'route');  // 5 -> 3
  check('a re-armed flag (fresh shift / week): the next red drop warns AGAIN',
    count('ding3') === 2 && count('alarmOn') === 2, JSON.stringify(sfx));
}

console.log('');
console.log('[3] SFX: the REAL alarm engine on a mock AudioContext (timing + one-at-a-time + stop)');
{
  // ---- mock AudioContext (records osc starts / freqs / gain ramps / resumes) ----
  function makeAC(initialState){
    const rec = { oscStarts: [], freqs: [], gainRamps: [], resumes: 0 };
    const ctx = {
      currentTime: 0,
      state: initialState || 'running',
      sampleRate: 44100,
      destination: {},
      resume(){ rec.resumes++; this.state = 'running'; return Promise.resolve(); },
      createGain(){
        const g = { value: 0, setValueAtTime(){}, linearRampToValueAtTime(){} };
        g.exponentialRampToValueAtTime = function(v){ rec.gainRamps.push(v); };
        return { gain: g, connect(){} };
      },
      createBiquadFilter(){ return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect(){} }; },
      createOscillator(){
        const f = { value: 0, setValueAtTime(v){ rec.freqs.push(v); }, exponentialRampToValueAtTime(){} };
        return { type: '', frequency: f, connect(){}, start(t){ rec.oscStarts.push(t); }, stop(){} };
      },
      createBuffer(ch, n){ return { getChannelData(){ return new Float32Array(n); } }; },
      createBufferSource(){ return { buffer: null, connect(){}, start(){}, stop(){} }; }
    };
    ctx._rec = rec;
    return ctx;
  }
  // ---- controllable timers: fire the interval ticks by hand ----
  const timers = { list: [], id: 0 };
  const fakeSetInterval = function(fn, ms){ const id = ++timers.id; timers.list.push({ id: id, fn: fn, ms: ms }); return id; };
  const fakeClearInterval = function(id){ for (let i = timers.list.length - 1; i >= 0; i--) if (timers.list[i].id === id) timers.list.splice(i, 1); };

  // ---- build the REAL SFX object in a sandbox with the mock AudioContext ----
  const sfxIdx = src.indexOf('const SFX = {');
  if (sfxIdx < 0) throw new Error('const SFX = { not found in index.html');
  let brace = src.indexOf('{', sfxIdx), depth = 0, i = brace;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  const sfxLit = src.slice(sfxIdx + 'const '.length, i + 1); // "SFX = {...}"
  function buildSFX(ctx){
    const win = { AudioContext: function(){ return ctx; } };
    return new Function('window', 'setInterval', 'clearInterval', 'var SFX = ' + sfxLit + '; return SFX;')(win, fakeSetInterval, fakeClearInterval);
  }

  // ---- DING DING DING: three fast dings, 3rd harder ----
  const ac1 = makeAC('running');
  const s1 = buildSFX(ac1);
  s1.dingDingDing();
  const r1 = ac1._rec;
  check('DING DING DING: 3 dings x 3 oscillators = 9 osc starts', r1.oscStarts.length === 9, JSON.stringify(r1.oscStarts));
  check('DING DING DING: strikes at t = 0, 0.18, 0.36 (three fast hits)',
    r1.oscStarts[0] === 0 && r1.oscStarts[3] === 0.18 && r1.oscStarts[6] === 0.36, JSON.stringify(r1.oscStarts));
  check('DING DING DING: the C6 2093 bell fundamental is struck', r1.freqs.indexOf(2093) >= 0, JSON.stringify(r1.freqs));
  check('DING DING DING: the 3rd ding hits harder (gain ramp 1.05 vs 0.85)',
    r1.gainRamps.indexOf(1.05) >= 0 && r1.gainRamps.indexOf(0.85) >= 0, JSON.stringify(r1.gainRamps));

  // ---- FIRE ALARM: one ding immediately, then a 450ms interval stream ----
  const ac2 = makeAC('running');
  const s2 = buildSFX(ac2);
  const base = ac2._rec.oscStarts.length;
  s2.fireAlarmStart();
  check('fireAlarmStart: an immediate strike (3 oscillators) fires at once', ac2._rec.oscStarts.length === base + 3, JSON.stringify(ac2._rec.oscStarts));
  check('fireAlarmStart: ONE 450ms interval is armed (the continuous stream)', timers.list.length === 1 && timers.list[0].ms === 450, JSON.stringify(timers.list.map(function(t){ return t.ms; })));
  // fire three interval ticks by hand
  const t0 = timers.list[0];
  t0.fn(); t0.fn(); t0.fn();
  check('each interval tick is exactly ONE ding (3 oscillators) — the stream never stacks', ac2._rec.oscStarts.length === base + 12, String(ac2._rec.oscStarts.length));
  s2.fireAlarmStart();
  check('a second fireAlarmStart is a NO-OP (one alarm at a time, no double stream)', timers.list.length === 1, String(timers.list.length));
  s2.fireAlarmStop();
  check('fireAlarmStop: the interval is CLEARED (the alarm is silent)', timers.list.length === 0, String(timers.list.length));
  check('fireAlarmStop: idempotent (stopping twice is safe)', (function(){ s2.fireAlarmStop(); return true; })());

  // ---- autoplay policy: a suspended context is resumed ----
  const ac3 = makeAC('suspended');
  const s3 = buildSFX(ac3);
  s3.ensure();
  check('a suspended AudioContext is resumed (the alarm cannot die on autoplay policy)', ac3._rec.resumes === 1 && ac3.state === 'running', 'resumes=' + ac3._rec.resumes);
}

console.log('');
console.log(ok ? '== _danger_pow_chk: ALL CHECKS PASSED ==' : '== _danger_pow_chk: FAILURES PRESENT ==');
process.exit(ok ? 0 : 1);
