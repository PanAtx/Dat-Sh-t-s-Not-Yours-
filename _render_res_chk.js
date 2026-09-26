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
  "RENDER_H defaults to 540 with the 540/720/native cycle, persisted (dsnysweep_render_h)",
  h.indexOf("RES_CYCLE = [540, 720, 0]") >= 0 &&
    h.indexOf('localStorage.getItem("dsnysweep_render_h")') >= 0 &&
    h.indexOf("let RENDER_H") >= 0
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

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);