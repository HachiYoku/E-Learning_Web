# English Kafé Frontend

Public-facing student website for the English Kafé learning platform built with React and Vite.

## Features

- Course browsing and discovery
- Instructor listing
- Login and session handling
- Token authentication via backend
- Responsive UI with Tailwind CSS

## Technologies

- React 19
- Vite
- React Router v7
- Tailwind CSS
- Lucide React icons

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

The app runs on `http://localhost:5173` by default.

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Environment

Create a `.env` file with the backend API endpoint, for example:

```bash
VITE_API_URL=http://localhost:3000
```

## Notes

- The frontend uses native `fetch` for API calls.
- Be sure the backend is running and accessible from the frontend.
- Keep `package.json` and `package-lock.json` in sync when updating dependencies.
- Thai vowel recordings belong in `public/audio/thai-vowels/`. See its README for the required `01.mp3` through `32.mp3` filename-to-vowel mapping; missing files use Thai text-to-speech as a fallback.
