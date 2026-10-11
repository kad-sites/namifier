# Parametric Wave Logo Slicer 🌊

An advanced browser-based parametric CAD & CAM tool for generating **sliced-rib 3D wall art signs** with embossed logos on wavy surfaces, complete with real-time 3D preview and CNC-ready export files.

Inspired by acoustic architectural wooden fin walls and commercial dimensional signage.

---

## ✨ Features

### 1. Logo & Artwork Input
- **Text Engine**: Live text input with font selection and custom TTF/OTF font upload support (powered by `opentype.js`).
- **Image / SVG Upload**: Upload custom vector SVG or PNG logos, automatically thresholded into a high-contrast mask.
- **Edge Softness**: 3-pass Gaussian blur filter with variable blur radius to give smooth, organic bevels to the embossed logo.
- **Invert Mode**: Toggle between raised (embossed) or recessed (engraved) lettering.

### 2. Parametric Wave Geometry
- **Wave Types**:
  - **Natural Sine**: Classic organic undulation.
  - **Double Sine**: Multi-harmonic wave profile for dynamic rippling.
  - **Perlin / Simplex Noise**: Multi-octave procedural terrain curves.
- **Edge Falloff**: Smoothstep dampening factor that gracefully flattens wave amplitude toward the outer edges.
- **Surface Smoothing**: Moving-average filter along sampled profile points to eliminate CNC chatter and ensure smooth cutter paths.

### 3. Slicing & Interlocking Spine Rails
- **Pitch Calculation**: Plate thickness $t$ (default 6 mm) + gap $g$ (default 4 mm) $\rightarrow \text{pitch} = 10\text{ mm}$.
- **Dual Direction**: Vertical fins (like vertical acoustic louvers) or Horizontal fins.
- **Spine Rails Matrix**: Optional interlocking back rails that slot perpendicularly into every rib at exact pitch intervals with CNC tolerance compensation (default 0.2 mm fit clearance).
- **Back Profile**: Choose between flat back mounting or offset floating fins.
- **Douglas-Peucker Simplification**: Geometry is simplified at 0.1 mm tolerance, reducing DXF polyline node count by up to 80% without losing curve fidelity.

### 4. Interactive 3D Viewport
- **Three.js + OrbitControls**: Smooth inspection, pan, orbit, and zoom.
- **Realistic Materials**: Warm birch / oak architectural wood finish, soft shadows, and concrete backdrop wall.
- **View Modes**:
  - **🏢 Assembled**: Realistic in-situ wall preview.
  - **💥 Exploded**: Animated slider expanding rib spacing to inspect individual profiles and spine joints.
  - **📐 Wireframe**: Inspect raw CNC cut polyline vertices.
- **Web Worker**: Heavy sampling and geometric calculation runs off-thread for a smooth 60 FPS UI.

### 5. CNC & Laser Production Exports
- **DXF (AutoCAD 2000 AC1015)**: Clean `LWPOLYLINE` cut paths on layer `CUTS`, with slice numbering on layer `LABELS`. Tested and validated with standard CAD parsers.
- **SVG**: Metric millimeter vector files per-slice and per-sheet.
- **Nesting Engine**: 2D bin-packing algorithm that nests all slices onto standard sheet stock (1220x2440 mm or 2400x1200 mm) with configurable kerf and part spacing.
- **CNC G-code**: 2D profile cuts with tool diameter compensation, multi-pass stepdown, and holding tabs/bridges.
- **3D Files**: Assembled STL and GLB binary model exports.
- **Production ZIP Package**: Complete ZIP download containing all individual slice DXFs/SVGs, nested sheet layouts, spine rails, and assembly instructions.

---

## 🚀 Getting Started

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### Run Automated Tests
Verifies DXF compliance, layer conventions, polygon closure, and slice count math:
```bash
npm test
```

### Production Build
```bash
npm run build
```
Build output is generated in `dist/`, ready for Vercel, Netlify, or static hosting.

---

## 🛠️ CNC Machining & Fabrication Guide

1. **Material Selection**: 6 mm or 9 mm Baltic Birch Plywood or MDF produces the best balance of rigidity and acoustic aesthetics.
2. **Bit Selection**: Use a 1/8" (3.175 mm) or 1/4" (6.35 mm) downcut spiral bit to prevent tearout on top veneer surfaces.
3. **Holding Tabs**: When using router CNCs, configure 2-3 tabs per rib so parts stay anchored until the full sheet is cut.
4. **Assembly**:
   - Lay out the 2 interlocking spine rails.
   - Insert ribs sequentially from `#1` to `#N` into their designated slots.
   - Secure with wood glue or back screws.
