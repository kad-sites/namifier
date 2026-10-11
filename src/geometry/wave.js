import { createNoise2D } from 'simplex-noise';

// Seeded noise instance
let noise2D = createNoise2D();

export function reseedNoise() {
  noise2D = createNoise2D();
}

/**
 * Calculates edge falloff factor (1 in center, decays to 0 at borders if falloff > 0).
 */
export function calculateEdgeFalloff(x, y, width, height, falloff) {
  if (!falloff || falloff <= 0) return 1.0;

  // Normalized coordinates in [0, 1]
  const nx = Math.max(0, Math.min(1, x / width));
  const ny = Math.max(0, Math.min(1, y / height));

  // Distance to nearest edge in [0, 0.5]
  const edgeDistX = Math.min(nx, 1.0 - nx);
  const edgeDistY = Math.min(ny, 1.0 - ny);

  // Falloff margin (fraction of dimension, e.g. 0.25)
  const margin = Math.min(0.4, 0.5 * falloff);
  if (margin <= 0) return 1.0;

  const factorX = edgeDistX < margin ? Math.sin((edgeDistX / margin) * (Math.PI / 2)) : 1.0;
  const factorY = edgeDistY < margin ? Math.sin((edgeDistY / margin) * (Math.PI / 2)) : 1.0;

  const combined = factorX * factorY;
  // Blend between 1.0 (no falloff) and combined
  return (1.0 - falloff) + falloff * combined;
}

/**
 * Evaluates the base wave heightfield at (x, y) in mm.
 */
export function evaluateBaseWave(x, y, params) {
  const {
    amplitude = 25,
    wavelengthX = 300,
    wavelengthY = 250,
    phase = 0,
    waveType = 'sine',
    falloff = 0.5,
    width = 1200,
    height = 400
  } = params;

  if (amplitude === 0) return 0;

  const phaseRad = (phase * Math.PI) / 180;
  const kx = (2 * Math.PI) / Math.max(10, wavelengthX);
  const ky = (2 * Math.PI) / Math.max(10, wavelengthY);

  let rawWave = 0;

  if (waveType === 'sine') {
    // Elegant organic undulation
    rawWave = Math.sin(x * kx + phaseRad) * Math.cos(y * ky);
  } else if (waveType === 'double_sine') {
    // Secondary harmonic for richer rippling
    const primary = Math.sin(x * kx + phaseRad) * Math.cos(y * ky);
    const secondary = 0.45 * Math.sin(x * kx * 2.1 + phaseRad * 1.5 + y * ky * 0.7);
    rawWave = (primary + secondary) / 1.45;
  } else if (waveType === 'noise') {
    // Multi-octave simplex noise
    const scaleX = 1 / Math.max(20, wavelengthX);
    const scaleY = 1 / Math.max(20, wavelengthY);
    const n1 = noise2D(x * scaleX, y * scaleY);
    const n2 = 0.5 * noise2D(x * scaleX * 2.3 + 12.3, y * scaleY * 2.3 + 45.6);
    rawWave = (n1 + n2) / 1.5;
  } else {
    rawWave = Math.sin(x * kx + phaseRad);
  }

  const falloffMultiplier = calculateEdgeFalloff(x, y, width, height, falloff);
  return amplitude * rawWave * falloffMultiplier;
}
