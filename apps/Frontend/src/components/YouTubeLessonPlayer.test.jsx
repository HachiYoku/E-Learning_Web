import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import YouTubeLessonPlayer, { getYouTubeVideoConfig } from "./YouTubeLessonPlayer";

afterEach(() => {
  cleanup();
  delete window.YT;
});

describe("YouTubeLessonPlayer", () => {
  it("normalizes the supported lesson URL formats", () => {
    expect(getYouTubeVideoConfig("https://youtu.be/abc123?start=12")).toMatchObject({ videoId: "abc123", params: { start: "12" } });
    expect(getYouTubeVideoConfig("https://www.youtube.com/watch?v=abc123&start=12")).toMatchObject({ videoId: "abc123", params: { start: "12" } });
    expect(getYouTubeVideoConfig("https://example.com/video")).toBeNull();
  });

  it("uses an already-loaded API, controls only an actually playing player, and cleans up", async () => {
    let state = 1;
    const player = { getPlayerState: vi.fn(() => state), pauseVideo: vi.fn(), playVideo: vi.fn(), destroy: vi.fn() };
    let options;
    window.YT = {
      PlayerState: { ENDED: 0, PLAYING: 1 },
      Player: vi.fn(function Player(host, nextOptions) {
        options = nextOptions;
        queueMicrotask(() => nextOptions.events.onReady({ target: player }));
        return player;
      }),
    };
    const onControllerReady = vi.fn();
    const view = render(<YouTubeLessonPlayer source="https://www.youtube.com/watch?v=abc123" title="Lesson" onControllerReady={onControllerReady} />);
    await waitFor(() => expect(onControllerReady).toHaveBeenCalledWith(expect.objectContaining({ pauseIfPlaying: expect.any(Function), resume: expect.any(Function) })));
    const controller = onControllerReady.mock.calls.find(([value]) => value)?.[0];
    expect(controller.pauseIfPlaying()).toBe(true);
    expect(player.pauseVideo).toHaveBeenCalledOnce();
    state = 0;
    options.events.onStateChange({ data: 0 });
    expect(controller.resume()).toBe(false);
    expect(player.playVideo).not.toHaveBeenCalled();
    view.unmount();
    expect(player.destroy).toHaveBeenCalledOnce();
  });
});
