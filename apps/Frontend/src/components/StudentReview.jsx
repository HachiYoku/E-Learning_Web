import { Quote, Star } from "lucide-react";

const student1 = "/review/its-you-congratulations-smiling-asian-corporate-woman-ceo-manager-suit-glasses-pointing-finge.jpg";
const student2 = "/review/young-chinese-woman-standing-white-background-showing-palm-hand-doing-ok-gesture-with-thumbs-up-smiling-happy-cheerful.jpg";

const testimonials = [
  {
    quote: "The lessons are practical and easy to follow. I can now use Thai with much more confidence in everyday situations.",
    name: "Maya R.",
    detail: "Beginner Thai learner",
    image: student1,
  },
  {
    quote: "My teacher explains everything clearly and always makes me feel comfortable speaking, even when I make mistakes.",
    name: "Sofia L.",
    detail: "Conversation class student",
    image: student2,
  },
  {
    quote: "Learning at my own pace has made all the difference. Each class leaves me motivated to keep improving.",
    name: "Daniel K.",
    detail: "Thai foundations student",
    initials: "DK",
  },
];

function StudentReview() {
  return (
    <section className="relative isolate overflow-hidden bg-[#2D2E30] px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-16">
      <div className="absolute -left-24 top-0 -z-10 h-80 w-80 rounded-full bg-[#E58C1A]/20 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-24 -right-24 -z-10 h-96 w-96 rounded-full bg-[#E9A9A0]/15 blur-3xl" aria-hidden="true" />
      <div className="mx-auto max-w-[1500px]">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.26em] text-[#F4CD7D]">Student stories</p>
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-[#FFF9EA] sm:text-4xl md:text-5xl">
            What Our Students <span className="text-[#F4CD7D]">Say.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#E7DCCE]/80 sm:text-lg">
            Real reflections from learners building Thai skills and confidence step by step.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:mt-14 md:grid-cols-3 md:gap-6">
          {testimonials.map(({ quote, name, detail, image, initials }) => (
            <article key={name} className="flex min-h-[280px] flex-col rounded-[2rem] border border-white/15 bg-white/10 p-7 shadow-[0_20px_45px_-32px_rgba(0,0,0,0.75)] backdrop-blur-sm sm:p-8">
              <Quote className="h-8 w-8 text-[#F4CD7D]" strokeWidth={1.5} aria-hidden="true" />
              <div className="mt-5 flex gap-1" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }, (_, index) => <Star key={index} className="h-4 w-4 fill-[#F4CD7D] text-[#F4CD7D]" aria-hidden="true" />)}
              </div>
              <blockquote className="mt-5 text-base leading-relaxed text-[#FFF9EA] sm:text-lg">“{quote}”</blockquote>
              <div className="mt-auto flex items-center gap-3 pt-7">
                {image ? (
                  <img src={image} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F4CD7D] text-xs font-bold text-[#2D2E30]">{initials}</span>
                )}
                <div>
                  <p className="font-bold text-[#FFF9EA]">{name}</p>
                  <p className="text-sm text-[#E7DCCE]/70">{detail}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default StudentReview;
