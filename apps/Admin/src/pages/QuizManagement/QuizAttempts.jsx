import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchQuizAttempts } from "../../services/quizService";

function QuizAttempts() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { fetchQuizAttempts(id).then(setData).catch((err) => setError(err.message)); }, [id]);
  if (error) return <div className="p-8 text-red-700">{error}</div>;
  if (!data) return <div className="p-8 text-gray-600">Loading quiz scores...</div>;

  return <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8"><button onClick={() => navigate("/quizzes")} className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-950"><ArrowLeft size={18} /> Back to quizzes</button><div className="mt-7 rounded-xl bg-white p-6 shadow-sm"><h1 className="text-3xl font-bold text-gray-900">{data.quiz.title}</h1><p className="mt-2 text-gray-600">Attempt limit: {data.quiz.maxAttempts || "Unlimited"}</p><div className="mt-7 overflow-x-auto"><table className="min-w-full text-left"><thead className="border-b text-sm text-gray-500"><tr><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">Email</th><th className="px-4 py-3 font-semibold">Score</th><th className="px-4 py-3 font-semibold">Percentage</th><th className="px-4 py-3 font-semibold">Submitted</th></tr></thead><tbody>{data.attempts.length === 0 ? <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No student has completed this quiz yet.</td></tr> : data.attempts.map((attempt) => <tr key={attempt._id} className="border-b border-gray-100"><td className="px-4 py-4 font-medium text-gray-900">{attempt.user?.name || "Deleted user"}</td><td className="px-4 py-4 text-gray-600">{attempt.user?.email || "—"}</td><td className="px-4 py-4 font-semibold text-pink-700">{attempt.score} / {attempt.total}</td><td className="px-4 py-4 text-gray-700">{Math.round((attempt.score / attempt.total) * 100)}%</td><td className="px-4 py-4 text-gray-600">{new Date(attempt.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div></div></div>;
}

export default QuizAttempts;
