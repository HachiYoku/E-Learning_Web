const mongoose = require("mongoose");
const Quiz = require("../models/quizModel");
const QuizAttempt = require("../models/quizAttemptModel");
const QuizAttemptGrant = require("../models/quizAttemptGrantModel");
const QuizAttemptRequest = require("../models/quizAttemptRequestModel");
const Enrollment = require("../models/enrollmentModel");
const User = require("../models/userModel");
const { unavailableQuizError } = require("./quizAccessPolicy");

class QuizAttemptRequestError extends Error {
  constructor(status, message, code = "quiz_attempt_request_error") {
    super(message); this.status = status; this.code = code;
  }
}

function idOf(user) { return user?.id || user?._id || user; }
function validText(value, { required = false } = {}) {
  const text = String(value || "").trim();
  if (required && !text) throw new QuizAttemptRequestError(400, "A reason is required.", "request_reason_required");
  if (text.length > 500) throw new QuizAttemptRequestError(400, "Reason must be 500 characters or fewer.", "request_reason_too_long");
  return text;
}
function sessionQuery(query, session) { return session ? query.session(session) : query; }

async function loadStudentFinal({ quizId, userId, session }) {
  if (!mongoose.isValidObjectId(quizId)) throw unavailableQuizError();
  const quiz = await sessionQuery(Quiz.findById(quizId).select("title contextType status course maxAttempts"), session);
  if (!quiz || quiz.contextType !== "course_final" || quiz.status !== "published") throw unavailableQuizError();
  const enrollment = await sessionQuery(Enrollment.exists({ userId, courseId: quiz.course }), session);
  if (!enrollment) throw unavailableQuizError();
  return quiz;
}

async function allowance({ quiz, userId, session }) {
  const [attemptsUsed, grants] = await Promise.all([
    sessionQuery(QuizAttempt.countDocuments({ quiz: quiz._id, user: userId }), session),
    sessionQuery(QuizAttemptGrant.countDocuments({ quiz: quiz._id, user: userId }), session),
  ]);
  return { attemptsUsed, extraGrants: grants, effectiveMaxAttempts: (quiz.maxAttempts || 3) + grants };
}

function assertExhausted(state) {
  if (state.attemptsUsed < state.effectiveMaxAttempts) {
    throw new QuizAttemptRequestError(409, "An extra submission can only be requested after all available submissions are used.", "request_not_exhausted");
  }
}

async function createRequest({ quizId, user, reason }) {
  const userId = idOf(user);
  if (user?.role && user.role !== "user") throw unavailableQuizError();
  const cleanReason = validText(reason, { required: true });
  const quiz = await loadStudentFinal({ quizId, userId });
  assertExhausted(await allowance({ quiz, userId }));
  try {
    const request = await QuizAttemptRequest.create({ user: userId, quiz: quiz._id, course: quiz.course, reason: cleanReason });
    return { request, quiz, state: await allowance({ quiz, userId }) };
  } catch (error) {
    if (error?.code === 11000) throw new QuizAttemptRequestError(409, "You already have an extra-submission request awaiting review.", "request_pending_exists");
    throw error;
  }
}

async function listStudentRequests({ quizId, user }) {
  const userId = idOf(user);
  if (user?.role && user.role !== "user") throw unavailableQuizError();
  await loadStudentFinal({ quizId, userId });
  return QuizAttemptRequest.find({ quiz: quizId, user: userId })
    .select("reason status adminNote createdAt reviewedAt cancelledAt resultingGrant")
    .sort({ createdAt: -1 }).lean();
}

async function cancelRequest({ quizId, requestId, user }) {
  const userId = idOf(user);
  if (user?.role && user.role !== "user") throw unavailableQuizError();
  await loadStudentFinal({ quizId, userId });
  const request = await QuizAttemptRequest.findOneAndUpdate(
    { _id: requestId, quiz: quizId, user: userId, status: "pending" },
    { $set: { status: "cancelled", cancelledAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!request) throw new QuizAttemptRequestError(409, "This request can no longer be cancelled.", "request_not_pending");
  return request;
}

async function reviewRequest({ quizId, requestId, adminId, decision, note }) {
  const cleanNote = validText(note, { required: decision === "rejected" });
  if (!["approved", "rejected"].includes(decision)) throw new QuizAttemptRequestError(400, "Invalid request decision.");
  return mongoose.connection.transaction(async (session) => {
    const request = await QuizAttemptRequest.findOne({ _id: requestId, quiz: quizId, status: "pending" }).session(session);
    if (!request) throw new QuizAttemptRequestError(409, "This request has already been reviewed or cancelled.", "request_not_pending");
    const [quiz, student] = await Promise.all([
      Quiz.findById(quizId).select("title contextType status course maxAttempts").session(session),
      User.findOne({ _id: request.user, role: "user", isActive: true }).select("_id").session(session),
    ]);
    if (!quiz || quiz.contextType !== "course_final" || quiz.status !== "published" || String(quiz.course) !== String(request.course) || !student) {
      throw new QuizAttemptRequestError(409, "This request is no longer applicable.", "request_unavailable");
    }
    const enrollment = await Enrollment.exists({ userId: request.user, courseId: quiz.course }).session(session);
    if (!enrollment) throw new QuizAttemptRequestError(409, "This request is no longer applicable.", "request_unavailable");
    const now = new Date();
    if (decision === "rejected") {
      request.status = "rejected"; request.reviewedAt = now; request.reviewedBy = adminId; request.adminNote = cleanNote;
      await request.save({ session });
      return { request, quiz, state: await allowance({ quiz, userId: request.user, session }), decision: "rejected" };
    }
    const state = await allowance({ quiz, userId: request.user, session });
    if (state.attemptsUsed < state.effectiveMaxAttempts) {
      request.status = "superseded"; request.reviewedAt = now; request.reviewedBy = adminId; request.adminNote = "A submission was already made available before this request was reviewed.";
      await request.save({ session });
      return { request, quiz, state, decision: "superseded" };
    }
    const [grant] = await QuizAttemptGrant.create([{
      user: request.user, quiz: quiz._id, grantedBy: adminId, reason: cleanNote, source: "student_request", request: request._id,
    }], { session });
    request.status = "approved"; request.reviewedAt = now; request.reviewedBy = adminId; request.adminNote = cleanNote; request.resultingGrant = grant._id;
    await request.save({ session });
    return { request, grant, quiz, state: { ...state, extraGrants: state.extraGrants + 1, effectiveMaxAttempts: state.effectiveMaxAttempts + 1 }, decision: "approved" };
  });
}

module.exports = { QuizAttemptRequestError, allowance, createRequest, listStudentRequests, cancelRequest, reviewRequest };
