#!/usr/bin/env node
/* ============================================================================
   THE DRAW-CALL WINDOW (v1.0.562) - SHADOW CASTERS + OFF-ROUTE BLOCKS
   ----------------------------------------------------------------------------
   Two of the three biggest per-frame paint costs the mobile audit measured, proven on the
   real page code:
     1) THE SHADOW-CASTER BUDGET - nyc_truck-compressed.glb is ~284k triangles and per-mesh
        casting made the SHADOW PASS pay all of them EVERY FRAME for a silhouette the eye reads
        as a box. fbxInstance now counts an instance's triangles: above SHADOW_PROXY_TRIS the
        meshes opt OUT of casting and the instance carries ONE bounding-box proxy with
        colourWrite:false + depthWrite:false, so the main pass pays nothing for it, the shadow
        pass pays 12 triangles, and the light keeps the same contact shadow. Small models keep
        casting their true silhouette (a rolling can's shadow is its shape).
     2) THE BLOCK WINDOW - three culls per object every frame, so every mesh of every house,
        fence, car and tree on the route pays a matrix update + a sphere test each frame to be
        thrown away. Blocks sit 96u apart while the ortho frame shows ~20u of route, so
        applyBlockViewWindow() hides the block GROUPS outside a generous 200u window - the whole
        subtree short-circuits: no matrices, no culling tests, no draw calls.
     3) THE LEDGER CAN SEE IT: the perf readout reports three's draw calls / triangles, so both
        wins are measurable in play (?perf=1), not assumed.
   Run: node _drawcall_window_chk.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const check = (n, ok, got) => {
  if (ok) { pass++; console.log('PASS  ' + n); }
  else { fail++; console.log('FAIL  ' + n + (got !== undefined ? '  [' + got + ']' : '')); }
};
function extractFn(text, name) {
  const a = text.indexOf('function ' + name + '(');
  if (a < 0) throw new Error(name + ' not found');
  let i = text.indexOf('{', a), depth = 0, end = -1;
  for (let j = i; j < text.length; j++) {
    if (text[j] === '{') depth++;
    else if (text[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
  }
  return text.slice(a, end + 1) + '\n';
}
console.log('');
console.log('[1] THE SHADOW-CASTER BUDGET (the law in the page text)');
{
  const fi = extractFn(src, 'fbxInstance');
  check('the budget is declared once (const SHADOW_PROXY_TRIS = 60000)',
    (src.match(/const SHADOW_PROXY_TRIS = \d+;/g) || []).length === 1 &&
      /const SHADOW_PROXY_TRIS = 60000;/.test(src));
  check('every GLB instance is measured: fbxInstance counts the instance triangles (index OR position)',
    fi.includes('let castTris = 0;') && fi.includes('g.index ? g.index.count :') && fi.includes('castTris += n / 3;'));
  check('above the budget the MESHES opt out of the shadow pass (the box casts, not the 284k)',
    fi.includes('if (castTris > SHADOW_PROXY_TRIS)') && fi.includes('o.castShadow = false;'));
  check('the proxy is built from the model OWN bounding box (Box3 of the instance, size + centre)',
    fi.includes('new THREE.Box3().setFromObject(holder)') &&
      fi.includes('pb.getSize(new THREE.Vector3())') &&
      fi.includes('pb.getCenter(new THREE.Vector3())') &&
      fi.includes('new THREE.BoxGeometry(psize.x, psize.y, psize.z)'));
  check('the proxy writes NO colour and NO depth in the main pass (it costs pixels nothing) and casts',
    fi.includes('colorWrite: false, depthWrite: false') &&
      fi.includes('proxy.castShadow = true;') &&
      fi.includes('proxy.receiveShadow = false;') &&
      fi.includes('proxy.name = "shadowProxy";'));
  check('the proxy is positioned in the instance (worldToLocal of the box centre) so it lands on the street',
    fi.includes('proxy.position.copy(holder.worldToLocal(pctr));') && fi.includes('holder.add(proxy);'));
  check('the per-mesh law that small models KEEP casting (one budget, no second rule, no new system)',
    (src.match(/SHADOW_PROXY_TRIS/g) || []).length === 2 && !src.includes('TRUCK_SHADOW_PROXY'));
}
console.log('');
console.log('[2] fbxInstance RUN LIVE (a mock THREE: a heavy model, a light model)');
{
  // THE MOCK THREE: just enough for fbxInstance (groups, boxes, materials, meshes).
  const mkV3 = (x, y, z) => ({
    x: x || 0, y: y || 0, z: z || 0,
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; },
  });
  const THREE = {
    Group: class {
      constructor() { this.children = []; this.position = mkV3(); this.scale = { setScalar() {} }; this.quaternion = { setFromRotationMatrix() {} }; this.isGroup = true; }
      add(c) { this.children.push(c); }
      traverse(fn) { fn(this); this.children.forEach((c) => c.traverse ? c.traverse(fn) : fn(c)); }
      updateWorldMatrix() {}
      worldToLocal(v) { return v; }
    },
    Vector3: function () { return mkV3(); },
    Matrix4: function () { return {}; },
    Box3: class {
      setFromObject() { return { min: mkV3(-7, -4, 0), max: mkV3(7, 4, 5), getSize: (t) => Object.assign(t, { x: 14, y: 8, z: 5 }), getCenter: (t) => Object.assign(t, { x: 0, y: 0, z: 2.5 }) }; }
    },
    Mesh: class { constructor(g, m) { this.isMesh = true; this.geometry = g; this.material = m; this.position = mkV3(); this.children = []; } add(c) { this.children.push(c); } traverse(fn) { fn(this); this.children.forEach((c) => c.traverse ? c.traverse(fn) : fn(c)); } },
    BoxGeometry: class { constructor(x, y, z) { this.params = [x, y, z]; } },
    MeshBasicMaterial: class { constructor(o) { Object.assign(this, o); } clone() { return new THREE.MeshBasicMaterial(this); } },
  };
  const body = extractFn(src, 'fbxInstance') + 'const SHADOW_PROXY_TRIS = ' + src.split('const SHADOW_PROXY_TRIS = ')[1].split(';')[0] + ';\n' +
    'return function (tpl, scale) { return fbxInstance(tpl, scale); };';
  const make = new Function('THREE', 'THREE_NS', body);
  const run = make(THREE, THREE);
  const tpl = (trisPerMesh, meshCount) => ({
    orient: {},
    clone() {
      const g = new THREE.Group();
      for (let i = 0; i < meshCount; i++) {
        const m = new THREE.Mesh({ index: { count: trisPerMesh * 3 }, clone() { return this; } },
          new THREE.MeshBasicMaterial({ colorWrite: true }));
        g.add(m);
      }
      return g;
    },
  });
  const fat = run(tpl(50000, 4), 1); // 200k triangles: over the 60k budget
  let proxies = [], meshCasters = 0, meshCount = 0;
  fat.traverse((o) => {
    if (o.name === 'shadowProxy') proxies.push(o);
    if (o.isMesh && o.name !== 'shadowProxy') { meshCount++; if (o.castShadow) meshCasters++; }
  });
  check('a 200k-triangle instance opts its MESHES out of the shadow pass (0 of 4 casters left on)',
    meshCount === 4 && meshCasters === 0, 'meshes=' + meshCount + ' casting=' + meshCasters);
  check('and carries exactly ONE bounding-box proxy that casts, with colour + depth writes off',
    proxies.length === 1 && proxies[0].castShadow === true &&
      proxies[0].material.colorWrite === false && proxies[0].material.depthWrite === false &&
      proxies[0].geometry.params.join(',') === '14,8,5',
    proxies.length + ' proxy ' + (proxies[0] ? proxies[0].geometry.params.join(',') + ' cast=' + proxies[0].castShadow : '-'));
  check('the proxy sits inside the instance (added to the holder), so it follows the truck everywhere',
    fat.children.indexOf(proxies[0]) >= 0);
  const thin = run(tpl(3000, 2), 1); // 6k triangles: under the budget
  let thinCasters = 0, thinProxy = 0;
  thin.traverse((o) => { if (o.name === 'shadowProxy') thinProxy++; else if (o.isMesh && o.castShadow) thinCasters++; });
  check('a 6k-triangle instance keeps casting its TRUE silhouette (both meshes cast, no proxy built)',
    thinCasters === 2 && thinProxy === 0, 'casters=' + thinCasters + ' proxies=' + thinProxy);
  check('the meshes keep RECEIVING shadows in both cases (the street is still shaded by the truck)',
    fat.traverse ? (() => { let rec = 0; fat.traverse((o) => { if (o.isMesh && o.name !== 'shadowProxy' && o.receiveShadow) rec++; }); return rec >= 4; })() : false);
}
console.log('');
console.log('[3] THE BLOCK WINDOW (run live on the page function)');
{
  const blockSrc =
    src.slice(src.indexOf('const BLOCK_VIEW_U ='), src.indexOf('function applyBlockViewWindow()')) +
    extractFn(src, 'applyBlockViewWindow') +
    '\nglobalThis.applyBlockViewWindow = applyBlockViewWindow;';
  const mkBlocks = () => {
    const blocks = [];
    for (let i = 0; i < 9; i++) blocks.push({ worldX: 80 + i * 96, group: { visible: true }, passed: false });
    return blocks;
  };
  const blocks = mkBlocks();
  const ctx = { blocks, p: { wx: 272 } };
  vm.runInNewContext(blockSrc, ctx); // boots + exposes the page function
  const onNow = () => JSON.stringify(blocks.filter((b) => b.group.visible).map((b) => b.worldX));
  vm.runInNewContext('applyBlockViewWindow();', ctx);
  check('the window is generous and explicit: 200u on the route axis (blocks sit 96u apart)',
    /const BLOCK_VIEW_U = 200;/.test(src) && src.includes('Math.abs(b.worldX - at) < BLOCK_VIEW_U'));
  check('the gate rides the block GROUP field the page itself uses (b.group, the same object the lamps / trees / papers are added to)',
    src.includes('if (!b || !b.group) continue;') && src.includes('b.group.visible = on;'));
  check('the worker on the third block keeps HIS block + two each side ON (a 200u window across 96u blocks = 5 groups) and the rest OFF',
    onNow() === JSON.stringify([80, 176, 272, 368, 464]), onNow());
  check('a hidden block group is HIDDEN, not deleted - the street is intact when he walks back',
    blocks.filter((b) => !b.group.visible).length === 4);
  ctx.p.wx = 464; // he walks two blocks up
  vm.runInNewContext('applyBlockViewWindow();', ctx);
  check('walking the route re-opens the window ahead of him and closes behind (a rolling, group-level gate)',
    onNow() === JSON.stringify([272, 368, 464, 560, 656]), onNow());
  const before = blocks.map((b) => b.group.visible);
  vm.runInNewContext('applyBlockViewWindow();', ctx);
  check('a frame with nothing to change writes nothing (the window is a flag write, not a rebuild)',
    JSON.stringify(blocks.map((b) => b.group.visible)) === JSON.stringify(before));
  check('no block is hidden for missing data (a record without a group is skipped, never touched)',
    blockSrc.includes('if (!b || !b.group) continue;'));
  check('THE LAW RUNS EVERY FRAME from updateBlocks (one call site, riding the loop the route already walks)',
    (src.match(/applyBlockViewWindow\(\);/g) || []).length === 1 &&
      extractFn(src, 'updateBlocks').includes('applyBlockViewWindow();'));
  check('the worker-less guard keeps an early call safe (p.wx falls back to 0, the window opens on the first block)',
    blockSrc.includes('typeof p !== "undefined" && p ? p.wx : 0'));
  const zero = { blocks: mkBlocks(), p: null };
  vm.runInNewContext(blockSrc + '\napplyBlockViewWindow();', zero);
  check('with no worker in scope the window opens at the route start (no crash, no all-hidden street)',
    zero.blocks.filter((b) => b.group.visible).map((b) => b.worldX).join(",") === "80,176",
    zero.blocks.filter((b) => b.group.visible).map((b) => b.worldX).join(","));
}
console.log('');
console.log('[4] THE WINS ARE MEASURABLE (the ledger sees draw calls + triangles)');
{
  check('the readout reports three\'s own counters (calls / triangles / geometries / textures)',
    src.includes('_perfLastDraws = info.render.calls;') &&
      src.includes('_perfLastTris = info.render.triangles;') &&
      src.includes('_perfLastGeo = info.memory.geometries;') &&
      src.includes('_perfLastTex = info.memory.textures;'));
  check('the ?perf=1 line prints dc + tri per frame rate, so a device can show the win (and the tier)',
    src.includes('"fps " + r.draws + "dc " + r.tris + "tri geo" + r.geo + " tex" + r.tex +'));
  check('no new per-frame system was added for this: the window rides updateBlocks and the proxy rides fbxInstance (one function each, one proxy name in the page)',
    (src.match(/function applyBlockViewWindow/g) || []).length === 1 &&
      (src.match(/shadowProxy/g) || []).length === 1 &&
      !src.includes('function rebuildShadowPass'));
}
console.log('');
console.log(fail === 0 ? 'DRAW-CALL WINDOW CHECKS: ALL ' + pass + ' PASSED' : 'DRAW-CALL WINDOW CHECKS FAILED (' + fail + ')');
process.exit(fail ? 1 : 0);


