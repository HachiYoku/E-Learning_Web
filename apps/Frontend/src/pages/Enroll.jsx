import { useParams, useNavigate } from "react-router-dom";
import { Fragment, useEffect, useState } from "react";
import { TvMinimalPlay } from "lucide-react";
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
        <div className="flex items-center justify-center h-screen">
          <LoadingSpinner message="Loading course..." />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <p className="text-lg sm:text-2xl text-gray-600">
            {error || "Course not found"}
          </p>
        </div>
      </div>
    );
  }

  const renderStars = (rating) => (
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

  return (
    <Fragment>
      <div className="min-h-screen bg-blue-50">
        <Navbar />

        {/* Back to Courses */}
        <div className="px-4 sm:px-6 md:px-10 pt-6 sm:pt-8">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={() => navigate("/courses")}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-semibold transition-colors text-sm sm:text-base"
            >
              <span className="text-xl sm:text-2xl">←</span>
              Back To Courses
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 md:px-10 py-8 sm:py-10 md:py-12">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8 sm:mb-10 md:mb-12">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900">
                Complete Your Enrollment
              </h1>
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
                <div className="bg-white rounded-3xl p-5 sm:p-6 md:p-8 shadow-lg">
                  <div className="mb-5 sm:mb-6">
                    <img
                      src={course.image}
                      alt={course.title}
                      className="w-full h-48 sm:h-56 md:h-64 lg:h-80 xl:h-96 object-cover rounded-2xl"
                    />
                  </div>

                  <div className="mb-2">
                    <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                      {course.title}
                    </span>
                  </div>

                  <div className="mb-4">
                    <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-semibold">
                      Course Title — {course.title}
                    </h1>
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
                  </div>

                  <div className="text-xl sm:text-2xl font-semibold text-gray-900">
                    Price - {course.price}
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="md:col-span-1 lg:col-span-1">
                <div className="bg-white rounded-3xl p-5 sm:p-6 md:p-6 shadow-lg md:sticky md:top-20">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-5">
                    สรุปรายการ 
                  </h3>

                  <div className="space-y-3 mb-4 sm:mb-5">
                    <div className="flex justify-between items-start gap-3">
                      <span className="text-gray-700 font-semibold text-xs sm:text-sm shrink-0">
                        ชื่อคอร์ส::
                      </span>
                      <span className="text-gray-900 font-semibold text-xs sm:text-sm text-right">
                        {course.title}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-gray-300">
                      <span className="text-gray-700 font-semibold text-xs sm:text-sm">
                        ราคา:
                      </span>
                      <span className="text-gray-900 font-semibold text-xs sm:text-sm">
                        {course.price}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-sm font-bold text-gray-900">
                        ยอดชำระสุทธิ:
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {course.price}
                      </span>
                    </div>
                  </div>

                  {/* How to Enroll */}
                  <div className="bg-gray-50 rounded-2xl p-3 sm:p-4 mb-4 sm:mb-5">
                    <h4 className="font-bold text-gray-900 mb-2 sm:mb-3 text-xs sm:text-sm">
                      ขั้นตอนการสมัครเรียน
                    </h4>
                    <ol className="space-y-2 text-xs text-gray-700">
                      <li>
                        <span className="font-semibold">ขั้นตอนที่ 1.</span> สแกน QR Code เพื่อชำระเงิน.
                      </li>
                      <li>
                        <span className="font-semibold">ขั้นตอนที่ 2.</span> แนบหลักฐานการโอนเงิน (สลิป)
                      </li>
                      <li>
                        <span className="font-semibold">ขั้นตอนที่ 3.</span> รอเจ้าหน้าที่ตรวจสอบ . Check status in{" "}
                        <span className="font-bold">
                          Profile → My Course Orders
                        </span>
                        .
                      </li>
                    </ol>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={() => navigate(`/courses/${courseId}`)}
                      className="flex-1 border-2 border-gray-300 text-gray-900 font-bold py-2 sm:py-2.5 rounded-full hover:bg-gray-50 transition-colors text-xs sm:text-sm"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleEnrollClick}
                      className="flex-1 bg-[#F8B2C0] hover:bg-[#F8C2C0] text-gray-900 font-bold py-2 sm:py-2.5 rounded-full transition-colors text-xs sm:text-sm"
                    >
                      สมัครเรียนเลย 
                    </button>
                  </div>
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
