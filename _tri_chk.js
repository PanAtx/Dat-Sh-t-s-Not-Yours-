const fs = require('fs');
const t = fs.readFileSync('three_r128.min.js', 'utf8');
const i = t.indexOf('triangulateShape(t,e){');
console.log('--- triangulateShape source ---');
console.log(t.slice(i, i + 700));
// Also confirm the Shape class still has extractPoints in this exact build
const j = t.indexOf('class zl extends');
console.log('--- Shape (zl) source ---');
console.log(t.slice(j, j + 300));
