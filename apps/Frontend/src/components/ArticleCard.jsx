import { ArrowRight, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";

const defaultAuthorLogo = "/Nav/Logo.png";
const fallbackImage =
  "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&h=600&fit=crop";

function ArticleCard({ id, image, title, description, authorLogo, authorName, date, onReadMore }) {
  const navigate = useNavigate();

  const handleReadMore = () => {
    if (onReadMore) {
      onReadMore(id);
      return;
    }

    navigate("/blog");
  };

  const resolvedImage =
    image && image.startsWith("/src/assets")
      ? new URL(image.replace("/src/assets/", "../assets/"), import.meta.url).href
      : image;

  const resolvedAuthorLogo = authorLogo
    ? authorLogo.startsWith("/src/assets")
      ? new URL(authorLogo.replace("/src/assets/", "../assets/"), import.meta.url).href
      : authorLogo
    : defaultAuthorLogo;

  return (
    <article className="group relative flex h-full w-full flex-col overflow-hidden rounded-[1.75rem] border border-[#2D2E30]/10 bg-[#FFFDF8] p-2 shadow-[0_18px_45px_-32px_rgba(80,48,19,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_25px_50px_-30px_rgba(80,48,19,0.45)]">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#E58C1A]/65 to-transparent" aria-hidden="true" />
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[1.3rem] bg-[#E7DCCE]">
        <img
          src={resolvedImage || fallbackImage}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#C97112]">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{date || "Latest insight"}</span>
        </div>
        <h3 className="line-clamp-3 text-xl font-bold tracking-tight text-[#2D2E30]">{title}</h3>

        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-[#765F55]">{description}</p>

        <div className="mt-6 flex items-center justify-between border-t border-[#2D2E30]/10 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={resolvedAuthorLogo}
              alt={authorName}
              className="h-9 w-9 rounded-full border border-[#E58C1A]/20 object-contain p-1"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#2D2E30]">{authorName || "Arun Thai"}</p>
              <p className="text-xs text-[#8B6F61]">Arun Thai Journal</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReadMore}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2D2E30] text-white transition-colors hover:bg-[#E58C1A]"
            aria-label={`Read ${title}`}
          >
            <ArrowRight className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default ArticleCard;
