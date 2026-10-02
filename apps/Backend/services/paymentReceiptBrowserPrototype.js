const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// DEVELOPMENT ONLY: a renderer comparison. It has no database, payment-flow,
// email, Cloudinary, or UI dependency and accepts only fake receipt data.
const ASSET_DIRECTORY = path.join(__dirname, '..', 'assets');
const FONT_PATH = path.join(ASSET_DIRECTORY, 'fonts', 'NotoSansMyanmar-Regular.ttf');
const LOGO_PATH = path.join(ASSET_DIRECTORY, 'branding', 'Arun-thai-web-logo.png');

const RECEIPT_COPY = Object.freeze({
  receiptTitleMy: 'ငွေပေးချေမှု ပြေစာ',
  receiptTitleEn: 'Payment Receipt',
  approvedMy: 'ငွေပေးချေမှုကို အတည်ပြုပြီးပါပြီ',
  approvedEn: 'Payment Approved',
  studentMy: 'သင်တန်းသား အမည်',
  studentEn: 'Student',
  courseMy: 'သင်တန်း ခေါင်းစဉ်',
  courseEn: 'Course',
  originalPriceMy: 'မူရင်း စျေးနှုန်း',
  originalPriceEn: 'Original Price',
  discountMy: 'လျှော့ဈေး',
  discountEn: 'Discount',
  amountPaidMy: 'ပေးချေခဲ့သည့် ပမာဏ',
  amountPaidEn: 'Amount Paid',
  paymentReferenceMy: 'ငွေပေးချေမှု အမှတ်စဉ်',
  paymentReferenceEn: 'Payment Reference',
  paymentMethodMy: 'ငွေပေးချေသည့် နည်းလမ်း',
  paymentMethodEn: 'Payment Method',
  submittedMy: 'ငွေပေးချေမှု တင်ပြသည့် ရက်စွဲ',
  submittedEn: 'Payment Submitted',
  approvedDateMy: 'ငွေပေးချေမှု အတည်ပြုသည့် ရက်စွဲ',
  approvedDateEn: 'Payment Approved',
  thankYouEn: 'Thank you for learning with Arun Thai.',
  questionsEn: 'Questions about this payment?',
  contactEn: 'Contact Arun Thai',
  supportEmail: 'arunthaiedu@gmail.com',
  contactReferenceEn: 'Please include your Payment Reference when contacting us.',
  confirmationEn:
    'This receipt confirms payment received by Arun Thai for the course shown above.',
  notTaxInvoiceEn: 'This is not a tax invoice.',
});

const REQUIRED_FIELDS = Object.freeze([
  'studentName',
  'studentEmail',
  'paymentReference',
  'courseTitle',
  'amount',
  'originalAmount',
  'discountAmount',
  'currency',
  'paymentMethodName',
  'submittedAt',
  'approvedAt',
]);

const PROHIBITED_FIELDS = Object.freeze([
  '_id',
  'id',
  'userId',
  'courseId',
  'paymentMethodId',
  'reviewedBy',
  'proofUrl',
  'proofPublicId',
  'cloudinaryPublicId',
  'accountNumber',
  'bankDetails',
  'qrUrl',
]);

function validateReceiptInput(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new TypeError('Receipt input must be a plain object.');
  }
  for (const field of REQUIRED_FIELDS) {
    if (receipt[field] === undefined || receipt[field] === null || receipt[field] === '') {
      throw new TypeError(`Receipt input requires ${field}.`);
    }
  }
  for (const field of PROHIBITED_FIELDS) {
    if (Object.hasOwn(receipt, field)) {
      throw new TypeError(`Receipt input must not include prohibited field ${field}.`);
    }
  }
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(receipt.paymentReference)) {
    throw new TypeError('Payment Reference has an invalid format.');
  }
  if (!['THB', 'MMK'].includes(receipt.currency)) {
    throw new TypeError('Currency must be THB or MMK.');
  }
  for (const field of ['amount', 'originalAmount', 'discountAmount']) {
    if (!Number.isFinite(receipt[field]) || receipt[field] < 0) {
      throw new TypeError(`${field} must be a non-negative number.`);
    }
  }
}

function formatReceiptDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('Receipt date must be valid.');
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatAmount(value, currency) {
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)} ${currency}`;
}

function buildPaymentRows(receipt) {
  const rows = [
    [RECEIPT_COPY.originalPriceMy, RECEIPT_COPY.originalPriceEn, formatAmount(receipt.originalAmount, receipt.currency)],
  ];
  if (receipt.discountAmount > 0) {
    rows.push([RECEIPT_COPY.discountMy, RECEIPT_COPY.discountEn, `-${formatAmount(receipt.discountAmount, receipt.currency)}`]);
  }
  rows.push([RECEIPT_COPY.amountPaidMy, RECEIPT_COPY.amountPaidEn, formatAmount(receipt.amount, receipt.currency)]);
  return rows;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function toDataUrl(filePath, mimeType) {
  return `data:${mimeType};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function isExternalNetworkUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function runHook(hook, details) {
  if (typeof hook === 'function') hook(details);
}

function bilingualLabel(myanmar, english) {
  return `<div class="label-my">${escapeHtml(myanmar)}</div><div class="label-en">${escapeHtml(english)}</div>`;
}

function createReceiptHtml(receipt) {
  validateReceiptInput(receipt);
  const fontDataUrl = toDataUrl(FONT_PATH, 'font/ttf');
  const logoDataUrl = toDataUrl(LOGO_PATH, 'image/png');
  const pricingRows = buildPaymentRows(receipt)
    .map(([myanmar, english, amount], index, rows) => `
      <tr class="${index === rows.length - 1 ? 'amount-paid' : ''}">
        <td>${bilingualLabel(myanmar, english)}</td>
        <td class="amount">${escapeHtml(amount)}</td>
      </tr>`)
    .join('');
  const detail = (myanmar, english, value) => `
    <div class="detail">${bilingualLabel(myanmar, english)}<div class="detail-value">${escapeHtml(value)}</div></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
@font-face { font-family: "ArunThaiMyanmar"; src: url("${fontDataUrl}") format("truetype"); font-style: normal; font-weight: 400; font-display: block; }
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
html, body { width: 210mm; min-height: 297mm; margin: 0; background: #fff; color: #2D2E30; }
body { font-family: Arial, Helvetica, sans-serif; }
.receipt { width: 210mm; min-height: 297mm; padding: 12mm 16mm 9mm 10mm; position: relative; overflow: hidden; }
.my, .label-my { font-family: "ArunThaiMyanmar", sans-serif; font-weight: 400; }
.label-my { font-size: 9.5pt; line-height: 1.5; color: #2D2E30; }
.label-en { font-size: 6.8pt; line-height: 1.3; color: #6F625C; margin-top: 1px; letter-spacing: .01em; }
.header { position: relative; min-height: 33mm; border-bottom: 2px solid #E58C1A; }
.header::after { content: ""; position: absolute; left: 0; right: 0; bottom: -5px; border-bottom: 1px solid #D8D1CB; }
.logo { width: 47mm; height: auto; display: block; margin-left: -8.3mm; }
.header-contact { margin-top: 3mm; color: #6F625C; font-size: 7pt; line-height: 1.45; }
.document-heading { display: flex; justify-content: space-between; gap: 12mm; padding-top: 7mm; align-items: flex-start; }
.title .my { font-size: 24pt; line-height: 1.35; }
.title .en { margin-top: 1mm; font-size: 9.5pt; color: #6F625C; }
.reference { min-width: 51mm; text-align: right; padding-top: 2mm; }
.approval { color: #C97112; border-left: 1.2mm solid #F8C56A; padding-left: 3mm; }
.approval .my { font-size: 9pt; line-height: 1.45; }
.approval .en { font-size: 7pt; margin-top: .5mm; }
.reference-value { margin-top: 4mm; font-size: 11pt; letter-spacing: .04em; font-weight: 700; }
.identity { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #D8D1CB; margin-top: 6mm; }
.identity-item { min-height: 22mm; padding: 3.1mm 4mm; }
.identity-item + .identity-item { border-left: 1px solid #D8D1CB; }
.identity-value { font-size: 10pt; margin-top: 2.4mm; line-height: 1.35; overflow-wrap: anywhere; }
.student-email { color: #6F625C; font-size: 7.5pt; margin-top: 1.2mm; overflow-wrap: anywhere; }
table { width: 100%; border-collapse: collapse; margin-top: 5mm; }
thead { background: #2D2E30; color: #fff; }
th { font-size: 7pt; font-weight: 600; letter-spacing: .015em; text-align: left; padding: 3mm 4mm; }
th:last-child { text-align: right; }
td { border: 1px solid #D8D1CB; padding: 2.7mm 4mm; vertical-align: middle; }
td.amount { width: 38%; text-align: right; font-size: 10pt; white-space: nowrap; }
.amount-paid td { color: #C97112; }
.amount-paid .label-my { font-size: 10pt; }
.amount-paid td.amount { font-size: 13pt; font-weight: 700; }
.details { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 11mm; margin-top: 5mm; }
.detail-value { font-size: 9pt; line-height: 1.4; margin-top: 2mm; overflow-wrap: anywhere; }
.footer { border-top: 1px solid #D8D1CB; margin-top: 5mm; padding-top: 4mm; max-width: 100%; }
.footer-thank-you { color: #2D2E30; font-size: 9pt; font-weight: 600; line-height: 1.4; }
.footer-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 12mm; margin-top: 3mm; }
.footer-column { min-width: 0; }
.footer-en { color: #6F625C; font-size: 6.7pt; line-height: 1.45; }
.footer-item + .footer-item { margin-top: 2.1mm; }
.footer-contact-label { color: #2D2E30; font-size: 7.4pt; font-weight: 600; }
.footer-contact { color: #C97112; font-size: 8pt; font-weight: 700; }
@media print { html, body { background: #fff; } .receipt { break-inside: avoid; } }
</style>
</head>
<body>
<main class="receipt">
  <header class="header">
    <img class="logo" src="${logoDataUrl}" alt="Arun Thai Language Center">
    <div class="header-contact">Arun Thai Language Center<br>${RECEIPT_COPY.supportEmail}</div>
  </header>
  <section class="document-heading">
    <div class="title"><div class="my">${RECEIPT_COPY.receiptTitleMy}</div><div class="en">${RECEIPT_COPY.receiptTitleEn}</div></div>
    <div class="reference"><div class="approval"><div class="my">${RECEIPT_COPY.approvedMy}</div><div class="en">${RECEIPT_COPY.approvedEn}</div></div><div class="reference-value">${escapeHtml(receipt.paymentReference)}</div></div>
  </section>
  <section class="identity">
    <div class="identity-item">${bilingualLabel(RECEIPT_COPY.studentMy, RECEIPT_COPY.studentEn)}<div class="identity-value">${escapeHtml(receipt.studentName)}</div><div class="student-email">${escapeHtml(receipt.studentEmail)}</div></div>
    <div class="identity-item">${bilingualLabel(RECEIPT_COPY.courseMy, RECEIPT_COPY.courseEn)}<div class="identity-value">${escapeHtml(receipt.courseTitle)}</div></div>
  </section>
  <table aria-label="Payment amount"><thead><tr><th>Course / Payment description</th><th>Amount</th></tr></thead><tbody>${pricingRows}</tbody></table>
  <section class="details">
    ${detail(RECEIPT_COPY.paymentReferenceMy, RECEIPT_COPY.paymentReferenceEn, receipt.paymentReference)}
    ${detail(RECEIPT_COPY.paymentMethodMy, RECEIPT_COPY.paymentMethodEn, receipt.paymentMethodName)}
    ${detail(RECEIPT_COPY.submittedMy, RECEIPT_COPY.submittedEn, formatReceiptDate(receipt.submittedAt))}
    ${detail(RECEIPT_COPY.approvedDateMy, RECEIPT_COPY.approvedDateEn, formatReceiptDate(receipt.approvedAt))}
  </section>
  <footer class="footer">
    <div class="footer-thank-you">${RECEIPT_COPY.thankYouEn}</div>
    <div class="footer-grid">
      <section class="footer-column footer-left">
        <div class="footer-en footer-item">${RECEIPT_COPY.questionsEn}</div>
        <div class="footer-contact-label footer-item">${RECEIPT_COPY.contactEn}</div>
        <div class="footer-contact footer-item">${RECEIPT_COPY.supportEmail}</div>
        <div class="footer-en footer-item">${RECEIPT_COPY.contactReferenceEn}</div>
      </section>
      <section class="footer-column footer-right">
        <div class="footer-en footer-item">${RECEIPT_COPY.confirmationEn}</div>
        <div class="footer-en footer-item">${RECEIPT_COPY.notTaxInvoiceEn}</div>
      </section>
    </div>
  </footer>
</main>
</body>
</html>`;
}

