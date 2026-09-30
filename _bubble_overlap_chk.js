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
check(
  code.includes('typeof b.spotX === "number"') && code.includes('b.w * BUBBLE_PEAK_MARGIN'),
  'occupiedBoxes prefers the STORED layout box (animation-independent, mid-pop safe)',
);
check(
  code.includes('return { cx: best.cx, by: best.by, w: w, h: h }'),
  'findFreeSpot returns the stable layout size (w/h) with the spot',
);
check(
  code.includes('rec.w = spot.w') && code.includes('rec.h = spot.h'),
  'spawnBubble stores the layout size on the record',
);

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
// A mock element that can simulate the bubblePop scale-in: its live rect SHRINKS
// toward the center by popScale (0 = the first frame of the pop, 1 = resting).
function makePoppableEl(text) {
  const el = makeEl(text, false);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  el.popScale = 1;
  el.getBoundingClientRect = function () {
    const full = makeEl(text, false).getBoundingClientRect();
    const cx = (full.left + full.right) / 2;
    const cy = (full.top + full.bottom) / 2;
    const s = el.popScale;
    return {
      left: cx - (w * s) / 2,
      top: cy - (h * s) / 2,
      right: cx + (w * s) / 2,
      bottom: cy + (h * s) / 2,
      width: w * s,
      height: h * s,
    };
  };
  // The FULL resting box (what the pop ends at) — what overlap must be checked against.
  el.restRect = () => makeEl(text, false).getBoundingClientRect();
  return el;
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

// 6) THE HOPPER GUSH CASE: a bubble still mid-pop (scale ~0.05, its live rect a
//    tiny sliver) must STILL block its full resting slot. "Hopper full,
//    compacting!" is born on the same frame as the GROSS! bubble at the worker's
//    head — if the layout measured the mid-pop rect, it would land on top of it.
speechBubbles.length = 0;
{
  const el = makePoppableEl('GROSS!');
  const rec = { el: el };
  speechBubbles.push(rec); // register first, exactly like spawnBubble does
  const spot = api.findFreeSpot(el, 450, 320);
  rec.spotX = spot.cx;
  rec.spotY = spot.by;
  rec.w = spot.w;
  rec.h = spot.h;
  el.popScale = 0.05; // the pop has barely started: live rect is a sliver
  const b = place('Hopper full, compacting!', false, 450, 320);
  const rest = el.restRect();
  check(
    !api.rectsOverlap(b, rest),
    'a MID-POP bubble still blocks its full slot (no overlap when the pop finishes)',
  );
  check(onScreen(b), 'the gush-frame sibling bubble stays on-screen');
}

console.log(
  pass ? '\nBUBBLE OVERLAP CHECKS PASSED' : '\nBUBBLE OVERLAP CHECKS FAILED',
);
process.exit(pass ? 0 : 1);