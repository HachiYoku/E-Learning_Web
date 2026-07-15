# English Kafé Admin Dashboard

Admin dashboard for the English Kafé learning platform built with React, Vite, and Tailwind CSS.

## Features

- 📊 Dashboard with statistics
- 📚 Course management
- 👥 User management
- 💳 Payment and enrollment review
- 👨‍🏫 Instructor management
- 📈 Reports and analytics
- ⚙️ Settings management
- 👤 Admin profile

## Technologies

- React 18
- Vite
- React Router v6
- Tailwind CSS
- Lucide React icons
- Recharts for charts

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

The admin dashboard runs on `http://localhost:5174` by default.

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Project Structure

- `src/components/` — Reusable UI components
- `src/pages/` — Page views and feature screens
- `src/services/` — API request helpers and service calls
- `src/contexts/` — Authentication and app context
- `src/utils/` — Utility helpers
- `src/App.jsx` — Main app container
- `src/main.jsx` — Vite entry point

## Environment

Create a `.env` file with the backend URL:

```bash
VITE_API_URL=http://localhost:3000
```

## Notes

- The admin interface currently uses native `fetch` in API client code.
- Keep the backend server running so the admin dashboard can connect to the API.
- Commit both `package.json` and `package-lock.json` when dependencies change.
