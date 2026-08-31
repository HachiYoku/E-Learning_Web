import { BarChart3, Edit2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteQuiz, fetchQuizzes } from "../../services/quizService";
import ConfirmationModal from "../../components/ConfirmationModal";

function Quizzes() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [quizToDelete, setQuizToDelete] = useState(null);

  useEffect(() => {
    fetchQuizzes().then(setQuizzes).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const confirmDelete = async () => {
    try {
      await deleteQuiz(quizToDelete.id);
      setQuizzes((current) => current.filter((quiz) => quiz.id !== quizToDelete.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setQuizToDelete(null);
    }
  };

  return <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-3xl font-bold text-gray-900">Quiz Management</h1><p className="mt-1 text-gray-600">Create vocabulary picture quizzes for individual lessons.</p></div>
      <button onClick={() => navigate("/quizzes/new")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-300 px-5 py-3 font-medium text-gray-900 hover:bg-pink-400"><Plus size={19} /> Create quiz</button>
    </div>
    {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}
    {loading ? <p className="text-gray-600">Loading quizzes...</p> : quizzes.length === 0 ? <div className="rounded-xl bg-white p-10 text-center shadow"><p className="text-gray-600">No quizzes yet. Create your first quiz.</p></div> : <div className="grid gap-4 lg:grid-cols-2">
      {quizzes.map((quiz) => <article key={quiz.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-xl font-bold text-gray-900">{quiz.title}</h2><span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${quiz.quizType === "course" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{quiz.quizType === "course" ? "Course" : "Lesson"}</span></div><p className="mt-2 text-sm text-gray-600">{quiz.course?.title || "Course"}{quiz.quizType === "lesson" && quiz.lesson && ` · Lesson ${quiz.lesson?.order || ""}: ${quiz.lesson?.title || "Lesson"}`}</p><p className="mt-2 text-sm font-medium text-pink-600">{quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"}</p></div>
          <div className="flex gap-2"><button onClick={() => navigate(`/quizzes/${quiz.id}/attempts`)} className="rounded-lg bg-blue-50 p-2.5 text-blue-700 hover:bg-blue-100" title="View student scores"><BarChart3 size={18} /></button><button onClick={() => navigate(`/quizzes/${quiz.id}/edit`)} className="rounded-lg bg-gray-100 p-2.5 text-gray-700 hover:bg-gray-200" title="Edit quiz"><Edit2 size={18} /></button><button onClick={() => setQuizToDelete(quiz)} className="rounded-lg bg-red-50 p-2.5 text-red-700 hover:bg-red-100" title="Delete quiz"><Trash2 size={18} /></button></div>
        </div>
      </article>)}
    </div>}
    <ConfirmationModal isOpen={Boolean(quizToDelete)} title="Delete Quiz" message={`Delete “${quizToDelete?.title || ""}” and all its questions? This cannot be undone.`} confirmText="Delete" cancelText="Cancel" onConfirm={confirmDelete} onCancel={() => setQuizToDelete(null)} isDangerous />
  </div>;
}

export default Quizzes;
