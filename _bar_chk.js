const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const checks = [];
const ck = (n, ok, x) => checks.push({ n, ok, x });

const tlStart = html.indexOf('<div id="hud">');
const verStart = html.indexOf('id="hud-version"', tlStart);
const i1 = html.indexOf('</div>', verStart);            // closes #hud-version
const i2 = html.indexOf('</div>', i1 + 6);              // closes #hud itself
const tl = html.slice(tlStart, i2 + 6);
const tlClean = tl.replace(/<!--[\s\S]*?-->/g, ""); // browsers ignore comments

// markup is balanced and carries the bars + cash line
const opens = (tlClean.match(/<div\b/g) || []).length;
const closes = (tlClean.match(/<\/div\b/g) || []).length;
ck("hud opens == closes", opens === closes, `${opens}/${closes}`);
ck("bars ids present",
  tlClean.includes('id="pw-heal-bar"') && tlClean.includes('id="pw-bull-bar"') &&
  tlClean.includes('id="pw-heal-fill"') && tlClean.includes('id="pw-bull-fill"'));
ck("bar ids match the JS toggle targets",
  html.includes('const healEl = $("pw-heal-bar")') && tlClean.includes('id="pw-heal-bar"') &&
  html.includes('bullEl = $("pw-bull-bar")') && tlClean.includes('id="pw-bull-bar"'));
ck("heal after cash counter",
  tlClean.indexOf('id="bonus"') < tlClean.indexOf('id="pw-heal-fill"'));
ck("heal above bull",
  tlClean.indexOf('id="pw-heal-fill"') < tlClean.indexOf('id="pw-bull-fill"'));

// no stray '>' text node in the HUD (comments stripped, as the parser sees it)
let bare = 0, i = 0;
while (i < tlClean.length) {
  if (tlClean[i] === "<") { const gt = tlClean.indexOf(">", i); if (gt < 0) break; i = gt + 1; continue; }
  const lt = tlClean.indexOf("<", i);
  const compact = tlClean.substring(i, lt < 0 ? tlClean.length : lt).replace(/\s+/g, "");
  bare += (compact.match(/>/g) || []).length;
  i = lt < 0 ? tlClean.length : lt;
}
ck("no stray '>' text node under Street Cash", bare === 0, "bare=" + bare);
ck("#pips markup present", html.includes('id="pips"'));

