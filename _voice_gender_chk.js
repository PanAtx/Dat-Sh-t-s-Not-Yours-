// _voice_gender_chk.js — verify the gendered-voice engine in index.html:
//   - en-US voices are split into male/female pools by name heuristics
//   - a male speaker gets the male voice, a female speaker the female voice
//   - a device with only ONE nameless voice still routes correctly (fallback + pitch nudge)
//   - genderless (animal) lines keep their caller pitch untouched
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const s = html.indexOf('const Voice = {');
if (s < 0) throw new Error('voice section not found');
const code = html.slice(s, html.indexOf('PRIMITIVE HELPERS', s) + 'PRIMITIVE HELPERS'.length);

let voices = [];
function SpeechSynthesisUtterance(t){ this.text = t; this.volume = 1; this.pitch = 1; this.rate = 1; this.voice = null; this.onend = null; this.onerror = null; }
global.window = global;
global.SpeechSynthesisUtterance = SpeechSynthesisUtterance;
global.speechSynthesis = { getVoices: () => voices, speak(u){ u.onend && u.onend(); }, cancel: () => {} };
global.SFX = { radioEl: null, radioMuted: false };
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const Voice = new Function('SFX', 'SpeechSynthesisUtterance', 'performance', 'spawnBubble',
  code + '\n;return Voice;')(global.SFX, SpeechSynthesisUtterance, performance, () => {});
Voice._loadPrefs();

let pass = true;
const check = (n, c, e) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  [' + e + ']')); if (!c) pass = false; };

// --- classify a few real-world voice names ---
check('David (en-US) -> male', Voice._classify({ name: 'Microsoft David', lang: 'en-US' }) === 'male');
check('Zira (en-US) -> female', Voice._classify({ name: 'Microsoft Zira', lang: 'en-US' }) === 'female');
check('Samantha (en-US) -> female', Voice._classify({ name: 'Samantha', lang: 'en-US' }) === 'female');
check('nameless voice -> neutral', Voice._classify({ lang: 'en-US' }) === 'neutral');
check('non-English name not misgendered', Voice._classify({ name: 'Google Français', lang: 'fr-FR' }) === 'neutral');

function speakWith(list, text, gender, pitch){
  voices = list;
  Voice.busy = false; Voice.queue.length = 0; Voice.last = {};   // reset so each line pumps synchronously & isn't throttled
  let captured = null;
  const realSpeak = global.speechSynthesis.speak.bind(global.speechSynthesis);
  global.speechSynthesis.speak = (u) => { captured = u; };
  Voice.say(text, 1, pitch, 0, 0, gender);
  global.speechSynthesis.speak = realSpeak;
  return captured;
}

// --- device WITH distinct male + female American voices ---
const rich = [
  { name: 'Microsoft Zira', lang: 'en-US' },
  { name: 'Microsoft David', lang: 'en-US' },
  { name: 'Google español', lang: 'es-ES' }
];
voices = rich;
Voice._refresh();
check('pool: found an American male voice', Voice._male.length === 1 && Voice._male[0].name === 'Microsoft David', JSON.stringify(Voice._male.map(v=>v.name)));
check('pool: found an American female voice', Voice._female.length === 1 && Voice._female[0].name === 'Microsoft Zira', JSON.stringify(Voice._female.map(v=>v.name)));
check('pool: non-English voice excluded', Voice._any[0].name === 'Microsoft Zira', JSON.stringify(Voice._any.map(v=>v.name)));

let m = speakWith(rich, 'Dawg shit!', 'male', 0.9);
check('male speaker -> male voice (David)', m && m.voice && m.voice.name === 'Microsoft David', m && m.voice && m.voice.name);
check('male speaker keeps caller pitch when a match exists', m && Math.abs(m.pitch - 0.9) < 1e-9, String(m && m.pitch));

let f = speakWith(rich, 'Ow! Dat hurt!', 'female', 1.1);
check('female speaker -> female voice (Zira)', f && f.voice && f.voice.name === 'Microsoft Zira', f && f.voice && f.voice.name);
check('female speaker keeps caller pitch when a match exists', f && Math.abs(f.pitch - 1.1) < 1e-9, String(f && f.pitch));

