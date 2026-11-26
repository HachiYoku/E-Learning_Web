import { useEffect, useState } from "react";
import { fetchReels } from "../services/reelService";

const platformCopy = {
  youtube: { name: "YouTube" },
  tiktok: { name: "TikTok" },
  facebook: { name: "Facebook" },
};

function playerUrl(reel) {
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

function ReelPlayer({ reel }) {
  const src = playerUrl(reel);
  if (!src) return <div className="flex h-full items-center justify-center bg-[#2D2E30] px-5 text-center text-white">This reel is unavailable</div>;
  return <iframe src={src} title={`${platformCopy[reel.platform].name} reel`} loading="lazy" className="h-full w-full border-0" allow="clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen" allowFullScreen />;
}

function SocialReels() {
  const [reels, setReels] = useState(null);

  useEffect(() => {
    let active = true;
    fetchReels().then((items) => { if (active) setReels(items); }).catch(() => { if (active) setReels([]); });
    return () => { active = false; };
  }, []);

  if (!reels?.length) return null;

return <section aria-labelledby="reels-heading" className="bg-white px-4 pt-14 pb-8 sm:px-6 sm:pt-16 sm:pb-10 md:px-10 md:pt-20 md:pb-12"><div className="mx-auto max-w-7xl"><div className="mb-8 text-center sm:mb-10 md:mb-12"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">QUICK LEARNING VIDEOS</p><h2 id="reels-heading" className="mt-3 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl md:text-5xl">Arun Thai Reels</h2><p lang="my" className="font-myanmar mx-auto mt-4 max-w-3xl text-sm leading-[1.9] text-[#765F55] sm:text-base">Arun Thai ရဲ့ Social Media များမှာ တင်ဆက်ထားတဲ့ စိတ်ဝင်စားဖွယ်ရာ <br className="hidden lg:block" />ထိုင်းစကားပြော ဗီဒီယိုအတိုများကို စုစည်းဖော်ပြပေးထားပါတယ်။</p></div><div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:gap-5 sm:px-6 md:-mx-10 md:px-10 [scrollbar-width:thin]">{reels.map((reel) => <article key={reel._id} className="aspect-[9/16] w-[64vw] shrink-0 snap-start overflow-hidden rounded-2xl sm:w-[42vw] md:w-[30vw] lg:w-[12.5rem] xl:w-[13.5rem]"><ReelPlayer reel={reel} /></article>)}</div></div></section>;
}

export default SocialReels;
