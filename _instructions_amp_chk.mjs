// _instructions_amp_chk.mjs — every ampersand in the INSTRUCTIONS card must be a real
// character reference (&#nnn; / &name; / &frac12;), never a bare "&" the browser will
// render as text, and no raw non-entity "&" in the head/rows.
import fs from "fs";
const h = fs.readFileSync("index.html", "utf8");
const s = h.indexOf('<div id="instructionsPage"');
const e = h.indexOf('<div id="iosfs"');
const region = h.slice(s, e);
const bad = [];
const re = /&(?!#?\w+;)/g;
let m;
while ((m = re.exec(region))) {
  const line = region.slice(0, m.index).split("\n").length;
  bad.push("line +" + line + ": " + region.slice(Math.max(0, m.index - 45), m.index + 25).replace(/\n/g, " "));
}
console.log(bad.length === 0 ? "PASS  no bare ampersands in the instructions card" : "FAIL  bare ampersands:");
bad.slice(0, 20).forEach((b) => console.log("   " + b));
// no raw smart-quote characters (the card is all entities, like the credits card)
const raw = /[‘’“”–—]/g;
const rawHits = (region.match(raw) || []).length;
console.log(rawHits === 0 ? "PASS  no raw smart quotes / em dashes (entity-only copy)" : "NOTE  " + rawHits + " raw typographic chars (em-dash / smart quotes) in the card");
console.log(bad.length === 0 ? "\nAMPERSAND LAW HOLDS" : "\nAMPERSAND LAW BROKEN");
process.exit(bad.length ? 1 : 0);