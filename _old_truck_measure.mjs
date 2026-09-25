// Measure the OLD truck.fbx's final (game-space) size + key landmarks using the EXACT
// index.html pipeline (fbxInstance + orientTruck + TRUCK_SCALE), so the new nyc_truck.glb
// can be scaled to match. Read-only.
import fs from 'fs';
import * as THREE_NS from 'three';
import fflate from './fflate.min.js';

function fakeEl(){ return { setAttribute(){}, style:{}, addEventListener(){}, removeEventListener(){}, width:0, height:0, src:'' }; }
const THREE = Object.assign(Object.create(null), THREE_NS);
if (THREE.LoaderUtils && typeof THREE.LoaderUtils.decodeText !== 'function'){
  THREE.LoaderUtils.decodeText = function ( data, start, len ) {
    if (typeof data === 'string') return data;
    if (start === undefined) start = 0;
    if (len === undefined) len = data.byteLength - start;
    const bytes = new Uint8Array(data, start, len);
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  };
}
global.THREE = THREE;
global.fflate = fflate;
global.self = global;
global.Blob = class { constructor(parts, opts){ this.parts = parts; this.opts = opts; } };
global.window = global;
global.URL = global.URL || {};
global.URL.createObjectURL = () => 'data:image/png;base64,iVBORw0KGgo=';
global.URL.revokeObjectURL = () => {};
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };

const loaderSrc = fs.readFileSync('FBXLoader.js', 'utf8');
(0, eval)(loaderSrc);
if (typeof THREE.FBXLoader === 'undefined'){ console.error('FAILED: FBXLoader'); process.exit(1); }

const buf = fs.readFileSync('truck.fbx');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const root = new THREE.FBXLoader().parse(ab, '');
console.log('FBX parsed OK; root children:', root.children.length);

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('const TRUCK_SCALE');
const end = html.indexOf('async function loadFbxTemplates', start);
const code = html.slice(start, end);
const test = `
  const truck = fbxFind(root, /garbageTruck_geo_grp/i);
  if (!truck) throw new Error('truck group not found');
  FBX_TPL.truck = fbxExtract(truck); FBX_TPL.truck.orient = orientTruck(FBX_TPL.truck);
  const g = fbxInstance(FBX_TPL.truck, TRUCK_SCALE);
  const bb = new THREE.Box3().setFromObject(g);
  const s = bb.getSize(new THREE.Vector3());
  console.log('OLD TRUCK FINAL  L/W/H = [' + s.x.toFixed(3) + ', ' + s.y.toFixed(3) + ', ' + s.z.toFixed(3) + ']');
  console.log('OLD TRUCK FINAL  min   = [' + bb.min.x.toFixed(3) + ', ' + bb.min.y.toFixed(3) + ', ' + bb.min.z.toFixed(3) + ']');
  console.log('OLD TRUCK FINAL  max   = [' + bb.max.x.toFixed(3) + ', ' + bb.max.y.toFixed(3) + ', ' + bb.max.z.toFixed(3) + ']');
  // street-height lateral reach (the boxW source)
  let tMaxX=0,tMinX=0,tStreet=0; const _v=new THREE.Vector3();
  g.traverse((o)=>{ if(!o.isMesh||!o.geometry||!o.geometry.attributes.position) return;
    const pos=o.geometry.attributes.position;
    for(let i=0;i<pos.count;i++){ _v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);
      if(_v.x>tMaxX)tMaxX=_v.x; if(_v.x<tMinX)tMinX=_v.x;
      if(_v.z<1.6){ const ay=Math.abs(_v.y); if(ay>tStreet)tStreet=ay; } } });
  console.log('boxL (max x-extent) = ' + Math.max(tMaxX, Math.abs(tMinX), 4.0).toFixed(3));
  console.log('street-height body reach tStreet = ' + tStreet.toFixed(3) + ' -> boxW=' + (tStreet>0.5?tStreet:2.9).toFixed(3));
  const comp = fbxFind(g, /compactor/i);
  if (comp){ const cb = new THREE.Box3().setFromObject(comp); const c = cb.getCenter(new THREE.Vector3());
    console.log('hopper/compactor center = [' + c.x.toFixed(3) + ', ' + c.y.toFixed(3) + ', ' + c.z.toFixed(3) + ']  box=[min ' + cb.min.x.toFixed(2)+','+cb.min.y.toFixed(2)+','+cb.min.z.toFixed(2) + ' max ' + cb.max.x.toFixed(2)+','+cb.max.y.toFixed(2)+','+cb.max.z.toFixed(2) + ']'); }
  const fw = fbxFind(g, /wheel_front/i);
  if (fw){ const c = new THREE.Box3().setFromObject(fw).getCenter(new THREE.Vector3());
    console.log('front wheel center = [' + c.x.toFixed(3) + ', ' + c.y.toFixed(3) + ', ' + c.z.toFixed(3) + ']'); }
  const rw = fbxFind(g, /wheel_rear/i);
  if (rw){ const c = new THREE.Box3().setFromObject(rw).getCenter(new THREE.Vector3());
    console.log('rear wheel center  = [' + c.x.toFixed(3) + ', ' + c.y.toFixed(3) + ', ' + c.z.toFixed(3) + ']'); }
  // vertical height profile along X (to see cab vs body vs hopper)
  const N = 12; let minX = bb.min.x, maxX = bb.max.x;
  const prof = [];
  for (let i = 0; i <= N; i++) prof.push([bb.min.x + (bb.max.x - bb.min.x) * i / N, -1e9]);
  g.traverse((o)=>{ if(!o.isMesh||!o.geometry||!o.geometry.attributes.position) return;
    const pos=o.geometry.attributes.position;
    for(let i=0;i<pos.count;i++){ const _v2=_v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);
      const k = Math.min(N, Math.max(0, Math.floor((_v2.x - minX) / ((maxX - minX) / N))));
      if (_v2.z > prof[k][1]) prof[k][1] = _v2.z; } });
  console.log('height profile (x -> max z):');
  prof.forEach(p => console.log('  x=' + p[0].toFixed(2).padStart(6) + '  h=' + p[1].toFixed(2)));
  console.log('hazSpots old = [x -4.918, y -0.299/-0.619/-0.959, z 3.979/4.019/4.079]');
`;
eval(code + '\n' + test);
