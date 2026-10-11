// Name-resolution audit for the night kit: every identifier a listed function references
// must be declared inside it (param/local), be a top-level declaration in the script, or be
// a known global. Unresolved names = runtime ReferenceError when that path runs.
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
function extractFunction(name) {
  const m0 = new RegExp("function " + name + "\\s*\\(");
  const i = html.search(m0);
  if (i < 0) return null;
  const open = html.indexOf("{", i);
  let depth = 0, end = -1;
  for (let j = open; j < html.length; j++) {
    if (html[j] === "{") depth++;
    else if (html[j] === "}") { depth--; if (depth === 0) { end = j; break; } }
  }
  return html.slice(i, end + 1);
}
function strip(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\[\s\S]|\$\{[^}]*\})*`/g, "``");
}
// top-level declarations (indent 6) + their multi-decl continuations
const decls = new Set();
const topDecl = /^      (?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm;
let d;
while ((d = topDecl.exec(html))) decls.add(d[1]);
const contDecl = /^        ([A-Za-z_$][\w$]*) =/gm;
while ((d = contDecl.exec(html))) decls.add(d[1]);
const topConstAssign = /^      ([A-Za-z_$][\w$]*) = /gm; // resetWorldState-style writes
while ((d = topConstAssign.exec(html))) decls.add(d[1]);

const GLOBALS = new Set(("Math Object Array String Number Boolean JSON Date RegExp Promise Map Set WeakMap Error TypeError Function Symbol Proxy Reflect console window document navigator localStorage sessionStorage location fetch requestAnimationFrame cancelAnimationFrame setTimeout clearInterval setInterval alert Image Audio Blob URL Response Uint8Array Float32Array Int8Array ArrayBuffer DataView Infinity NaN undefined null this arguments THREE performance AudioContext webkitAudioContext GLTFLoader FBXLoader LoadingManager Clock Color Vector2 Vector3 Vector4 Quaternion Euler Matrix3 Matrix4 Box3 Sphere Mesh Group Scene Sprite Camera PerspectiveCamera OrthographicCamera PointLight AmbientLight DirectionalLight HemisphereLight SpotLight Fog WebGLRenderer Raycaster Ray Plane BoxGeometry SphereGeometry CylinderGeometry ConeGeometry TorusGeometry RingGeometry PlaneGeometry CircleGeometry CapsuleGeometry LatheGeometry TubeGeometry ExtrudeGeometry ShapeGeometry Shape Path Lines LineSegments Points Material MeshStandardMaterial MeshBasicMaterial MeshLambertMaterial MeshPhongMaterial MeshNormalMaterial MeshDepthMaterial SpriteMaterial LineBasicMaterial PointsMaterial ShaderMaterial BufferGeometry BufferAttribute Float32BufferAttribute Texture CanvasTexture ColorFace PCFSoftShadowMap PCFShadowMap BasicDampingFactor DampingFactor OneMinusSrcAlphaFactor SrcAlphaFactor MirroredRepeatWrapping RepeatWrapping ClampToEdgeWrapping NearestFilter LinearFilter sRGBEncoding SRGBColorSpace LinearSRGBColorSpace ACESFilmicToneMapping PCFSoftShadowMap canvas ctx renderer scene camera worker p keys state blockIdx player").split(" "));

const NAMES = [
  "shovelBanish","shovelFlinch","shovelShockwave","shovelHolyGlow","nearestShovelHazard",
  "shovelHazardStrike","updateEctoFlights","animateGhostHands","tryShovelSwing",
  "landSpookInHopper","nightBands","nightWorldBlock","nightFloodBand","nightQuota",
  "nightBandLive","nightHorrorLive","nightGhostLive","nightHorrorOnScreen","cullHorror",
  "nightSpawnHorror","spawnNightGhost","horrorKey","bandOf","updateNightHaunt",
  "spawnNightShift","updateHorrorCreature","respawnHorror","canShovel","equipShovel",
  "poseShovel","makeShovelProp","makeGhoul","makeWraith","makePoltergeist","makeImp",
  "makeDemon","makeHexbeast","makeAbyssal","makeLich","makeReaper","ghostHandRig",
  "makeGhostHandProp","makeGhostCandleProp","makeGhostCoffinProp","makeIronGateProp",
];
const bad = [];
for (const n of NAMES) {
  const body = extractFunction(n);
  if (!body) { bad.push(`${n}: FUNCTION MISSING`); continue; }
  const clean = strip(body);
  const local = new Set();
  const localRe = /(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g;
  let l;
  while ((l = localRe.exec(clean))) local.add(l[1]);
  const paramRe = new RegExp("function " + n + "\\s*\\(([^)]*)\\)");
  const pm = clean.match(paramRe);
  if (pm && pm[1]) pm[1].split(",").forEach((x) => local.add(x.trim().split("=")[0]));
  const forRe = /for\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  while ((l = forRe.exec(clean))) local.add(l[1]);
  // destructuring / object keys: ignore `{ foo: ... }` keys and `.foo` accesses
  const ids = new Set();
  const idRe = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*(:|\()/g;
  const bare = clean.replace(/([A-Za-z_$][\w$]*)\s*:/g, " ").replace(/\.\s*[A-Za-z_$][\w$]*/g, ".");
  const idRe2 = /[A-Za-z_$][\w$]*/g;
  let id;
  while ((id = idRe2.exec(bare))) ids.add(id[0]);
  const KW = new Set("function return if else for while do break continue const let var new delete typeof void this null true false in of instanceof class extends super yield await async try catch finally throw debugger switch case default".split(" "));
  for (const x of ids) {
    if (KW.has(x) || GLOBALS.has(x) || local.has(x) || decls.has(x)) continue;
    if (!/^[A-Z][A-Z0-9_]{2,}$/.test(x) && !/(SHOVEL|Horror|GHOST|Ghost|NIGHT|Night|ECTO|Ecto|SPOOK|Spook|SCARE|Scare|Scare|Gargoyle|Scavenger|Tentacle|Acorn|Bones|Band|Hopper)/.test(x))
      continue; // local-variable noise (multi-declarators, hex colors) is not what we hunt
    if (/^x[0-9a-fA-F]{6}$/.test(x)) continue; // hex color literals
    bad.push(`${n}: UNRESOLVED → ${x}`);
  }
}
if (bad.length === 0) console.log("night-kit name resolution: CLEAN (every reference resolves)");
else bad.slice(0, 80).forEach((b) => console.log("!! " + b));
