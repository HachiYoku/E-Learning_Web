import { apiClient } from "../api/client";

export function reelPlayerUrl(reel) {
  try {
    const url = new URL(reel.url);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    if (reel.platform === "youtube") {
      const videoId = url.searchParams.get("v");
      return ["youtube.com", "www.youtube.com"].includes(url.hostname) && url.pathname === "/watch" && /^[\w-]{11}$/.test(videoId || "") ? `https://www.youtube.com/embed/${videoId}?playsinline=1` : "";
    }
    if (reel.platform === "tiktok") {
      const videoId = url.pathname.split("/").filter(Boolean).at(-1);
      return ["tiktok.com", "www.tiktok.com"].includes(url.hostname) && /^\/@[\w.]+\/video\/\d+\/?$/.test(url.pathname) && /^\d+$/.test(videoId || "") ? `https://www.tiktok.com/player/v1/${videoId}?autoplay=0` : "";
    }
    if (reel.platform === "facebook") {
      if (!["facebook.com", "www.facebook.com", "m.facebook.com"].includes(url.hostname)) return "";
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.href)}&show_text=false&width=560`;
    }
  } catch {
    return "";
  }
  return "";
}

export async function fetchReels() {
  const response = await apiClient.get("/reels");
  return Array.isArray(response?.reels) ? response.reels : [];
}
