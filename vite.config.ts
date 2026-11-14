import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from /simple-shooter/.
  base: '/simple-shooter/',
  plugins: [react(), tailwindcss()],
  // Phaser alone is ~1.4 MB minified; it's lazily loaded in its own chunk.
  build: { chunkSizeWarningLimit: 1600 },
})
