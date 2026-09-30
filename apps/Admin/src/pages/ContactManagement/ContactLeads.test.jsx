import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContactLeads from "./ContactLeads";

vi.mock("../../services/contactLeadService", () => ({
  fetchContactLeads: vi.fn(),
  fetchContactEnquiries: vi.fn(),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

const renderPage = () => render(<ContactLeads />);

describe("ContactLeads", () => {
  it("shows distinct consent states and does not read enquiries while listing", async () => {
    const service = await import("../../services/contactLeadService");
    service.fetchContactLeads.mockResolvedValue([
      { _id: "one", name: "Maya", email: "maya@example.com", marketingConsent: { status: "never_subscribed" }, latestEnquiry: "Question", unreadEnquiryCount: 2 },
      { _id: "two", name: "Nok", email: "nok@example.com", marketingConsent: { status: "subscribed" }, latestEnquiry: "Hello", unreadEnquiryCount: 0 },
      { _id: "three", name: "Lin", email: "lin@example.com", marketingConsent: { status: "unsubscribed" }, latestEnquiry: "Please help", unreadEnquiryCount: 1 },
    ]);
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Never subscribed").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Subscribed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unsubscribed").length).toBeGreaterThan(0);
    expect(screen.getByText("2 unread · Latest —")).toBeTruthy();
    expect(service.fetchContactEnquiries).not.toHaveBeenCalled();
  });

  it("loads and marks only the opened contact history", async () => {
    const service = await import("../../services/contactLeadService");
    service.fetchContactLeads.mockResolvedValue([{ _id: "one", name: "Maya", email: "maya@example.com", marketingConsent: { status: "never_subscribed" }, latestEnquiry: "Question", unreadEnquiryCount: 2 }]);
    service.fetchContactEnquiries.mockResolvedValue({ enquiries: [{ _id: "enquiry-1", message: "First question", submittedAt: "2026-01-01" }] });
    renderPage();

    await waitFor(() => expect(screen.getAllByText("Question").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("button", { name: /open history/i })[0]);
    await waitFor(() => expect(service.fetchContactEnquiries).toHaveBeenCalledWith("one"));
    expect(await screen.findByText("First question")).toBeTruthy();
  });
});
