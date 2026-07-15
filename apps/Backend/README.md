# English Kafé Backend

Express API backend for English Kafé with authentication, course management, payments, enrollments, and blog content.

## Features

- JWT authentication and role-based access control
- Email verification and password reset
- Course, lesson, blog, enrollment, payment, and user management
- File uploads with image validation
- CORS configuration and rate limiting
- Security headers via Helmet

## Technologies

- Node.js
- Express 5
- MongoDB with Mongoose
- JSON Web Tokens
- Bcrypt.js
- Cloudinary for image upload storage
- Resend for email delivery
- Multer for file uploads
- Helmet and express-rate-limit for security

## Install

```bash
npm install
```

## Environment Variables

Create a `.env` file with the following values:

```bash
PORT=3000
MONGO_DB=<your_mongo_connection_string>
JWT_SECRET=<your_jwt_secret>
TRUST_PROXY=true
FRONTEND_URL_LOCAL=http://localhost:5173
ADMIN_URL_LOCAL=http://localhost:5174
BACKEND_URL=http://localhost:3000
CLOUDINARY_CLOUD_NAME=<cloudinary_cloud_name>
CLOUDINARY_API_KEY=<cloudinary_api_key>
CLOUDINARY_API_SECRET=<cloudinary_api_secret>
RESEND_API_KEY=<resend_api_key>
EMAIL_FROM=<from_email_address>
```

## Run

```bash
npm run start
```

## Project Structure

- `routes/` - Express route definitions
- `controllers/` - Request handling logic
- `models/` - Mongoose schemas and models
- `middleware/` - Authentication, validation, error handling
- `services/` - External integrations like email and file uploads
- `config/` - Database and Cloudinary configuration

## Notes

- Ensure `JWT_SECRET` is strong and never committed to source control.
- Use HTTPS in production and configure CORS origins carefully.
- Keep dependencies updated and run security audits regularly.
