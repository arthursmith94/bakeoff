import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the static build works from any path (GitHub Pages, Cloudflare Pages, IPFS…).
  base: './',
  plugins: [
    react(),
    // @solana/web3.js + anchor expect Buffer/process in the browser.
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util', 'events'],
      globals: { Buffer: true, process: true, global: true },
    }),
  ],
  define: {
    // anchor reads process.env.ANCHOR_* in a couple of code paths; keep it defined.
    'process.env.ANCHOR_BROWSER': 'true',
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
})
