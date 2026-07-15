import { apiClient } from "../api/client";

export const coursesData = [
  {
    id: 1,
    image: '/src/assets/courses/IELTS speaking.jpg',
    title: 'IELTS SPEAKING',
    description: 'Build confidence with guided speaking practice and real exam-style questions.',
    price: '3000 ฿',
    rating: 4.5,
    reviews: 1500,
    lessons: 23,
    fullDescription: 'Build confidence with guided speaking practice and real exam-style questions.'
  },
  {
    id: 2,
    image: '/src/assets/courses/ielts writing.jpg',
    title: 'IELTS WRITING',
    description: 'Clear structure, grammar guidance, and scoring strategies for stronger essays.',
    price: '4500 ฿',
    rating: 4.5,
    reviews: 1500,
    lessons: 20,
    fullDescription: 'Master IELTS writing with comprehensive guidance on essay structure, grammar, and scoring strategies.'
  },
  {
    id: 3,
    image: '/src/assets/courses/daily english.jpg',
    title: 'EVERYDAY ENGLISH',
    description: 'Practice real-life conversations and vocabulary for daily communication.',
    price: '3500 ฿',
    rating: 4.5,
    reviews: 1500,
    lessons: 25,
    fullDescription: 'Learn practical English for everyday situations with real-world conversation practice and vocabulary.'
  },
  {
    id: 4,
    image: '/src/assets/courses/grammer.jpg',
    title: 'GRAMMAR ESSENTIALS',
    description: 'Understand grammar simply and apply it confidently in speaking and writing.',
    price: '2500 ฿',
    rating: 4.5,
    reviews: 1500,
    lessons: 23,
    fullDescription: 'This course breaks down core grammar rules into practical lessons you can use in everyday communication.'
  },
  {
    id: 5,
    image: '/src/assets/courses/master communation.jpg',
    title: 'MASTER ENGLISH COMMUNICATION',
    description: 'Build confidence in real-life conversations through guided video lessons focused on practical communication.',
    price: '5500 ฿',
    rating: 4.5,
    reviews: 1500,
    lessons: 30,
    fullDescription: 'Build confidence in real-life conversations through guided video lessons focused on practical communication skills.'
  }
];

export function normalizeCourse(course) {
  if (!course) {
    return null;
  }

  return {
    id: course._id,
    title: course.title,
    description: course.description || "",
    fullDescription: course.description || "",
    price: `${Number(course.price || 0).toLocaleString()} ฿`,
    priceValue: Number(course.price || 0),
    rating: Number(course.rating || 0),
    reviews: Number(course.reviews || 0),
    lessons: Number(course.lessonCount || 0),
    image: course.thumbnail || "",
    paymentQr: course.paymentQr || "",
    features: Array.isArray(course.features) ? course.features : [],
    isPublished: Boolean(course.isPublished),
  };
}

export async function fetchCourses() {
  const courses = await apiClient.get("/courses");
  return courses.map(normalizeCourse);
}

export async function fetchCourseById(id) {
  const course = await apiClient.get(`/courses/${id}`);
  return normalizeCourse(course);
}

export function getAllCourses() {
  return coursesData;
}

export function getCourseById(id) {
  return coursesData.find((course) => course.id === id || String(course.id) === String(id));
}

export function getCoursesByPage(page, itemsPerPage = 6) {
  const startIndex = (page - 1) * itemsPerPage;
  return coursesData.slice(startIndex, startIndex + itemsPerPage);
}

export function getTotalPages(itemsPerPage = 6) {
  return Math.ceil(coursesData.length / itemsPerPage);
}
