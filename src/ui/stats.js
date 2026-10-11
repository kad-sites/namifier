/**
 * Calculates fabrication statistics and safety validation warnings.
 */
export function calculateStatsAndWarnings(slices, nestedResult, params) {
  const {
    sheetThickness = 6,
    gap = 4,
    costPerSheet = 45,
    sheetWidth = 1220,
    sheetHeight = 2440,
    toolDiameter = 3.175
  } = params;

  const sliceCount = slices ? slices.length : 0;
  const sheetCount = nestedResult ? nestedResult.sheetCount : 0;
  const totalSheetAreaM2 = nestedResult ? nestedResult.totalSheetAreaM2 : 0;
  const totalCost = sheetCount * costPerSheet;
  const utilization = nestedResult ? nestedResult.overallUtilization : 0;

  // Calculate total linear cut perimeter in meters
  let totalCutMeters = 0;
  let minProfileThickness = Infinity;
  let maxPartDimension = 0;

  if (slices) {
    for (const slice of slices) {
      const pts = slice.polygon;
      let slicePerimeter = 0;
      for (let i = 0; i < pts.length; i++) {
        const next = pts[(i + 1) % pts.length];
        const dx = next.x - pts[i].x;
        const dy = next.y - pts[i].y;
        slicePerimeter += Math.sqrt(dx * dx + dy * dy);
      }
      totalCutMeters += slicePerimeter / 1000;

      if (slice.maxZ < minProfileThickness) {
        minProfileThickness = slice.maxZ;
      }
      if (slice.length > maxPartDimension) {
        maxPartDimension = slice.length;
      }
    }
  }

  // Warnings
  const warnings = [];

  if (minProfileThickness < 8) {
    warnings.push({
      type: 'warning',
      message: `Fragile Sections: Minimum material depth is ${minProfileThickness.toFixed(1)} mm. Consider increasing Base Depth to prevent snapping.`
    });
  }

  if (sheetThickness < toolDiameter) {
    warnings.push({
      type: 'caution',
      message: `Tool Kerf Warning: Sheet thickness (${sheetThickness} mm) is smaller than tool diameter (${toolDiameter} mm). Interlocking slots will be over-cut.`
    });
  }

  const maxSheetDim = Math.max(sheetWidth, sheetHeight);
  if (maxPartDimension > maxSheetDim) {
    warnings.push({
      type: 'danger',
      message: `Oversized Parts: Slices exceed maximum sheet dimension (${maxPartDimension.toFixed(0)} mm > ${maxSheetDim} mm). Slices will not fit on single sheet.`
    });
  }

  return {
    sliceCount,
    sheetCount,
    totalSheetAreaM2: totalSheetAreaM2.toFixed(2),
    totalCutMeters: totalCutMeters.toFixed(1),
    totalCost: totalCost.toFixed(2),
    utilization,
    warnings
  };
}
