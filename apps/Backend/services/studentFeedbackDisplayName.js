function firstNameFrom(name) {
  return String(name || "").trim().split(/\s+/).filter(Boolean)[0] || "Learner";
}

function derivePublicDisplayName(name, preference) {
  if (preference === "anonymous") return "Anonymous learner";

  const firstName = firstNameFrom(name);
  if (preference === "first_name") return firstName;

  return "Anonymous learner";
}

module.exports = { derivePublicDisplayName };
