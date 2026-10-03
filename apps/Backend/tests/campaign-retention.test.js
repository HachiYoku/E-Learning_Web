const assert = require("node:assert/strict");
const test = require("node:test");
const Campaign = require("../models/campaignModel");
const Cleanup = require("../models/campaignAssetCleanupModel");
const { campaignExpiry, isOwnedCampaignAsset } = require("../services/campaignLifecycle");

test("campaign lifecycle uses calendar twelve-month expiry without a Mongo TTL index", () => {
  assert.equal(campaignExpiry(new Date("2024-02-29T10:00:00.000Z")).toISOString(), "2025-02-28T10:00:00.000Z");
  assert.equal(Campaign.schema.indexes().some(([, options]) => options.expireAfterSeconds != null), false);
  assert.equal(Campaign.schema.path("expiresAt").options.required, true);
});

test("only dedicated campaign public IDs are eligible for automated cleanup", () => {
  assert.equal(isOwnedCampaignAsset("english_kafe/campaigns/campaign-1"), true);
  assert.equal(isOwnedCampaignAsset("english_kafe/avatars/student-1"), false);
  assert.equal(isOwnedCampaignAsset(""), false);
  assert.equal(Cleanup.schema.path("publicId").options.unique, true);
  assert.equal(Cleanup.schema.path("removeCampaign").options.default, false);
});
