import { useParams, useNavigate } from "react-router-dom";
import { Fragment, useEffect, useState } from "react";
import { ArrowLeft, CreditCard, LockKeyhole, Star, TvMinimalPlay } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import LoadingSpinner from "../components/LoadingSpinner";
import { fetchCourseById } from "../services/courseService";
import { useAuth } from "../contexts/AuthContext";

function Enroll() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCourse() {
      try { setLoading(true); setError(""); setCourse(await fetchCourseById(courseId)); }
      catch (loadError) { setError(loadError.message); }
      finally { setLoading(false); }
    }
    loadCourse();
  }, [courseId]);

  const handleEnrollClick = () => navigate(isAuthenticated ? `/payment/${course.id}` : "/login");

  if (loading) return <div className="min-h-screen bg-[#FFFDF8]"><Navbar /><div className="flex h-screen items-center justify-center bg-[#FFF9EA]"><LoadingSpinner message="Loading course..." /></div></div>;
  if (!course) return <div className="min-h-screen bg-[#FFFDF8]"><Navbar /><div className="flex h-screen items-center justify-center bg-[#FFF9EA] px-4 text-center"><p className="text-lg text-[#765F55] sm:text-2xl">{error || "Course not found"}</p></div></div>;

  return <Fragment><div className="flex min-h-screen flex-col bg-[#FFFDF8]"><Navbar />
    <main className="flex-1 bg-[#FFF9EA] px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => navigate("/courses")} className="inline-flex items-center gap-2 text-sm font-bold text-[#765F55] transition hover:text-[#C97112]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to courses</button>
        <header className="mb-7 mt-7 max-w-xl sm:mb-8 sm:mt-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">One step away</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">Complete your <span className="text-[#B96128]">enrollment</span></h1><p className="mt-3 text-sm leading-6 text-[#765F55] sm:text-base">Review your course before continuing to payment.</p></header>

        <section className="overflow-hidden rounded-[1.5rem] border border-[#2D2E30]/10 bg-white shadow-[0_18px_42px_-36px_rgba(80,48,19,.45)]">
          <div className="p-4 sm:p-6"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#C97112]">Course being enrolled in</p>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6"><div className="h-36 w-full shrink-0 overflow-hidden rounded-2xl bg-[#E7DCCE] sm:h-36 sm:w-52"><img src={course.image} alt={course.title} className="h-full w-full object-cover" /></div><div className="min-w-0"><h2 className="text-xl font-bold tracking-tight text-[#2D2E30] sm:text-2xl">{course.title}</h2><div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-[#765F55]"><span className="inline-flex items-center gap-2"><TvMinimalPlay className="h-4 w-4 text-[#C97112]" aria-hidden="true" />{course.lessons} lessons</span><span className="inline-flex items-center gap-2"><Star className="h-4 w-4 fill-[#F4B63F] text-[#F4B63F]" aria-hidden="true" />{course.rating.toFixed(1)}/5</span></div><p className="mt-4 text-sm leading-6 text-[#765F55]">You’ll get full access once your payment is approved.</p></div></div>
          </div>
          <div className="border-t border-[#2D2E30]/10 bg-[#FFFDF8] p-4 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6"><div className="flex gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF1CE] text-[#9A5816]"><CreditCard className="h-4 w-4" aria-hidden="true" /></span><div><h3 className="text-sm font-bold text-[#2D2E30]">Enrollment summary</h3><p className="mt-1 max-w-lg text-sm leading-5 text-[#765F55]">Choose a payment method on the next step to see your exact payment currency and amount.</p></div></div><LockKeyhole className="mt-4 hidden h-4 w-4 shrink-0 text-[#C97112] sm:block" aria-hidden="true" /></div>
        </section>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end"><button onClick={() => navigate(`/courses/${courseId}`)} className="order-2 px-4 py-3 text-sm font-bold text-[#765F55] transition hover:text-[#C97112] sm:order-1">Cancel</button><button onClick={handleEnrollClick} className="order-1 inline-flex w-full items-center justify-center rounded-xl bg-[#2D2E30] px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_24px_-18px_rgba(45,46,48,.7)] transition hover:bg-[#C97112] sm:order-2 sm:w-auto">Continue to payment <span aria-hidden="true" className="ml-2">→</span></button></div>
      </div>
    </main><Footer /></div></Fragment>;
}

export default Enroll;
