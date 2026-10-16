// _render_res_chk.js — LOW-RES RENDER (retro upscale + FPS) wiring in index.html
const fs = require("fs");
const h = fs.readFileSync("index.html", "utf8");
let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log("  ok  " + name + (detail ? "  (" + detail + ")" : "")); }
  else { fail++; console.log(" FAIL " + name + (detail ? "  (" + detail + ")" : "")); }
};

console.log("--- low-res render (retro pixels + FPS) ---");
check(
  "RENDER_H defaults to 540 with the full cycle incl. 320 (NES) + 240 (Atari 2600), persisted",
  h.indexOf("RES_CYCLE = [540, 720, 0, 320, 240]") >= 0 &&
    h.indexOf('localStorage.getItem("dsnysweep_render_h")') >= 0 &&
    h.indexOf("let RENDER_H") >= 0 &&
    h.indexOf('RES_NAMES = { 320: "320P", 240: "ATARI 2600" }') >= 0
);
check(
  "applyRenderSize caps the buffer at RENDER_H, keeps the aspect, never touches the CSS",
  h.indexOf("Math.min(RENDER_H, innerHeight)") >= 0 &&
    h.indexOf("renderer.setSize(w, h, false)") >= 0
);
check(
  "pixel ratio pinned to 1 under the low-res buffer (no supersampling)",
  h.indexOf("renderer.setPixelRatio(1);") >= 0
);
check(
  "canvas CSS fills the window and upscales pixelated",
  /#game canvas\s*\{[^}]*width:\s*100%[^}]*image-rendering:\s*pixelated/.test(h)
);
check(
  "initThree uses applyRenderSize (no full-window setSize at startup)",
  (() => {
    const i = h.indexOf("function initThree() {");
    if (i < 0) return false;
    const seg = h.slice(i, i + 700);
    return (
      seg.indexOf("applyRenderSize();") >= 0 &&
      seg.indexOf("renderer.setSize(innerWidth, innerHeight)") === -1
    );
  })()
);
check(
  "resize handlers keep the RENDER_H cap (applyRenderSize; every camera-era resize listener, none rebuilds the buffer at window size)",
  (() => {
    // Scan ALL resize-listener registrations: the FIRST is the pre-camera CSS
    // box fitter (no renderer exists yet), the camera-era one carries
    // applyRenderSize(). The day the trainer listener was added it moved past
    // the old single-window, so a fixed 600-char slice started reading noise.
    const windows = [];
    let k = -1;
    while ((k = h.indexOf('window.addEventListener("resize"', k + 1)) >= 0)
      windows.push(h.slice(k, k + 2400));
    const camWindows = windows.filter((seg) => seg.indexOf("applyRenderSize();") >= 0);
    return (
      camWindows.length >= 1 &&
      camWindows.every((seg) => seg.indexOf("renderer.setSize(innerWidth, innerHeight)") === -1)
    );
  })()
);
check(
  "menu has a RENDER toggle button that cycles 540P -> 720P -> NATIVE and persists",
  h.indexOf('id="btnRes"') >= 0 &&
    h.indexOf("RES_CYCLE[(RES_CYCLE.indexOf(RENDER_H) + 1) % RES_CYCLE.length]") >= 0 &&
    h.indexOf('localStorage.setItem("dsnysweep_render_h"') >= 0
);
check(
  "start screen stays clean: option buttons left the big button groups",
  /#btnStart,\s*#btnRestart,/.test(h) && /#btnStart:hover,\s*#btnRestart:hover,/.test(h)
);

