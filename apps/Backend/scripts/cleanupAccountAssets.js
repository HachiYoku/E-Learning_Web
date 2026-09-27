require("dotenv").config();
const mongoose = require("mongoose");
const AccountAssetCleanup = require("../models/accountAssetCleanupModel");
const { retryPendingAccountAssets } = require("../services/accountAssetCleanup");

async function main() {
  await mongoose.connect(process.env.MONGO_DB);
  const results = await retryPendingAccountAssets({ limit: Number(process.env.ACCOUNT_ASSET_CLEANUP_LIMIT || 50) });
  const remaining = await AccountAssetCleanup.countDocuments();
  console.log(JSON.stringify({ attempted: results.length, remainingAccountAssetCleanupRecords: remaining }));
  if (remaining) process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
