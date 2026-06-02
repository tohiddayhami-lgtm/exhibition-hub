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
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            // Three.js ecosystem — only downloaded when the user enters a hall
            if (
              id.includes('/three/') ||
              id.includes('@react-three/fiber') ||
              id.includes('@react-three/drei') ||
              id.includes('troika-three-text') ||
              id.includes('troika-worker') ||
              id.includes('bidi-js')
            ) return 'chunk-3d';

            // Firebase: split auth (small, needed on landing) from data SDK (heavy)
            if (id.includes('firebase/auth') || id.includes('@firebase/auth'))
              return 'chunk-firebase-auth';
            if (id.includes('firebase') || id.includes('@firebase'))
              return 'chunk-firebase-data';

            // Animation runtime
            if (id.includes('motion') || id.includes('framer-motion'))
              return 'chunk-motion';

            // React stays in the main entry for fast hydration
            if (id.includes('/react/') || id.includes('/react-dom/'))
              return 'chunk-react';

            return 'chunk-vendor';
          },
        },
      },
    },
  };
});
