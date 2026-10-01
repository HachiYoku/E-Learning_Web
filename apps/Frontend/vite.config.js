import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.js',
    include: ['src/pages/personalFlashcards.test.jsx', 'src/pages/personalFlashcardPractice.test.jsx', 'src/pages/personalFlashcardReview.test.jsx', 'src/pages/publicFlashcards.test.jsx', 'src/pages/courseLessons.test.jsx', 'src/pages/learningNavigation.test.jsx', 'src/pages/quiz.test.jsx', 'src/pages/MyProfile.test.jsx', 'src/pages/StudentFeedback.test.jsx', 'src/pages/StudentSupport.test.jsx', 'src/pages/LegalPolicy.test.jsx', 'src/pages/CourseDetail.test.jsx', 'src/pages/OrderStatus.test.jsx', 'src/contexts/AuthContext.test.jsx', 'src/components/Article.test.jsx', 'src/components/Benefits.test.jsx', 'src/components/Hero.test.jsx', 'src/components/MotivationBanner.test.jsx', 'src/components/OurServices.test.jsx', 'src/components/Navbar.test.jsx', 'src/components/ContactSection.test.jsx', 'src/components/Footer.test.jsx', 'src/components/CourseCard.test.jsx', 'src/components/SaveFlashcardModal.test.jsx', 'src/components/LessonKeyVocabulary.test.jsx', 'src/components/StudentReview.test.jsx', 'src/components/SocialReels.test.jsx', 'src/services/personalFlashcardService.test.js', 'src/services/flashcardReviewService.test.js', 'src/services/lessonService.test.js', 'src/services/enrollmentService.test.js', 'src/services/studentFeedbackService.test.js', 'src/utils/lessonProgression.test.js', 'src/utils/studentFeedbackStatus.test.js', 'src/utils/supportFormPreselection.test.js'],
  },
  server: {
    host: '127.0.0.1',
  },
})
