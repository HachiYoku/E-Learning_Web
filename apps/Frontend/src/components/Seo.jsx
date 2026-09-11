import { useEffect } from "react";

const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || "https://arunthaiedu.com").replace(/\/$/, "");
const SITE_NAME = "Arun Thai Language Center";
const DEFAULT_IMAGE = "/hero/hero1.jpg";

function absoluteUrl(value) {
  if (!value) return `${SITE_URL}${DEFAULT_IMAGE}`;
  try { return new URL(value, SITE_URL).href; } catch { return `${SITE_URL}${DEFAULT_IMAGE}`; }
}

function setMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) { element = document.createElement("meta"); document.head.appendChild(element); }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
}

function Seo({ title, description, path = "/", image, type = "website", noIndex = false, structuredData }) {
  useEffect(() => {
    const canonicalUrl = absoluteUrl(path);
    const imageUrl = absoluteUrl(image);
    const fullTitle = title ? `${title} | Arun Thai` : SITE_NAME;
    const summary = description || "Learn practical Thai online with Arun Thai Language Center.";
    document.title = fullTitle;
    setMeta('meta[name="description"]', { name: "description", content: summary });
    setMeta('meta[name="robots"]', { name: "robots", content: noIndex ? "noindex, nofollow" : "index, follow" });
    setMeta('meta[property="og:title"]', { property: "og:title", content: fullTitle });
    setMeta('meta[property="og:description"]', { property: "og:description", content: summary });
    setMeta('meta[property="og:type"]', { property: "og:type", content: type });
    setMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    setMeta('meta[property="og:site_name"]', { property: "og:site_name", content: SITE_NAME });
    setMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
    setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: fullTitle });
    setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: summary });
    setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.setAttribute("rel", "canonical"); document.head.appendChild(canonical); }
    canonical.setAttribute("href", canonicalUrl);
    let schema = document.head.querySelector('script[data-seo-schema]');
    if (structuredData) {
      if (!schema) { schema = document.createElement("script"); schema.type = "application/ld+json"; schema.dataset.seoSchema = "true"; document.head.appendChild(schema); }
      schema.textContent = JSON.stringify(structuredData);
    } else if (schema) schema.remove();
  }, [title, description, path, image, type, noIndex, structuredData]);
  return null;
}

export default Seo;
