const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('index.html', 'utf8');
// Extract all inline <script> blocks and syntax-check each.
const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0, ok = true;
while ((m = re.exec(src)) !== null) {
  i++;
  const body = m[1];
  if (!body.trim()) continue;
  try {
    new vm.Script(body);
    console.log('script block ' + i + ': OK (' + body.length + ' chars)');
  } catch (e) {
    ok = false;
    console.log('script block ' + i + ': SYNTAX ERROR -> ' + e.message);
  }
}
process.exit(ok ? 0 : 1);
