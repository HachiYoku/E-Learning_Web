const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const sanitizeHtmlContent = require("../utils/sanitizeHtmlContent");

const sanitize = (html) => sanitizeHtmlContent(html).toLowerCase();

test("blocks script injection", () => {
  const output = sanitize("<p>Safe</p><script>alert('xss')</script>");
  assert.match(output, /<p>safe<\/p>/);
  assert.doesNotMatch(output, /script|alert/);
});

test("removes event handlers from article markup", () => {
  const output = sanitize('<p onclick="alert(1)">Text</p><img src="https://res.cloudinary.com/demo/image/upload/sample.jpg" onerror="alert(1)">');
  assert.match(output, /<p>text<\/p>/);
  assert.match(output, /<img src="https:\/\/res.cloudinary.com\/demo\/image\/upload\/sample.jpg" \/>/);
  assert.doesNotMatch(output, /onclick|onerror|alert/);
});

test("rejects javascript URLs and obfuscated javascript URLs", () => {
  const output = sanitize('<a href="javascript:alert(1)">bad</a><a href="java&#x73;cript:alert(1)">encoded</a>');
  assert.doesNotMatch(output, /javascript|alert|href=/);
  assert.match(output, />bad<\/a>/);
  assert.match(output, />encoded<\/a>/);
});

test("rejects data and javascript image payloads", () => {
  const output = sanitize('<img src="data:image/svg+xml,<svg onload=alert(1)>" alt="bad"><img src="javascript:alert(1)">');
  assert.doesNotMatch(output, /<img|data:|javascript|onload|alert/);
});

test("removes malicious links while preserving their text", () => {
  const output = sanitize('<a href="vbscript:msgbox(1)" onclick="alert(1)">Danger</a>');
  assert.match(output, /<a>danger<\/a>/);
  assert.doesNotMatch(output, /href|onclick|vbscript|alert/);
});

test("removes iframe, embed, object, and SVG payloads", () => {
  const output = sanitize('<iframe src="https://attacker.example"></iframe><embed src="https://attacker.example"><object data="https://attacker.example"></object><svg><animate onbegin="alert(1)"></animate></svg>');
  assert.equal(output, "");
});

test("encoded dangerous HTML remains inert text", () => {
  const output = sanitize("&lt;img src=x onerror=alert(1)&gt;");
  assert.match(output, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(output, /<img/);
});

test("preserves valid article formatting and approved link safety", () => {
  const output = sanitize('<h3>Thai greeting</h3><p><strong>Sawasdee</strong> <em>krub</em></p><blockquote>Welcome</blockquote><ul><li>One</li></ul><table><thead><tr><th>Word</th></tr></thead><tbody><tr><td><span style="font-size: 18px; color: #2563eb">Hello</span></td></tr></tbody></table><a href="https://example.com/article" title="Read more" target="_blank">Read</a>');
  assert.match(output, /<h3>thai greeting<\/h3>/);
  assert.match(output, /<strong>sawasdee<\/strong>/);
  assert.match(output, /<blockquote>welcome<\/blockquote>/);
  assert.match(output, /<table>/);
  assert.match(output, /style="font-size:18px;color:#2563eb"/);
  assert.match(output, /href="https:\/\/example.com\/article"/);
  assert.match(output, /target="_blank"/);
  assert.match(output, /rel="noopener noreferrer"/);
});

test("production CSP configurations are strict and parseable", () => {
  for (const app of ["Frontend", "Admin"]) {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", app, "vercel.json"), "utf8"));
    const csp = config.headers[0].headers.find((header) => header.key === "Content-Security-Policy").value;
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.doesNotMatch(csp, /unsafe-eval|(?:^|\s)\*(?:\s|;|$)/);
  }
});
