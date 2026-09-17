const fs = require("fs");
const path = "c:\\Users\\Marc\\Documents\\GitHub\\Dat-Sh-t-s-Not-Yours-\\index.html";
const s = fs.readFileSync(path, "utf8");
const lines = s.split("\n");
lines.forEach((l, i) => {
  if (l.includes("isManhattanLevel() || isBronxLevel()")) {
    console.log(i + 1, l.trim());
  }
});
