import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import RecentArticle from "../components/RecentArticle";
import ArticleCard from "../components/ArticleCard";
import ContactSection from "../components/ContactSection";
import Footer from "../components/Footer";
import LoadingSpinner from "../components/LoadingSpinner";
import { fetchBlogs } from "../services/blogService";
import { sanitizeHtmlContent } from "../utils/sanitizeHtmlContent";

const logo = "/Nav/Logo.PNG";
const fallbackImage =
  "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200&h=900&fit=crop";
const INSIGHTS_PER_PAGE = 6;

function Blog() {
  const [blogs, setBlogs] = useState([]);
  const [selectedBlogId, setSelectedBlogId] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let isMounted = true;

    async function loadBlogs() {
      try {
        setIsLoading(true);
        setError("");
        const data = await fetchBlogs();
        if (!isMounted) return;
        setBlogs(data);
        setSelectedBlogId(data[0]?.id || "");
      } catch (loadError) {
        if (isMounted) setError(loadError.message || "Failed to load blogs");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadBlogs();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    setIsExpanded(false);
    setCurrentPage(1);
  }, [selectedBlogId]);

  const featuredBlog = useMemo(() => {
    if (!blogs.length) return null;
    return blogs.find((blog) => blog.id === selectedBlogId) || blogs[0];
  }, [blogs, selectedBlogId]);

  const recentBlogs = useMemo(
    () => blogs.filter((blog) => blog.id !== featuredBlog?.id).slice(0, 4),
    [blogs, featuredBlog]
  );

  const insightBlogs = useMemo(
    () => blogs.filter((blog) => blog.id !== featuredBlog?.id),
    [blogs, featuredBlog]
  );

  const totalInsightPages = Math.max(1, Math.ceil(insightBlogs.length / INSIGHTS_PER_PAGE));

  const paginatedInsightBlogs = useMemo(() => {
    const startIndex = (currentPage - 1) * INSIGHTS_PER_PAGE;
    return insightBlogs.slice(startIndex, startIndex + INSIGHTS_PER_PAGE);
  }, [currentPage, insightBlogs]);

  useEffect(() => {
    if (currentPage > totalInsightPages) setCurrentPage(totalInsightPages);
  }, [currentPage, totalInsightPages]);

  const selectBlog = (id) => {
    setSelectedBlogId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Featured Blog Section */}
      <div className="bg-gray-50 px-4 sm:px-6 md:px-10 py-8 sm:py-10 md:py-12">
        <div className="mx-auto max-w-7xl">

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <LoadingSpinner message="Loading blog posts..." />
          ) : !featuredBlog ? (
            <div className="rounded-2xl bg-white p-10 text-center text-gray-600 shadow-sm">
              No blog posts available yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3 overflow-hidden">

              {/* Featured Article */}
              <div className="md:col-span-2 min-w-0 overflow-hidden">
                <h1 className="mb-4 sm:mb-6 text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-snug break-words overflow-wrap-break-word">
                  {featuredBlog.title}
                </h1>

                <p className="mb-5 sm:mb-8 text-sm sm:text-base md:text-lg leading-relaxed text-gray-600 break-words">
                  {featuredBlog.excerpt}
                </p>

                {isExpanded ? (
                  <div
                    className="blog-content mb-6 sm:mb-8 max-w-full overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(featuredBlog.content) }}
                  />
                ) : null}

                {/* Author + Read More row */}
                <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={logo}
                      alt="mindployenglish"
                      className="border-2 border-[#F5C6D8] rounded-xl h-12 sm:h-14 w-auto"
                    />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">
                        {featuredBlog.authorName}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600">{featuredBlog.date}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsExpanded((current) => !current)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#F8B2C0] px-5 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-gray-900 transition-colors hover:bg-[#F8C2C0] w-full sm:w-auto"
                  >
                    {isExpanded ? "Read Less" : "Read More"}
                    <span>{isExpanded ? "↑" : "↓"}</span>
                  </button>
                </div>

                {/* Featured Image */}
                <div>
                  <img
                    src={featuredBlog.image || fallbackImage}
                    alt={featuredBlog.title}
                    className="w-full h-48 sm:h-64 md:h-80 lg:h-96 rounded-2xl object-cover"
                  />
                </div>
              </div>

              {/* Recent Articles Sidebar */}
              <div className="md:col-span-1 mt-2 md:mt-5">
                <h2 className="mb-3 sm:mb-4 text-base sm:text-lg font-bold text-gray-900">Recents</h2>
                <div className="space-y-2">
                  {recentBlogs.map((blog) => (
                    <RecentArticle
                      key={blog.id}
                      title={blog.title}
                      description={blog.excerpt}
                      authorName={blog.authorName}
                      date={blog.date}
                      onReadMore={() => selectBlog(blog.id)}
                    />
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Insights Section */}
      <div className="bg-blue-50 px-4 sm:px-6 md:px-10 py-8 sm:py-10 md:py-12">
        <div className="mx-auto max-w-7xl">

          <div className="mb-8 sm:mb-10 md:mb-12 text-center">
            <h2 className="mb-4 sm:mb-6 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900">
              English Learning Insights
            </h2>
            <div className="mx-auto h-1.5 sm:h-2 w-36 sm:w-52 bg-black rounded-full" />
          </div>

          {isLoading ? (
            <LoadingSpinner message="Loading more articles..." />
          ) : insightBlogs.length ? (
            <div className="mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 justify-items-center gap-4 sm:gap-6">
                {paginatedInsightBlogs.map((blog) => (
                  <ArticleCard
                    key={blog.id}
                    id={blog.id}
                    image={blog.image}
                    title={blog.title}
                    description={blog.excerpt}
                    authorName={blog.authorName}
                    date={blog.date}
                    onReadMore={selectBlog}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalInsightPages > 1 ? (
                <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                    disabled={currentPage === 1}
                    className="rounded-full border border-gray-300 px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalInsightPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full text-xs sm:text-sm font-semibold transition ${
                        currentPage === page
                          ? "bg-[#F8B2C0] text-gray-900"
                          : "border border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                      aria-label={`Go to page ${page}`}
                      aria-current={currentPage === page ? "page" : undefined}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(page + 1, totalInsightPages))}
                    disabled={currentPage === totalInsightPages}
                    className="rounded-full border border-gray-300 px-4 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-10 text-center text-gray-600 shadow-sm">
              More articles will appear here once blogs are published.
            </div>
          )}

        </div>
      </div>

      <ContactSection />
      <Footer />

      <style>{`
        .blog-content {
          color: #374151;
          font-size: 1rem;
          line-height: 1.75;
          max-width: 100%;
          overflow: hidden;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .blog-content * {
          max-width: 100%;
          box-sizing: border-box;
        }
        .blog-content > * + * { margin-top: 1rem; }
        .blog-content h1, .blog-content h2,
        .blog-content h3, .blog-content h4 {
          color: #111827;
          font-weight: 700;
          line-height: 1.25;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .blog-content h1 { font-size: 2rem; }
        .blog-content h2 { font-size: 1.75rem; }
        .blog-content h3 { font-size: 1.5rem; }
        .blog-content p {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .blog-content blockquote {
          margin: 1.5rem 0;
          border-left: 4px solid #f472b6;
          padding: 0.25rem 0 0.25rem 1rem;
          color: #6b7280;
          font-style: italic;
          background: #fdf2f8;
          border-radius: 0 0.75rem 0.75rem 0;
          overflow: hidden;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .blog-content a {
          color: #2563eb;
          text-decoration: underline;
          text-underline-offset: 2px;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .blog-content ul, .blog-content ol { 
          padding-left: 1.5rem;
          max-width: 100%;
        }
        .blog-content ul { list-style: disc; }
        .blog-content ol { list-style: decimal; }
        .blog-content img {
          max-width: 100%;
          height: auto;
          display: block;
        }
        .blog-content table {
          max-width: 100%;
          overflow-x: auto;
          display: block;
        }
      `}</style>
    </div>
  );
}

export default Blog;
