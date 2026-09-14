const path = require('path');
global.THREE = require(path.join(__dirname, '_three128.js'));
// Reproduce index.html's tieLeashChain using the REAL THREE quaternion math, then check
// where the bar's two physical ends land (local +X scaled by len, centered at the midpoint).
function tieLeashChain(chain, ax, ay, az, dx, dy, dz){
  const cx2 = ax - dx, cy2 = ay - dy, dz2 = az - dz;
  const len = Math.sqrt(cx2 * cx2 + cy2 * cy2 + dz2 * dz2);
  chain.scale.x = Math.max(0.02, len);
  chain.position.set(dx + cx2 / 2, dy + cy2 / 2, (az + dz) / 2);
  if (len > 1e-4) chain.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0), new THREE.Vector3(cx2, cy2, dz2).normalize());
  return len;
}
// A chain bar is BoxGeometry(1,0.07,0.05): half-length along local X = 0.5 * scale.x.
function ends(chain){
  const m = new THREE.Matrix4().makeRotationFromQuaternion(chain.quaternion);
  const hx = 0.5 * chain.scale.x;
  const e = v => { const q = new THREE.Vector3(v.x, v.y, v.z).applyMatrix4(m).add(chain.position); return q; };
  return { p1: e(new THREE.Vector3(-hx, 0, 0)), p2: e(new THREE.Vector3(hx, 0, 0)) };
}
function near(a, b, tol){ return Math.abs(a.x-b.x)<tol && Math.abs(a.y-b.y)<tol && Math.abs(a.z-b.z)<tol; }
let ok = true;
const chk = (n, c, d) => { console.log((c?'PASS ':'FAIL ')+n+(d?'  '+d:'')); if(!c) ok=false; };

// Case 1: Manhattan - post at (5, 0.9, 1.5), dog at (6.4, 1.9), collar z 0.62
{ const bar = new THREE.Object3D(); const len = tieLeashChain(bar, 5, 0.9, 1.5, 6.4, 1.9, 0.62);
  const e = ends(bar);
  chk('Manhattan: dog end lands ON the collar (6.4,1.9,0.62)', near(e.p1, new THREE.Vector3(6.4,1.9,0.62), 1e-6), 'dogEnd='+JSON.stringify({x:e.p1.x.toFixed(3),y:e.p1.y.toFixed(3),z:e.p1.z.toFixed(3)}));
  chk('Manhattan: anchor end lands ON the post collar (5,0.9,1.5)', near(e.p2, new THREE.Vector3(5,0.9,1.5), 1e-6), 'anchorEnd='+JSON.stringify({x:e.p2.x.toFixed(3),y:e.p2.y.toFixed(3),z:e.p2.z.toFixed(3)}));
  chk('Manhattan: bar is TILTED (length ~1.93, spans dz 0.88)', Math.abs(len-1.933)<0.01, 'len='+len.toFixed(3)+' dz='+(1.5-0.62).toFixed(2));
}
// Case 2: ground doghouse - stake at (10, 6.5, 0.62), dog at (10, 5.9, 0.62) (stake top ~= collar height)
{ const bar = new THREE.Object3D(); tieLeashChain(bar, 10, 6.5, 0.62, 10, 5.9, 0.62);
  const e = ends(bar);
  chk('Ground: dog end ON (10,5.9,0.62)', near(e.p1, new THREE.Vector3(10,5.9,0.62), 1e-6), JSON.stringify({x:e.p1.x.toFixed(2),y:e.p1.y.toFixed(2),z:e.p1.z.toFixed(2)}));
  chk('Ground: anchor end ON (10,6.5,0.62)', near(e.p2, new THREE.Vector3(10,6.5,0.62), 1e-6), JSON.stringify({x:e.p2.x.toFixed(2),y:e.p2.y.toFixed(2),z:e.p2.z.toFixed(2)}));
  chk('Ground: bar is FLAT (constant z 0.62)', Math.abs(e.p1.z-0.62)<1e-6 && Math.abs(e.p2.z-0.62)<1e-6, 'z1='+e.p1.z.toFixed(3)+' z2='+e.p2.z.toFixed(3));
}
// Case 3: degenerate (dog exactly at anchor) - must NOT NaN the quaternion
{ const bar = new THREE.Object3D(); tieLeashChain(bar, 3, 3, 1.5, 3, 3, 0.62);
  const e = ends(bar);
  chk('Degenerate: no NaN when dog == anchor', !isNaN(e.p1.z) && !isNaN(e.p2.z), 'z='+e.p1.z+'/'+e.p2.z);
}
console.log(ok ? '\nLEASH GEOMETRY VERIFIED' : '\nLEASH GEOMETRY FAILED');
process.exit(ok?0:1);
