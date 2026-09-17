const fs = require("fs");
const path = "c:\\Users\\Marc\\Documents\\GitHub\\Dat-Sh-t-s-Not-Yours-\\index.html";
const s = fs.readFileSync(path, "utf8");
const lines = s.split("\n");
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (
    l.includes("case 'leashdog':{") ||
    l.includes('case "leashdog": {') ||
    l.includes("function updateCreatures") ||
    l.includes("function spawnWorld") ||
    l.includes("function creatureMaxY")
  ) {
    console.log(i + 1, l.trim());
  }
}
