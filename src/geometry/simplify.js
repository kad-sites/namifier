/**
 * Douglas-Peucker 2D polyline simplification.
 * @param {Array<{x: number, y: number}>} points 
 * @param {number} tolerance in mm (e.g. 0.1)
 * @returns {Array<{x: number, y: number}>} simplified points
 */
export function simplifyPolyline(points, tolerance = 0.1) {
  if (!points || points.length <= 2) return points ? [...points] : [];

  const sqTolerance = tolerance * tolerance;

  function getSqDistToSegment(p, p1, p2) {
    let x = p1.x;
    let y = p1.y;
    let dx = p2.x - x;
    let dy = p2.y - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2.x;
        y = p2.y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }

    dx = p.x - x;
    dy = p.y - y;
    return dx * dx + dy * dy;
  }

  function dpStep(firstIdx, lastIdx) {
    let maxSqDist = 0;
    let index = firstIdx;

    for (let i = firstIdx + 1; i < lastIdx; i++) {
      const sqDist = getSqDistToSegment(points[i], points[firstIdx], points[lastIdx]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTolerance) {
      const recResults1 = dpStep(firstIdx, index);
      const recResults2 = dpStep(index, lastIdx);
      // Concatenate, avoiding duplicate midpoint
      return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
    } else {
      return [points[firstIdx], points[lastIdx]];
    }
  }

  return dpStep(0, points.length - 1);
}
