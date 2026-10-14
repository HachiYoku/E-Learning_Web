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
      'src/components/PaymentCard.test.jsx',
      'src/pages/CourseManagement/lessonVocabularyForms.test.jsx',
      'src/services/lessonService.test.js',
      'src/services/userService.test.js',
      'src/pages/StudentFeedbackManagement/StudentFeedback.test.jsx',
      'src/pages/ContactManagement/ContactLeads.test.jsx',
      'src/pages/ReelManagement/Reels.test.jsx',
      'src/pages/Payment/ReviewPayment.test.jsx',
      'src/pages/Payment/reviewPaymentDeepLink.test.js',
      'src/pages/QuizManagement/QuizAttempts.test.jsx',
      'src/pages/QuizManagement/Quizzes.test.jsx',
      'src/pages/QuizManagement/QuizEditor.test.jsx',
      'src/pages/GeneralPracticeManagement/GeneralPractice.test.jsx',
      'src/pages/GeneralPracticeManagement/GeneralPracticeSets.test.jsx',
      'src/pages/GeneralPracticeManagement/GeneralPracticeEditor.test.jsx',
      'src/pages/GeneralPracticeManagement/GeneralPracticeManagementPanel.test.jsx',
      'src/pages/GeneralPracticeManagement/generalPracticeDraft.test.js',
      'src/services/generalPracticeAdminService.test.js',
      'src/components/Sidebar.generalPractice.test.jsx',
      'src/utils/adminReturnDestination.test.js',
    ],
  },
  server: {
    port: 5174,
    open: true,
  }
})
