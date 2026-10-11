import { PRESETS } from './presets.js';

export class UIController {
  constructor(callbacks = {}) {
    this.callbacks = callbacks; // onParamChange, onExportZip, onExportSTL, onExportGLB, onResetCamera, onViewModeChange
    this.params = { ...PRESETS.wavy_wall_logo.params };
    this.customFont = null;
    this.customImage = null;
    this.debounceTimer = null;

    this.init();
  }

  init() {
    this.bindCollapsibleSections();
    this.populatePresets();
    this.bindInputs();
    this.bindFileUploads();
    this.bindViewControls();
    this.bindExportActions();
    this.bindSaveLoad();
  }

  bindCollapsibleSections() {
    document.querySelectorAll('.section-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.parentElement;
        section.classList.toggle('collapsed');
      });
    });
  }

  populatePresets() {
    const select = document.getElementById('preset-select');
    if (!select) return;

    select.innerHTML = '';
    for (const [key, preset] of Object.entries(PRESETS)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = preset.name;
      select.appendChild(opt);
    }

    select.addEventListener('change', (e) => {
      const chosen = PRESETS[e.target.value];
      if (chosen) {
        this.params = { ...chosen.params };
        this.syncUIFromParams();
        this.triggerChange(true);
      }
    });
  }

  bindInputs() {
    // Map input IDs to param properties
    const bindings = [
      { id: 'logo-text-input', prop: 'logoText', type: 'string' },
      { id: 'font-family-select', prop: 'fontFamily', type: 'string' },
      { id: 'sign-width', prop: 'width', type: 'float' },
      { id: 'sign-height', prop: 'height', type: 'float' },
      { id: 'sheet-thickness', prop: 'sheetThickness', type: 'float' },
      { id: 'rib-gap', prop: 'gap', type: 'float' },
      { id: 'base-depth', prop: 'baseDepth', type: 'float' },
      { id: 'emboss-depth', prop: 'embossDepth', type: 'float' },
      { id: 'invert-emboss', prop: 'invertEmboss', type: 'bool' },
      { id: 'wave-type', prop: 'waveType', type: 'string' },
      { id: 'wave-amplitude', prop: 'amplitude', type: 'float' },
      { id: 'wavelength-x', prop: 'wavelengthX', type: 'float' },
      { id: 'wavelength-y', prop: 'wavelengthY', type: 'float' },
      { id: 'wave-phase', prop: 'phase', type: 'float' },
      { id: 'wave-falloff', prop: 'falloff', type: 'float' },
      { id: 'edge-softness', prop: 'edgeSoftness', type: 'float' },
      { id: 'surface-smoothing', prop: 'surfaceSmoothing', type: 'int' },
      { id: 'back-profile', prop: 'backProfile', type: 'string' },
      { id: 'spine-enabled', prop: 'spineEnabled', type: 'bool' },
      { id: 'spine-rails', prop: 'numRails', type: 'int' },
      { id: 'slot-depth', prop: 'slotDepth', type: 'float' },
      { id: 'slot-tolerance', prop: 'tolerance', type: 'float' },
      { id: 'sheet-size-preset', prop: 'sheetSize', type: 'string' },
      { id: 'part-spacing', prop: 'partSpacing', type: 'float' },
      { id: 'kerf-offset', prop: 'kerfOffset', type: 'float' },
      { id: 'sheet-cost', prop: 'costPerSheet', type: 'float' }
    ];

    bindings.forEach(({ id, prop, type }) => {
      const el = document.getElementById(id);
      if (!el) return;

      const handler = () => {
        if (type === 'bool') {
          this.params[prop] = el.checked;
        } else if (type === 'float') {
          this.params[prop] = parseFloat(el.value) || 0;
        } else if (type === 'int') {
          this.params[prop] = parseInt(el.value, 10) || 0;
        } else {
          this.params[prop] = el.value;
        }

        // Special handling for sheet size preset
        if (id === 'sheet-size-preset') {
          if (el.value === '1220x2440') {
            this.params.sheetWidth = 1220;
            this.params.sheetHeight = 2440;
          } else if (el.value === '2400x1200') {
            this.params.sheetWidth = 2400;
            this.params.sheetHeight = 1200;
          }
        }

        // Sync slider & number inputs paired
        const valDisplay = document.getElementById(`${id}-val`);
        if (valDisplay) valDisplay.textContent = el.value;

        // Auto update pitch calculation
        this.updatePitchIndicator();
        this.triggerChange(false);
      };

      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });

    // Direction radio buttons
    document.querySelectorAll('.dir-radio').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dir-radio').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.params.sliceDirection = btn.dataset.direction;
        this.triggerChange(true);
      });
    });
  }

  updatePitchIndicator() {
    const pitch = (this.params.sheetThickness || 6) + (this.params.gap || 4);
    const indicator = document.getElementById('pitch-indicator');
    if (indicator) {
      indicator.textContent = `${pitch.toFixed(1)} mm`;
    }
  }

  syncUIFromParams() {
    for (const [key, value] of Object.entries(this.params)) {
      // Find element matching key or pattern
      const el = document.querySelector(`[data-param="${key}"]`) || document.getElementById(key);
      if (!el) continue;

      if (el.type === 'checkbox') {
        el.checked = Boolean(value);
      } else {
        el.value = value;
      }

      const valDisplay = document.getElementById(`${el.id}-val`);
      if (valDisplay) valDisplay.textContent = value;
    }

    // Direction buttons
    document.querySelectorAll('.dir-radio').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.direction === this.params.sliceDirection);
    });

    this.updatePitchIndicator();
  }

  bindFileUploads() {
    // Custom Font Upload
    const fontDropzone = document.getElementById('font-dropzone');
    const fontInput = document.getElementById('font-file-input');

    if (fontDropzone && fontInput) {
      fontDropzone.addEventListener('click', () => fontInput.click());
      fontInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          this.handleFontFile(file);
        }
      });
    }

    // SVG / PNG Logo Upload
    const logoDropzone = document.getElementById('logo-dropzone');
    const logoInput = document.getElementById('logo-file-input');

    if (logoDropzone && logoInput) {
      logoDropzone.addEventListener('click', () => logoInput.click());
      logoInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          this.handleImageFile(file);
        }
      });
    }
  }

  handleFontFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      import('opentype.js').then(({ default: opentype }) => {
        try {
          const font = opentype.parse(e.target.result);
          this.customFont = font;
          const label = document.getElementById('font-filename');
          if (label) label.textContent = file.name;
          this.triggerChange(true);
        } catch (err) {
          alert('Error parsing TTF/OTF font file: ' + err.message);
        }
      });
    };
    reader.readAsArrayBuffer(file);
  }

  handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.customImage = img;
        const label = document.getElementById('logo-filename');
        if (label) label.textContent = file.name;
        this.triggerChange(true);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  bindViewControls() {
    document.querySelectorAll('.viewport-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.viewport-btn[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        if (this.callbacks.onViewModeChange) {
          this.callbacks.onViewModeChange(mode);
        }
      });
    });

    const resetCamBtn = document.getElementById('reset-camera-btn');
    if (resetCamBtn && this.callbacks.onResetCamera) {
      resetCamBtn.addEventListener('click', () => this.callbacks.onResetCamera());
    }

    const explodeSlider = document.getElementById('exploded-slider');
    if (explodeSlider && this.callbacks.onExplodeChange) {
      explodeSlider.addEventListener('input', (e) => {
        this.callbacks.onExplodeChange(parseFloat(e.target.value));
      });
    }
  }

  bindExportActions() {
    const btnZip = document.getElementById('export-zip-btn');
    if (btnZip && this.callbacks.onExportZip) {
      btnZip.addEventListener('click', () => this.callbacks.onExportZip());
    }

    const btnSTL = document.getElementById('export-stl-btn');
    if (btnSTL && this.callbacks.onExportSTL) {
      btnSTL.addEventListener('click', () => this.callbacks.onExportSTL());
    }

    const btnGLB = document.getElementById('export-glb-btn');
    if (btnGLB && this.callbacks.onExportGLB) {
      btnGLB.addEventListener('click', () => this.callbacks.onExportGLB());
    }
  }

  bindSaveLoad() {
    const saveBtn = document.getElementById('save-project-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const jsonStr = JSON.stringify(this.params, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wave_sign_${this.params.logoText || 'project'}.json`;
        a.click();
      });
    }

    const loadInput = document.getElementById('load-project-input');
    const loadBtn = document.getElementById('load-project-btn');
    if (loadBtn && loadInput) {
      loadBtn.addEventListener('click', () => loadInput.click());
      loadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const loaded = JSON.parse(ev.target.result);
              this.params = { ...this.params, ...loaded };
              this.syncUIFromParams();
              this.triggerChange(true);
            } catch (err) {
              alert('Invalid project JSON file');
            }
          };
          reader.readAsText(file);
        }
      });
    }
  }

  triggerChange(immediate = false) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const run = () => {
      if (this.callbacks.onParamChange) {
        this.callbacks.onParamChange({
          params: this.params,
          customFont: this.customFont,
          customImage: this.customImage
        });
      }
    };

    if (immediate) {
      run();
    } else {
      this.debounceTimer = setTimeout(run, 120);
    }
  }
}
