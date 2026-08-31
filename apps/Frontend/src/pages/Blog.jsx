import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, PenLine, Quote } from "lucide-react";
import Navbar from "../components/Navbar";
import ArticleCard from "../components/ArticleCard";
import ContactSection from "../components/ContactSection";
import Footer from "../components/Footer";
import LoadingSpinner from "../components/LoadingSpinner";
import { fetchBlogs } from "../services/blogService";
import { sanitizeHtmlContent } from "../utils/sanitizeHtmlContent";

const logo = "/Nav/favicon-arunthai.png"; // Default author logo if none is provided
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
  const moreToReadRef = useRef(null);

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

  const featuredBlog = useMemo(() => {
    if (!blogs.length) return null;
    return blogs.find((blog) => blog.id === selectedBlogId) || blogs[0];
  }, [blogs, selectedBlogId]);

  const insightBlogs = useMemo(
    () => blogs.filter((blog) => blog.id !== featuredBlog?.id),
    [blogs, featuredBlog]
  );

  const totalInsightPages = Math.max(1, Math.ceil(insightBlogs.length / INSIGHTS_PER_PAGE));
  const activePage = Math.min(currentPage, totalInsightPages);

  const paginatedInsightBlogs = useMemo(() => {
    const startIndex = (activePage - 1) * INSIGHTS_PER_PAGE;
    return insightBlogs.slice(startIndex, startIndex + INSIGHTS_PER_PAGE);
  }, [activePage, insightBlogs]);

  const selectBlog = (id) => {
    setSelectedBlogId(id);
    setIsExpanded(false);
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeInsightPage = (page) => {
    setCurrentPage(page);
    window.requestAnimationFrame(() => {
      const section = moreToReadRef.current;
      if (!section) return;
      const navbarOffset = 80;
      const sectionTop = section.getBoundingClientRect().top + window.scrollY - navbarOffset;
      window.scrollTo({ top: Math.max(0, sectionTop), behavior: "smooth" });
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      

      {/* Featured Blog Section */}
      <section className="bg-white px-4 py-14 sm:px-6 sm:py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between border-b-2 border-[#2D2E30] pb-4 sm:mb-10">
            <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Editor’s pick</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl">Featured story</h2></div>
            {!isLoading && blogs.length > 0 ? <p className="hidden text-sm font-medium text-[#765F55] sm:block">Issue 01 · {blogs.length} stories</p> : null}
          </div>

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
            <article className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">

              {/* Featured Article */}
              <div className="order-2 min-w-0 overflow-hidden lg:order-1">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Featured story · {featuredBlog.date}</p>
                <h3 className="mb-4 text-3xl font-bold leading-[1.05] tracking-tight text-[#2D2E30] sm:mb-5 sm:text-4xl md:text-5xl break-words overflow-wrap-break-word">
                  {featuredBlog.title}
                </h3>

                <p className="mb-6 text-sm leading-relaxed text-[#765F55] sm:text-base md:text-lg break-words">
                  {featuredBlog.excerpt}
                </p>

                {isExpanded ? (
                  <div
                    className="blog-content mb-6 sm:mb-8 max-w-full overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(featuredBlog.content) }}
                  />
                ) : null}

                {/* Author + Read More row */}
                <div className="mb-6 flex flex-col justify-between gap-4 border-y border-[#2D2E30]/10 py-4 sm:mb-8 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <img
                      src={logo}
                      alt="thaitalktips"
                      className="h-11 w-11 rounded-full border border-[#E58C1A]/20 object-contain p-1"
                    />
                    <div>
                      <p className="text-sm font-semibold text-[#2D2E30] sm:text-base">
                        {featuredBlog.authorName}
                      </p>
                      <p className="text-xs text-[#8B6F61] sm:text-sm">{featuredBlog.date}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsExpanded((current) => !current)}
                    className="flex w-full items-center justify-center gap-2 rounded-none border-b-2 border-[#E58C1A] bg-transparent px-2 py-3 text-sm font-bold uppercase tracking-[0.16em] text-[#2D2E30] transition hover:bg-[#FFF1D0] sm:w-auto"
                  >
                    {isExpanded ? "Read Less" : "Read More"}
                    <span>{isExpanded ? "↑" : "↓"}</span>
                  </button>
                </div>

              </div>

              <div className="order-1 relative lg:order-2">
                <div className="absolute -right-3 -top-3 h-full w-full border border-[#E58C1A]/40 sm:-right-5 sm:-top-5" aria-hidden="true" />
                <img
                  src={featuredBlog.image || fallbackImage}
                  alt={featuredBlog.title}
                  className="relative h-64 w-full object-cover sm:h-80 lg:h-[32rem]"
                />
                <div className="absolute bottom-0 left-0 bg-[#2D2E30] px-5 py-4 text-sm font-medium leading-relaxed text-white sm:max-w-[85%]">
                  A practical note from the Arun Thai Journal.
                </div>
              </div>

            </article>
          )}
        </div>
      </section>

      {/* Insights Section */}
      <section ref={moreToReadRef} className="scroll-mt-20 bg-[#E9EEF0] px-4 py-14 sm:px-6 sm:py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-7xl">

          <div className="mb-8 border-b border-[#2D2E30]/20 pb-6 sm:mb-10 md:mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">Browse the journal</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl md:text-5xl">
              More to read
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#536166] sm:text-base">New ideas, useful words, and friendly perspectives for your Thai learning journey.</p>
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
                <nav className="mt-10 flex flex-wrap items-center justify-center gap-2 sm:mt-12 sm:gap-3" aria-label="Blog pages">
                  <button
                    type="button"
                    onClick={() => changeInsightPage(Math.max(activePage - 1, 1))}
                    disabled={activePage === 1}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2D2E30] shadow-sm transition hover:border-[#E58C1A] hover:text-[#C97112] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Previous</span>
                  </button>

                  {Array.from({ length: totalInsightPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => changeInsightPage(page)}
                      className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full text-xs sm:text-sm font-semibold transition ${
                        activePage === page
                          ? "bg-[#E58C1A] text-white shadow-md shadow-[#E58C1A]/25"
                          : "border border-[#2D2E30]/15 bg-white text-[#765F55] hover:border-[#E58C1A] hover:text-[#C97112]"
                      }`}
                      aria-label={`Go to page ${page}`}
                      aria-current={activePage === page ? "page" : undefined}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => changeInsightPage(Math.min(activePage + 1, totalInsightPages))}
                    disabled={activePage === totalInsightPages}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#2D2E30]/15 transition hover:bg-[#E58C1A] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="hidden sm:inline">Next</span><ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </nav>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-10 text-center text-gray-600 shadow-sm">
              More articles will appear here once blogs are published.
            </div>
          )}

        </div>
      </section>

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
