import { LogoMaskGenerator } from './geometry/mask.js';
import { Scene3DViewer } from './viewer/scene3d.js';
import { UIController } from './ui/controls.js';
import { calculateStatsAndWarnings } from './ui/stats.js';
import { createProductionZip } from './export/zip.js';
import { exportAssembledSTL } from './export/stl.js';
import { exportAssembledGLB } from './export/glb.js';

class App {
  constructor() {
    this.maskGenerator = new LogoMaskGenerator(1024);
    this.viewer = null;
    this.ui = null;
    this.worker = null;
    this.currentSlices = [];
    this.currentSpineRails = [];
    this.currentNestedResult = null;
    this.currentParams = null;
    this.isComputing = false;
    this.pendingCompute = false;

    this.init();
  }

  init() {
    const container = document.getElementById('canvas-3d-container');
    this.viewer = new Scene3DViewer(container);

    // Initialize Web Worker
    this.initWorker();

    // Initialize UI Controller
    this.ui = new UIController({
      onParamChange: (data) => this.handleParamChange(data),
      onViewModeChange: (mode) => this.viewer.setViewMode(mode),
      onExplodeChange: (val) => this.viewer.setExplodedFactor(val),
      onResetCamera: () => this.resetCamera(),
      onExportZip: () => this.exportZip(),
      onExportSTL: () => this.exportSTL(),
      onExportGLB: () => this.exportGLB()
    });

    // Initial render
    this.ui.triggerChange(true);
  }

  initWorker() {
    this.worker = new Worker(new URL('./worker/slicer.worker.js', import.meta.url), {
      type: 'module'
    });

    this.worker.onmessage = (e) => {
      const { success, slices, spineRails, nestedResult } = e.data;
      this.isComputing = false;

      if (success) {
        this.currentSlices = slices;
        this.currentSpineRails = spineRails;
        this.currentNestedResult = nestedResult;

        // Update 3D Viewer
        this.viewer.updateSlices(slices, spineRails, this.currentParams);

        // Update Stats Panel
        this.updateStatsDisplay();
      }

      if (this.pendingCompute) {
        this.pendingCompute = false;
        this.computeSlices();
      }
    };
  }

  async handleParamChange({ params, customFont, customImage }) {
    this.currentParams = params;

    // Rasterize logo mask
    if (customImage) {
      this.maskGenerator.rasterizeImage(customImage, {
        edgeSoftness: params.edgeSoftness,
        invert: params.invertEmboss
      });
    } else {
      await this.maskGenerator.rasterizeText(params.logoText, {
        font: customFont,
        fontFamily: params.fontFamily,
        edgeSoftness: params.edgeSoftness,
        invert: params.invertEmboss
      });
    }

    this.computeSlices();
  }

  computeSlices() {
    if (this.isComputing) {
      this.pendingCompute = true;
      return;
    }

    this.isComputing = true;

    // Copy mask data to send to worker
    const maskBuffer = this.maskGenerator.maskData ? this.maskGenerator.maskData.buffer.slice(0) : null;

    this.worker.postMessage({
      maskBuffer,
      maskWidth: this.maskGenerator.canvasSize,
      maskHeight: this.maskGenerator.canvasSize,
      params: this.currentParams
    }, maskBuffer ? [maskBuffer] : []);
  }

  updateStatsDisplay() {
    const stats = calculateStatsAndWarnings(
      this.currentSlices,
      this.currentNestedResult,
      this.currentParams
    );

    document.getElementById('stat-slice-count').textContent = stats.sliceCount;
    document.getElementById('stat-sheet-count').textContent = stats.sheetCount;
    document.getElementById('stat-cut-length').textContent = `${stats.totalCutMeters} m`;
    document.getElementById('stat-cost').textContent = `$${stats.totalCost}`;

    // Render warnings
    const warningsContainer = document.getElementById('warnings-hud');
    if (warningsContainer) {
      if (stats.warnings.length === 0) {
        warningsContainer.innerHTML = `<div class="warning-item" style="color: var(--success);">✓ Geometry verified. CNC ready.</div>`;
      } else {
        warningsContainer.innerHTML = stats.warnings.map(w => 
          `<div class="warning-item ${w.type}">⚠ ${w.message}</div>`
        ).join('');
      }
    }
  }

  resetCamera() {
    if (this.viewer && this.viewer.camera) {
      this.viewer.camera.position.set(1200, 700, 1500);
      this.viewer.controls.target.set(0, 0, 40);
      this.viewer.controls.update();
    }
  }

  async exportZip() {
    if (!this.currentSlices || this.currentSlices.length === 0) {
      alert('No slices generated yet.');
      return;
    }

    const modal = document.getElementById('progress-modal');
    const fill = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');

    if (modal) modal.style.display = 'flex';
    if (label) label.textContent = 'Generating DXFs, SVGs, and Nesting Sheets...';

    try {
      const zipBlob = await createProductionZip(
        this.currentSlices,
        this.currentSpineRails,
        this.currentNestedResult,
        this.currentParams,
        (percent) => {
          if (fill) fill.style.width = `${percent}%`;
          if (label) label.textContent = `Packaging CNC Files: ${percent}%`;
        }
      );

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Parametric_Wave_Sign_${this.currentParams.logoText || 'LOGO'}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error creating ZIP: ' + err.message);
    } finally {
      if (modal) modal.style.display = 'none';
    }
  }

  exportSTL() {
    if (!this.viewer || !this.viewer.sliceGroup) return;
    const blob = exportAssembledSTL(this.viewer.sliceGroup);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Assembled_Wave_Sign_${this.currentParams.logoText || 'LOGO'}.stl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async exportGLB() {
    if (!this.viewer || !this.viewer.sliceGroup) return;
    try {
      const blob = await exportAssembledGLB(this.viewer.sliceGroup);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Assembled_Wave_Sign_${this.currentParams.logoText || 'LOGO'}.glb`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error exporting GLB: ' + err.message);
    }
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
