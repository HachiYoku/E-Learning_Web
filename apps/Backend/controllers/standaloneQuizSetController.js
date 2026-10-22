const mongoose = require("mongoose");
const QuizSet = require("../models/quizSetModel");
const Quiz = require("../models/quizModel");
const { publicSummary } = require("../services/standaloneQuizRevisions");
const service = require("../services/standaloneQuizSets");
const covers = require("../services/quizSetCoverService");

function errorResponse(res, error) {
  if ([400, 404, 409, 503].includes(error?.status) && typeof error.code === "string") {
    return res.status(error.status).json({ message: error.message, code: error.code });
  }
  console.error("Quiz Set request failed", { name: error?.name });
  return res.status(500).json({ message: "Unable to process the Quiz Set request." });
}

const handle = (fn, created = false) => async (req, res) => {
  try { return res.status(created ? 201 : 200).json(await fn(req)); }
  catch (error) { return errorResponse(res, error); }
};

function adminSet(set) {
  return { ...service.publicSet(set), status: set.status, version: set.version,
    runtimeEpoch: set.runtimeEpoch, createdAt: set.createdAt, updatedAt: set.updatedAt };
}

const listAdmin = handle(async () => ({ sets: (await QuizSet.find({}).sort({ displayOrder: 1, _id: 1 }).lean()).map(adminSet) }));
const getAdmin = handle(async (req) => {
  if (!mongoose.isValidObjectId(req.params.setId)) throw new service.QuizSetError(404, "Quiz Set is unavailable.", "quiz_set_unavailable");
  const set = await QuizSet.findById(req.params.setId).lean();
  if (!set) throw new service.QuizSetError(404, "Quiz Set is unavailable.", "quiz_set_unavailable");
  const quizzes = await Quiz.find({ quizSet: set._id, contextType: "standalone" })
    .select("title status sortOrder publishedRevision draft.version revision standaloneAccess category difficulty")
    .sort({ sortOrder: 1, _id: 1 }).lean();
  return { set: adminSet(set), quizzes: quizzes.map((quiz) => ({ id: String(quiz._id), title: quiz.title,
    status: quiz.status, sortOrder: quiz.sortOrder, publishedRevision: quiz.publishedRevision,
    draftVersion: quiz.draft?.version || null, revision: quiz.revision,
    standaloneAccess: quiz.standaloneAccess, category: quiz.category, difficulty: quiz.difficulty })) };
});
const create = handle(async (req) => ({ set: adminSet(await service.createSet(req.body)) }), true);
const update = handle(async (req) => ({ set: adminSet(await service.updateSet(req.params.setId,
  req.body?.expectedVersion, req.body?.set)) }));
const uploadCover = handle(async (req) => {
  const result = await covers.uploadCover(req.params.setId, req.body?.expectedVersion, req.file);
  return { set: adminSet(result.set), mediaCleanup: result.cleanup };
});
const removeCover = handle(async (req) => {
  const result = await covers.removeCover(req.params.setId, req.body?.expectedVersion);
  return { set: adminSet(result.set), mediaCleanup: result.cleanup };
});
const lifecycle = (action) => handle(async (req) => ({ set: adminSet(await service.transitionSet(
  req.params.setId, req.body?.expectedVersion, action)) }));
const orderQuiz = handle(async (req) => {
  const { quiz, setVersion } = await service.orderQuiz(req.params.setId, req.params.quizId,
    req.body?.expectedVersion, req.body?.sortOrder);
  return { id: String(quiz._id), quizSetId: String(quiz.quizSet), sortOrder: quiz.sortOrder,
    setVersion };
});
const createDraft = handle(async (req) => service.createIdempotentSetDraft(req.params.setId,
  req.user.id, req.body?.creationRequestId, req.body?.draft), true);
const remove = handle(async (req) => service.deleteEmptySet(req.params.setId, req.body?.expectedVersion));

function catalogParams(query) {
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (query.limit !== undefined && (typeof query.limit !== "string" || !/^[1-9]\d*$/.test(query.limit))) {
    throw new service.QuizSetError(400, "Invalid page limit.", "invalid_page");
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) throw new service.QuizSetError(400, "limit must be between 1 and 20.", "invalid_page");
  const name = query.name === undefined ? "" : query.name;
  if (typeof name !== "string" || name.length > 100) throw new service.QuizSetError(400, "Invalid name search.", "invalid_page");
  const difficulty = query.difficulty;
  if (difficulty !== undefined && !QuizSet.QUIZ_SET_DIFFICULTIES.includes(difficulty)) {
    throw new service.QuizSetError(400, "Invalid difficulty.", "invalid_page");
  }
  let cursor = null;
  if (query.after !== undefined) {
    if (typeof query.after !== "string" || query.after.length > 128) {
      throw new service.QuizSetError(400, "Invalid page cursor.", "invalid_page");
    }
    try {
      const decoded = JSON.parse(Buffer.from(query.after, "base64url").toString("utf8"));
      if (!Number.isSafeInteger(decoded.order) || decoded.order < 1 || typeof decoded.id !== "string"
        || !/^[0-9a-f]{24}$/i.test(decoded.id)) throw new Error();
      cursor = decoded;
    } catch (_error) { throw new service.QuizSetError(400, "Invalid page cursor.", "invalid_page"); }
  }
  return { limit, name: name.trim(), difficulty, cursor };
}

const listPublic = handle(async (req) => {
  const { limit, name, difficulty, cursor } = catalogParams(req.query);
  const filter = { status: "active" };
  if (name) filter.name = { $regex: name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  if (difficulty) filter.difficulty = difficulty;
  if (cursor) filter.$or = [{ displayOrder: { $gt: cursor.order } },
    { displayOrder: cursor.order, _id: { $gt: new mongoose.Types.ObjectId(cursor.id) } }];
  const rows = await QuizSet.find(filter).sort({ displayOrder: 1, _id: 1 }).limit(limit + 1).lean();
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return { sets: page.map(service.publicSet), pageSize: limit,
    nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ order: last.displayOrder,
      id: String(last._id) })).toString("base64url") : null };
});

const getPublic = handle(async (req) => {
  if (!mongoose.isValidObjectId(req.params.setId)) throw new service.QuizSetError(404, "Quiz Set is unavailable.", "quiz_set_unavailable");
  const set = await QuizSet.findOne({ _id: req.params.setId, status: "active" }).lean();
  if (!set) throw new service.QuizSetError(404, "Quiz Set is unavailable.", "quiz_set_unavailable");
  const quizzes = await Quiz.find({ quizSet: set._id, contextType: "standalone", status: "published",
    publishedRevision: { $type: "number" }, standaloneAccess: { $in: ["public", "students"] } })
    .select("title description category difficulty standaloneAccess publishedRevision sortOrder")
    .sort({ sortOrder: 1, _id: 1 }).lean();
  return { set: service.publicSet(set), quizzes: quizzes.map((quiz) => ({ ...publicSummary(quiz), sortOrder: quiz.sortOrder })) };
});

module.exports = { listAdmin, getAdmin, create, update, uploadCover, removeCover, lifecycle, orderQuiz, createDraft, remove,
  listPublic, getPublic };
