// _tools/_shovel_pose_probe.js — reports the idle-carry shovel attitude from index.html:
// where the cutting lip sits vs the street, which way the deep dish opens, hand spread.
const fs = require("fs");
const h = fs.readFileSync("index.html", "utf8");
const s0 = h.indexOf("const SHOVEL_HOLD = {");
const s1 = h.indexOf("max: 1.22", s0);
const HOLD = eval("(" + h.slice(s0 + "const ".length, h.indexOf("}", s1) + 1) + ")");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fist = (side, ex, ey) => ({
  x: -0.52 * Math.sin(ey),
  y: side * 0.29 + 0.52 * Math.sin(ex) * Math.cos(ey),
  z: 1.38 - 0.52 * Math.cos(ex) * Math.cos(ey),
});
const K = HOLD.keys[0];
const r = fist(-1, K.r[0], K.r[1]);
const l = fist(1, K.l[0], K.l[1]);
const d = { x: l.x - r.x, y: l.y - r.y, z: l.z - r.z };
const dm = Math.hypot(d.x, d.y, d.z);
const dn = { x: d.x / dm, y: d.y / dm, z: d.z / dm };
const ey = Math.acos(clamp(dn.x, -1, 1));
const ex = Math.sin(ey) > 1e-4 ? Math.atan2(dn.y, -dn.z) : 0;
const dish = [-Math.sin(ey), -Math.sin(ex) * Math.cos(ey), Math.cos(ex) * Math.cos(ey)]; // tool local +Z in world
const TL = 1.84;
const o = { x: r.x - dn.x * 0.14, y: r.y - dn.y * 0.14, z: r.z - dn.z * 0.14 };
const tip = { x: o.x + dn.x * TL, y: o.y + dn.y * TL, z: o.z + dn.z * TL };
console.log("hand spread:", dm.toFixed(3), "u | rear fist", JSON.stringify(r), "| fwd fist", JSON.stringify(l));
console.log("shaft dir:", dn.x.toFixed(2), dn.y.toFixed(2), dn.z.toFixed(2), "(slope-down carry)");
console.log("tip (axis end) z:", tip.z.toFixed(3), " x:", tip.x.toFixed(2), " ahead");
console.log("cutting lip z ~", (tip.z - 0.115 * dish[2]).toFixed(3), "(street = 0 => riding the ground)");
console.log("dish opening axis (world):", dish.map((v) => v.toFixed(2)).join(","), "=> opens up-and-back toward the worker (shovel-style), blade side to the street");