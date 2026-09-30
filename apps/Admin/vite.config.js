import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.js',
    include: [
      'src/components/KeyVocabularyEditor.test.jsx',
      'src/components/Avatar.test.jsx',
      'src/pages/CourseManagement/lessonVocabularyForms.test.jsx',
      'src/services/lessonService.test.js',
      'src/services/userService.test.js',
      'src/pages/StudentFeedbackManagement/StudentFeedback.test.jsx',
      'src/pages/ContactManagement/ContactLeads.test.jsx',
    ],
  },
  server: {
    port: 5174,
    open: true,
  }
})
