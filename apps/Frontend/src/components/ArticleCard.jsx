import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const defaultAuthorLogo = "/Nav/Logo.PNG";
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
    <article className="group w-80 h-110 rounded-2xl overflow-hidden bg-white px-2 py-2 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-48 w-full overflow-hidden rounded-xl bg-gray-300">
        <img
          src={resolvedImage || fallbackImage}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
      </div>

      <div className="flex h-[15.5rem] flex-col px-5 py-5">
        <h3 className="mb-2 line-clamp-3 text-lg font-bold text-gray-900">{title}</h3>

        <p className="mb-4 line-clamp-3 flex-1 text-sm text-[#8B6F61]">{description}</p>

        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={resolvedAuthorLogo}
              alt={authorName}
              className="h-12 w-12 object-full scale-100 rounded-xl border-2 border-[#F5C6D8] "
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-gray-900">{authorName}</p>
              <p className="text-xs text-gray-600">{date}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReadMore}
            className="flex h-10 w-14 items-center justify-center rounded-full bg-[#F8B2C0] text-lg text-gray-900 transition-all hover:bg-[#F8C2C0]"
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
