import DOMPurify from "dompurify";

const ALLOWED_TAGS = ["a", "b", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre", "span", "strong", "table", "tbody", "td", "th", "thead", "tr", "u", "ul"];
const ALLOWED_ATTR = ["href", "title", "target", "rel", "src", "alt", "style"];
const ALLOWED_ATTRIBUTES_BY_TAG = { a: ["href", "title", "target", "rel"], img: ["src", "alt", "title"], div: ["style"], span: ["style"] };
const SAFE_STYLE = /^(?:(?:font-size:\s*(?:[8-9]|[1-6]\d|7[0-2])px)|(?:color:\s*(?:#[0-9a-f]{3}(?:[0-9a-f]{3})?|rgb\(\s*(?:\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])\s*,\s*(?:\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])\s*,\s*(?:\d{1,2}|1\d{2}|2[0-4]\d|25[0-5])\s*\)))|(?:text-align:\s*(?:left|center|right|justify)))$/i;

function sanitizeStyle(value = "") {
  return value.split(";").map((rule) => rule.trim()).filter((rule) => SAFE_STYLE.test(rule)).join("; ");
}

DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
  const tagName = _node.tagName?.toLowerCase();
  if (!ALLOWED_ATTRIBUTES_BY_TAG[tagName]?.includes(data.attrName)) {
    data.keepAttr = false;
    return;
  }
  if (data.attrName === "style") {
    const safeStyle = sanitizeStyle(data.attrValue);
    data.keepAttr = Boolean(safeStyle);
    data.attrValue = safeStyle;
  }
});

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    if (node.getAttribute("target") === "_blank") node.setAttribute("rel", "noopener noreferrer");
    else {
      node.removeAttribute("target");
      node.removeAttribute("rel");
    }
  }
});

export function sanitizeHtmlContent(html = "") {
  if (typeof html !== "string") return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|(?:\/|#))/i,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}
