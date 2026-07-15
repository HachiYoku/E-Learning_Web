import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Check, TvMinimalPlay } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import CourseCard from "../components/CourseCard";
import LoadingSpinner from "../components/LoadingSpinner";
const Watermark = "/moti/Watermark.JPG";
import { fetchCourseById, fetchCourses } from "../services/courseService";

const RELATED_COURSES_PER_PAGE = 4;

function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [course, setCourse] = useState(null);
  const [relatedCourses, setRelatedCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const totalPages = Math.max(
    1,
    Math.ceil(relatedCourses.length / RELATED_COURSES_PER_PAGE),
  );
  const startIndex = (currentPage - 1) * RELATED_COURSES_PER_PAGE;
  const currentRelatedCourses = relatedCourses.slice(
    startIndex,
    startIndex + RELATED_COURSES_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [courseId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <LoadingSpinner message="Loading course..." />
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center h-screen px-4 text-center">
          <p className="text-2xl text-gray-600">
            {error || "Course not found"}
          </p>
        </div>
      </div>
    );
  }

  const renderStars = (rating) => {
    return (
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <span
            key={i}
            className={
              i < Math.floor(rating) ? "text-yellow-400" : "text-gray-300"
            }
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const courseFeatures =
    course.features.length > 0
      ? course.features
      : ["No specific features listed for this course."];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8 bg-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">
              Explore Our Online Video Courses
            </h1>
            <p className="text-gray-600 text-sm sm:text-base md:text-lg leading-relaxed px-2">
              Browse a curated collection of self-paced English video courses
              designed to improve your speaking, grammar, and real-world
              communication skills.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 md:p-10 lg:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10 lg:gap-12">
              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-start justify-center">
                  {course.image ? (
                    <img
                      src={course.image}
                      alt={course.title}
                      className="w-full h-48 sm:h-64 md:h-80 lg:h-96 object-cover rounded-xl"
                    />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
                      No image
                    </div>
                  )}
                </div>

                <div className="space-y-3  p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
                    <div className="flex items-center gap-2">
                      <TvMinimalPlay
                        className="h-5 w-5 text-gray-700"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span className="text-gray-700 font-semibold text-sm sm:text-base">
                        {course.lessons} lessons
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {renderStars(course.rating)}
                      <span className="text-gray-700 font-semibold text-sm sm:text-base">
                        ({course.rating.toFixed(1)}/5)
                      </span>
                    </div>
                  </div>

                  <div className="text-xl sm:text-2xl font-semibold text-gray-900">
                    Price - {course.price}
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center space-y-4 sm:space-y-5 md:space-y-6">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium text-gray-900">
                  {course.title}
                </h2>

                <p className="text-gray-600 text-sm sm:text-base md:text-lg leading-relaxed">
                  {course.fullDescription}
                </p>

                <div>
                  <h3 className="text-lg sm:text-xl font-medium text-gray-900 mb-3 sm:mb-4">
                    What you'll learn:
                  </h3>
                  <ul className="space-y-2 sm:space-y-3">
                    {courseFeatures.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 text-sm sm:text-base text-gray-600"
                      >
                        <span className="text-pink-400 mt-1 flex-shrink-0">
                          •
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                
                  <button
                    onClick={() => navigate(`/enroll/${course.id}`)}
                    className="w-full sm:w-auto bg-[#F8B2C0] hover:bg-[#F8C2C0] text-gray-900 font-bold py-3 sm:py-4 px-8 sm:px-12 rounded-full transition-colors text-sm sm:text-base md:text-lg"
                  >
                    สมัครเรียนเลย 
                  </button>
                
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 lg:px-10 py-12 sm:py-14 md:py-16 bg-pink-50">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Related Courses
            </h2>
            <div className="w-16 sm:w-20 md:w-24 h-1 bg-gray-900 mx-auto" />
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
                    disabled={currentPage === 1}
                    className="rounded-full border border-gray-300 px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
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
                        currentPage === pageNumber
                          ? "bg-[#F8B2C0] text-gray-900"
                          : "border border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                      aria-label={`Go to page ${pageNumber}`}
                      aria-current={
                        currentPage === pageNumber ? "page" : undefined
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
                    disabled={currentPage === totalPages}
                    className="rounded-full border border-gray-300 px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
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
      </div>

      <div className="px-4 sm:px-6 md:px-8 lg:px-10 py-12 sm:py-14 md:py-16 bg-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-10 lg:p-12 shadow-lg">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 md:gap-12 items-center">
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
                  ทำไมต้องเลือกเรียนภาษาอังกฤษออนไลน์กับ Mind Ploy English?
                </h2>


                <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-6 sm:mb-8">
                  Mind Ploy English ออกแบบมาเพื่อผู้เรียนที่ต้องการเห็นผลลัพธ์จริง สร้างความมั่นใจได้จริง และใช้งานสื่อสารได้จริงในชีวิตประจำวัน เราเน้นการเรียนที่ เข้าใจง่าย เป็นระบบ และเห็นผล เพื่อให้คุณรู้เป้าหมายที่ชัดเจน และพัฒนาตัวเองได้อย่างถูกจุดในทุกๆ วัน
                </p>

                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">
                  จุดเด่นที่ทำให้เราแตกต่าง
                </h3>

                <ul className="space-y-3 sm:space-y-4">
                  {[
                    "บทเรียนชัดเจน เข้าใจง่าย: เรียนรู้แบบเป็นขั้นตอน (Step-by-step) เนื้อหาเรียงลำดับมาอย่างดี ทำให้การเรียนเป็นเรื่องง่ายและไม่น่าเบื่อ",
                    "เน้นการสื่อสารที่ใช้ได้จริง: มุ่งเน้นทักษะการพูดและการสื่อสารที่หยิบไปใช้ในสถานการณ์จริงได้ทันที",
                    "เส้นทางการเรียนรู้เป็นระบบ: วางแผนการเรียนให้อย่างชัดเจน เพื่อให้คุณเห็นพัฒนาการที่ก้าวหน้าอย่างมั่นคง",
                    "อิสระแห่งการเรียนรู้: รูปแบบวิดีโอออนไลน์ เรียนได้ทุกที่ ทุกเวลา ตามความสะดวกของคุณ",
                    "ไวยากรณ์ฉบับย่อยง่าย: อธิบายแกรมม่าด้วยภาษาง่ายๆ ตัดความซับซ้อนทิ้ง ให้คุณเข้าใจได้โดยไม่สับสน",
                    "สร้างความมั่นใจในทุกบทเรียน: ทุกการฝึกฝนออกแบบมาเพื่อทลายความกลัว และเสริมความมั่นใจให้กล้าใช้ภาษาอังกฤษ",
                    "ครอบคลุมทุกระดับ: รองรับตั้งแต่ผู้ที่ไม่มีพื้นฐาน ไปจนถึงผู้เรียนระดับสูงที่ต้องการต่อยอดทักษะ",
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3 sm:gap-4">
                      <div className="flex-shrink-0 w-5 sm:w-6 h-5 sm:h-6 bg-black rounded-full flex items-center justify-center mt-0.5">
                        <Check
                          className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white"
                          strokeWidth={3}
                          aria-hidden="true"
                        />
                      </div>
                      <span className="text-gray-700 text-sm sm:text-base">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-center order-first lg:order-last mt-6 lg:mt-0">
                <img
                  src={Watermark}
                  alt="Mind Ploy English Logo"
                  className="w-full max-w-xs sm:max-w-sm md:max-w-md h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default CourseDetail;
