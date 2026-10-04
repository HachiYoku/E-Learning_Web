function mediaSnapshot({ url = "", publicId = "", resourceType = "", format = "" } = {}) {
  return { url, publicId, resourceType, format };
}

function quizQuestionSnapshot(question, selectedAnswer) {
  const correctAnswer = Number(question.correctAnswer);
  return {
    questionId: question._id || null,
    prompt: String(question.prompt || ""),
    image: mediaSnapshot({
      url: question.image,
      publicId: question.imagePublicId,
      resourceType: question.imageResourceType || "image",
      format: question.imageFormat,
    }),
    audio: mediaSnapshot({
      url: question.audio,
      publicId: question.audioPublicId,
      resourceType: question.audioResourceType,
      format: question.audioFormat,
    }),
    options: (question.options || []).map((option) => String(option)),
    selectedAnswer: Number(selectedAnswer),
    correctAnswer,
    isCorrect: Number(selectedAnswer) === correctAnswer,
  };
}

function entitySnapshot(entity) {
  if (!entity) return { id: null, title: "" };
  return { id: entity._id || entity.id || entity, title: String(entity.title || "") };
}

function buildQuizSubmissionSnapshot({ quiz, answers, course, lesson, homeworkSet }) {
  return {
    contextType: quiz.contextType,
    quizTitle: String(quiz.title || ""),
    quizRevision: Number(quiz.revision || 1),
    course: entitySnapshot(course || quiz.course),
    lesson: entitySnapshot(lesson || quiz.lesson),
    homeworkSet: entitySnapshot(homeworkSet || quiz.homeworkSet),
    questions: (quiz.questions || []).map((question, index) => quizQuestionSnapshot(question, answers[index])),
  };
}

module.exports = { buildQuizSubmissionSnapshot, mediaSnapshot, quizQuestionSnapshot };
