export const CATEGORIES = ['Vocabulary', 'Grammar', 'Reading', 'Listening', 'Conversation']
export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced']
export const ACCESS_LEVELS = ['public', 'students']

let nextLocalId = 0
export function newQuestion() {
  nextLocalId += 1
  return { localId: `new-${nextLocalId}`, prompt: '', options: ['', ''], correctAnswer: null, explanation: '' }
}

export function emptyDraft() {
  return { title: '', description: '', category: '', difficulty: '', standaloneAccess: '', questions: [newQuestion()] }
}

export function draftFromQuiz(quiz) {
  const source = quiz.draft || quiz.published
  if (!source) return emptyDraft()
  return {
    title: source.title || '', description: source.description || '', category: source.category || '',
    difficulty: source.difficulty || '', standaloneAccess: source.standaloneAccess || '',
    questions: (source.questions || []).map((question) => ({ ...question, localId: question._id || newQuestion().localId, options: [...(question.options || [])] })),
  }
}

export function validateDraft(form) {
  const errors = []
  if (!form.title.trim()) errors.push('Enter a quiz title.')
  if (form.title.trim().length > 140) errors.push('Keep the title within 140 characters.')
  if (form.description.trim().length > 1000) errors.push('Keep the description within 1000 characters.')
  if (!CATEGORIES.includes(form.category)) errors.push('Choose a supported category.')
  if (!DIFFICULTIES.includes(form.difficulty)) errors.push('Choose a supported difficulty.')
  if (!ACCESS_LEVELS.includes(form.standaloneAccess)) errors.push('Choose Public or Students Only visibility.')
  if (form.questions.length < 1 || form.questions.length > 10) errors.push('Add between 1 and 10 questions.')
  form.questions.forEach((question, index) => {
    const label = `Question ${index + 1}`
    if (!question.prompt?.trim() && !question.image?.trim() && !question.audio?.trim()) errors.push(`${label}: enter question text.`)
    if ((question.prompt || '').trim().length > 280) errors.push(`${label}: keep question text within 280 characters.`)
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6 || question.options.some((option) => !option.trim())) errors.push(`${label}: provide 2–6 non-empty answers.`)
    if (!Number.isInteger(question.correctAnswer) || question.correctAnswer < 0 || question.correctAnswer >= question.options.length || !question.options[question.correctAnswer]?.trim()) errors.push(`${label}: select a valid correct answer.`)
    if ((question.explanation || '').trim().length > 2000) errors.push(`${label}: keep the explanation within 2000 characters.`)
  })
  return errors
}

export function draftPayload(form) {
  return {
    title: form.title.trim(), description: form.description.trim(), category: form.category,
    difficulty: form.difficulty, standaloneAccess: form.standaloneAccess,
    questions: form.questions.map(({ localId, ...question }) => ({
      ...question, prompt: (question.prompt || '').trim(), explanation: (question.explanation || '').trim(),
      options: question.options.map((option) => option.trim()),
    })),
  }
}
