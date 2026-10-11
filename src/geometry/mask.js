import opentype from 'opentype.js';

/**
 * Manages offscreen rasterization of text, SVG, or images into a blurred 0..1 mask.
 */
export class LogoMaskGenerator {
  constructor(size = 1024) {
    this.canvasSize = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.maskData = null; // Float32Array of normalized values [0..1]
    this.maskWidth = size;
    this.maskHeight = size;
  }

  /**
   * Fast 1D box blur passes to approximate Gaussian blur with high performance.
   */
  applyBoxBlur(src, w, h, radius) {
    if (radius <= 0) return src;
    const dest = new Float32Array(src.length);
    const r = Math.round(radius);

    // Horizontal pass
    for (let y = 0; y < h; y++) {
      const yOffset = y * w;
      let sum = 0;
      let count = 0;

      // Initialize window
      for (let x = -r; x <= r; x++) {
        if (x >= 0 && x < w) {
          sum += src[yOffset + x];
          count++;
        }
      }

      for (let x = 0; x < w; x++) {
        dest[yOffset + x] = sum / count;

        // Slide window
        const nextX = x + r + 1;
        if (nextX < w) {
          sum += src[yOffset + nextX];
          count++;
        }
        const prevX = x - r;
        if (prevX >= 0) {
          sum -= src[yOffset + prevX];
          count--;
        }
      }
    }

    // Vertical pass
    const finalDest = new Float32Array(src.length);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;

      for (let y = -r; y <= r; y++) {
        if (y >= 0 && y < h) {
          sum += dest[y * w + x];
          count++;
        }
      }

      for (let y = 0; y < h; y++) {
        finalDest[y * w + x] = sum / count;

        const nextY = y + r + 1;
        if (nextY < h) {
          sum += dest[nextY * w + x];
          count++;
        }
        const prevY = y - r;
        if (prevY >= 0) {
          sum -= dest[prevY * w + x];
          count--;
        }
      }
    }

    return finalDest;
  }

  /**
   * Rasterizes text using either an opentype.js font object or standard Canvas fonts.
   */
  async rasterizeText(text, options = {}) {
    const {
      font = null, // opentype.js Font object if available
      fontFamily = 'Impact, sans-serif',
      fontSizeFraction = 0.55,
      edgeSoftness = 3,
      bold = true,
      scaleX = 1.0,
      scaleY = 1.0
    } = options;

    const w = this.canvasSize;
    const h = this.canvasSize;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);

    if (!text || text.trim().length === 0) {
      this.maskData = new Float32Array(w * h);
      return;
    }

    if (font && font.getPath) {
      // Use opentype.js vector path rendering
      const fontSize = w * fontSizeFraction;
      const path = font.getPath(text, 0, 0, fontSize);
      const bbox = path.getBoundingBox();
      const textW = bbox.x2 - bbox.x1;
      const textH = bbox.y2 - bbox.y1;

      const offsetX = (w - textW * scaleX) / 2 - bbox.x1 * scaleX;
      const offsetY = (h + textH * scaleY) / 2 - bbox.y2 * scaleY;

      this.ctx.save();
      this.ctx.translate(offsetX, offsetY);
      this.ctx.scale(scaleX, scaleY);
      this.ctx.fillStyle = '#ffffff';
      path.draw(this.ctx);
      this.ctx.restore();
    } else {
      // Canvas text fallback
      const fontSize = Math.round(w * fontSizeFraction);
      this.ctx.save();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
      this.ctx.translate(w / 2, h / 2);
      this.ctx.scale(scaleX, scaleY);
      this.ctx.fillText(text, 0, 0);
      this.ctx.restore();
    }

    this.extractAndBlurMask(edgeSoftness);
  }

  /**
   * Rasterizes an Image or SVG element.
   */
  rasterizeImage(imageElement, options = {}) {
    const {
      threshold = 128,
      invert = false,
      edgeSoftness = 3,
      paddingFraction = 0.1
    } = options;

    const w = this.canvasSize;
    const h = this.canvasSize;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, w, h);

    const maxDim = w * (1 - 2 * paddingFraction);
    const aspect = imageElement.width / imageElement.height;
    let drawW, drawH;
    if (aspect >= 1) {
      drawW = maxDim;
      drawH = maxDim / aspect;
    } else {
      drawH = maxDim;
      drawW = maxDim * aspect;
    }

    const drawX = (w - drawW) / 2;
    const drawY = (h - drawH) / 2;

    this.ctx.drawImage(imageElement, drawX, drawY, drawW, drawH);

    // Apply thresholding to create solid mask
    const imgData = this.ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Calculate luminance
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const alpha = data[i + 3] / 255;
      const val = (lum * alpha >= threshold) ? 255 : 0;
      const finalVal = invert ? (255 - val) : val;
      data[i] = finalVal;
      data[i + 1] = finalVal;
      data[i + 2] = finalVal;
      data[i + 3] = 255;
    }
    this.ctx.putImageData(imgData, 0, 0);

    this.extractAndBlurMask(edgeSoftness);
  }

  /**
   * Extracts grayscale values from canvas and applies 3-pass Gaussian blur approximation.
   */
  extractAndBlurMask(edgeSoftness) {
    const w = this.canvasSize;
    const h = this.canvasSize;
    const imgData = this.ctx.getImageData(0, 0, w, h).data;
    const raw = new Float32Array(w * h);

    for (let i = 0, j = 0; i < imgData.length; i += 4, j++) {
      raw[j] = imgData[i] / 255.0; // 0..1
    }

    if (edgeSoftness <= 0.5) {
      this.maskData = raw;
      return;
    }

    // 3 passes of box blur = Gaussian approximation
    const r = Math.max(1, edgeSoftness * 2.5);
    let blurred = this.applyBoxBlur(raw, w, h, r);
    blurred = this.applyBoxBlur(blurred, w, h, r);
    blurred = this.applyBoxBlur(blurred, w, h, r);

    this.maskData = blurred;
  }

  /**
   * Bilinear sampling of mask at normalized (u, v) in [0, 1].
   */
  sample(u, v) {
    if (!this.maskData) return 0;
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0;

    const w = this.canvasSize;
    const h = this.canvasSize;

    const x = u * (w - 1);
    const y = v * (h - 1);

    const x0 = Math.floor(x);
    const x1 = Math.min(w - 1, x0 + 1);
    const y0 = Math.floor(y);
    const y1 = Math.min(h - 1, y0 + 1);

    const fx = x - x0;
    const fy = y - y0;

    const v00 = this.maskData[y0 * w + x0];
    const v10 = this.maskData[y0 * w + x1];
    const v01 = this.maskData[y1 * w + x0];
    const v11 = this.maskData[y1 * w + x1];

    const top = v00 * (1 - fx) + v10 * fx;
    const bottom = v01 * (1 - fx) + v11 * fx;

    return top * (1 - fy) + bottom * fy;
  }
}
