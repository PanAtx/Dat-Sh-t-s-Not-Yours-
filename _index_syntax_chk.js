// _index_syntax_chk.js — compile every inline <script> block in index.html with
// `new Function` (parse-only, nothing runs) so a bad edit anywhere in the 17k-line
// game file fails loudly before opening it in a browser.

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let ok = true,
  n = 0;
const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(src)) !== null) {
  n++;
  const tag = m[0].slice(0, m[0].indexOf('>'));
  if (/\bsrc\s*=/i.test(tag)) continue; // external file — not part of this check
  const code = m[1];
  if (!code.trim()) continue;
  if (/\btype\s*=\s*["']module["']/i.test(tag)) {
    console.log(`PASS script #${n} (module, skipped)`);
    continue;
  }
  try {
    new Function(code);
    console.log(`PASS script #${n} (${code.length} chars)`);
  } catch (e) {
    ok = false;
    console.log(`FAIL script #${n}: ${e.message}`);
  }
}
console.log(ok ? '\nINDEX HTML SYNTAX OK' : '\nINDEX HTML SYNTAX BROKEN');
process.exit(ok ? 0 : 1);