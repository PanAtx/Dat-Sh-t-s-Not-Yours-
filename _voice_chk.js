// Harness: runs the EXACT voice code from index.html (extracted verbatim) to verify the
// COMIC-BUBBLE engine that replaced the old speech-synthesis engine: per-line throttling,
// bubbles spawned at the speaker's world coords (with speaker + style passthrough), the
// legacy no-coords call, cancel() as a harmless no-op, and the audio engine removal.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const s = html.indexOf('const Voice = {');
if (s < 0) throw new Error('voice section not found');
const code = html.slice(s, html.indexOf('PRIMITIVE HELPERS', s) + 'PRIMITIVE HELPERS'.length);

const bubbles = [];
const Voice = new Function('performance', 'spawnBubble',
  code + '\n;return Voice;')(performance, (text, bx, by, speaker, style) => bubbles.push([text, bx, by, speaker, style]));

let pass = true;
const check = (n, c, e) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  [' + e + ']')); if (!c) pass = false; };

// 1) a line WITH speaker coords spawns a bubble at those coords
Voice.say('scram birds!', 1, 1, 3.5, 2);
check('line with coords spawns a comic bubble at the speaker coords',
  bubbles.length === 1 && bubbles[0][0] === 'scram birds!' && bubbles[0][1] === 3.5 && bubbles[0][2] === 2, JSON.stringify(bubbles));

// 2) the SAME line again within the gap is throttled (no repeat bubble)
Voice.say('scram birds!', 1, 1, 3.5, 2);
check('repeat of the same line within the gap is throttled (no second bubble)', bubbles.length === 1, 'bubbles=' + bubbles.length);

// 3) a DIFFERENT line is not throttled
Voice.say('dog shit!', 1, 1, 1, 1);
check('a different line is not throttled', bubbles.length === 2, 'bubbles=' + bubbles.length);

// 4) legacy 3-arg call (no speaker coords) -> no bubble (backwards compatible)
const before = bubbles.length;
Voice.say('plain line', 1);
check('legacy call (no coords) -> no bubble', bubbles.length === before, JSON.stringify(bubbles));

// 5) speaker + style pass through to the bubble (POW! burst for the worker)
Voice.say('OW! That hurt!', 1, 1, 5, 5, 'male', 'worker', 'burst');
check('speaker + style ("burst") pass through to spawnBubble',
  bubbles.length === before + 1 && bubbles[bubbles.length - 1][3] === 'worker' && bubbles[bubbles.length - 1][4] === 'burst',
  JSON.stringify(bubbles[bubbles.length - 1]));

// 6) gender is still accepted in the full 8-arg signature (call sites keep passing it)
let sigOk = true;
try {
  Voice.say('gender arg ok', 1, 1, 1, 1, 'female', 'hooker', null);
  Voice.say('gender arg ok too', 1, 1, 1, 1, null, 'rat', null);
} catch (e) { sigOk = false; }
check('full 8-arg signature (incl. gender) accepted for male/female/neutral lines', sigOk);

// 7) cancel() is a harmless no-op (kept for old call sites)
let cancelledOk = true;
try { Voice.cancel(); } catch (e) { cancelledOk = false; }
check('Voice.cancel() is a no-op', cancelledOk);

// 8) the audio speech-synthesis engine is GONE from Voice
check('audio engine removed: Voice no longer references speechSynthesis', code.indexOf('speechSynthesis') < 0);

console.log(pass ? '\nALL VOICE CHECKS PASSED' : '\nSOME VOICE CHECKS FAILED');
process.exit(pass ? 0 : 1);