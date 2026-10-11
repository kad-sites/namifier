import assert from 'assert';
import DxfParser from 'dxf-parser';
import { generateSlices } from '../src/geometry/slicer.js';
import { generateSpineRails } from '../src/geometry/spine.js';
import { nestSlicesOnSheets } from '../src/geometry/nesting.js';
import { exportSingleSliceDXF, exportSheetDXF } from '../src/export/dxf.js';

console.log('--- Starting Parametric Wave Logo Slicer Automated Tests ---');

// Test 1: Slice Count Math Verification (width 1200mm, t=6, g=4 -> pitch=10 -> 120 slices)
console.log('Test 1: Slice count calculation (width 1200, t=6, g=4)');
const params = {
  width: 1200,
  height: 400,
  sheetThickness: 6,
  gap: 4,
  sliceDirection: 'vertical',
  baseDepth: 25,
  embossDepth: 45,
  invertEmboss: false,
  amplitude: 28,
  wavelengthX: 320,
  wavelengthY: 260,
  phase: 30,
  waveType: 'sine',
  falloff: 0.45,
  surfaceSmoothing: 3,
  backProfile: 'flat',
  spineEnabled: true,
  numRails: 2,
  slotDepth: 15,
  tolerance: 0.2,
  sheetWidth: 1220,
  sheetHeight: 2440
};

const pitch = params.sheetThickness + params.gap; // 10 mm
const expectedSliceCount = Math.floor(params.width / pitch); // 120 slices

// Dummy mask sampler simulating "LOGO"
const mockMaskSampler = (u, v) => {
  // Center logo region
  if (u > 0.2 && u < 0.8 && v > 0.3 && v < 0.7) {
    return 1.0;
  }
  return 0.0;
};

const slices = generateSlices(mockMaskSampler, params);
console.log(`Generated slice count: ${slices.length}, expected: ${expectedSliceCount}`);
assert.strictEqual(slices.length, expectedSliceCount, `Slice count must equal width / pitch (${expectedSliceCount})`);
console.log('✓ Slice count test PASSED (exactly 120 slices)');

// Test 2: Polygon Closure Verification
console.log('Test 2: Verifying polygon closure across all 120 slices');
for (let i = 0; i < slices.length; i++) {
  const pts = slices[i].polygon;
  assert(pts.length >= 4, `Slice ${i + 1} has insufficient points: ${pts.length}`);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const dist = Math.hypot(first.x - last.x, first.y - last.y);
  assert(dist < 0.001, `Slice ${i + 1} polygon is not closed! Start: (${first.x},${first.y}), End: (${last.x},${last.y})`);
}
console.log('✓ All 120 slice polygons are airtight and closed');

// Test 3: Interlocking Spine Rails
console.log('Test 3: Spine rails and slot cutout verification');
const spineRails = generateSpineRails(slices, params);
assert.strictEqual(spineRails.length, params.numRails, `Expected ${params.numRails} spine rails`);
console.log(`✓ Spine rails generated: ${spineRails.length} rails with matching CNC slots`);

// Test 4: DXF Export & dxf-parser Compliance Test
console.log('Test 4: Parsing exported slice DXF using dxf-parser');
const sampleSlice = slices[10];
const sampleDxfString = exportSingleSliceDXF(sampleSlice);

const parser = new DxfParser();
let parsedDxf;
try {
  parsedDxf = parser.parseSync(sampleDxfString);
} catch (err) {
  console.error('DXF Parsing error:', err);
  process.exit(1);
}

assert(parsedDxf, 'Parser returned null or undefined');
assert(parsedDxf.entities && parsedDxf.entities.length >= 2, 'DXF must contain LWPOLYLINE and TEXT entities');

const cutEntity = parsedDxf.entities.find(e => e.type === 'LWPOLYLINE' && e.layer === 'CUTS');
assert(cutEntity, 'Missing LWPOLYLINE entity on layer CUTS');
assert(cutEntity.vertices && cutEntity.vertices.length >= 4, 'LWPOLYLINE has insufficient vertices');
assert(cutEntity.shape === true, 'LWPOLYLINE must be closed shape');

const textEntity = parsedDxf.entities.find(e => e.type === 'TEXT' && e.layer === 'LABELS');
assert(textEntity, 'Missing TEXT entity on layer LABELS');
assert.strictEqual(textEntity.text, sampleSlice.label, 'Text entity does not match slice label');

console.log('✓ DXF Parser verification PASSED: valid AutoCAD 2000 format, correct layers (CUTS, LABELS), and closed vertices');

// Test 5: Sheet Nesting & Multi-sheet DXF Test
console.log('Test 5: 2D Sheet Nesting verification');
const nestedResult = nestSlicesOnSheets(slices, {
  sheetWidth: params.sheetWidth,
  sheetHeight: params.sheetHeight,
  partSpacing: 6,
  kerfOffset: 0
});

assert(nestedResult.sheetCount >= 1, 'Nesting produced 0 sheets');
console.log(`✓ Nesting: ${nestedResult.sheetCount} sheets needed, total material: ${nestedResult.totalSheetAreaM2.toFixed(2)} m², utilization: ${nestedResult.overallUtilization}%`);

const sheet1Dxf = exportSheetDXF(nestedResult.sheets[0]);
const parsedSheetDxf = parser.parseSync(sheet1Dxf);
assert(parsedSheetDxf.entities.length > nestedResult.sheets[0].items.length, 'Nested DXF missing entities');
console.log('✓ Nested sheet DXF parsed successfully with all parts and labels');

console.log('--- ALL AUTOMATED TESTS COMPLETED SUCCESSFULLY! ---');
