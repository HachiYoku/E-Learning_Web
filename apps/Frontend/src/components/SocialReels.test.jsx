import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SocialReels from "./SocialReels";

vi.mock("../services/reelService", () => ({ fetchReels: vi.fn() }));
import { fetchReels } from "../services/reelService";

const reels = [
  { _id: "youtube", platform: "youtube", url: "https://www.youtube.com/watch?v=PXO2x2GDCFY", displayOrder: 1 },
  { _id: "tiktok", platform: "tiktok", url: "https://www.tiktok.com/@arunthai/video/7123456789012345678", displayOrder: 2 },
  { _id: "facebook", platform: "facebook", url: "https://www.facebook.com/reel/123456789012345/", displayOrder: 3 },
];

beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { vi.useRealTimers(); });

describe("SocialReels", () => {
  it("hides itself with no active records or an API failure", async () => {
    fetchReels.mockResolvedValueOnce([]);
    const empty = render(<SocialReels />);
    await waitFor(() => expect(empty.container.innerHTML).toBe(""));
    empty.unmount();
    fetchReels.mockRejectedValueOnce(new Error("network"));
    const failed = render(<SocialReels />);
    await waitFor(() => expect(failed.container.innerHTML).toBe(""));
  });

  it("renders the approved copy and ordered thumbnail cards without a player before interaction", async () => {
    fetchReels.mockResolvedValueOnce(reels);
    const { container } = render(<SocialReels />);
    expect(await screen.findByText("QUICK LEARNING VIDEOS")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Arun Thai Reels" })).toBeTruthy();
    const description = screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "Arun Thai ရဲ့ Social Media များမှာ တင်ဆက်ထားတဲ့ စိတ်ဝင်စားဖွယ်ရာ ထိုင်းစကားပြော ဗီဒီယိုအတိုများကို စုစည်းဖော်ပြပေးထားပါတယ်။");
    expect(description.getAttribute("lang")).toBe("my");
    expect(description.className).toContain("font-myanmar");
    expect(await screen.findByRole("button", { name: "Play YouTube reel" })).toBeTruthy();
    expect(Array.from(screen.getAllByRole("button", { name: /Play .* reel/ })).map((button) => button.getAttribute("aria-label"))).toEqual(["Play YouTube reel", "Play TikTok reel", "Play Facebook reel"]);
    const thumbnail = container.querySelector("img");
    expect(thumbnail.src).toContain("i.ytimg.com/vi/PXO2x2GDCFY/hqdefault.jpg");
    expect(thumbnail.getAttribute("alt")).toBe("");
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("keeps the local card fallback and playback available when a thumbnail fails", async () => {
    fetchReels.mockResolvedValueOnce([reels[0]]);
    const { container } = render(<SocialReels />);
    await screen.findByRole("button", { name: "Play YouTube reel" });
    fireEvent.error(container.querySelector("img"));
    expect(container.querySelector("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play YouTube reel" }));
    expect(container.querySelector("iframe").src).toContain("youtube.com/embed/PXO2x2GDCFY");
  });

  it("mounts only the selected player, replaces it, and closes it", async () => {
    fetchReels.mockResolvedValueOnce(reels);
    const { container } = render(<SocialReels />);
    fireEvent.click(await screen.findByRole("button", { name: "Play YouTube reel" }));
    expect(container.querySelectorAll("iframe")).toHaveLength(1);
    expect(container.querySelector("iframe").src).toContain("youtube.com/embed/PXO2x2GDCFY");
    fireEvent.click(screen.getByRole("button", { name: "Play TikTok reel" }));
    expect(container.querySelectorAll("iframe")).toHaveLength(1);
    expect(container.querySelector("iframe").src).toContain("tiktok.com/player/v1/7123456789012345678");
    fireEvent.click(screen.getByRole("button", { name: "Close TikTok reel" }));
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("constructs the Facebook player only after its card is selected", async () => {
    fetchReels.mockResolvedValueOnce(reels);
    const { container } = render(<SocialReels />);
    fireEvent.click(await screen.findByRole("button", { name: "Play Facebook reel" }));
    expect(container.querySelector("iframe").src).toContain("facebook.com/plugins/video.php");
    expect(container.querySelector("iframe").src).toContain(encodeURIComponent(reels[2].url));
  });

  it("shows the approved unavailable state when a player never loads", async () => {
    fetchReels.mockResolvedValueOnce([reels[0]]);
    render(<SocialReels />);
    await screen.findByRole("button", { name: "Play YouTube reel" });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Play YouTube reel" }));
    act(() => { vi.advanceTimersByTime(12000); });
    expect(screen.getByText("This reel is unavailable")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keeps a successfully loaded player available after the fallback timeout", async () => {
    fetchReels.mockResolvedValueOnce([reels[0]]);
    const { container } = render(<SocialReels />);
    await screen.findByRole("button", { name: "Play YouTube reel" });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Play YouTube reel" }));
    fireEvent.load(container.querySelector("iframe"));
    act(() => { vi.advanceTimersByTime(12000); });
    expect(screen.queryByText("This reel is unavailable")).toBeNull();
    expect(container.querySelector("iframe")).not.toBeNull();
  });
});
