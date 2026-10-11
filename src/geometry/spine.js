/**
 * Computes interlocking spine rails with slots to hold slices rigidly at exact pitch.
 */
export function generateSpineRails(slices, params) {
  const {
    enabled = true,
    numRails = 2,
    slotDepth = 15,
    tolerance = 0.2,
    sheetThickness = 6,
    sliceDirection = 'vertical',
    width = 1200,
    height = 400,
    baseDepth = 20,
    pitch = 10
  } = params;

  if (!enabled || numRails <= 0 || !slices || slices.length === 0) {
    return [];
  }

  const rails = [];
  const spineThickness = sheetThickness;
  const spineHeight = Math.max(30, slotDepth * 2.2); // Spine rail height
  const railLength = (sliceDirection === 'vertical') ? width : height;
  const ribLength = (sliceDirection === 'vertical') ? height : width;

  // Calculate rail positions along the rib length
  const railPositions = [];
  for (let r = 0; r < numRails; r++) {
    // Distribute evenly with margin from ends
    const fraction = (r + 1) / (numRails + 1);
    railPositions.push(ribLength * fraction);
  }

  // Build each spine rail polygon
  for (let r = 0; r < numRails; r++) {
    const railPosOnRib = railPositions[r];
    const railPoints = [];

    // Top edge with slots for each slice
    // Base rail is a rectangle [0, 0] to [railLength, spineHeight]
    // Slots are cut down from top edge (y = spineHeight) downwards by slotDepth
    const slotW = sheetThickness + tolerance;

    railPoints.push({ x: 0, y: 0 }); // Bottom-left

    // Bottom edge
    railPoints.push({ x: railLength, y: 0 }); // Bottom-right
    railPoints.push({ x: railLength, y: spineHeight }); // Top-right

    // Top edge going right-to-left, cutting slots for each slice
    for (let i = slices.length - 1; i >= 0; i--) {
      const slice = slices[i];
      const sliceCenter = slice.position;
      const slotLeft = Math.max(0, sliceCenter - slotW / 2);
      const slotRight = Math.min(railLength, sliceCenter + slotW / 2);

      // Point before slot
      railPoints.push({ x: slotRight, y: spineHeight });
      // Slot bottom-right
      railPoints.push({ x: slotRight, y: spineHeight - slotDepth });
      // Slot bottom-left
      railPoints.push({ x: slotLeft, y: spineHeight - slotDepth });
      // Point after slot
      railPoints.push({ x: slotLeft, y: spineHeight });
    }

    railPoints.push({ x: 0, y: spineHeight }); // Top-left
    railPoints.push({ x: 0, y: 0 }); // Close polygon

    rails.push({
      id: `spine_${r + 1}`,
      label: `SPINE-RAIL-#${r + 1}`,
      railIndex: r + 1,
      posOnRib: railPosOnRib,
      length: railLength,
      height: spineHeight,
      thickness: spineThickness,
      polygon: railPoints
    });
  }

  return rails;
}

/**
 * Returns the slot intervals along the rib's back edge.
 */
export function getRibSlotIntervals(ribLength, params) {
  const {
    spineEnabled = true,
    numRails = 2,
    slotDepth = 15,
    tolerance = 0.2,
    sheetThickness = 6
  } = params;

  if (!spineEnabled || numRails <= 0) return [];

  const slots = [];
  const slotW = sheetThickness + tolerance;

  for (let r = 0; r < numRails; r++) {
    const fraction = (r + 1) / (numRails + 1);
    const center = ribLength * fraction;
    slots.push({
      center,
      start: center - slotW / 2,
      end: center + slotW / 2,
      depth: slotDepth,
      railIndex: r + 1
    });
  }

  return slots;
}
