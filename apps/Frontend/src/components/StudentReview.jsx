import { Quote, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchTestimonials } from "../services/testimonialService";

function StudentReview() {
  const [testimonials, setTestimonials] = useState(null);

  useEffect(() => {
    let active = true;
    fetchTestimonials().then((items) => {
      if (active) setTestimonials(items);
    }).catch(() => {
      if (active) setTestimonials([]);
    });
    return () => { active = false; };
  }, []);

  if (!testimonials?.length) return null;

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
          {testimonials.map(({ id, quote, displayName, profileImage }) => (
            <article key={id} className="flex h-full flex-col rounded-[2rem] border border-white/15 bg-white/10 p-7 shadow-[0_20px_45px_-32px_rgba(0,0,0,0.75)] backdrop-blur-sm sm:p-8">
              <Quote className="h-8 w-8 text-[#F4CD7D]" strokeWidth={1.5} aria-hidden="true" />
              <blockquote className="mt-5 whitespace-pre-wrap break-words text-base leading-relaxed text-[#FFF9EA] sm:text-lg">“{quote}”</blockquote>
              <div className="mt-auto flex items-center gap-3 pt-7">{profileImage ? <img src={profileImage} alt="" className="h-11 w-11 rounded-full object-cover" /> : displayName === "Anonymous learner" ? <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[#F4CD7D]"><UserRound className="h-5 w-5" aria-hidden="true" /></span> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F4CD7D] text-sm font-bold text-[#2D2E30]">{displayName.slice(0, 1).toUpperCase()}</span>}<p className="font-bold text-[#FFF9EA]">{displayName}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default StudentReview;
