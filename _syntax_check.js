// Syntax-checks every <script> block in index.html by extracting them and running
// node --check on each. Catches any syntax error introduced by the model-cache edits.
const fs = require('fs');
const { execFileSync } = require('child_process');
const html = fs.readFileSync('index.html', 'utf8');
const re = /<script>([\s\S]*?)<\/script>/g;
let m, i = 0, bad = 0;
const tmp = '_syntax_tmp.js';
while ((m = re.exec(html)) !== null) {
  i++;
  fs.writeFileSync(tmp, m[1]);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log('script block ' + i + ': OK (' + m[1].length + ' chars)');
  } catch (e) {
    bad++;
    const err = (e.stderr ? e.stderr.toString() : e.message);
    console.error('script block ' + i + ': SYNTAX ERROR\n' + err);
  }
}
fs.unlinkSync(tmp);
console.log('\n' + i + ' script blocks checked, ' + bad + ' with errors');
process.exit(bad ? 1 : 0);