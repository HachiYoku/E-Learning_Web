import { apiClient } from "../api/client";

function stripHtml(html = "") {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function buildExcerpt(content = "", maxLength = 140) {
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
    author: blog.createdBy?.name || "English Kafe",
    authorAvatar: blog.createdBy?.avatar || "",
    date: formatDate(blog.createdAt),
    createdBy: blog.createdBy || null,
  };
}

function buildBlogFormData(payload) {
  const formData = new FormData();

  formData.append("title", payload.title);
  formData.append("content", payload.content);

  if (payload.imageFile) {
    formData.append("image", payload.imageFile);
  } else if (payload.image) {
    formData.append("image", payload.image);
  }

  return formData;
}

export async function fetchBlogs() {
  const blogs = await apiClient.get("/blogs");
  return blogs.map(normalizeBlog);
}

export async function fetchBlogById(id) {
  const blog = await apiClient.get(`/blogs/${id}`);
  return normalizeBlog(blog);
}

export async function createBlog(payload) {
  const blog = await apiClient.post("/blogs", buildBlogFormData(payload));
  return normalizeBlog(blog);
}

export async function updateBlog(id, payload) {
  const blog = await apiClient.put(`/blogs/${id}`, buildBlogFormData(payload));
  return normalizeBlog(blog);
}

export async function deleteBlog(id) {
  return apiClient.delete(`/blogs/${id}`);
}
