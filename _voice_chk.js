// Harness: runs the EXACT voice-synthesis code from index.html (extracted verbatim)
// to verify radio volume ducking + comic speech-bubble wiring.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const s = html.indexOf('const Voice = {');
if (s < 0) throw new Error('voice section not found');
const code = html.slice(s, html.indexOf('PRIMITIVE HELPERS', s) + 'PRIMITIVE HELPERS'.length);

const spokes = [], bubbles = [];
function SpeechSynthesisUtterance(t){ this.text = t; this.volume = 1; this.pitch = 1; this.rate = 1; this.onend = null; this.onerror = null; spokes.push(this); }
global.window = global;
global.SpeechSynthesisUtterance = SpeechSynthesisUtterance;
global.speechSynthesis = { getVoices: () => [{ lang: 'en-US' }], speak: () => {}, cancel: () => {} };
global.SFX = { radioEl: { paused: false, volume: 0.9 }, radioMuted: false };
const Voice = new Function('SFX', 'SpeechSynthesisUtterance', 'performance', 'spawnBubble',
  code + '\n;return Voice;')(global.SFX, SpeechSynthesisUtterance, performance, (t, x, y) => bubbles.push([t, x, y]));

let pass = true;
const check = (n, c, e) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  [' + e + ']')); if (!c) pass = false; };

// radio on air + unmuted -> voice ducks, bubble at the speaker's coords
Voice.say('scram birds!', 1, 1, 1, 3.5, 2);
check('line spoken', spokes.length === 1);
check('voice DUCKS under playing radio (0.42)', spokes.length === 1 && spokes[0].volume === 0.42, JSON.stringify(spokes.map(x => x.volume)));
check('bubble spawned at speaker coords', bubbles.length === 1 && bubbles[0][0] === 'scram birds!' && bubbles[0][1] === 3.5 && bubbles[0][2] === 2, JSON.stringify(bubbles));

// radio muted -> voice back to full volume
global.SFX.radioMuted = true;
Voice.say('dog shit!', 1, 1, 1, 1, 1);
setTimeout(() => {
  check('muted radio -> voice at FULL volume (0.95)', spokes.length === 2 && spokes[1].volume === 0.95, JSON.stringify(spokes.map(x => x.volume)));
  // legacy 3-arg call (no speaker coords) -> no bubble
  global.SFX.radioMuted = false;
  const before = bubbles.length;
  Voice.say('plain line', 1);
  setTimeout(() => {
    check('legacy call (no coords) -> no bubble', bubbles.length === before, JSON.stringify(bubbles));
    console.log(pass ? '\nALL VOICE CHECKS PASSED' : '\nSOME VOICE CHECKS FAILED');
    process.exit(pass ? 0 : 1);
  }, 60);
}, 60);