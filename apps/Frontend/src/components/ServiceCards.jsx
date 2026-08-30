import ServiceCard from "./ServiceCard"
const asianMotherImage = "/service/asian-mother-enjoy-teach-explain-homework-child-daughter-online-study-homeschooling-home-home-quarantine-online-learning-new-normal-lifestyle.jpg"
const languageLearningImage = "/service/close-up-people-learning-language.jpg"
const teacherImage = "/service/medium-shot-smiley-teacher-with-whiteboard.jpg"

const serviceCards = [
  {
    image: asianMotherImage,
    title: "One-on-One Thai Class",
    features: [
      "Personalized lessons based on your learning goals",
      "Flexible learning pace and lesson content",
      "Individual speaking and pronunciation practice",
      "Grammar and vocabulary explained clearly",
      "Direct feedback from your teacher"
    ],
    className: "md:mt-16",
    imageLoading: "eager",
  },
  {
    image: languageLearningImage,
    title: "Group Thai Class",
    features: [
      "Interactive lessons with other learners",
      "Practice speaking through group activities",
      "Build vocabulary for everyday communication",
      "Learn Thai grammar in practical contexts",
      "Improve communication through pair and group practice"
    ],
  },
  {
    image: teacherImage,
    title: "Thai Speaking Class",
    features: [
      "Practice real-life Thai conversations",
      "Improve pronunciation and natural speaking",
      "Learn useful phrases for everyday situations",
      "Develop listening and response skills",
      "Build confidence speaking Thai naturally"
    ],
    className: "md:mt-16",
  },
]

function Service() {
  return (
    <section className="px-4 sm:px-6 md:px-10 py-8 sm:py-12 md:py-16 bg-white mb-8 md:mb-14 lg:mb-18">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4">
            How We Help You Improve Your Thai Skills
          </h2>
        </div>

        {/* Service Cards Grid */}
        <div className="grid items-start grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3 md:gap-10 lg:gap-12">
          {serviceCards.map((card) => (
            <ServiceCard
              key={card.title}
              image={card.image}
              title={card.title}
              features={card.features}
              className={card.className}
              imageLoading={card.imageLoading}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Service
