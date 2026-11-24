import { useEffect, useMemo, useRef, useState } from "react";

const YOUTUBE_API_SRC = "https://www.youtube.com/iframe_api";
let apiPromise;

// eslint-disable-next-line react-refresh/only-export-components
export function getYouTubeVideoConfig(source) {
  if (!source) return null;
  try {
    const url = new URL(source);
    let videoId = "";
    if (url.hostname.includes("youtu.be")) videoId = url.pathname.slice(1);
    else if (url.hostname.includes("youtube.com")) videoId = url.searchParams.get("v") || url.pathname.match(/^\/embed\/([^/]+)/)?.[1] || "";
    if (!videoId) return null;
    const params = Object.fromEntries(url.searchParams.entries());
    delete params.v;
    return { videoId, params };
  } catch { return null; }
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    const ready = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube player API was unavailable after loading."));
    };
    window.onYouTubeIframeAPIReady = ready;
    const existing = document.querySelector(`script[src="${YOUTUBE_API_SRC}"]`);
    const script = existing || Object.assign(document.createElement("script"), { src: YOUTUBE_API_SRC, async: true });
    const failed = () => reject(new Error("YouTube player API could not load."));
    script.addEventListener("error", failed, { once: true });
    if (!existing) document.head.append(script);
  });
  return apiPromise;
}

function fallbackEmbedUrl(config) {
  const params = new URLSearchParams({ ...config.params, autoplay: "1", enablejsapi: "1", playsinline: "1" });
  return `https://www.youtube.com/embed/${encodeURIComponent(config.videoId)}?${params.toString()}`;
}

function YouTubeLessonPlayer({ source, title, className = "", onControllerReady }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const stateRef = useRef(null);
  const [sdkFailed, setSdkFailed] = useState(false);
  const config = useMemo(() => getYouTubeVideoConfig(source), [source]);
  const videoId = config?.videoId;
  const params = config?.params;

  useEffect(() => {
    if (!videoId || !hostRef.current) return undefined;
    let disposed = false;
    let controller = null;
    setSdkFailed(false);
    const createPlayer = async () => {
      try {
        const YT = await loadYouTubeApi();
        if (disposed || !hostRef.current) return;
        const playingState = YT.PlayerState?.PLAYING ?? 1;
        const endedState = YT.PlayerState?.ENDED ?? 0;
        new YT.Player(hostRef.current, {
          videoId,
          playerVars: { ...params, autoplay: 1, enablejsapi: 1, origin: window.location.origin, playsinline: 1 },
          events: {
            onReady: (event) => {
              if (disposed) return;
              const readyPlayer = event.target;
              controller = {
                pauseIfPlaying: () => {
                  const currentState = stateRef.current ?? readyPlayer.getPlayerState?.();
                  if (currentState !== playingState) return false;
                  readyPlayer.pauseVideo?.();
                  return true;
                },
                resume: () => {
                  const currentState = stateRef.current ?? readyPlayer.getPlayerState?.();
                  if (currentState === endedState) return false;
                  try { readyPlayer.playVideo?.(); return true; } catch { return false; }
                },
              };
              playerRef.current = readyPlayer;
              stateRef.current = readyPlayer.getPlayerState?.() ?? null;
              onControllerReady?.(controller);
            },
            onStateChange: (event) => { stateRef.current = event.data; },
            onError: () => { stateRef.current = null; },
          },
        });
      } catch {
        if (!disposed) setSdkFailed(true);
      }
    };
    void createPlayer();
    return () => {
      disposed = true;
      if (controller) onControllerReady?.(null);
      playerRef.current?.destroy?.();
      playerRef.current = null;
      stateRef.current = null;
    };
  }, [videoId, params, onControllerReady]);

  if (!config || sdkFailed) return <iframe src={config ? fallbackEmbedUrl(config) : source} title={title} className={className} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />;
  return <div ref={hostRef} title={title} className={className} />;
}

export default YouTubeLessonPlayer;
