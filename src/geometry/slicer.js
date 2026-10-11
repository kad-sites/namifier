import { evaluateBaseWave } from './wave.js';
import { simplifyPolyline } from './simplify.js';
import { getRibSlotIntervals } from './spine.js';

/**
 * Applies a moving-average filter to an array of heights.
 */
function applyMovingAverage(heights, windowSize) {
  if (!windowSize || windowSize <= 1) return heights;
  const halfWindow = Math.floor(windowSize / 2);
  const result = new Float32Array(heights.length);

  for (let i = 0; i < heights.length; i++) {
    let sum = 0;
    let count = 0;
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(heights.length - 1, i + halfWindow);
    for (let j = start; j <= end; j++) {
      sum += heights[j];
      count++;
    }
    result[i] = sum / count;
  }
  return result;
}

/**
 * Slices the heightfield into closed 2D rib profiles.
 */
export function generateSlices(maskSampler, params) {
  const {
    width = 1200,
    height = 400,
    sheetThickness = 6,
    gap = 4,
    sliceDirection = 'vertical', // 'vertical' (along X) or 'horizontal' (along Y)
    baseDepth = 20,
    embossDepth = 40,
    invertEmboss = false,
    surfaceSmoothing = 3,
    backProfile = 'flat', // 'flat' or 'offset'
    simplifyTolerance = 0.1,
    sampleResolution = 1.0, // 1 mm sampling step
    spineEnabled = true,
    numRails = 2,
    slotDepth = 15,
    tolerance = 0.2
  } = params;

  const pitch = sheetThickness + gap;
  const primaryDim = (sliceDirection === 'vertical') ? width : height;
  const ribLength = (sliceDirection === 'vertical') ? height : width;

  // Number of slices = primaryDim / pitch
  const numSlices = Math.max(1, Math.floor(primaryDim / pitch));

  // Determine slot positions along rib length
  const spineSlots = getRibSlotIntervals(ribLength, {
    spineEnabled,
    numRails,
    slotDepth,
    tolerance,
    sheetThickness
  });

  const slices = [];
  const numSamples = Math.ceil(ribLength / sampleResolution) + 1;

  for (let i = 0; i < numSlices; i++) {
    // Position of this slice in sign coordinates
    const p = i * pitch + sheetThickness / 2;

    // Sample the top profile along ribLength
    const topHeights = new Float32Array(numSamples);
    const backHeights = new Float32Array(numSamples);
    const sCoords = new Float32Array(numSamples);

    for (let sIdx = 0; sIdx < numSamples; sIdx++) {
      const s = Math.min(ribLength, sIdx * sampleResolution);
      sCoords[sIdx] = s;

      // Coordinate mapping
      let x, y;
      if (sliceDirection === 'vertical') {
        x = p;
        y = s;
      } else {
        x = s;
        y = p;
      }

      // Sample base wave
      const waveZ = evaluateBaseWave(x, y, params);

      // Sample mask (u, v in 0..1)
      const u = Math.max(0, Math.min(1, x / width));
      const v = Math.max(0, Math.min(1, y / height));
      const maskVal = maskSampler ? maskSampler(u, v) : 0;

      // Calculate embossed height
      const embossFactor = invertEmboss ? (1.0 - maskVal) : maskVal;
      const embossZ = embossDepth * embossFactor;

      // Total top height: baseDepth ensures minimum material thickness
      const totalZ = baseDepth + waveZ + embossZ;
      topHeights[sIdx] = Math.max(3.0, totalZ); // Ensure at least 3mm thickness

      // Back profile
      if (backProfile === 'offset') {
        backHeights[sIdx] = Math.max(0, waveZ);
      } else {
        backHeights[sIdx] = 0; // Flat back plate
      }
    }

    // Apply surface smoothing
    const smoothedTop = applyMovingAverage(topHeights, surfaceSmoothing);

    // Build closed 2D polygon in local rib coordinates (s, z)
    // 1. Top profile from s=0 to s=ribLength
    const rawPolygon = [];
    for (let sIdx = 0; sIdx < numSamples; sIdx++) {
      rawPolygon.push({
        x: sCoords[sIdx],
        y: smoothedTop[sIdx]
      });
    }

    // 2. Right closure down to back profile
    const lastIdx = numSamples - 1;
    rawPolygon.push({
      x: sCoords[lastIdx],
      y: backHeights[lastIdx]
    });

    // 3. Bottom profile from s=ribLength down to s=0 (with spine slots)
    // Sort slots by position descending for bottom edge traversal
    const sortedSlots = [...spineSlots].sort((a, b) => b.center - a.center);

    let currentS = ribLength;
    for (const slot of sortedSlots) {
      if (slot.start < currentS && slot.end > 0) {
        // Line to slot end
        rawPolygon.push({ x: slot.end, y: 0 });
        // Slot up into the rib by slotDepth
        rawPolygon.push({ x: slot.end, y: slot.depth });
        // Across slot
        rawPolygon.push({ x: slot.start, y: slot.depth });
        // Down from slot
        rawPolygon.push({ x: slot.start, y: 0 });
        currentS = slot.start;
      }
    }

    // Line to s=0
    rawPolygon.push({
      x: 0,
      y: backHeights[0]
    });

    // 4. Left closure back to top start
    rawPolygon.push({
      x: 0,
      y: smoothedTop[0]
    });

    // Simplify polyline
    const simplified = simplifyPolyline(rawPolygon, simplifyTolerance);

    // Calculate bounding box and stats
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let pt of simplified) {
      if (pt.y < minZ) minZ = pt.y;
      if (pt.y > maxZ) maxZ = pt.y;
    }

    slices.push({
      index: i + 1,
      label: `SLICE-#${i + 1}`,
      position: p,
      polygon: simplified,
      length: ribLength,
      minZ: Math.max(0, minZ),
      maxZ,
      thickness: sheetThickness
    });
  }

  return slices;
}
