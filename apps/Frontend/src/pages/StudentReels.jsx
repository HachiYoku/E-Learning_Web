import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchReels, reelPlayerUrl } from "../services/reelService";

function StudentReels() {
  const [reels, setReels] = useState(null);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);
  const [visible, setVisible] = useState(() => !document.hidden);
  const cards = useRef([]);
  const feed = useRef(null);

  useEffect(() => {
    let mounted = true;
    fetchReels().then((items) => { if (mounted) setReels(items); }).catch(() => { if (mounted) setError(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!reels?.length) return undefined;
    if (!window.IntersectionObserver) {
      const update = () => {
        const bounds = feed.current.getBoundingClientRect();
        const candidates = cards.current.map((card, index) => {
          const rect = card.getBoundingClientRect();
          const overlap = Math.max(0, Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top));
          return [index, rect.height ? overlap / rect.height : 0];
        }).filter(([, ratio]) => ratio >= 0.5).sort((a, b) => b[1] - a[1]);
        setActiveIndex(candidates.length ? candidates[0][0] : null);
      };
      update();
      const scroller = feed.current;
      scroller.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      return () => { scroller.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
    }
    const ratios = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => ratios.set(Number(entry.target.dataset.reelIndex), entry.isIntersecting ? entry.intersectionRatio : 0));
      const best = [...ratios.entries()].filter(([, ratio]) => ratio >= 0.5).sort((a, b) => b[1] - a[1])[0];
      setActiveIndex(best ? best[0] : null);
    }, { root: feed.current, threshold: [0, 0.5, 0.75, 1] });
    cards.current.forEach((card) => { if (card) observer.observe(card); });
    return () => observer.disconnect();
  }, [reels]);

  const navigate = (index) => {
    if (index < 0 || index >= reels.length) return;
    feed.current?.scrollTo({ top: index * feed.current.clientHeight, behavior: "smooth" });
  };

  return <div className="mx-auto flex h-[calc(100dvh-8.5rem-env(safe-area-inset-bottom))] max-w-5xl flex-col overflow-hidden bg-[#181818] text-white sm:h-[min(85dvh,52rem)] sm:rounded-2xl">
    <header className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-4"><div className="min-w-0"><h1 className="text-sm font-bold tracking-tight sm:text-2xl">ARUN THAI REELS</h1><p className="text-xs text-white/70 sm:mt-1 sm:text-sm">Learn Thai in short videos</p></div>{reels?.length ? <div className="flex shrink-0 items-center gap-1 sm:hidden"><button type="button" aria-label="Previous reel" disabled={(activeIndex ?? 0) === 0} onClick={() => navigate((activeIndex ?? 0) - 1)} className="rounded-full p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"><ChevronUp size={18} aria-hidden="true" /></button><span aria-live="polite" className="text-xs font-bold">{(activeIndex ?? 0) + 1} / {reels.length}</span><button type="button" aria-label="Next reel" disabled={(activeIndex ?? 0) >= reels.length - 1} onClick={() => navigate((activeIndex ?? 0) + 1)} className="rounded-full p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"><ChevronDown size={18} aria-hidden="true" /></button></div> : null}</header>
    {error ? <p role="alert" className="mt-8 text-center">Unable to load reels. Please try again later.</p> : !reels ? <p role="status" className="mt-8 text-center">Loading reels...</p> : reels.length === 0 ? <p className="mt-8 text-center">No reels available yet.</p> : <div ref={feed} aria-label="Reels feed" tabIndex={0} className="relative min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overflow-x-hidden overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
      {reels.map((reel, index) => {
        const src = reelPlayerUrl(reel);
        const isActive = visible && activeIndex === index;
        return <section key={reel._id} ref={(element) => { cards.current[index] = element; }} data-reel-index={index} aria-label={`Reel ${index + 1} of ${reels.length}`} className="flex h-full snap-start items-center justify-center gap-4 px-1 sm:px-4">
          <div className="aspect-[9/16] w-[min(100%,calc(56.25dvh-6.75rem-env(safe-area-inset-bottom)))] max-h-full overflow-hidden bg-black sm:w-[min(38.25dvh,21.375rem)] sm:rounded-2xl">
            {isActive && src ? <iframe src={src} title={`Reel ${index + 1}`} loading="lazy" className="h-full w-full border-0" allow="clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen" allowFullScreen /> : isActive && !src ? <div className="flex h-full items-center justify-center px-4 text-center text-white">This reel is unavailable</div> : null}
          </div>
          <div className="hidden flex-col items-center gap-3 sm:flex"><p className="text-sm font-bold text-white/75">{index + 1} / {reels.length}</p><button type="button" aria-label="Previous reel" disabled={index === 0} onClick={() => navigate(index - 1)} className="rounded-full bg-white p-3 text-[#2D2E30] shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"><ChevronUp aria-hidden="true" /></button><button type="button" aria-label="Next reel" disabled={index === reels.length - 1} onClick={() => navigate(index + 1)} className="rounded-full bg-white p-3 text-[#2D2E30] shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"><ChevronDown aria-hidden="true" /></button></div>
        </section>;
      })}
    </div>}
  </div>;
}

export default StudentReels;