// --- device with only ONE voice of the WRONG gender -> fallback + pitch nudge ---
const onlyFemale = [{ name: 'Samantha', lang: 'en-US' }];
let mFb = speakWith(onlyFemale, 'Dawg shit!', 'male', 0.9);
check('single-voice device: male falls back to the only voice', mFb && mFb.voice && mFb.voice.name === 'Samantha', mFb && mFb.voice && mFb.voice.name);
check('single-voice device: male pitch DROPS DEEP (0.9 -> ~0.63)', mFb && mFb.pitch < 0.68, String(mFb && mFb.pitch));
const onlyMale = [{ name: 'Microsoft David', lang: 'en-US' }];
let fFb = speakWith(onlyMale, 'Ow! Dat hurt!', 'female', 1.1);
check('single-voice device: female falls back to the only voice', fFb && fFb.voice && fFb.voice.name === 'Microsoft David', fFb && fFb.voice && fFb.voice.name);
check('single-voice device: female pitch RISES (1.1 -> ~1.34)', fFb && fFb.pitch > 1.25, String(fFb && fFb.pitch));

// --- genderless (animal) line: caller pitch untouched, no nudge ---
let a = speakWith(onlyFemale, 'Eeek!', null, 1.5);
check('genderless line keeps caller pitch (1.5)', a && Math.abs(a.pitch - 1.5) < 1e-9, String(a && a.pitch));

// --- manual voice picks (the HUD VOICE panel API) ---
Voice.setMale('Microsoft Zira');   // force a female-classified voice onto male lines
let mSel = speakWith(rich, 'This gawbage bag\u2019s heavy!', 'male', 0.9);
check('manual pick: male line uses the chosen voice (Zira)', mSel && mSel.voice && mSel.voice.name === 'Microsoft Zira', mSel && mSel.voice && mSel.voice.name);
check('manual pick of a mismatched voice still sounds DEEP (< 0.68)', mSel && mSel.pitch < 0.68, String(mSel && mSel.pitch));
Voice.setMale('Microsoft David');
let mSel2 = speakWith(rich, 'Back on the job!', 'male', 0.9);
check('manual pick of a real male voice -> caller pitch kept (0.9)', mSel2 && mSel2.voice.name === 'Microsoft David' && Math.abs(mSel2.pitch - 0.9) < 1e-9, mSel2 && mSel2.voice.name + ' @ ' + mSel2.pitch);
Voice.setFemale('Microsoft David');   // force the male voice onto female lines
let fSel = speakWith(rich, 'Ow! Dat hurt!', 'female', 1.1);
check('manual pick: female line uses chosen voice (David) at HIGHER pitch', fSel && fSel.voice.name === 'Microsoft David' && fSel.pitch > 1.25, fSel && fSel.voice.name + ' @ ' + fSel.pitch);
check('picks persisted to localStorage', (function(){ try { const j = JSON.parse(localStorage.getItem('dsnboy.voice')); return j.male === 'Microsoft David' && j.female === 'Microsoft David'; } catch (e) { return false; } })(), String(localStorage.getItem('dsnboy.voice')));
// a pick for a voice that vanished off the machine falls back to auto
Voice.setMale('Microsoft Paul');
let mGone = speakWith(rich, 'Voice gone test', 'male', 0.9);
check('vanished pick falls back to the pooled male voice', mGone && mGone.voice && mGone.voice.name === 'Microsoft David', mGone && mGone.voice && mGone.voice.name);
// back to AUTO
Voice.setMale('auto'); Voice.setFemale('auto');
let mAuto = speakWith(rich, 'Auto again test', 'male', 0.9);
check('auto restored -> pooled male voice at caller pitch', mAuto && mAuto.voice.name === 'Microsoft David' && Math.abs(mAuto.pitch - 0.9) < 1e-9, mAuto && mAuto.voice.name + ' @ ' + mAuto.pitch);

console.log(pass ? '\nVOICE GENDER CHECKS PASSED' : '\nVOICE GENDER CHECKS FAILED');
process.exit(pass ? 0 : 1);