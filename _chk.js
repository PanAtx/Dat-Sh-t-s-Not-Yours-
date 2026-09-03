// Extract inline <script> blocks (no src) from index.html and syntax-check each as a script.
const fs = require('fs');
const { execFileSync } = require('child_process');
const html = fs.readFileSync('index.html', 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0, fail = 0;
while ((m = re.exec(html))) {
  i++;
  const f = `_chk_script_${i}.js`;
  fs.writeFileSync(f, m[1]);
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    console.log('script ' + i + ': SYNTAX OK (' + m[1].length + ' chars)');
  } catch (e) {
    fail++;
    console.log('script ' + i + ': SYNTAX ERROR\n' + e.stderr.toString());
  }
  fs.unlinkSync(f);
}
console.log('checked ' + i + ' script block(s), failures: ' + fail);
process.exit(fail ? 1 : 0);

