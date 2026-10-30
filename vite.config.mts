import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [qwikVite({ csr: true })],
  build: { outDir: 'dist' }
});
