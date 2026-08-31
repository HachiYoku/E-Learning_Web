import { ArrowLeft, Users, TrendingUp, Award, Search, ArrowUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchQuizAttempts } from "../../services/quizService";

function QuizAttempts() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");

  useEffect(() => {
    fetchQuizAttempts(id)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 p-6 sm:p-8">
        <button
          onClick={() => navigate("/quizzes")}
          className="mb-6 inline-flex items-center gap-2 text-red-700 transition hover:text-red-900"
        >
          <ArrowLeft size={18} />
          Back to quizzes
        </button>
        <div className="rounded-2xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          <p className="font-semibold">Error loading quiz attempts</p>
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block rounded-full bg-slate-200 p-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-700"></div>
          </div>
          <p className="mt-4 text-slate-600">Loading quiz scores...</p>
        </div>
      </div>
    );
  }

  const totalSubmissions = data.attempts.length;
  const avgScore =
    totalSubmissions > 0
      ? Math.round(
          (data.attempts.reduce((sum, a) => sum + (a.score / a.total) * 100, 0) /
            totalSubmissions) *
            100
        ) / 100
      : 0;

  // Filter attempts based on search query
  const filteredAttempts = data.attempts.filter((attempt) => {
    const query = searchQuery.toLowerCase();
    const name = attempt.user?.name || "Deleted user";
    const email = attempt.user?.email || "";
    return name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
  });

  // Sort attempts
  const sortedAttempts = [...filteredAttempts].sort((a, b) => {
    const scoreA = (a.score / a.total) * 100;
    const scoreB = (b.score / b.total) * 100;
    const nameA = (a.user?.name || "Deleted user").toLowerCase();
    const nameB = (b.user?.name || "Deleted user").toLowerCase();
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();

    switch (sortBy) {
      case "score-high":
        return scoreB - scoreA;
      case "score-low":
        return scoreA - scoreB;
      case "name-asc":
        return nameA.localeCompare(nameB);
      case "name-desc":
        return nameB.localeCompare(nameA);
      case "date-desc":
        return dateB - dateA;
      case "date-asc":
        return dateA - dateB;
      default:
        return 0;
    }
  });

  // Add attempt numbering for each student
  const attemptsWithNumber = sortedAttempts.map((attempt) => {
    const userAttempts = sortedAttempts.filter(
      (a) => a.user?.email === attempt.user?.email || (a.user?.name === attempt.user?.name && a.user?.name !== "Deleted user")
    );
    const attemptNumber = userAttempts.findIndex((a) => a._id === attempt._id) + 1;
    return { ...attempt, attemptNumber, totalUserAttempts: userAttempts.length };
  });

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return { text: "text-emerald-700", bg: "bg-emerald-50", bar: "bg-emerald-500" };
    if (percentage >= 60) return { text: "text-blue-700", bg: "bg-blue-50", bar: "bg-blue-500" };
    if (percentage >= 40) return { text: "text-amber-700", bg: "bg-amber-50", bar: "bg-amber-500" };
    return { text: "text-red-700", bg: "bg-red-50", bar: "bg-red-500" };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6 md:p-8">
      {/* Header */}
      <button
        onClick={() => navigate("/quizzes")}
        className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-200"
      >
        <ArrowLeft size={18} />
        <span className="font-medium">Back to quizzes</span>
      </button>

      {/* Quiz Info Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">{data.quiz.title}</h1>
            <p className="mt-2 text-sm text-slate-600">
              Attempt limit: <span className="font-semibold text-slate-900">{data.quiz.maxAttempts || "Unlimited"}</span>
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Users size={16} />
                SUBMISSIONS
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{totalSubmissions}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <TrendingUp size={16} />
                AVERAGE
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{avgScore}%</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Award size={16} />
                QUESTIONS
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.quiz.questions?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Attempts Table */}
      <div className="mt-8">
        {totalSubmissions === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center">
            <div className="inline-block rounded-full bg-slate-200 p-3">
              <Users size={28} className="text-slate-400" />
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-700">No submissions yet</p>
            <p className="mt-2 text-sm text-slate-600">Students will appear here after completing the quiz.</p>
          </div>
        ) : (
          <>
            {/* Search and Filter Controls */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5">
                <ArrowUpDown size={16} className="text-slate-500" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border-none bg-transparent text-sm text-slate-700 outline-none"
                >
                  <option value="date-desc">Latest first</option>
                  <option value="date-asc">Oldest first</option>
                  <option value="score-high">Highest score</option>
                  <option value="score-low">Lowest score</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                </select>
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Results Info */}
            <div className="mb-4 text-sm text-slate-600">
              Showing {sortedAttempts.length} of {totalSubmissions} submission{totalSubmissions !== 1 ? "s" : ""}
              {searchQuery && ` for "${searchQuery}"`}
            </div>

            {sortedAttempts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="font-medium text-slate-700">No results found</p>
                <p className="mt-1 text-sm text-slate-600">Try adjusting your search terms</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
                          Student
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
                          Email
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
                          Attempt
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
                          Score
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
                          Percentage
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700">
                          Submitted
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {attemptsWithNumber.map((attempt, index) => {
                        const percentage = Math.round((attempt.score / attempt.total) * 100);
                        const colors = getScoreColor(percentage);

                        return (
                          <tr
                            key={attempt._id}
                            className={`border-b border-slate-200 transition ${
                              index % 2 === 0 ? "bg-white" : "bg-slate-50"
                            } hover:bg-pink-50`}
                          >
                            <td className="px-6 py-4">
                              <p className="font-semibold text-slate-900">
                                {attempt.user?.name || "Deleted user"}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-slate-600">
                                {attempt.user?.email || "—"}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                                #{attempt.attemptNumber}
                                {attempt.totalUserAttempts > 1 && <span className="text-blue-600">/{attempt.totalUserAttempts}</span>}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold ${colors.bg} ${colors.text}`}>
                                {attempt.score} / {attempt.total}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-24 rounded-full bg-slate-200 h-2 overflow-hidden">
                                  <div
                                    className={`h-full transition ${colors.bar}`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className={`font-bold text-sm ${colors.text}`}>
                                  {percentage}%
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-slate-600">
                                {new Date(attempt.createdAt).toLocaleString()}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default QuizAttempts;
