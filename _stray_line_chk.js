// _stray_line_chk.js — the STRANDED LINE guard (the "Uncaught ReferenceError: b is not
// defined at index.html:32626" class of breakage: the game never boots).
//
// Splicing a big function into a 2.6MB single-file game can leave a function-body line
// sitting OUTSIDE its function at top level. It is perfectly valid SYNTAX — every existing
// syntax check passes — and it dies the moment the script is parsed by the browser, because
// the line references an identifier (`b`, `t`, `f`...) that only exists inside the function.
//
// This suite walks the inline scripts line by line with brace DEPTH tracking (comments and
// string literals stripped, so a brace inside text never lies to us) and fails on any line
// that (a) starts at top-level depth 0, (b) is indented at function-body depth, (c) is a
// complete statement ending in ';', and (d) directly follows the '}' that closed a function.
// It also self-tests the detector on a planted canary, so a scan that reports 0 can be trusted.
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

let pass = 0,
  fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log("PASS  " + name);
  } else {
    fail++;
    failures.push(name + (extra === undefined ? "" : "  [" + extra + "]"));
    console.log("FAIL  " + name + (extra === undefined ? "" : "  [" + extra + "]"));
  }
}
// ---- the scanner ----
function stripLine(line, inBlock) {
  let out = "",
    i = 0;
  while (i < line.length) {
    const c = line[i],
      n = line[i + 1];
    if (inBlock) {
      if (c === "*" && n === "/") {
        inBlock = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (c === "/" && n === "/") break; // line comment: nothing after it carries braces
    if (c === "/" && n === "*") {
      inBlock = true;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      i++;
      while (i < line.length) {
        if (line[i] === "\\") {
          i += 2;
          continue;
        }
        if (line[i] === q) {
          i++;
          break;
        }
        i++;
      }
      out += "S"; // a string is ONE opaque token for brace counting
      continue;
    }
    out += c;
    i++;
  }
  return { code: out, inBlock };
}
function delta(code) {
  let d = 0;
  for (const ch of code) {
    if (ch === "{") d++;
    else if (ch === "}") d--;
  }
  return d;
}
function scan(source) {
  const lines = source.split("\n");
  const coded = [];
  let depth = 0,
    inBlock = false;
  lines.forEach((line) => {
    const r = stripLine(line, inBlock);
    inBlock = r.inBlock;
    coded.push({ code: r.code, indent: line.match(/^\s*/)[0].length, startsAt: depth });
    depth = Math.max(0, depth + delta(r.code));
  });
  const strays = [];
  coded.forEach((cur, i) => {
    const text = cur.code.trim();
    if (cur.startsAt !== 0 || cur.indent < 8 || !text.endsWith(";")) return;
    let j = i - 1;
    while (j >= 0 && !coded[j].code.trim().length) j--;
    if (j < 0) return;
    const prev = coded[j],
      prevText = prev.code.trim();
    if (prev.startsAt === 1 && prevText.endsWith("}") && delta(prev.code) === -1)
      strays.push(i + 1 + ": " + text.slice(0, 88));
  });
  return { strays, endDepth: depth };
}
// ---- [1] the detector proves itself on a planted canary (a scan of 0 means something) ----
console.log("[1] THE DETECTOR: it catches a function-body line stranded at top level");
const CANARY = [
  "      function host(a) {",
  "        const k = a.hp;",
  "        return k;",
  "      }",
  "",
  "        a.heartOpen += (wantOpen - a.heartOpen) * Math.min(1, dt * 9);",
  "      // the next real thing starts here",
  "      function nextThing(b) {",
  "        return b;",
  "      }",
].join("\n");
const canary = scan(CANARY);
check(
  "a stranded line after a closed function is CAUGHT (" + (canary.strays[0] || "none") + ")",
  canary.strays.length === 1 && /heartOpen/.test(canary.strays[0]),
  "found=" + canary.strays.length,
);
const CLEAN = [
  "      function host(a) {",
  "        return a;",
  "      }",
  "",
  "      const MULTI = {",
  "        a: 1,",
  "        b: 2,",
  "      };",
  "      const arr = [",
  "        { x: 0 },",
  "        { x: 1 },",
  "      ];",
  "      function braceInText() {",
  '        return "just } a { string";',
  "      }",
  "      // \"braces in a comment { }\" stay invisible to the walk",
].join("\n");
const clean = scan(CLEAN);
check(
  "top-level CONTINUATION lines (multi-line objects/arrays/args) are NOT false alarms, and braces inside strings/comments are ignored",
  clean.strays.length === 0 && clean.endDepth === 0,
  "flags=" + clean.strays.join(" | "),
);

// ---- [2] the shipped file: every inline script, walked to the end ----
console.log("\n[2] index.html: every inline script walked brace-by-brace");
const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
// The shipped page has THREE inline scripts: the service-worker registration, the three.js
// "OFFLINE SAFETY NET" (the local-copy fallback in the head) and the game itself. The count is
// a floor, not a ceiling: a new inline block must never silently drop the ones that are there.
check(
  "the file carries all three inline script blocks (sw-register, three.js net, the game)",
  scripts.length === 3 &&
    scripts.some((s) => s.includes("navigator.serviceWorker.register")) &&
    scripts.some((s) => s.includes("three_r128.min.js")) &&
    scripts.some((s) => s.includes("const SFX = {")),
  "blocks=" + scripts.length,
);
scripts.forEach((code, i) => {
  const r = scan(code);
  check(
    "inline script #" +
      i +
      " (" +
      code.split("\n").length +
      " lines) has ZERO stranded function-body lines at top level and balances to depth 0",
    r.strays.length === 0 && r.endDepth === 0,
    "endDepth=" + r.endDepth + (r.strays.length ? " 1st=" + r.strays[0] : ""),
  );
});
// the whole file parses too (the crash the player saw was NOT a syntax error — so this
// check alone never catches it; the walk above is what does)
try {
  scripts.forEach((code, i) => new (require("vm").Script)(code, { filename: "inline#" + i }));
  check("both inline scripts still PARSE (the guard is complementary: parse + structure)", true);
} catch (e) {
  check("both inline scripts still PARSE (the guard is complementary: parse + structure)", false, e.message);
}

// ---- [3] the boss fight specifically: the functions the Midnight splice rewrote ----
console.log("\n[3] THE SLUG DEMON splice: each boss function is a complete, standalone unit");
const BOSS_FNS = [
  "makeTentacleBoss", "animateNightBoss", "updateNightBoss", "updateNightBossFight",
  "spawnBossFireball", "killBossFireball", "updateBossFireballs", "bossWhipStrike",
  "bossShovelTargetable", "bossShovelRange", "bossTakeShovelSwing", "bossTakeArmourSwing",
  "bossArmourBite", "bossShovelHit", "bossAngryTarget", "bossFuryOf", "bossIsFurious",
  "bossHeartOpen", "bossHeartOpenT", "bossHeartCloseT", "bossFireShots", "bossFireGap",
  "bossGutDistance", "bossBrushed",
  "bossArmMuzzle", "killNightBoss", "bossBlownUp", "spawnNightBoss", "clearNightBoss",
  // THE SCURRY, THE BOOM AND THE SLIME (the wound's run, the blow-up, the goop it leaves)
  "nightSlimeBlob", "spawnBossSlime", "coatInSlime", "nightSlimeClear",
  "startBossFight", "grabBossGargoyle", "spawnBossGargoyle",
  // THE BOSS RING: the rig's fence floor, the ghost iron, and its whole lifecycle
  "nightSealClosed", "sealFaceX", "sealStandX", "workerCeilX", "truckFenceFloorX", "makeGhostIronFence", "buildNightSeal",
  "nightSealClear", "nightSealArm", "nightSealClose", "nightSealDrop", "nightSealSay",
  "updateNightSeal",
];
const fnSrc = (name) => {
  const at = html.indexOf("function " + name + "(");
  if (at < 0) throw new Error("function not found: " + name);
  let i = html.indexOf("{", at),
    d = 0;
  for (; i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") {
      d--;
      if (!d) return html.slice(at, i + 1);
    }
  }
  throw new Error("unbalanced: " + name);
};
// the whole-file walk, kept so each declaration's DEPTH and indentation can be read back out
// (the GAME script — the biggest block — not the sw-register / three.js net in the head)
const bigCode = scripts.reduce((a, b) => (b.length > a.length ? b : a), "");
const codedBig = [];
{
  let depth = 0,
    inBlock = false;
  bigCode.split("\n").forEach((line) => {
    const r = stripLine(line, inBlock);
    inBlock = r.inBlock;
    codedBig.push({ code: r.code, indent: line.match(/^\s*/)[0].length, startsAt: depth });
    depth = Math.max(0, depth + delta(r.code));
  });
}
function declPlace(name) {
  for (let i = 0; i < codedBig.length; i++) {
    const t = codedBig[i].code.trim();
    if (t.startsWith("function " + name + "("))
      return { line: i + 1, indent: codedBig[i].indent, startsAt: codedBig[i].startsAt };
  }
  return null;
}
// the reference: the boss functions that were NEVER relocated by this work
const ANCHOR = ["spawnNightBoss", "clearNightBoss", "startBossFight", "killNightBoss", "bossWhipStrike"]
  .map(declPlace)
  .filter(Boolean);
const anchorIndent = ANCHOR.length ? ANCHOR[0].indent : 6;
const anchorDepth = ANCHOR.length ? ANCHOR[0].startsAt : 0;

let bad = [];
const placed = [];
for (const n of BOSS_FNS) {
  try {
    const s = fnSrc(n);
    new (require("vm").Script)(s, { filename: n });
    const p = declPlace(n);
    if (!p) bad.push(n + " (declaration line not found)");
    else placed.push(p);
    // the body must be complete: its braces net to zero and it closes with '}'
    const body = s.slice(s.indexOf("{") + 1, s.lastIndexOf("}"));
    let d = 0,
      ib = false;
    for (const l of body.split("\n")) {
      const r = stripLine(l, ib);
      ib = r.inBlock;
      d += delta(r.code);
    }
    if (d !== 0) bad.push(n + " (its body nets " + d + " unbalanced braces)");
    if (!s.trimEnd().endsWith("}")) bad.push(n + " (does not close with '}')");
  } catch (e) {
    bad.push(n + " (" + e.message + ")");
  }
}
check(
  "all " + BOSS_FNS.length + " boss functions extract WHOLE and parse on their own",
  bad.filter((b) => /unbalanced|not found|Unexpected|Invalid/.test(b)).length === 0,
  bad.slice(0, 3).join(" | "),
);
check(
  "every boss function sits on the SAME nesting level as its untouched neighbours (indent " +
    anchorIndent +
    ", depth " +
    anchorDepth +
    ") — nothing was spliced into the wrong scope",
  placed.length === BOSS_FNS.length &&
    placed.every((p) => p.indent === anchorIndent && p.startsAt === anchorDepth),
  placed
    .filter((p) => p.indent !== anchorIndent || p.startsAt !== anchorDepth)
    .map((p) => p.line + "@indent" + p.indent + "/depth" + p.startsAt)
    .slice(0, 4)
    .join(" | "),
);
check(
  "THE HEART WINDOW LINES LIVE INSIDE updateNightBoss (the exact line that crashed now runs in scope)",
  (() => {
    const s = fnSrc("updateNightBoss");
    return (
      s.includes('const wantOpen = b.heartState === "open" ? 1 : 0;') &&
      s.includes("b.heartOpen += (wantOpen - b.heartOpen) *") &&
      s.indexOf("b.heartOpen +=") > s.indexOf("const wantOpen")
    );
  })(),
);

console.log("\n" + pass + " stray-line checks passed" + (fail ? ", " + fail + " FAILED" : " \u2014 all OK"));
if (fail) {
  console.log(failures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}

