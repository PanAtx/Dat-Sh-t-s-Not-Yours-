// Numerically verify the curb keep-out from the constants/placements in index.html.
// Curb strip (near side): y 0.25..0.75 (top 0.35) | walk concrete: 0.75..5.0.
const fs = require("fs");
const src = fs.readFileSync("index.html", "utf8");
const num = (re) => parseFloat(src.match(re)[1]);
const CU = num(/const CURB_INNER_Y = ([\d.]+)/);
const CC = num(/const CURB_CLEAR = ([\d.]+)/);
const FH = num(/const FOOT_R_HYDRANT = ([\d.]+)/);
const FT = num(/const FOOT_R_TREE = ([\d.]+)/);
const clear = (y, r) => y - r - CU; // distance from the curb face to the footprint edge
const rows = [];
rows.push({
  site: "hydrant (makeBlockContents)",
  yMin: CU + CC + FH,
  yMax: CU + CC + FH,
  r: FH,
  z: 0.3,
});
rows.push({
  site: "sidewalk tree (block + store street)",
  yMin: CU + CC + FT,
  yMax: CU + CC + FT + 0.9,
  r: 0.48,
  z: 0.3,
});
rows.push({
  site: "Maspeth oak (1.65x)",
  yMin: CU + CC + FT * 1.65,
  yMax: CU + CC + FT * 1.65 + 0.6,
  r: 0.48 * 1.65,
  z: 0.3,
});
rows.push({
  site: "leash-dog tree fixture",
  yMin: CU + CC + FT,
  yMax: CU + CC + FT + 0.5,
  r: 0.48,
  z: 0.3,
});
let ok = true;
for (const r of rows) {
  const near = clear(r.yMin, r.r);
  const farEdge = r.yMax + r.r;
  const onStrip = near < 0; // footprint overlaps the curb band
  const onGrass = farEdge > 5.0; // footprint spills past the concrete
  const pass = !onStrip && !onGrass && near >= 0.25;
  if (!pass) ok = false;
  console.log(
    (pass ? "PASS " : "FAIL ") +
      r.site.padEnd(34) +
      " centre y " +
      r.yMin.toFixed(2) +
      ".." +
      r.yMax.toFixed(2) +
      " | footprint " +
      (r.yMin - r.r).toFixed(2) +
      ".." +
      farEdge.toFixed(2) +
      " | curb face 0.75 -> clearance " +
      near.toFixed(2) +
      "u | sits on " +
      (r.z === 0.3 ? "walk deck 0.30" : "curb top 0.35"),
  );
}
// The whole set must stay clear of the curb strip AND of the lawn/stoop line at y 5.0.
console.log(
  "\n" +
    (ok
      ? "ALL FIXTURES STAND OFF THE CURB (>=0.25u of bare concrete) AND ON THE WALK"
      : "CURB KEEP-OUT VIOLATED"),
);
process.exit(ok ? 0 : 1);
