const mongoose = require("mongoose");

function paymentError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function assertPaymentDatabaseReady() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") {
    throw paymentError(503, "Payment processing requires a transaction-capable database.");
  }
  const Redemption = require("../models/promoRedemptionModel");
  await Promise.all([
    Redemption.init(),
    require("../models/paymentModel").init(),
    require("../models/enrollmentModel").init(),
    require("../models/paymentProofCleanupModel").init(),
  ]);
  const indexes = await Redemption.collection.indexes();
  if (!indexes.some((index) => index.name === "active_promo_user_unique" && index.unique && index.partialFilterExpression?.active === true)
    || indexes.some((index) => index.unique && index.key.promoCode && index.key.userId && !index.partialFilterExpression)
    || await Redemption.exists({ active: { $exists: false } })) {
    throw paymentError(503, "Payment processing is unavailable until the redemption migration is complete.");
  }
}

async function paymentTransaction(work) {
  await assertPaymentDatabaseReady();
  return mongoose.connection.transaction(work, {
    readPreference: "primary",
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  });
}

module.exports = { paymentError, paymentTransaction, assertPaymentDatabaseReady };
