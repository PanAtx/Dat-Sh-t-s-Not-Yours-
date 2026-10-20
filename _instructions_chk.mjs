// _instructions_chk.mjs — parses index.html, syntax-checks every inline script,
// and asserts the INSTRUCTIONS card's markup (ids, tags, section order).
import fs from "fs";
const h = fs.readFileSync("index.html", "utf8");
let fails = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? "PASS  " : "FAIL  ") + name + (extra ? "  [" + extra + "]" : ""));
  if (!cond) fails++;
};

// 1) every inline script parses
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, n = 0, bad = 0;
while ((m = re.exec(h))) {
  n++;
  try { new Function(m[1]); } catch (e) { bad++; console.log("   SYNTAX script#" + n + ": " + e.message); }
}
ok("inline scripts parse (" + n + " total)", bad === 0, bad ? bad + " bad" : "clean");

// 2) every id the instructions JS touches exists exactly once in the markup
["btnInstructions", "btnInstructionsClose", "instructionsPage", "instructionsBox", "instructionsHead", "btnCredits", "creditsPage"].forEach((id) => {
  const c = (h.match(new RegExp('id="' + id + '"', "g")) || []).length;
  ok("id #" + id + " present once", c === 1, "x" + c);
});

// 3) the instructions card region balanced
const s = h.indexOf('<div id="instructionsPage"');
const e = h.indexOf('<div id="iosfs"');
ok("card region found", s > 0 && e > s, "chars " + (e - s));
const region = h.slice(s, e);
const opens = (region.match(/<div\b/g) || []).length;
const closes = (region.match(/<\/div>/g) || []).length;
// The region ends with the stray `></div>` that closes #menu itself (it opened upstream),
// so the card's own divs must balance with exactly ONE extra close.
ok("card <div>/</div> balanced", closes === opens + 1, "open " + opens + " close " + closes);
ok("no leftover build marker", region.indexOf("INS-SEC") < 0);
ok("opens hidden (menu-only)", /<div id="instructionsPage" class="hidden">/.test(region));

// 4) the required content law
[
  ["95%", /at least 95% of everything on it/],
  ["95% write-up", /Failed to clean route\. Work left out\./],
  ["3 write-ups", /THREE WRITE-UPS = SUSPENDED/],
  ["keyboard keys", /W A S D[\s\S]{0,400}SPACE<\/span> or <span class="kbd">E/],
  ["no test keys (T/L/R/H/J rows)", !/e\.code === "Key[TLRHJ]/.test(region)],
  ["gamepad usb/bluetooth", /USB pad[\s\S]{0,80}Bluetooth/],
  ["gamepad stick + dpad", /LEFT STICK &#183; D-PAD/],
  ["start + select quit", /START \+ SELECT<\/b> quits to the menu/],
  ["virtual gamepad", /VIRTUAL GAMEPAD \(TOUCH\)/],
  ["mongo", />MONGO<\/span>/],
  ["treasure", /TREASURE/],
  ["street cash", /STREET CASH/],
  ["healer money step", /every \$5,000 of STREET CASH/],
  ["red bull money step", /every \$30,000 of SCORE/],
  ["red bull effect", /12 seconds of total immunity/],
  ["red bull speed", /30% faster/],
  ["dog shit slows", /brown shoe-print trail[\s\S]{0,120}about a quarter slower/],
  ["cheats void hi-score", /HI-SCORE IS NEVER SAVED/],
  ["the rig's rear is the HOPPER (the word 'scoop' never appears on the card)", !/scoop/i.test(region) && /open rear hopper/.test(region)],
  ["infinite complaints is explained as written", /With <b>Infinite Complaints<\/b> ON, the complaints genuinely stop stacking[\s\S]{0,600}meter does not climb/],
  ["infinite complaints never ends the shift", /No 3rd strike, no suspension: the shift runs on/],
  ["infinite complaints clears no existing strike", /The row clears nothing that is already on the record/],
  ["the 3-strike law is stated for a cheat-free run", /with the row <b>OFF<\/b> the three-strike law is plain: 3 write-ups = SUSPENDED/],
  ["the NO STRIKE RECORDED seal line is quoted", /&#8220;NO STRIKE RECORDED&#8221;/],
  ["the REFRESH law is on the card (a reload hands back a clean, eligible sheet)", /A REFRESH CLEANS THE SHEET[\s\S]{0,600}every row at its default[\s\S]{0,400}HI-SCORE is <b>saveable again<\/b>/],
  ["quitting to the menu is NOT a refresh", /Quitting to the main menu is <b>not<\/b> a refresh/],
  ["no flag survival claim anywhere on the card", !/flag survives/i.test(region)],
  ["offline cache", /the game and the station play <b>with no network at all<\/b>/],
  ["cache badge", /OFFLINE READY/],
  ["per-level NPCs: Monday", /MONDAY &#183; MANHATTAN, GRAMERCY PARK/],
  ["per-level NPCs: Tuesday", /TUESDAY &#183; THE BRONX, MOTT HAVEN/],
  ["per-level NPCs: Wednesday", /WEDNESDAY &#183; BROOKLYN, FLATBUSH/],
  ["per-level NPCs: Thursday", /THURSDAY &#183; QUEENS, MASPETH/],
  ["per-level NPCs: Friday", /FRIDAY &#183; STATEN ISLAND, NEW DORP/],
  ["per-level NPCs: Saturday", /SATURDAY &#183; MANHATTAN, HARLEM/],
  ["per-level NPCs: Sunday", /SUNDAY &#183; BROOKLYN, BED-STUY/],
  ["midnight NOT listed", !/MIDNIGHT[^<]{0,40}<\/span>\s*<\/div>\s*<div class="cr-sec">/.test(region) && !/banshee|poltergeist|hellhound/.test(region)],
].forEach(([name, law]) => ok(name, law === true || (law.source ? law.test(region) || law.test(h) : law)));

// 5) the cr-sec / cr-row shapes (clean credits typography)
const secs = (region.match(/class="cr-sec">([^<]*)</g) || []).map((x) => x.replace(/.*">/, "").replace(/<$/, ""));
const rows = (region.match(/class="cr-row">/g) || []).length;
const names = (region.match(/class="cr-name">/g) || []).length;
const creds = (region.match(/class="cr-cred">/g) || []).length;
ok("sections + rows shaped", secs.length > 6 && rows === names && rows === creds, secs.length + " sections / " + rows + " rows / " + names + " names / " + creds + " creds");
console.log("SECTIONS:");
secs.forEach((x) => console.log("   - " + x));

// 6) the button sits in the logo frame under © (CSS top uses the credits button size)
ok("book button CSS anchors under credits", /#btnInstructions \{[\s\S]{0,200}top: calc\(8px \+ clamp\(38px, 5vh, 48px\) \+ 6px\)/.test(h));
ok("book button shares the gear/credits skin", /#btnSettings,\s*\n\s*#btnInstructions,\s*\n\s*#btnCredits \{/.test(h));
ok("book button opens the page (JS wired)", /\$\("btnInstructions"\)\.addEventListener\("click", openInstructions\)/.test(h));
ok("book icon is an open book (svg paths)", /<button id="btnInstructions"[\s\S]{0,400}<svg viewBox="0 0 24 24"[\s\S]*?Z"\/><\/svg>/.test(h));

console.log(fails === 0 ? "\nALL INSTRUCTIONS CHECKS PASS" : "\n" + fails + " CHECK(S) FAILED");
process.exit(fails ? 1 : 0);
