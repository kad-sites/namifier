import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { Evaluator, Brush, SUBTRACTION } from 'three-bvh-csg';

// Elements
const container = document.getElementById('canvas-container');
const nameInput = document.getElementById('name-input');
const fontSelect = document.getElementById('font-select');
const textSizeInput = document.getElementById('text-size');
const letterSpacingInput = document.getElementById('letter-spacing');
const textThicknessInput = document.getElementById('text-thickness');
const textYOffsetInput = document.getElementById('text-y-offset');
const targetWidthInput = document.getElementById('target-width');
const targetHeightInput = document.getElementById('target-height');
const includeBaseInput = document.getElementById('include-base');
const baseOptions = document.getElementById('base-options');
const basePaddingInput = document.getElementById('base-padding');
const baseHeightInput = document.getElementById('base-height');
const baseDepthInput = document.getElementById('base-depth');
const baseEdgeStyleSelect = document.getElementById('base-edge-style');
const baseEdgeRadiusInput = document.getElementById('base-edge-radius');
const groupBaseEdgeRadius = document.getElementById('group-base-edge-radius');
const baseEdgeSideSelect = document.getElementById('base-edge-side');
const groupBaseEdgeSide = document.getElementById('group-base-edge-side');

const textEdgeStyleSelect = document.getElementById('text-edge-style');
const textEdgeRadiusInput = document.getElementById('text-edge-radius');
const groupTextEdgeRadius = document.getElementById('group-text-edge-radius');
const textEdgeSideSelect = document.getElementById('text-edge-side');
const groupTextEdgeSide = document.getElementById('group-text-edge-side');

const exportBtn = document.getElementById('export-btn');

// Right Sidebar (Beautify)
const rightSidebar = document.getElementById('right-sidebar');
const openBeautifyBtn = document.getElementById('open-beautify');
const closeBeautifyBtn = document.getElementById('close-beautify');

// Dimensions Output
const dimX = document.getElementById('dim-x');
const dimY = document.getElementById('dim-y');
const dimZ = document.getElementById('dim-z');

const sizingModeSelect = document.getElementById('sizing-mode');
const groupFontSize = document.getElementById('group-font-size');
const groupTargetWidth = document.getElementById('group-target-width');
const groupTargetHeight = document.getElementById('group-target-height');

// Setup +/- buttons
function setupNumberControls(inputId, minusId, plusId) {
    const input = document.getElementById(inputId);
    const minus = document.getElementById(minusId);
    const plus = document.getElementById(plusId);
    
    minus.addEventListener('click', () => {
        let val = parseFloat(input.value) - parseFloat(input.step || 1);
        val = Math.max(parseFloat(input.min) || -Infinity, val);
        input.value = Math.round(val * 100) / 100;
        refreshGeometry();
    });
    
    plus.addEventListener('click', () => {
        let val = parseFloat(input.value) + parseFloat(input.step || 1);
        val = Math.min(parseFloat(input.max) || Infinity, val);
        input.value = Math.round(val * 100) / 100;
        refreshGeometry();
    });
}
setupNumberControls('text-size', 'size-minus', 'size-plus');
setupNumberControls('letter-spacing', 'spacing-minus', 'spacing-plus');
setupNumberControls('text-thickness', 'thickness-minus', 'thickness-plus');
setupNumberControls('text-y-offset', 'yoffset-minus', 'yoffset-plus');
setupNumberControls('target-width', 'width-minus', 'width-plus');
setupNumberControls('target-height', 'height-minus', 'height-plus');
setupNumberControls('base-padding', 'pad-minus', 'pad-plus');
setupNumberControls('base-height', 'baseh-minus', 'baseh-plus');
setupNumberControls('base-depth', 'based-minus', 'based-plus');
setupNumberControls('base-edge-radius', 'edgerad-minus', 'edgerad-plus');
setupNumberControls('text-edge-radius', 'textrad-minus', 'textrad-plus');

