// One-shot fixer: replace the 1980s arcadeSay formant-voice block in index.html
// with the new danger-alarm sound engine (ding / dingDingDing / fire alarm).
const fs = require('fs');
const raw = fs.readFileSync('index.html', 'utf8');
const crlf = raw.indexOf('\r\n') >= 0;
const lines = raw.split(/\r?\n/);
let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].indexOf('// --- 1980s ARCADE ROBOT VOICE (the "San Man" announcer) ---') >= 0) start = i;
  if (lines[i].indexOf("The car washer's hose") >= 0) {
    end = i;
    break;
  }
}
if (start < 0 || end <= start) throw new Error('markers not found: ' + start + ' / ' + end);
const NEW = `        // --- DANGER ALARM (the "San Man Needs Food Badly" fire alarm) ---
        // A single metallic DING: the bell fundamental (C6) + a bright partial
        // + a strike transient, all decaying fast — a hard DING that cuts
        // through the street ambience and the radio.
        ding(when, vol) {
          this.tone("sine", 2093, 2093, 0.42, vol, when);
          this.tone("sine", 3136, 3136, 0.3, vol * 0.4, when);
          this.tone("triangle", 4186, 4186, 0.12, vol * 0.22, when);
        },
        // DING DING DING: three fast dings — the alarm call the instant a hit
        // drops the worker into the danger zone (once per dangerous stretch).
        dingDingDing() {
          this.ensure();
          this.ding(0, 0.85);
          this.ding(0.18, 0.85);
          this.ding(0.36, 1.05); // the third one hits harder — the emphatic finish
        },
        // FIRE ALARM: a CONTINUOUS stream of dings — one every 0.45s, each
        // strike's decay tail bleeding into the next so the ring never drops
        // out. Runs for as long as the worker stays in the danger zone;
        // fireAlarmStop() ends the stream (a healer power-up, him going down,
        // or a fresh day / fresh week).
        _alarmTimer: 0,
        fireAlarmStart() {
          this.ensure();
          if (!this.ctx) return; // no Web Audio: the red glow still warns
          if (this._alarmTimer) return; // already sounding
          const tick = () => this.ding(0, 0.55);
          tick();
          this._alarmTimer = setInterval(tick, 450);
        },
        fireAlarmStop() {
          if (this._alarmTimer) {
            clearInterval(this._alarmTimer);
            this._alarmTimer = 0;
          }
        },`;
lines.splice(start, end - start, ...NEW.split('\n'));
fs.writeFileSync('index.html', lines.join(crlf ? '\r\n' : '\n'));
console.log(
  'removed old lines ' + (start + 1) + '-' + end + ' and inserted ' + NEW.split('\n').length + ' new lines',
);