function pageCount(pdfBuffer) {
  return (pdfBuffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
}

async function renderBrowserReceiptPrototype(receipt, options = {}) {
  validateReceiptInput(receipt);
  if (!fs.existsSync(FONT_PATH) || !fs.existsSync(LOGO_PATH)) {
    throw new Error('Receipt browser prototype assets are missing.');
  }

  const launchStartedAt = process.hrtime.bigint();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const launchDurationMs = Number(process.hrtime.bigint() - launchStartedAt) / 1e6;
    runHook(options.onBrowserLaunched, { launchDurationMs });
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
    const externalRequests = [];
    page.on('request', (request) => {
      const url = request.url();
      if (isExternalNetworkUrl(url)) externalRequests.push(url);
    });
    await page.route('**/*', (route) => {
      if (isExternalNetworkUrl(route.request().url())) return route.abort('blockedbyclient');
      return route.continue();
    });
    const html = createReceiptHtml(receipt);
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(async () => document.fonts.ready);
    const fontLoaded = await page.evaluate(() => document.fonts.check('16px ArunThaiMyanmar'));
    if (!fontLoaded) throw new Error('The bundled ArunThaiMyanmar font did not load in Chromium.');
    if (externalRequests.length > 0) throw new Error('Receipt attempted external network resources.');

    const pdfStartedAt = process.hrtime.bigint();
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      printBackground: true,
      preferCSSPageSize: true,
    });
    const pdfDurationMs = Number(process.hrtime.bigint() - pdfStartedAt) / 1e6;
    runHook(options.onPdfGenerated, { pdfDurationMs, pdfBytes: pdfBuffer.length });
    const pngBuffer = await page.screenshot({ fullPage: true, type: 'png' });
    const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    if (documentHeight > viewportHeight) {
      throw new Error(`Receipt browser layout overflowed one page (${documentHeight}px > ${viewportHeight}px).`);
    }
    return { pdfBuffer, pngBuffer, html, fontLoaded, externalRequests, pageCount: pageCount(pdfBuffer), launchDurationMs, pdfDurationMs };
  } finally {
    if (browser) {
      await browser.close();
      runHook(options.onBrowserClosed, {});
    }
  }
}

module.exports = {
  FONT_PATH,
  LOGO_PATH,
  PROHIBITED_FIELDS,
  RECEIPT_COPY,
  buildPaymentRows,
  createReceiptHtml,
  formatReceiptDate,
  isExternalNetworkUrl,
  pageCount,
  renderBrowserReceiptPrototype,
  validateReceiptInput,
};
