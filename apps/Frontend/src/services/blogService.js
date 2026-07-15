import { apiClient } from "../api/client";

function stripHtml(html = "") {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function buildExcerpt(content = "", maxLength = 180) {
  const text = stripHtml(content);

  if (!text) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString("en-GB");
}

export function normalizeBlog(blog) {
  if (!blog) {
    return null;
  }

  return {
    id: blog._id,
    title: blog.title || "",
    content: blog.content || "",
    excerpt: buildExcerpt(blog.content),
    image: blog.image || "",
    authorName: blog.createdBy?.name || "English Kafe",
    date: formatDate(blog.createdAt),
  };
}

export async function fetchBlogs() {
  const blogs = await apiClient.get("/blogs");
  return blogs.map(normalizeBlog);
}

export async function fetchBlogById(id) {
  const blog = await apiClient.get(`/blogs/${id}`);
  return normalizeBlog(blog);
}
