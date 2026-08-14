import { defineConfig } from 'vite';

// Vite ignores $PORT by default; honouring it lets the harness assign a free port.
export default defineConfig({
  // Relative asset URLs, so the build works both at a domain root and under a
  // GitHub Pages project path like /mahjong/.
  base: './',
  build: {
    // GitHub Pages can serve straight from /docs on the default branch.
    outDir: 'docs',
    emptyOutDir: true,
  },
  server: {
    port: Number(process.env.PORT) || 5173,
  },
});
