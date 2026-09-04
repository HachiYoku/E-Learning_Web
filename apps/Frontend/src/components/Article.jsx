import { ArrowRight, PenLine, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArticleCard from "./ArticleCard";
import LoadingSpinner from "./LoadingSpinner";
import { fetchBlogs } from "../services/blogService";

function Article() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadArticles() {
      try {
        setIsLoading(true);
        setError("");
        const blogs = await fetchBlogs();
        if (isMounted) setArticles(blogs.slice(0, 3));
      } catch (loadError) {
        if (isMounted) setError(loadError.message || "Failed to load articles");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadArticles();
    return () => { isMounted = false; };
  }, [loadVersion]);

  const retryLoadingArticles = () => {
    setError("");
    setIsLoading(true);
    setLoadVersion((current) => current + 1);
  };

  return (
    <section className="relative isolate overflow-hidden bg-[#FFF9EA] px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-16">
      <div className="absolute -left-28 top-12 -z-10 h-80 w-80 rounded-full bg-[#F8C56A]/18 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-32 -right-24 -z-10 h-96 w-96 rounded-full bg-[#E9A9A0]/18 blur-3xl" aria-hidden="true" />
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-6 border-b border-[#2D2E30]/12 pb-8 sm:pb-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C97112]">From our journal</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#2D2E30] sm:text-4xl md:text-5xl">
              Thai Learning <span className="text-[#E58C1A]">Insights.</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#765F55] sm:text-base md:text-lg">
              Practical tips, useful language notes, and encouragement for every stage of your Thai learning journey.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/blog")}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#2D2E30]/20 transition-all duration-300 hover:-translate-y-1 hover:bg-[#E58C1A] hover:shadow-xl"
          >
            Explore all articles <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-10 md:mt-12">
          {isLoading ? (
            <LoadingSpinner message="Loading articles..." />
          ) : error ? (
            <div className="mx-auto flex max-w-xl flex-col items-center rounded-[2rem] border border-[#2D2E30]/10 bg-white px-6 py-11 text-center shadow-[0_20px_50px_-36px_rgba(80,48,19,0.4)] sm:px-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1CE] text-[#C97112] shadow-sm"><RefreshCw className="h-6 w-6" aria-hidden="true" /></div>
              <h3 className="mt-6 text-2xl font-bold tracking-tight text-[#2D2E30]">We couldn’t load the insights</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-[#765F55]">Please check your connection and try again. Fresh Thai learning ideas will be here shortly.</p>
              <button type="button" onClick={retryLoadingArticles} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#E58C1A]"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button>
            </div>
          ) : articles.length === 0 ? (
            <div className="mx-auto flex max-w-xl flex-col items-center rounded-[2rem] border border-[#2D2E30]/10 bg-white/70 px-6 py-11 text-center shadow-[0_20px_50px_-36px_rgba(80,48,19,0.3)] sm:px-10"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF1CE] text-[#C97112]"><PenLine className="h-6 w-6" aria-hidden="true" /></div><h3 className="mt-6 text-2xl font-bold tracking-tight text-[#2D2E30]">New insights are on their way</h3><p className="mt-3 max-w-md text-sm leading-relaxed text-[#765F55]">We’re preparing more practical Thai tips and learning inspiration. Please check back soon.</p></div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
              {articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  id={article.id}
                  image={article.image}
                  title={article.title}
                  description={article.excerpt}
                  authorLogo="/Nav/favicon-arunthai.png"
                  authorName={article.authorName}
                  date={article.date}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Article;
