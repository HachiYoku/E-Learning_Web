import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, UNSAFE_NavigationContext, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, History, Maximize2, Volume2, X } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import LoadingSpinner from "../components/LoadingSpinner";
import { fetchQuizzesForLesson, fetchCourseQuizzes, fetchQuizHistory, startQuizSession, submitQuiz, fetchQuizAttemptRequests, createQuizAttemptRequest, cancelQuizAttemptRequest } from "../services/quizService";
import { learningCoursePath } from "../utils/learningNavigation";
import { useAuth } from "../contexts/AuthContext";
import { checkEnrollment } from "../services/enrollmentService";

function scoreMessage(percentage) {
  if (percentage === 100) return "Perfect! Excellent work.";
  if (percentage >= 80) return "Great job! You know this vocabulary well.";
  if (percentage >= 60) return "Nice work! A little more practice will help.";
  return "Keep Practicing";
}

function ResultSummary({ score, total, canRetake }) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const message = scoreMessage(percentage);
  return <div className="mx-auto mt-6 max-w-md rounded-2xl border border-[#E58C1A]/20 bg-[#FFFDF8] px-6 py-7 text-center sm:px-8">
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B96128]">Your score</p>
    <p className="mt-2 text-5xl font-bold tracking-tight text-[#2D2E30] sm:text-6xl">{percentage}%</p>
    <p className="mt-3 text-base font-semibold text-[#765F55]">{score} / {total} correct</p>
    <p className="mt-3 border-t border-[#E58C1A]/15 pt-3 text-sm font-semibold text-[#2D2E30]">{message}</p>
    {message === "Keep Practicing" ? <p className="mt-1 text-xs leading-5 text-[#765F55] sm:text-sm">{canRetake ? "You're making progress. Try again!" : "You've used all available attempts."}</p> : null}
  </div>;
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

