// Static TDZ audit: top-level `const X = <literal>` statements whose initializer references
// a let/const declared LATER in the same script block (that throws at load time).
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
function strip(code) {
  // remove comments + string/template literal contents so identifier scanning is clean
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\[\s\S]|\$\{[\s\S]*?\})*`/g, "``");
}
const KEYWORDS = new Set(("var let const function return if else for while do break continue switch case default new delete typeof void this null true false in of instanceof class extends super yield await async " +
  "try catch finally throw debugger export import").split(" "));
for (let bi = 0; bi < m.length; bi++) {
  const block = m[bi].replace(/^<script>/, "").replace(/<\/script>$/, "");
  const clean = strip(block);
  // top-level declarations: lines indented exactly 6 spaces at this file's style
  const decls = new Map(); // name -> { line, kind }
  const declRe = /^      (const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm;
  let d;
  while ((d = declRe.exec(clean))) {
    const name = d[2];
    if (!decls.has(name)) decls.set(name, { line: clean.slice(0, d.index).split("\n").length, kind: d[1] });
  }
  // multi-declaration lines: let a = 1,\n b = 2;  -> catch the continuation names
  const contRe = /^        ([A-Za-z_$][\w$]*) =/gm;
  while ((d = contRe.exec(clean))) {
    const ln = clean.slice(0, d.index).split("\n").length;
    const prev = decls.get(d[1]);
    if (!prev) decls.set(d[1], { line: ln, kind: "let" });
  }
  // top-level const/let with an object/array literal initializer
  const stmtRe = /^      (const|let)\s+([A-Za-z_$][\w$]*) = (\{|\[)/gm;
  const offenders = [];
  let s;
  while ((s = stmtRe.exec(clean))) {
    const name = s[2];
    const start = s.index + s[0].length - 1;
    // scan the initializer to its closing bracket at depth 0
    const open = s[3];
    const close = open === "{" ? "}" : "]";
    let depth = 0, end = -1;
    for (let i = start; i < clean.length; i++) {
      const ch = clean[i];
      if (ch === open) depth++;
      else if (ch === close) { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) continue;
    const init = clean.slice(start, end + 1);
    const here = clean.slice(0, s.index).split("\n").length;
    const idRe = /[A-Za-z_$][\w$]*/g;
    let id;
    const seen = new Set();
    while ((id = idRe.exec(init))) {
      const n = id[0];
      if (KEYWORDS.has(n) || seen.has(n)) continue;
      seen.add(n);
      const decl = decls.get(n);
      if (decl && (decl.kind === "const" || decl.kind === "let") && decl.line > here) {
        offenders.push(`line ${here}: ${name} references ${n} (declared line ${decl.line})`);
      }
    }
  }
  console.log(`script block ${bi + 1}: ${offenders.length} TDZ offender(s)`);
  offenders.slice(0, 40).forEach((o) => console.log("   " + o));
}
