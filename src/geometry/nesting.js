/**
 * 2D Shelf/Guillotine bin-packer for nesting rib slices onto standard CNC sheet stock.
 */
export function nestSlicesOnSheets(slices, options = {}) {
  const {
    sheetWidth = 1220,
    sheetHeight = 2440,
    partSpacing = 6,
    kerfOffset = 0,
    margin = 10
  } = options;

  const effectiveSpacing = partSpacing + kerfOffset;
  const usableW = sheetWidth - 2 * margin;
  const usableH = sheetHeight - 2 * margin;

  // Prepare items with bounding boxes
  const items = slices.map(slice => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (let p of slice.polygon) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    return {
      slice,
      minX,
      minY,
      w,
      h,
      polygon: slice.polygon
    };
  });

  // Sort descending by height / length to optimize shelf packing
  items.sort((a, b) => (b.h * b.w) - (a.h * a.w));

  const sheets = [];

  function createNewSheet() {
    const sheet = {
      sheetIndex: sheets.length + 1,
      sheetWidth,
      sheetHeight,
      margin,
      items: [],
      // Shelf packing state
      shelves: [] // Array of { y, height, currentX }
    };
    sheets.push(sheet);
    return sheet;
  }

  let currentSheet = createNewSheet();

  for (const item of items) {
    let placed = false;

    // Try placing in existing sheets
    for (const sheet of sheets) {
      // Try existing shelves
      for (const shelf of sheet.shelves) {
        // Option 1: Unrotated (w x h)
        if (shelf.currentX + item.w <= usableW && item.h <= shelf.height) {
          shelf.items = shelf.items || [];
          sheet.items.push({
            slice: item.slice,
            label: item.slice.label,
            x: margin + shelf.currentX,
            y: margin + shelf.y,
            w: item.w,
            h: item.h,
            rotated: false,
            placedPolygon: transformPolygon(item.polygon, item.minX, item.minY, margin + shelf.currentX, margin + shelf.y, false)
          });
          shelf.currentX += item.w + effectiveSpacing;
          placed = true;
          break;
        }

        // Option 2: Rotated 90 deg (h x w)
        if (shelf.currentX + item.h <= usableW && item.w <= shelf.height) {
          shelf.items = shelf.items || [];
          sheet.items.push({
            slice: item.slice,
            label: item.slice.label,
            x: margin + shelf.currentX,
            y: margin + shelf.y,
            w: item.h,
            h: item.w,
            rotated: true,
            placedPolygon: transformPolygon(item.polygon, item.minX, item.minY, margin + shelf.currentX, margin + shelf.y, true)
          });
          shelf.currentX += item.h + effectiveSpacing;
          placed = true;
          break;
        }
      }

      if (placed) break;

      // Try creating a new shelf in this sheet
      const currentSheetH = sheet.shelves.reduce((acc, s) => Math.max(acc, s.y + s.height + effectiveSpacing), 0);
      
      // Try unrotated
      if (item.w <= usableW && currentSheetH + item.h <= usableH) {
        const newShelf = {
          y: currentSheetH,
          height: item.h,
          currentX: item.w + effectiveSpacing
        };
        sheet.shelves.push(newShelf);
        sheet.items.push({
          slice: item.slice,
          label: item.slice.label,
          x: margin,
          y: margin + newShelf.y,
          w: item.w,
          h: item.h,
          rotated: false,
          placedPolygon: transformPolygon(item.polygon, item.minX, item.minY, margin, margin + newShelf.y, false)
        });
        placed = true;
        break;
      }

      // Try rotated
      if (item.h <= usableW && currentSheetH + item.w <= usableH) {
        const newShelf = {
          y: currentSheetH,
          height: item.w,
          currentX: item.h + effectiveSpacing
        };
        sheet.shelves.push(newShelf);
        sheet.items.push({
          slice: item.slice,
          label: item.slice.label,
          x: margin,
          y: margin + newShelf.y,
          w: item.h,
          h: item.w,
          rotated: true,
          placedPolygon: transformPolygon(item.polygon, item.minX, item.minY, margin, margin + newShelf.y, true)
        });
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Start a fresh sheet
      const newSheet = createNewSheet();
      const newShelf = {
        y: 0,
        height: item.h,
        currentX: item.w + effectiveSpacing
      };
      newSheet.shelves.push(newShelf);
      newSheet.items.push({
        slice: item.slice,
        label: item.slice.label,
        x: margin,
        y: margin,
        w: item.w,
        h: item.h,
        rotated: false,
        placedPolygon: transformPolygon(item.polygon, item.minX, item.minY, margin, margin, false)
      });
    }
  }

  // Calculate statistics for each sheet
  const totalSheetAreaM2 = (sheetWidth * sheetHeight * sheets.length) / 1000000;
  let totalPartAreaM2 = 0;

  for (const sheet of sheets) {
    let sheetPartArea = 0;
    for (const item of sheet.items) {
      sheetPartArea += (item.w * item.h) / 1000000;
    }
    sheet.usedAreaM2 = sheetPartArea;
    sheet.utilization = Math.round((sheetPartArea / ((sheetWidth * sheetHeight) / 1000000)) * 100);
    totalPartAreaM2 += sheetPartArea;
  }

  return {
    sheets,
    sheetCount: sheets.length,
    totalSheetAreaM2,
    totalPartAreaM2,
    overallUtilization: Math.round((totalPartAreaM2 / totalSheetAreaM2) * 100)
  };
}

function transformPolygon(polygon, minX, minY, targetX, targetY, rotated) {
  return polygon.map(p => {
    const localX = p.x - minX;
    const localY = p.y - minY;
    if (rotated) {
      // 90 degree clockwise rotation
      return {
        x: targetX + localY,
        y: targetY + localX
      };
    } else {
      return {
        x: targetX + localX,
        y: targetY + localY
      };
    }
  });
}
