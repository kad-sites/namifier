import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        nameDesigner: resolve(__dirname, 'name-designer.html')
      },
      external: ['three-bvh-csg', 'three-mesh-bvh', /^three\/addons\//]
    }
  },
  worker: {
    format: 'es'
  }
});
