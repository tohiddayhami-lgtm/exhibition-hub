import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function pdfProxyPlugin(): Plugin {
  const handlePdfProxy = async (req: any, res: any, next?: () => void) => {
    if (!req.url?.startsWith('/api/pdf-proxy')) {
      next?.();
      return;
    }

    try {
      const requestUrl = new URL(req.url, 'http://localhost');
      const targetUrl = requestUrl.searchParams.get('url');

      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        res.statusCode = 400;
        res.end('Missing valid PDF URL');
        return;
      }

      const response = await fetch(targetUrl, {
        headers: {
          accept: 'application/pdf,*/*',
          'user-agent': 'Mozilla/5.0 ExhibitionHubPDFProxy/1.0',
        },
      });

      if (!response.ok) {
        res.statusCode = response.status;
        res.end(`PDF fetch failed: ${response.status}`);
        return;
      }

      const contentType = response.headers.get('content-type') || 'application/pdf';
      const data = Buffer.from(await response.arrayBuffer());

      res.statusCode = 200;
      res.setHeader('content-type', contentType.includes('pdf') ? contentType : 'application/pdf');
      res.setHeader('cache-control', 'public, max-age=300');
      res.setHeader('access-control-allow-origin', '*');
      res.end(data);
    } catch (error) {
      console.error('[pdf-proxy] failed', error);
      res.statusCode = 502;
      res.end('PDF proxy failed');
    }
  };

  return {
    name: 'exhibition-pdf-proxy',
    configureServer(server) {
      server.middlewares.use(handlePdfProxy);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handlePdfProxy);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), pdfProxyPlugin()],
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
