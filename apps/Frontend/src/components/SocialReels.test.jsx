import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SocialReels from "./SocialReels";
import Home from "../pages/Home";
import { fetchReels } from "../services/reelService";

vi.mock("../services/reelService", () => ({ fetchReels: vi.fn() }));
vi.mock("./Navbar", () => ({ default: () => null }));
vi.mock("./Hero", () => ({ default: () => null }));
vi.mock("./Courses", () => ({ default: () => null }));
vi.mock("./Benefits", () => ({ default: () => null }));
vi.mock("./Article", () => ({ default: () => <section>Thai Learning Insights</section> }));
vi.mock("./MotivationBanner", () => ({ default: () => null }));
vi.mock("./OurServices", () => ({ default: () => null }));
vi.mock("./StudentReview", () => ({ default: () => null }));
vi.mock("./ContactSection", () => ({ default: () => null }));
vi.mock("./Footer", () => ({ default: () => null }));
vi.mock("./Seo", () => ({ default: () => null }));

const reels = [
  { _id: "youtube", platform: "youtube", url: "https://www.youtube.com/watch?v=PXO2x2GDCFY" },
  { _id: "tiktok", platform: "tiktok", url: "https://www.tiktok.com/@arunthai/video/7123456789012345678" },
  { _id: "facebook", platform: "facebook", url: "https://www.facebook.com/reel/123456789012345/" },
];

beforeEach(() => vi.resetAllMocks());

describe("SocialReels", () => {
  it("hides itself when there are no reels or the request fails", async () => {
    fetchReels.mockResolvedValueOnce([]);
    const empty = render(<SocialReels />);
    await waitFor(() => expect(empty.container.innerHTML).toBe(""));
    empty.unmount();
    fetchReels.mockRejectedValueOnce(new Error("network"));
    const failed = render(<SocialReels />);
    await waitFor(() => expect(failed.container.innerHTML).toBe(""));
  });

  it("renders ordered native lazy players without autoplay or custom covers", async () => {
    fetchReels.mockResolvedValueOnce(reels);
    const { container } = render(<SocialReels />);
    const youtube = await screen.findByTitle("YouTube reel");
    const players = Array.from(container.querySelectorAll("iframe"));
    expect(players.map((player) => player.title)).toEqual(["YouTube reel", "TikTok reel", "Facebook reel"]);
    expect(youtube.src).toContain("youtube.com/embed/PXO2x2GDCFY");
    expect(players[1].src).toContain("tiktok.com/player/v1/7123456789012345678");
    expect(players[2].src).toContain(encodeURIComponent(reels[2].url));
    for (const player of players) {
      expect(player.getAttribute("loading")).toBe("lazy");
      expect(player.src).not.toContain("autoplay=1");
      expect(player.closest("article").className).toContain("aspect-[9/16]");
    }
    expect(container.querySelector(".overflow-x-auto")).toBeTruthy();
    expect(screen.queryByText("Watch reel")).toBeNull();
    expect(screen.queryByRole("button", { name: /Play .* reel/ })).toBeNull();
  });

  it("does not embed an untrusted provider URL", async () => {
    fetchReels.mockResolvedValueOnce([{ ...reels[2], url: "https://facebook.com.attacker.test/reel/123" }]);
    const { container } = render(<SocialReels />);
    expect(await screen.findByText("This reel is unavailable")).toBeTruthy();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("places the shared reels immediately after Insights on the homepage", async () => {
    fetchReels.mockResolvedValueOnce([reels[0]]);
    render(<Home />);
    const player = await screen.findByTitle("YouTube reel");
    const insights = screen.getByText("Thai Learning Insights");
    expect(insights.nextElementSibling).toBe(player.closest("section"));
    expect(player.getAttribute("loading")).toBe("lazy");
    expect(player.src).not.toContain("autoplay=1");
    expect(fetchReels).toHaveBeenCalledTimes(1);
  });
});
