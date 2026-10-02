const express = require('express');
const http = require('http');
require('dotenv').config();
const { createReceiptRenderSmokeRouter } = require('../routes/receiptRenderSmoke');

// TEMPORARY RENDER DEPLOYMENT PROOF ONLY. This process intentionally mounts no
// application routes and never connects to MongoDB, Cloudinary, or Resend.
const app = express();
const port = process.env.PORT || 3000;

app.disable('x-powered-by');
app.get('/health', (_req, res) => res.status(200).json({ status: 'receipt-render-smoke-only' }));
app.use('/internal', createReceiptRenderSmokeRouter());
app.use((_req, res) => res.status(404).json({ message: 'Not found' }));

const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Receipt render smoke server listening on ${port}`);
});