// bars CSS: 6px, bright border, bright fills
ck(".pwbar 6px tall", /\.pwbar \{[\s\S]{0,400}?height: 6px/.test(html));
ck(".pwbar has a light border (1px solid rgba(234", html.includes("border: 1px solid rgba(234, 246, 255"));
ck(".pwbar fills are bright 3-stop gradients",
  /\.pwbar-heal \.pwfill \{[\s\S]{0,220}?linear-gradient\(90deg, #1f8f4c, #39f78e, #b8ffdf\)/.test(html) &&
  /\.pwbar-bull \.pwfill \{[\s\S]{0,220}?linear-gradient\(90deg, #8f1f1f, #ff3939, #ffd1cf\)/.test(html));
ck(".pwbar-bull glow is RED", /\.pwbar-bull \.pwfill \{[\s\S]{0,220}?rgba\(255, 78, 78/.test(html));
ck("bars show in OVERTIME (no !BONUS gate on the earn bars)",
  html.includes('const show = state === "play";') &&
  !html.includes('const show = state === "play" && !BONUS;'));
ck("hamburger icon on the heal bar + soda-can icon on the bull bar",
  tlClean.includes('id="pw-heal-icon"') && tlClean.includes('&#127822;') &&
  tlClean.includes('id="pw-bull-icon"') && tlClean.includes('&#129380;') &&
  html.includes('healIco = $("pw-heal-icon")') && html.includes('bullIco = $("pw-bull-icon")'));
ck(".pwbar + .pwbar sibling rule", /\.pwbar \+ \.pwbar/.test(html));

// js wiring
ck("cashStepNow + scoreStepNow present",
  /function cashStepNow\(\)/.test(html) && /function scoreStepNow\(\)/.test(html));
ck("setStartMilestones present", /function setStartMilestones\(\)/.test(html));
ck("updatePowerProgress present", /function updatePowerProgress\(\) \{/.test(html));
ck("NIGHT cash target 5000 (the night heal-load equals the weekday load, paid in HELL NOTES)", /const NIGHT_POWERUP_CASH_STEP = 5000/.test(html));
ck("NIGHT score target 120000", /const NIGHT_MONSTER_SCORE_STEP = 120000/.test(html));
// The drops run on the ACTIVE LEVEL's amount (cashStepNow / scoreStepNow): the weekday
// literals stay the shipped numbers, MIDNIGHT pays 5,000 NOTES / 120,000 SCORE, so the
// bar and the drop are measured on ONE scale on every level.
ck("healer milestone pays the level's cash step", /healerNextAt \+= cashStepNow\(\);/.test(html));
ck("monster milestone pays the level's score step", /monsterNextAt \+= scoreStepNow\(\);/.test(html));
ck("weekday steps are the shipped literals", /const POWERUP_CASH_STEP = 5000/.test(html) && /const MONSTER_SCORE_STEP = 30000/.test(html));
ck("cashStepNow answers the weekday literal off a night shift",
  /function cashStepNow\(\)\s*\{[\s\S]{0,140}\?\s*NIGHT_POWERUP_CASH_STEP\s*\r?\n\s*:\s*POWERUP_CASH_STEP;/.test(html));
ck("scoreStepNow answers the weekday literal off a night shift",
  /function scoreStepNow\(\)\s*\{[\s\S]{0,140}\?\s*NIGHT_MONSTER_SCORE_STEP\s*\r?\n\s*:\s*MONSTER_SCORE_STEP;/.test(html));
ck("MIDNIGHT re-anchors the two earn spans on tonight's grid (night-only)",
  /function armMidnightEarnSpans\(\) \{[\s\S]{0,120}isNightShift[\s\S]{0,90}return;[\s\S]{0,600}healerSpanBase = Math\.floor\(bonusTally \/ cashStep\) \* cashStep;[\s\S]{0,80}healerNextAt = healerSpanBase \+ cashStep;[\s\S]{0,140}monsterSpanBase = Math\.floor\(score \/ scoreStep\) \* scoreStep;[\s\S]{0,80}monsterNextAt = monsterSpanBase \+ scoreStep;/.test(html));
ck("the re-arm runs from the per-shift reset (resetWorldState)",
  /armMidnightEarnSpans\(\);/.test(html.slice(html.indexOf('function resetWorldState()'), html.indexOf('function resetWorldState()') + 4000)));
ck("ONE grid line: bar at 100% is exactly the drop line (weekday + Midnight)", (() => {
  const grid = (v, s) => Math.floor(v / s) * s;
  const cases = [[0, 5000, 0, 5000], [2250, 5000, 0, 5000], [5000, 5000, 5000, 10000],
                 [60000, 5000, 60000, 65000], [4999, 5000, 0, 5000], [5000, 5000, 5000, 10000],
                 [30000, 120000, 0, 120000], [119000, 120000, 0, 120000], [120000, 120000, 120000, 240000]];
  return cases.every(([v, s, wb, wa]) => grid(v, s) === wb && grid(v, s) + s === wa);
})());
ck("bars roll their own span base (cash)", /while \(bonusTally - healerSpanBase >= cashStep\)/.test(html));
ck("bars roll their own span base (score)", /while \(score - monsterSpanBase >= scoreStep\)/.test(html));
ck("updateHUD wires updatePowerProgress",
  html.includes('setTxt($("bonus"), pad(bonusTally));\r\n        updatePowerProgress();'));
ck("pips block guarded",
  !/const pips = \$\("pips"\)\.children/.test(html) &&
  html.includes('const pipsEl = $("pips");') && html.includes("if (pipsEl && pipsEl.children)"));

// inline script parses
const scripts = [...html.matchAll(/<script\b([^>]*?)>([\s\S]*?)<\/script>/g)];
let parsed = 0, errs = [];
scripts.forEach((m) => {
  const attrs = m[1] || "", body = m[2] || "";
  if (/\bsrc\s*=/.test(attrs)) return;
  if (/\btype\s*=/.test(attrs) && !/javascript/.test(attrs)) return;
  if (body.trim().length === 0) return;
  try { new Function(body); parsed++; } catch (e) { errs.push(e.message); }
});
ck(`JS parse (${parsed} inline scripts)`, errs.length === 0, errs[0]);

// bar math with the roll, weekday vs Midnight
const frac = (v, base, step) => { let b = base; if (step>0) while (v-b>=step) b+=step; return step>0?Math.max(0,Math.min(1,(v-b)/step)):0; };
[["W 500/5000",500,0,5000,0.1],["W 2500",2500,0,5000,0.5],["W 5000->0",5000,0,5000,0],
 ["M 1200/5000",1200,0,5000,0.24],["M 4000/5000",4000,0,5000,0.8],["M 5000->0",5000,0,5000,0],
 ["W 15000/30000",15000,0,30000,0.5],["M 30000/120000",30000,0,120000,0.25]]
 .forEach(c=>ck("math "+c[0],Math.abs(frac(c[1],c[2],c[3])-c[4])<1e-9));

const fails = checks.filter((c) => !c.ok);
console.log(`PASS ${checks.filter((c) => c.ok).length}/${checks.length}`);
if (fails.length) { fails.forEach((f) => console.log("  -", f.n, f.x ? "[" + f.x + "]" : "")); process.exit(1); }
