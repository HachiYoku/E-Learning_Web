// Package 2 index preflight. This file deliberately imports no application model
// and has no apply mode: it cannot create collections, indexes, or records.
const { MongoClient } = require("mongoose").mongo;
const { INDEXES, resolveDatabase, sameDefinition } = require("./prepareQuizIndexes");

// Mirror quizModel's standalone enums and question constraints without loading
// application models (which could initialize indexes on a connected Mongoose client).
const CATEGORIES = new Set(["Vocabulary", "Grammar", "Reading", "Listening", "Conversation"]);
const DIFFICULTIES = new Set(["Beginner", "Intermediate", "Advanced"]);
const ACCESS = new Set(["public", "students"]);
const STATUSES = new Set(["draft", "published", "disabled", "archived"]);
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REPORTED_RECORDS = 100;

const TARGETS = Object.freeze({
  quizsessions: ["one_active_standalone_session"],
  quizattempts: ["one_standalone_attempt_per_session"],
  quizratewindows: ["one_quiz_rate_window", "quiz_rate_window_expiry"],
});

function parseArgs(args) {
  if (!args.length || (args.length === 1 && args[0] === "--preflight")) return;
  throw new Error("Only read-only --preflight is supported. There is no apply mode.");
}

const positiveInteger = (value) => Number.isSafeInteger(value) && value >= 1;
const validDate = (value) => value instanceof Date && Number.isFinite(value.getTime());
const optionalText = (value, max) => value === undefined || value === null
  || (typeof value === "string" && value.trim().length <= max);

function questionProblems(questions, label) {
  const reasons = [];
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 10) {
    return [`${label}_question_count_invalid`];
  }
  questions.forEach((question, index) => {
    const field = `${label}_question_${index + 1}`;
    if (!question || typeof question !== "object" || Array.isArray(question)) {
      reasons.push(`${field}_malformed`);
      return;
    }
    if (!optionalText(question.prompt, 280) || !optionalText(question.imageAlt, 280)
      || !optionalText(question.audioLabel, 280) || !optionalText(question.explanation, 2000)
      || !optionalText(question.image, Infinity) || !optionalText(question.audio, Infinity)) {
      reasons.push(`${field}_text_malformed`);
    }
    if (![question.prompt, question.image, question.audio].some((value) => typeof value === "string" && value.trim())) {
      reasons.push(`${field}_content_missing`);
    }
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6
      || question.options.some((option) => typeof option !== "string" || !option.trim())) {
      reasons.push(`${field}_options_invalid`);
    }
    if (!Number.isInteger(question.correctAnswer) || question.correctAnswer < 0
      || !Array.isArray(question.options) || question.correctAnswer >= question.options.length) {
      reasons.push(`${field}_correct_answer_invalid`);
    }
  });
  return reasons;
}

function metadataProblems(value, label) {
  const reasons = [];
  if (typeof value?.title !== "string" || !value.title.trim() || value.title.trim().length > 140) reasons.push(`${label}_title_invalid`);
  if (!optionalText(value?.description, 1000)) reasons.push(`${label}_description_invalid`);
  if (!CATEGORIES.has(value?.category)) reasons.push(`${label}_category_invalid`);
  if (!DIFFICULTIES.has(value?.difficulty)) reasons.push(`${label}_difficulty_invalid`);
  if (!ACCESS.has(value?.standaloneAccess)) reasons.push(`${label}_access_invalid`);
  return reasons;
}

