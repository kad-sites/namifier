import JSZip from 'jszip';
import { exportSingleSliceDXF, exportSheetDXF } from './dxf.js';
import { generateSingleSliceSVG, generateSheetSVG } from './svg.js';
import { generateSliceGCode } from './gcode.js';

/**
 * Creates and downloads a complete production ZIP package containing:
 * - Individual slice DXFs & SVGs
 * - Nested sheet DXFs & SVGs
 * - Interlocking spine rails
 * - Sample G-code files
 * - Assembly guide manifest
 */
export async function createProductionZip(slices, spineRails, nestedResult, params, onProgress) {
  const zip = new JSZip();

  // Folders
  const folderDxfSlices = zip.folder('dxf_slices');
  const folderSvgSlices = zip.folder('svg_slices');
  const folderNestedDxf = zip.folder('nested_sheets_dxf');
  const folderNestedSvg = zip.folder('nested_sheets_svg');
  const folderGcode = zip.folder('cnc_gcode');

  const totalFiles = slices.length * 2 + (spineRails ? spineRails.length * 2 : 0) + (nestedResult.sheets ? nestedResult.sheets.length * 2 : 0);
  let processedFiles = 0;

  function updateProgress() {
    processedFiles++;
    if (onProgress) {
      onProgress(Math.min(100, Math.round((processedFiles / totalFiles) * 100)));
    }
  }

  // 1. Individual Slice DXF & SVG
  for (const slice of slices) {
    const padIdx = String(slice.index).padStart(3, '0');
    const dxfContent = exportSingleSliceDXF(slice);
    const svgContent = generateSingleSliceSVG(slice);

    folderDxfSlices.file(`slice_${padIdx}.dxf`, dxfContent);
    folderSvgSlices.file(`slice_${padIdx}.svg`, svgContent);

    // Sample G-code for each slice
    const gcodeContent = generateSliceGCode(slice, {
      materialThickness: params.sheetThickness,
      stepDown: params.sheetThickness / 2
    });
    folderGcode.file(`slice_${padIdx}.nc`, gcodeContent);

    updateProgress();
  }

  // 2. Spine Rails DXF & SVG
  if (spineRails && spineRails.length > 0) {
    const folderSpines = zip.folder('spine_rails');
    for (const rail of spineRails) {
      const railDxf = exportSingleSliceDXF(rail);
      const railSvg = generateSingleSliceSVG(rail);
      folderSpines.file(`${rail.id}.dxf`, railDxf);
      folderSpines.file(`${rail.id}.svg`, railSvg);
      updateProgress();
    }
  }

  // 3. Nested Sheets DXF & SVG
  if (nestedResult && nestedResult.sheets) {
    for (const sheet of nestedResult.sheets) {
      const sheetDxf = exportSheetDXF(sheet);
      const sheetSvg = generateSheetSVG(sheet);

      folderNestedDxf.file(`sheet_${sheet.sheetIndex}.dxf`, sheetDxf);
      folderNestedSvg.file(`sheet_${sheet.sheetIndex}.svg`, sheetSvg);
      updateProgress();
    }
  }

  // 4. Assembly Guide & Project Manifest
  const manifestText = `PARAMETRIC WAVE LOGO SLICER - ASSEMBLY GUIDE
=====================================================
Sign Dimensions:      ${params.width} mm x ${params.height} mm
Total Rib Slices:     ${slices.length} plates
Sheet Thickness (t):  ${params.sheetThickness} mm
Rib Gap (g):          ${params.gap} mm
Slice Pitch (t + g):  ${params.sheetThickness + params.gap} mm
Slice Direction:      ${params.sliceDirection}
Base Plate Depth:     ${params.baseDepth} mm
Emboss Depth:         ${params.embossDepth} mm
Wave Type:            ${params.waveType} (Amplitude: ${params.amplitude} mm)

NESTING & CNC SUMMARY:
-----------------------------------------------------
Standard Sheet Size:  ${params.sheetWidth || 1220} x ${params.sheetHeight || 2440} mm
Total Sheets Needed:  ${nestedResult.sheetCount}
Total Material Area:  ${nestedResult.totalSheetAreaM2.toFixed(2)} m²
Overall Utilization:  ${nestedResult.overallUtilization}%

ASSEMBLY INSTRUCTIONS:
-----------------------------------------------------
1. Cut all rib slices from dxf_slices/ or nested_sheets_dxf/.
2. Every slice has its index engraved on layer LABELS (e.g. SLICE-#1 to SLICE-#${slices.length}).
3. Insert interlocking spine rails into the back slots of each rib slice.
4. Fasten or glue ribs in sequential order from #1 to #${slices.length}.
`;

  zip.file('README_ASSEMBLY.txt', manifestText);
  zip.file('project_settings.json', JSON.stringify(params, null, 2));

  // Generate ZIP blob
  return await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (onProgress && metadata.percent) {
      onProgress(Math.round(metadata.percent));
    }
  });
}