// Toggle base options visibility
includeBaseInput.addEventListener('change', (e) => {
    baseOptions.style.display = e.target.checked ? 'block' : 'none';
    refreshGeometry();
});

textEdgeStyleSelect.addEventListener('change', (e) => {
    const isNone = e.target.value === 'none';
    groupTextEdgeRadius.style.display = isNone ? 'none' : 'block';
    groupTextEdgeSide.style.display = isNone ? 'none' : 'block';
    refreshGeometry();
});

baseEdgeStyleSelect.addEventListener('change', (e) => {
    const isNone = e.target.value === 'none';
    groupBaseEdgeRadius.style.display = isNone ? 'none' : 'block';
    groupBaseEdgeSide.style.display = isNone ? 'none' : 'block';
    refreshGeometry();
});

textEdgeSideSelect.addEventListener('change', refreshGeometry);
baseEdgeSideSelect.addEventListener('change', refreshGeometry);

// Beautify Sidebar Toggle
openBeautifyBtn.addEventListener('click', () => {
    rightSidebar.classList.add('open');
});

closeBeautifyBtn.addEventListener('click', () => {
    rightSidebar.classList.remove('open');
});

// Sizing Mode UI Toggle
function updateSizingModeUI() {
    const mode = sizingModeSelect.value;
    if (mode === 'exact') {
        groupFontSize.classList.add('disabled-group');
        groupTargetWidth.classList.remove('disabled-group');
        groupTargetHeight.classList.remove('disabled-group');
    } else {
        groupFontSize.classList.remove('disabled-group');
        groupTargetWidth.classList.add('disabled-group');
        groupTargetHeight.classList.add('disabled-group');
    }
}
sizingModeSelect.addEventListener('change', () => {
    updateSizingModeUI();
    refreshGeometry();
});
updateSizingModeUI(); // initial state

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

// Container dimensions instead of window
let width = container.clientWidth;
let height = container.clientHeight;

const camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
camera.position.set(0, 100, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
container.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(0, 200, 100);
scene.add(dirLight);

const dirLight2 = new THREE.DirectionalLight(0x90b0d0, 0.4);
dirLight2.position.set(-100, 200, -100);
scene.add(dirLight2);

// Grid
const grid = new THREE.GridHelper(1000, 50, 0x333333, 0x2a2a2a);
grid.position.y = -1; // Slightly below base
scene.add(grid);

// Materials
const textMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffe8d6, // Soft Pastel Cream
    roughness: 0.6, 
    metalness: 0.0 
});
const textMaterialSelected = textMaterial.clone();
textMaterialSelected.emissive.setHex(0x444444); // Glow for selection

const baseMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xb2e2f2, // Pastel Blue
    roughness: 0.8,
    metalness: 0.1
});

// State
let currentFont = null;
let mainGroup = new THREE.Group();
let textGroup = new THREE.Group();
let baseMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x52796f, roughness: 0.8 })); // Dark Pastel Sage Green

baseMesh.castShadow = true;
baseMesh.receiveShadow = true;

mainGroup.add(textGroup);
mainGroup.add(baseMesh);
scene.add(mainGroup);

// Multi-select state
let selectedMeshes = [];
const dummyGizmo = new THREE.Object3D();
textGroup.add(dummyGizmo); // Keep in same coordinate space as text
let previousGizmoPos = new THREE.Vector3();

function updateSelectionVisuals() {
    textGroup.children.forEach(mesh => {
        if (mesh.userData.isLetter) {
            mesh.material = selectedMeshes.includes(mesh) ? textMaterialSelected : textMaterial;
        }
    });
    
    if (selectedMeshes.length > 0) {
        // Center the gizmo on the selection
        const box = new THREE.Box3();
        selectedMeshes.forEach(mesh => {
            mesh.updateMatrixWorld();
            const meshBox = new THREE.Box3().setFromObject(mesh);
            box.union(meshBox);
        });
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        // Convert world center to textGroup local space
        textGroup.worldToLocal(center);
        dummyGizmo.position.copy(center);
        
        transformControl.attach(dummyGizmo);
    } else {
        transformControl.detach();
    }
}

