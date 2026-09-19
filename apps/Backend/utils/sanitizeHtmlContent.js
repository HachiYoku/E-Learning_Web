const sanitizeHtml = require("sanitize-html");

const ALLOWED_TAGS = [
  "a", "b", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "img", "li", "ol", "p", "pre", "span", "strong", "table", "tbody", "td", "th",
  "thead", "tr", "u", "ul",
];

const ALLOWED_ATTRIBUTES = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title"],
  div: ["style"],
  span: ["style"],
};

const ALLOWED_STYLES = {
  "font-size": [/^(?:[8-9]|[1-6][0-9]|7[0-2])px$/],
  color: [/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i, /^rgb\(\s*(?:[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\s*,\s*(?:[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\s*,\s*(?:[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\s*\)$/i],
  "text-align": [/^(?:left|center|right|justify)$/],
};

function sanitizeHtmlContent(html = "") {
  if (typeof html !== "string") return "";

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    allowedStyles: { div: ALLOWED_STYLES, span: ALLOWED_STYLES },
    disallowedTagsMode: "discard",
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
    transformTags: {
      a: (tagName, attributes) => {
        const attribs = { ...attributes };
        if (attribs.target === "_blank") attribs.rel = "noopener noreferrer";
        else {
          delete attribs.target;
          delete attribs.rel;
        }
        return { tagName, attribs };
      },
    },
  });
}

module.exports = sanitizeHtmlContent;
module.exports.ALLOWED_TAGS = ALLOWED_TAGS;
module.exports.ALLOWED_ATTRIBUTES = ALLOWED_ATTRIBUTES;
