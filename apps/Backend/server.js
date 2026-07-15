const express = require('express')
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require('dotenv').config();
const errorHandler = require("./middleware/errorHandler");

const app = express()
const port = process.env.PORT || 3000
const trustProxy = process.env.TRUST_PROXY

if (trustProxy) {
  app.set('trust proxy', trustProxy === 'true' ? 1 : trustProxy)
}

const allowedOrigins = [
  process.env.FRONTEND_URL_LOCAL || 'http://localhost:5173',
  process.env.FRONTEND_URL_PROD,
  process.env.ADMIN_URL_LOCAL || 'http://localhost:5174',
  process.env.ADMIN_URL_PROD,
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
].filter(Boolean)

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
)

app.use((req, res, next) => {
  const origin = req.headers.origin

  if (!origin || allowedOrigins.includes(origin)) {
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Vary', 'Origin')
    }

    res.header('Access-Control-Allow-Credentials', 'true')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
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
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again later." },
  })
)

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

const connectDB = require("./config/dbConnection");
connectDB();

const authRoutes = require('./routes/auth')
app.use('/auth', authRoutes)

const userRoutes = require('./routes/user')
app.use('/user', userRoutes)

const courseRoutes = require('./routes/course')
app.use('/courses', courseRoutes)

const lessonRoutes = require('./routes/lesson')
app.use('/lessons', lessonRoutes)

const paymentRoutes = require('./routes/payment')
app.use('/payments', paymentRoutes)

const paymentSettingsRoutes = require('./routes/paymentSettings')
app.use('/payment-settings', paymentSettingsRoutes)

const enrollmentRoutes = require('./routes/enrollment')
app.use('/enrollments', enrollmentRoutes)

const blogRoutes = require('./routes/blog')
app.use('/blogs', blogRoutes)

app.get('/', (req, res) => {
  res.send('Hello English Kafe!')
})

app.use(errorHandler)

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
