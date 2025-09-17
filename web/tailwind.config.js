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
        // Sakura-inspired color palette
        'sakura-pink': '#f8b4d1',
        'sakura-soft-pink': '#fce7f3',
        'sakura-deep-pink': '#ec4899',
        'sakura-petal': '#fdf2f8',
        'sakura-blossom': '#fbbf24',
        'sakura-lavender': '#e0e7ff',
        'sakura-mint': '#d1fae5',
        
        // Background colors
        'bg-primary': '#fefefe',
        'bg-secondary': '#ffffff',
        'bg-tertiary': '#fdf2f8',
        'bg-accent': '#fce7f3',
        'bg-dark': '#2d1b2e',
        'bg-darker': '#1a0e1b',
        
        // Text colors
        'text-primary': '#2d1b2e',
        'text-secondary': '#6b7280',
        'text-muted': '#9ca3af',
        'text-white': '#ffffff',
        'text-sakura': '#ec4899',
        
        // Border colors
        'border-light': '#fce7f3',
        'border-medium': '#f8b4d1',
        'border-dark': '#ec4899',
      },
      fontFamily: {
        'sans': ['Source Sans Pro', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'roblox-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'roblox-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'roblox-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'roblox-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      animation: {
        'bounce-roblox': 'bounce 1s infinite',
        'pulse-roblox': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
