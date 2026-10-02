const fs = require('fs');
const path = require('path');
const { renderBrowserReceiptPrototype } = require('../services/paymentReceiptBrowserPrototype');

// DEVELOPMENT ONLY: fixed fake values. This script does not connect to any
// application service, database, Cloudinary account, or email provider.
const OUTPUT_DIRECTORY = path.join('/private/tmp', 'arun-thai-payment-receipt-browser-prototype');

const SAMPLE_RECEIPTS = Object.freeze({
  'thb-discounted': {
    studentName: 'Mg Mg Aung',
    studentEmail: 'student@example.com',
    paymentReference: 'PAY-7KQ4M9DX',
    courseTitle: 'Thai Language for Beginners',
    currency: 'THB',
    originalAmount: 2500,
    discountAmount: 500,
    amount: 2000,
    paymentMethodName: 'KBZPay',
    submittedAt: '2026-10-02T03:10:00.000Z',
    approvedAt: '2026-10-02T05:30:00.000Z',
  },
  'mmk-no-discount': {
    studentName: 'May Thazin',
    studentEmail: 'may.thazin@example.com',
    paymentReference: 'PAY-MMK9A7BC',
    courseTitle: 'Practical Thai Conversation',
    currency: 'MMK',
    originalAmount: 185000,
    discountAmount: 0,
    amount: 185000,
    paymentMethodName: 'KBZPay',
    submittedAt: '2026-10-02T03:10:00.000Z',
    approvedAt: '2026-10-02T05:30:00.000Z',
  },
  'long-content-stress': {
    studentName: 'Aye Chan Thiri Hlaing Win Myint',
    studentEmail: 'aye.chan.thiri.hlaing.win.myint@example-example.com',
    paymentReference: 'PAY-LONG7TEST',
    courseTitle:
      'Thai for Everyday Communication: Guided Speaking, Grammar, Listening, and Workplace Practice',
    currency: 'THB',
    originalAmount: 25000,
    discountAmount: 2500,
    amount: 22500,
    paymentMethodName: 'KBZPay Mobile Banking',
    submittedAt: '2026-10-02T03:10:00.000Z',
    approvedAt: '2026-10-02T05:30:00.000Z',
  },
});

async function main() {
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  for (const [name, receipt] of Object.entries(SAMPLE_RECEIPTS)) {
    const result = await renderBrowserReceiptPrototype(receipt);
    const pdfPath = path.join(OUTPUT_DIRECTORY, `${name}.pdf`);
    const pngPath = path.join(OUTPUT_DIRECTORY, `${name}.png`);
    fs.writeFileSync(pdfPath, result.pdfBuffer);
    fs.writeFileSync(pngPath, result.pngBuffer);
    console.log(`${name}: ${pdfPath} and ${pngPath} (${result.pageCount} A4 page)`);
  }
}

main().catch((error) => {
  console.error('Development browser receipt prototype generation failed:', error);
  process.exitCode = 1;
});

module.exports = { OUTPUT_DIRECTORY, SAMPLE_RECEIPTS };