const transformControl = new TransformControls(camera, renderer.domElement);
transformControl.setSize(0.6); // Classier, smaller arrows
transformControl.addEventListener('dragging-changed', function (event) {
    controls.enabled = !event.value;
    if (event.value) {
        // Drag started
        previousGizmoPos.copy(dummyGizmo.position);
    } else {
        // Drag ended - save state
        saveState();
    }
});
transformControl.addEventListener('change', () => {
    if (transformControl.dragging) {
        const delta = new THREE.Vector3().subVectors(dummyGizmo.position, previousGizmoPos);
        selectedMeshes.forEach(mesh => {
            mesh.position.add(delta);
            
            const idx = mesh.userData.index;
            if (!meshOffsets[idx]) meshOffsets[idx] = {x: 0, y: 0};
            meshOffsets[idx].x += delta.x;
            meshOffsets[idx].y += delta.y;
        });
        previousGizmoPos.copy(dummyGizmo.position);
    }

    // Only update the dimensions display on drag, do NOT shift the mainGroup 
    // to avoid a feedback loop with TransformControls.
    const boundingBox = new THREE.Box3().setFromObject(mainGroup);
    if (!isFinite(boundingBox.min.x)) return;
    dimX.textContent = (boundingBox.max.x - boundingBox.min.x).toFixed(1);
    dimY.textContent = (boundingBox.max.y - boundingBox.min.y).toFixed(1);
    dimZ.textContent = (boundingBox.max.z - boundingBox.min.z).toFixed(1);
});
scene.add(transformControl);

// Raycaster for selecting the text
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (event) => {
    // If we are currently interacting with the gizmo, don't detach
    if (transformControl.dragging || transformControl.axis !== null) {
        return; 
    }
    
    const rect = renderer.domElement.getBoundingClientRect();
    if (event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom) {
        
        mouse.x = ( ( event.clientX - rect.left ) / rect.width ) * 2 - 1;
        mouse.y = - ( ( event.clientY - rect.top ) / rect.height ) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        
        // Only check intersection with the text meshes inside textGroup
        const meshes = textGroup.children.filter(c => c.userData.isLetter);
        const intersects = raycaster.intersectObjects(meshes);
        
        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            
            if (event.ctrlKey || event.metaKey) {
                // Toggle selection
                const index = selectedMeshes.indexOf(clickedMesh);
                if (index > -1) {
                    selectedMeshes.splice(index, 1);
                } else {
                    selectedMeshes.push(clickedMesh);
                }
            } else {
                // Single selection
                if (!selectedMeshes.includes(clickedMesh)) {
                    selectedMeshes = [clickedMesh];
                }
            }
            updateSelectionVisuals();
        } else {
            // Clicked empty space
            if (!event.ctrlKey && !event.metaKey) {
                selectedMeshes = [];
                updateSelectionVisuals();
            }
        }
    }
});

const fontLoader = new FontLoader();
const ttfLoader = new TTFLoader();
const fontBaseURL = 'https://unpkg.com/three@0.160.0/examples/fonts/';

let currentFontName = fontSelect.value;
let meshOffsets = {};

// History Stack
const maxHistory = 30;
let historyStack = [];
let historyIndex = -1;
let isRestoringHistory = false;

