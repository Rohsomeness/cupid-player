import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Project pages: https://<user>.github.io/cupid-player/
// Override with VITE_BASE=/ for a custom domain or user site root.
const base = process.env.VITE_BASE || '/cupid-player/';

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