function standaloneQuizProblems(quiz) {
  const reasons = [];
  const published = quiz.publishedRevision !== null && quiz.publishedRevision !== undefined;
  if (!STATUSES.has(quiz.status)) reasons.push("status_invalid");
  if (typeof quiz.title !== "string" || !quiz.title.trim() || quiz.title.trim().length > 140) reasons.push("title_invalid");
  if (!positiveInteger(quiz.revision)) reasons.push("revision_invalid");
  if (published && !positiveInteger(quiz.publishedRevision)) reasons.push("published_revision_invalid");
  if (published && quiz.revision !== quiz.publishedRevision) reasons.push("revision_publication_mismatch");
  if (!published && quiz.revision !== 1) reasons.push("unpublished_revision_mismatch");
  if (quiz.status === "draft" && published) reasons.push("draft_status_has_publication");
  if (["published", "disabled"].includes(quiz.status) && !published) reasons.push("status_missing_publication");
  if (quiz.course != null || quiz.lesson != null || quiz.homeworkSet != null) reasons.push("standalone_has_parent");

  if (published) {
    reasons.push(...metadataProblems(quiz, "published"));
    reasons.push(...questionProblems(quiz.questions, "published"));
  } else if (Array.isArray(quiz.questions) && quiz.questions.length) {
    reasons.push("unpublished_has_published_questions");
  }

  const draft = quiz.draft;
  if (!published && (!draft || typeof draft !== "object" || Array.isArray(draft))) {
    reasons.push("unpublished_draft_missing");
  }
  if (draft != null) {
    if (typeof draft !== "object" || Array.isArray(draft)) reasons.push("draft_malformed");
    else {
      if (!positiveInteger(draft.version)) reasons.push("draft_version_invalid");
      if ((draft.basePublishedRevision ?? null) !== (quiz.publishedRevision ?? null)) reasons.push("draft_base_revision_mismatch");
      reasons.push(...metadataProblems(draft, "draft"));
      reasons.push(...questionProblems(draft.questions, "draft"));
    }
  }
  return reasons;
}

function rateWindowProblems(window) {
  const reasons = [];
  if (window.user?._bsontype !== "ObjectId") reasons.push("user_invalid");
  if (!["start", "submit"].includes(window.operation)) reasons.push("operation_invalid");
  if (!validDate(window.windowStart)) reasons.push("window_start_invalid");
  if (!validDate(window.expiresAt)) reasons.push("expiry_invalid");
  if (!Number.isSafeInteger(window.count) || window.count < 0) reasons.push("count_invalid");
  if (validDate(window.windowStart) && validDate(window.expiresAt)
    && window.expiresAt.getTime() < window.windowStart.getTime() + WINDOW_MS) {
    reasons.push("expiry_before_window_end");
  }
  return reasons;
}

async function inspectInvalidRecords(collection, filter, projection, validate, idField) {
  let count = 0;
  const records = [];
  for await (const record of collection.find(filter, { projection })) {
    const reasons = validate(record);
    if (!reasons.length) continue;
    count += 1;
    if (records.length < MAX_REPORTED_RECORDS) records.push({ [idField]: String(record._id), reasons });
  }
  return { count, records, truncated: count > records.length };
}