function saveState() {
    if (isRestoringHistory) return;
    
    const state = {
        name: nameInput.value,
        font: fontSelect.value,
        sizingMode: sizingModeSelect.value,
        targetWidth: targetWidthInput.value,
        targetHeight: targetHeightInput.value,
        textSize: textSizeInput.value,
        includeBase: includeBaseInput.checked,
        basePadding: basePaddingInput.value,
        baseHeight: baseHeightInput.value,
        baseDepth: baseDepthInput.value,
        letterSpacing: letterSpacingInput.value,
        textYOffset: textYOffsetInput.value,
        textThickness: textThicknessInput.value,
        textEdgeRadius: textEdgeRadiusInput.value,
        baseEdgeRadius: baseEdgeRadiusInput.value,
        textEdgeStyle: textEdgeStyleSelect.value,
        baseEdgeStyle: baseEdgeStyleSelect.value,
        meshOffsets: JSON.parse(JSON.stringify(meshOffsets))
    };
    
    if (historyIndex >= 0) {
        const topState = historyStack[historyIndex];
        if (JSON.stringify(topState) === JSON.stringify(state)) return;
    }
    
    if (historyIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyIndex + 1);
    }
    
    historyStack.push(state);
    if (historyStack.length > maxHistory) {
        historyStack.shift();
    } else {
        historyIndex++;
    }
    updateHistoryButtons();
}

function updateHistoryButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if(undoBtn) undoBtn.disabled = historyIndex <= 0;
    if(redoBtn) redoBtn.disabled = historyIndex >= historyStack.length - 1;
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        restoreState(historyStack[historyIndex]);
    }
}

function redo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        restoreState(historyStack[historyIndex]);
    }
}

function restoreState(state) {
    isRestoringHistory = true;
    
    nameInput.value = state.name;
    fontSelect.value = state.font;
    sizingModeSelect.value = state.sizingMode;
    targetWidthInput.value = state.targetWidth;
    targetHeightInput.value = state.targetHeight;
    textSizeInput.value = state.textSize;
    includeBaseInput.checked = state.includeBase;
    basePaddingInput.value = state.basePadding;
    baseHeightInput.value = state.baseHeight;
    baseDepthInput.value = state.baseDepth;
    letterSpacingInput.value = state.letterSpacing;
    textYOffsetInput.value = state.textYOffset;
    textThicknessInput.value = state.textThickness;
    textEdgeRadiusInput.value = state.textEdgeRadius;
    baseEdgeRadiusInput.value = state.baseEdgeRadius;
    textEdgeStyleSelect.value = state.textEdgeStyle;
    baseEdgeStyleSelect.value = state.baseEdgeStyle;
    
    meshOffsets = JSON.parse(JSON.stringify(state.meshOffsets));
    
    updateSizingModeUI();
    updateHistoryButtons();
    
    selectedMeshes = [];
    if(transformControl) transformControl.detach();
    updateSelectionVisuals();
    
    let url = state.font;
    if (!url.endsWith('.ttf')) url = fontBaseURL + url;
    
    let currentResolvedUrl = currentFontName;
    if (!currentResolvedUrl.endsWith('.ttf')) currentResolvedUrl = fontBaseURL + currentResolvedUrl;
    
    if (url === currentResolvedUrl && currentFont) {
        // Font hasn't changed, render immediately for snappy step-by-step undo
        refreshGeometry();
        isRestoringHistory = false;
    } else {
        currentFontName = state.font;
        loadFont(url, () => {
            isRestoringHistory = false;
        });
    }
}

const undoBtnEl = document.getElementById('undo-btn');
const redoBtnEl = document.getElementById('redo-btn');
if(undoBtnEl) undoBtnEl.addEventListener('click', undo);
if(redoBtnEl) redoBtnEl.addEventListener('click', redo);

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
            if (e.shiftKey) redo();
            else undo();
            e.preventDefault();
        }
        if (e.key.toLowerCase() === 'y') {
            redo();
            e.preventDefault();
        }
    }
});

