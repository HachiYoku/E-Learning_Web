const express = require('express')
const http = require("http");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
require('dotenv').config();
const errorHandler = require("./middleware/errorHandler");
const { getTrustedUrls } = require("./config/trustedUrls");
const {
  requestId,
  requestCompletionLogger,
  sanitizeServerErrorResponses,
  redact,
} = require("./middleware/monitoring");
const healthCheck = require("./middleware/health");
const { initializeSocketServer, closeSocketServer } = require("./realtime/socketServer");

const parseCookies = (cookieHeader = "") => Object.fromEntries(
  cookieHeader.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index === -1) return ["", ""];
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { return [key, decodeURIComponent(value)]; } catch { return [key, value]; }
  }).filter(([key]) => key)
);

const app = express()
const port = process.env.PORT || 3000
const trustProxy = process.env.TRUST_PROXY
const isProduction = process.env.NODE_ENV === "production"
let trustedUrls;

try {
  trustedUrls = getTrustedUrls();
} catch (error) {
  // These validation messages name configuration keys only; they never echo
  // configured origin values or credentials.
  console.error(`Configuration error: ${error.message}`);
  process.exit(1);
}

if (trustProxy) {
  app.set('trust proxy', trustProxy === 'true' ? 1 : trustProxy)
}

const localOrigins = process.env.NODE_ENV === "production"
  ? []
  : [
      process.env.FRONTEND_URL_LOCAL || "http://localhost:5173",
      "http://localhost:5175",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5175",
      process.env.ADMIN_URL_LOCAL || "http://localhost:5174",
    ];

// Credentialed CORS must use exact origins; never use a wildcard here.
const allowedOrigins = [
  ...localOrigins,
  trustedUrls.frontendUrl,
  trustedUrls.adminUrl,
].filter(Boolean)

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    strictTransportSecurity: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
  })
)

app.use(requestId);
app.use(requestCompletionLogger);
app.use(sanitizeServerErrorResponses);

app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  next();
});

app.use((req, res, next) => {
  const origin = req.headers.origin

  if (!origin || allowedOrigins.includes(origin)) {
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Vary', 'Origin')
    }

    res.header('Access-Control-Allow-Credentials', 'true')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Auth-Portal')
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204)
    }

    return next()
  }

  return res.status(403).json({ message: 'Origin is not allowed by CORS' })
})

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ message: "Too many requests. Please try again later." }),
  })
)

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use((req, _res, next) => {
  req.cookies = parseCookies(req.headers.cookie);
  next();
})

const connectDB = require("./config/dbConnection");
let server;
let shuttingDown = false;

function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`[FATAL] ${reason}`);

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  const closeDatabase = mongoose.connection.readyState === 0
    ? Promise.resolve()
    : mongoose.disconnect().catch(() => undefined);
  const closeServer = new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
  });

  Promise.allSettled([closeSocketServer(), closeServer, closeDatabase]).finally(() => {
    clearTimeout(forceExit);
    process.exit(1);
  });
}

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  shutdown(`Unhandled promise rejection: ${redact(message)}`);
});

process.on("uncaughtException", (error) => {
  shutdown(`Uncaught exception: ${redact(error?.message || error)}`);
});

connectDB().catch(() => shutdown("Database connection failed"));

const authRoutes = require('./routes/auth')
app.use('/auth', authRoutes)

const userRoutes = require('./routes/user')
app.use('/user', userRoutes)

const courseRoutes = require('./routes/course')
app.use('/courses', courseRoutes)

const lessonRoutes = require('./routes/lesson')
app.use('/lessons', lessonRoutes)

const quizRoutes = require('./routes/quiz')
app.use('/quizzes', quizRoutes)

const flashcardRoutes = require('./routes/flashcard')
app.use('/flashcards', flashcardRoutes)

const promoCodeRoutes = require('./routes/promoCode')
app.use('/promo-codes', promoCodeRoutes)

const paymentRoutes = require('./routes/payment')
app.use('/payments', paymentRoutes)

const paymentSettingsRoutes = require('./routes/paymentSettings')
app.use('/payment-settings', paymentSettingsRoutes)

const enrollmentRoutes = require('./routes/enrollment')
app.use('/enrollments', enrollmentRoutes)

const blogRoutes = require('./routes/blog')
app.use('/blogs', blogRoutes)

const notificationRoutes = require('./routes/notification')
app.use('/notifications', notificationRoutes)

const contactRoutes = require('./routes/contact')
app.use('/contacts', contactRoutes)

const supportTicketRoutes = require('./routes/supportTicket')
app.use('/support-tickets', supportTicketRoutes)

const campaignRoutes = require('./routes/campaign')
app.use('/campaigns', campaignRoutes)

const reportRoutes = require('./routes/report')
app.use('/reports', reportRoutes)

app.get('/', (req, res) => {
  res.send('Hello Arun Thai!')
})

app.get('/health', healthCheck)

app.use(errorHandler)

server = http.createServer(app);
initializeSocketServer(server, { allowedOrigins });

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
