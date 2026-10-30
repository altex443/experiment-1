import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [qwikVite({ csr: true })],
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  build: { outDir: 'dist' }
});