function loadFont(url, callback) {
    if (url.endsWith('.ttf')) {
        ttfLoader.load(url, function (json) {
            currentFont = fontLoader.parse(json);
            refreshGeometry();
            if(callback) callback();
        });
    } else {
        fontLoader.load(url, function (font) {
            currentFont = font;
            refreshGeometry();
            if(callback) callback();
        });
    }
}
// Initial load needs to check if it's a URL or a base file
if (currentFontName.endsWith('.ttf')) {
    loadFont(currentFontName, () => { saveState(); });
} else {
    loadFont(fontBaseURL + currentFontName, () => { saveState(); });
}

function updateGroupCentering() {
    // Reset position to 0 first so we measure the local bounding box correctly.
    // Otherwise measuring world bounds of an offset group causes an oscillation loop!
    mainGroup.position.set(0, 0, 0);
    mainGroup.updateMatrixWorld(true);

    const boundingBox = new THREE.Box3().setFromObject(mainGroup);
    
    if (!isFinite(boundingBox.min.x)) return;
    
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    
    mainGroup.position.x = -center.x;
    mainGroup.position.y = -boundingBox.min.y;
    mainGroup.position.z = -center.z;

    const finalWidth = boundingBox.max.x - boundingBox.min.x;
    const finalHeight = boundingBox.max.y - boundingBox.min.y;
    const finalDepth = boundingBox.max.z - boundingBox.min.z;

    dimX.textContent = finalWidth.toFixed(1);
    dimY.textContent = finalHeight.toFixed(1);
    dimZ.textContent = finalDepth.toFixed(1);
}

