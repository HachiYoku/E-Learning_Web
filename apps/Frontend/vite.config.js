import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.js',
    include: ['src/pages/personalFlashcards.test.jsx', 'src/pages/personalFlashcardPractice.test.jsx', 'src/pages/personalFlashcardReview.test.jsx', 'src/pages/publicFlashcards.test.jsx', 'src/pages/courseLessons.test.jsx', 'src/pages/learningNavigation.test.jsx', 'src/pages/quiz.test.jsx', 'src/pages/MyProfile.test.jsx', 'src/contexts/AuthContext.test.jsx', 'src/components/Hero.test.jsx', 'src/components/SaveFlashcardModal.test.jsx', 'src/components/LessonKeyVocabulary.test.jsx', 'src/services/personalFlashcardService.test.js', 'src/services/flashcardReviewService.test.js', 'src/services/lessonService.test.js', 'src/utils/lessonProgression.test.js'],
  },
  server: {
    host: '127.0.0.1',
  },
})
