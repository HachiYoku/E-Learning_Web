import { useParams, useNavigate } from "react-router-dom";
import { Fragment, useEffect, useState } from "react";
import { ArrowLeft, Check, CreditCard, LockKeyhole, Star, TvMinimalPlay } from "lucide-react";
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
      try {
        setLoading(true);
        setError("");
        setCourse(await fetchCourseById(courseId));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }
    loadCourse();
  }, [courseId]);

  const handleEnrollClick = () => {
    if (!isAuthenticated) {
      navigate("/login");
    } else {
      navigate(`/payment/${course.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex h-screen items-center justify-center bg-[#FFF9EA]">
          <LoadingSpinner message="Loading course..." />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex h-screen items-center justify-center bg-[#FFF9EA]">
          <p className="text-lg sm:text-2xl text-[#765F55]">
            {error || "Course not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Fragment>
      <div className="min-h-screen bg-[#FFFDF8]">
        <Navbar />

        {/* Back to Courses */}
        <div className="bg-[#FFF9EA] px-4 pt-6 sm:px-6 sm:pt-8 md:px-10">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={() => navigate("/courses")}
              className="inline-flex items-center gap-2 text-sm font-bold text-[#765F55] transition hover:text-[#C97112]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to courses
            </button>
          </div>
        </div>

        <div className="bg-[#FFF9EA] px-4 pb-14 pt-8 sm:px-6 sm:pb-16 md:px-10 md:pb-20">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mx-auto mb-8 max-w-4xl text-center sm:mb-10 md:mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">One step away</p>
              <h1 className="mt-3 whitespace-nowrap text-[clamp(1.5rem,7vw,3rem)] font-bold leading-[1.05] tracking-tight text-[#2D2E30]">
                Complete your <span className="font-serif font-normal italic text-[#B96128]">enrollment.</span>
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-[#765F55] sm:text-base">Review your course, then continue to payment.</p>
            </div>

            {/*
              Grid strategy:
              - <768px  → 1 col stacked
              - 768px   → 2 equal cols (course + summary side by side, balanced)
              - 1024px+ → 3 cols, course gets 2, summary gets 1
            */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
              {/* Course Details */}
              <div className="md:col-span-1 lg:col-span-2">
                <div className="rounded-[1.75rem] border border-[#2D2E30]/10 bg-white p-4 shadow-[0_22px_55px_-40px_rgba(80,48,19,0.45)] sm:p-6 md:p-8">
                  <div className="mb-5 sm:mb-6">
                    <img
                      src={course.image}
                      alt={course.title}
                      className="h-52 w-full rounded-[1.3rem] object-cover sm:h-64 md:h-80 lg:h-96"
                    />
                  </div>

                  <div className="mb-2">
                    <span className="inline-block rounded-full border border-[#E58C1A]/20 bg-[#FFF4D8] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#C97112]">Your selected course</span>
                  </div>

                  <div className="mb-4">
                    <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl">
                      {course.title}
                    </h2>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
                      <div className="flex items-center gap-2">
                        <TvMinimalPlay
                        className="h-5 w-5 text-[#E58C1A]"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        <span className="text-[#2D2E30] font-semibold text-sm sm:text-base">
                          {course.lessons} lessons
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 fill-[#F4B63F] text-[#F4B63F]" aria-hidden="true" />
                        <span className="text-[#2D2E30] font-semibold text-sm sm:text-base">
                          ({course.rating.toFixed(1)}/5)
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-6 border-t border-[#2D2E30]/10 pt-4 text-sm leading-relaxed text-[#765F55]">You’ll get full access once your payment is approved.</p>
                </div>
              </div>

              {/* Order Summary */}
              <div className="md:col-span-1 lg:col-span-1">
                <div className="rounded-[1.75rem] bg-[#2D2E30] p-5 text-white shadow-[0_24px_55px_-34px_rgba(45,46,48,0.55)] sm:p-6 md:sticky md:top-20">
                  <div className="flex items-center justify-between border-b border-white/15 pb-4"><h3 className="text-xl font-bold">Order summary</h3><CreditCard className="h-5 w-5 text-[#F8C56A]" aria-hidden="true" /></div>
                  <div className="space-y-3 mb-4 sm:mb-5">
                    <div className="flex justify-between items-start gap-3">
                      <span className="text-white/65 font-semibold text-xs sm:text-sm shrink-0">
                        Course name:
                      </span>
                      <span className="text-white font-semibold text-xs sm:text-sm text-right">
                        {course.title}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-white/15">
                      <span className="text-white/65 font-semibold text-xs sm:text-sm">
                        Price:
                      </span>
                      <span className="text-white font-semibold text-xs sm:text-sm">
                        {course.price}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-sm font-bold text-white">
                        Total
                      </span>
                      <span className="text-xl font-bold text-[#F8C56A]">
                        {course.price}
                      </span>
                    </div>
                  </div>

                  {/* How to Enroll */}
                  <div className="mb-5 rounded-2xl border border-white/15 bg-white/5 p-4">
                    <h4 className="font-bold text-white mb-3 text-xs uppercase tracking-[0.16em]">
                      What happens next
                    </h4>
                    <ol className="space-y-3 text-xs leading-relaxed text-white/75">
                      <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-[#F8C56A]" aria-hidden="true" /><span>Make payment using the QR code.</span>
                      </li>
                      <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-[#F8C56A]" aria-hidden="true" /><span>Upload your payment receipt.</span>
                      </li>
                      <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-[#F8C56A]" aria-hidden="true" /><span>We’ll verify it and notify you when access is ready.</span>
                      </li>
                    </ol>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={() => navigate(`/courses/${courseId}`)}
                      className="flex-1 rounded-xl border border-white/25 py-3 text-xs font-bold text-white transition hover:bg-white/10 sm:text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEnrollClick}
                      className="flex-1 rounded-xl bg-[#F8C56A] py-3 text-xs font-bold text-[#2D2E30] transition-colors hover:bg-[#E58C1A] sm:text-sm"
                    >
                      Enroll Now
                    </button>
                  </div><p className="mt-4 flex items-center justify-center gap-2 text-[11px] text-white/55"><LockKeyhole className="h-3 w-3" aria-hidden="true" /> Secure enrollment</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </Fragment>
  );
}

export default Enroll;