function refreshGeometry() {
    if (!currentFont) return;
    
    const text = nameInput.value || " ";
    const size = parseFloat(textSizeInput.value) || 50;
    const thickness = parseFloat(textThicknessInput.value) || 10;
    const letterSpacing = parseFloat(letterSpacingInput.value) || 0;
    const manualYOffset = parseFloat(textYOffsetInput.value) || 0;
    const targetWidth = parseFloat(targetWidthInput.value) || 150;
    const targetHeight = parseFloat(targetHeightInput.value) || 50;
    const includeBase = includeBaseInput.checked;
    
    const basePadding = parseFloat(basePaddingInput.value) || 0;
    const baseHeight = parseFloat(baseHeightInput.value) || 0; 
    const baseDepth = parseFloat(baseDepthInput.value) || 30;
    const edgeStyle = baseEdgeStyleSelect.value;
    const edgeRadius = parseFloat(baseEdgeRadiusInput.value) || 2; 
    const baseEdgeSide = baseEdgeSideSelect.value;

    const textEdgeStyle = textEdgeStyleSelect.value;
    const textEdgeRadius = parseFloat(textEdgeRadiusInput.value) || 1;
    const textEdgeSide = textEdgeSideSelect.value;

    const sizingMode = sizingModeSelect.value;
    
    // Reset mainGroup position before any world matrix calculations
    mainGroup.position.set(0, 0, 0);
    mainGroup.updateMatrixWorld(true);

    // Clear old text meshes and selection
    selectedMeshes = [];
    transformControl.detach();
    
    // We filter backwards to avoid messing up indices while removing, 
    // and we MUST NOT remove dummyGizmo!
    for (let i = textGroup.children.length - 1; i >= 0; i--) {
        const child = textGroup.children[i];
        if (child.userData.isLetter) {
            textGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
        }
    }
    
    // Create new meshes
    let currentX = 0;
    const scale = size / currentFont.data.resolution;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        let glyph = currentFont.data.glyphs[char];
        if (!glyph) glyph = currentFont.data.glyphs['?'];
        if (!glyph) continue;
        
        if (char === ' ') {
            currentX += (glyph.ha * scale) + letterSpacing;
            continue;
        }
        
        let bevelEnabled = false;
        let bevelSegments = 0;
        let bevelSize = 0;
        let bevelThickness = 0;

        if (textEdgeStyle !== 'none' && textEdgeRadius > 0) {
            bevelEnabled = true;
            bevelSegments = textEdgeStyle === 'chamfer' ? 1 : 4;
            bevelSize = textEdgeRadius;
            bevelThickness = textEdgeRadius;
        }

        let geo = new TextGeometry(char, {
            font: currentFont,
            size: size,
            height: thickness,
            curveSegments: 12,
            bevelEnabled: bevelEnabled,
            bevelSegments: bevelSegments,
            bevelSize: bevelSize,
            bevelThickness: bevelThickness
        });
        
        if (bevelEnabled && textEdgeSide === 'front-only') {
            const evaluator = new Evaluator();
            const textBrush = new Brush(geo);
            
            // TextGeometry creates back bevel at Z < 0. We want to cut off Z < 0.
            const cutGeo = new THREE.BoxGeometry(size * 4, size * 4, bevelThickness * 4);
            const cutBrush = new Brush(cutGeo);
            cutBrush.position.set(0, 0, -bevelThickness * 2);
            cutBrush.updateMatrixWorld();
            textBrush.updateMatrixWorld();
            
            const result = evaluator.evaluate(textBrush, cutBrush, SUBTRACTION);
            geo.dispose();
            cutGeo.dispose();
            geo = result.geometry;
        }
        
        geo.computeBoundingBox();
        
        // Keep natural X and Y to preserve baselines and kerning (side bearings)
        // Only translate Z to center depth
        geo.translate(0, 0, -thickness / 2);
        
        const mesh = new THREE.Mesh(geo, textMaterial);
        mesh.position.x = currentX;
        if (meshOffsets[i]) {
            mesh.position.x += meshOffsets[i].x;
            mesh.position.y += meshOffsets[i].y;
        }
        
        mesh.userData.isLetter = true;
        mesh.userData.index = i;
        
        textGroup.add(mesh);
        
        currentX += (glyph.ha * scale) + letterSpacing;
    }
    
    // Reset position before measuring to avoid feedback loops!
    textGroup.position.set(0, 0, 0);

    if (sizingMode === 'exact') {
        // Must update matrix world to calculate box
        textGroup.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(textGroup);
        const rawWidth = box.max.x - box.min.x;
        const rawHeight = box.max.y - box.min.y;

        if (rawWidth > 0 && rawHeight > 0) {
            const scaleX = targetWidth / rawWidth;
            const scaleY = targetHeight / rawHeight;
            
            textGroup.children.forEach(mesh => {
                if (mesh.userData.isLetter) {
                    mesh.geometry.scale(scaleX, scaleY, 1);
                    mesh.geometry.computeBoundingBox();
                    mesh.geometry.computeBoundingSphere();
                    mesh.position.x *= scaleX;
                    mesh.position.y *= scaleY;
                }
            });
        }
    }
    
    // Center the text group horizontally
    textGroup.updateMatrixWorld(true);
    const textBox = new THREE.Box3().setFromObject(textGroup);
    if (isFinite(textBox.min.x)) {
        textGroup.position.x = -0.5 * (textBox.max.x + textBox.min.x);
    }
    
    // --- VISUAL BASELINE ALIGNMENT ---
    // Cursive fonts often draw letters hovering above y=0. We must find the visual bottom 
    // of a "flat" letter (like 'o' or 'e') to align it perfectly to the base.
    let baselineOffset = 0;
    let baselineFound = false;
    const safeChars = 'abcdehiklmnorstuvwxABCDEFHIKLMNOPRSTUVWX0123456789';
    
    for (let i = 0; i < textGroup.children.length; i++) {
        const mesh = textGroup.children[i];
        if (mesh.userData.isLetter) {
            const char = text[mesh.userData.index];
            if (safeChars.includes(char)) {
                const charBox = new THREE.Box3().setFromObject(mesh);
                if (isFinite(charBox.min.y)) {
                    baselineOffset = charBox.min.y;
                    baselineFound = true;
                    break;
                }
            }
        }
    }
    
    if (!baselineFound && isFinite(textBox.min.y)) {
        baselineOffset = textBox.min.y;
    }
    
    // Sit the text group on top of the base
    const targetY = includeBase ? baseHeight : 0;
    // Sink it 0.5mm into the base so it fuses properly for 3D printing
    const printOverlap = includeBase ? 0.5 : 0; 
    
    textGroup.position.y = targetY - baselineOffset - printOverlap + manualYOffset;

    // Create Base Geometry
    if (includeBase) {
        baseMesh.visible = true;
        
        // Measure text size again now that it's laid out
        textGroup.updateMatrixWorld(true);
        const finalBox = new THREE.Box3().setFromObject(textGroup);
        const textWidth = isFinite(finalBox.min.x) ? (finalBox.max.x - finalBox.min.x) : 0;
        
        const baseWidth = textWidth + (basePadding * 2);
        
        let baseGeo;
        if (edgeStyle === 'none' || edgeRadius <= 0) {
            baseGeo = new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth);
            baseGeo.translate(0, baseHeight / 2, 0);
        } else {
            // Cap radius so it doesn't self-intersect
            const maxRadius = Math.min(baseWidth/2, baseHeight/2, baseDepth/2);
            const actualRadius = Math.min(edgeRadius, maxRadius);
            
            // 1 segment = chamfer, 4 segments = fillet
            const segments = edgeStyle === 'chamfer' ? 1 : 4;
            
            if (baseEdgeSide === 'top-only') {
                // Double height to round corners perfectly, then slice off bottom
                let doubleBaseGeo = new RoundedBoxGeometry(baseWidth, baseHeight * 2, baseDepth, segments, actualRadius);
                const evaluator = new Evaluator();
                const baseBrush = new Brush(doubleBaseGeo);
                
                const cutGeo = new THREE.BoxGeometry(baseWidth * 2, baseHeight * 2, baseDepth * 2);
                const cutBrush = new Brush(cutGeo);
                // Box covers Y < 0
                cutBrush.position.set(0, -baseHeight, 0);
                cutBrush.updateMatrixWorld();
                baseBrush.updateMatrixWorld();
                
                const result = evaluator.evaluate(baseBrush, cutBrush, SUBTRACTION);
                doubleBaseGeo.dispose();
                cutGeo.dispose();
                baseGeo = result.geometry;
            } else {
                baseGeo = new RoundedBoxGeometry(baseWidth, baseHeight, baseDepth, segments, actualRadius);
                baseGeo.translate(0, baseHeight / 2, 0);
            }
        }
        
        if (baseMesh.geometry) baseMesh.geometry.dispose();
        baseMesh.geometry = baseGeo;
    } else {
        baseMesh.visible = false;
        if (baseMesh.geometry) baseMesh.geometry.dispose();
        baseMesh.geometry = new THREE.BufferGeometry();
    }

    updateGroupCentering();
}

