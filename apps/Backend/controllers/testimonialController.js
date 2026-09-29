const StudentFeedback = require("../models/studentFeedbackModel");
const { derivePublicDisplayName } = require("../services/studentFeedbackDisplayName");

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;

function parseLimit(value) {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!/^\d+$/.test(String(value))) return null;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= MAX_LIMIT ? limit : null;
}

async function getTestimonials(req, res) {
  const limit = parseLimit(req.query.limit);
  if (!limit) return res.status(400).json({ message: `limit must be between 1 and ${MAX_LIMIT}.` });

  try {
    const feedback = await StudentFeedback.find({
      "publicationConsent.status": "permitted",
      "publication.status": "published",
    })
      .select("_id originalFeedback studentId publicationConsent.namePreference publicationConsent.allowProfileImage")
      .sort({ "publication.publishedAt": -1, _id: -1 })
      .limit(limit)
      .populate("studentId", "name avatar")
      .lean();

    const testimonials = feedback
      .filter((item) => item.studentId && item.originalFeedback)
      .map((item) => ({
        id: String(item._id),
        quote: item.originalFeedback,
        displayName: derivePublicDisplayName(item.studentId.name, item.publicationConsent.namePreference),
        profileImage: item.publicationConsent.namePreference === "first_name" && item.publicationConsent.allowProfileImage === true && item.studentId.avatar ? item.studentId.avatar : null,
      }));

    return res.json({ testimonials });
  } catch (_error) {
    return res.status(500).json({ message: "Unable to load testimonials." });
  }
}

module.exports = { getTestimonials, DEFAULT_LIMIT, MAX_LIMIT };
