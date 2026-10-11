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
    this.explodedFactor = 0; // 0 = assembled, 1 = exploded
    this.viewMode = 'assembled'; // 'assembled', 'exploded', 'wireframe'

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x18191c);

    // Camera
    this.camera = new THREE.PerspectiveCamera(40, width / height, 1, 15000);
    this.camera.position.set(1200, 700, 1500);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 10000;
    this.controls.minDistance = 50;

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
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xfff7ee, 0.7);
    this.scene.add(ambientLight);

    // Main Architectural Key Light (casting soft shadows between fins)
    const keyLight = new THREE.DirectionalLight(0xfff0db, 1.8);
    keyLight.position.set(1500, 2200, 1800);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 500;
    keyLight.shadow.camera.far = 6000;
    keyLight.shadow.camera.left = -1800;
    keyLight.shadow.camera.right = 1800;
    keyLight.shadow.camera.top = 1800;
    keyLight.shadow.camera.bottom = -1800;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    // Fill Light (cool contrast)
    const fillLight = new THREE.DirectionalLight(0xcfd9eb, 0.75);
    fillLight.position.set(-1800, 600, 1000);
    this.scene.add(fillLight);

    // Top Down Spotlight
    const spotLight = new THREE.SpotLight(0xffeacc, 1.2, 5000, Math.PI / 4, 0.4, 1.0);
    spotLight.position.set(0, 1800, 800);
    spotLight.target.position.set(0, 0, 0);
    this.scene.add(spotLight);
    this.scene.add(spotLight.target);
  }

  setupBackdrop() {
    // Concrete architectural wall backdrop
    const wallGeo = new THREE.PlaneGeometry(5000, 3000);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x24262b,
      roughness: 0.9,
      metalness: 0.1
    });
    this.backdrop = new THREE.Mesh(wallGeo, wallMat);
    this.backdrop.position.set(0, 0, -2);
    this.backdrop.receiveShadow = true;
    this.scene.add(this.backdrop);
  }

  createWoodMaterial(isSpine = false) {
    if (this.viewMode === 'wireframe') {
      return new THREE.MeshBasicMaterial({
        color: isSpine ? 0x00ffff : 0xffa500,
        wireframe: true
      });
    }

    // Warm natural birch / light oak architectural material
    return new THREE.MeshStandardMaterial({
      color: isSpine ? 0xa87950 : 0xd8b58a,
      roughness: 0.55,
      metalness: 0.05,
      shadowSide: THREE.DoubleSide
    });
  }

  /**
   * Builds 3D extruded geometry for each slice.
   */
  updateSlices(slices, spineRails, params) {
    // Clear existing
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

    const halfW = width / 2;
    const halfH = height / 2;

    const woodMat = this.createWoodMaterial(false);
    const spineMat = this.createWoodMaterial(true);

    for (let i = 0; i < slices.length; i++) {
      const slice = slices[i];
      const pts = slice.polygon;
      if (!pts || pts.length < 3) continue;

      // Create 2D Three.js Shape
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
        bevelThickness: 0.4,
        bevelSize: 0.3,
        bevelOffset: 0,
        bevelSegments: 2
      };

      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, woodMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Position and orient slice in 3D world
      // If vertical: slice plane is along Y (height), extruded along X (width)
      // If horizontal: slice plane is along X (width), extruded along Y (height)
      if (sliceDirection === 'vertical') {
        // pts.x corresponds to Y (height 0..height)
        // pts.y corresponds to Z (depth outwards from wall)
        // Extrusion is along slice.thickness
        mesh.rotation.y = Math.PI / 2;
        mesh.rotation.z = -Math.PI / 2;
        mesh.position.set(
          slice.position - halfW,
          halfH,
          0
        );
      } else {
        // Horizontal slices
        mesh.rotation.x = -Math.PI / 2;
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

    // Build 3D spine rails if present
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
        const mesh = new THREE.Mesh(geo, spineMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (sliceDirection === 'vertical') {
          // Rail runs horizontally across X
          mesh.position.set(
            -halfW,
            rail.posOnRib - halfH - sheetThickness / 2,
            0
          );
        } else {
          // Rail runs vertically across Y
          mesh.rotation.z = Math.PI / 2;
          mesh.position.set(
            rail.posOnRib - halfW - sheetThickness / 2,
            -halfH,
            0
          );
        }

        this.spineGroup.add(mesh);
      }
    }

    // Adjust camera target
    this.controls.target.set(0, 0, 40);
    this.updateExplodedView();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    const isWire = (mode === 'wireframe');
    const woodMat = this.createWoodMaterial(false);
    const spineMat = this.createWoodMaterial(true);

    this.sliceGroup.traverse((child) => {
      if (child.isMesh) child.material = woodMat;
    });
    this.spineGroup.traverse((child) => {
      if (child.isMesh) child.material = spineMat;
    });

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

      const offsetMultiplier = (sliceIndex - (this.sliceMeshes.length / 2)) * 12 * factor;
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
