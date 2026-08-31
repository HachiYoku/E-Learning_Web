import ServiceCard from "./ServiceCard";

const asianMotherImage = "/service/asian-mother-enjoy-teach-explain-homework-child-daughter-online-study-homeschooling-home-home-quarantine-online-learning-new-normal-lifestyle.jpg";
const languageLearningImage = "/service/close-up-people-learning-language.jpg";
const teacherImage = "/service/medium-shot-smiley-teacher-with-whiteboard.jpg";

const services = [
  {
    image: asianMotherImage,
    title: "One-on-One Thai Class",
    features: [
      "Personalized lessons based on your learning goals",
      "Flexible learning pace and lesson content",
      "Individual speaking and pronunciation practice",
      "Grammar and vocabulary explained clearly",
      "Direct feedback from your teacher",
    ],
    className: "md:mt-12",
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
      "Improve communication through pair and group practice",
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
      "Build confidence speaking Thai naturally",
    ],
    className: "md:mt-12",
  },
];

function OurServices() {
  return (
    <section className="relative isolate overflow-hidden bg-[#FFF9EA] px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-16">
      <div className="absolute -left-28 bottom-0 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/18 blur-3xl" aria-hidden="true" />
      <div className="absolute -right-24 top-0 -z-10 h-96 w-96 rounded-full bg-[#E9A9A0]/18 blur-3xl" aria-hidden="true" />
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-6 border-b border-[#2D2E30]/12 pb-8 sm:pb-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C97112]">Learn your way</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#2D2E30] sm:text-4xl md:text-5xl">
              Our Thai Learning <span className="text-[#E58C1A]">Services.</span>
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[#765F55] sm:text-base md:text-right">
            Choose the learning experience that best fits your goals, confidence, and schedule.
          </p>
        </div>

        <div className="grid items-start gap-6 pt-10 sm:gap-8 md:grid-cols-3 md:gap-8 md:pt-14 lg:gap-10">
          {services.map((service) => (
            <ServiceCard
              key={service.title}
              image={service.image}
              title={service.title}
              features={service.features}
              className={service.className}
              imageLoading={service.imageLoading}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default OurServices;
