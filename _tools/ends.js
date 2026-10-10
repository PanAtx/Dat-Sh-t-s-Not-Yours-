const fs = require("fs");
const html = fs.readFileSync("c:/Users/Marc/Documents/GitHub/Dat-Sh-t-s-Not-Yours-/index.html", "utf8");
const lines = html.split("\n");
function findDeclEnd(startIdx) {
  let count = 0, started = false;
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i].replace(/\/\/.*$/, "");
    for (let j = 0; j < l.length; j++) {
      const c = l[j];
      if (c === "{") { count++; started = true; }
      else if (c === "}") { count--; if (started && count === 0) return i + 1; }
    }
  }
  return -1;
}
const names = [
  "function spawnWorld",
  "function makeBlockContents",
  "function keepCurbBagsOffTree",
  "function spawnBonusLevelPath",
  "function spawnBonus(",
  "function spawnCash",
  "function spawnGhostTreasure",
  "function spawnBonusesInBlock",
  "function makeBag",
  "function makeCan",
  "function makeCurbBox",
  "function makeCurbCan",
  "function addCreature",
];
for (const n of names) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(n) >= 0) console.log("START", i + 1, "END", findDeclEnd(i), "|", lines[i].trim().slice(0, 60));
  }
}
