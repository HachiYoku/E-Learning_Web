import { ArrowRight } from "lucide-react";

function ServiceCard({ number, label, image, title, tagline, description, imageLoading = "lazy", onContact }) {
  return (
    <article
      className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[#E58C1A]/20 bg-[#FFFDF8] shadow-[0_18px_45px_-30px_rgba(45,46,48,0.38)] transition duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_24px_48px_-28px_rgba(45,46,48,0.35)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#FCE7B2]">
        <img
          src={image}
          alt={title}
          loading={imageLoading}
          decoding="async"
          className="h-full w-full object-cover transition duration-700 motion-safe:group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2D2E30]/25 via-transparent to-transparent" />
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="text-brand-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E58C1A]/25 bg-[#FFF1D0] text-xs font-bold tracking-[0.12em]">{number}</span>
          <p className="text-brand-accent text-xs font-bold uppercase tracking-[0.16em]">{label}</p>
        </div>
        <h3 className="mt-5 text-[1.4rem] font-bold leading-tight tracking-tight text-[#2D2E30] sm:text-2xl">{title}</h3>
        <p className="mt-2.5 text-sm font-medium leading-relaxed text-[#765F55]">{tagline}</p>
        <p lang="my" className="font-myanmar mt-4 text-sm font-normal leading-[1.8] text-[#765F55] sm:text-base">{description}</p>
        <div className="mt-auto pt-6">
          <button type="button" onClick={onContact} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#E58C1A] focus:outline-none focus:ring-4 focus:ring-[#E58C1A]/20">
            Contact Us <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default ServiceCard;
