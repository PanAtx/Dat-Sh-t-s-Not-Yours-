// _instructions_dom_chk.js — runs the EXACT instructions wiring from index.html
// (extracted verbatim) against a faked DOM: open, close, ✕, backdrop tap, ESC,
// and the cascade delays. Same harness style as _pad_chk.js.
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
let fails = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? "PASS  " : "FAIL  ") + name + (extra ? "  [" + extra + "]" : ""));
  if (!cond) fails++;
};

// ---- extract the wiring verbatim ----
const MARK = "function openInstructions() {";
const ESC_MARK = 'if (e.key === "Escape" && !$("instructionsPage").classList.contains("hidden")) closeInstructions();';
const start = html.indexOf(MARK);
const escAt = html.indexOf(ESC_MARK);
const tail = html.indexOf("});", escAt + ESC_MARK.length);
ok("wiring block found", start > 0 && escAt > start && tail > escAt, "chars " + (tail - start + 3));
const code = html.slice(start, tail + 3);

// ---- faked DOM ----
function el(id) {
  const node = {
    id, hidden: true, scrollTop: 999, children: [], style: {}, _h: {},
    _cls: null,
    addEventListener(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); },
    fire(ev, e) { (this._h[ev] || []).forEach((fn) => fn.call(this, e || { target: this })); },
  };
  node._cls = new Set(id === "instructionsPage" ? ["hidden"] : []);
  node.classList = {
    add: (c) => node._cls.add(c),
    remove: (c) => node._cls.delete(c),
    contains: (c) => node._cls.has(c),
    toggle: () => {},
  };
  return node;
}
const page = el("instructionsPage");
const box = el("instructionsBox");
box.scrollTop = 900; // scrolled away from the top
for (let i = 1; i <= 74; i++) {
  const kid = el("kid" + i);
  kid.style = { _v: {}, setProperty(k, v) { this._v[k] = v; } };
  box.children.push(kid);
}
const btn = el("btnInstructions");
const xBtn = el("btnInstructionsClose");
const els = { instructionsPage: page, instructionsBox: box, btnInstructions: btn, btnInstructionsClose: xBtn };
const $ = (id) => els[id];
const winHandlers = [];
const window = { addEventListener(ev, fn) { winHandlers.push({ ev, fn }); }, fire(k, e) { winHandlers.filter(h => h.ev === k).forEach(h => h.fn(e)); } };

new Function("$", "window", code)($, window);

// ---- the law ----
ok("wired to the book button", (btn._h.click || []).length === 1, "click handlers " + (btn._h.click || []).length);
ok("wired to the ✕ button", (xBtn._h.click || []).length === 1);
ok("wired to the backdrop", (page._h.click || []).length === 1);
const esc = winHandlers.filter((h) => h.ev === "keydown" && /closeInstructions/.test(String(h.fn))).length;
ok("wired to ESC", esc === 1, "esc handlers " + esc);

// OPEN
btn.fire("click");
ok("OPEN clears .hidden", !page.classList.contains("hidden"));
ok("OPEN rewinds the card to the top", box.scrollTop === 0, "scrollTop " + box.scrollTop);
const cds = box.children.map((k) => k.style._v["--cd"]);
ok("OPEN staggers every row (cascade)", cds.length === 74 && cds.every((v, i) => Number(v) === i), "first " + cds[0] + " last " + cds[cds.length - 1]);

// ESC closes
window.fire("keydown", { key: "Escape" });
ok("ESC closes the card", page.classList.contains("hidden"));

// ✕ opens + closes
btn.fire("click");
xBtn.fire("click");
ok("the ✕ button closes the card", page.classList.contains("hidden"));

// backdrop tap closes, card tap does NOT
btn.fire("click");
page.fire("click", { target: box }); // tapped inside the card
ok("a tap INSIDE the card keeps it open", !page.classList.contains("hidden"));
page.fire("click", { target: page }); // tapped the dark backdrop
ok("a backdrop tap closes the card", page.classList.contains("hidden"));