function exportSTL() {
    const exporter = new STLExporter();
    // Only parse the mainGroup to prevent exporting grid, lights, and transform gizmos
    const result = exporter.parse(mainGroup, { binary: true });

    const blob = new Blob([result], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = `${nameInput.value || 'model'}.stl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Event Listeners
window.addEventListener('resize', () => {
    width = container.clientWidth;
    height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});

fontSelect.addEventListener('change', (e) => {
    let val = e.target.value;
    if (val.endsWith('.ttf')) {
        loadFont(val);
    } else {
        loadFont(fontBaseURL + val);
    }
});

document.getElementById('reset-defaults').addEventListener('click', () => {
    const pacificoUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/pacifico/Pacifico-Regular.ttf';
    
    // Clear mesh offsets on reset
    meshOffsets = {};
    nameInput.value = 'Zoheb';
    fontSelect.value = pacificoUrl;
    sizingModeSelect.value = 'exact';
    targetWidthInput.value = 150;
    targetHeightInput.value = 50;
    textSizeInput.value = 50;
    includeBaseInput.checked = true;
    basePaddingInput.value = 10;
    baseHeightInput.value = 5;
    baseDepthInput.value = 30;
    letterSpacingInput.value = 0;
    textYOffsetInput.value = 0;
    textThicknessInput.value = 10;
    textEdgeRadiusInput.value = 1;
    baseEdgeRadiusInput.value = 2;
    document.getElementById('text-edge-style').value = 'none';
    document.getElementById('base-edge-style').value = 'none';
    
    updateSizingModeUI();
    document.getElementById('group-text-edge-radius').style.display = 'none';
    document.getElementById('group-text-edge-side').style.display = 'none';
    document.getElementById('group-base-edge-radius').style.display = 'none';
    document.getElementById('group-base-edge-side').style.display = 'none';
    
    // Clear selection
    selectedMeshes = [];
    transformControl.detach();
    updateSelectionVisuals();
    
    loadFont(pacificoUrl, () => { saveState(); }); 
});

nameInput.addEventListener('change', saveState);
textSizeInput.addEventListener('change', saveState);
letterSpacingInput.addEventListener('change', saveState);
textThicknessInput.addEventListener('change', saveState);
targetWidthInput.addEventListener('change', saveState);
targetHeightInput.addEventListener('change', saveState);
includeBaseInput.addEventListener('change', saveState);
basePaddingInput.addEventListener('change', saveState);
baseHeightInput.addEventListener('change', saveState);
baseDepthInput.addEventListener('change', saveState);
textEdgeStyleSelect.addEventListener('change', saveState);
textEdgeRadiusInput.addEventListener('change', saveState);
fontSelect.addEventListener('change', saveState);
sizingModeSelect.addEventListener('change', saveState);

// Realtime preview
nameInput.addEventListener('input', refreshGeometry);
textSizeInput.addEventListener('input', refreshGeometry);
letterSpacingInput.addEventListener('input', refreshGeometry);
textThicknessInput.addEventListener('input', refreshGeometry);
targetWidthInput.addEventListener('input', refreshGeometry);
targetHeightInput.addEventListener('input', refreshGeometry);
includeBaseInput.addEventListener('input', refreshGeometry);
basePaddingInput.addEventListener('input', refreshGeometry);
baseHeightInput.addEventListener('input', refreshGeometry);
baseDepthInput.addEventListener('input', refreshGeometry);
textEdgeRadiusInput.addEventListener('input', refreshGeometry);
textEdgeStyleSelect.addEventListener('input', refreshGeometry);

exportBtn.addEventListener('click', exportSTL);

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();

// --- Scroll Indicator Logic ---
const leftSidebarContent = document.getElementById('left-sidebar-content') || document.querySelector('.sidebar-content');
const scrollIndicator = document.getElementById('left-scroll-indicator');

function checkScroll() {
    if (!leftSidebarContent || !scrollIndicator) return;
    
    // Use Math.ceil to prevent sub-pixel rounding errors
    const scrollHeight = Math.ceil(leftSidebarContent.scrollHeight);
    const clientHeight = Math.ceil(leftSidebarContent.clientHeight);
    const scrollTop = Math.ceil(leftSidebarContent.scrollTop);
    
    const isScrollable = scrollHeight > clientHeight;
    const isAtBottom = (scrollHeight - scrollTop - clientHeight) < 5;
    
    if (isScrollable && !isAtBottom) {
        scrollIndicator.classList.add('visible');
    } else {
        scrollIndicator.classList.remove('visible');
    }
}

if (leftSidebarContent) {
    leftSidebarContent.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    
    // Automatically re-check if the contents of the sidebar change size
    const resizeObserver = new ResizeObserver(() => {
        checkScroll();
    });
    // Observe both the container and its children
    resizeObserver.observe(leftSidebarContent);
    Array.from(leftSidebarContent.children).forEach(child => resizeObserver.observe(child));
}
