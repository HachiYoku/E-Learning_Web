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
  "span",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const ALLOWED_ATTRS = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title"]),
  span: new Set(["style"]),
};

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

  if (
    !normalized ||
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
      (attributeName === "style" && !(tagName === "span" && allowedAttributes.has("style")))
    ) {
      continue;
    }

    const normalizedValue = normalizeAttributeValue(attributeMatch[2] || "");

    if (!normalizedValue) {
      continue;
    }

    if (tagName === "span" && attributeName === "style") {
      const fontSizeMatch = normalizedValue.match(/(?:^|;)\s*font-size:\s*(\d{1,2})px\s*(?:;|$)/i);
      const colorMatch = normalizedValue.match(/(?:^|;)\s*color:\s*(#[0-9a-f]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))\s*(?:;|$)/i);
      const numericFontSize = Number(fontSizeMatch?.[1]);

      if (!fontSizeMatch && !colorMatch || fontSizeMatch && (numericFontSize < 8 || numericFontSize > 72)) {
        continue;
      }

      const safeStyles = [];
      if (fontSizeMatch) safeStyles.push(`font-size: ${numericFontSize}px`);
      if (colorMatch) {
        const colorValue = colorMatch[1].toLowerCase();
        const rgbValues = colorValue.match(/\d+/g)?.map(Number);
        const hexValue = rgbValues?.length === 3
          ? `#${rgbValues.map((value) => Math.min(value, 255).toString(16).padStart(2, "0")).join("")}`
          : colorValue;
        safeStyles.push(`color: ${hexValue}`);
      }
      safeAttributes.push(`style="${safeStyles.join("; ")}"`);
      continue;
    }

    if ((attributeName === "href" || attributeName === "src") && !isSafeUrl(attributeName, normalizedValue)) {
      continue;
    }

    if (tagName === "a" && attributeName === "target") {
      if (normalizedValue !== "_blank") {
        continue;
      }

      safeAttributes.push(`${attributeName}="_blank"`);
      continue;
    }

    if (tagName === "a" && attributeName === "rel") {
      continue;
    }

    safeAttributes.push(`${attributeName}="${escapeHtml(normalizedValue)}"`);
  }

  if (tagName === "a" && safeAttributes.includes('target="_blank"')) {
    safeAttributes.push('rel="noopener noreferrer"');
  }

  return safeAttributes.length ? ` ${safeAttributes.join(" ")}` : "";
}

export function sanitizeHtmlContent(html = "") {
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
