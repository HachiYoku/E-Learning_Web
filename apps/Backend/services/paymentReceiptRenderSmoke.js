const crypto = require('crypto');
const { renderBrowserReceiptPrototype } = require('./paymentReceiptBrowserPrototype');

const RECEIPT_SMOKE_SECRET_HEADER = 'x-receipt-smoke-secret';

const SYNTHETIC_RECEIPT = Object.freeze({
  studentName: 'Render Smoke Test Student',
  studentEmail: 'receipt-smoke@example.invalid',
  paymentReference: 'PAY-TEST1234',
  courseTitle: 'Thai Language for Beginners',
  currency: 'THB',
  originalAmount: 2500,
  discountAmount: 500,
  amount: 2000,
  paymentMethodName: 'Test Payment Method',
  submittedAt: '2026-10-02T03:10:00.000Z',
  approvedAt: '2026-10-02T05:30:00.000Z',
});

function nodeMemorySnapshot() {
  const { rss, heapUsed, external } = process.memoryUsage();
  return { rss, heapUsed, external };
}

function durationMs(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1e6;
}

function isReceiptSmokeEnabled(env = process.env) {
  return typeof env.RECEIPT_SMOKE_TEST_SECRET === 'string'
    && env.RECEIPT_SMOKE_TEST_SECRET.length > 0;
}

function isAuthorizedReceiptSmokeRequest(value, env = process.env) {
  if (!isReceiptSmokeEnabled(env) || typeof value !== 'string') return false;
  const expected = Buffer.from(env.RECEIPT_SMOKE_TEST_SECRET);
  const received = Buffer.from(value);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function classifyReceiptSmokeError(error) {
  const message = String(error?.message || '');
  if (/executable.*does not exist|browser.*not found/i.test(message)) return 'browser_executable_missing';
  if (/sandbox/i.test(message)) return 'browser_sandbox_failure';
  if (/font/i.test(message)) return 'font_load_failure';
  if (/asset/i.test(message)) return 'asset_load_failure';
  if (/external network/i.test(message)) return 'external_network_request';
  if (/pdf/i.test(message)) return 'pdf_generation_failure';
  return 'receipt_render_failure';
}

async function renderSyntheticReceipt(run, renderer = renderBrowserReceiptPrototype) {
  const startedAt = process.hrtime.bigint();
  const diagnostics = {
    run,
    nodeMemory: { beforeLaunch: nodeMemorySnapshot() },
  };
  const result = await renderer(SYNTHETIC_RECEIPT, {
    onBrowserLaunched: ({ launchDurationMs }) => {
      diagnostics.launchDurationMs = launchDurationMs;
      diagnostics.nodeMemory.afterLaunch = nodeMemorySnapshot();
    },
    onPdfGenerated: ({ pdfDurationMs, pdfBytes }) => {
      diagnostics.pdfDurationMs = pdfDurationMs;
      diagnostics.pdfBytes = pdfBytes;
      diagnostics.nodeMemory.afterPdf = nodeMemorySnapshot();
    },
    onBrowserClosed: () => {
      diagnostics.nodeMemory.afterClose = nodeMemorySnapshot();
      diagnostics.browserClosed = true;
    },
  });

  if (!Buffer.isBuffer(result.pdfBuffer) || result.pdfBuffer.length === 0) {
    throw new Error('Receipt smoke generated an empty PDF buffer.');
  }
  if (result.pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Receipt smoke generated an invalid PDF signature.');
  }
  if (result.pageCount !== 1) throw new Error('Receipt smoke did not generate one A4 page.');
  if (!result.fontLoaded) throw new Error('Receipt smoke did not load the local Myanmar font.');
  if (result.externalRequests.length !== 0) throw new Error('Receipt attempted external network resources.');

  diagnostics.totalRenderDurationMs = durationMs(startedAt);
  diagnostics.pdfBytes = result.pdfBuffer.length;
  diagnostics.pageCount = result.pageCount;
  diagnostics.fontLoaded = result.fontLoaded;
  diagnostics.externalRequests = result.externalRequests.length;
  return { diagnostics, pdfBuffer: result.pdfBuffer };
}

async function runReceiptRenderSmoke({ renderer = renderBrowserReceiptPrototype } = {}) {
  const startedAt = process.hrtime.bigint();
  const first = await renderSyntheticReceipt(1, renderer);
  const second = await renderSyntheticReceipt(2, renderer);
  return {
    diagnostics: {
      syntheticData: true,
      renderer: 'playwright-chromium',
      overallDurationMs: durationMs(startedAt),
      renders: [first.diagnostics, second.diagnostics],
      finalNodeMemory: nodeMemorySnapshot(),
    },
    pdfBuffer: second.pdfBuffer,
  };
}

module.exports = {
  RECEIPT_SMOKE_SECRET_HEADER,
  SYNTHETIC_RECEIPT,
  classifyReceiptSmokeError,
  isAuthorizedReceiptSmokeRequest,
  isReceiptSmokeEnabled,
  nodeMemorySnapshot,
  runReceiptRenderSmoke,
};
