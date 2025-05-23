/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "hsl(210, 80%, 50%)", // A nice blue
          hover: "hsl(210, 80%, 45%)",
        },
        secondary: {
          DEFAULT: "hsl(215, 20%, 50%)", // A muted blue-gray
        },
        accent: {
          DEFAULT: "hsl(30, 90%, 55%)", // A warm orange
        },
        light: "hsl(0, 0%, 100%)", // White
        dark: "hsl(210, 10%, 20%)", // Dark gray
        gray: { // Extended gray palette
          50: 'hsl(210, 20%, 98%)',
          100: 'hsl(210, 20%, 96%)',
          200: 'hsl(210, 20%, 90%)',
          300: 'hsl(210, 15%, 85%)',
          400: 'hsl(210, 15%, 65%)',
          500: 'hsl(210, 10%, 50%)',
          600: 'hsl(210, 10%, 40%)',
          700: 'hsl(210, 10%, 30%)',
          800: 'hsl(210, 10%, 20%)',
          900: 'hsl(210, 10%, 10%)',
        }
      },
      fontFamily: {
        sans: ['"Inter Variable"', "system-ui", "sans-serif"],
      },
      spacing: {
        section: "4rem", // For consistent vertical spacing between sections
      },
      borderRadius: {
        container: "0.75rem", // Consistent border radius for containers/cards
      },
      boxShadow: {
        DEFAULT: '0 2px 4px 0 rgba(0,0,0,0.05)',
        md: '0 4px 8px 0 rgba(0,0,0,0.07)',
        lg: '0 10px 20px 0 rgba(0,0,0,0.07)',
        xl: '0 20px 40px 0 rgba(0,0,0,0.07)',
      }
    },
  },
  plugins: [],
};
