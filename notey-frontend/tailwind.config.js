/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Notey brand colors from the cat logo
        'notey': {
          'orange': '#F28C38',
          'brown': '#4A2C18',
          'cream': '#FCEED9',
          'pink': '#F4A9A0',
        },
        // Semantic color mappings using brand colors
        'primary': '#F28C38', // Orange
        'secondary': '#4A2C18', // Dark Brown
        'accent': '#F4A9A0', // Pink
        'background': '#FCEED9', // Cream
      },
      fontFamily: {
        'sans': ['system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
      screens: {
        'xs': '475px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [],
}