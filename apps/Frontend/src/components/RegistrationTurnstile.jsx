import { useEffect, useRef, useState } from "react";

const SCRIPT_ID = "registration-turnstile-script";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const isNarrowViewport = () => window.innerWidth < 390;

function RegistrationTurnstile({ siteKey, onToken, onError, controlRef }) {
  const containerRef = useRef(null);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [compact, setCompact] = useState(isNarrowViewport);
  const compactRef = useRef(compact);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  }, [onToken, onError]);

  useEffect(() => {
    const onResize = () => {
      const nextCompact = isNarrowViewport();
      if (nextCompact === compactRef.current) return;
      compactRef.current = nextCompact;
      onTokenRef.current("");
      setCompact(nextCompact);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!siteKey) return undefined;

    let active = true;
    let widgetId = null;
    let script = document.getElementById(SCRIPT_ID);

    const renderWidget = () => {
      if (!active || !window.turnstile || widgetId !== null || !containerRef.current) return;
      try {
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: "register",
          size: compact ? "compact" : "normal",
          callback: (token) => {
            if (!active) return;
            setHasError(false);
            onTokenRef.current(token);
          },
          "expired-callback": () => {
            if (!active) return;
            onTokenRef.current("");
            onErrorRef.current("Security verification expired. Please try again.");
            window.turnstile.reset(widgetId);
          },
          "error-callback": () => {
            if (!active) return;
            setHasError(true);
            onTokenRef.current("");
            onErrorRef.current("Security verification could not load. Please retry.");
          },
        });
      } catch {
        setHasError(true);
        onTokenRef.current("");
        onErrorRef.current("Security verification could not load. Please retry.");
        return;
      }
      controlRef.current = {
        reset: () => {
          if (!active || widgetId === null) return;
          onTokenRef.current("");
          window.turnstile.reset(widgetId);
        },
      };
    };

    const onScriptError = () => {
      if (!active) return;
      script.remove();
      setHasError(true);
      onTokenRef.current("");
      onErrorRef.current("Security verification could not load. Please retry.");
    };

    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", renderWidget);
    script.addEventListener("error", onScriptError);
    renderWidget();

    return () => {
      active = false;
      script.removeEventListener("load", renderWidget);
      script.removeEventListener("error", onScriptError);
      if (widgetId !== null) window.turnstile?.remove(widgetId);
      controlRef.current = null;
    };
  }, [siteKey, controlRef, retryCount, compact]);

  return <div role="group" aria-label="Security verification" className={compact ? "flex flex-col items-center" : undefined}>
    <div ref={containerRef} className="min-h-[65px] max-w-full" />
    {hasError ? <button type="button" className="mt-2 text-sm font-semibold text-[#C97112] underline" onClick={() => {
      setHasError(false);
      if (controlRef.current) controlRef.current.reset();
      else setRetryCount((count) => count + 1);
    }}>Retry security verification</button> : null}
  </div>;
}

export default RegistrationTurnstile;
