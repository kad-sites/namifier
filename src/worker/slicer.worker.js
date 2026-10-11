import { generateSlices } from '../geometry/slicer.js';
import { generateSpineRails } from '../geometry/spine.js';
import { nestSlicesOnSheets } from '../geometry/nesting.js';

self.onmessage = function (e) {
  const { maskBuffer, maskWidth, maskHeight, params } = e.data;

  // Mask sampler reconstructing bilinear interpolation from the transferable Float32Array
  let maskSampler = null;
  if (maskBuffer) {
    const maskData = new Float32Array(maskBuffer);
    const w = maskWidth || 1024;
    const h = maskHeight || 1024;

    maskSampler = function (u, v) {
      if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
      const x = u * (w - 1);
      const y = v * (h - 1);

      const x0 = Math.floor(x);
      const x1 = Math.min(w - 1, x0 + 1);
      const y0 = Math.floor(y);
      const y1 = Math.min(h - 1, y0 + 1);

      const fx = x - x0;
      const fy = y - y0;

      const v00 = maskData[y0 * w + x0];
      const v10 = maskData[y0 * w + x1];
      const v01 = maskData[y1 * w + x0];
      const v11 = maskData[y1 * w + x1];

      return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
    };
  }

  // Generate Slices
  const slices = generateSlices(maskSampler, params);

  // Generate Spine Rails
  const spineRails = generateSpineRails(slices, params);

  // Nest onto sheets
  const nestedResult = nestSlicesOnSheets(slices, {
    sheetWidth: params.sheetWidth || 1220,
    sheetHeight: params.sheetHeight || 2440,
    partSpacing: params.partSpacing || 6,
    kerfOffset: params.kerfOffset || 0
  });

  self.postMessage({
    success: true,
    slices,
    spineRails,
    nestedResult
  });
};
