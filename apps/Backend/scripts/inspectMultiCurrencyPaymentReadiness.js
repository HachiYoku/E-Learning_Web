// Read-only inventory for the multi-currency/manual-payment-method rollout.
// It deliberately uses the native driver and only read operations. It neither
// creates collections nor changes documents, indexes, or application settings.
require("dotenv").config({ quiet: true });

const { MongoClient } = require("mongoose").mongo;
const { assertPaymentIntegrityDatabase } = require("./paymentIntegrityDatabaseGuard");

const REPORTING_PATHS = [
  { file: "apps/Backend/controllers/reportController.js", concern: "Aggregations sum payment amounts without grouping by currency; CSV has no currency column." },
  { file: "apps/Admin/src/pages/Reports/Analytics.jsx", concern: "Summary, charts, CSV/PDF export, and payment table label monetary values as THB/฿." },
  { file: "apps/Admin/src/services/paymentService.js", concern: "Admin payment amounts are formatted with ฿." },
  { file: "apps/Frontend/src/services/courseService.js", concern: "Course and catalogue prices are formatted with ฿." },
  { file: "apps/Frontend/src/services/paymentService.js", concern: "Student payment/order prices are formatted with ฿." },
  { file: "apps/Frontend/src/services/enrollmentService.js", concern: "Enrollment course prices are formatted with ฿." },
  { file: "apps/Frontend/src/pages/Payment.jsx", concern: "Checkout promo summary is hard-coded to ฿." },
  { file: "apps/Admin/src/pages/CourseManagement/AddCourse.jsx", concern: "Course price fields use a single ฿ input." },
  { file: "apps/Admin/src/pages/CourseManagement/EditCourse.jsx", concern: "Course price fields use a single ฿ input." },
  { file: "apps/Admin/src/pages/PromoManagement/PromoCodeForm.jsx", concern: "Fixed promo input is labelled THB." },
  { file: "apps/Admin/src/pages/PromoManagement/PromoCodes.jsx", concern: "Fixed promo list values are labelled THB." },
];

const id = (value) => value == null ? null : String(value);
const finiteNonNegative = (value) => value !== null && value !== undefined
  && Number.isFinite(Number(value)) && Number(value) >= 0;

function classifyFinancialSnapshot(payment) {
  const fields = ["originalAmount", "discountAmount", "amount"];
  const present = fields.filter((field) => payment[field] !== null && payment[field] !== undefined);
  const invalid = present.filter((field) => !finiteNonNegative(payment[field]));
  if (!present.length) return "missing_all_amounts";
  if (invalid.length) return "invalid_amount_field";
  if (present.length !== fields.length) return "partial_amount_snapshot";
  const expected = Number(payment.originalAmount) - Number(payment.discountAmount);
  return Math.abs(expected - Number(payment.amount)) < 0.000001
    ? "complete_consistent_snapshot"
    : "complete_inconsistent_snapshot";
}

function classifyPaymentMethodHistory(payment) {
  if (payment.paymentMethodSnapshot) return "snapshot_present";
  if (payment.paymentMethodId) return "identity_without_snapshot";
  return "missing_method_identity_and_snapshot";
}

