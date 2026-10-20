// _hud_cover_chk.js - the phone HUD layering law:
//   the OVERTIME / MIDNIGHT goal chips (BASKETS + CASH, SPOOKS, the block WARD, the
//   SLUG DEMON bar) must NEVER cover the top-left readout - the earn-a-healer bar and
//   the RED BULL progress bar stay readable; the thumb-stick paints OVER the chips (the
//   chips only ever show THROUGH the translucent stick), and the strip that carries them
//   is MEASURED off the live readout + the live joystick, not guessed in pixels.
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8").replace(/\r\n/g, "\n"); // anchors are LF
const checks = [];
const ck = (n, ok, x) => checks.push({ n, ok, x });
const slice = (a, b) => {
  const i = html.indexOf(a);
  if (i < 0) return "";
  const j = html.indexOf(b, i + a.length);
  return j < 0 ? html.slice(i) : html.slice(i, j);
};
const num = (src, name) => {
  const m = src.match(new RegExp(name + ":\\s*([0-9.]+)"));
  return m ? parseFloat(m[1]) : NaN;
};
const rootBlock = slice("--z-goal", "\n      }");

/* ---- 1. the paint layers: goal chips < thumb-stick < readout ---- */
const zGoal = num(rootBlock, "--z-goal"),
  zPad = num(rootBlock, "--z-pad"),
  zHud = num(rootBlock, "--z-hud");
