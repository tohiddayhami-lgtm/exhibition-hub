import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 1100,
      rollupOptions: {
        output: {
          // Only split truly independent heavy libraries.
          // Do NOT split React or create a catch-all vendor chunk —
          // that pattern creates circular dependencies and breaks initialisation order.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            // Three.js ecosystem — 1 MB, only needed inside a hall
            if (
              id.includes('/three/') ||
              id.includes('@react-three/fiber') ||
              id.includes('@react-three/drei') ||
              id.includes('troika-three-text') ||
              id.includes('troika-worker') ||
              id.includes('bidi-js')
            ) return 'chunk-3d';

            // Firebase — heavy but needed on the landing page for auth
            if (id.includes('firebase') || id.includes('@firebase')) {
              return 'chunk-firebase';
            }

            // Everything else (React, lucide, motion, etc.) stays together
            // in the default entry chunk to avoid cross-chunk circular deps.
            return undefined;
          },
        },
      },
    },
  };
});
