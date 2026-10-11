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
 * Slices the heightfield into closed 2D rib profiles with planar logo emboss and safe spine slots.
 */
export function generateSlices(maskSampler, params) {
  const {
    width = 1200,
    height = 400,
    sheetThickness = 6,
    gap = 4,
    sliceDirection = 'vertical',
    baseDepth = 25,
    embossDepth = 50,
    invertEmboss = false,
    amplitude = 25,
    surfaceSmoothing = 3,
    backProfile = 'flat',
    simplifyTolerance = 0.1,
    sampleResolution = 1.0,
    spineEnabled = true,
    numRails = 2,
    slotDepth = 15,
    tolerance = 0.2
  } = params;

  const pitch = sheetThickness + gap;
  const primaryDim = (sliceDirection === 'vertical') ? width : height;
  const ribLength = (sliceDirection === 'vertical') ? height : width;

  const numSlices = Math.max(1, Math.floor(primaryDim / pitch));

  const spineSlots = getRibSlotIntervals(ribLength, {
    spineEnabled,
    numRails,
    slotDepth,
    tolerance,
    sheetThickness
  });

  const slices = [];
  const numSamples = Math.ceil(ribLength / sampleResolution) + 1;

  // Maximum wave peak for planar emboss reference
  const maxWavePeak = baseDepth + Math.abs(amplitude);
  const targetLogoPlane = maxWavePeak + embossDepth;

  for (let i = 0; i < numSlices; i++) {
    const p = i * pitch + sheetThickness / 2;

    const topHeights = new Float32Array(numSamples);
    const backHeights = new Float32Array(numSamples);
    const sCoords = new Float32Array(numSamples);

    for (let sIdx = 0; sIdx < numSamples; sIdx++) {
      const s = Math.min(ribLength, sIdx * sampleResolution);
      sCoords[sIdx] = s;

      let x, y;
      if (sliceDirection === 'vertical') {
        x = p;
        y = s;
      } else {
        x = s;
        y = p;
      }

      // Base parametric wave surface
      const waveZ = evaluateBaseWave(x, y, params);
      const waveSurface = baseDepth + waveZ;

      // Sample mask (u in 0..1, v inverted so top of canvas is top of sign)
      const u = Math.max(0, Math.min(1, x / width));
      const v = Math.max(0, Math.min(1, 1.0 - (y / height)));
      const maskVal = maskSampler ? maskSampler(u, v) : 0;

      let totalZ;
      if (invertEmboss) {
        // Recessed / carved: cuts down into the wave surface smoothly
        totalZ = waveSurface - embossDepth * maskVal;
      } else {
        // Planar architectural emboss:
        // Mask smoothly blends between the wavy background and a flat, proud letter face
        // Hermite smoothstep transition eliminates abrupt decreases or rollercoasters
        const t = maskVal * maskVal * (3.0 - 2.0 * maskVal);
        totalZ = (1.0 - t) * waveSurface + t * targetLogoPlane;
      }

      // Ensure minimum structural thickness of at least 10 mm everywhere
      topHeights[sIdx] = Math.max(10.0, totalZ);

      // Back profile
      if (backProfile === 'offset') {
        backHeights[sIdx] = Math.max(0, waveZ);
      } else {
        backHeights[sIdx] = 0; // Flat back plate
      }
    }

    // Apply surface smoothing filter
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

    // 3. Bottom profile from s=ribLength down to s=0 (with safe spine slots)
    const sortedSlots = [...spineSlots].sort((a, b) => b.center - a.center);

    let currentS = ribLength;
    for (const slot of sortedSlots) {
      if (slot.start < currentS && slot.end > 0) {
        // Calculate minimum local rib thickness in the slot zone
        const idxStart = Math.max(0, Math.min(numSamples - 1, Math.floor(slot.start / sampleResolution)));
        const idxEnd = Math.max(0, Math.min(numSamples - 1, Math.floor(slot.end / sampleResolution)));

        let minLocalThick = Infinity;
        for (let k = idxStart; k <= idxEnd; k++) {
          if (smoothedTop[k] < minLocalThick) minLocalThick = smoothedTop[k];
        }

        // Safe slot depth:
        // Guarantee at least 12mm of solid wood ALWAYS remains in front of the slot!
        // Never allow slot to exceed 50% of the local rib thickness
        const maxAllowedSlotDepth = Math.max(0, minLocalThick - 12.0);
        const safeSlotDepth = Math.max(0, Math.min(slot.depth, maxAllowedSlotDepth, minLocalThick * 0.5));

        if (safeSlotDepth >= 3.0) {
          // Line to slot end
          rawPolygon.push({ x: slot.end, y: 0 });
          // Slot up into the rib
          rawPolygon.push({ x: slot.end, y: safeSlotDepth });
          // Across slot
          rawPolygon.push({ x: slot.start, y: safeSlotDepth });
          // Down from slot
          rawPolygon.push({ x: slot.start, y: 0 });
        }
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