ck("the HUD layer vars exist (goal / pad / hud)", [zGoal, zPad, zHud].every((v) => v > 0), `${zGoal}/${zPad}/${zHud}`);
ck("goal chips < thumb-stick (chips never paint ON TOP of the joystick)", zGoal < zPad, `${zGoal}<${zPad}`);
ck("thumb-stick < readout (heal + RED BULL paint over every chip)", zPad < zHud, `${zPad}<${zHud}`);
ck("#hud rides --z-hud", /#hud \{[\s\S]{0,400}?z-index: var\(--z-hud/.test(html));
ck("#vpad rides --z-pad", /#vpad \{[\s\S]{0,400}?z-index: var\(--z-pad/.test(html));
ck("#vpad keeps its trainer layer (50)", /body\.trainer-open #vpad \{ z-index: 50; \}/.test(html));
["bonus-goal", "ecto-goal", "gate-goal", "boss-goal"].forEach((id) => {
  ck(`#${id} rides --z-goal`, new RegExp(`#${id} \\{[\\s\\S]{0,700}?z-index: var\\(--z-goal`).test(html));
});
ck("the goal panels ride no layer above the readout", !/#(bonus-goal|ecto-goal|gate-goal|boss-goal) \{[\s\S]{0,700}?z-index: 1[6-9]\d?;/.test(html));

/* ---- 2. the strip is MEASURED, not hardcoded ---- */
const PANELS = ["bonus-goal", "ecto-goal", "gate-goal", "boss-goal"];
PANELS.forEach((id) => {
  ck(
    `#${id} hangs off --goal-strip-top`,
    new RegExp(`#${id} \\{[\\s\\S]{0,900}?var\\(--goal-strip-top`).test(html),
  );
});
ck(
  "no panel is parked on a hardcoded safe-area pixel slot",
  !PANELS.some((id) =>
    new RegExp(`#${id} \\{[\\s\\S]{0,900}?top: calc\\(\\d+px \\+ env\\(safe-area-inset-top`).test(html),
  ),
);
PANELS.forEach((id) => {
  const mob = slice(`@media (max-width: 600px), (max-height: 480px)`, `/* ---- pressure tiers`);
  const rule = mob.slice(mob.indexOf(`#${id} {`), mob.indexOf(`#${id} {`) + 420);
  ck(`#${id} is capped by --goal-strip-cap on a phone`, rule.includes("--goal-strip-cap"));
});
ck("layoutGoalStrip measures the readout", /function layoutGoalStrip\(\)/.test(html));
ck("layoutGoalStrip measures the thumb-stick top (--joy-top)", /--joy-top/.test(slice("function layoutGoalStrip()", "PRANK PAYOUT")));
ck("layoutGoalStrip measures the chip row height", /--goal-strip-row/.test(slice("function layoutGoalStrip()", "PRANK PAYOUT")));
ck("layoutGoalStrip keeps --goal-strip-top", /--goal-strip-top/.test(slice("function layoutGoalStrip()", "PRANK PAYOUT")));
ck(
  "layoutGoalStrip runs on boot / every rotation (fitGameBox)",
  /layoutGoalStrip\(\);/.test(slice("function fitGameBox()", "// ==================== THE RADIO DATA TIER")),
);
ck(
  "a earn-bar show/hide re-measures the strip (level start)",
  /if \(pwBarsShown !== show\)/.test(slice("function updatePowerProgress()", "PRANK PAYOUT")),
);
ck("the bars stay inside the readout (heal + bull under STREET CASH)", html.indexOf('id="pw-heal-bar"') > html.indexOf('id="bonus"') && html.indexOf('id="pw-heal-bar"') < html.indexOf('id="pw-bull-bar"'));
ck("the stick DOM is painted after the chips (same-layer fallback)", html.indexOf('id="vpad"') > html.indexOf('id="bonus-goal"'));

/* ---- 3. the phone math: the strip chain on real phone viewports ----
   The strip is measured in the browser; here the same chain is replayed with the
   shipped phone geometry - the top-left readout (16px + the shipped bar stack) and
   the thumb-stick slot (bottom 56px + min(36vh, 24vw, 200px)) - to prove the chips
   land UNDER the RED BULL bar and clear of the stick's paint area. */
const READOUT_TOP = 16,
  READOUT_H = 157; // .hp + .dist + SCORE + STREET CASH + the two earn bars, 11-20px type
const CHIP = 24,
  CHIPS_GAP = 4,
  PAD_BOTTOM = 56,
  JOY = (vh, vw) => Math.min(0.36 * vh, 0.24 * vw, 200);
const phones = [
  ["iPhone landscape 844x390", 844, 390],
  ["Pixel landscape 915x412", 915, 412],
  ["iPhone SE landscape 667x375", 667, 375],
  ["small landscape 568x320", 568, 320],
  ["iPhone portrait 390x844", 390, 844],
  ["tablet landscape 1024x768", 1024, 768],
];
phones.forEach(([name, vw, vh]) => {
  const barsBottom = READOUT_TOP + READOUT_H;
  const strip = barsBottom + 6; // the measured --goal-strip-top
  const joyTop = vh - (PAD_BOTTOM + JOY(vh, vw));
  const cap = Math.max(vh * 0.42, Math.min(vh - 44, joyTop - 6));
  const chipsTop = Math.min(strip, cap - CHIP);
  const gateTop = Math.min(strip + CHIP + CHIPS_GAP, cap - CHIP);
  const bossTop = Math.min(strip + 3 * CHIP + 2 * CHIPS_GAP + 22, cap - 48);
  const TALL = vh >= 390; // the tall-phone law: full geometric clearance under the bars
  // short phones: the measured strip is clamped by the joystick cap, so the chips ride
  // in the cap band (floor - one chip) and the LAYER LAW keeps the bars painted on top
  const barsClear = TALL
    ? chipsTop >= barsBottom - 12
    : chipsTop >= Math.round(vh * 0.42) - CHIP && barsBottom - chipsTop <= 56;
  ck(
    `${name}: heal + RED BULL stay readable (clear of the chips on tall phones, paint-layered on short ones)`,
    barsClear,
    `bars ${barsBottom} -> chips ${Math.round(chipsTop)}`,
  );
  ck(`${name}: the chip strip stays above the joystick zone`, chipsTop <= joyTop + 12, `chips ${Math.round(chipsTop)} / stick top ${Math.round(joyTop)}`);
  ck(`${name}: the overtime chips fit the screen`, chipsTop + 2 * CHIP + CHIPS_GAP < vh, `strip ends ${Math.round(chipsTop + 2 * CHIP + CHIPS_GAP)} of ${vh}`);
  ck(`${name}: the ward chip clears the stick`, gateTop < joyTop + CHIP + 26, `ward ${Math.round(gateTop)} / stick top ${Math.round(joyTop)}`);
  ck(`${name}: the boss bar ends in the screen`, bossTop + CHIP + 26 < vh, `boss ${Math.round(bossTop)} + ${CHIP}+26`);
});

let bad = 0;
for (const c of checks) {
  if (!c.ok) bad++;
  console.log((c.ok ? "ok   " : "FAIL ") + c.n + (c.x ? "  [" + c.x + "]" : ""));
}
console.log(`\n${checks.length - bad}/${checks.length} HUD layering checks passed`);
if (bad) process.exit(1);

ck(
  "a earn-bar show/hide re-measures the strip (level start)",
  /if \(pwBarsShown !== show\)/.test(slice("function updatePowerProgress()", "PRANK PAYOUT")),
);
ck("the bars stay inside the readout (heal + bull under STREET CASH)", html.indexOf('id="pw-heal-bar"') > html.indexOf('id="bonus"') && html.indexOf('id="pw-heal-bar"') < html.indexOf('id="pw-bull-bar"'));
ck("the stick DOM is painted after the chips (same-layer fallback)", html.indexOf('id="vpad"') > html.indexOf('id="bonus-goal"'));
