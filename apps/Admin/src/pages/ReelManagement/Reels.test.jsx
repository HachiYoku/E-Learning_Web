import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Reels from "./Reels";

vi.mock("../../services/reelService", () => ({
  fetchAdminReels: vi.fn(),
  createReel: vi.fn(),
  updateReel: vi.fn(),
  deleteReel: vi.fn(),
}));

import { createReel, deleteReel, fetchAdminReels, updateReel } from "../../services/reelService";

const youtube = { id: "youtube-1", url: "https://www.youtube.com/watch?v=PXO2x2GDCFY", platform: "youtube", displayOrder: 2, isActive: true };

beforeEach(() => { vi.resetAllMocks(); fetchAdminReels.mockResolvedValue([youtube]); });

describe("Reels management", () => {
  it("shows all records, including inactive Reels, and opens the add form", async () => {
    fetchAdminReels.mockResolvedValueOnce([youtube, { ...youtube, id: "tiktok-1", platform: "tiktok", isActive: false }]);
    render(<Reels />);
    expect(await screen.findByText("youtube")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add Reel" }));
    expect(screen.getByRole("heading", { name: "Add Reel" })).toBeTruthy();
    expect(screen.getByLabelText("Social-media URL")).toBeTruthy();
  });

  it("creates a URL-only Reel and displays backend validation errors", async () => {
    createReel.mockResolvedValueOnce({ ...youtube, id: "facebook-1", platform: "facebook", url: "https://www.facebook.com/reel/123456789012345/" });
    render(<Reels />);
    await screen.findByText("youtube");
    fireEvent.click(screen.getByRole("button", { name: "Add Reel" }));
    fireEvent.change(screen.getByLabelText("Social-media URL"), { target: { value: "https://www.facebook.com/reel/123456789012345/" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Reel" }));
    await waitFor(() => expect(createReel).toHaveBeenCalledWith({ url: "https://www.facebook.com/reel/123456789012345/", displayOrder: 0, isActive: true }));
    expect(await screen.findByText("facebook")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add Reel" }));
    createReel.mockRejectedValueOnce(new Error("Use a supported public TikTok video URL."));
    fireEvent.change(screen.getByLabelText("Social-media URL"), { target: { value: "https://vm.tiktok.com/unsupported/" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Reel" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Use a supported public TikTok video URL.");
  });

  it("edits Reel fields and confirms deletion", async () => {
    updateReel.mockResolvedValueOnce({ ...youtube, displayOrder: 7, isActive: false });
    render(<Reels />);
    await screen.findByText("youtube");
    fireEvent.click(screen.getByRole("button", { name: "Edit youtube Reel" }));
    fireEvent.change(screen.getByLabelText("Display order"), { target: { value: "7" } });
    fireEvent.click(screen.getByLabelText("Active on the public Courses page"));
    fireEvent.click(screen.getByRole("button", { name: "Save Reel" }));
    await waitFor(() => expect(updateReel).toHaveBeenCalledWith("youtube-1", { url: youtube.url, displayOrder: 7, isActive: false }));

    fireEvent.click(screen.getByRole("button", { name: "Delete youtube Reel" }));
    expect(screen.getByText("Delete Reel")).toBeTruthy();
    deleteReel.mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteReel).toHaveBeenCalledWith("youtube-1"));
  });
});
