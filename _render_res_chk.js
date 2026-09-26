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
  "resize handler keeps the RENDER_H cap (applyRenderSize)",
  (() => {
    const i = h.indexOf('window.addEventListener("resize"');
    if (i < 0) return false;
    const seg = h.slice(i, i + 400);
    return seg.indexOf("applyRenderSize();") >= 0 && seg.indexOf("renderer.setSize(innerWidth, innerHeight)") === -1;
  })()
);
check(
  "menu has a RENDER toggle button that cycles 540P -> 720P -> NATIVE and persists",
  h.indexOf('id="btnRes"') >= 0 &&
    h.indexOf("RES_CYCLE[(RES_CYCLE.indexOf(RENDER_H) + 1) % RES_CYCLE.length]") >= 0 &&
    h.indexOf('localStorage.setItem("dsnysweep_render_h"') >= 0
);
check(
  "#btnRes shares the terminal button style (base + hover groups)",
  /#btnStart,\s*#btnRes,/.test(h) && /#btnStart:hover,\s*#btnRes:hover,/.test(h)
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
    h.indexOf("if (state === \"play\" && FPS_CAP > 0)") >= 0 &&
    h.indexOf("if (now - lastRenderT < minMs) return;") >= 0
);
check(
  "FPS cap: dt is measured from the last RENDERED frame (lastRenderT = now)",
  (() => {
    const i = h.indexOf("function loop(now) {");
    if (i < 0) return false;
    const seg = h.slice(i, i + 1200);
    return seg.indexOf("lastRenderT = now;") >= 0 && seg.indexOf("let dt = (now - lastT) / 1000;") >= 0;
  })()
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
    (h.match(/function setShadowLabel/g) || []).length === 1
);
check(
  "menu has all four setting buttons, styled like the terminal buttons",
  h.indexOf('id="btnFps"') >= 0 &&
    h.indexOf('id="btnShadow"') >= 0 &&
    h.indexOf('id="btnCrt"') >= 0 &&
    /#btnRes,\s*#btnFps,\s*#btnShadow,\s*#btnCrt,/.test(h) &&
    /#btnRes:hover,\s*#btnFps:hover,\s*#btnShadow:hover,\s*#btnCrt:hover,/.test(h)
);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);