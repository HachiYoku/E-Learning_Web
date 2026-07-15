import TestimonialVideo from "./TestimonialVideo"
const student1 = "/review/its-you-congratulations-smiling-asian-corporate-woman-ceo-manager-suit-glasses-pointing-finge.jpg"
const student2 = "/review/young-chinese-woman-standing-white-background-showing-palm-hand-doing-ok-gesture-with-thumbs-up-smiling-happy-cheerful.jpg"

function StudentReview() {
  return (
    <section className="px-4 sm:px-6 md:px-10 py-10 sm:py-14 md:py-16 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4">
            What Our Students Say
          </h2>
          <p className="text-gray-600 text-xs sm:text-sm md:text-base lg:text-lg">
            Hear real experiences from learners who improved their skills and confidence with our courses.
          </p>
        </div>

        {/* Testimonial Videos Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7 md:gap-8">
          <TestimonialVideo
            image={student1}
            src="https://youtu.be/PXO2x2GDCFY?si=0n7RxcjldQTaI2cx"
            backgroundColor="bg-gray-200"
          />
          <TestimonialVideo
            image={student2}
            src="https://youtu.be/PXO2x2GDCFY?si=0n7RxcjldQTaI2cx"
            backgroundColor="bg-pink-300"
          />
        </div>
      </div>
    </section>
  )
}

export default StudentReview
