import ServiceCard from "./ServiceCard"
const asianMotherImage = "/service/asian-mother-enjoy-teach-explain-homework-child-daughter-online-study-homeschooling-home-home-quarantine-online-learning-new-normal-lifestyle.jpg"
const languageLearningImage = "/service/close-up-people-learning-language.jpg"
const teacherImage = "/service/medium-shot-smiley-teacher-with-whiteboard.jpg"

const serviceCards = [
  {
    image: asianMotherImage,
    title: "One-on-One English Coaching",
    description: "Personalized lessons focused on your goals and learning style.",
    features: [
      "Personalized speaking practice based on your goals",
      "Grammar explained in real conversation context",
      "Vocabulary building for daily communication",
      "Confidence coaching for natural expression",
      "Real-life conversation training"
    ],
    className: "md:mt-16",
    imageLoading: "eager",
  },
  {
    image: languageLearningImage,
    title: "IELTS Preparation Guidance",
    description: "Targeted coaching designed to build exam confidence and strategy.",
    features: [
      "Speaking strategies for higher band scores",
      "Writing structure and task response coaching",
      "Listening and reading skill training",
      "Mock tests with feedback and improvement plans",
      "Exam confidence and time management"
    ],
  },
  {
    image: teacherImage,
    title: "Conversational English Training",
    description: "Interactive sessions that help you speak naturally and comfortably.",
    features: [
      "Everyday communication practice",
      "Pronunciation and fluency development",
      "Natural sentence flow practice",
      "Active listening and response skills",
      "Confidence-building conversation drills"
    ],
    className: "md:mt-16",
  },
]

function Service() {
  return (
    <section className="px-4 sm:px-6 md:px-10 py-8 sm:py-12 md:py-16 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10 md:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4">
            How We Help You Improve Your English
          </h2>
        </div>

        {/* Service Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 md:gap-10 lg:gap-12">
          {serviceCards.map((card) => (
            <ServiceCard
              key={card.title}
              image={card.image}
              title={card.title}
              description={card.description}
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
