import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export function exportAssembledGLB(sceneOrGroup) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      sceneOrGroup,
      (gltf) => {
        const blob = new Blob([gltf], { type: 'model/gltf-binary' });
        resolve(blob);
      },
      (error) => reject(error),
      { binary: true }
    );
  });
}