// The instructions block must be its own wiring: it closes nothing else, and the
// credits / settings wiring is left exactly where it was in index.html.
ok("the card closes nothing but itself", !/closeCredits|closeSettings|togglePause/.test(code));
ok("the credits wiring is untouched", /\$\("btnCredits"\)\.addEventListener\("click", openCredits\)[\s\S]{0,400}\$\("btnCreditsClose"\)\.addEventListener\("click", closeCredits\)/.test(html));
ok("the settings wiring is untouched", /\$\("btnSettings"\)\.addEventListener\("click", openSettings\)/.test(html));

// ---- THE MOBILE SCROLL GUARD (extracted verbatim from index.html) ----
// A touch-drag that STARTS INSIDE a scrolling card must reach the browser as a native pan -
// on a phone that is the only way to read a long card. Everywhere else the drag is swallowed
// so the game keeps its immersive "no page scroll" law.
const GUARD_MARK = "var SCROLL_CARD_IDS = [";
const gStart = html.indexOf(GUARD_MARK);
const gPassive = html.indexOf("{ passive: false },", gStart);
const gTail = html.indexOf(");", gPassive);
ok("touchmove guard block found", gStart > 0 && gPassive > gStart && gTail > gPassive, "chars " + (gTail - gStart + 2));
const guardCode = html.slice(gStart, gTail + 2);

function cardNode(id, kids) {
  return { id, _kids: kids, contains(t) { return this._kids.indexOf(t) >= 0; } };
}
// Real DOM children are Elements too - they carry contains() - so the fake rows do the same.
const leaf = (id) => ({ id, _kids: [], contains() { return false; } });
const creditsRow = leaf("credits-row");
const instrRow = leaf("instructions-row");
const CARDS = {
  creditsBox: cardNode("creditsBox", [creditsRow]),
  instructionsBox: cardNode("instructionsBox", [instrRow]),
};
const street = { id: "game-canvas", contains() { return false; } };
let guardFn = null, guardOpts = null, prevented = 0;
const fakeDoc = {
  getElementById: (id) => CARDS[id] || null,
  addEventListener(ev, fn, opts) { if (ev === "touchmove") { guardFn = fn; guardOpts = opts; } },
};
new Function("document", guardCode)(fakeDoc);
const drag = (target) => ({ target, preventDefault() { prevented++; } });

ok(
  "the guard is registered NON-passive (a passive listener cannot cancel a pan)",
  typeof guardFn === "function" && !!guardOpts && guardOpts.passive === false,
  JSON.stringify(guardOpts),
);
let n0 = prevented; guardFn(drag(CARDS.instructionsBox));
ok("a drag INSIDE the INSTRUCTIONS card is NOT prevented (the phone scrolls it)", prevented === n0, "prevented=" + (prevented - n0));
n0 = prevented; guardFn(drag(instrRow));
ok("a drag on a ROW of the INSTRUCTIONS card is NOT prevented (contains() covers children)", prevented === n0, "prevented=" + (prevented - n0));
n0 = prevented; guardFn(drag(CARDS.creditsBox));
ok("a drag INSIDE the CREDITS card is NOT prevented (credits keeps its scroll)", prevented === n0, "prevented=" + (prevented - n0));
n0 = prevented; guardFn(drag(street));
ok("a drag on the STREET IS prevented (the immersive no-page-scroll law holds)", prevented === n0 + 1, "prevented=" + (prevented - n0));
ok("a drag on a target with no contains() is prevented, never a crash", (function () { let p = 0; guardFn({ preventDefault() { p++; } }); return p === 1; })());

console.log(fails === 0 ? "\nALL INSTRUCTIONS DOM CHECKS PASS" : "\n" + fails + " CHECK(S) FAILED");
process.exit(fails ? 1 : 0);
