// Historical standalone fixtures deliberately bypass new Quiz Set creation.
// This helper lives under tests; no application route or service imports it.
const mongoose = require("mongoose");
const Quiz = require("../../models/quizModel");
const { draftFields, validateDraft } = require("../../services/standaloneQuizRevisions");
const { registerQuizMedia } = require("../../services/quizMediaLifecycle");

module.exports = async function createLegacyStandaloneDraft(input) {
  if (!process.env.NODE_TEST_CONTEXT) throw new Error("Legacy standalone fixtures require node --test.");
  const fields = draftFields(input);
  const quizId = new mongoose.Types.ObjectId();
  const shell = { _id: quizId, title: String(fields.title || ""), status: "draft", publishedRevision: null, revision: 1 };
  const normalized = await validateDraft(shell, { ...fields, version: 1, basePublishedRevision: null });
  const quiz = await Quiz.create({ ...shell, contextType: "standalone", questions: [], draft: normalized });
  await registerQuizMedia(quiz);
  return quiz;
};
