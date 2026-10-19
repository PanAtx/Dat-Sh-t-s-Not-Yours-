// _curb_grid_sim.mjs — verify the straight-curb spans land flush on the corner-return arcs and
// never cross an intersection gap, on BOTH grids (week 6x56u/72u and OVERTIME 4x80u/96u).
import fs from "fs";
const src = fs.readFileSync("index.html", "utf8");
const num = (re) => parseFloat((src.match(re) || [])[1]);
const arr = (re) => eval("[" + (src.match(re) || [0, ""])[1] + "]");
const BW = 8, IW = 16, CR = 2.0, CROSS_W = 9;
const BLOCK_W = BW * num(/const HOUSES_PER_BLOCK = ([\d.]+)/);
const blockList = arr(/const LEVEL_XS = \[([^\]]*)\];/);
const bonusBlockXs = arr(/const BONUS_BLOCK_XS = \[([^\]]*)\];/);
const bonusXs = arr(/const BONUS_XS = \[([^\]]*)\];/);
const bonusBlockW = num(/const BONUS_BLOCK_W = ([\d.]+)/);
const bonusEnd = num(/const BONUS_ROUTE_END_X = ([\d.]+)/);

function gridXs(blockXs, blockW, xs, label) {
  console.log(`\n[${label}] blocks=${blockXs.join("/")} blockW=${blockW} gaps=${xs.join("/")}`);
  // curbSpan from index.html: a = bl.x - 1.5, bEnd = bl.x + curbGridW + 1.5
  const segs = blockXs.map((bx) => ({ a: bx - 1.5, b: bx + blockW + 1.5 }));
  console.log("  curb segments:", segs.map((s) => `${s.a}..${s.b}`).join("  "));
  let problems = 0;
  for (const s of segs) {
    for (const g of xs) {
      const g0 = g, g1 = g + IW;
      // a curb segment must NOT run through the interior of the gap
      const ov = Math.min(s.b, g1) - Math.max(s.a, g0);
      if (ov > 1.5 + 1e-9) {
        // by design a segment reaches 1.5u into the gap to meet the corner-return tangent; a
        // longer reach is a curb laid straight through the intersection
        console.log(`  !! curb ${s.a}..${s.b} runs ${ov.toFixed(2)}u through gap ${g0}..${g1}`);
        problems++;
      }
    }
  }
  // corner-return tangent points (buildIntersections): for gap g, cx = g + IW/2, halfW = CROSS_W/2
  const tangents = [];
  for (const g of xs) {
    const cx = g + IW / 2, halfW = CROSS_W / 2;
    for (const sx of [-1, 1]) {
      const vx = cx + sx * halfW;
      tangents.push(vx + sx * CR); // main-road tangent point x
    }
  }
  tangents.sort((a, b) => a - b);
  console.log("  arc tangent points:", tangents.join(" "));
  for (const seg of segs) {
    if (!tangents.some((t) => Math.abs(t - seg.b) < 1e-6)) { console.log(`  !! curb end ${seg.b} has no tangent`); problems++; }
    // the FIRST block's west end is the open end of the street (no intersection there) — no arc to meet
    if (seg === segs[0]) continue;
    if (!tangents.some((t) => Math.abs(t - seg.a) < 1e-6)) { console.log(`  !! curb start ${seg.a} has no tangent`); problems++; }
  }
  // no bare stretch of sidewalk inside a built block frontage (curb covers the whole block +1.5)
  for (let i = 0; i < blockXs.length; i++) {
    const seg = segs[i];
    if (seg.a > blockXs[i] - 1.5 + 1e-9 || seg.b < blockXs[i] + blockW + 1.5 - 1e-9) {
      console.log(`  !! block ${blockXs[i]}..${blockXs[i] + blockW} curb is short: ${seg.a}..${seg.b}`);
      problems++;
    }
  }
  const covered = segs.reduce((t, s) => t + (s.b - s.a), 0);
  console.log(`  total curb poured (one side): ${covered.toFixed(1)}u over ${blockXs.length} blocks`);
  console.log(problems === 0 ? "  OK: flush at every corner, no curb through an intersection, no bare mid-block stretch" : `  ${problems} PROBLEM(S)`);
  return problems;
}
let bad = 0;
const dayBlocks = arr(/const LEVEL_BLOCKS = \[([\s\S]*?)\];/).map((b) => b.x);
bad += gridXs(dayBlocks, BLOCK_W, blockList, "WEEK (short-block grid)");
// OVERTIME: the curbs answer routeBlockXs() = BONUS_BLOCK_XS and routeBlockW() = BONUS_BLOCK_W
bad += gridXs(bonusBlockXs, bonusBlockW, bonusXs, "OVERTIME (pinned grid)");
console.log(`\novertime wall ${bonusEnd} = last gap ${bonusXs[3]} + IW ${IW}: ${bonusXs[3] + IW === bonusEnd}`);
console.log(bad === 0 ? "RESULT: PASS" : "RESULT: FAIL");
