const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "u",
  "ul",
]);

const ALLOWED_ATTRS = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title"]),
};

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeAttributeValue(rawValue = "") {
  const trimmed = rawValue.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function isSafeUrl(attributeName, value) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("data:")
  ) {
    return false;
  }

  if (attributeName === "href") {
    return /^(https?:|mailto:|tel:|\/|#)/i.test(value.trim());
  }

  if (attributeName === "src") {
    return /^(https?:|\/)/i.test(value.trim());
  }

  return false;
}

function sanitizeAttributes(tagName, rawAttributes = "") {
  const allowedAttributes = ALLOWED_ATTRS[tagName];

  if (!allowedAttributes) {
    return "";
  }

  const safeAttributes = [];
  const attributePattern = /([a-zA-Z0-9:-]+)(?:\s*=\s*(".*?"|'.*?'|[^\s"'=<>`]+))?/g;
  let attributeMatch;

  while ((attributeMatch = attributePattern.exec(rawAttributes)) !== null) {
    const attributeName = attributeMatch[1].toLowerCase();

    if (
      !allowedAttributes.has(attributeName) ||
      attributeName.startsWith("on") ||
      attributeName === "style"
    ) {
      continue;
    }

    const normalizedValue = normalizeAttributeValue(attributeMatch[2] || "");

    if (!normalizedValue) {
      continue;
    }

    if ((attributeName === "href" || attributeName === "src") && !isSafeUrl(attributeName, normalizedValue)) {
      continue;
    }

    if (tagName === "a" && attributeName === "target") {
      const safeTarget = normalizedValue === "_blank" ? "_blank" : null;
      if (!safeTarget) {
        continue;
      }

      safeAttributes.push(`${attributeName}="${safeTarget}"`);
      continue;
    }

    if (tagName === "a" && attributeName === "rel") {
      continue;
    }

    safeAttributes.push(`${attributeName}="${escapeHtml(normalizedValue)}"`);
  }

  if (tagName === "a") {
    const hasTargetBlank = safeAttributes.some((attribute) => attribute === 'target="_blank"');
    if (hasTargetBlank) {
      safeAttributes.push('rel="noopener noreferrer"');
    }
  }

  return safeAttributes.length ? ` ${safeAttributes.join(" ")}` : "";
}

function sanitizeHtmlContent(html = "") {
  if (typeof html !== "string") {
    return "";
  }

  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[\s\S]*?<\/embed>/gi, "")
    .replace(/<form\b[\s\S]*?<\/form>/gi, "")
    .replace(/<(link|meta|base)[^>]*>/gi, "")
    .replace(/<\s*(\/?)\s*([a-z0-9-]+)([^>]*)>/gi, (match, closingSlash, rawTagName, rawAttributes) => {
      const tagName = rawTagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tagName)) {
        return "";
      }

      if (closingSlash) {
        return `</${tagName}>`;
      }

      const safeAttributes = sanitizeAttributes(tagName, rawAttributes);
      const selfClosing = /\/\s*$/.test(rawAttributes) || tagName === "br" || tagName === "hr" || tagName === "img";

      return selfClosing
        ? `<${tagName}${safeAttributes} />`
        : `<${tagName}${safeAttributes}>`;
    });
}

module.exports = sanitizeHtmlContent;
