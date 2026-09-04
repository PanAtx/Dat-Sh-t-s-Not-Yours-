// _tric_chk.js — smoke-test the rebuilt makeTricycle(): classic Big Wheel proportions
// (giant front wheel, wide rear wheels), the reference colors (red seat / yellow
// fork / blue trunk+pedals / grey helmet / denim / khaki), a SMALL child rider
// (never adult-sized), everything grounded (z >= 0), anim parts present.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const s = html.indexOf('function makeTricycle(){');
if (s < 0) throw new Error('makeTricycle not found');
const e = html.indexOf('\nfunction ', s + 1);
if (e < 0) throw new Error('end of makeTricycle not found');
const code = html.slice(s, e);

const P = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } });
const M = (c, opt) => ({ c: c });
const MS = (c, opt) => ({ c: c });
const BX = (w, h, d, m) => ({ dim: [w, h, d], mat: m, position: P(), rotation: P(), scale: P() });
const CY = (r1, r2, h, m, seg) => ({ r: r1, dim: [r1, r1, h], mat: m, position: P(), rotation: P(), scale: P() });
const SPH = (r, m, w, h) => ({ r: r, dim: [r, r, r], mat: m, position: P(), rotation: P(), scale: P() });
const THREE = {
  Group: function () { this.position = P(); this.rotation = P(); this.scale = P(); this.children = []; this.userData = {}; },
  Mesh: function (geo, mat) { this.geometry = geo; this.material = mat; this.position = P(); this.rotation = P(); this.scale = P(); this.castShadow = false; }
};
THREE.Group.prototype.add = function (o) { this.children.push(o); return o; };
THREE.CylinderGeometry = function (r1, r2, h, seg) { this.r = r1; this.h = h; };
THREE.BoxGeometry = function (w, h, d) { this.w = w; this.h = h; this.d = d; };
THREE.SphereGeometry = function (r) { this.r = r; };
const pick = a => a[0];
const SKIN_TONES = [0xd8a980];

const g = new Function('THREE', 'M', 'MS', 'BX', 'CY', 'SPH', 'pick', 'SKIN_TONES',
  code + '\n;return makeTricycle();')(THREE, M, MS, BX, CY, SPH, pick, SKIN_TONES);

const all = [g];
const flat = []; // { node, parentZ } — parent z-offset accumulated for world-space grounding
(function walk(o, pz) { (o.children || []).forEach(c => { flat.push({ o: c, pz: pz + (o.position.z || 0) }); walk(c, pz + (o.position.z || 0)); }); })(g, 0);
const meshes = flat.map(f => f.o).filter(o => o.mat || (o.geometry && o.material));
const colors = new Set();
meshes.forEach(o => { const m = o.mat || o.material; if (m && m.c !== undefined) colors.add(m.c); });

// world-space grounding: a part's world z = its own z + the z of every pivot above it
const grounded = flat.filter(f => f.o.mat || (f.o.geometry && f.o.material))
  .every(f => (f.o.position.z || 0) + f.pz >= -1e-6);
const parts = g.userData && g.userData.parts;
// axis check: X forward, Y lateral, Z up — wheels are CY (r = ground radius, positioned at z = r)
const radius = o => (o.r !== undefined ? o.r : (o.geometry && o.geometry.r) || 0);
const wheels = meshes.filter(o => radius(o) > 0.1);
const frontWheel = wheels.filter(o => radius(o) >= 0.30 && o.position.x > 0.3).length;
const rearWheels = wheels.filter(o => radius(o) >= 0.15 && radius(o) < 0.30 && o.position.x < -0.3).length;
const rearSpread = wheels.filter(o => radius(o) >= 0.15 && radius(o) < 0.30 && Math.abs(o.position.y) > 0.2).length;
// child rider is small: top of helmet < 1.0 (adult head is ~1.66+)
const riderTop = Math.max(...meshes.filter(o => o.position.x < 0 && o.position.z > 0.4).map(o => o.position.z));

let pass = true;
const check = (n, c, info) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (c ? '' : '  [' + info + ']')); if (!c) pass = false; };

check('tricycle builds with full geometry', meshes.length >= 15, String(meshes.length));
check('giant Big Wheel front wheel (r >= 0.30) ahead (+X)', frontWheel >= 1, String(frontWheel));
check('two smaller rear wheels behind (-X)', rearWheels >= 2, String(rearWheels));
check('rear wheels spread LATERALLY (|Y| > 0.2), both grounded', rearSpread >= 2, String(rearSpread));
check('red seat body (0xd93b32)', colors.has(0xd93b32), [...colors].map(c => c.toString(16)).join(','));
check('yellow fork / fairing / handlebar (0xf4c522)', colors.has(0xf4c522));
check('blue storage trunk + blue pedals (0x2f6fd0)', colors.has(0x2f6fd0));
check('grey safety helmet (0x5c6167)', colors.has(0x5c6167));
check('denim jacket (0x3f5c86)', colors.has(0x3f5c86));
check('khaki pants (0xb59a66)', colors.has(0xb59a66));
check('child rider is SMALL (top z < 1.0; adult head ~1.66)', riderTop < 1.0, String(riderTop));
check('all parts grounded (z >= 0)', grounded);
check('animParts present (legL/legR/armL/armR joint groups)', !!(parts && parts.legL && parts.legR && parts.armL && parts.armR), JSON.stringify(Object.keys(parts || {})));

console.log(pass ? '\nTRICYCLE REDSIGN PASSED (' + meshes.length + ' meshes)' : '\nTRICYCLE REDSIGN FAILED');
process.exit(pass ? 0 : 1);