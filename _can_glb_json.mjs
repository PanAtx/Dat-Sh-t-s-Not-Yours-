// _can_glb_json.mjs — dump the glTF JSON chunk of the can GLB (images / materials / textures)
import fs from 'fs';
import path from 'path';
const FILE = process.argv[2] || 'nyc_can-compressed.glb';
const b = fs.readFileSync(path.join(import.meta.dirname, FILE));
const jsonLen = b.readUInt32LE(8);
const json = JSON.parse(b.toString('utf8', 12, 12 + jsonLen));
const bv = json.bufferViews;
for (const img of json.images || []) {
  const v = bv[img.bufferView];
  console.log('image:', img.name || '(unnamed)', '| mime:', v.mimeType, '| bytes:', v.byteLength, '| idx:', img.bufferView);
}
console.log('\nmaterials:');
for (const m of json.materials || []) {
  const p = m.pbrMetallicRoughness || {};
  console.log('  ', m.name || '(unnamed)',
    '| baseColorFactor:', JSON.stringify(p.baseColorFactor || null),
    '| metallic:', p.metallicFactor, '| roughness:', p.roughnessFactor,
    '| baseColorTex:', p.baseColorTexture ? 'yes' : 'no',
    '| normalTex:', m.normalTexture ? 'yes' : 'no',
    '| metallicRoughTex:', m.metallicRoughnessTexture ? 'yes' : 'no');
}
console.log('\ntextures:', (json.textures || []).length,
  '| bufferViews:', (bv || []).map((v, i) => i + ':' + (v.byteLength || 0) + 'b').join(' '));