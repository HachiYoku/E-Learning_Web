const mongoose = require("mongoose");
const QuizCreationRequest = require("../models/quizCreationRequestModel");
const { sameDefinition } = require("../scripts/prepareQuizIndexes");

const INDEX_NAME = "one_set_quiz_creation_request";

class QuizCreationUnavailable extends Error {
  constructor() {
    super("Quiz creation is temporarily unavailable.");
    this.status = 503;
    this.code = "quiz_creation_unavailable";
  }
}

async function requireCreationIndex(connection = mongoose.connection) {
  if (connection.readyState !== 1 || !connection.db) throw new QuizCreationUnavailable();
  try {
    const names = await connection.db.listCollections({ name: "quizcreationrequests" }, { nameOnly: true }).toArray();
    if (names.length !== 1) throw new QuizCreationUnavailable();
    const actual = await connection.db.collection("quizcreationrequests").listIndexes().toArray();
    const [key, options] = QuizCreationRequest.schema.indexes().find(([, settings]) => settings.name === INDEX_NAME) || [];
    if (!key || !actual.some((index) => sameDefinition(index, { key, options, name: INDEX_NAME }))) {
      throw new QuizCreationUnavailable();
    }
  } catch (_error) {
    // Metadata errors and missing/nonunique indexes must not enable creation.
    throw new QuizCreationUnavailable();
  }
}

module.exports = { INDEX_NAME, QuizCreationUnavailable, requireCreationIndex };
