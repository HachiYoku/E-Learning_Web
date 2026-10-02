const express = require('express');
const {
  RECEIPT_SMOKE_SECRET_HEADER,
  classifyReceiptSmokeError,
  isAuthorizedReceiptSmokeRequest,
  isReceiptSmokeEnabled,
  runReceiptRenderSmoke,
} = require('../services/paymentReceiptRenderSmoke');

function wantsPdf(req) {
  return String(req.get('accept') || '').toLowerCase().includes('application/pdf');
}

function createReceiptRenderSmokeRouter({ env = process.env, runSmoke = runReceiptRenderSmoke } = {}) {
  const router = express.Router();

  router.get('/receipt-render-smoke', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!isReceiptSmokeEnabled(env)) return res.status(404).json({ message: 'Not found' });
    if (!isAuthorizedReceiptSmokeRequest(req.get(RECEIPT_SMOKE_SECRET_HEADER), env)) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const result = await runSmoke();
      if (wantsPdf(req)) {
        res.type('application/pdf');
        res.attachment('arun-thai-render-smoke-receipt.pdf');
        return res.send(result.pdfBuffer);
      }
      return res.status(200).json({ status: 'ok', ...result.diagnostics });
    } catch (error) {
      return res.status(500).json({ status: 'failed', category: classifyReceiptSmokeError(error) });
    }
  });

  return router;
}

module.exports = { createReceiptRenderSmokeRouter, wantsPdf };
