import { Trash2, Edit2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function BlogCard({ blog, onDelete, onEdit }) {
  const navigate = useNavigate()
  const image = blog.image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=900&h=600&fit=crop'
  const authorAvatar = blog.authorAvatar || 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=80&h=80&fit=crop'

  const handleEdit = () => {
    navigate(`/blog/edit/${blog.id}`)
  }

  const handleDelete = () => {
    onDelete(blog.id)
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-[#2D2E30]/10 bg-white shadow-[0_12px_30px_-24px_rgba(45,46,48,0.55)] transition-all hover:-translate-y-1 hover:border-[#E58C1A]/35 hover:shadow-[0_20px_38px_-24px_rgba(201,113,18,0.4)]">
      {/* Blog Image */}
      <div className="relative h-40 w-full overflow-hidden bg-[#FFF1CE] sm:h-44">
        <img
          src={image}
          alt={blog.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#2D2E30]/45 to-transparent" aria-hidden="true" />
      </div>

      {/* Blog Content */}
      <div className="p-4 sm:p-5">
        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-base font-bold text-[#2D2E30] sm:text-lg">
          {blog.title}
        </h3>

        {/* Excerpt */}
        <p className="mb-4 line-clamp-2 text-xs leading-5 text-[#765F55] sm:text-sm sm:leading-6">
          {blog.excerpt}
        </p>

        {/* Footer with Author, Date and Actions */}
        <div className="flex items-center justify-between gap-2 border-t border-[#2D2E30]/10 pt-3">
          {/* Author Logo and Date */}
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={authorAvatar}
              alt={blog.author}
              className="h-7 w-7 shrink-0 rounded-full border border-[#E58C1A]/25 object-cover sm:h-8 sm:w-8"
            />
            <div className="flex flex-col gap-0 min-w-0">
              <span className="truncate text-xs font-bold text-[#2D2E30]">{blog.author}</span>
              <span className="text-xs text-[#765F55]">{blog.date}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={handleEdit}
              className="flex items-center justify-center rounded-lg bg-[#FFF9EA] p-2 text-[#C97112] transition-colors hover:bg-[#FFF1CE]"
              title="Edit blog"
            >
              <Edit2 size={13} className="sm:w-[14px] sm:h-[14px]" />
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center justify-center rounded-lg bg-[#FFF0EE] p-2 text-[#A34D45] transition-colors hover:bg-[#FFE1DD]"
              title="Delete blog"
            >
              <Trash2 size={13} className="sm:w-[14px] sm:h-[14px]" />
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default BlogCard
