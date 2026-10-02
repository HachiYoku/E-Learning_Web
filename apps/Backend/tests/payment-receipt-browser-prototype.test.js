const assert = require('assert/strict');
const test = require('node:test');
const {
  PROHIBITED_FIELDS,
  RECEIPT_COPY,
  buildPaymentRows,
  createReceiptHtml,
  formatReceiptDate,
  isExternalNetworkUrl,
  renderBrowserReceiptPrototype,
  validateReceiptInput,
} = require('../services/paymentReceiptBrowserPrototype');

const primarySample = Object.freeze({
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
});

test('renders a local-font, one-page Chromium PDF buffer without external requests', async () => {
  const result = await renderBrowserReceiptPrototype(primarySample);

  assert.ok(Buffer.isBuffer(result.pdfBuffer));
  assert.ok(Buffer.isBuffer(result.pngBuffer));
  assert.equal(result.pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.equal(result.pageCount, 1);
  assert.equal(result.fontLoaded, true);
  assert.deepEqual(result.externalRequests, []);
});

test('identifies only HTTP(S) resources as external network requests', () => {
  assert.equal(isExternalNetworkUrl('https://cdn.example.test/receipt.css'), true);
  assert.equal(isExternalNetworkUrl('http://example.test/image.png'), true);
  assert.equal(isExternalNetworkUrl('data:text/plain,local'), false);
  assert.equal(isExternalNetworkUrl('about:blank'), false);
});

test('renders the MMK no-discount case without a zero Discount row', async () => {
  const receipt = {
    ...primarySample,
    paymentReference: 'PAY-MMK9A7BC',
    currency: 'MMK',
    originalAmount: 185000,
    discountAmount: 0,
    amount: 185000,
  };
  const result = await renderBrowserReceiptPrototype(receipt);

  assert.equal(result.pageCount, 1);
  assert.deepEqual(buildPaymentRows(receipt).map(([, english]) => english), [
    RECEIPT_COPY.originalPriceEn,
    RECEIPT_COPY.amountPaidEn,
  ]);
});

test('keeps the deterministic long-content stress sample to one A4 page', async () => {
  const receipt = {
    ...primarySample,
    studentName: 'Aye Chan Thiri Hlaing Win Myint',
    studentEmail: 'aye.chan.thiri.hlaing.win.myint@example-example.com',
    paymentReference: 'PAY-LONG7TEST',
    courseTitle:
      'Thai for Everyday Communication: Guided Speaking, Grammar, Listening, and Workplace Practice',
    originalAmount: 25000,
    discountAmount: 2500,
    amount: 22500,
    paymentMethodName: 'KBZPay Mobile Banking',
  };
  const result = await renderBrowserReceiptPrototype(receipt);

  assert.equal(result.pageCount, 1);
  assert.equal(result.fontLoaded, true);
});

test('keeps exact Burmese copy, Bangkok dates, student email, and Payment Reference in local HTML', () => {
  const html = createReceiptHtml(primarySample);
  const phrases = [
    ...Object.values(RECEIPT_COPY).filter((text) => /[\u1000-\u109f]/u.test(text)),
  ];

  for (const phrase of phrases) assert.ok(html.includes(phrase), `Missing exact Burmese phrase: ${phrase}`);
  assert.ok(html.includes('student@example.com'));
  assert.ok(html.includes('PAY-7KQ4M9DX'));
  assert.equal(formatReceiptDate('2026-10-01T18:30:00.000Z'), '02 October 2026');
});

test('uses the shared content guide and approved two-column English-only footer', () => {
  const html = createReceiptHtml(primarySample);
  const removedFooterLines = [
    'Arun Thai နှင့်အတူ သင်ယူလေ့လာသည့်အတွက် ကျေးဇူးတင်ရှိပါသည်။',
    'ယခုငွေပေးချေမှုနဲ့ ပတ်သက်ပြီး မေးမြန်းလိုသည်များ ရှိပါသလား။',
    'ဆက်သွယ်မေးမြန်းသည့်အခါ ကျေးဇူးပြု၍ "ငွေပေးချေမှု အမှတ်စဉ်" ကို အတူတကွ ပူးတွဲဖော်ပြပေးပါရန်။',
    'ဤပြေစာသည် အထက်ပါ သင်တန်းအတွက် Arun Thai မှ ငွေပေးချေမှု လက်ခံရရှိကြောင်း အတည်ပြုချက် ဖြစ်ပါသည်။',
    'ဤစာရွက်သည် အခွန်ပြေစာ (Tax Invoice) မဟုတ်ပါ။',
  ];

  for (const line of removedFooterLines) assert.equal(html.includes(line), false);
  assert.equal(html.includes('Arun Thai သို့ ဆက်သွယ်ရန်'), false);
  for (const line of [
    RECEIPT_COPY.thankYouEn,
    RECEIPT_COPY.questionsEn,
    RECEIPT_COPY.contactReferenceEn,
    RECEIPT_COPY.confirmationEn,
    RECEIPT_COPY.notTaxInvoiceEn,
    RECEIPT_COPY.contactEn,
    RECEIPT_COPY.supportEmail,
  ]) assert.ok(html.includes(line), `Missing retained footer content: ${line}`);

  assert.match(html, /\.receipt \{[^}]*padding: 12mm 16mm 9mm 10mm/);
  assert.match(html, /\.logo \{ width: 47mm;[^}]*margin-left: -8\.3mm/);
  assert.doesNotMatch(html, /\.header \{[^}]*margin-left/);
  assert.doesNotMatch(html, /\.title \{[^}]*margin-left/);
  assert.match(html, /\.footer-thank-you \{[^}]*font-size: 9pt;[^}]*font-weight: 600/);
  assert.match(html, /\.footer-grid \{ display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\); gap: 0 12mm/);
  assert.match(html, /<footer class="footer">\s*<div class="footer-thank-you">Thank you for learning with Arun Thai\.<\/div>\s*<div class="footer-grid">/);
  assert.match(html, /<section class="footer-column footer-left">[\s\S]*Questions about this payment\?[\s\S]*Contact Arun Thai[\s\S]*arunthaiedu@gmail\.com[\s\S]*Please include your Payment Reference when contacting us\./);
  assert.match(html, /<section class="footer-column footer-right">[\s\S]*This receipt confirms payment received by Arun Thai for the course shown above\.[\s\S]*This is not a tax invoice\./);
  assert.doesNotMatch(html, /footer-my|footer-section/);
  assert.doesNotMatch(html, /accent-top|accent-bottom|clip-path/);
});

test('rejects prohibited internal/payment-proof input fields', () => {
  for (const field of PROHIBITED_FIELDS) {
    assert.throws(
      () => validateReceiptInput({ ...primarySample, [field]: 'not-for-a-receipt' }),
      new RegExp(`prohibited field ${field}`)
    );
  }
});
