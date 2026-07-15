export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: '480px',      // extra small devices
        tablet: '768px',  // custom name
        laptop: '1024px',
        desktop: '1280px',
      },
    },
  },
  plugins: [],
}