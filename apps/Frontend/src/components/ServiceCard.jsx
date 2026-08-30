import { Check } from "lucide-react";

function ServiceCard({ image, title, features, className, imageLoading = "lazy" }) {
  return (
    <article
      className={`group self-start overflow-hidden rounded-[1.75rem] border border-[#2D2E30]/10 bg-[#FFFDF8] shadow-[0_18px_45px_-28px_rgba(45,46,48,0.45)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_28px_55px_-25px_rgba(45,46,48,0.38)] ${className || ""}`}
    >
      <div className="relative h-52 overflow-hidden sm:h-60">
        <img
          src={image}
          alt={title}
          loading={imageLoading}
          decoding="async"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2D2E30]/55 via-transparent to-transparent" />
        <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#C97112] backdrop-blur">
          Thai learning
        </span>
      </div>

      <div className="flex flex-col p-6 sm:p-7">
        <h3 className="text-2xl font-bold tracking-tight text-[#2D2E30]">{title}</h3>

        <div className="my-5 h-px bg-[#2D2E30]/10" />
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C97112]">What you’ll get</p>
        <ul className="mt-4 space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm leading-relaxed text-[#4B4541]">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FCE7B2] text-[#B6630D]">
                <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export default ServiceCard;
