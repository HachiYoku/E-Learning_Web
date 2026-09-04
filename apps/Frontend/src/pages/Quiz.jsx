import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import LoadingSpinner from "../components/LoadingSpinner";
import { fetchQuizzesForLesson, fetchCourseQuizzes, fetchQuizHistory, submitQuiz } from "../services/quizService";

function scoreMessage(percentage) {
  if (percentage === 100) return "Perfect! Excellent work.";
  if (percentage >= 80) return "Great job! You know this vocabulary well.";
  if (percentage >= 60) return "Nice work! A little more practice will help.";
  return "Keep practicing—you can try again whenever you are ready.";
}

function getSavedQuizDraft(key) {
  try {
    const draft = localStorage.getItem(key);
    return draft ? JSON.parse(draft) : null;
  } catch {
    return null;
  }
}

function clearSavedQuizDraft(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // The quiz remains usable if browser storage is unavailable.
  }
}

function FinalAnswerReview({ questions, answers, correctAnswers }) {
  return (
    <div className="mt-8 space-y-5 text-left">
      {questions.map((item, index) => {
        const answerIndex = answers[index];
        const correctAnswerIndex = correctAnswers[index];
        const isCorrect = answerIndex === correctAnswerIndex;

        return (
          <article key={item._id || item.id || index} className={`overflow-hidden rounded-2xl border ${isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            {item.image ? <img src={item.image} alt={`Question ${index + 1}`} className="h-48 w-full object-cover sm:h-64" /> : null}
            <div className="p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#765F55]">Question {index + 1}</p>
              <h3 className="mt-1 text-lg font-bold text-[#2D2E30]">{item.prompt || "Question"}</h3>
              <p className={`mt-4 rounded-xl bg-white/80 px-3 py-2.5 text-sm ${isCorrect ? "text-[#4D7C57]" : "text-[#A84646]"}`}><span className="font-bold">Your answer:</span> {item.options[answerIndex] ?? "Answer unavailable"}</p>
              {!isCorrect ? <p className="mt-2 rounded-xl bg-white/80 px-3 py-2.5 text-sm text-[#4D7C57]"><span className="font-bold">Correct answer:</span> {item.options[correctAnswerIndex] ?? "Answer unavailable"}</p> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Quiz() {
  const { courseId, lessonId, quizId } = useParams();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(null);
  const [isAttemptHistoryOpen, setIsAttemptHistoryOpen] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const quiz = quizzes[quizIndex];
  const question = quiz?.questions?.[questionIndex];
  const isCourseQuiz = Boolean(quizId);
  const draftKey = `quiz-draft:${courseId}:${lessonId || "course"}:${quizId || "lesson"}`;

  useEffect(() => {
    const loadQuizzes = async () => {
      try {
        let items;

        if (isCourseQuiz) {
          const allQuizzes = await fetchCourseQuizzes(courseId);
          items = allQuizzes.filter(
            (q) => String(q.id) === String(quizId) || String(q._id) === String(quizId)
          );
          if (items.length === 0) throw new Error("Quiz not found");
        } else {
          items = await fetchQuizzesForLesson(courseId, lessonId);
        }

        const savedDraft = getSavedQuizDraft(draftKey);
        const savedQuizIndex = items.findIndex(
          (item) => String(item._id || item.id) === String(savedDraft?.quizId)
        );
        const selectedQuizIndex = savedQuizIndex >= 0 ? savedQuizIndex : 0;
        const selectedQuiz = items[selectedQuizIndex];
        const validSavedAnswers = Array.isArray(savedDraft?.answers)
          && savedDraft.answers.length === (selectedQuiz?.questions?.length || 0)
          && savedDraft.answers.every((answer, index) => answer === null || Number.isInteger(answer) && answer >= 0 && answer < (selectedQuiz.questions[index]?.options?.length || 0));

        setQuizzes(items);
        setQuizIndex(selectedQuizIndex);
        setQuestionIndex(
          validSavedAnswers
            ? Math.min(Math.max(savedDraft.questionIndex || 0, 0), Math.max((selectedQuiz?.questions?.length || 1) - 1, 0))
            : 0
        );
        setAnswers(validSavedAnswers ? savedDraft.answers : Array(selectedQuiz?.questions?.length || 0).fill(null));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadQuizzes();
  }, [courseId, lessonId, quizId, isCourseQuiz, draftKey]);

  useEffect(() => {
    if (loading || !quiz || result) return;

    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ quizId: quiz._id || quiz.id, questionIndex, answers })
      );
    } catch {
      // The quiz remains usable if browser storage is unavailable.
    }
  }, [answers, draftKey, loading, questionIndex, quiz, result]);

  useEffect(() => {
    if (!quiz?._id) {
      setHistory(null);
      return undefined;
    }

    let isMounted = true;
    setHistory(null);

    fetchQuizHistory(quiz._id)
      .then((data) => {
        if (isMounted) setHistory(data);
      })
      .catch(() => {
        if (isMounted) setHistory({ attempts: [], attemptsUsed: quiz.attemptsUsed || 0, maxAttempts: quiz.maxAttempts, bestScore: 0 });
      });

    return () => {
      isMounted = false;
    };
  }, [quiz?._id]);

  const chooseQuiz = (index) => {
    setQuizIndex(index);
    setQuestionIndex(0);
    setAnswers(Array(quizzes[index]?.questions?.length || 0).fill(null));
    setResult(null);
    setError("");
  };

  const chooseAnswer = (optionIndex) => {
    setAnswers((current) => current.map((answer, index) => (index === questionIndex ? optionIndex : answer)));
    setError("");
  };

  const handleFinishQuiz = () => {
    const firstUnansweredQuestion = answers.findIndex((answer) => answer === null);

    if (firstUnansweredQuestion !== -1) {
      const remainingQuestions = answers.filter((answer) => answer === null).length;
      setQuestionIndex(firstUnansweredQuestion);
      setError(
        `${remainingQuestions} question${remainingQuestions === 1 ? " is" : "s are"} still unanswered. Please choose an answer before finishing.`
      );
      return;
    }

    setError("");
    setIsSubmitConfirmOpen(true);
  };

  const handleSubmit = async () => {
    if (answers.some((answer) => answer === null)) {
      setError("Please answer every question before checking your result.");
      return;
    }

    try {
      setError("");
      const submission = await submitQuiz(quiz._id, answers);
      setResult(submission);
      clearSavedQuizDraft(draftKey);
      fetchQuizHistory(quiz._id)
        .then(setHistory)
        .catch(() => {});
      setQuizzes((current) =>
        current.map((item) => (item._id === quiz._id ? { ...item, attemptsUsed: submission.attemptsUsed } : item))
      );
      setQuestionIndex(0);
    } catch (err) {
      setError(err.message);
    }
  };

  const retryQuiz = () => {
    setAnswers(Array(quiz.questions.length).fill(null));
    setQuestionIndex(0);
    setResult(null);
    setError("");
    setIsSubmitConfirmOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF8]">
        <Navbar />
        <div className="flex min-h-[70vh] items-center justify-center">
          <LoadingSpinner message="Loading quiz..." />
        </div>
        <Footer />
      </div>
    );
  }

  const backPath = `/course-lessons/${courseId}`;
  const noQuizMessage = isCourseQuiz ? "This course quiz is not available." : "Your teacher has not added a quiz for this lesson.";
  const attemptsRemaining = quiz ? Math.max((quiz.maxAttempts ?? Infinity) - (quiz.attemptsUsed ?? 0), 0) : 0;
  const isQuizLocked = Boolean(quiz?.maxAttempts) && (quiz?.attemptsUsed ?? 0) >= quiz.maxAttempts && !result;
  const bestAttempt = history?.attempts?.reduce(
    (best, attempt) => (!best || attempt.score / attempt.total > best.score / best.total ? attempt : best),
    null
  );
  const lastAttempt = history?.attempts?.at(-1);

  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF8]">
      <Navbar />
      <div className="bg-[#FFF9EA] px-4 pt-6 sm:px-6 sm:pt-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <button onClick={() => navigate(backPath)} className="inline-flex items-center gap-2 text-sm font-bold text-[#765F55] transition hover:text-[#C97112]">
            ← Back to {isCourseQuiz ? "course" : "lesson"}
          </button>
        </div>
      </div>
      <main className="flex-1 bg-[#FFF9EA] px-4 pb-8 pt-2 sm:px-6 sm:pb-10 sm:pt-2 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
        {error && !quiz ? (
          <div className="rounded-xl bg-red-50 p-5 text-red-700">{error}</div>
        ) : !quiz ? (
          <div className="rounded-[1.75rem] border border-dashed border-[#D9CEBE] bg-white p-10 text-center shadow-[0_18px_45px_-32px_rgba(80,48,19,0.35)]">
            <h1 className="text-2xl font-bold text-[#2D2E30]">No quiz yet</h1>
            <p className="mt-2 text-[#765F55]">{noQuizMessage}</p>
            <Link to={backPath} className="mt-5 inline-block rounded-xl bg-[#F8C56A] px-5 py-2.5 font-bold text-[#2D2E30] transition hover:bg-[#E58C1A]">
              Return to {isCourseQuiz ? "course" : "lessons"}
            </Link>
          </div>
        ) : (
          <>
            {quizzes.length > 1 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {quizzes.map((item, index) => (
                  <button
                    key={item._id || item.id}
                    onClick={() => chooseQuiz(index)}
                    className={`rounded-full px-4 py-2 text-sm font-medium ${
                      index === quizIndex ? "bg-[#2D2E30] text-white" : "bg-white text-[#765F55] hover:bg-[#FFF4D8] hover:text-[#C97112]"
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-5 lg:gap-8">
              <aside className="lg:col-span-2">
                <div className="rounded-[1.75rem] border border-[#2D2E30]/10 bg-white p-5 shadow-[0_22px_55px_-40px_rgba(80,48,19,0.45)] sm:p-6 lg:sticky lg:top-20">
              <div className="flex flex-col gap-3 rounded-2xl bg-[#2D2E30] p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F8C56A]">{isCourseQuiz ? 'Course assessment' : 'Lesson assessment'}</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{quiz.title}</h2></div>
                <span className="w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">{quiz.maxAttempts ? `${attemptsRemaining} of ${quiz.maxAttempts} attempts left` : 'Unlimited attempts'}</span>
              </div>

              {history ? (
                <section className="mt-6 overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white text-left shadow-[0_14px_28px_-24px_rgba(80,48,19,0.45)]">
                  <div className="flex flex-wrap items-start justify-between gap-3 bg-[#2D2E30] p-4 sm:p-5">
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F8C56A]">Quiz record</p><h3 className="mt-1 font-bold text-white">Your progress</h3><p className="mt-1 text-xs text-white/65">Your previous attempts at a glance.</p></div>
                    {bestAttempt ? (
                      <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">Best score</p>
                        <p className="text-lg font-bold text-[#F8C56A]">{Math.round((bestAttempt.score / bestAttempt.total) * 100)}%</p>
                      </div>
                    ) : (
                      <p className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/75">No attempts yet</p>
                    )}
                  </div>

                  {history.attempts.length > 0 ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setIsAttemptHistoryOpen((current) => !current)}
                        aria-expanded={isAttemptHistoryOpen}
                        className="flex w-full items-center justify-between border-t border-[#2D2E30]/10 px-4 py-3 text-left text-xs font-bold text-[#765F55] transition hover:bg-[#FFF9EA] hover:text-[#C97112] sm:px-5"
                      >
                        <span>View {history.attempts.length} previous {history.attempts.length === 1 ? 'attempt' : 'attempts'}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isAttemptHistoryOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                      {isAttemptHistoryOpen ? <div className="space-y-2 border-t border-[#2D2E30]/10 p-4 sm:p-5">
                      {history.attempts.map((attempt) => (
                        <div key={attempt._id} className="flex items-center justify-between rounded-xl bg-[#FFF9EA] px-3 py-2.5 text-sm text-[#2D2E30]">
                          <span className="flex items-center gap-2 font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs text-[#C97112]">{attempt.attemptNumber}</span>Attempt {attempt.attemptNumber}</span>
                          <span className="font-bold text-[#B96128]">{attempt.score} / {attempt.total} <span className="text-xs">· {Math.round((attempt.score / attempt.total) * 100)}%</span></span>
                        </div>
                      ))}
                      </div> : null}
                    </div>
                  ) : null}
                </section>
              ) : null}

                </div>
              </aside>

              <section className="rounded-[1.75rem] border border-[#2D2E30]/10 bg-white p-5 shadow-[0_22px_55px_-40px_rgba(80,48,19,0.45)] sm:p-8 md:p-10 lg:col-span-3">

              {result ? (
                <div className="py-8 text-center">
                  <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-8 border-[#FFF4D8] bg-[#F8C56A] text-3xl font-bold text-[#2D2E30]">
                    {Math.round((result.score / result.total) * 100)}%
                  </div>
                  <h2 className="mt-6 text-2xl font-bold text-gray-900">
                    {result.score} / {result.total} correct
                  </h2>
                  <p className="mt-2 text-gray-600">{scoreMessage(Math.round((result.score / result.total) * 100))}</p>

                  {result.showCorrectAnswers ? (
                    <FinalAnswerReview
                      questions={quiz.questions}
                      answers={answers}
                      correctAnswers={result.results.map((item) => item.correctAnswer)}
                    />
                  ) : quiz.maxAttempts ? (
                    <p className="mt-6 text-sm text-gray-600">
                      Correct answers and detailed review will be shown after your final attempt.
                    </p>
                  ) : null}

                  {quiz.maxAttempts && quiz.attemptsUsed >= quiz.maxAttempts ? (
                    <p className="mt-8 font-semibold text-gray-600">You have used all available attempts for this quiz.</p>
                  ) : (
                    <button
                      onClick={retryQuiz}
                      className="mt-8 rounded-xl bg-[#F8C56A] px-6 py-3 font-bold text-[#2D2E30] transition hover:bg-[#E58C1A]"
                    >
                      Try again
                    </button>
                  )}
                </div>
              ) : isQuizLocked ? (
                <div className="py-10 text-center">
                  <div className="mx-auto max-w-2xl rounded-2xl border border-[#E58C1A]/25 bg-[#FFF9EA] p-6 text-left sm:p-8">
                    <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">Final attempt</p>
                    <h2 className="mt-2 text-center text-2xl font-bold text-[#2D2E30]">Your last answers</h2>
                    <p className="mt-3 text-center text-sm text-[#765F55]">You have used all available attempts. Here is what you selected on your final attempt.</p>
                    {Array.isArray(lastAttempt?.answers) && lastAttempt.answers.length === quiz.questions.length ? (
                      <FinalAnswerReview questions={quiz.questions} answers={lastAttempt.answers} correctAnswers={history.correctAnswers || []} />
                    ) : (
                      <p className="mt-6 rounded-xl bg-white p-4 text-center text-sm text-[#765F55]">Your final answers are not available for attempts submitted before answer review was added.</p>
                    )}
                    <button
                      onClick={() => navigate(backPath)}
                      className="mx-auto mt-7 block rounded-xl bg-[#F8C56A] px-5 py-3 font-bold text-[#2D2E30] transition hover:bg-[#E58C1A]"
                    >
                      Back to course
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-7 flex items-center justify-between gap-4">
                    <p className="text-sm font-bold text-[#C97112]">
                      Question {questionIndex + 1} of {quiz.questions.length}
                    </p>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F0E7DC]">
                      <div
                        className="h-full rounded-full bg-[#E58C1A] transition-all"
                        style={{ width: `${((questionIndex + 1) / quiz.questions.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-[#2D2E30]/10 bg-[#FFF9EA] p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#765F55]">Questions</p><p className="text-xs font-semibold text-[#C97112]">{answers.filter((answer) => answer !== null).length} of {quiz.questions.length} answered</p></div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {quiz.questions.map((_, index) => {
                        const isActive = index === questionIndex;
                        const isAnswered = answers[index] !== null;
                        return <button key={index} type="button" onClick={() => setQuestionIndex(index)} className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition ${isActive ? 'bg-[#2D2E30] text-white shadow-sm' : isAnswered ? 'bg-[#FFF1CE] text-[#9A5816] hover:bg-[#F8C56A]' : 'bg-white text-[#765F55] hover:bg-[#FFF4D8] hover:text-[#C97112]'}`}>{index + 1}</button>
                      })}
                    </div>
                  </div>

                  <section className="pb-14 pt-9">
                    <h3 className="text-center text-xl font-bold leading-relaxed text-[#2D2E30] sm:text-2xl">
                      {question.prompt || "What is this?"}
                    </h3>
                    <div className="mx-auto mt-7 max-w-xl rounded-[1.5rem] bg-[#FFF9EA] p-2 shadow-inner sm:p-3">
                      <img
                        src={question.image}
                        alt={`Quiz question ${questionIndex + 1}`}
                        className="mx-auto h-52 w-full rounded-2xl object-cover shadow-md sm:h-80"
                      />
                    </div>

                    <p className="mt-9 text-center text-xs font-bold uppercase tracking-[0.18em] text-[#765F55]">
                      Choose the best answer
                    </p>

                    <div className="mx-auto mt-4 grid max-w-lg gap-4 sm:grid-cols-2">
                      {question.options.map((option, optionIndex) => (
                        <button
                          key={optionIndex}
                          onClick={() => chooseAnswer(optionIndex)}
                          className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-4 text-left font-semibold shadow-sm transition ${
                            answers[questionIndex] === optionIndex
                              ? "border-[#E58C1A] bg-[#FFF4D8] text-[#2D2E30] shadow-[#E58C1A]/10"
                              : "border-[#2D2E30]/10 bg-white text-[#2D2E30] hover:border-[#E58C1A]/45 hover:bg-[#FFF9EA] hover:shadow-md"
                          }`}
                        >
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${answers[questionIndex] === optionIndex ? 'bg-[#E58C1A] text-white' : 'bg-[#F0E7DC] text-[#765F55]'}`}>{String.fromCharCode(65 + optionIndex)}</span>
                          <span>{option}</span>
                        </button>
                      ))}
                    </div>
                    {error ? <div className="mx-auto mt-4 max-w-lg rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
                  </section>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-8">
                    <button
                      onClick={() => setQuestionIndex((current) => current - 1)}
                      disabled={questionIndex === 0}
                      className="rounded-xl px-4 py-2.5 font-bold text-[#765F55] transition hover:bg-[#FFF4D8] hover:text-[#C97112] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Back
                    </button>

                    {questionIndex === quiz.questions.length - 1 ? (
                      <button
                        onClick={handleFinishQuiz}
                        className="rounded-xl bg-[#F8C56A] px-6 py-3 font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] hover:shadow-md"
                      >
                        Finish quiz
                      </button>
                    ) : (
                      <button
                        onClick={() => setQuestionIndex((current) => current + 1)}
                        className="rounded-xl bg-[#F8C56A] px-6 py-3 font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] hover:shadow-md"
                      >
                        Next question
                      </button>
                    )}
                  </div>
                </>
              )}
              </section>
            </div>
          </>
        )}
        </div>
      </main>
      {isSubmitConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-quiz-title">
          <div className="w-full max-w-md rounded-[1.75rem] bg-white p-6 shadow-2xl sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">Ready to submit?</p>
            <h2 id="submit-quiz-title" className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30]">Finish this quiz?</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#765F55]">You have answered all {quiz.questions.length} questions. Once submitted, your result will be recorded.</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setIsSubmitConfirmOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF4D8] hover:text-[#C97112]">Keep reviewing</button><button type="button" onClick={() => { setIsSubmitConfirmOpen(false); handleSubmit(); }} className="rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] transition hover:bg-[#E58C1A]">Submit quiz</button></div>
          </div>
        </div>
      ) : null}
      <Footer />
    </div>
  );
}

export default Quiz;
