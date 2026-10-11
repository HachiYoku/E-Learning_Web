const mongoose = require("mongoose");
const Quiz = require("../models/quizModel");

const MAX_TRANSACTION_ATTEMPTS = 4;

class StandaloneTransactionConflict extends Error {
  constructor(message = "The quiz changed. Please retry.", code = "standalone_transaction_conflict") {
    super(message);
    this.status = 409;
    this.code = code;
  }
}

class StandaloneTransactionOutcomeUnknown extends Error {
  constructor() {
    super("The operation may have completed. Reload the quiz before retrying.");
    this.status = 503;
    this.code = "standalone_transaction_outcome_unknown";
  }
}

function hasLabel(error, label) {
  return typeof error?.hasErrorLabel === "function" && error.hasErrorLabel(label);
}

function isRetryable(error) {
  return error?.code === 11000 || error?.code === 112 || error?.code === 251
    || hasLabel(error, "TransientTransactionError");
}

function fencePredicate(quiz) {
  return {
    _id: quiz._id,
    contextType: "standalone",
    status: quiz.status,
    publishedRevision: quiz.publishedRevision,
    revision: quiz.revision,
    runtimeFence: quiz.runtimeFence === undefined ? { $exists: false } : quiz.runtimeFence,
  };
}

async function writeQuizFence(quiz, session, { status, extraFilter = {}, update = {} } = {}) {
  const changes = { ...update, $inc: { ...(update.$inc || {}), runtimeFence: 1 } };
  return Quiz.findOneAndUpdate(
    { ...fencePredicate(quiz), ...extraFilter },
    { ...changes, ...(status === undefined ? {} : { $set: { ...(changes.$set || {}), status } }) },
    { session, returnDocument: "after", runValidators: true }
  );
}

async function runStandaloneTransaction(work, { resolveAmbiguous, maxAttempts = MAX_TRANSACTION_ATTEMPTS } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const session = await mongoose.startSession();
    let value;
    let commitAttempted = false;
    try {
      session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
      value = await work(session);
      commitAttempted = true;
      await session.commitTransaction();
      return value;
    } catch (error) {
      if (commitAttempted && hasLabel(error, "UnknownTransactionCommitResult")) {
        // Do not replay an operation whose first commit might already be durable.
        try {
          const resolved = await resolveAmbiguous?.(value);
          if (resolved !== undefined) return resolved;
        } catch (_resolutionError) {
          // A failed read cannot prove that the commit was aborted.
        }
        throw new StandaloneTransactionOutcomeUnknown();
      }
      if (session.inTransaction()) {
        try { await session.abortTransaction(); } catch (_abortError) { /* Original error remains authoritative. */ }
      }
      if (isRetryable(error)) {
        if (attempt + 1 < maxAttempts) continue;
        throw new StandaloneTransactionConflict();
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }
  throw new StandaloneTransactionConflict();
}

module.exports = { MAX_TRANSACTION_ATTEMPTS, StandaloneTransactionConflict,
  StandaloneTransactionOutcomeUnknown, writeQuizFence, runStandaloneTransaction };
