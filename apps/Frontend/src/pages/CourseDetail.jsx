import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, PlayCircle, Star, TvMinimalPlay } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import CourseCard from "../components/CourseCard";
import LoadingSpinner from "../components/LoadingSpinner";
const Watermark = "/benefit/teacher&stduents.jpg";
import { fetchCourseById, fetchCourses } from "../services/courseService";
import { fetchMyEnrollments } from "../services/enrollmentService";
import { useAuth } from "../contexts/AuthContext";

const RELATED_COURSES_PER_PAGE = 4;

function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [course, setCourse] = useState(null);
  const [relatedCourses, setRelatedCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrolledCourseIds, setEnrolledCourseIds] = useState(() => new Set());
  const relatedCoursesRef = useRef(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    async function loadCourseData() {
      try {
        setLoading(true);
        setError("");

        const [courseResponse, coursesResponse] = await Promise.all([
          fetchCourseById(courseId),
          fetchCourses(),
        ]);

        setCourse(courseResponse);
        setCurrentPage(1);
        setRelatedCourses(
          coursesResponse.filter((item) => item.id !== courseResponse.id),
        );
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadCourseData();
  }, [courseId]);

  useEffect(() => {
    if (!isAuthenticated) {
      Promise.resolve().then(() => setEnrolledCourseIds(new Set()));
      return;
    }

    let isMounted = true;

    async function loadEnrollments() {
      try {
        const enrollments = await fetchMyEnrollments();
        if (isMounted) {
          setEnrolledCourseIds(
            new Set(
              enrollments
                .map((enrollment) => enrollment.course?.id)
                .filter(Boolean),
            ),
          );
        }
      } catch {
        if (isMounted) {
          setEnrolledCourseIds(new Set());
        }
      }
    }

    loadEnrollments();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const totalPages = Math.max(
    1,
    Math.ceil(relatedCourses.length / RELATED_COURSES_PER_PAGE),
  );
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * RELATED_COURSES_PER_PAGE;
  const currentRelatedCourses = relatedCourses.slice(
    startIndex,
    startIndex + RELATED_COURSES_PER_PAGE,
  );

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    relatedCoursesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  if (error || !course) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex h-screen items-center justify-center bg-[#FFF9EA] px-4 text-center">
          <p className="text-2xl text-[#765F55]">
            {error || "Course not found"}
          </p>
        </div>
      </div>
    );
  }

  const courseFeatures =
    (course.features ?? []).length > 0
      ? course.features
      : ["No specific features listed for this course."];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <section className="relative isolate overflow-hidden bg-[#FFF9EA] px-4 py-12 sm:px-6 sm:py-16 md:px-10 md:py-20">
        <div className="absolute -left-28 top-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/25 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-28 right-0 -z-10 h-96 w-96 rounded-full bg-[#E9A9A0]/25 blur-3xl" aria-hidden="true" />
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 max-w-2xl sm:mb-10"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Course library</p><p className="mt-3 text-sm leading-relaxed text-[#765F55] sm:text-base">A practical, self-paced path to more confident Thai conversations.</p></div>
          <div className="border border-[#2D2E30]/10 bg-white/90 p-4 shadow-[0_25px_65px_-42px_rgba(80,48,19,0.45)] sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10 lg:gap-12">
              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-start justify-center">
                  {course.image ? (
                    <img
                      src={course.image}
                      alt={course.title}
                      className="h-56 w-full object-cover sm:h-72 md:h-80 lg:h-[28rem]"
                    />
                  ) : (
                    <div className="flex h-56 w-full items-center justify-center bg-[#E7DCCE] text-[#765F55]">
                      No image
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[#2D2E30]/10 pt-4">
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
              </div>

              <div className="flex flex-col justify-center space-y-4 sm:space-y-5 md:space-y-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C97112]">Learn with confidence</p>
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#2D2E30] sm:text-4xl md:text-5xl">
                  {course.title}
                </h1>

                <p className="text-[#765F55] text-sm sm:text-base md:text-lg leading-relaxed">
                  {course.fullDescription}
                </p>

                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#2D2E30] mb-3 sm:mb-4">
                    What you’ll learn
                  </h3>
                  <ul className="space-y-2 sm:space-y-3">
                    {courseFeatures.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 text-sm sm:text-base text-[#765F55]"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#E58C1A]" strokeWidth={3} aria-hidden="true" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                
                <div className="flex flex-col gap-3 border-t border-[#2D2E30]/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#765F55]">Course access</p><p className="mt-1 text-2xl font-bold text-[#C97112]">{course.price}</p></div>
                  <button onClick={() => navigate(`/enroll/${course.id}`)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2D2E30]/20 transition hover:bg-[#E58C1A]">Enroll now <PlayCircle className="h-4 w-4" aria-hidden="true" /></button>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref={relatedCoursesRef} className="scroll-mt-20 bg-[#FFFDF8] px-4 py-14 sm:px-6 sm:py-16 md:px-10 md:py-20">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 border-b border-[#2D2E30]/10 pb-6 sm:mb-10 md:mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Continue learning</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">You might also like</h2>
          </div>

          {currentRelatedCourses.length > 0 ? (
            <>
              {/* Grid: 1 col → 2 col → 3 col */}
              <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
                {currentRelatedCourses.map((relatedCourse) => (
                  <CourseCard
                    key={relatedCourse.id}
                    id={relatedCourse.id}
                    image={relatedCourse.image}
                    title={relatedCourse.title}
                    description={relatedCourse.description}
                    price={relatedCourse.price}
                    rating={relatedCourse.rating}
                    reviews={relatedCourse.reviews}
                    isEnrolled={enrolledCourseIds.has(relatedCourse.id)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {relatedCourses.length > RELATED_COURSES_PER_PAGE ? (
                <div className="mt-8 sm:mt-10 md:mt-12 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      handlePageChange(Math.max(currentPage - 1, 1))
                    }
                    disabled={activePage === 1}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30] shadow-sm transition hover:border-[#E58C1A] hover:text-[#C97112] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Previous</span>
                  </button>

                  {Array.from(
                    { length: totalPages },
                    (_, index) => index + 1,
                  ).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => handlePageChange(pageNumber)}
                      className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full text-xs sm:text-sm font-semibold transition ${
                        activePage === pageNumber
                          ? "bg-[#E58C1A] text-white shadow-md shadow-[#E58C1A]/25"
                          : "border border-[#2D2E30]/15 bg-white text-[#765F55] hover:border-[#E58C1A] hover:text-[#C97112]"
                      }`}
                      aria-label={`Go to page ${pageNumber}`}
                      aria-current={
                        activePage === pageNumber ? "page" : undefined
                      }
                    >
                      {pageNumber}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      handlePageChange(Math.min(currentPage + 1, totalPages))
                    }
                    disabled={activePage === totalPages}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#2D2E30]/15 transition hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="hidden sm:inline">Next</span><ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl bg-white px-4 py-10 text-center text-gray-500 shadow-sm">
              No related courses available right now.
            </div>
          )}
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#F2EFE9] px-4 py-14 sm:px-6 sm:py-16 md:px-10 md:py-20">
        <div className="absolute -right-32 top-8 h-80 w-80 rounded-full border-[28px] border-[#E58C1A]/10" aria-hidden="true" />
        <div className="max-w-7xl mx-auto">
          <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start lg:gap-16">
              <div className="lg:sticky lg:top-28">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C97112]">The Arun Thai difference</p>
                <h2 className="mt-4 text-4xl font-bold leading-[1.02] tracking-tight text-[#2D2E30] sm:text-5xl">
                  Learn the Thai you’ll <span className="font-serif font-normal italic text-[#B96128]">actually use.</span>
                </h2>
                <p className="mt-5 max-w-md text-sm leading-relaxed text-[#765F55] sm:text-base md:text-lg">
                  Arun Thai is made for steady progress: clear guidance, useful practice, and the confidence to take Thai beyond the screen.
                </p>
                <div className="relative mt-8 flex h-48 max-w-sm items-center justify-center overflow-hidden bg-[#2D2E30] sm:h-56">
                  <div className="absolute inset-4 border border-[#F8C56A]/40" aria-hidden="true" />
                  <img src={Watermark} alt="Arun Thai learners" className="absolute inset-0 h-full w-full object-cover opacity-75" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2D2E30] via-[#2D2E30]/20 to-transparent" aria-hidden="true" />
                  <div className="relative mt-auto w-full p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#F8C56A]">Your next conversation</p>
                    <p className="mt-2 max-w-xs text-lg font-semibold leading-snug text-white">Practice that fits into real life.</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-px overflow-hidden border border-[#2D2E30]/15 bg-[#2D2E30]/15 sm:grid-cols-2">
                  {[
                    'Clear, step-by-step lessons that are easy to follow',
                    'Practical speaking and real-life communication focus',
                    'Self-paced videos — learn anytime, anywhere',
                    'Simple grammar explanations without confusion',
                    'Confidence-building practice in every lesson',
                    'Designed for beginners to advanced learners'
                  ].map((item, index) => (
                    <div key={index} className="group min-h-40 bg-[#FFFDF8] p-5 transition-colors hover:bg-[#FFF1D0] sm:p-6">
                      <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[0.18em] text-[#C97112]">0{index + 1}</span><Check className="h-4 w-4 text-[#E58C1A]" strokeWidth={3} aria-hidden="true" /></div>
                      <p className="mt-8 text-base font-semibold leading-snug text-[#2D2E30] sm:text-lg">{item}</p>
                    </div>
                  ))}
              </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default CourseDetail;
