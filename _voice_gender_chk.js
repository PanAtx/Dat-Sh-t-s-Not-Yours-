// _voice_gender_chk.js — the gendered AUDIO-voice engine (male/female voice pools) was
// replaced by the COMIC-BUBBLE engine. This suite now verifies the replacement contract:
//   - Voice.say keeps its full 8-arg signature (text, gap, pitch, bx, by, gender,
//     speaker, style), so every existing male/female/neutral call site still works;
//   - lines bubble at the speaker's world coords, throttled per text;
//   - the SPEAKER identity (not an audio gender) styles the bubble
//     (worker/dog/ped/hooker/skater/... with a safe default);
//   - "burst" style — and the worker's "OW!" lines — get the jagged POW! burst class.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ---- brace-counted function extractor (indentation-proof) ----
function extractFn(name){
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

// ---- part 1: the Voice dispatcher (extracted verbatim) ----
const s = html.indexOf('const Voice = {');
if (s < 0) throw new Error('voice section not found');
const voiceCode = html.slice(s, html.indexOf('PRIMITIVE HELPERS', s) + 'PRIMITIVE HELPERS'.length);

let pass = true;
const check = (n, c, e) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  [' + e + ']')); if (!c) pass = false; };

const bubbles = [];
const Voice = new Function('performance', 'spawnBubble',
  voiceCode + '\n;return Voice;')(performance, (text, bx, by, speaker, style) => bubbles.push([text, bx, by, speaker, style]));

// full 8-arg call for a MALE, a FEMALE, and a NEUTRAL (genderless) speaker all work
let sigOk = true;
try {
  Voice.say('male line', 1, 0.9, 1, 1, 'male', 'ped', null);
  Voice.say('female line', 1, 1.2, 2, 2, 'female', 'hooker', null);
  Voice.say('animal line', 1, 1, 3, 3, null, 'rat', null);
} catch (e) { sigOk = false; }
check('full 8-arg signature accepted for male / female / neutral (genderless) speakers', sigOk);
check('every line with coords bubbled at its speaker coords',
  bubbles.length === 3 && bubbles[0][1] === 1 && bubbles[1][2] === 2 && bubbles[2][3] === 'rat', JSON.stringify(bubbles));

// per-text throttling: the same line twice -> one bubble; a new line -> a new bubble
const before = bubbles.length;
Voice.say('repeat me', 1, 1, 9, 9, 'male', 'ped', null);
Voice.say('repeat me', 1, 1, 9, 9, 'male', 'ped', null);
Voice.say('repeat me not', 1, 1, 9, 9, 'female', 'lady', null);
check('per-text throttle: same line twice -> 1 bubble, new line -> bubble',
  bubbles.length === before + 2, 'bubbles=' + bubbles.length);

// the audio speech-synthesis engine is gone (no SpeechSynthesis / getVoices / pitch pools)
check('audio gender pools removed: no speechSynthesis / getVoices left in Voice',
  voiceCode.indexOf('speechSynthesis') < 0 && voiceCode.indexOf('getVoices') < 0);

// ---- part 2: the bubble styler (spawnBubble, extracted verbatim, fake DOM) ----
const els = [];
global.document = {
  createElement: () => { const el = { className: '', textContent: '', style: {} }; els.push(el); return el; },
  body: { appendChild: (el) => {} },
};
global.innerWidth = 800; global.innerHeight = 600;
const speechBubbles = [];
const GZ = 0.3;
const worldToScreen = (x, y, z) => ({ x: 400, y: 200 });
const findFreeBubbleLine = () => 0;
const spawnBubble = new Function('document', 'worldToScreen', 'findFreeBubbleLine', 'speechBubbles', 'GZ', 'innerWidth', 'innerHeight',
  extractFn('spawnBubble') + '\n;return spawnBubble;')(
  document, worldToScreen, findFreeBubbleLine, speechBubbles, GZ, 800, 600);

const clsOf = (text, speaker, style) => { speechBubbles.length = 0; spawnBubble(text, 0, 0, speaker, style); return speechBubbles[0].el.className; };

check('speaker identity styles the bubble: worker -> bub-worker', clsOf('hi', 'worker', null) === 'bubble bub-worker');
check('speaker identity styles the bubble: dog -> bub-dog', clsOf('WOOF!', 'dog', null) === 'bubble bub-dog');
check('speaker identity styles the bubble: ped -> bub-ped', clsOf('hi', 'ped', null) === 'bubble bub-ped');
check('speaker identity styles the bubble: lady -> bub-ped', clsOf('hi', 'lady', null) === 'bubble bub-ped');
check('speaker identity styles the bubble: hooker/skater/escooter/yeller/dealer map to their classes',
  clsOf('x', 'hooker', null) === 'bubble bub-hooker' && clsOf('x', 'skater', null) === 'bubble bub-skater' &&
  clsOf('x', 'escooter', null) === 'bubble bub-escooter' && clsOf('x', 'yeller', null) === 'bubble bub-yeller' &&
  clsOf('x', 'dealer', null) === 'bubble bub-dealer');
check('unknown speaker falls back to the default bubble (never unstyled)', clsOf('x', null, null) === 'bubble bub-default');
check('style "burst" adds the jagged POW! class', clsOf('x', 'ped', 'burst') === 'bubble bub-ped bub-burst');
check('worker "OW!" lines auto-burst even without an explicit style',
  clsOf('OW!', 'worker', null) === 'bubble bub-worker bub-burst' &&
  clsOf('ow!', 'worker', null) === 'bubble bub-worker bub-burst');
check('non-OW worker lines do NOT auto-burst', clsOf('Mind the curb!', 'worker', null) === 'bubble bub-worker');
check('bubbles register their speaker for the write-up (life 1.9s, locked screen pos)',
  speechBubbles.length === 1 && speechBubbles[0].life === 1.9 && speechBubbles[0].speaker !== undefined &&
  typeof speechBubbles[0].lockedX === 'number');

console.log(pass ? '\nVOICE/BUBBLE CONTRACT PASSED' : '\nVOICE/BUBBLE CONTRACT FAILED');
process.exit(pass ? 0 : 1);
