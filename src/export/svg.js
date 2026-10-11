/**
 * Generates vector SVG files for CNC laser/router cutting.
 */
export function generateSingleSliceSVG(slice, options = {}) {
  const polygon = slice.polygon;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (let p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const margin = 10;
  const width = Math.ceil(maxX - minX + 2 * margin);
  const height = Math.ceil(maxY - minY + 2 * margin);

  // SVG coordinates: y is inverted compared to CAD, so we map y accordingly
  const pathD = polygon.map((p, idx) => {
    const sx = (p.x - minX + margin).toFixed(2);
    const sy = (height - (p.y - minY + margin)).toFixed(2);
    return `${idx === 0 ? 'M' : 'L'} ${sx} ${sy}`;
  }).join(' ') + ' Z';

  const textX = (margin + 15).toFixed(2);
  const textY = (height - margin - 15).toFixed(2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${width}mm" height="${height}mm" 
     viewBox="0 0 ${width} ${height}">
  <title>${slice.label}</title>
  <style>
    .cut { fill: none; stroke: #ff0000; stroke-width: 0.5px; }
    .label { font-family: monospace; font-size: 10px; fill: #0000ff; }
  </style>
  <path class="cut" d="${pathD}" />
  <text class="label" x="${textX}" y="${textY}">${slice.label}</text>
</svg>`;
}

export function generateSheetSVG(sheet) {
  const { sheetWidth, sheetHeight, sheetIndex, items } = sheet;

  let paths = '';
  let labels = '';

  for (const item of items) {
    const polygon = item.placedPolygon;
    const pathD = polygon.map((p, idx) => {
      const sx = p.x.toFixed(2);
      const sy = (sheetHeight - p.y).toFixed(2);
      return `${idx === 0 ? 'M' : 'L'} ${sx} ${sy}`;
    }).join(' ') + ' Z';

    paths += `  <path class="cut" d="${pathD}" />\n`;

    const tx = (item.x + 15).toFixed(2);
    const ty = (sheetHeight - item.y - 10).toFixed(2);
    labels += `  <text class="label" x="${tx}" y="${ty}">${item.label}</text>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${sheetWidth}mm" height="${sheetHeight}mm" 
     viewBox="0 0 ${sheetWidth} ${sheetHeight}">
  <title>Sheet ${sheetIndex}</title>
  <style>
    .sheet-border { fill: none; stroke: #888888; stroke-dasharray: 4,4; stroke-width: 1px; }
    .cut { fill: none; stroke: #ff0000; stroke-width: 0.5px; }
    .label { font-family: monospace; font-size: 12px; fill: #0000ff; }
  </style>
  <rect class="sheet-border" x="0" y="0" width="${sheetWidth}" height="${sheetHeight}" />
${paths}
${labels}
</svg>`;
}
