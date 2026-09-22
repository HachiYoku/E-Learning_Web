const assert = require("node:assert/strict");
const { test } = require("node:test");
const mongoose = require("mongoose");
const Notification = require("../models/notificationModel");
const Announcement = require("../models/announcementModel");
const { broadcastNotificationToAllUsers } = require("../controllers/notificationController");
const { normalizeNotificationLink } = require("../services/notificationLinkValidator");

test("notification links accept supported internal application routes", () => {
  const cases = [
    ["/courses", "/courses"],
    ["/courses/65b9c4d8", "/courses/65b9c4d8"],
    ["/my-courses", "/my-courses"],
    ["/profile", "/app/profile"],
    ["/app/learn/course_123/quiz/lesson-456", "/app/learn/course_123/quiz/lesson-456"],
    ["/course-lessons/course-123", "/course-lessons/course-123"],
    ["/practice/thai-vowels?level=beginner#exercise", "/practice/thai-vowels?level=beginner#exercise"],
  ];

  for (const [input, expected] of cases) assert.equal(normalizeNotificationLink(input), expected);
});

test("notification links reject external schemes, protocol-relative URLs, malformed values, and encoding bypasses", () => {
  const unsafeValues = [
    "https://evil.example/phish",
    "http://evil.example",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "//evil.example/path",
    "/%2f%2fevil.example/path",
    "/%252f%252fevil.example/path",
    "/%5c%5cevil.example/path",
    "%2f%2fevil.example/path",
    "/courses/%",
    "/not-a-real-route",
    "\\\\evil.example/path",
    "/courses/abc\nSet-Cookie: injected",
    { path: "/courses" },
  ];

  for (const value of unsafeValues) {
    assert.throws(() => normalizeNotificationLink(value));
  }
});

test("notification and announcement schemas reject unsafe links before persistence", async () => {
  const userId = new mongoose.Types.ObjectId();
  const notification = new Notification({ userId, title: "Unsafe", message: "Unsafe", link: "javascript:alert(1)" });
  const announcement = new Announcement({ title: "Unsafe", message: "Unsafe", link: "//evil.example", createdBy: userId });

  await assert.rejects(notification.validate(), /Notification link must be a supported internal application path/);
  await assert.rejects(announcement.validate(), /Announcement link must be a supported internal application path/);
});

test("broadcast endpoint returns 400 for an unsafe link before it attempts storage", async () => {
  const response = {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await broadcastNotificationToAllUsers({
    body: { title: "Unsafe", message: "Unsafe", link: "data:text/html,boom" },
    user: { id: new mongoose.Types.ObjectId().toString() },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /internal application path/);
});
