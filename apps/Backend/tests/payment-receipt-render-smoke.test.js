const assert = require('assert/strict');
const express = require('express');
const http = require('http');
const test = require('node:test');
const {
  RECEIPT_SMOKE_SECRET_HEADER,
  SYNTHETIC_RECEIPT,
  classifyReceiptSmokeError,
  isAuthorizedReceiptSmokeRequest,
  isReceiptSmokeEnabled,
  runReceiptRenderSmoke,
} = require('../services/paymentReceiptRenderSmoke');
const { createReceiptRenderSmokeRouter } = require('../routes/receiptRenderSmoke');

const smokeEnv = Object.freeze({ RECEIPT_SMOKE_TEST_SECRET: 'test-only-receipt-smoke-secret' });

function fakeRenderer(receipt, options) {
  assert.deepEqual(receipt, SYNTHETIC_RECEIPT);
  options.onBrowserLaunched({ launchDurationMs: 12 });
  const pdfBuffer = Buffer.from('%PDF- synthetic receipt');
  options.onPdfGenerated({ pdfDurationMs: 9, pdfBytes: pdfBuffer.length });
  options.onBrowserClosed();
  return Promise.resolve({ pdfBuffer, pageCount: 1, fontLoaded: true, externalRequests: [] });
}

async function withSmokeServer(options, action) {
  const app = express();
  app.use('/internal', createReceiptRenderSmokeRouter(options));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    return await action(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('disables the smoke endpoint without its dedicated environment secret', async () => {
  await withSmokeServer({ env: {} }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/internal/receipt-render-smoke`);
    assert.equal(response.status, 404);
  });
  assert.equal(isReceiptSmokeEnabled({}), false);
});

test('rejects an invalid smoke secret with timing-safe authorization', async () => {
  await withSmokeServer({ env: smokeEnv, runSmoke: () => { throw new Error('must not run'); } }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/internal/receipt-render-smoke`, {
      headers: { [RECEIPT_SMOKE_SECRET_HEADER]: 'wrong-secret' },
    });
    assert.equal(response.status, 401);
  });
  assert.equal(isAuthorizedReceiptSmokeRequest('wrong-secret', smokeEnv), false);
  assert.equal(isAuthorizedReceiptSmokeRequest(smokeEnv.RECEIPT_SMOKE_TEST_SECRET, smokeEnv), true);
});

test('returns only safe sequential two-render diagnostics for an authorized request', async () => {
  let calls = 0;
  const runSmoke = async () => {
    calls += 1;
    return {
      diagnostics: { syntheticData: true, renders: [{ run: 1 }, { run: 2 }] },
      pdfBuffer: Buffer.from('%PDF- synthetic receipt'),
    };
  };
  await withSmokeServer({ env: smokeEnv, runSmoke }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/internal/receipt-render-smoke`, {
      headers: { [RECEIPT_SMOKE_SECRET_HEADER]: smokeEnv.RECEIPT_SMOKE_TEST_SECRET },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', syntheticData: true, renders: [{ run: 1 }, { run: 2 }] });
  });
  assert.equal(calls, 1);
});

test('returns a synthetic PDF only to an authorized request that explicitly accepts PDF', async () => {
  await withSmokeServer({
    env: smokeEnv,
    runSmoke: async () => ({ diagnostics: { syntheticData: true }, pdfBuffer: Buffer.from('%PDF- synthetic receipt') }),
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/internal/receipt-render-smoke`, {
      headers: {
        [RECEIPT_SMOKE_SECRET_HEADER]: smokeEnv.RECEIPT_SMOKE_TEST_SECRET,
        Accept: 'application/pdf',
      },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^application\/pdf/);
    assert.match(response.headers.get('content-disposition'), /arun-thai-render-smoke-receipt\.pdf/);
    assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString('ascii'), '%PDF-');
  });
});

test('runs two real synthetic Chromium renders sequentially and returns lightweight diagnostics', async () => {
  const result = await runReceiptRenderSmoke();
  assert.ok(Buffer.isBuffer(result.pdfBuffer));
  assert.equal(result.pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.equal(result.diagnostics.renders.length, 2);
  for (const render of result.diagnostics.renders) {
    assert.equal(render.pageCount, 1);
    assert.equal(render.fontLoaded, true);
    assert.equal(render.externalRequests, 0);
    assert.equal(render.browserClosed, true);
    assert.ok(render.pdfBytes > 0);
    assert.ok(render.nodeMemory.beforeLaunch.rss > 0);
    assert.ok(render.nodeMemory.afterClose.rss > 0);
  }
});

test('classifies smoke failures without returning paths, stacks, or secret data', () => {
  assert.equal(classifyReceiptSmokeError(new Error('Executable does not exist')), 'browser_executable_missing');
  assert.equal(classifyReceiptSmokeError(new Error('Receipt attempted external network resources.')), 'external_network_request');
  assert.equal(classifyReceiptSmokeError(new Error('font did not load')), 'font_load_failure');
});
