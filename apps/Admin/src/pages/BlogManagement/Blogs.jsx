import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import BlogCard from "../../components/BlogCard";
import ConfirmationModal from "../../components/ConfirmationModal";
import { deleteBlog, fetchBlogs } from "../../services/blogService";

function Blogs() {
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [blogToDelete, setBlogToDelete] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadBlogs() {
      try {
        setIsLoading(true);
        setError("");
        const data = await fetchBlogs();

        if (isMounted) {
          setBlogs(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || "Failed to load blogs");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadBlogs();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDeleteClick = (id) => {
    setBlogToDelete(id);
    setShowConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    if (!blogToDelete) {
      return;
    }

    try {
      await deleteBlog(blogToDelete);
      setBlogs((currentBlogs) => currentBlogs.filter((blog) => blog.id !== blogToDelete));
      setError("");
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete blog");
    } finally {
      setShowConfirmation(false);
      setBlogToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowConfirmation(false);
    setBlogToDelete(null);
  };

  const handleEdit = (id) => {
    navigate(`/blog/edit/${id}`);
  };

  return (
    <div className="min-h-screen bg-[#FFFDF8] p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C97112] sm:text-xs">Content library</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#2D2E30] sm:text-3xl md:text-4xl">Manage blog</h1>
          <p className="mt-2 text-sm text-[#765F55] sm:text-base">Share useful stories, language tips, and updates with your students.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/blog/add")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D2E30] px-4 py-3 text-sm font-bold text-white shadow-md shadow-[#2D2E30]/15 transition-all hover:-translate-y-0.5 hover:bg-[#E58C1A] focus:outline-none focus:ring-2 focus:ring-[#E58C1A] focus:ring-offset-2 sm:w-auto sm:text-base"
        >
          <Plus size={18} className="sm:h-5 sm:w-5" />
          Add Blog
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-[#2D2E30]/10 bg-white p-8 text-center text-[#765F55] shadow-sm">Loading blogs...</div>
      ) : blogs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E58C1A]/35 bg-[#FFF9EA] p-8 text-center text-[#765F55] sm:p-12">
          <p className="text-lg font-bold text-[#2D2E30]">No blog posts yet</p>
          <p className="mt-2 text-sm">Add your first one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {blogs.map((blog) => (
            <BlogCard key={blog.id} blog={blog} onDelete={handleDeleteClick} onEdit={handleEdit} />
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={showConfirmation}
        title="Delete Blog"
        message="Are you sure you want to delete this blog post? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDangerous
      />
    </div>
  );
}

export default Blogs;