function countBy(items, selector) {
  return items.reduce((result, item) => {
    const key = selector(item);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function sample(items, mapper, limit = 50) {
  return items.slice(0, limit).map(mapper);
}

function buildInspectionReport({ databaseName, courses, paymentSettings, payments, promos, paymentMethods = [] }) {
  // originalPrice is optional in the current schema. Its existing runtime
  // meaning is "use price when absent", so inventory it separately rather
  // than incorrectly calling those courses invalid.
  const coursePriceIssues = courses.filter((course) => !finiteNonNegative(course.price)
    || (course.originalPrice !== null && course.originalPrice !== undefined
      && (!finiteNonNegative(course.originalPrice) || Number(course.originalPrice) < Number(course.price))));
  const courseQrs = courses.filter((course) => Boolean(course.paymentQr || course.paymentQrPublicId));
  const globalQrSettings = paymentSettings.filter((settings) => Boolean(settings.paymentQr || settings.paymentQrPublicId));
  const paymentFacts = payments.map((payment) => ({
    payment,
    financialSnapshot: classifyFinancialSnapshot(payment),
    methodHistory: classifyPaymentMethodHistory(payment),
    currencyState: payment.currency ? "currency_present" : "currency_missing",
  }));
  const fixedPromos = promos.filter((promo) => promo.discountType === "fixed");
  const percentPromos = promos.filter((promo) => promo.discountType === "percent");
  const fixedPromosNeedingThbMigration = fixedPromos.filter((promo) => !finiteNonNegative(promo.fixedAmounts?.THB));

  return {
    mode: "read-only",
    database: databaseName,
    inspectedAt: new Date().toISOString(),
    safety: {
      writesPerformed: false,
      note: "This command performs find/list reads only. It does not create PaymentMethod records or alter courses, payments, promos, settings, indexes, or production data.",
    },
    summary: {
      courses: courses.length,
      paymentSettings: paymentSettings.length,
      payments: payments.length,
      promos: promos.length,
      paymentMethods: paymentMethods.length,
      legacyPaymentsMissingCurrency: paymentFacts.filter((item) => item.currencyState === "currency_missing").length,
      legacyPaymentsMissingMethodHistory: paymentFacts.filter((item) => item.methodHistory === "missing_method_identity_and_snapshot").length,
      fixedPromosNeedingThbMigration: fixedPromosNeedingThbMigration.length,
    },
    courses: {
      priceFieldInventory: {
        withPrice: courses.filter((course) => course.price !== null && course.price !== undefined).length,
        withOriginalPrice: courses.filter((course) => course.originalPrice !== null && course.originalPrice !== undefined).length,
        originalPriceMissingUsesPriceFallback: courses.filter((course) => course.originalPrice === null || course.originalPrice === undefined).length,
        validLegacyPricePairsOrFallbacks: courses.length - coursePriceIssues.length,
        invalidLegacyPricePairs: sample(coursePriceIssues, (course) => ({ courseId: id(course._id), title: course.title || null, price: course.price ?? null, originalPrice: course.originalPrice ?? null })),
      },
      currencyPriceInventory: {
        withTHB: courses.filter((course) => course.prices?.THB).length,
        withMMK: courses.filter((course) => course.prices?.MMK).length,
        thbMismatchesFromLegacy: sample(courses.filter((course) => {
          if (!course.prices?.THB || !finiteNonNegative(course.price)) return Boolean(course.prices?.THB);
          const originalPrice = course.originalPrice === null || course.originalPrice === undefined ? Number(course.price) : Number(course.originalPrice);
          return Number(course.prices.THB.price) !== Number(course.price) || Number(course.prices.THB.originalPrice) !== originalPrice;
        }), (course) => ({ courseId: id(course._id), title: course.title || null, legacyPrice: course.price ?? null, legacyOriginalPrice: course.originalPrice ?? null, thb: course.prices?.THB || null })),
      },
      perCourseQr: {
        count: courseQrs.length,
        courses: sample(courseQrs, (course) => ({ courseId: id(course._id), title: course.title || null, hasPaymentQr: Boolean(course.paymentQr), hasPaymentQrPublicId: Boolean(course.paymentQrPublicId) })),
      },
    },
    globalPaymentSettings: {
      count: paymentSettings.length,
      settings: sample(paymentSettings, (settings) => ({ settingsId: id(settings._id), key: settings.key || null, hasPaymentQr: Boolean(settings.paymentQr), hasPaymentQrPublicId: Boolean(settings.paymentQrPublicId), updatedAt: settings.updatedAt || null })),
      settingsWithQr: globalQrSettings.length,
    },
    payments: {
      currency: countBy(paymentFacts, (item) => item.currencyState),
      paymentMethodHistory: countBy(paymentFacts, (item) => item.methodHistory),
      paymentMethodIdentity: countBy(payments, (payment) => payment.paymentMethodId === null ? "explicit_null" : payment.paymentMethodId === undefined ? "missing" : "present"),
      legacyMethodMarkers: payments.filter((payment) => payment.paymentMethodSnapshot?.kind === "legacy" && payment.paymentMethodSnapshot?.reason === "legacy_method_not_captured").length,
      financialSnapshots: countBy(paymentFacts, (item) => item.financialSnapshot),
      legacyRecords: sample(paymentFacts.filter((item) => item.currencyState === "currency_missing" || item.methodHistory === "missing_method_identity_and_snapshot" || item.financialSnapshot !== "complete_consistent_snapshot"), (item) => ({ paymentId: id(item.payment._id), courseId: id(item.payment.courseId), status: item.payment.status || null, currencyState: item.currencyState, methodHistory: item.methodHistory, financialSnapshot: item.financialSnapshot, originalAmount: item.payment.originalAmount ?? null, discountAmount: item.payment.discountAmount ?? null, amount: item.payment.amount ?? null, createdAt: item.payment.createdAt || null })),
    },
    promos: {
      percent: percentPromos.length,
      fixed: fixedPromos.length,
      unsupportedDiscountTypes: promos.filter((promo) => !["percent", "fixed"].includes(promo.discountType)).length,
      fixedPromosNeedingThbCurrencyMigration: sample(fixedPromosNeedingThbMigration, (promo) => ({ promoId: id(promo._id), code: promo.code || null, discountValue: promo.discountValue ?? null, usageCount: promo.usageCount ?? null, hasPaymentHistorySignal: Boolean(promo.usageCount || promo.archivedAt) })),
      fixedAmountCurrencyInventory: {
        withTHB: fixedPromos.filter((promo) => finiteNonNegative(promo.fixedAmounts?.THB)).length,
        withMMK: fixedPromos.filter((promo) => finiteNonNegative(promo.fixedAmounts?.MMK)).length,
        fixedPromos: sample(fixedPromos, (promo) => ({ promoId: id(promo._id), code: promo.code || null, discountValue: promo.discountValue ?? null, fixedAmounts: promo.fixedAmounts || {} })),
      },
    },
    historicalQrLimitations: {
      perCourseQrRecords: courseQrs.length,
      globalQrSettingsWithQr: globalQrSettings.length,
      paymentsWithoutSavedMethodHistory: paymentFacts.filter((item) => item.methodHistory === "missing_method_identity_and_snapshot").length,
      cannotSafelyReconstruct: [
        "Existing payments do not record which course QR or global QR was shown at submission.",
        "PaymentSettings is a mutable singleton and course.paymentQr is mutable; their current values are not reliable historical recipient or instruction snapshots.",
        "Do not attach a newly created PaymentMethod or current QR/account details to historical payments as if it were historical fact.",
      ],
    },
    thbOnlyReportingAndFormattingPaths: REPORTING_PATHS,
  };
}

async function main() {
  if (!process.env.MONGO_DB) throw new Error("MONGO_DB is required.");
  const client = new MongoClient(process.env.MONGO_DB, { readPreference: "primary", readConcern: { level: "majority" } });
  await client.connect();
  try {
    const db = client.db();
    assertPaymentIntegrityDatabase(db);
    const [courses, paymentSettings, payments, promos, paymentMethods] = await Promise.all([
      db.collection("courses").find({}, { projection: { title: 1, price: 1, originalPrice: 1, prices: 1, paymentQr: 1, paymentQrPublicId: 1 } }).toArray(),
      db.collection("paymentsettings").find({}, { projection: { key: 1, paymentQr: 1, paymentQrPublicId: 1, updatedAt: 1 } }).toArray(),
      db.collection("payments").find({}, { projection: { courseId: 1, status: 1, currency: 1, paymentMethodId: 1, paymentMethodSnapshot: 1, originalAmount: 1, discountAmount: 1, amount: 1, createdAt: 1 } }).toArray(),
      db.collection("promocodes").find({}, { projection: { code: 1, discountType: 1, discountValue: 1, fixedAmounts: 1, usageCount: 1, archivedAt: 1 } }).toArray(),
      db.collection("paymentmethods").find({}, { projection: { _id: 1 } }).toArray(),
    ]);
    console.log(JSON.stringify(buildInspectionReport({ databaseName: db.databaseName, courses, paymentSettings, payments, promos, paymentMethods }), null, 2));
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { REPORTING_PATHS, classifyFinancialSnapshot, classifyPaymentMethodHistory, buildInspectionReport };
