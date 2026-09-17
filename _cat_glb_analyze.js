// Analyze cat_rigged.glb to understand its structure and pose
const fs = require('fs');
const path = require('path');

const glbPath = path.join(__dirname, 'cat_rigged.glb');
if (!fs.existsSync(glbPath)) {
  console.log('GLB file not found:', glbPath);
  process.exit(1);
}

// Read the entire GLB file as binary
const buffer = fs.readFileSync(glbPath);
console.log('GLB file size:', buffer.length, 'bytes');

// GLB structure:
// 0-3: magic "glTF"
// 4-7: version
// 8-11: total length
// Then: chunks (each chunk: type, length, data)

const magic = buffer.slice(0, 4).toString('ascii');
console.log('Magic:', magic);

const version = buffer.readUInt32LE(4);
console.log('Version:', version);

const totalLength = buffer.readUInt32LE(8);
console.log('Total length:', totalLength);

// Find JSON chunk (type 0x4E4F534A = "JSON")
let offset = 12;
let jsonChunk = null;
let binChunk = null;

while (offset < totalLength) {
  const chunkLength = buffer.readUInt32LE(offset);
  const chunkType = buffer.readUInt32LE(offset + 4);
  const chunkTypeName = chunkType === 0x4E4F534A ? 'JSON' :
                        chunkType === 0x004E4942 ? 'BIN ' :
                        chunkType === 0x43524454 ? 'CRDT' :
                        'unknown';
  
  console.log(`Chunk at offset ${offset}: type=${chunkTypeName} (${chunkType.toString(16)}), length=${chunkLength}`);
  
  if (chunkType === 0x4E4F534A) {
    const jsonBytes = buffer.slice(offset + 8, offset + 8 + chunkLength);
    // Pad to 4-byte alignment
    const jsonStr = jsonBytes.toString('utf8').replace(/\u0000/g, '');
    jsonChunk = JSON.parse(jsonStr);
    console.log('Found JSON chunk, parsed successfully');
  } else if (chunkType === 0x004E4942) {
    console.log('Found BIN chunk');
  }
  
  offset += 8 + chunkLength;
}

if (!jsonChunk) {
  console.log('No JSON chunk found');
  process.exit(1);
}

console.log('\n=== GLTF JSON STRUCTURE ===');
console.log('Accessor count:', jsonChunk.accessors ? jsonChunk.accessors.length : 0);
console.log('Animation count:', jsonChunk.animations ? jsonChunk.animations.length : 0);
console.log('Buffer count:', jsonChunk.buffers ? jsonChunk.buffers.length : 0);
console.log('BufferView count:', jsonChunk.bufferViews ? jsonChunk.bufferViews.length : 0);
console.log('Image count:', jsonChunk.images ? jsonChunk.images.length : 0);
console.log('Material count:', jsonChunk.materials ? jsonChunk.materials.length : 0);
console.log('Mesh count:', jsonChunk.meshes ? jsonChunk.meshes.length : 0);
console.log('Node count:', jsonChunk.nodes ? jsonChunk.nodes.length : 0);
console.log('Sampler count:', jsonChunk.samplers ? jsonChunk.samplers.length : 0);
console.log('Scene count:', jsonChunk.scenes ? jsonChunk.scenes.length : 0);
console.log('Skin count:', jsonChunk.skins ? jsonChunk.skins.length : 0);
console.log('Texture count:', jsonChunk.textures ? jsonChunk.textures.length : 0);

if (jsonChunk.meshes) {
  console.log('\n=== MESHES ===');
  for (let i = 0; i < jsonChunk.meshes.length; i++) {
    const mesh = jsonChunk.meshes[i];
    console.log(`Mesh ${i}: ${mesh.name || 'unnamed'} with ${mesh.primitives.length} primitives`);
    for (let j = 0; j < mesh.primitives.length; j++) {
      const prim = mesh.primitives[j];
      const vertexCount = prim.attributes.POSITION ? jsonChunk.accessors[prim.attributes.POSITION].count : 0;
      console.log(`  Primitive ${j}: ${prim.mode === 4 ? 'triangles' : 'other'}, ${vertexCount} vertices`);
    }
  }
}

if (jsonChunk.nodes) {
  console.log('\n=== NODES (bones/joints) ===');
  for (let i = 0; i < jsonChunk.nodes.length; i++) {
    const node = jsonChunk.nodes[i];
    const hasRotation = node.rotation ? true : false;
    const hasTranslation = node.translation ? true : false;
    const hasMesh = node.mesh !== undefined;
    console.log(`Node ${i}: ${node.name || 'unnamed'} (mesh=${hasMesh}, rot=${hasRotation}, trans=${hasTranslation})`);
    if (hasRotation) {
      console.log(`  Rotation: [${node.rotation[0].toFixed(3)}, ${node.rotation[1].toFixed(3)}, ${node.rotation[2].toFixed(3)}, ${node.rotation[3].toFixed(3)}]`);
    }
    if (hasTranslation) {
      console.log(`  Translation: [${node.translation[0].toFixed(3)}, ${node.translation[1].toFixed(3)}, ${node.translation[2].toFixed(3)}]`);
    }
  }
}

if (jsonChunk.skins) {
  console.log('\n=== SKINS ===');
  for (let i = 0; i < jsonChunk.skins.length; i++) {
    const skin = jsonChunk.skins[i];
    console.log(`Skin ${i}: ${skin.name || 'unnamed'}, inverseBindMatrices accessor ${skin.inverseBindMatrices}, joints: ${skin.joints.length}`);
  }
}

if (jsonChunk.animations) {
  console.log('\n=== ANIMATIONS ===');
  for (let i = 0; i < jsonChunk.animations.length; i++) {
    const anim = jsonChunk.animations[i];
    console.log(`Animation ${i}: ${anim.name || 'unnamed'}, ${anim.channels.length} channels`);
    for (let j = 0; j < anim.channels.length; j++) {
      const channel = anim.channels[j];
      console.log(`  Channel ${j}: target node ${channel.target.node}, path=${channel.target.path}`);
    }
  }
}

// Check for scale info on the cat mesh
if (jsonChunk.nodes) {
  console.log('\n=== NODE SCALE INFO ===');
  for (let i = 0; i < jsonChunk.nodes.length; i++) {
    const node = jsonChunk.nodes[i];
    if (node.scale) {
      console.log(`Node ${i} (${node.name}): scale=[${node.scale[0].toFixed(3)}, ${node.scale[1].toFixed(3)}, ${node.scale[2].toFixed(3)}]`);
    }
  }
}

console.log('\n=== ANALYSIS COMPLETE ===');