let activeQuizAudio = null;
function QuestionAudio({ src, label, onFailure, onReady }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) { audio.pause(); audio.currentTime = 0; }
      if (activeQuizAudio === audio) activeQuizAudio = null;
    };
  }, []);
  if (!src) return null;
  const playFromBeginning = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (activeQuizAudio && activeQuizAudio !== audio) {
      activeQuizAudio.pause();
      activeQuizAudio.currentTime = 0;
    }
    audio.currentTime = 0;
    activeQuizAudio = audio;
    try { await audio.play(); } catch { onFailure?.(); }
  };
  return <div className="mt-5 flex justify-center"><audio ref={audioRef} preload="metadata" src={src} onLoadedData={onReady} onCanPlay={onReady} onPlay={(event) => { if (activeQuizAudio && activeQuizAudio !== event.currentTarget) { activeQuizAudio.pause(); activeQuizAudio.currentTime = 0; } activeQuizAudio = event.currentTarget; setPlaying(true); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={onFailure} /><button type="button" onClick={playFromBeginning} aria-label={label ? `Play question audio: ${label}` : "Play question audio"} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20 ${playing ? "border-[#E58C1A] bg-[#E58C1A] text-white" : "border-[#E58C1A]/25 bg-[#FFF1D0] text-[#C97112] hover:bg-[#F8C56A] hover:text-[#2D2E30]"}`}><Volume2 className={`h-5 w-5 ${playing ? "animate-pulse motion-reduce:animate-none" : ""}`} aria-hidden="true" /><span>Tap to listen</span></button></div>;
}

function FinalAnswerReview({ questions, review, allowCorrectAnswers = true, historical = false, onEnlargeImage }) {
  return (
    <div className="mt-8 space-y-5 text-left">
      {questions.map((item, index) => {
        const answerIndex = review[index]?.selectedAnswer;
        const correctAnswerIndex = review[index]?.correctAnswer;
        const isCorrect = review[index]?.isCorrect === true;
        const hasCorrectAnswer = Number.isInteger(correctAnswerIndex);

        return (
          <article key={item._id || item.id || index} className={`overflow-hidden rounded-2xl border ${historical ? "border-[#2D2E30]/10 bg-[#FFFDF8]" : isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
            {item.image ? historical ? <div className="mx-auto mt-5 max-w-xl rounded-[1.5rem] bg-[#FFF9EA] p-2 shadow-inner sm:p-3 lg:max-w-lg">
              <button type="button" onClick={(event) => onEnlargeImage(event.currentTarget, item, index)} aria-label={`View question ${index + 1} image larger`} className="group relative block w-full cursor-zoom-in rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/30">
                <img src={item.image} alt={item.imageDecorative ? "" : item.imageAlt || `Question ${index + 1}`} className="mx-auto max-h-64 max-w-full rounded-2xl object-contain shadow-md" />
                <span aria-hidden="true" className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-[#2D2E30]/85 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition group-hover:bg-[#2D2E30]"><Maximize2 size={14} />View larger</span>
              </button>
            </div> : <img src={item.image} alt={item.imageDecorative ? "" : item.imageAlt || `Question ${index + 1}`} className="h-48 w-full object-contain sm:h-64" /> : null}
            <div className="p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#765F55]">Question {index + 1}</p>
              <h3 className="mt-1 text-lg font-bold text-[#2D2E30]">{item.prompt || "Question"}</h3>
              {item.audio ? <QuestionAudio src={item.audio} label={item.audioLabel} /> : null}
              {historical ? <>
                <p className="mt-4 text-sm font-bold text-[#2D2E30]">Status: {review[index]?.isCorrect === true ? "Correct" : review[index]?.isCorrect === false ? "Incorrect" : "Unavailable"}</p>
                <ol className="mt-4 grid gap-3 sm:grid-cols-2" aria-label={`Saved answer options for question ${index + 1}`}>
                  {item.options.map((option, optionIndex) => {
                    const selected = answerIndex === optionIndex;
                    const correct = allowCorrectAnswers && hasCorrectAnswer && correctAnswerIndex === optionIndex;
                    const incorrectSelected = selected && review[index]?.isCorrect === false;
                    const label = selected && correct ? "Your answer · Correct" : correct ? "Correct answer" : incorrectSelected ? "Your answer · Incorrect" : selected ? "Your answer" : "";
                    return <li key={optionIndex} className={`flex min-h-14 items-start gap-3 rounded-xl border-2 px-4 py-4 text-sm font-semibold leading-relaxed shadow-sm ${correct ? "border-[#2F7A49] bg-[#E9F4EA]" : incorrectSelected ? "border-[#B5443C] bg-[#FFF0EE]" : selected ? "border-[#E58C1A] bg-[#FFF4D8]" : "border-[#2D2E30]/10 bg-white"}`}>
                      <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${selected ? "bg-[#E58C1A] text-white" : "bg-[#F0E7DC] text-[#765F55]"}`}>{String.fromCharCode(65 + optionIndex)}</span>
                      <span className="min-w-0 flex-1 break-words">{option}{label ? <span className="mt-1 block text-xs font-bold">{label}</span> : null}</span>
                    </li>;
                  })}
                </ol>
              </> : <>
              <p className={`mt-4 rounded-xl bg-white/80 px-3 py-2.5 text-sm ${isCorrect ? "text-[#4D7C57]" : "text-[#A84646]"}`}><span className="font-bold">Your answer:</span> {item.options[answerIndex] ?? "Answer unavailable"}</p>
              <p className={`mt-2 rounded-xl bg-white/80 px-3 py-2.5 text-sm ${isCorrect ? "text-[#4D7C57]" : "text-[#A84646]"}`}><span className="font-bold">{isCorrect ? "Right" : "Wrong"}</span></p>
              {allowCorrectAnswers && hasCorrectAnswer ? <p className="mt-2 rounded-xl bg-white/80 px-3 py-2.5 text-sm text-[#4D7C57]"><span className="font-bold">Correct answer:</span> {item.options[correctAnswerIndex] ?? "Answer unavailable"}</p> : null}
              </>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function hasCompleteHistoricalReview(attempt) {
  const questions = attempt?.snapshot?.questions;
  return Array.isArray(questions) && questions.length > 0 && questions.length === attempt.total &&
    Array.isArray(attempt.review) && attempt.review.length === questions.length &&
    questions.every((question) => Array.isArray(question.options) && question.options.length >= 2 && question.options.every((option) => typeof option === "string" && option.trim()));
}

function QuizStateCard({ kind, onRestart, backPath }) {
  const restart = kind === "restart" || kind === "session";
  const access = kind === "access";
  return <section role="status" className="mx-auto my-8 max-w-xl rounded-3xl border border-[#E58C1A]/20 bg-white p-6 text-center shadow-sm sm:p-10">
    <div aria-hidden="true" className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1CE] text-2xl text-[#C97112]">{restart ? "↻" : "◇"}</div>
    <h1 className="text-2xl font-bold text-[#2D2E30]">{kind === "restart" ? "This quiz was updated" : kind === "session" ? "Quiz session ended" : access ? "Course access required" : "Quiz unavailable"}</h1>
    <p className="mt-3 text-sm leading-6 text-[#765F55]">{kind === "restart" ? "The quiz changed while you were taking it. Please restart to continue with the latest version." : kind === "session" ? "Please restart to continue with a new quiz session. Your answers were not submitted." : access ? "You need to be enrolled in this course to access this quiz." : "This quiz is currently unavailable."}</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3">
      {restart ? <button type="button" onClick={onRestart} className="rounded-xl bg-[#2D2E30] px-5 py-3 font-bold text-white">Restart quiz</button> : null}
      <Link to={access ? "/app/courses" : backPath} className="rounded-xl bg-[#FFF1CE] px-5 py-3 font-bold text-[#765F55]">{access ? "Back to My Courses" : "Back to course"}</Link>
      {!restart && !access ? <button type="button" onClick={onRestart} className="rounded-xl px-5 py-3 font-bold text-[#C97112]">Try again</button> : null}
    </div>
  </section>;
}

const requestStatusLabel = { pending: "Pending", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled", superseded: "Superseded" };

function ExtraSubmissionRequests({ quiz, requests, pendingRequest, formOpen, setFormOpen, reason, setReason, busy, onCreate, onCancel }) {
  const exhausted = Boolean(quiz.maxAttempts) && (quiz.attemptsUsed || 0) >= quiz.maxAttempts;
  if (!exhausted && requests.length === 0) return null;
  return <section className="mx-auto mt-6 max-w-2xl text-left" aria-label="Extra submission requests">
    {exhausted ? <div className="rounded-2xl border border-[#E58C1A]/25 bg-white p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C97112]">Need another submission?</p>
      {pendingRequest ? <>
        <h3 className="mt-2 font-bold text-[#2D2E30]">Extra submission requested</h3>
        <p className="mt-1 text-sm text-[#765F55]">Waiting for Admin review.</p>
        <button type="button" disabled={busy} onClick={onCancel} className="mt-4 rounded-xl border border-[#2D2E30]/15 px-4 py-2.5 text-sm font-bold text-[#765F55] hover:bg-[#FFF9EA] disabled:opacity-60">Cancel request</button>
      </> : formOpen ? <div className="mt-3"><label className="block text-sm font-bold text-[#2D2E30]">Reason <span className="text-[#A84646]">*</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows="4" className="mt-2 w-full rounded-xl border border-[#2D2E30]/15 p-3 font-normal outline-none focus:border-[#E58C1A]" placeholder="Tell us why you need one more submission." /></label><p className="mt-1 text-right text-xs text-[#765F55]">{reason.length}/500</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={busy || !reason.trim()} onClick={onCreate} className="rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#E58C1A] disabled:opacity-60">{busy ? "Submitting..." : "Submit request"}</button><button type="button" disabled={busy} onClick={() => { setFormOpen(false); setReason(""); }} className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#765F55]">Cancel</button></div></div> : <><p className="mt-2 text-sm text-[#765F55]">You have used all available submissions. You can ask Admin to review one additional submission.</p><button type="button" onClick={() => setFormOpen(true)} className="mt-4 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#E58C1A]">Request extra submission</button></>}
    </div> : null}
    {requests.length ? <div className="mt-4 space-y-3"><h3 className="text-sm font-bold text-[#2D2E30]">Request history</h3>{requests.map((request) => <article key={request._id} className="rounded-xl border border-[#2D2E30]/10 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold text-[#2D2E30]">{requestStatusLabel[request.status] || request.status}</span><time className="text-xs text-[#765F55]">{new Date(request.createdAt).toLocaleDateString()}</time></div><p className="mt-2 whitespace-pre-wrap text-sm text-[#765F55]">{request.reason}</p>{request.status === "approved" ? <p className="mt-2 text-sm font-semibold text-[#4D7C57]">One additional submission was granted.</p> : null}{request.adminNote ? <p className="mt-2 rounded-lg bg-[#FFF9EA] p-2.5 text-sm text-[#765F55]"><span className="font-bold text-[#2D2E30]">Admin response: </span>{request.adminNote}</p> : null}</article>)}</div> : null}
  </section>;
}

function Quiz() {
  const { courseId, lessonId, quizId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const navigation = useContext(UNSAFE_NavigationContext);
  const [quizzes, setQuizzes] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [historyScrollRequest, setHistoryScrollRequest] = useState(0);
  const pendingHistoryScroll = useRef(null);
  const historicalResultRef = useRef(null);
  const [quizSession, setQuizSession] = useState(null);
  const [sessionState, setSessionState] = useState("idle");
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [pageState, setPageState] = useState(null);
  const lightboxOrigin = useRef(null);
  const selectedQuizId = useRef(null);
  const permitNavigation = useRef(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const leaveDialog = useRef(null);
  const [requestHistory, setRequestHistory] = useState([]);
  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
  const [requestReason, setRequestReason] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [isAttemptHistoryOpen, setIsAttemptHistoryOpen] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [failedMedia, setFailedMedia] = useState({});
  const [mediaRetry, setMediaRetry] = useState({});
  const [lightboxImage, setLightboxImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    if (!pendingHistoryScroll.current || pendingHistoryScroll.current !== selectedAttemptId || !historicalResultRef.current) return;
    pendingHistoryScroll.current = null;
    historicalResultRef.current.scrollIntoView?.({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
      block: "start",
    });
  }, [selectedAttemptId, historyScrollRequest]);

  const reviewHistoricalAttempt = (attempt) => {
    const attemptId = String(attempt._id || attempt.attemptNumber);
    pendingHistoryScroll.current = attemptId;
    setSelectedAttemptId(attemptId);
    setHistoryScrollRequest((count) => count + 1);
  };

  const quiz = quizzes[quizIndex];
  const question = quiz?.questions?.[questionIndex];
  const isCourseQuiz = Boolean(quizId);
  const userId = user?.id || user?._id;
  const draftKey = userId ? `quiz-draft:${userId}:${courseId}:${lessonId || "course"}:${quizId || "lesson"}` : null;
  const hasUnsubmittedAnswers = answers.some((answer) => answer !== null) && !result && !pageState;

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!hasUnsubmittedAnswers || permitNavigation.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasUnsubmittedAnswers]);

  // BrowserRouter does not provide useBlocker; restore its navigator on cleanup.
  /* eslint-disable react-hooks/immutability */
  useEffect(() => {
    const navigator = navigation?.navigator;
    if (!navigator || !hasUnsubmittedAnswers) return;
    const originals = {};
    for (const method of ["push", "replace", "go"]) {
      originals[method] = navigator[method];
      navigator[method] = (...args) => {
        if (permitNavigation.current) return originals[method].apply(navigator, args);
        setPendingNavigation(() => () => originals[method].apply(navigator, args));
      };
    }
    return () => { for (const method of Object.keys(originals)) navigator[method] = originals[method]; };
  }, [navigation, hasUnsubmittedAnswers]);
  /* eslint-enable react-hooks/immutability */

  useEffect(() => {
    if (!pendingNavigation) return undefined;
    const origin = document.activeElement;
    const node = leaveDialog.current;
    node?.querySelector("button")?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") { event.preventDefault(); setPendingNavigation(null); }
      if (event.key === "Tab") {
        const buttons = [...(node?.querySelectorAll("button") || [])];
        if (!buttons.length) return;
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); origin?.focus(); };
  }, [pendingNavigation]);

  useEffect(() => {
    let active = true;
    const loadQuizzes = async () => {
      setLoading(true);
      setPageState(null);
      setQuizSession(null);
      setSessionState("starting");
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

        const savedDraft = draftKey ? getSavedQuizDraft(draftKey) : null;
        const savedQuizIndex = items.findIndex(
          (item) => String(item._id || item.id) === String(selectedQuizId.current || savedDraft?.quizId)
        );
        const selectedQuizIndex = savedQuizIndex >= 0 ? savedQuizIndex : 0;
        let selectedQuiz = items[selectedQuizIndex];
        let session = null;
        if (selectedQuiz && !selectedQuiz.locked && !(selectedQuiz.maxAttempts && selectedQuiz.attemptsUsed >= selectedQuiz.maxAttempts)) {
          session = await startQuizSession(selectedQuiz._id || selectedQuiz.id);
          if (!session?.sessionId) throw new Error("Unable to start this quiz. Please try again.");
          selectedQuiz = { ...selectedQuiz, revision: session.revision, title: session.title || selectedQuiz.title, questions: session.questions || selectedQuiz.questions };
          items = items.map((item, index) => index === selectedQuizIndex ? selectedQuiz : item);
        }
        if (!active) return;
        const validSavedAnswers = Array.isArray(savedDraft?.answers)
          && (savedDraft.revision === undefined || savedDraft.revision === selectedQuiz?.revision)
          && savedDraft.answers.length === (selectedQuiz?.questions?.length || 0)
          && savedDraft.answers.every((answer, index) => answer === null || Number.isInteger(answer) && answer >= 0 && answer < (selectedQuiz.questions[index]?.options?.length || 0));

        if (draftKey && selectedQuiz?.maxAttempts && selectedQuiz.attemptsUsed >= selectedQuiz.maxAttempts) {
          clearSavedQuizDraft(draftKey);
        }

        setQuizzes(items);
        setQuizSession(session);
        setSessionState(session ? "ready" : "idle");
        setQuizIndex(selectedQuizIndex);
        setQuestionIndex(
          validSavedAnswers
            ? Math.min(Math.max(savedDraft.questionIndex || 0, 0), Math.max((selectedQuiz?.questions?.length || 1) - 1, 0))
            : 0
        );
        setAnswers(validSavedAnswers && !(selectedQuiz?.maxAttempts && selectedQuiz.attemptsUsed >= selectedQuiz.maxAttempts) ? savedDraft.answers : Array(selectedQuiz?.questions?.length || 0).fill(null));
      } catch (err) {
        const enrollment = await checkEnrollment(courseId).catch(() => null);
        if (active) {
          setError(err.message);
          setSessionState("error");
          setPageState(enrollment?.enrolled === false ? "access" : "unavailable");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadQuizzes();
    return () => { active = false; };
  }, [courseId, lessonId, quizId, isCourseQuiz, draftKey, sessionEpoch]);

  useEffect(() => {
    if (loading || !quiz || result || !draftKey || sessionState !== "ready") return;

    if (quiz.maxAttempts && quiz.attemptsUsed >= quiz.maxAttempts) {
      clearSavedQuizDraft(draftKey);
      return;
    }

    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ quizId: quiz._id || quiz.id, revision: quizSession?.revision, questionIndex, answers })
      );
    } catch {
      // The quiz remains usable if browser storage is unavailable.
    }
  }, [answers, draftKey, loading, questionIndex, quiz, result, sessionState, quizSession?.revision]);

  useEffect(() => {
    if (!quiz?._id) return undefined;

    let isMounted = true;

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
  }, [quiz?._id, quiz?.attemptsUsed, quiz?.maxAttempts]);

  useEffect(() => {
    if (!lightboxImage) return undefined;
    const origin = lightboxOrigin.current;
    const closeButton = document.querySelector("[data-quiz-lightbox-close]");
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setLightboxImage(null);
      if (event.key === "Tab") { event.preventDefault(); closeButton?.focus(); }
    };
    document.addEventListener("keydown", closeOnEscape);
    closeButton?.focus();
    return () => { document.removeEventListener("keydown", closeOnEscape); origin?.focus(); };
  }, [lightboxImage]);

  const closeLightbox = () => setLightboxImage(null);

  useEffect(() => {
    if (!isCourseQuiz || !quiz?._id || quiz.locked) return undefined;
    let isMounted = true;
    fetchQuizAttemptRequests(quiz._id).then((data) => { if (isMounted) setRequestHistory(data.requests || []); }).catch(() => { if (isMounted) setRequestHistory([]); });
    return () => { isMounted = false; };
  }, [isCourseQuiz, quiz?._id, quiz?.locked, quiz?.attemptsUsed, quiz?.maxAttempts]);

  const chooseQuiz = (index) => {
    selectedQuizId.current = quizzes[index]._id || quizzes[index].id;
    if (draftKey) {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ quizId: quizzes[index]._id || quizzes[index].id, questionIndex: 0, answers: [] }));
      } catch {
        // Choosing another quiz must still work when browser storage is unavailable.
      }
    }
    setSessionEpoch((value) => value + 1);
    setHistory(null);
    setSelectedAttemptId(null);
    setQuizSession(null);
    setSessionState("idle");
    setResult(null);
    setError("");
  };

  const chooseAnswer = (optionIndex) => {
    setAnswers((current) => current.map((answer, index) => (index === questionIndex ? optionIndex : answer)));
    setError("");
  };

  const handleFinishQuiz = () => {
    if (sessionState !== "ready") return;
    const unavailable = quiz.questions.findIndex((item, index) => !item.prompt?.trim() && !(item.image && failedMedia[index]?.image === "ready") && !(item.audio && failedMedia[index]?.audio === "ready"));
    if (unavailable !== -1) {
      setQuestionIndex(unavailable);
      setError("Please wait for the question image or audio to load, or try again.");
      return;
    }
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
    if (submittingRef.current || sessionState !== "ready" || !quizSession?.sessionId) return;
    if (quiz.questions.some((item, index) => !item.prompt?.trim() && !(item.image && failedMedia[index]?.image === "ready") && !(item.audio && failedMedia[index]?.audio === "ready"))) {
      setError("Please wait for the question image or audio to load, or try again.");
      return;
    }
    if (answers.some((answer) => answer === null)) {
      setError("Please answer every question before checking your result.");
      return;
    }

    try {
      submittingRef.current = true;
      setSubmitting(true);
      setError("");
      const submission = await submitQuiz(quiz._id || quiz.id, answers, quizSession.revision, quizSession.sessionId);
      setResult(submission);
      if (draftKey) clearSavedQuizDraft(draftKey);
      fetchQuizHistory(quiz._id)
        .then(setHistory)
        .catch(() => {});
      setQuizzes((current) =>
        current.map((item) => (item._id === quiz._id ? { ...item, attemptsUsed: submission.attemptsUsed } : item))
      );
      setQuestionIndex(0);
    } catch (err) {
      if (["quiz_session_invalidated", "quiz_session_expired", "invalid_quiz_session"].includes(err.code)) {
        setPageState(err.code === "quiz_session_invalidated" ? "restart" : "session");
        setSessionState("invalidated");
      } else if (err.code === "quiz_unavailable" || err.status === 404) {
        setPageState("unavailable");
        setSessionState("error");
      }
      setError(err.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const retryQuiz = () => {
    if (draftKey) clearSavedQuizDraft(draftKey);
    setSessionEpoch((value) => value + 1);
    setFailedMedia({});
    setMediaRetry({});
    setAnswers(Array(quiz?.questions?.length || 0).fill(null));
    setQuestionIndex(0);
    setResult(null);
    setSelectedAttemptId(null);
    setQuizSession(null);
    setSessionState("idle");
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

  const backPath = `/app/learn/${courseId}`;
  const lessonBackPath = !isCourseQuiz && lessonId ? learningCoursePath(courseId, lessonId) : backPath;
  const noQuizMessage = "This quiz is currently unavailable.";
  const attemptsRemaining = quiz ? Math.max((quiz.maxAttempts ?? Infinity) - (quiz.attemptsUsed ?? 0), 0) : 0;
  const isQuizLocked = Boolean(quiz?.maxAttempts) && (quiz?.attemptsUsed ?? 0) >= quiz.maxAttempts && !result;
  const pendingRequest = requestHistory.find((request) => request.status === "pending");
  const bestAttempt = history?.attempts?.reduce(
    (best, attempt) => (!best || attempt.score / attempt.total > best.score / best.total ? attempt : best),
    null
  );
  const lastAttempt = history?.attempts?.at(-1);
  const selectedHistoricalAttempt = history?.attempts?.find((attempt) => String(attempt._id || attempt.attemptNumber) === selectedAttemptId);
  const currentMaxAttempts = result?.maxAttempts !== undefined ? result.maxAttempts : history?.maxAttempts !== undefined ? history.maxAttempts : quiz?.maxAttempts;
  const currentAttemptsUsed = result?.attemptsUsed ?? history?.attemptsUsed ?? quiz?.attemptsUsed ?? 0;
  const canRetake = currentMaxAttempts == null || currentAttemptsUsed < currentMaxAttempts;
  const isTakingQuiz = !selectedHistoricalAttempt && !result && !isQuizLocked;

  return (
    <div className="flex min-h-screen flex-col bg-[#FFFDF8]">
      <Navbar />
      <div className="bg-[#FFF9EA] px-4 pt-6 sm:px-6 sm:pt-8 md:px-10">
        <div className="mx-auto max-w-7xl lg:max-w-[1200px]">
          <button onClick={() => navigate(backPath)} className="inline-flex items-center gap-2 text-sm font-bold text-[#765F55] transition hover:text-[#C97112]">
            ← Back to {isCourseQuiz ? "course" : "lesson"}
          </button>
        </div>
      </div>
      <main className="flex-1 bg-[#FFF9EA] px-4 pb-8 pt-2 sm:px-6 sm:pb-10 sm:pt-2 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl lg:max-w-[1200px]">
        {pageState ? (
          <QuizStateCard kind={pageState} onRestart={retryQuiz} backPath={backPath} />
        ) : !quiz ? (
          <div className="rounded-[1.75rem] border border-dashed border-[#D9CEBE] bg-white p-10 text-center shadow-[0_18px_45px_-32px_rgba(80,48,19,0.35)]">
            <h1 className="text-2xl font-bold text-[#2D2E30]">No quiz yet</h1>
            <p className="mt-2 text-[#765F55]">{noQuizMessage}</p>
            <Link to={backPath} className="mt-5 inline-block rounded-xl bg-[#F8C56A] px-5 py-2.5 font-bold text-[#2D2E30] transition hover:bg-[#E58C1A]">
              Return to {isCourseQuiz ? "course" : "lessons"}
            </Link>
          </div>
        ) : quiz.locked ? (
          <div className="rounded-[1.75rem] border border-[#E58C1A]/25 bg-white p-8 text-center shadow-[0_18px_45px_-32px_rgba(80,48,19,0.35)] sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">Course final</p>
            <h1 className="mt-3 text-2xl font-bold text-[#2D2E30]">Final quiz locked</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#765F55]">Finish all published lesson quizzes to unlock this final.</p>
            <p className="mt-4 font-bold text-[#9A5816]">{quiz.completedLessonQuizCount} of {quiz.requiredLessonQuizCount} lesson quizzes completed</p>
            <button onClick={() => navigate(backPath)} className="mt-7 rounded-xl bg-[#F8C56A] px-5 py-3 font-bold text-[#2D2E30] transition hover:bg-[#E58C1A]">Back to course</button>
          </div>
        ) : (
          <>
            {quiz.lessonContext?.title ? <div className="-mx-4 mb-4 border-y border-[#E58C1A]/15 bg-[#FFF9EA]/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 md:-mx-10 md:px-10"><p className="mx-auto max-w-7xl text-sm font-bold text-[#2D2E30] lg:max-w-[1200px]">{`Lesson Quiz — ${quiz.lessonContext.title}`}</p></div> : null}
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

            <div className="grid items-start gap-6 lg:grid-cols-1 lg:gap-4">
              <aside>
                <div className={`overflow-hidden rounded-[1.75rem] border border-[#2D2E30]/10 bg-white shadow-[0_22px_55px_-40px_rgba(80,48,19,0.45)] ${isTakingQuiz ? 'lg:rounded-2xl' : 'lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none'}`}>
              <div className={`flex flex-col gap-3 bg-white p-5 text-[#2D2E30] sm:flex-row sm:items-center sm:justify-between sm:p-6 ${isTakingQuiz ? 'lg:p-5' : 'lg:rounded-2xl lg:border lg:border-[#2D2E30]/10 lg:p-7'}`}>
                <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C97112]">{quiz.courseContext?.title || (isCourseQuiz ? "Course Quiz" : "Lesson Quiz")}</p><h2 className={`mt-1 break-words text-xl font-bold tracking-tight sm:text-2xl ${isTakingQuiz ? 'lg:text-2xl' : 'lg:text-3xl'}`}>{quiz.title}</h2></div>
                <span className="w-fit rounded-full border border-[#E58C1A]/25 bg-[#FFF9EA] px-3 py-1.5 text-xs font-semibold text-[#765F55]">{quiz.maxAttempts ? `${attemptsRemaining} of ${quiz.maxAttempts} attempts left` : 'Unlimited attempts'}</span>
              </div>

              {history ? (
                <section className={`border-t border-[#2D2E30]/10 bg-white text-left ${isTakingQuiz ? '' : 'lg:mt-3 lg:min-w-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-[#2D2E30]/10 lg:shadow-[0_14px_28px_-24px_rgba(80,48,19,0.45)]'}`}>
                  <div className={`flex flex-wrap items-start justify-between gap-3 bg-white px-5 pb-2 pt-5 sm:px-6 sm:pt-6 ${isTakingQuiz ? 'lg:px-5 lg:pb-3 lg:pt-4' : 'lg:p-5'}`}>
                    <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C97112]">Quiz record</p><h3 className="mt-1 font-bold text-[#2D2E30]">Your progress</h3><p className="mt-1 text-xs text-[#765F55]">Your previous attempts at a glance.</p></div>
                    {bestAttempt ? (
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#765F55]">Best score</p>
                        <p className="text-lg font-bold text-[#C97112]">{Math.round((bestAttempt.score / bestAttempt.total) * 100)}%</p>
                      </div>
                    ) : (
                      <p className="rounded-xl border border-[#E58C1A]/20 bg-white px-3 py-2 text-xs font-semibold text-[#765F55]">No attempts yet</p>
                    )}
                  </div>

                  {history.attempts.length > 0 ? (
                    <div>
                      <div className="px-5 pb-5 pt-3 sm:px-6 sm:pb-6 lg:px-5 lg:pb-4 lg:pt-0">
                      <button
                        type="button"
                        onClick={() => setIsAttemptHistoryOpen((current) => !current)}
                        aria-expanded={isAttemptHistoryOpen}
                        aria-controls="quiz-attempt-history"
                        className="inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#E58C1A]/25 bg-[#FFF9EA] px-4 py-2.5 text-sm font-bold text-[#765F55] transition hover:border-[#E58C1A]/50 hover:bg-[#FFF1CE] hover:text-[#9A5816] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] lg:w-auto"
                      >
                        <span className="inline-flex items-center gap-2">{isAttemptHistoryOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <History className="h-4 w-4" aria-hidden="true" />}{isAttemptHistoryOpen ? "Close" : "View previous attempts"}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isAttemptHistoryOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                      </div>
                      <div id="quiz-attempt-history" hidden={!isAttemptHistoryOpen} className="space-y-2 border-t border-[#2D2E30]/10 p-4 sm:p-5">
                      {history.attempts.map((attempt) => (
                        <button key={attempt._id || attempt.attemptNumber} type="button" onClick={() => reviewHistoricalAttempt(attempt)} className="flex w-full items-center justify-between rounded-xl bg-[#FFF9EA] px-3 py-2.5 text-left text-sm text-[#2D2E30] transition hover:bg-[#FFF1CE] focus:outline-none focus:ring-2 focus:ring-[#E58C1A]" aria-label={`Review attempt ${attempt.attemptNumber}`}>
                          <span className="flex items-center gap-2 font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs text-[#C97112]">{attempt.attemptNumber}</span>Attempt {attempt.attemptNumber}</span>
                          <span className="font-bold text-[#B96128]">{attempt.score} / {attempt.total} <span className="text-xs">· {Math.round((attempt.score / attempt.total) * 100)}%</span></span>
                        </button>
                      ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

                </div>
              </aside>

              <section ref={selectedHistoricalAttempt ? historicalResultRef : null} className={`scroll-mt-24 rounded-[1.75rem] border border-[#2D2E30]/10 bg-white p-5 shadow-[0_22px_55px_-40px_rgba(80,48,19,0.45)] sm:p-8 md:p-10 lg:rounded-2xl ${isTakingQuiz ? 'lg:p-6' : 'lg:p-8'}`}>

              {selectedHistoricalAttempt ? (
                <div className="py-8 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">Previous result</p>
                  <h2 className="mt-2 text-2xl font-bold text-[#2D2E30]">Attempt {selectedHistoricalAttempt.attemptNumber}</h2>
                  <ResultSummary score={selectedHistoricalAttempt.score} total={selectedHistoricalAttempt.total} canRetake={canRetake} />
                  {hasCompleteHistoricalReview(selectedHistoricalAttempt) ? <FinalAnswerReview questions={selectedHistoricalAttempt.snapshot.questions} review={selectedHistoricalAttempt.review} allowCorrectAnswers={!isCourseQuiz} historical onEnlargeImage={(origin, item, index) => { lightboxOrigin.current = origin; setLightboxImage({ src: item.image, alt: item.imageDecorative ? "" : item.imageAlt || `Question ${index + 1}` }); }} /> : <p className="mt-6 text-sm text-[#765F55]">Detailed review is unavailable for this older attempt.</p>}
                  <button type="button" onClick={() => setSelectedAttemptId(null)} className="mt-8 rounded-xl bg-[#F8C56A] px-5 py-3 font-bold text-[#2D2E30] hover:bg-[#E58C1A]">Back to current quiz</button>
                </div>
              ) : result ? (
                <div className="py-8 text-center">
                  <ResultSummary score={result.score} total={result.total} canRetake={canRetake} />

                  {Array.isArray(result.review) ? (
                    <FinalAnswerReview
                      questions={quiz.questions}
                      review={result.review}
                      allowCorrectAnswers={!isCourseQuiz}
                    />
                  ) : quiz.maxAttempts ? (
                    <p className="mt-6 text-sm text-gray-600">
                      Your detailed review is unavailable for this attempt.
                    </p>
                  ) : null}

                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    {!isCourseQuiz ? <button onClick={() => navigate(lessonBackPath)} className="rounded-xl border border-[#2D2E30]/15 bg-white px-6 py-3 font-bold text-[#765F55] transition hover:bg-[#FFF9EA] hover:text-[#C97112]">Back to Lesson</button> : null}
                    {quiz.maxAttempts && quiz.attemptsUsed >= quiz.maxAttempts ? (
                      <p className="self-center font-semibold text-gray-600">You have used all available attempts for this quiz.</p>
                    ) : (
                      <button
                        onClick={retryQuiz}
                        className="rounded-xl bg-[#F8C56A] px-6 py-3 font-bold text-[#2D2E30] transition hover:bg-[#E58C1A]"
                      >
                        Try again
                      </button>
                    )}
                  </div>
                  {isCourseQuiz ? <ExtraSubmissionRequests
                    quiz={quiz}
                    requests={requestHistory}
                    pendingRequest={pendingRequest}
                    formOpen={isRequestFormOpen}
                    setFormOpen={setIsRequestFormOpen}
                    reason={requestReason}
                    setReason={setRequestReason}
                    busy={requestBusy}
                    onCreate={async () => {
                      try { setRequestBusy(true); setError(""); const data = await createQuizAttemptRequest(quiz._id, requestReason); setRequestHistory((current) => [data.request, ...current]); setRequestReason(""); setIsRequestFormOpen(false); }
                      catch (err) { setError(err.message); } finally { setRequestBusy(false); }
                    }}
                    onCancel={async () => {
                      if (!pendingRequest) return;
                      try { setRequestBusy(true); setError(""); const data = await cancelQuizAttemptRequest(quiz._id, pendingRequest._id); setRequestHistory((current) => current.map((request) => String(request._id) === String(data.request._id) ? data.request : request)); }
                      catch (err) { setError(err.message); } finally { setRequestBusy(false); }
                    }}
                  /> : null}
                </div>
              ) : isQuizLocked ? (
                <div className="py-10 text-center">
                  <div className="mx-auto max-w-2xl rounded-2xl border border-[#E58C1A]/25 bg-[#FFF9EA] p-6 text-left sm:p-8">
                    <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">Final attempt</p>
                    <h2 className="mt-2 text-center text-2xl font-bold text-[#2D2E30]">Your last answers</h2>
                    <p className="mt-3 text-center text-sm text-[#765F55]">You have used all available attempts. Here is what you selected on your final attempt.</p>
                    {hasCompleteHistoricalReview(lastAttempt) ? (
                      <FinalAnswerReview questions={lastAttempt.snapshot.questions} review={lastAttempt.review} allowCorrectAnswers={!isCourseQuiz} historical onEnlargeImage={(origin, item, index) => { lightboxOrigin.current = origin; setLightboxImage({ src: item.image, alt: item.imageDecorative ? "" : item.imageAlt || `Question ${index + 1}` }); }} />
                    ) : (
                      <p className="mt-6 rounded-xl bg-white p-4 text-center text-sm text-[#765F55]">Your final answers are not available for attempts submitted before answer review was added.</p>
                    )}
                    <button
                      onClick={() => navigate(backPath)}
                      className="mx-auto mt-7 block rounded-xl bg-[#F8C56A] px-5 py-3 font-bold text-[#2D2E30] transition hover:bg-[#E58C1A]"
                    >
                      Back to course
                    </button>
                    {isCourseQuiz ? <ExtraSubmissionRequests
                      quiz={quiz}
                      requests={requestHistory}
                      pendingRequest={pendingRequest}
                      formOpen={isRequestFormOpen}
                      setFormOpen={setIsRequestFormOpen}
                      reason={requestReason}
                      setReason={setRequestReason}
                      busy={requestBusy}
                      onCreate={async () => {
                        try { setRequestBusy(true); setError(""); const data = await createQuizAttemptRequest(quiz._id, requestReason); setRequestHistory((current) => [data.request, ...current]); setRequestReason(""); setIsRequestFormOpen(false); }
                        catch (err) { setError(err.message); } finally { setRequestBusy(false); }
                      }}
                      onCancel={async () => {
                        if (!pendingRequest) return;
                        try { setRequestBusy(true); setError(""); const data = await cancelQuizAttemptRequest(quiz._id, pendingRequest._id); setRequestHistory((current) => current.map((request) => String(request._id) === String(data.request._id) ? data.request : request)); }
                        catch (err) { setError(err.message); } finally { setRequestBusy(false); }
                      }}
                    /> : null}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 lg:gap-y-3">
                    <p className="text-sm font-bold text-[#C97112]">
                      Question {questionIndex + 1} of {quiz.questions.length}
                    </p>
                    <p className="text-xs font-semibold text-[#C97112]">{answers.filter((answer) => answer !== null).length} of {quiz.questions.length} answered</p>
                    <div className="order-last h-2 w-full flex-none overflow-hidden rounded-full bg-[#F0E7DC]">
                      <div
                        className="h-full rounded-full bg-[#E58C1A] transition-all"
                        style={{ width: `${((questionIndex + 1) / quiz.questions.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#765F55]">Questions</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {quiz.questions.map((_, index) => {
                        const isActive = index === questionIndex;
                        const isAnswered = answers[index] !== null;
                        return <button key={index} type="button" onClick={() => setQuestionIndex(index)} className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition lg:min-h-12 lg:min-w-12 ${isActive ? 'bg-[#2D2E30] text-white shadow-sm' : isAnswered ? 'bg-[#FFF1CE] text-[#9A5816] hover:bg-[#F8C56A]' : 'bg-[#FFF9EA] text-[#765F55] hover:bg-[#FFF4D8] hover:text-[#C97112]'}`}>{index + 1}</button>
                      })}
                    </div>
                  </div>
                  </div>

                  <section className="mt-5 border-t border-[#2D2E30]/10 px-1 pb-7 pt-6 sm:px-2 lg:pb-6">
                    <h3 className="text-center text-xl font-bold leading-relaxed text-[#2D2E30] sm:text-2xl lg:break-words">
                      {question.prompt || "What is this?"}
                    </h3>
                    {question.image ? <div className="mx-auto mt-7 max-w-xl rounded-[1.5rem] bg-[#FFF9EA] p-2 shadow-inner sm:p-3 lg:max-w-lg">
                      <button type="button" onClick={(event) => { lightboxOrigin.current = event.currentTarget; setLightboxImage({ src: question.image, alt: question.imageDecorative ? "" : question.imageAlt || `Quiz question ${questionIndex + 1}` }); }} className="group relative block w-full cursor-zoom-in rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/30" aria-label="View question image larger"><img key={`image-${mediaRetry[questionIndex] || 0}`}
                        src={question.image}
                        alt={question.imageDecorative ? "" : question.imageAlt || `Quiz question ${questionIndex + 1}`}
                        onLoad={() => setFailedMedia((current) => ({ ...current, [questionIndex]: { ...current[questionIndex], image: "ready" } }))}
                        onError={() => setFailedMedia((current) => ({ ...current, [questionIndex]: { ...current[questionIndex], image: "failed" } }))}
                        className="mx-auto aspect-video w-full rounded-2xl object-contain shadow-md sm:h-80 lg:max-h-64"
                      /><span aria-hidden="true" className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-[#2D2E30]/85 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition group-hover:bg-[#2D2E30] sm:bottom-3 sm:right-3"><Maximize2 size={14} />View larger</span></button>
                    </div> : null}
                    <QuestionAudio key={`${question._id || questionIndex}-audio-${mediaRetry[questionIndex] || 0}`} src={question.audio} label={question.audioLabel} onReady={() => setFailedMedia((current) => ({ ...current, [questionIndex]: { ...current[questionIndex], audio: "ready" } }))} onFailure={() => setFailedMedia((current) => ({ ...current, [questionIndex]: { ...current[questionIndex], audio: "failed" } }))} />
                    {Object.values(failedMedia[questionIndex] || {}).includes("failed") ? <div role="status" className="mx-auto mt-3 max-w-xl rounded-2xl border border-[#E58C1A]/20 bg-[#FFF9EA] px-4 py-3 text-sm text-[#765F55]"><p className="font-bold text-[#2D2E30]">{failedMedia[questionIndex]?.audio === "failed" ? "We couldn't load the audio" : "We couldn't load the image"}</p><p className="mt-1">Try loading it again before continuing.</p><button type="button" onClick={() => { setError(""); setFailedMedia((current) => ({ ...current, [questionIndex]: {} })); setMediaRetry((current) => ({ ...current, [questionIndex]: (current[questionIndex] || 0) + 1 })); }} className="mt-2 min-h-10 rounded-lg bg-[#FFF1CE] px-3 py-2 font-bold text-[#9A5816] hover:bg-[#F8C56A]">Try again</button></div> : null}

                    <p className="mt-9 text-center text-xs font-bold uppercase tracking-[0.18em] text-[#765F55] lg:mt-7">
                      Choose the best answer
                    </p>

                    <div className="mx-auto mt-4 grid max-w-lg gap-4 sm:grid-cols-2">
                      {question.options.map((option, optionIndex) => (
                        <button
                          key={optionIndex}
                          onClick={() => chooseAnswer(optionIndex)}
                          className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-4 text-left font-semibold shadow-sm transition lg:text-sm lg:leading-relaxed ${
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

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-8 lg:mt-5 lg:border-[#2D2E30]/10 lg:pt-6">
                    <button
                      onClick={() => setQuestionIndex((current) => current - 1)}
                      disabled={questionIndex === 0}
                      className="rounded-xl px-4 py-2.5 font-bold text-[#765F55] transition hover:bg-[#FFF4D8] hover:text-[#C97112] disabled:cursor-not-allowed disabled:opacity-40 lg:min-h-11 lg:text-sm"
                    >
                      Back
                    </button>

                    {questionIndex === quiz.questions.length - 1 ? (
                      <button
                        onClick={handleFinishQuiz}
                        disabled={submitting || sessionState !== "ready"}
                        className="rounded-xl bg-[#F8C56A] px-6 py-3 font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] hover:shadow-md lg:min-h-11 lg:text-sm"
                      >
                        {submitting ? "Submitting…" : "Finish quiz"}
                      </button>
                    ) : (
                      <button
                        onClick={() => setQuestionIndex((current) => current + 1)}
                        className="rounded-xl bg-[#F8C56A] px-6 py-3 font-bold text-[#2D2E30] shadow-sm transition hover:bg-[#E58C1A] hover:shadow-md lg:min-h-11 lg:text-sm"
                      >
                        Next question
                      </button>
                    )}
                  </div>
                  {isCourseQuiz ? <ExtraSubmissionRequests
                    quiz={quiz}
                    requests={requestHistory}
                    pendingRequest={pendingRequest}
                    formOpen={isRequestFormOpen}
                    setFormOpen={setIsRequestFormOpen}
                    reason={requestReason}
                    setReason={setRequestReason}
                    busy={requestBusy}
                    onCreate={async () => {
                      try { setRequestBusy(true); setError(""); const data = await createQuizAttemptRequest(quiz._id, requestReason); setRequestHistory((current) => [data.request, ...current]); setRequestReason(""); setIsRequestFormOpen(false); }
                      catch (err) { setError(err.message); } finally { setRequestBusy(false); }
                    }}
                    onCancel={async () => {
                      if (!pendingRequest) return;
                      try { setRequestBusy(true); setError(""); const data = await cancelQuizAttemptRequest(quiz._id, pendingRequest._id); setRequestHistory((current) => current.map((request) => String(request._id) === String(data.request._id) ? data.request : request)); }
                      catch (err) { setError(err.message); } finally { setRequestBusy(false); }
                    }}
                  /> : null}
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
      {pendingNavigation ? <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2D2E30]/55 p-4" role="presentation"><section ref={leaveDialog} role="dialog" aria-modal="true" aria-labelledby="leave-quiz-title" aria-describedby="leave-quiz-description" className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#E58C1A]/20 bg-white shadow-2xl"><h2 id="leave-quiz-title" className="bg-[#FFF9EA] p-6 text-xl font-bold text-[#2D2E30]">Leave this quiz?</h2><p id="leave-quiz-description" className="p-6 text-sm leading-6 text-[#765F55]">Your answers haven&apos;t been submitted yet. If you leave now, you&apos;ll need to answer them again.</p><div className="flex flex-wrap justify-end gap-3 border-t border-[#2D2E30]/10 p-5"><button type="button" onClick={() => setPendingNavigation(null)} className="rounded-xl border border-[#2D2E30]/15 px-5 py-3 font-bold text-[#765F55]">Stay in quiz</button><button type="button" onClick={() => { clearSavedQuizDraft(draftKey); permitNavigation.current = true; pendingNavigation(); }} className="rounded-xl bg-[#2D2E30] px-5 py-3 font-bold text-white">Leave quiz</button></div></section></div> : null}
      {lightboxImage ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#252527]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Enlarged question image" onClick={closeLightbox}><section className="relative w-full max-w-2xl rounded-2xl bg-[#FFFDF8] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}><button type="button" data-quiz-lightbox-close className="absolute right-3 top-3 rounded-lg bg-white p-2 text-[#765F55] shadow-sm hover:bg-[#FFF4D8]" aria-label="Close" onClick={closeLightbox}><X size={20} /></button><p className="mb-3 text-sm font-bold text-[#2D2E30]">Question image</p><img src={lightboxImage.src} alt={lightboxImage.alt} className="max-h-[75dvh] w-full rounded-xl object-contain" /></section></div> : null}
      <Footer />
    </div>
  );
}

export default Quiz;
