import { Film, Music2, Play, Video, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchReels } from "../services/reelService";

const platformCopy = {
  youtube: { name: "YouTube", Icon: Video },
  tiktok: { name: "TikTok", Icon: Music2 },
  facebook: { name: "Facebook", Icon: Film },
};

function playerUrl(reel) {
  try {
    const url = new URL(reel.url);
    if (reel.platform === "youtube") {
      const videoId = url.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&playsinline=1` : "";
    }
    if (reel.platform === "tiktok") {
      const videoId = url.pathname.split("/").filter(Boolean).at(-1);
      return /^\d+$/.test(videoId || "") ? `https://www.tiktok.com/player/v1/${videoId}?autoplay=1` : "";
    }
    if (reel.platform === "facebook") {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.href)}&show_text=false&width=560`;
    }
  } catch {
    return "";
  }
  return "";
}

function thumbnailUrl(reel) {
  if (reel.platform !== "youtube") return "";
  try {
    const videoId = new URL(reel.url).searchParams.get("v");
    return videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg` : "";
  } catch {
    return "";
  }
}

function ReelPlayer({ reel, onClose }) {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const src = useMemo(() => playerUrl(reel), [reel]);
  const copy = platformCopy[reel.platform];
  const unavailable = !src || timedOut;

  useEffect(() => {
    if (!src || loaded) return undefined;
    const timeout = window.setTimeout(() => setTimedOut(true), 12000);
    return () => window.clearTimeout(timeout);
  }, [src, loaded]);

  if (unavailable) {
    return <div className="flex h-full flex-col items-center justify-center bg-[#2D2E30] px-5 text-center text-white"><p className="text-base font-bold">This reel is unavailable</p><button type="button" onClick={onClose} className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/25 px-3 text-sm font-bold transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Close reel</button></div>;
  }

  return <div className="relative h-full bg-[#2D2E30]"><button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white shadow-lg transition hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={`Close ${copy.name} reel`}><X size={20} aria-hidden="true" /></button><iframe src={src} onLoad={() => { setTimedOut(false); setLoaded(true); }} title={`${copy.name} reel`} className="h-full w-full border-0" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen" allowFullScreen /></div>;
}

function ReelPlaceholder({ reel, active, onPlay }) {
  const copy = platformCopy[reel.platform];
  const Icon = copy.Icon;
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const thumbnail = thumbnailFailed ? "" : thumbnailUrl(reel);
  return <button type="button" onClick={onPlay} aria-expanded={active} aria-label={`Play ${copy.name} reel`} className="group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#2D2E30] via-[#4A3830] to-[#C97112] p-4 text-left text-white shadow-md transition duration-200 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E58C1A]/50 sm:p-5">{thumbnail ? <img src={thumbnail} alt="" aria-hidden="true" loading="lazy" onError={() => setThumbnailFailed(true)} className="absolute inset-0 h-full w-full object-cover" /> : null}<div className="absolute inset-0 bg-gradient-to-t from-[#2D2E30]/90 via-[#2D2E30]/20 to-black/10" aria-hidden="true" /><div className="absolute -right-12 -top-10 h-40 w-40 rounded-full bg-[#F8C56A]/20 blur-2xl" aria-hidden="true" /><span className="relative inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-bold"><Icon size={15} aria-hidden="true" />{copy.name}</span><span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F8C56A] text-[#2D2E30] shadow-lg transition group-hover:scale-105 sm:h-16 sm:w-16"><Play size={25} className="ml-1 fill-current sm:h-7 sm:w-7" aria-hidden="true" /></span><span className="relative block text-sm font-bold sm:text-base">Watch reel</span></button>;
}

function SocialReels() {
  const [reels, setReels] = useState(null);
  const [activeReelId, setActiveReelId] = useState(null);

  useEffect(() => {
    let active = true;
    fetchReels().then((items) => { if (active) setReels(items); }).catch(() => { if (active) setReels([]); });
    return () => { active = false; };
  }, []);

  if (!reels?.length) return null;

return <section aria-labelledby="reels-heading" className="bg-white px-4 pt-14 pb-8 sm:px-6 sm:pt-16 sm:pb-10 md:px-10 md:pt-20 md:pb-12"><div className="mx-auto max-w-7xl"><div className="mb-8 text-center sm:mb-10 md:mb-12"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C97112]">QUICK LEARNING VIDEOS</p><h2 id="reels-heading" className="mt-3 text-3xl font-bold tracking-tight text-[#2D2E30] sm:text-4xl md:text-5xl">Arun Thai Reels</h2><p lang="my" className="font-myanmar mx-auto mt-4 max-w-3xl text-sm leading-[1.9] text-[#765F55] sm:text-base">Arun Thai ရဲ့ Social Media များမှာ တင်ဆက်ထားတဲ့ စိတ်ဝင်စားဖွယ်ရာ <br className="hidden lg:block" />ထိုင်းစကားပြော ဗီဒီယိုအတိုများကို စုစည်းဖော်ပြပေးထားပါတယ်။</p></div><div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:gap-5 sm:px-6 md:-mx-10 md:px-10 [scrollbar-width:thin]">{reels.map((reel) => { const isActive = activeReelId === reel._id; return <article key={reel._id} className="aspect-[9/16] w-[64vw] shrink-0 snap-start overflow-hidden rounded-2xl sm:w-[42vw] md:w-[30vw] lg:w-[12.5rem] xl:w-[13.5rem]">{isActive ? <ReelPlayer reel={reel} onClose={() => setActiveReelId(null)} /> : <ReelPlaceholder reel={reel} active={false} onPlay={() => setActiveReelId(reel._id)} />}</article>; })}</div></div></section>;
}

export default SocialReels;
