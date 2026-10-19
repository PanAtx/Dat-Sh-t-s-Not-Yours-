// _curb_bonus_smoke.mjs — run the REAL buildGround() headlessly (THREE mocks) for the OVERTIME
// world (BONUS=true) and a weekday world (BONUS=false), and report every straight curb segment.
import fs from "fs";
const html = fs.readFileSync("index.html", "utf8");
const grabFn = (name) => {
  const i = html.indexOf("function " + name + "(");
  if (i < 0) throw new Error(name + " not found");
  let d = 0,
    j = html.indexOf("{", i);
  for (; j < html.length; j++) {
    if (html[j] === "{") d++;
    else if (html[j] === "}") {
      d--;
      if (d === 0) break;
    }
  }
  return html.slice(i, j + 1);
};
const num = (re) => parseFloat(html.match(re)[1]);
const arr = (re) => eval("[" + html.match(re)[1] + "]");

const BLOCK_W = 8 * num(/const HOUSES_PER_BLOCK = ([\d.]+)/);
const LEVEL_XS = arr(/const LEVEL_XS = \[([^\]]*)\];/);
const LEVEL_BLOCKS = arr(/const LEVEL_BLOCKS = \[([\s\S]*?)\];/);
const BONUS_BLOCK_XS = arr(/const BONUS_BLOCK_XS = \[([^\]]*)\];/);
const BONUS_XS = arr(/const BONUS_XS = \[([^\]]*)\];/);
const BONUS_BLOCK_W = num(/const BONUS_BLOCK_W = ([\d.]+)/);
const BONUS_ROUTE_END_X = num(/const BONUS_ROUTE_END_X = ([\d.]+)/);
const ROUTE_END_X = num(/const ROUTE_END_X = ([\d.]+)/);
const IW = num(/const IW = ([\d.]+)/);
const CROSS_W = num(/const CROSS_W = ([\d.]+)/);
const HW = num(/const QUEENS_HOUSES_PER_BLOCK = ([\d.]+)/);

function runWorld(bonus) {
  const meshes = [];
  const THREE = {
    MeshLambertMaterial: function (o) {
      return { color: (o || {}).color };
    },
    BoxGeometry: function (w, h, d) {
      return { w, h, d };
    },
    Mesh: function (g, m) {
      return {
        geometry: g,
        material: m,
        position: {
          x: 0,
          y: 0,
          z: 0,
          set(a, b, c) {
            this.x = a;
            this.y = b;
            this.z = c;
          },
        },
        receiveShadow: false,
        castShadow: false,
      };
    },
  };
  const groundGroup = {
    add(m) {
      meshes.push(m);
    },
  };
  const src = grabFn("groundStrip") + "\n" + grabFn("buildGround");
  const api = new Function(
    "THREE",
    "groundGroup",
    "meshes",
    "BONUS",
    "LEVEL_BLOCKS",
    "LEVEL_XS",
    "BLOCK_W",
    "IW",
    "CROSS_W",
    "BONUS_BLOCK_XS",
    "BONUS_XS",
    "BONUS_BLOCK_W",
    "BONUS_ROUTE_END_X",
    "ROUTE_END_X",
    "isNightShift",
    "isManhattanLevel",
    "isQueensLevel",
    "isBronxLevel",
    "isBedStuyLevel",
    "isFlatbushLevel",
    "isStatenIslandLevel",
    "NIGHT_FENCE_X",
    "NIGHT_GRAVE_BLOCK_X",
    "QUEENS_CEMETERY_X",
    "CEM_FENCE_Y",
    "CEM_BACK_Y",
    "QUEENS_STORE_CORNERS",
    "pickQueensStoreCorners",
    "FLATBUSH_STORE_W",
    "HOUSES_PER_BLOCK",
    "BW",
    "level",
    "LEVEL_DAYS",
    "routeBlockXs",
    "routeBlockW",
    "buildIntersections",
    "buildFinishLine",
    "activeIntersectionsForNights",
    "NIGHT_XS",
    "NIGHT_GAP_XS",
    src + "\nbuildGround();",
  );
  api(
    THREE,
    groundGroup,
    meshes,
    bonus,
    LEVEL_BLOCKS,
    LEVEL_XS,
    BLOCK_W,
    IW,
    CROSS_W,
    BONUS_BLOCK_XS,
    BONUS_XS,
    BONUS_BLOCK_W,
    BONUS_ROUTE_END_X,
    ROUTE_END_X,
    () => false,
    () => true, // Manhattan ground = the leanest path (no borough extras)
    () => false,
    () => false,
    () => false,
    () => false,
    () => false,
    9999,
    9999,
    288,
    5.4,
    12.0,
    null,
    () => [],
    8,
    7,
    8,
    1,
    [{ borough: "MANHATTAN", area: "GRAMERCY" }],
    () => (bonus ? BONUS_BLOCK_XS.slice() : LEVEL_BLOCKS.map((b) => b.x)),
    () => (bonus ? BONUS_BLOCK_W : BLOCK_W),
    () => {},
    () => {},
    () => {},
    [344],
    [],
  );
  // straight curb = 0.5 x 0.5 box (near side y 0.5, far side y -9.5)
  const curbs = meshes
    .filter((m) => m.geometry.h === 0.5 && m.geometry.d === 0.5 && (m.position.y === 0.5 || m.position.y === -9.5))
    .map((m) => ({
      side: m.position.y === 0.5 ? "near" : "far",
      a: +(m.position.x - m.geometry.w / 2).toFixed(1),
      b: +(m.position.x + m.geometry.w / 2).toFixed(1),
    }));
  return curbs;
}
const report = (label, curbs, gaps, blockW, blockXs) => {
  console.log(`\n[${label}] blocks=${blockXs.join("/")} blockW=${blockW} gaps=${gaps.join("/")}`);
  for (const side of ["near", "far"]) {
    const segs = curbs.filter((c) => c.side === side).sort((x, y) => x.a - y.a);
    console.log(`  ${side} curb:`, segs.map((s) => `${s.a}..${s.b}`).join("  "));
    let bad = 0;
    for (const s of segs)
      for (const g of gaps) {
        const ov = Math.min(s.b, g + IW) - Math.max(s.a, g);
        if (ov > 1.5 + 1e-9) {
          console.log(`    !! ${side} curb ${s.a}..${s.b} runs ${ov.toFixed(1)}u through intersection ${g}..${g + IW}`);
          bad++;
        }
      }
    // each block frontage fully curbed (block -1.5 .. block + blockW +1.5)
    for (const bx of blockXs)
      if (!segs.some((s) => s.a <= bx + 1e-9 && s.b >= bx + blockW - 1e-9)) {
        console.log(`    !! block ${bx}..${bx + blockW} has a BARE stretch of sidewalk (no curb)`);
        bad++;
      }
    console.log(`    ${side}: ${bad === 0 ? "OK — full-length curb on every block, nothing through an intersection" : bad + " problem(s)"}`);
  }
};
report("WEEKDAY (Manhattan path, week grid)", runWorld(false), LEVEL_XS, BLOCK_W, LEVEL_BLOCKS.map((b) => b.x));
report("OVERTIME BASKETS (pinned grid)", runWorld(true), BONUS_XS, BONUS_BLOCK_W, BONUS_BLOCK_XS);
