const mongoose = require("mongoose");
const QuizMedia = require("../models/quizMediaModel");
const { uploadStream } = require("./uploadStream");
const { resolveQuestionMediaEnvironment, publicIdFor, ownedMediaUrl } = require("./quizQuestionMediaEnvironment");

async function uploadOwnedQuestionMedia({ quizId, questionId, mediaType, buffer }) {
  const identity = resolveQuestionMediaEnvironment();
  const recordId = new mongoose.Types.ObjectId();
  const resourceType = mediaType === "image" ? "image" : "video";
  const publicId = publicIdFor(identity, mediaType, recordId);
  const reserved = await QuizMedia.create({ _id: recordId, quiz: quizId, questionId, mediaType,
    environment: identity.mode, publicId, resourceType, url: "", bytes: buffer.length,
    cleanupState: "reserved" });
  // A failed or ambiguous provider response leaves the reservation intact for
  // supervised investigation. A reservation alone never authorizes deletion.
  const result = await uploadStream(buffer, `${identity.folder}/${mediaType === "image" ? "images" : "audio"}`,
    { public_id: String(recordId), overwrite: false, unique_filename: false, resource_type: resourceType });
  if (result?.public_id !== publicId || result.resource_type !== resourceType
    || !ownedMediaUrl(result.secure_url, identity, publicId, resourceType)) {
    throw new Error("Question media upload identity could not be verified.");
  }
  const updated = await QuizMedia.findOneAndUpdate({ _id: recordId, publicId, environment: identity.mode,
    cleanupState: "reserved" }, { $set: { url: result.secure_url, format: result.format || "",
      cleanupState: "pending_cleanup" } }, { returnDocument: "after" });
  if (!updated) throw new Error("Question media ownership could not be recorded.");
  return updated;
}

module.exports = { uploadOwnedQuestionMedia };
