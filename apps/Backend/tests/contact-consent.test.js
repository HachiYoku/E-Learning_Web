const assert = require("node:assert/strict");
const test = require("node:test");
const { currentConsent, resolveConsentTransition } = require("../controllers/contactController");
const ContactLead = require("../models/contactLeadModel");
const ContactEnquiry = require("../models/contactEnquiryModel");

test("an unchecked or missing opt-in cannot create or revoke marketing consent", () => {
  const never = resolveConsentTransition({ status: "never_subscribed" }, false);
  const subscriber = resolveConsentTransition({ status: "subscribed", lastOptInSource: "contact_form" }, false);
  const formerSubscriber = resolveConsentTransition({ status: "unsubscribed", withdrawnAt: new Date("2026-01-01") }, false);

  assert.equal(never.consent.status, "never_subscribed");
  assert.equal(subscriber.consent.status, "subscribed");
  assert.equal(formerSubscriber.consent.status, "unsubscribed");
  assert.equal(never.shouldSendConfirmation, false);
  assert.equal(subscriber.shouldSendConfirmation, false);
});

test("an explicit opt-in subscribes never-subscribed and unsubscribed contacts", () => {
  for (const status of ["never_subscribed", "unsubscribed"]) {
    const result = resolveConsentTransition({ status }, true);
    assert.equal(result.consent.status, "subscribed");
    assert.equal(result.consent.lastOptInSource, "contact_form");
    assert.ok(result.consent.lastOptedInAt instanceof Date);
    assert.equal(result.shouldSendConfirmation, true);
  }
});

test("a legacy marketingOptIn value is not treated as marketing consent", () => {
  const consent = currentConsent({ marketingOptIn: true });
  const explicitOptIn = resolveConsentTransition(consent, true);

  assert.equal(consent.status, "never_subscribed");
  assert.equal(resolveConsentTransition(consent, false).consent.status, "never_subscribed");
  assert.equal(explicitOptIn.consent.status, "subscribed");
  assert.equal(explicitOptIn.shouldSendConfirmation, true);
});

test("an explicit opt-in refreshes consent provenance without re-sending confirmation", () => {
  const result = resolveConsentTransition({ status: "subscribed", withdrawnAt: new Date("2025-01-01") }, true);
  assert.equal(result.consent.status, "subscribed");
  assert.equal(result.consent.lastOptInSource, "contact_form");
  assert.ok(result.consent.lastOptedInAt instanceof Date);
  assert.equal(result.shouldSendConfirmation, false);
});

test("the data model keeps one contact identity and normalizes enquiries", () => {
  const lead = new ContactLead({ name: "Maya", email: " MAYA@EXAMPLE.COM ", marketingConsent: { status: "subscribed" } });
  const enquiry = new ContactEnquiry({ contactLead: lead._id, message: "First enquiry" });

  assert.equal(lead.email, "maya@example.com");
  assert.equal(lead.marketingConsent.status, "subscribed");
  assert.equal(enquiry.isRead, false);
  assert.ok(enquiry.submittedAt instanceof Date);
  assert.equal(ContactLead.schema.path("message"), undefined);
  assert.equal(ContactEnquiry.schema.path("contactLead").instance, "ObjectId");
});