async function duplicateGroupCount(collection, match, keys) {
  const groupId = Object.fromEntries(keys.map((key) => [key, `$${key}`]));
  const [result] = await collection.aggregate([
    { $match: match },
    { $group: { _id: groupId, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "groups" },
  ]).toArray();
  return result?.groups || 0;
}

async function inspect(db, expectedDatabaseName) {
  if (!expectedDatabaseName || db.databaseName !== expectedDatabaseName) {
    throw new Error("Connected database does not match the explicitly expected database.");
  }

  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  const missingIndexes = [];
  const conflicts = [];
  const confirmedIndexes = [];
  for (const [name, requiredNames] of Object.entries(TARGETS)) {
    const actual = names.has(name) ? await db.collection(name).listIndexes().toArray() : [];
    for (const requiredName of requiredNames) {
      const expected = INDEXES[name].find((entry) => entry.name === requiredName);
      if (!expected) throw new Error(`Missing local index manifest definition: ${name}.${requiredName}`);
      const matching = actual.find((entry) => sameDefinition(entry, expected));
      if (matching) {
        confirmedIndexes.push({ collection: name, name: requiredName });
      } else {
        const conflicting = actual.find((entry) => entry.name === requiredName
          || JSON.stringify(entry.key) === JSON.stringify(expected.key));
        if (conflicting) conflicts.push({ collection: name, required: requiredName, existing: conflicting.name });
        else missingIndexes.push({ collection: name, name: requiredName });
      }
    }
  }

  const now = new Date();
  const issues = {};
  const invalidRecords = {};
  if (names.has("quizsessions")) {
    const sessions = db.collection("quizsessions");
    issues.duplicateActiveSessionGroups = await duplicateGroupCount(
      sessions, { contextType: "standalone", activeSlot: true }, ["quiz", "user"]
    );
    issues.standaloneSessionsMissingSlot = await sessions.countDocuments({ contextType: "standalone", activeSlot: { $exists: false } });
    issues.staleActiveSlots = await sessions.countDocuments({ contextType: "standalone", activeSlot: true,
      $or: [{ expiresAt: { $lte: now } }, { invalidatedAt: { $ne: null } }] });
  }
  if (names.has("quizattempts")) {
    const attempts = db.collection("quizattempts");
    issues.duplicateSessionReferenceGroups = await duplicateGroupCount(
      attempts, { session: { $type: "objectId" } }, ["session"]
    );
    issues.standaloneAttemptsMissingSession = await attempts.countDocuments({
      "submissionSnapshot.contextType": "standalone", session: { $not: { $type: "objectId" } },
    });
  }
  if (names.has("quizratewindows")) {
    const windows = db.collection("quizratewindows");
    issues.duplicateRateWindowGroups = await duplicateGroupCount(
      windows, {}, ["user", "operation", "windowStart"]
    );
    invalidRecords.rateWindows = await inspectInvalidRecords(windows, {},
      { _id: 1, user: 1, operation: 1, windowStart: 1, count: 1, expiresAt: 1 },
      rateWindowProblems, "rateWindowId");
    issues.invalidRateWindows = invalidRecords.rateWindows.count;
  }
  if (names.has("quizzes")) {
    const quizzes = db.collection("quizzes");
    issues.legacyStandaloneWithoutPublication = await quizzes.countDocuments({
      contextType: "standalone", status: { $in: ["published", "disabled"] },
      publishedRevision: { $not: { $type: "number" } },
    });
    // An absent runtimeFence is permitted until standalone runtime is enabled.
    issues.standaloneWithoutRuntimeFence = await quizzes.countDocuments({
      contextType: "standalone", runtimeFence: { $exists: false },
    });
    invalidRecords.standaloneQuizzes = await inspectInvalidRecords(quizzes, { contextType: "standalone" },
      { _id: 1, status: 1, revision: 1, publishedRevision: 1, title: 1, description: 1,
        category: 1, difficulty: 1, standaloneAccess: 1, course: 1, lesson: 1, homeworkSet: 1,
        questions: 1, draft: 1 }, standaloneQuizProblems, "quizId");
    issues.invalidStandaloneQuizzes = invalidRecords.standaloneQuizzes.count;
  }

  let transactionPrerequisite = "unverified";
  try {
    const hello = await db.admin().command({ hello: 1 });
    transactionPrerequisite = (hello.setName || hello.msg === "isdbgrid") && hello.logicalSessionTimeoutMinutes != null
      ? "replica_set_or_router_with_sessions" : "not_confirmed";
  } catch (_error) {
    transactionPrerequisite = "not_confirmed";
  }
  const issueCount = Object.entries(issues).reduce((count, [name, value]) =>
    name === "standaloneWithoutRuntimeFence" ? count : count + value, 0);
  return {
    mode: "preflight", database: db.databaseName,
    status: conflicts.length || issueCount || transactionPrerequisite === "not_confirmed"
      ? "BLOCKED_FOR_REVIEW" : missingIndexes.length ? "INDEXES_MISSING" : "INDEX_DEFINITIONS_PRESENT",
    collectionsPresent: Object.fromEntries(Object.keys(TARGETS).map((name) => [name, names.has(name)])),
    confirmedIndexes, missingIndexes, conflicts, issues, invalidRecords, transactionPrerequisite,
    note: "Preflight is read-only. Transaction capability and safe rollout still require owner verification; no index apply is implemented.",
  };
}

async function main(args = process.argv.slice(2), env = process.env) {
  parseArgs(args);
  const databaseName = resolveDatabase(env, "preflight"); // Before any connection.
  const client = new MongoClient(env.MONGO_DB, {
    retryWrites: false, readPreference: "primary", readConcern: { level: "majority" },
  });
  try {
    await client.connect();
    const report = await inspect(client.db(databaseName), databaseName);
    console.log(JSON.stringify(report, null, 2));
    if (report.status === "BLOCKED_FOR_REVIEW") process.exitCode = 2;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    // Driver error messages may include connection details; never print them.
    console.error(JSON.stringify({ status: "ERROR", name: error?.name || "Error", code: error?.code || null }));
    process.exitCode = 1;
  });
}

module.exports = { TARGETS, parseArgs, inspect, main };
