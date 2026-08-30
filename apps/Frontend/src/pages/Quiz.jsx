import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import LoadingSpinner from "../components/LoadingSpinner";
import { fetchQuizzesForLesson, submitQuiz } from "../services/quizService";

function scoreMessage(percentage) {
  if (percentage === 100) return "Perfect! Excellent work.";
  if (percentage >= 80) return "Great job! You know this vocabulary well.";
  if (percentage >= 60) return "Nice work! A little more practice will help.";
  return "Keep practicing—you can try again whenever you are ready.";
}

function Quiz() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const quiz = quizzes[quizIndex];
  const question = quiz?.questions?.[questionIndex];

  useEffect(() => {
    fetchQuizzesForLesson(courseId, lessonId)
      .then((items) => {
        setQuizzes(items);
        setAnswers(Array(items[0]?.questions?.length || 0).fill(null));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [courseId, lessonId]);

  const chooseQuiz = (index) => {
    setQuizIndex(index);
    setQuestionIndex(0);
    setAnswers(Array(quizzes[index]?.questions?.length || 0).fill(null));
    setResult(null);
    setError("");
  };

  const chooseAnswer = (optionIndex) => {
    setAnswers((current) => current.map((answer, index) => index === questionIndex ? optionIndex : answer));
    setError("");
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
      setQuizzes((current) => current.map((item) => item._id === quiz._id ? { ...item, attemptsUsed: submission.attemptsUsed } : item));
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
  };

  if (loading) return <div className="min-h-screen bg-blue-50"><Navbar /><div className="flex min-h-[70vh] items-center justify-center"><LoadingSpinner message="Loading quiz..." /></div><Footer /></div>;

  return <div className="min-h-screen bg-blue-50"><Navbar /><main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
    <button onClick={() => navigate(`/course-lessons/${courseId}`)} className="mb-7 font-semibold text-gray-700 transition hover:text-gray-950">← Back to lessons</button>
    {error && !quiz ? <div className="rounded-xl bg-red-50 p-5 text-red-700">{error}</div> : !quiz ? <div className="rounded-2xl bg-white p-10 text-center shadow"><h1 className="text-2xl font-bold text-gray-900">No quiz yet</h1><p className="mt-2 text-gray-600">Your teacher has not added a quiz for this lesson.</p><Link to={`/course-lessons/${courseId}`} className="mt-5 inline-block rounded-lg bg-pink-300 px-5 py-2.5 font-medium text-gray-900">Return to lessons</Link></div> : <>
      {quizzes.length > 1 && <div className="mb-5 flex flex-wrap gap-2">{quizzes.map((item, index) => <button key={item._id} onClick={() => chooseQuiz(index)} className={`rounded-full px-4 py-2 text-sm font-medium ${index === quizIndex ? "bg-pink-300 text-gray-900" : "bg-white text-gray-700"}`}>{item.title}</button>)}</div>}
      <div className="rounded-3xl bg-white p-6 shadow-lg sm:p-10"><h1 className="text-center text-3xl font-bold text-gray-900">{quiz.title}</h1>{quiz.maxAttempts ? <p className="mt-3 text-center text-sm text-gray-500">Attempts remaining: {Math.max(quiz.maxAttempts - quiz.attemptsUsed, 0)} of {quiz.maxAttempts}</p> : <p className="mt-3 text-center text-sm text-gray-500">Unlimited attempts</p>}
        {result ? <div className="py-8 text-center"><div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-pink-100 text-3xl font-bold text-pink-800">{Math.round((result.score / result.total) * 100)}%</div><h2 className="mt-6 text-2xl font-bold text-gray-900">{result.score} / {result.total} correct</h2><p className="mt-2 text-gray-600">{scoreMessage(Math.round((result.score / result.total) * 100))}</p><div className="mt-8 space-y-3 text-left">{quiz.questions.map((item, index) => <div key={item._id} className={`rounded-xl border p-4 ${result.results[index].correct ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}><p className="font-semibold text-gray-900">Question {index + 1}: {result.results[index].correct ? "Correct" : `Correct answer: ${item.options[result.results[index].correctAnswer]}`}</p></div>)}</div>{quiz.maxAttempts && quiz.attemptsUsed >= quiz.maxAttempts ? <p className="mt-8 font-semibold text-gray-600">You have used all available attempts for this quiz.</p> : <button onClick={retryQuiz} className="mt-8 rounded-lg bg-pink-300 px-6 py-3 font-semibold text-gray-900 transition hover:bg-pink-400">Try again</button>}</div> : <>
          <div className="mt-7 flex items-center justify-between gap-4"><p className="text-sm font-semibold text-pink-700">Question {questionIndex + 1} of {quiz.questions.length}</p><div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-pink-300 transition-all" style={{ width: `${((questionIndex + 1) / quiz.questions.length) * 100}%` }} /></div></div>
          {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}
          <section className="pb-14 pt-9"><h2 className="text-center text-xl font-bold leading-relaxed text-gray-900">{question.prompt || "What is this?"}</h2><div className="mx-auto mt-7 max-w-xl rounded-3xl bg-gradient-to-b from-pink-50 to-white p-4 shadow-inner sm:p-6"><img src={question.image} alt={`Quiz question ${questionIndex + 1}`} className="mx-auto h-72 w-full rounded-2xl object-cover shadow-md sm:h-80" /></div><p className="mt-9 text-center text-sm font-medium uppercase tracking-wide text-gray-500">Choose the best answer</p><div className="mx-auto mt-4 grid max-w-lg gap-4 sm:grid-cols-2">{question.options.map((option, optionIndex) => <button key={optionIndex} onClick={() => chooseAnswer(optionIndex)} className={`min-h-14 rounded-xl border-2 px-5 py-4 text-left font-semibold shadow-sm transition ${answers[questionIndex] === optionIndex ? "border-pink-400 bg-pink-50 text-gray-900 shadow-pink-100" : "border-gray-200 bg-white text-gray-700 hover:border-pink-300 hover:shadow-md"}`}>{option}</button>)}</div></section>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-8"><button onClick={() => setQuestionIndex((current) => current - 1)} disabled={questionIndex === 0} className="rounded-lg px-4 py-2.5 font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40">Back</button>{questionIndex === quiz.questions.length - 1 ? <button onClick={handleSubmit} className="rounded-lg bg-pink-300 px-6 py-3 font-semibold text-gray-900 shadow-sm transition hover:bg-pink-400 hover:shadow-md">Finish quiz</button> : <button onClick={() => setQuestionIndex((current) => current + 1)} className="rounded-lg bg-pink-300 px-6 py-3 font-semibold text-gray-900 shadow-sm transition hover:bg-pink-400 hover:shadow-md">Next question</button>}</div>
        </>}
      </div>
    </>}</main><Footer /></div>;
}

export default Quiz;
