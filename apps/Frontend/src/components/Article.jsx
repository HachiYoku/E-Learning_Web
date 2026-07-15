import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArticleCard from "./ArticleCard";
import LoadingSpinner from "./LoadingSpinner";
import { fetchBlogs } from "../services/blogService";

function Article() {
  const navigate = useNavigate();
  const scrollContainerRef = useRef(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadArticles() {
      try {
        setIsLoading(true);
        setError("");
        const blogs = await fetchBlogs();

        if (isMounted) {
          setArticles(blogs.slice(0, 6));
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || "Failed to load articles");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadArticles();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleMouseDown = (e) => {
    setIsDown(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDown(false);
  };

  const handleMouseUp = () => {
    setIsDown(false);
  };

  const speed = 1.5; // adjust here anytime

  const handleMouseMove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * speed;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleTouchStart = (e) => {
    setIsDown(true);
    setStartX(e.touches[0].pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleTouchMove = (e) => {
    if (!isDown) return;
    const x = e.touches[0].pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * speed;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleTouchEnd = () => {
    setIsDown(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    scrollContainerRef.current.scrollLeft += e.deltaY * 5;
  };

  return (
    <>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <section className="px-4 sm:px-6 md:px-10 py-8 sm:py-12 md:py-16 bg-blue-50">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-8 sm:mb-10 md:mb-12">
            <div className="flex-1 mb-4 sm:mb-5 md:mb-0">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4">
                English Tips & Learning Articles
              </h2>
              <p className="text-[#8B6F61] text-xs sm:text-sm md:text-base max-w-2xl">
                We share easy-to-follow articles that guide students through
                speaking, vocabulary, and grammar in a friendly way.
              </p>
            </div>
            <button
              onClick={() => navigate("/blog")}
              className="text-gray-900 font-bold text-sm sm:text-base md:text-lg underline hover:text-gray-700 transition-colors whitespace-nowrap md:mt-2 cursor-pointer bg-transparent border-none mt-3 sm:mt-4 md:mt-0"
            >
              See More
            </button>
          </div>
          {/* Horizontal Scrollable Section */}
          <div
            className="overflow-x-auto pb-2 sm:pb-3 md:pb-4 cursor-grab active:cursor-grabbing hide-scrollbar"
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            tabIndex={0}
            style={{ userSelect: "none", WebkitOverflowScrolling: "touch" }}
          >
            {isLoading ? (
              <div className="min-w-full flex justify-center py-8">
                <LoadingSpinner message="Loading articles..." />
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-center text-red-700 shadow-sm">
                {error}
              </div>
            ) : articles.length === 0 ? (
              <div className="rounded-3xl bg-white px-6 py-8 text-center text-gray-600 shadow-sm">
                No articles available yet.
              </div>
            ) : (
              <div className="flex gap-6 sm:gap-7 md:gap-8" style={{ minWidth: "min-content" }}>
                {articles.map((article) => (
                  <ArticleCard
                    key={article.id}
                    id={article.id}
                    image={article.image}
                    title={article.title}
                    description={article.excerpt}
                    authorLogo="/Nav/Logo.PNG"
                    authorName={article.authorName}
                    date={article.date}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export default Article;
