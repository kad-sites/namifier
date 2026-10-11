import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Scene3DViewer {
  constructor(containerElement) {
    this.container = containerElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.sliceGroup = null;
    this.spineGroup = null;
    this.backdrop = null;
    this.sliceMeshes = [];
    this.explodedFactor = 0;
    this.viewMode = 'assembled';

    // Lighting rig references
    this.keySpot = null;
    this.topSpot = null;
    this.fillLight = null;
    this.hemiLight = null;
    this.lightAngle = -45; // degrees around sign center
    this.lightIntensity = 2.4;
    this.edgeBrightness = 1.0;

    this.currentWidth = 1200;
    this.currentHeight = 400;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x131417);

    // Camera (architectural perspective)
    this.camera = new THREE.PerspectiveCamera(36, width / height, 10, 15000);
    this.camera.position.set(700, 450, 950);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 6000;
    this.controls.minDistance = 80;
    this.controls.target.set(0, 0, 35);

    // Groups
    this.sliceGroup = new THREE.Group();
    this.spineGroup = new THREE.Group();
    this.scene.add(this.sliceGroup);
    this.scene.add(this.spineGroup);

    // Lighting & Backdrop
    this.setupLighting();
    this.setupBackdrop();

    // Resize handler
    window.addEventListener('resize', () => this.onWindowResize());

    // Animation Loop
    this.animate();
  }

  setupLighting() {
    // 1. Hemisphere Ambient Light (Warm ceiling, cool floor for natural crevice AO)
    this.hemiLight = new THREE.HemisphereLight(0xfff6ea, 0x1a1c22, 0.45);
    this.scene.add(this.hemiLight);

    // 2. Primary Architectural Rake Spotlight (Key Light)
    // Grazing angle across the sign face to carve out 3D waves & letter relief
    this.keySpot = new THREE.SpotLight(0xffeed8, this.lightIntensity);
    this.keySpot.angle = Math.PI / 3.2;
    this.keySpot.penumbra = 0.55;
    this.keySpot.decay = 1.2;
    this.keySpot.distance = 4500;
    this.keySpot.castShadow = true;
    this.keySpot.shadow.mapSize.width = 2048;
    this.keySpot.shadow.mapSize.height = 2048;
    this.keySpot.shadow.camera.near = 100;
    this.keySpot.shadow.camera.far = 4500;
    this.keySpot.shadow.bias = -0.0003;
    this.keySpot.shadow.normalBias = 0.02;

    this.scene.add(this.keySpot);
    this.scene.add(this.keySpot.target);

    // 3. Top Down Downlight (Accentuates vertical fin crests)
    this.topSpot = new THREE.SpotLight(0xfff5e6, 1.3);
    this.topSpot.position.set(0, 1100, 600);
    this.topSpot.angle = Math.PI / 3.5;
    this.topSpot.penumbra = 0.7;
    this.topSpot.target.position.set(0, 0, 20);
    this.scene.add(this.topSpot);
    this.scene.add(this.topSpot.target);

    // 4. Subtle Cool Fill Light (Prevents crushed pitch-black shadows)
    this.fillLight = new THREE.DirectionalLight(0xb4c8de, 0.45);
    this.fillLight.position.set(900, -300, 700);
    this.scene.add(this.fillLight);

    this.updateKeyLightPosition();
  }

  updateKeyLightPosition() {
    if (!this.keySpot) return;
    const rad = (this.lightAngle * Math.PI) / 180;
    const dist = Math.max(1000, this.currentWidth * 0.95);
    const lx = Math.sin(rad) * dist;
    const ly = Math.cos(rad) * dist * 0.7 + 350;
    const lz = Math.max(500, this.currentHeight * 1.5);

    this.keySpot.position.set(lx, ly, lz);
    this.keySpot.target.position.set(0, 0, 30);
    this.keySpot.intensity = this.lightIntensity;
  }

  setupBackdrop() {
    // Architectural concrete tile wall backdrop
    const wallGeo = new THREE.PlaneGeometry(5000, 3000);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x22242a,
      roughness: 0.88,
      metalness: 0.08
    });
    this.backdrop = new THREE.Mesh(wallGeo, wallMat);
    this.backdrop.position.set(0, 0, -2);
    this.backdrop.receiveShadow = true;
    this.scene.add(this.backdrop);
  }

  createWoodMaterials() {
    if (this.viewMode === 'wireframe') {
      const wire = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true });
      return [wire, wire];
    }

    // Material 0: Side faces of each rib (in the gaps)
    // Darker, rich warm wood tone with higher roughness
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x9e7b54,
      roughness: 0.68,
      metalness: 0.02,
      shadowSide: THREE.DoubleSide
    });

    // Material 1: Front and contour edge faces (the wavy edge facing the viewer with the logo!)
    // Brighter blonde birch / natural oak with satin highlight
    const edgeColor = new THREE.Color(0xf6d6a8).multiplyScalar(this.edgeBrightness);
    const edgeMat = new THREE.MeshStandardMaterial({
      color: edgeColor,
      roughness: 0.36,
      metalness: 0.08,
      shadowSide: THREE.DoubleSide
    });

    return [sideMat, edgeMat];
  }

  createSpineMaterial() {
    if (this.viewMode === 'wireframe') {
      return new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });
    }
    return new THREE.MeshStandardMaterial({
      color: 0x7a5b3a,
      roughness: 0.75,
      metalness: 0.02
    });
  }

  /**
   * Builds 3D extruded geometry for each slice with exact coordinate alignment.
   */
  updateSlices(slices, spineRails, params) {
    this.sliceMeshes = [];
    while (this.sliceGroup.children.length > 0) {
      const obj = this.sliceGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      this.sliceGroup.remove(obj);
    }
    while (this.spineGroup.children.length > 0) {
      const obj = this.spineGroup.children[0];
      if (obj.geometry) obj.geometry.dispose();
      this.spineGroup.remove(obj);
    }

    if (!slices || slices.length === 0) return;

    const {
      width = 1200,
      height = 400,
      sheetThickness = 6,
      sliceDirection = 'vertical'
    } = params;

    this.currentWidth = width;
    this.currentHeight = height;
    this.updateKeyLightPosition();

    const halfW = width / 2;
    const halfH = height / 2;

    const woodMats = this.createWoodMaterials();
    const spineMat = this.createSpineMaterial();

    // Transformation matrix mapping local (x=Height, y=Depth, z=Thickness) to world (Z, X, Y)
    // World X = Local Z (Thickness)
    // World Y = Local X (Height)
    // World Z = Local Y (Depth into the room)
    const vertMatrix = new THREE.Matrix4();
    vertMatrix.set(
      0, 0, 1, 0,
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 0, 1
    );

    for (let i = 0; i < slices.length; i++) {
      const slice = slices[i];
      const pts = slice.polygon;
      if (!pts || pts.length < 3) continue;

      const shape = new THREE.Shape();
      shape.moveTo(pts[0].x, pts[0].y);
      for (let j = 1; j < pts.length; j++) {
        shape.lineTo(pts[j].x, pts[j].y);
      }
      shape.closePath();

      // Extrude by sheetThickness
      const extrudeSettings = {
        steps: 1,
        depth: sheetThickness,
        bevelEnabled: true,
        bevelThickness: 0.35,
        bevelSize: 0.25,
        bevelSegments: 2
      };

      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

      if (sliceDirection === 'vertical') {
        // Apply matrix so Depth points along World +Z, Height along World +Y, Thickness along World +X
        geo.applyMatrix4(vertMatrix);
      } else {
        // Horizontal fins
        const horizMatrix = new THREE.Matrix4();
        horizMatrix.set(
          1, 0, 0, 0,
          0, 0, 1, 0,
          0, 1, 0, 0,
          0, 0, 0, 1
        );
        geo.applyMatrix4(horizMatrix);
      }

      geo.computeVertexNormals();

      // Use dual materials: [sideFaces, frontContourEdge]
      const mesh = new THREE.Mesh(geo, woodMats);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (sliceDirection === 'vertical') {
        mesh.position.set(
          slice.position - halfW,
          -halfH,
          0 // Flush against back wall at Z = 0
        );
      } else {
        mesh.position.set(
          -halfW,
          slice.position - halfH,
          0
        );
      }

      mesh.userData = {
        basePos: mesh.position.clone(),
        sliceIndex: i,
        sliceDirection
      };

      this.sliceMeshes.push(mesh);
      this.sliceGroup.add(mesh);
    }

    // Build 3D interlocking spine rails
    if (spineRails && spineRails.length > 0) {
      for (const rail of spineRails) {
        const pts = rail.polygon;
        if (!pts || pts.length < 3) continue;

        const shape = new THREE.Shape();
        shape.moveTo(pts[0].x, pts[0].y);
        for (let j = 1; j < pts.length; j++) {
          shape.lineTo(pts[j].x, pts[j].y);
        }
        shape.closePath();

        const geo = new THREE.ExtrudeGeometry(shape, {
          steps: 1,
          depth: sheetThickness,
          bevelEnabled: false
        });

        // Spine rail sits flush against the wall interlocking with the slots
        if (sliceDirection === 'vertical') {
          // Rail runs along X (length = width)
          // pts.x is along X, pts.y is slot height
          // Rotate so slots cut from back
          geo.computeVertexNormals();
          const mesh = new THREE.Mesh(geo, spineMat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.position.set(
            -halfW,
            rail.posOnRib - halfH - sheetThickness / 2,
            0
          );
          this.spineGroup.add(mesh);
        }
      }
    }

    this.controls.target.set(0, 0, 35);
    this.updateExplodedView();
  }

  setLightingPreset(presetName) {
    if (presetName === 'etsy_rake') {
      this.lightAngle = -50;
      this.lightIntensity = 2.6;
      this.edgeBrightness = 1.1;
      this.renderer.toneMappingExposure = 1.3;
    } else if (presetName === 'top_spotlight') {
      this.lightAngle = 0;
      this.lightIntensity = 2.2;
      this.edgeBrightness = 1.0;
      this.renderer.toneMappingExposure = 1.2;
    } else if (presetName === 'studio_warm') {
      this.lightAngle = 45;
      this.lightIntensity = 1.8;
      this.edgeBrightness = 0.95;
      this.renderer.toneMappingExposure = 1.15;
    } else if (presetName === 'high_contrast') {
      this.lightAngle = -65;
      this.lightIntensity = 3.2;
      this.edgeBrightness = 1.25;
      this.renderer.toneMappingExposure = 1.4;
    }
    this.updateKeyLightPosition();
    this.refreshMaterials();
  }

  setLightAngle(angleDeg) {
    this.lightAngle = angleDeg;
    this.updateKeyLightPosition();
  }

  setLightIntensity(val) {
    this.lightIntensity = val;
    this.updateKeyLightPosition();
  }

  setEdgeBrightness(val) {
    this.edgeBrightness = val;
    this.refreshMaterials();
  }

  refreshMaterials() {
    const woodMats = this.createWoodMaterials();
    for (const mesh of this.sliceMeshes) {
      mesh.material = woodMats;
    }
  }

  setCameraView(viewName) {
    const w = this.currentWidth;
    const h = this.currentHeight;

    if (viewName === 'showroom') {
      // 3/4 Perspective as in Etsy listing
      this.camera.position.set(w * 0.65, h * 0.7, w * 0.85);
      this.controls.target.set(0, 0, 35);
    } else if (viewName === 'front') {
      // Straight-on elevation
      this.camera.position.set(0, 0, Math.max(1200, w * 1.3));
      this.controls.target.set(0, 0, 35);
    } else if (viewName === 'left_rake') {
      // Steep left perspective catching grazing light
      this.camera.position.set(-w * 0.8, h * 0.4, w * 0.6);
      this.controls.target.set(0, 0, 35);
    } else if (viewName === 'closeup') {
      // Close up of embossed logo
      this.camera.position.set(w * 0.2, h * 0.2, 380);
      this.controls.target.set(0, 0, 45);
    }
    this.controls.update();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.refreshMaterials();

    if (mode === 'exploded') {
      this.explodedFactor = 1.0;
    } else {
      this.explodedFactor = 0.0;
    }
    this.updateExplodedView();
  }

  setExplodedFactor(factor) {
    this.explodedFactor = Math.max(0, Math.min(1, factor));
    this.updateExplodedView();
  }

  updateExplodedView() {
    const factor = this.explodedFactor;
    for (const mesh of this.sliceMeshes) {
      const { basePos, sliceIndex, sliceDirection } = mesh.userData;
      if (!basePos) continue;

      const offsetMultiplier = (sliceIndex - (this.sliceMeshes.length / 2)) * 14 * factor;
      if (sliceDirection === 'vertical') {
        mesh.position.x = basePos.x + offsetMultiplier;
      } else {
        mesh.position.y = basePos.y + offsetMultiplier;
      }
    }
  }

  onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
