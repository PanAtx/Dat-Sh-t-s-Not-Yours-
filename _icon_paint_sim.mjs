// _icon_paint_sim.mjs - extracts renderEarnIconFromTemplate + paintEarnBarIcons from
// index.html and runs them against mock DOM/THREE to verify the paint path end-to-end.
import { readFileSync } from "fs";
const html = readFileSync("index.html", "utf8");
const a = html.indexOf("function renderEarnIconFromTemplate(");
const b = html.indexOf("// ==================== BOOT ====");
if (a < 0 || b < 0 || b <= a) { console.log("EXTRACT FAIL"); process.exit(1); }
const code = html.slice(a, b);

function makeMocks(THREE) {
  const dom = {
    canvas: { toDataURL: (t) => "data:image/png;base64,MOCK" },
    createElement: () => dom.canvas,
    els: {
      "pw-heal-icon": { textContent: "\u{1F382}", style: {} },
      "pw-bull-icon": { textContent: "\u{1F964}", style: {} },
    },
    getElementById: (id) => dom.els[id] || null,
  };
  return { dom, THREE };
}

const mkV3 = () => ({
  x: 0, y: 0, z: 0,
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; },
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; },
  normalize() { const m = Math.hypot(this.x, this.y, this.z) || 1; return this.multiplyScalar(1 / m); },
});
const THREE_OK = {
  WebGLRenderer: function () { this.setPixelRatio = this.setSize = this.setClearColor = this.render = this.forceContextLoss = this.dispose = () => {}; },
  Vector3: function (x, y, z) { this.x = x; this.y = y; this.z = z; Object.assign(this, mkV3()); return this; },
  DirectionalLight: function () { this.position = mkV3(); },
  AmbientLight: function () {},
  Scene: function () { this.add = () => {}; },
  Group: function () { this.add = () => {}; this.scale = { setScalar: () => {} }; this.position = { set: () => {} }; },
  Box3: function () { this.setFromObject = () => { this.min = { x: -0.5, y: -0.3, z: -0.5 }; return this; }; this.getCenter = () => mkV3(); this.getSize = () => ({ x: 1, y: 0.6, z: 1 }); },
  OrthographicCamera: function () { this.position = mkV3(); this.lookAt = () => {}; },
};
const tpl = { clone: () => ({ rotation: { set: () => {} } }) };

const fn = new Function("document", "THREE", "console", "localStorage", "BEC_TPL", "MONSTER_TPL",
  code + "\n; paintEarnBarIcons();");

const mkLS = (init = {}) => {
  const s = { ...init };
  return { store: s, getItem: (k) => (s[k] === undefined ? null : s[k]), setItem: (k, v) => { s[k] = String(v); } };
};

// Case 1: templates ready -> icons painted, emoji cleared, pair PERSISTED
const m1 = makeMocks(THREE_OK);
const ls1 = mkLS();
fn(m1.dom, THREE_OK, console, ls1, { template: tpl }, { template: tpl });
const ok1 = ["pw-heal-icon", "pw-bull-icon"].every((id) => m1.dom.els[id].style.backgroundImage.includes("data:image/png") && m1.dom.els[id].textContent === "") &&
  (() => { try { const j = JSON.parse(ls1.getItem("dsnysweep_bar_icons")); return j && j.bec.includes("data:image/png") && j.bull.includes("data:image/png"); } catch (e) { return false; } })();

// Case 2: REPEAT VISIT - storage carries yesterday's icons, 3D unavailable -> paint INSTANTLY from cache
const m2 = makeMocks(undefined);
const ls2 = mkLS({ dsnysweep_bar_icons: JSON.stringify({ bec: "data:image/png;base64,SAVED_BEC", bull: "data:image/png;base64,SAVED_BULL" }) });
fn(m2.dom, undefined, { warn: () => {} }, ls2, null, null);
const ok2 = m2.dom.els["pw-heal-icon"].style.backgroundImage.includes("SAVED_BEC") &&
  m2.dom.els["pw-bull-icon"].style.backgroundImage.includes("SAVED_BULL") &&
  m2.dom.els["pw-heal-icon"].textContent === "";

// Case 3: THREE missing, nothing stored -> emoji fallback stays untouched
const m3 = makeMocks(undefined);
fn(m3.dom, undefined, { warn: () => {} }, mkLS(), { template: tpl }, { template: tpl });
const ok3 = m3.dom.els["pw-heal-icon"].textContent !== "" && !m3.dom.els["pw-heal-icon"].style.backgroundImage;

// Case 4: templates not loaded, nothing stored -> emoji fallback stays
const m4 = makeMocks(THREE_OK);
fn(m4.dom, THREE_OK, { warn: () => {} }, mkLS(), null, null);
const ok4 = m4.dom.els["pw-heal-icon"].textContent !== "" && m4.dom.els["pw-bull-icon"].textContent !== "";

// Case 5: storage full / private mode (setItem throws) -> paint still works this visit
const m5 = makeMocks(THREE_OK);
const ls5 = mkLS(); ls5.setItem = () => { throw new Error("QuotaExceeded"); };
fn(m5.dom, THREE_OK, { warn: () => {} }, ls5, { template: tpl }, { template: tpl });
const ok5 = m5.dom.els["pw-bull-icon"].style.backgroundImage.includes("data:image/png");

console.log("paint + persist:", ok1 ? "PASS" : "FAIL");
console.log("repeat-visit instant paint:", ok2 ? "PASS" : "FAIL");
console.log("no-THREE fallback:", ok3 ? "PASS" : "FAIL");
console.log("no-template fallback:", ok4 ? "PASS" : "FAIL");
console.log("quota/private-mode write:", ok5 ? "PASS" : "FAIL");
process.exit(ok1 && ok2 && ok3 && ok4 && ok5 ? 0 : 1);
