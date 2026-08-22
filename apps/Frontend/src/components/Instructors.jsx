import { ArrowUpRight } from "lucide-react";

const instructor1Url = "public/instructors/instructor2.jpg";
const instructor2Url = "public/instructors/instructor1.jpg";

function Instructors() {
  return (
    <section className="relative px-4 sm:px-6 md:px-10 py-10 sm:py-12 md:py-20 bg-[#F8FCFE]">
      <div className="max-w-6xl mx-auto">
        {/* Title Section */}
        <div className="text-center mb-6 sm:mb-8 md:mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4 leading-tight">
            Learn English with supportive instructors
            <br className="hidden sm:block" />
            who guide you step by step.
          </h2>
          <p
            className="text-xs sm:text-sm md:text-base lg:text-lg max-w-5xl mx-auto px-2"
            style={{ color: "#8B6F61" }}
          >
            Friendly teaching, real conversations, and confidence-building lessons — all designed to help you grow.
          </p>
        </div>

        {/* Our Instructors Label */}
        <div className="text-center mb-4 sm:mb-6 md:mb-8">
          <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800">
            Our Instructors :
          </h3>
        </div>

        {/* Instructor Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 max-w-3xl mx-auto">
          {/* Instructor 1 - Pink Card */}
          <div className="relative group rounded-3xl overflow-hidden w-full">
            <div
              className="h-56 sm:h-64 md:h-80 lg:h-96"
              style={{ backgroundColor: "#D4899B" }}
            >
              <img
                src={instructor1Url}
                alt="Ms.Patiln Jintanawong"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end items-center p-4 sm:p-5 md:p-6">
                <h4 className="text-white font-semibold text-sm sm:text-base md:text-lg text-center">
                  Kru Patiln
                </h4>
                <p className="text-white/90 text-xs sm:text-sm text-center mt-1">
                  Instructor
                </p>
              </div>
            </div>
          </div>

          {/* Instructor 2 - Gray Card */}
          <div className="relative group rounded-3xl overflow-hidden w-full">
            <div
              className="h-56 sm:h-64 md:h-80 lg:h-96"
              style={{ backgroundColor: "#C0C0C0" }}
            >
              <img
                src={instructor2Url}
                alt="Ms.Panida Mounjoy"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end items-center p-4 sm:p-5 md:p-6">
                <h4 className="text-white font-semibold text-sm sm:text-base md:text-lg text-center">
                   Dreen Po
                </h4>
                <p className="text-white/90 text-xs sm:text-sm text-center mt-1">
                  Instructor
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What Will You Get Section */}
        <div className="rounded-2xl p-4 sm:p-6 md:p-8 max-w-3xl mx-auto mt-8 sm:mt-10">
          <h3 className="text-center text-lg sm:text-xl md:text-2xl font-semibold text-gray-800 mb-4 sm:mb-6">
            What will you get:
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 md:gap-6">
            {[
              "Clear grammar explained in a simple way","Ask questions and grow your confidence",
              "Step-by-step guidance from supportive instructors",
              "Learn in a friendly, pressure-free environment",
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-5 sm:w-6 h-5 sm:h-6 rounded-sm flex items-center justify-center shrink-0 mt-0.5 border border-gray-300"
                  style={{ backgroundColor: "#FCDCE2" }}
                >
                  <ArrowUpRight
                    className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-black"
                    strokeWidth={2.5}
                  />
                </div>
                <p className="text-gray-700 font-medium text-xs sm:text-sm md:text-base">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Instructors;
