const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const StudentFeedback = require("../models/studentFeedbackModel");
const { getTestimonials } = require("../controllers/testimonialController");

const originalFind = StudentFeedback.find;
function response() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } }; }
function record({ id = "a", name = "Htet Linn Aung", avatar, preference = "first_name", allowProfileImage = false, quote = "The exact student feedback remains unchanged.", publishedAt = new Date("2026-01-01") } = {}) { return { _id: id, originalFeedback: quote, studentId: name ? { name, avatar } : null, publicationConsent: { status: "permitted", namePreference: preference, allowProfileImage, permittedAt: new Date() }, publication: { status: "published", publishedAt, reviewedBy: "admin" }, courseId: "course-private-field" }; }
function mockFind(records, observed) { StudentFeedback.find = (query) => { observed.query = query; return { select(fields) { observed.fields = fields; return this; }, sort(sort) { observed.sort = sort; return this; }, limit(limit) { observed.limit = limit; return this; }, populate() { return this; }, lean: async () => records }; }; }
afterEach(() => { StudentFeedback.find = originalFind; });

test("public testimonials require no authentication and use both current eligibility conditions", async () => {
  const observed = {}; mockFind([record()], observed); const res = response(); await getTestimonials({ query: {} }, res);
  assert.equal(res.statusCode, 200); assert.deepEqual(observed.query, { "publicationConsent.status": "permitted", "publication.status": "published" }); assert.equal(observed.fields, "_id originalFeedback studentId publicationConsent.namePreference publicationConsent.allowProfileImage"); assert.equal(observed.limit, 6); assert.deepEqual(observed.sort, { "publication.publishedAt": -1, _id: -1 });
});

test("returns only the explicit public DTO with exact feedback and derived names", async () => {
  mockFind([record(), record({ id: "b", name: "Private Account Name", preference: "anonymous" })], {}); const res = response(); await getTestimonials({ query: {} }, res);
  assert.deepEqual(res.body.testimonials, [{ id: "a", quote: "The exact student feedback remains unchanged.", displayName: "Htet", profileImage: null }, { id: "b", quote: "The exact student feedback remains unchanged.", displayName: "Anonymous learner", profileImage: null }]);
  for (const item of res.body.testimonials) for (const field of ["studentId", "email", "courseId", "namePreference", "publicationConsent", "publication", "reviewedBy"]) assert.equal(Object.hasOwn(item, field), false);
});

test("uses a bounded validated public limit", async () => {
  const observed = {}; mockFind([record()], observed); const res = response(); await getTestimonials({ query: { limit: "12" } }, res); assert.equal(res.statusCode, 200); assert.equal(observed.limit, 12);
  for (const limit of ["0", "13", "nope"]) { const invalid = response(); await getTestimonials({ query: { limit } }, invalid); assert.equal(invalid.statusCode, 400); }
});

test("returns a profile image only for explicit first-name photo consent and never leaks the avatar field", async () => {
  mockFind([
    record({ id: "allowed", avatar: "https://cdn.example.test/allowed.jpg", allowProfileImage: true }),
    record({ id: "not-allowed", avatar: "https://cdn.example.test/private.jpg" }),
    record({ id: "anonymous", avatar: "https://cdn.example.test/anonymous.jpg", preference: "anonymous", allowProfileImage: true }),
    record({ id: "no-avatar", allowProfileImage: true }),
  ], {});
  const res = response();
  await getTestimonials({ query: {} }, res);
  assert.deepEqual(
    res.body.testimonials.map(({ id, profileImage }) => ({ id, profileImage })),
    [
      { id: "allowed", profileImage: "https://cdn.example.test/allowed.jpg" },
      { id: "not-allowed", profileImage: null },
      { id: "anonymous", profileImage: null },
      { id: "no-avatar", profileImage: null },
    ]
  );
  for (const item of res.body.testimonials) assert.equal(Object.hasOwn(item, "avatar"), false);
});

test("omits unavailable/deleted students and returns no testimonial after withdrawal", async () => {
  mockFind([record({ name: null })], {}); const missing = response(); await getTestimonials({ query: {} }, missing); assert.deepEqual(missing.body.testimonials, []);
  mockFind([], {}); const withdrawn = response(); await getTestimonials({ query: {} }, withdrawn); assert.deepEqual(withdrawn.body.testimonials, []);
});