console.log("\n--- retro extras (CRT / FPS cap / shadow quality) ---");
check(
  "CRT: the always-on #scanlines + #vignette overlays exist and are toggleable",
  h.indexOf('<div id="scanlines"></div>') >= 0 &&
    h.indexOf('<div id="vignette"></div>') >= 0 &&
    h.indexOf("id=\"btnCrt\"") >= 0 &&
    h.indexOf('localStorage.getItem("dsnysweep_crt")') >= 0 &&
    h.indexOf('$("scanlines").className = off') >= 0
);
check(
  "FPS cap: 60/30 toggle, persisted, skips early rAF callbacks while playing",
  h.indexOf("FPS_CAPS = [60, 30]") >= 0 &&
    h.indexOf('localStorage.getItem("dsnysweep_fps")') >= 0 &&
    h.indexOf("let FPS_CAP") >= 0 &&
    h.indexOf("let lastRenderT = 0;") >= 0 &&
    h.indexOf('if ((state === "play" || state === "trainer") && FPS_CAP > 0)') >= 0 &&
    h.indexOf("if (now - lastRenderT < minMs) return;") >= 0
);
check(
  "FPS cap: dt is measured from the last RENDERED frame (lastRenderT = now)",
  (() => {
    const i = h.indexOf("function loop(now) {");
    if (i < 0) return false;
    const seg = h.slice(i, i + 1700);
    return seg.indexOf("lastRenderT = now;") >= 0 && seg.indexOf("let dt = (now - lastT) / 1000;") >= 0;
  })()
);
check(
  "the frame cap stays the PLAYER'S setting: the governor lends FPS_CAP as live state only, re-adopts" +
    " the pick on a menu press, and the stored key is written solely by the settings button",
  h.indexOf("GOV_FPS_LADDER = [60, 30]") >= 0 &&
    h.indexOf("_govTargetFps = FPS_CAP") >= 0 &&
    h.indexOf("govAdoptSettings();") >= 0 &&
    (h.match(/localStorage\.setItem\("dsnysweep_fps"/g) || []).length === 1
);
check(
  "CRT: the trainer carries its OWN overlay pair inside the panel and the CRT row drives all four",
  h.indexOf('<div id="trainer-scanlines"></div>') >= 0 &&
    h.indexOf('<div id="trainer-vignette"></div>') >= 0 &&
    h.indexOf("#trainer-scanlines {") >= 0 &&
    h.indexOf("#trainer-vignette {") >= 0 &&
    h.indexOf('$("trainer-scanlines").className = off') >= 0 &&
    h.indexOf('$("vignette").className = off') >= 0
);
check(
  "the trainer menu obeys the SETTINGS rows: its buffer caps at RENDER_H (pixel ratio 1, CSS keeps" +
    " filling the window) and its 2D marquee canvas obeys the governor's loan",
  h.indexOf('var rh = (typeof RENDER_H !== "undefined") ? RENDER_H : 0;') >= 0 &&
    h.indexOf("TRAINER.renderer.setSize(bw, bh, false);") >= 0 &&
    h.indexOf("TB.dpr = trainerPixelScale();") >= 0
);
check(
  "THE RETURN LAW: the tier hands the player's OWN values back verbatim - RENDER_H = _govTargetRes" +
    " (ATARI / NATIVE sit off the ladder and come back as themselves), FPS_CAP falls back to" +
    " _govTargetFps whenever the cap lever is not out, and a settings press applies the whole ladder" +
    " at zero levers (the target is never a ladder rung)",
  h.indexOf("RENDER_H = _govTargetRes;") >= 0 &&
    h.indexOf("RENDER_H = nRung < 0 ? _govTargetRes : GOV_LADDER[nRung];") >= 0 &&
    h.indexOf("GOV_FPS_LADDER[1] : _govTargetFps;") >= 0 &&
    h.indexOf("govApplyLent(0);") >= 0
);
check(
  "shadow quality: HI 2048 / LO 1024 toggle, persisted, map disposed to rebuild at new size",
  h.indexOf("SHADOW_SIZES = [2048, 1024]") >= 0 &&
    h.indexOf('localStorage.getItem("dsnysweep_shadow")') >= 0 &&
    h.indexOf("let SHADOW_SIZE") >= 0 &&
    h.indexOf("dirLight.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE)") >= 0 &&
    h.indexOf("dirLight.shadow.map.dispose();") >= 0 &&
    h.indexOf("dirLight.shadow.map = null;") >= 0
);
check(
  "initThree applies the chosen shadow size at startup (not a hardcoded 2048)",
  (() => {
    const i = h.indexOf("function initThree() {");
    if (i < 0) return false;
    const seg = h.slice(i, i + 2500);
    return (
      seg.indexOf("dirLight.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE)") >= 0 &&
      seg.indexOf("dirLight.shadow.mapSize.set(2048, 2048)") === -1
    );
  })()
);
check(
  "settings state is declared ONCE at top level (no duplicate consts / no trapped modules)",
  (h.match(/const FPS_CAPS/g) || []).length === 1 &&
    (h.match(/const SHADOW_SIZES/g) || []).length === 1 &&
    (h.match(/let lastRenderT/g) || []).length === 1 &&
    (h.match(/function setFpsLabel/g) || []).length === 1 &&
    (h.match(/function setShadowLabel/g) || []).length === 1 &&
    (h.match(/function setResLabel/g) || []).length === 1 &&
    (h.match(/function setScanLabel/g) || []).length === 1
);
check(
  "settings page: gear button opens it, BACK + ESC close it, and it carries FIVE option rows",
  h.indexOf('id="settingsPage"') >= 0 &&
    h.indexOf('id="btnSettings"') >= 0 &&
    h.indexOf('id="btnSettingsBack"') >= 0 &&
    (h.match(/class="set-row"/g) || []).length === 5 &&
    h.indexOf('$("btnSettings").addEventListener("click", openSettings)') >= 0 &&
    h.indexOf('$("btnSettingsBack").addEventListener("click", closeSettings)') >= 0 &&
    h.indexOf('e.key === "Escape"') >= 0
);
check(
  "settings page: all FIVE option buttons (incl. the RADIO tier row) live INSIDE it and are styled there",
  (() => {
    const i = h.indexOf('id="settingsPage"');
    if (i < 0) return false;
    const seg = h.slice(i, i + 2000);
    return (
      seg.indexOf('id="btnRes"') >= 0 &&
      seg.indexOf('id="btnFps"') >= 0 &&
      seg.indexOf('id="btnShadow"') >= 0 &&
      seg.indexOf('id="btnCrt"') >= 0 &&
          seg.indexOf('id="btnMusic"') >= 0 &&
      seg.indexOf('id="btnSettingsBack"') >= 0
    );
  })() &&
    h.indexOf("#settingsPage {") >= 0 &&
    h.indexOf("#settingsBox .set-row button") >= 0 &&
    h.indexOf(".menu-actions {") >= 0
);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);