require("dotenv").config(); const mongoose = require("mongoose"); const { processPaymentMethodQrCleanup } = require("../services/paymentMethodQrCleanup");
mongoose.connect(process.env.MONGO_DB)
  .then(async () => console.log(JSON.stringify(await processPaymentMethodQrCleanup({ limit: Number(process.env.PAYMENT_METHOD_QR_CLEANUP_LIMIT || 50) }))))
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
