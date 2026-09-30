// Write-up stamp mobile-fit check (CSS invariants):
//   the red "WRITTEN UP!" stamp (.pop-writeup) must fit narrow phone viewports:
//   1) the seal text WRAPS (white-space: normal) instead of the base .popup nowrap
//      spilling off-screen,
//   2) the whole stamp is capped to the viewport (max-width in vw),
//   3) the main seal font is viewport-based (min(Nvw, 64px)) so it shrinks on
//      phones but stays a fixed 64px on desktop,
//   4) the offense line under the seal (.writeup-reason) also wraps (white-space:
//      normal + a vw max-width) so long reasons never overflow.
// Statically asserts these invariants on the .pop-writeup CSS blocks in index.html.
const fs = require('fs');
const src = fs.readFileSync('index.html', 'utf8');

let pass = true;
const check = (name, c, e) => {
  console.log((c ? 'PASS' : 'FAIL') + '  ' + name + (c ? '' : '  [' + e + ']'));
  if (!c) pass = false;
};

// pull out a top-level ".x { ... }" css block (brace-matched), or '' if missing
function cssBlock(selector) {
  const idx = src.indexOf(selector + ' {');
  if (idx < 0) return '';
  const brace = src.indexOf('{', idx);
  let depth = 0, i = brace;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(idx, i + 1);
}

const writeup = cssBlock('.pop-writeup');
const reason = cssBlock('.pop-writeup .writeup-reason');

console.log('[1] the .pop-writeup stamp fits narrow phones');
{
  check('the .pop-writeup CSS block exists in index.html', writeup.length > 0, 'missing .pop-writeup block');
  check('seal text WRAPS (white-space: normal) - overrides the base .popup nowrap', /white-space:\s*normal/.test(writeup), 'no white-space: normal on .pop-writeup');
  check('the whole stamp is capped to the viewport (max-width in vw)', /max-width:\s*\d+vw/.test(writeup), 'no vw max-width on .pop-writeup');
  check('the main seal font is viewport-based (min(Nvw, 64px))', /font-size:\s*min\(\s*\d+(\.\d+)?vw\s*,\s*64px\s*\)/.test(writeup), 'no min(Nvw, 64px) font-size on .pop-writeup');
  check('the base .popup is still nowrap (the writeup override is what makes it fit)', /\.popup\s*\{[\s\S]*?white-space:\s*nowrap/.test(src), 'base .popup nowrap not found');
}

console.log('');
console.log('[2] the offense line under the seal also fits');
{
  check('the .pop-writeup .writeup-reason CSS block exists', reason.length > 0, 'missing .writeup-reason block');
  check('the reason line WRAPS (white-space: normal)', /white-space:\s*normal/.test(reason), 'no white-space: normal on .writeup-reason');
  check('the reason line is capped to the viewport (max-width in vw)', /max-width:\s*\d+vw/.test(reason), 'no vw max-width on .writeup-reason');
  check('the reason font is viewport-based (min(Nvw, ...px))', /font-size:\s*min\(\s*\d+(\.\d+)?vw\s*,/.test(reason), 'no min(Nvw, ...) font-size on .writeup-reason');
}

console.log('');
console.log(pass ? 'WRITE-UP MOBILE FIT: ALL CHECKS PASSED' : 'WRITE-UP MOBILE FIT: SOME CHECKS FAILED');
process.exit(pass ? 0 : 1);