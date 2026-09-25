// _nyc_truck_chk.mjs — verify the nyc_truck.glb swap (index.html):
//  (0) inline scripts parse, PRELOAD has nyc_truck.glb, loader wired into buildModelTemplates;
//  (1) the REAL index.html pipeline (fbxExtract + orient + fbxInstance + TRUCK_SCALE) builds the
//      truck from the ACTUAL nyc_truck.glb with the local GLTFLoader;
//  (2) final size matches the old truck's footprint (L≈12.39), grounded, proper rotation;
//  (3) KHR_texture_transform is applied by the local loader (map scale ≈ 16);
//  (4) the orange-painted rear (measured in the texture) lands on the -X (rear) side at ~79%
//      height, and the new hazSpots sit on that rear face.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
let ok = true;
const check = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) ok = false;
};

// ---- (0) static checks ----
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let synOk = true;
scripts.forEach((code, i) => { try { new vm.Script(code, { filename: 'inline#' + i }); } catch (e) { synOk = false; console.log('  syntax fail inline#' + i + ': ' + e.message); } });
check('inline script(s) parse (' + scripts.length + ')', synOk);
check('PRELOAD_ASSETS includes nyc_truck.glb (41539564)', html.includes('url: "nyc_truck.glb", size: 41539564'));
check('truck.fbx is no longer a preload asset', !/url: "truck\.fbx"/.test(html));
check('buildModelTemplates calls loadTruckGltf()', /const jobs = \[loadTruckGltf\(\)\]/.test(html));
check('loadTruckGltf routes through getModelUrl', /async function loadTruckGltf\(\)[\s\S]*?getModelUrl\("nyc_truck\.glb"\)/.test(html));
check('hazSpots re-placed on the new rear (x=-5.401 row, z=3.655)', html.indexOf('{ x: -5.401, y: -0.371, z: 3.655') >= 0 && html.indexOf('{ x: -5.401, y: -0.051, z: 3.655') >= 0 && html.indexOf('{ x: -5.401, y: 0.269, z: 3.655') >= 0);
check('hazN is the measured new rear-face normal (-0.99, 0, -0.14)', html.indexOf('new THREE.Vector3(-0.99, 0, -0.14).normalize()') >= 0);
check('TRUCK_SCALE matches old final length (12.39 / 1.8648 = 6.6463)', html.indexOf('const TRUCK_SCALE = 6.6463,') >= 0);

