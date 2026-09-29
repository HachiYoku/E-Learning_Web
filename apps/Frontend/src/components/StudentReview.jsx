import { ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchTestimonials } from "../services/testimonialService";

function pageSizeForViewport() {
  if (typeof window === "undefined") return 1;
  if (window.innerWidth >= 1024) return 3;
  if (window.innerWidth >= 768) return 2;
  return 1;
}

function StudentReview() {
  const [testimonials, setTestimonials] = useState(null);
  const [pageSize, setPageSize] = useState(pageSizeForViewport);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    let active = true;
    fetchTestimonials().then((items) => {
      if (active) setTestimonials(items);
    }).catch(() => {
      if (active) setTestimonials([]);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const updatePageSize = () => {
      const nextPageSize = pageSizeForViewport();
      const nextPageCount = Math.max(
        1,
        Math.ceil((testimonials?.length || 0) / nextPageSize)
      );
      setPageSize(nextPageSize);
      setCurrentPage((page) => Math.min(page, nextPageCount - 1));
    };
    window.addEventListener("resize", updatePageSize);
    return () => window.removeEventListener("resize", updatePageSize);
  }, [testimonials?.length]);

  if (!testimonials?.length) return null;

  const totalPages = Math.ceil(testimonials.length / pageSize);
  const activePage = Math.min(currentPage, totalPages - 1);
  const visibleTestimonials = testimonials.slice(
    activePage * pageSize,
    activePage * pageSize + pageSize
  );

  return (
    <section className="bg-[#2D2E30] px-4 py-12 sm:px-6 sm:py-14 md:px-10 md:py-16 lg:px-16">
      <div className="mx-auto max-w-[1500px]">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#E58C1A]">Student stories</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-[#FFF9EA] md:text-4xl">
            From our students
          </h2>
          <p
            lang="my"
            className="font-myanmar mt-3 text-sm font-normal leading-[1.8] text-[#E7DCCE]/85 sm:text-base"
          >
            Arun Thai နဲ့အတူ ထိုင်းစာလေ့လာနေတဲ့ ကျောင်းသား၊ ကျောင်းသူများ ရေးသားမျှဝေထားတဲ့ တကယ့်အတွေ့အကြုံနဲ့ ခံစားချက်တွေကို ဖတ်ရှုလိုက်ပါ။
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {visibleTestimonials.map(({ id, quote, displayName, profileImage }) => (
            <article
              key={id}
              className="flex flex-col rounded-2xl border border-white/15 bg-white/[0.06] p-5 sm:p-6"
            >
              <blockquote className="whitespace-pre-wrap break-words text-base font-medium leading-7 text-[#FFF9EA] lg:text-[17px] lg:leading-7">
                “{quote}”
              </blockquote>
              <div className="mt-5 flex items-center gap-2.5">
                {profileImage ? (
                  <img src={profileImage} alt="" className="h-9 w-9 rounded-full object-cover sm:h-10 sm:w-10" />
                ) : displayName === "Anonymous learner" ? (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[#F4CD7D] sm:h-10 sm:w-10">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  </span>
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4CD7D] text-sm font-semibold text-[#2D2E30] sm:h-10 sm:w-10">
                    {displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <p className="text-sm font-medium text-[#E7DCCE]">{displayName}</p>
              </div>
            </article>
          ))}
        </div>
        {totalPages > 1 ? (
          <div
            className="mt-6 flex items-center justify-center gap-2"
            aria-label="Testimonial pagination"
          >
            <button
              type="button"
              onClick={() => setCurrentPage(activePage - 1)}
              disabled={activePage === 0}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-sm font-medium text-[#E7DCCE] transition hover:border-white/30 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2 focus:ring-offset-[#2D2E30] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </button>
            <div className="flex items-center" aria-label="Current testimonial page">
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentPage(index)}
                  aria-label={`Show testimonials page ${index + 1}`}
                  aria-current={index === activePage ? "page" : undefined}
                  className="-mx-2 flex h-11 w-8 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E58C1A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D2E30]"
                >
                  <span
                    className={index === activePage ? "h-1.5 w-6 rounded-full bg-[#E58C1A]" : "h-1.5 w-1.5 rounded-full bg-white/35"}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage(activePage + 1)}
              disabled={activePage === totalPages - 1}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-sm font-medium text-[#E7DCCE] transition hover:border-white/30 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2 focus:ring-offset-[#2D2E30] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default StudentReview;
