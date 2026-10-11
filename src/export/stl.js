import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

export function exportAssembledSTL(sceneOrGroup) {
  const exporter = new STLExporter();
  const result = exporter.parse(sceneOrGroup, { binary: true });
  return new Blob([result], { type: 'application/octet-stream' });
}
