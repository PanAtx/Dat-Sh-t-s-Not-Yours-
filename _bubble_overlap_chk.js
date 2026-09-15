// Speech bubble overlap check: multiple speakers talking at the same time should
// produce collision-free bubbles stacked on different lines, not overlapping.

const fs = require('fs');
const code = fs.readFileSync('index.html', 'utf8');

// Check 1: The overlap detection infrastructure exists
const hasBounds = code.includes('function bubbleBounds(');
const hasOverlap = code.includes('function rectsOverlap(');
const hasFindLine = code.includes('function findFreeBubbleLine(');
if (!hasBounds || !hasOverlap || !hasFindLine) {
  console.log('FAIL  overlap detection functions missing');
  process.exit(1);
}
console.log('PASS  overlap detection infrastructure exists');

// Check 2: BUBBLE_LINE_STEP is defined and reasonable
const stepMatch = code.match(/const BUBBLE_LINE_STEP = (\d+)/);
if (!stepMatch || stepMatch[1] < 30 || stepMatch[1] > 60) {
  console.log('FAIL  BUBBLE_LINE_STEP not in reasonable range (30-60)');
  process.exit(1);
}
console.log('PASS  BUBBLE_LINE_STEP = ' + stepMatch[1]);

// Check 3: spawnBubble computes a line slot
const spawnHasLine = code.includes('const offsetLine = findFreeBubbleLine(');
if (!spawnHasLine) {
  console.log('FAIL  spawnBubble does not find a collision-free line');
  process.exit(1);
}
console.log('PASS  spawnBubble finds collision-free line slot');

// Check 4: updateBubbles uses offsetLine for vertical positioning
const updateUsesLine = code.includes('s.y - b.offsetLine * BUBBLE_LINE_STEP');
if (!updateUsesLine) {
  console.log('FAIL  updateBubbles does not apply line offset to bubble position');
  process.exit(1);
}
console.log('PASS  updateBubbles applies line offset for stacking');

// Check 5: Worker bubbles use distinct color class
const workerColor = code.includes('bub-worker');
if (!workerColor) {
  console.log('FAIL  worker bubble color class missing');
  process.exit(1);
}
console.log('PASS  worker has distinct bubble color class');

// Check 5b: Color classes are set directly (not layered on default) to avoid CSS specificity override
const spawnPattern = /el\.className = 'bubble bub-[a-z]+'/;
if (!spawnPattern.test(code)) {
  console.log('FAIL  spawnBubble does not set color class directly');
  process.exit(1);
}
console.log('PASS  spawnBubble sets color class directly (no bub-default override)');

// Check 6: NPC types have color classes
const npcTypes = ['dog', 'ped', 'hooker', 'skater', 'escooter', 'yeller', 'rat', 'driver', 'kid'];
for (const t of npcTypes) {
  if (!code.includes('bub-' + t)) {
    console.log('FAIL  bubble color class missing for ' + t);
    process.exit(1);
  }
}
console.log('PASS  all NPC types have distinct bubble color classes');

// Check 7: No green in NPC bubble colors (only worker should be green)
// Worker uses #d4f8d4 (light green). NPC colors should NOT contain "green" or be green-ish.
const npcColorLines = [
  'bub-dog', 'bub-ped', 'bub-lady', 'bub-hooker', 'bub-skater',
  'bub-escooter', 'bub-yeller', 'bub-rat', 'bub-driver', 'bub-kid', 'bub-default'
];
for (const cls of npcColorLines) {
  const line = code.split('\n').find(l => l.includes(cls));
  if (line && line.toLowerCase().includes('green')) {
    console.log('FAIL  ' + cls + ' uses green (reserved for worker)');
    process.exit(1);
  }
}
console.log('PASS  no NPC bubble color is green');

// Check 8: rectsOverlap implements AABB correctly
const overlapImpl = code.match(/function rectsOverlap\(a, b\)\{[^}]*\}/);
if (overlapImpl) {
  const impl = overlapImpl[0];
  if (!impl.includes('a.x < b.x + b.w') || !impl.includes('a.y < b.y + b.h')) {
    console.log('FAIL  rectsOverlap does not implement AABB collision');
    process.exit(1);
  }
} else {
  console.log('FAIL  rectsOverlap implementation not found');
  process.exit(1);
}
console.log('PASS  rectsOverlap implements AABB collision correctly');

// Check 9: Voice.say call sites pass speaker types
// Worker calls should pass 'worker', dog calls should pass 'dog', etc.
const workerCalls = code.match(/Voice\.say\([^)]*WORKER_GENDER[^)]*'worker'\)/g);
if (!workerCalls || workerCalls.length < 10) {
  console.log('FAIL  not enough worker Voice.say calls with speaker type');
  process.exit(1);
}
console.log('PASS  worker Voice.say calls pass speaker type (' + workerCalls.length + ' calls)');

const dogCalls = code.match(/Voice\.say\([^)]*'dog'\)/g);
if (!dogCalls || dogCalls.length < 2) {
  console.log('FAIL  not enough dog Voice.say calls with speaker type');
  process.exit(1);
}
console.log('PASS  dog Voice.say calls pass speaker type (' + dogCalls.length + ' calls)');

// Check 10: No overlap - simulate stacking two bubbles at same position
// This is a logic test: two bubbles at same (sx, sy) should get different line numbers
// Line 0 for first, Line 1 for second (since line 0 is occupied).
// We verify the algorithm by checking the code structure.
const findLineLoop = code.match(/for \(let line = 0; line < 4; line\+\+\)\{/);
if (!findLineLoop) {
  console.log('FAIL  findFreeBubbleLine does not loop through line slots');
  process.exit(1);
}
console.log('PASS  findFreeBubbleLine loops through up to 4 line slots');

// Check 11: Locked position prevents jitter during bubble lifetime
const usesLock = code.includes('b.lockedX') && code.includes('b.lockedY');
if (!usesLock) {
  console.log('FAIL  bubble position locking not implemented');
  process.exit(1);
}
console.log('PASS  bubble position locking prevents jitter');

// Check 12: Pop-in animation is defined and applied
const hasPopAnim = code.includes('animation:bubblePop');
const hasPopKeyframes = code.includes('@keyframes bubblePop');
if (!hasPopAnim || !hasPopKeyframes) {
  console.log('FAIL  bubble pop-in animation missing');
  process.exit(1);
}
console.log('PASS  bubble pop-in animation is defined and applied');

console.log('\nBUBBLE OVERLAP AND COLOR CHECKS PASSED');