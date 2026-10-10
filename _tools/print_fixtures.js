// Print the hydrant + sidewalk-tree builders and every placement site.
const fs = require("fs");
const src = fs.readFileSync("index.html", "utf8");
const show = (label, start, len) => {
  const i = src.indexOf(start);
  console.log("===== " + label + " @ " + i + " =====");
  console.log(src.slice(i, i + len));
  console.log();
};
show("makeHydrantMesh", "function makeHydrantMesh", 4400);
show("addHydrant", "function addHydrant", 1500);
show("makeSidewalkTree", "function makeSidewalkTree", 3000);
