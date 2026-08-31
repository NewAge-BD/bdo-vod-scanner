import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/bdo-vod-scanner/' : '/',
  plugins: [react()],
  server: {
    watch: {
      ignored: [
        '**/*.mp4',
        '**/*.mkv',
        '**/*.mov',
        '**/*.avi',
        '**/*.webm',
        '**/*.wav',
        '**/*.mp3',
      ],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
