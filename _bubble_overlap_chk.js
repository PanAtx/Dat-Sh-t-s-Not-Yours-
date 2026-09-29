// Speech bubble overlap check: multiple speakers talking at the same time must each
// get their OWN on-screen slot so the bubbles never overlap (readability).
//
// The layout lives in index.html: findFreeSpot(el, ax, ay) picks the first
// non-overlapping candidate slot (above the head, then stacked up, then the sides,
// then edge rows) and the bubble is FROZEN there for its life. This script verifies
// the touchpoints AND runs the real findFreeSpot against a mock DOM to prove that
// same-anchor speakers get mutually non-overlapping, on-screen bubbles.
const fs = require('fs');
const code = fs.readFileSync('index.html', 'utf8');
let pass = true;
const check = (ok, label) => {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) pass = false;
};

// --- static touchpoints -------------------------------------------------------
check(code.includes('function rectsOverlap('), 'rectsOverlap exists');
check(code.includes('function bubbleBox('), 'bubbleBox exists');
check(code.includes('function occupiedBoxes('), 'occupiedBoxes exists');
check(code.includes('function findFreeSpot('), 'findFreeSpot exists');
check(code.includes('const BUBBLE_PAD ='), 'BUBBLE_PAD gap constant exists');
check(
  code.includes('const spot = findFreeSpot(el, s.x, s.y)'),
  'spawnBubble places the bubble via findFreeSpot',
);
check(!code.includes('BUBBLE_LINE_STEP'), 'old BUBBLE_LINE_STEP removed');
check(!/\boffsetLine\b/.test(code), 'old offsetLine removed');
check(
  !code.includes('s.y - b.offsetLine'),
  'updateBubbles no longer re-projects (bubbles are frozen)',
);
check(
  code.indexOf('speechBubbles.push(rec)') < code.lastIndexOf('findFreeSpot(el, s.x, s.y)') &&
    code.indexOf('speechBubbles.push(rec)') > code.lastIndexOf('function spawnBubble'),
  'spawnBubble registers the bubble BEFORE laying it out (same-frame siblings see each other)',
);
check(code.includes('const BUBBLE_PEAK_MARGIN ='), 'peak-scale margin exists (pop overshoot 1.10/1.15x)');

// --- behavioral test: run the REAL findFreeSpot against a mock DOM ------------
function grabLayoutBlock() {
  const start = code.indexOf('const BUBBLE_PAD');
  const end = code.indexOf('function spawnBubble');
  if (start < 0 || end < 0 || end <= start)
    throw new Error('layout block (BUBBLE_PAD..spawnBubble) not found');
  return code.slice(start, end);
}

const innerWidth = 900;
const innerHeight = 640;
const speechBubbles = [];
const api = new Function(
  'innerWidth',
  'innerHeight',
  'speechBubbles',
  grabLayoutBlock() + '\n;return { findFreeSpot, bubbleBox, rectsOverlap };',
)(innerWidth, innerHeight, speechBubbles);

// A mock bubble element that mirrors the real CSS (single-line, and the
// translate(-50%,-110%) transform that hangs it above its head).
function makeEl(text, burst) {
  const w = burst
    ? Math.min(text.length * 12 + 96, 356)
    : Math.max(60, text.length * 10 + 20);
  const h = burst ? 74 : 30;
  return {
    textContent: text,
    offsetWidth: w,
    offsetHeight: h,
    style: { left: '0px', top: '0px' },
    getBoundingClientRect() {
      const L = parseFloat(this.style.left);
      const T = parseFloat(this.style.top);
      return {
        left: L - w / 2,
        top: T - 1.1 * h,
        right: L + w / 2,
        bottom: T - 0.1 * h,
        width: w,
        height: h,
      };
    },
    remove() {},
  };
}
function place(text, burst, ax, ay) {
  const el = makeEl(text, burst);
  api.findFreeSpot(el, ax, ay);
  speechBubbles.push({ el });
  return el.getBoundingClientRect();
}
const mutuallyFree = (boxes) => {
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (api.rectsOverlap(boxes[i], boxes[j])) return false;
  return true;
};
const onScreen = (b) =>
  b.left >= -1 &&
  b.top >= -1 &&
  b.right <= innerWidth + 1 &&
  b.bottom <= innerHeight + 1;

// 1) Two speakers at the SAME head position must not overlap.
speechBubbles.length = 0;
{
  const a = place('HEY! YOU!', false, 450, 320);
  const b = place('NOT ME!', false, 450, 320);
  check(!api.rectsOverlap(a, b), 'two same-anchor bubbles do not overlap');
}

// 2) Five speakers at the same head position all land in distinct slots.
speechBubbles.length = 0;
{
  const boxes = [];
  for (let i = 0; i < 5; i++) boxes.push(place('TALK ' + i, false, 300, 300));
  check(
    mutuallyFree(boxes),
    'five same-anchor bubbles are mutually non-overlapping',
  );
}

// 3) Even a head near the top-left corner keeps every bubble fully on-screen.
speechBubbles.length = 0;
{
  const boxes = [];
  for (let i = 0; i < 6; i++) boxes.push(place('EDGE ' + i, false, 70, 40));
  check(boxes.every(onScreen), 'corner bubbles all stay on-screen');
  check(mutuallyFree(boxes), 'corner bubbles are mutually non-overlapping');
}

// 4) A tall POW! burst and a plain line at the same anchor do not overlap.
speechBubbles.length = 0;
{
  const a = place('OW!', true, 400, 300);
  const b = place('Watch it!', false, 400, 300);
  check(!api.rectsOverlap(a, b), 'burst + plain same-anchor bubbles do not overlap');
}

// 5) TWO bubbles born the SAME FRAME at the same anchor (a cat's "Hiss!" and its
//    "+10 points" together) each get their own slot — spawnBubble registers the
//    record in speechBubbles BEFORE calling findFreeSpot, so emulate that order.
speechBubbles.length = 0;
{
  const placeSim = (text, ax, ay) => {
    const el = makeEl(text, false);
    speechBubbles.push({ el }); // register first, exactly like spawnBubble now does
    api.findFreeSpot(el, ax, ay);
    return el.getBoundingClientRect();
  };
  const a = placeSim('Hiss!', 450, 320);
  const b = placeSim('+10 points', 450, 320);
  check(!api.rectsOverlap(a, b), 'same-frame same-anchor bubbles (voice + score) do not overlap');
  check(onScreen(a) && onScreen(b), 'same-frame same-anchor bubbles are both on-screen');
}

console.log(
  pass ? '\nBUBBLE OVERLAP CHECKS PASSED' : '\nBUBBLE OVERLAP CHECKS FAILED',
);
process.exit(pass ? 0 : 1);