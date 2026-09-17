const fs = require("fs");
const path = "c:\\Users\\Marc\\Documents\\GitHub\\Dat-Sh-t-s-Not-Yours-\\index.html";
let src = fs.readFileSync(path, "utf8");

function extractFn(s, name) {
  const start = s.indexOf("function " + name + "(");
  if (start < 0) throw new Error(name + " not found");
  let i = s.indexOf("{", start), depth = 0;
  for (; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return { text: s.slice(start, i + 1), end: i + 1 };
}

function copyRename(find, newName, noteLines) {
  const { text, end } = extractFn(src, find);
  const comment = noteLines.join("\n") + "\n";
  const renamed = text.replace(
    "function " + find.replace("function ", "") + "(",
    "function " + newName + "(",
  );
  const insertion = comment + renamed;
  src = src.slice(0, end) + "\n" + insertion + src.slice(end);
}

copyRename(
  "makeHighPolyDog",
  "makeBronxLeashDog",
  [
    "      // Bronx-exclusive COPY of makeHighPolyDog. The Bronx uses its own leashed-dog",
    "      // model so it can be modified without ever touching Manhattan's makeHighPolyDog.",
    "      // Geometry is identical for now; the Bronx builds NO doghouse — the chain ties",
    "      // to a sidewalk fixture instead (see spawnWorld + tieBronxLeashChain).",
  ],
);

copyRename(
  "tieLeashChain",
  "tieBronxLeashChain",
  [
    "      // Bronx-exclusive COPY of tieLeashChain. Same rigid 3D chain orientation; kept",
    "      // separate so the Bronx chain geometry can be modified without affecting Manhattan.",
  ],
);

fs.writeFileSync(path, src);
console.log("copies inserted");
