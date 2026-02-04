/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        kyar: {
          bg: '#FFFFFF',
          surface: '#FFFFFF',
          muted: '#F9F9F9',
          text: '#000000',
          textSecondary: 'rgba(0,0,0,0.60)',
          textTertiary: 'rgba(0,0,0,0.40)',
          textMuted: 'rgba(0,0,0,0.30)',
          meta: 'rgba(0,0,0,0.50)',
          border: 'rgba(0,0,0,0.10)',
          borderSubtle: 'rgba(0,0,0,0.05)',
          accent: '#1152D4',
          danger: 'rgba(239,68,68,0.80)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        'serif-elegant': ['Bodoni Moda', 'Georgia', 'serif'],
        'sans-wide': ['Montserrat', 'Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        meta: '0.2em',
        wide: '0.25em',
        wider: '0.3em',
        widest: '0.4em',
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '6px',
      },
      boxShadow: {
        soft: '0 20px 40px rgba(0,0,0,0.05)',
        fab: '0 10px 20px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};
