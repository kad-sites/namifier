/**
 * Industry-standard AutoCAD 2000 (AC1015) DXF Exporter.
 * Generates valid DXF files with layers CUTS (for profile cut paths) and LABELS (for slice numbering).
 */
export function generateDXF(items, options = {}) {
  // items: Array of { polygon: [{x, y}], label: string, textPos?: {x, y} }
  const {
    unit = 'mm',
    closed = true,
    textHeight = 12
  } = options;

  let dxf = '';

  // 1. HEADER SECTION
  dxf += '0\nSECTION\n2\nHEADER\n';
  dxf += '9\n$ACADVER\n1\nAC1015\n'; // AutoCAD 2000
  dxf += '9\n$INSUNITS\n70\n4\n';   // 4 = Millimeters
  dxf += '0\nENDSEC\n';

  // 2. TABLES SECTION
  dxf += '0\nSECTION\n2\nTABLES\n';

  // Layer Table
  dxf += '0\nTABLE\n2\nLAYER\n70\n2\n';
  
  // CUTS Layer (White/Black, Color 7)
  dxf += '0\nLAYER\n2\nCUTS\n70\n0\n62\n7\n6\nCONTINUOUS\n';
  
  // LABELS Layer (Red, Color 1)
  dxf += '0\nLAYER\n2\nLABELS\n70\n0\n62\n1\n6\nCONTINUOUS\n';

  dxf += '0\nENDTAB\n';
  dxf += '0\nENDSEC\n';

  // 3. BLOCKS SECTION (empty)
  dxf += '0\nSECTION\n2\nBLOCKS\n';
  dxf += '0\nENDSEC\n';

  // 4. ENTITIES SECTION
  dxf += '0\nSECTION\n2\nENTITIES\n';

  for (const item of items) {
    const polygon = item.polygon || item.placedPolygon;
    if (!polygon || polygon.length < 2) continue;

    // LWPOLYLINE on layer CUTS
    dxf += '0\nLWPOLYLINE\n';
    dxf += '5\n' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase() + '\n';
    dxf += '100\nAcDbEntity\n';
    dxf += '8\nCUTS\n'; // Layer CUTS
    dxf += '100\nAcDbPolyline\n';
    dxf += `90\n${polygon.length}\n`; // Number of vertices
    dxf += `70\n${closed ? '1' : '0'}\n`; // 1 = closed

    for (let i = 0; i < polygon.length; i++) {
      const pt = polygon[i];
      dxf += `10\n${pt.x.toFixed(4)}\n`;
      dxf += `20\n${pt.y.toFixed(4)}\n`;
    }

    // Text Label on layer LABELS
    if (item.label) {
      // Find a safe interior point for the label text
      let textX = item.x ? (item.x + 20) : 20;
      let textY = item.y ? (item.y + 15) : 15;

      if (polygon.length > 0) {
        // Find bounding box to place text safely inside the slice
        let minX = Infinity, minY = Infinity;
        for (let pt of polygon) {
          if (pt.x < minX) minX = pt.x;
          if (pt.y < minY) minY = pt.y;
        }
        textX = minX + 15;
        textY = minY + 10;
      }

      dxf += '0\nTEXT\n';
      dxf += '5\n' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase() + '\n';
      dxf += '100\nAcDbEntity\n';
      dxf += '8\nLABELS\n'; // Layer LABELS
      dxf += '100\nAcDbText\n';
      dxf += `10\n${textX.toFixed(4)}\n`;
      dxf += `20\n${textY.toFixed(4)}\n`;
      dxf += '30\n0.0\n'; // Z = 0
      dxf += `40\n${textHeight.toFixed(2)}\n`; // Text height in mm
      dxf += `1\n${item.label}\n`; // Text content
      dxf += '100\nAcDbText\n';
    }
  }

  dxf += '0\nENDSEC\n';

  // 5. EOF
  dxf += '0\nEOF\n';

  return dxf;
}

/**
 * Exports a single slice as DXF string.
 */
export function exportSingleSliceDXF(slice) {
  return generateDXF([slice]);
}

/**
 * Exports nested sheet as DXF string.
 */
export function exportSheetDXF(sheet) {
  const items = sheet.items.map(item => ({
    polygon: item.placedPolygon,
    label: item.label,
    x: item.x,
    y: item.y
  }));

  // Add sheet border as reference
  items.unshift({
    polygon: [
      { x: 0, y: 0 },
      { x: sheet.sheetWidth, y: 0 },
      { x: sheet.sheetWidth, y: sheet.sheetHeight },
      { x: 0, y: sheet.sheetHeight },
      { x: 0, y: 0 }
    ],
    label: `SHEET-${sheet.sheetIndex} (${sheet.sheetWidth}x${sheet.sheetHeight}mm)`
  });

  return generateDXF(items);
}
