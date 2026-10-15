import fs from 'fs';
const f = process.argv[2], needle = process.argv[3];
const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
lines.forEach((l, i) => {
  if (l.includes(needle)) console.log(`${i + 1}: ${l.trim().slice(0, 150)}`);
});