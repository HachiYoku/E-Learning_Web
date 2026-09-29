require("dotenv").config();
const mongoose = require("mongoose");
const { processExpiredCampaigns } = require("../services/campaignLifecycle");

async function main() {
  await mongoose.connect(process.env.MONGO_DB);
  const results = await processExpiredCampaigns({ limit: Number(process.env.CAMPAIGN_CLEANUP_LIMIT || 50) });
  console.log(JSON.stringify({ processed: results.length, retryableFailures: results.filter((item) => item.retryable).length }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
