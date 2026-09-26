import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.js',
    include: ['src/pages/personalFlashcards.test.jsx', 'src/pages/personalFlashcardPractice.test.jsx', 'src/pages/publicFlashcards.test.jsx', 'src/services/personalFlashcardService.test.js'],
  },
  server: {
    host: '127.0.0.1',
  },
})