// ---- (1) browser-equivalent harness: local three + local GLTFLoader ----
const THREE = (await import('./_three128.js')).default;
global.THREE = THREE;
global.self = global;
global.window = global;
global.URL = global.URL || {};
global.URL.createObjectURL = () => 'data:,';
global.URL.revokeObjectURL = () => {};
const fakeEl = () => {
  const el = {
    setAttribute(){}, style:{}, width:0, height:0,
    _listeners:{},
    addEventListener(type, fn){ (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener(){},
    set src(v){ this._src = v;
      const fire = (type) => (this._listeners[type] || []).slice().forEach(f => f({ type }));
      setTimeout(() => { this.width = 1; this.height = 1; fire('load'); }, 0);
    },
    get src(){ return this._src; }
  };
  return el;
};
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };
(0, eval)(fs.readFileSync(path.join(DIR, 'GLTFLoader.js'), 'utf8'));
if (typeof THREE.GLTFLoader === 'undefined') { console.error('FAILED: local GLTFLoader'); process.exit(1); }
check('local GLTFLoader loaded (THREE.GLTFLoader)', true);

const gltf = await new Promise((res, rej) => new THREE.GLTFLoader().parse(
  fs.readFileSync(path.join(DIR, 'nyc_truck.glb')).buffer.slice(0), '', res, rej));
check('nyc_truck.glb parses with the local loader', !!gltf && gltf.scene.children.length > 0);
// ---- (2) run the EXACT index.html pipeline block against the real GLB ----
const start = html.indexOf('const TRUCK_SCALE');
const end = html.indexOf('async function loadTruckGltf', start);
const code = html.slice(start, end);
const RESULT = {};
const test = `
  const scene = gltf.scene;
  scene.updateWorldMatrix(true, true);
  const tpl = fbxExtract(scene);
  tpl.orient = new THREE.Matrix4().set(-1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,0,1);
  FBX_TPL.truck = tpl;
  const g = fbxInstance(FBX_TPL.truck, TRUCK_SCALE);
  const bb = new THREE.Box3().setFromObject(g);
  const s = bb.getSize(new THREE.Vector3());
  RESULT.s = s; RESULT.min = bb.min; RESULT.max = bb.max;
  RESULT.det = FBX_TPL.truck.orient.determinant();
  let mapOk = false, meshCount = 0;
  g.traverse((o) => { if (o.isMesh) { meshCount++; const t = o.material && o.material.map; if (t) { const rx = (t.repeat && t.repeat.x) || (t.scale && t.scale.x) || 0; if (Math.abs(rx - 16.0033436) < 0.01) mapOk = true; } } });
  RESULT.meshCount = meshCount; RESULT.mapOk = mapOk;
  RESULT.tpl = tpl;
  let iMesh = null; g.traverse((o) => { if (o.isMesh) iMesh = o; });
  RESULT.iMesh = iMesh;
`;
eval(code + '\n' + test);
const R = RESULT;
console.log('final size L/W/H = [' + R.s.x.toFixed(3) + ', ' + R.s.y.toFixed(3) + ', ' + R.s.z.toFixed(3) + ']  (old truck: 12.394 / 5.851 / 5.049)');
check('final length ≈ old truck (12.39 ±2%)', Math.abs(R.s.x - 12.394) / 12.394 < 0.02, 'L=' + R.s.x.toFixed(3));
check('truck stands upright: H in 3.5-5.5', R.s.z > 3.5 && R.s.z < 5.5, 'H=' + R.s.z.toFixed(3));
check('width plausible (3.0-4.5)', R.s.y > 3.0 && R.s.y < 4.5, 'W=' + R.s.y.toFixed(3));
check('grounded at z=0', R.min.z > -1e-4 && R.min.z < 1e-3, 'min.z=' + R.min.z);
check('centered on origin (x)', Math.abs(R.min.x + R.max.x) < 0.05, 'min.x=' + R.min.x + ' max.x=' + R.max.x);
check('orient is a proper rotation (det +1)', Math.abs(R.det - 1) < 1e-9, 'det=' + R.det);
check('KHR_texture_transform applied (map.scale ≈ 16.003)', R.mapOk, 'mapOk=' + R.mapOk);
check('mesh present in instance', R.meshCount >= 1, 'meshes=' + R.meshCount);

// ---- (4) orange rear + haz spots in game space ----
// Map the native orange center through the instance's actual transform:
// M = (instanceMesh.matrixWorld) * inverse(templateMesh.matrixWorld)
const tMesh = (function(){ let m = null; gltf.scene.traverse(o => { if (o.isMesh) m = o; }); return m; })();
tMesh.updateWorldMatrix(true, true);
const iMesh2 = R.iMesh;
iMesh2.updateWorldMatrix(true, true);
const M = new THREE.Matrix4().copy(iMesh2.matrixWorld).multiply(new THREE.Matrix4().copy(tMesh.matrixWorld).invert());
const orangeGame = new THREE.Vector3(0.793, 0.203, -0.008).applyMatrix4(M);
console.log('orange rear patch -> game space: (' + orangeGame.x.toFixed(3) + ', ' + orangeGame.y.toFixed(3) + ', ' + orangeGame.z.toFixed(3) + ')');
check('orange rear is on the REAR (-X) side', orangeGame.x < -4.5, 'x=' + orangeGame.x.toFixed(3));
check('orange rear at ~79% height (3.3-4.0)', orangeGame.z > 3.3 && orangeGame.z < 4.0, 'z=' + orangeGame.z.toFixed(3));
check('orange rear near center width (|y| < 0.6)', Math.abs(orangeGame.y) < 0.6, 'y=' + orangeGame.y.toFixed(3));
const hazMid = { x: -5.401, y: -0.051, z: 3.655 };
const dHaz = Math.hypot(hazMid.x - orangeGame.x, hazMid.y - orangeGame.y, hazMid.z - orangeGame.z);
check('middle hazard light sits on the orange rear patch (< 0.8u)', dHaz < 0.8, 'd=' + dHaz.toFixed(3));
check('hazard lights inside the truck footprint', Math.abs(hazMid.x) < R.max.x && hazMid.z < R.max.z);

console.log(ok ? '\nNYC TRUCK GLB CHECKS PASSED' : '\nNYC TRUCK GLB CHECKS FAILED');
process.exit(ok ? 0 : 1);